import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasServiceRoleKey } from "@/lib/supabase/env";
import { geocodeAddress } from "@/lib/geocoding/recife-coords";
import {
  dependentInputSchema,
  normalizeDependentKey,
  zodIssuesToFieldErrors,
  type CivilProfileUpdateInput,
} from "@/lib/validations/member.schema";
import type { Dependent, Family, Member } from "@/types/database.types";

export interface ProfileMutationResult<T = null> {
  ok: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}

/**
 * Valida e insere dependente garantindo deduplicação insensível a acentos e espaços.
 */
export async function insertDependentIfUnique(
  db: SupabaseClient,
  familyId: string,
  input: { nome: string; data_nascimento: string }
): Promise<ProfileMutationResult<Dependent>> {
  const parsed = dependentInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados do filho(a) inválidos.",
      fieldErrors: zodIssuesToFieldErrors(parsed.error.issues),
    };
  }

  const nome = parsed.data.nome.trim();
  const dataNascimento = parsed.data.data_nascimento;

  const { data: existingDeps } = await db
    .from("dependents")
    .select("nome, data_nascimento")
    .eq("family_id", familyId)
    .returns<Array<Pick<Dependent, "nome" | "data_nascimento">>>();

  const targetKey = normalizeDependentKey(nome, dataNascimento);
  const alreadyExists = (existingDeps ?? []).some(
    (d) => normalizeDependentKey(d.nome, d.data_nascimento) === targetKey
  );

  if (alreadyExists) {
    return {
      ok: false,
      error: "Este filho(a) já está cadastrado nesta família.",
    };
  }

  const { data, error } = await db
    .from("dependents")
    .insert({
      family_id: familyId,
      nome,
      data_nascimento: dataNascimento,
    })
    .select("*")
    .single<Dependent>();

  if (error || !data) {
    return { ok: false, error: "Não foi possível cadastrar o filho(a)." };
  }

  return { ok: true, data };
}

async function mergeFamilyIntoTarget(
  admin: SupabaseClient,
  sourceFamilyId: string,
  targetFamilyId: string
): Promise<void> {
  if (sourceFamilyId === targetFamilyId) return;

  const [{ data: sourceDeps }, { data: targetDeps }] = await Promise.all([
    admin
      .from("dependents")
      .select("id, nome, data_nascimento, promovido_membro_id")
      .eq("family_id", sourceFamilyId)
      .returns<
        Array<Pick<Dependent, "id" | "nome" | "data_nascimento" | "promovido_membro_id">>
      >(),
    admin
      .from("dependents")
      .select("id, nome, data_nascimento, promovido_membro_id")
      .eq("family_id", targetFamilyId)
      .returns<
        Array<Pick<Dependent, "id" | "nome" | "data_nascimento" | "promovido_membro_id">>
      >(),
  ]);

  const targetByKey = new Map(
    (targetDeps ?? []).map((d) => [normalizeDependentKey(d.nome, d.data_nascimento), d])
  );

  for (const dep of sourceDeps ?? []) {
    const key = normalizeDependentKey(dep.nome, dep.data_nascimento);
    const existingTarget = targetByKey.get(key);
    if (existingTarget) {
      await admin
        .from("member_invites")
        .update({ family_id: targetFamilyId, dependent_id: existingTarget.id })
        .eq("dependent_id", dep.id);

      const promotedMemberIdToTransfer =
        !existingTarget.promovido_membro_id && dep.promovido_membro_id
          ? dep.promovido_membro_id
          : null;

      await admin.from("dependents").delete().eq("id", dep.id);

      if (promotedMemberIdToTransfer) {
        await admin
          .from("dependents")
          .update({ promovido_membro_id: promotedMemberIdToTransfer })
          .eq("id", existingTarget.id);
        existingTarget.promovido_membro_id = promotedMemberIdToTransfer;
      }
    } else {
      targetByKey.set(key, dep);
      await admin
        .from("dependents")
        .update({ family_id: targetFamilyId })
        .eq("id", dep.id);
    }
  }

  await admin
    .from("member_invites")
    .update({ family_id: targetFamilyId })
    .eq("family_id", sourceFamilyId);
}

async function cleanupOrphanFamilyIfEmpty(
  admin: SupabaseClient,
  familyId: string
): Promise<void> {
  const [{ count: membersCount }, { count: depsCount }] = await Promise.all([
    admin
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("family_id", familyId),
    admin
      .from("dependents")
      .select("id", { count: "exact", head: true })
      .eq("family_id", familyId),
  ]);

  if ((membersCount ?? 0) === 0 && (depsCount ?? 0) === 0) {
    await admin.from("families").delete().eq("id", familyId);
  }
}

/**
 * Aplica atualização civil, de endereço (com geocoding), vínculo conjugal bidirecional
 * e opcionalmente pedido de oração. Compartilhado entre /minha-ficha e /admin/membro/[id].
 */
export async function applyCivilProfileUpdate(params: {
  writerClient: SupabaseClient;
  targetMember: Member;
  targetFamily: Family | null;
  data: CivilProfileUpdateInput;
  includePrayerRequest: boolean;
}): Promise<ProfileMutationResult<null>> {
  const { writerClient, targetMember, targetFamily, data, includePrayerRequest } = params;

  const desiredSpouseCpf =
    data.estado_civil === "Casado(a)" && data.conjuge_congrega_ipcf
      ? data.conjuge_cpf || null
      : null;

  if (desiredSpouseCpf && desiredSpouseCpf === targetMember.cpf) {
    return {
      ok: false,
      error: "O CPF do cônjuge não pode ser igual ao próprio CPF.",
      fieldErrors: { conjuge_cpf: "O CPF do cônjuge não pode ser igual ao próprio CPF." },
    };
  }

  const admin = hasServiceRoleKey() ? createSupabaseAdminClient() : null;
  let matchedSpouse:
    | Pick<Member, "id" | "cpf" | "family_id" | "nome_completo" | "conjuge_cpf">
    | null = null;

  if (desiredSpouseCpf && admin) {
    const { data: sp } = await admin
      .from("members")
      .select("id, cpf, family_id, nome_completo, conjuge_cpf")
      .eq("cpf", desiredSpouseCpf)
      .maybeSingle<
        Pick<Member, "id" | "cpf" | "family_id" | "nome_completo" | "conjuge_cpf">
      >();

    if (sp && sp.conjuge_cpf && sp.conjuge_cpf !== targetMember.cpf) {
      return {
        ok: false,
        error:
          "O CPF informado já está vinculado a outro cônjuge no Dados IPCF. Verifique com a Secretaria.",
        fieldErrors: { conjuge_cpf: "Este CPF já está vinculado a outro cônjuge." },
      };
    }

    matchedSpouse = sp ?? null;
  }

  const cleanCep = data.cep || null;
  const addressChanged =
    !targetFamily ||
    (targetFamily.cep ?? null) !== cleanCep ||
    targetFamily.logradouro !== data.logradouro ||
    targetFamily.numero !== data.numero ||
    targetFamily.bairro !== data.bairro ||
    targetFamily.cidade !== data.cidade ||
    targetFamily.latitude == null ||
    targetFamily.longitude == null;

  const coords = addressChanged
    ? await geocodeAddress(data.logradouro, data.numero, data.bairro, data.cidade)
    : {
        latitude: Number(targetFamily.latitude),
        longitude: Number(targetFamily.longitude),
      };

  // Preserva data de casamento já existente no lar do cônjuge ao vincular pela 1ª vez sem repassar a data
  let inheritedMarriageDate: string | null = null;
  if (
    data.estado_civil === "Casado(a)" &&
    !data.data_casamento &&
    matchedSpouse?.family_id &&
    matchedSpouse.family_id !== targetMember.family_id &&
    admin
  ) {
    const { data: spouseFam } = await admin
      .from("families")
      .select("data_casamento")
      .eq("id", matchedSpouse.family_id)
      .maybeSingle<Pick<Family, "data_casamento">>();
    inheritedMarriageDate = spouseFam?.data_casamento ?? null;
  }

  const effectiveMarriageDate =
    data.estado_civil === "Casado(a)"
      ? data.data_casamento || inheritedMarriageDate || null
      : null;

  const familyPayload = {
    cep: cleanCep,
    logradouro: data.logradouro,
    numero: data.numero,
    complemento: data.complemento || null,
    bairro: data.bairro,
    cidade: data.cidade,
    latitude: coords.latitude,
    longitude: coords.longitude,
    data_casamento: effectiveMarriageDate,
  };

  let effectiveFamilyId = targetMember.family_id;

  if (effectiveFamilyId) {
    const { error: familyError } = await writerClient
      .from("families")
      .update(familyPayload)
      .eq("id", effectiveFamilyId);

    if (familyError) {
      return {
        ok: false,
        error: "Não foi possível atualizar o endereço do lar.",
      };
    }
  } else if (matchedSpouse?.family_id && admin) {
    effectiveFamilyId = matchedSpouse.family_id;
    const { error: spouseFamError } = await admin
      .from("families")
      .update(familyPayload)
      .eq("id", effectiveFamilyId);

    if (spouseFamError) {
      return {
        ok: false,
        error: "Não foi possível atualizar o endereço do lar compartilhado.",
      };
    }
  } else {
    const famClient = admin ?? writerClient;
    const { data: createdFamily, error: createFamError } = await famClient
      .from("families")
      .insert(familyPayload)
      .select("id")
      .single<{ id: string }>();

    if (createFamError || !createdFamily) {
      return {
        ok: false,
        error: "Não foi possível registrar o endereço do lar.",
      };
    }
    effectiveFamilyId = createdFamily.id;
  }

  const { error: updateMemberError } = await writerClient
    .from("members")
    .update({
      ...(effectiveFamilyId !== targetMember.family_id
        ? { family_id: effectiveFamilyId }
        : {}),
      nome_completo: data.nome_completo,
      sexo: data.sexo,
      data_nascimento: data.data_nascimento,
      naturalidade: data.naturalidade || null,
      profissao: data.profissao || null,
      whatsapp: data.whatsapp,
      email: data.email || null,
      estado_civil: data.estado_civil,
      conjuge_congrega_ipcf:
        data.estado_civil === "Casado(a)"
          ? Boolean(data.conjuge_congrega_ipcf || matchedSpouse)
          : false,
      nome_conjuge:
        data.estado_civil === "Casado(a)"
          ? data.nome_conjuge || matchedSpouse?.nome_completo || null
          : null,
      conjuge_cpf:
        data.estado_civil === "Casado(a)" && (data.conjuge_congrega_ipcf || matchedSpouse)
          ? desiredSpouseCpf || matchedSpouse?.cpf || null
          : null,
      disponibilidade_dias: data.disponibilidade_dias,
      talentos_ministerios: data.talentos_ministerios || null,
      dificuldade_tempo: data.dificuldade_tempo || null,
    })
    .eq("id", targetMember.id);

  if (updateMemberError) {
    return {
      ok: false,
      error: "Não foi possível atualizar os dados pessoais.",
    };
  }

  // Sincroniza núcleo familiar e vínculo bidirecional com o cônjuge
  if (admin) {
    if (matchedSpouse && effectiveFamilyId) {
      const oldSpouseFamilyId = matchedSpouse.family_id;
      if (oldSpouseFamilyId && oldSpouseFamilyId !== effectiveFamilyId) {
        await mergeFamilyIntoTarget(admin, oldSpouseFamilyId, effectiveFamilyId);
      }

      const { error: spouseUpdateError } = await admin
        .from("members")
        .update({
          family_id: effectiveFamilyId,
          estado_civil: "Casado(a)",
          conjuge_congrega_ipcf: true,
          conjuge_cpf: targetMember.cpf,
          nome_conjuge: data.nome_completo,
        })
        .eq("id", matchedSpouse.id);

      if (spouseUpdateError) {
        return {
          ok: false,
          error:
            "Seus dados foram salvos, mas não foi possível sincronizar o vínculo com o cônjuge. Tente novamente.",
        };
      }

      if (oldSpouseFamilyId && oldSpouseFamilyId !== effectiveFamilyId) {
        await cleanupOrphanFamilyIfEmpty(admin, oldSpouseFamilyId);
      }
    } else if (
      targetMember.conjuge_cpf &&
      (!desiredSpouseCpf || desiredSpouseCpf !== targetMember.conjuge_cpf)
    ) {
      // Remove vínculo reverso antigo somente se o antigo cônjuge ainda apontava para este membro e não for falecido
      const { error: unlinkError } = await admin
        .from("members")
        .update({
          conjuge_cpf: null,
          conjuge_congrega_ipcf: false,
        })
        .eq("cpf", targetMember.conjuge_cpf)
        .eq("conjuge_cpf", targetMember.cpf)
        .neq("status_cadastro", "Falecido");

      if (unlinkError) {
        return {
          ok: false,
          error:
            "Seus dados foram salvos, mas não foi possível atualizar o vínculo anterior do cônjuge.",
        };
      }
    }
  }

  if (includePrayerRequest) {
    const { error: prayerError } = await writerClient.from("prayer_requests").upsert(
      {
        member_id: targetMember.id,
        motivo: data.pedido_oracao || "",
      },
      { onConflict: "member_id" }
    );

    if (prayerError) {
      return {
        ok: false,
        error:
          "Seus dados foram salvos, mas não foi possível atualizar o pedido de oração. Tente novamente.",
      };
    }
  }

  return { ok: true, data: null };
}
