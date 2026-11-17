"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentMemberContext } from "@/lib/supabase/session-member";
import {
  getAdminMasterCpfs,
  hasServiceRoleKey,
  isSupabaseConfigured,
} from "@/lib/supabase/env";
import { geocodeAddress } from "@/lib/geocoding/recife-coords";
import { applyCivilProfileUpdate } from "@/lib/supabase/profile-update";
import {
  censoSchema,
  cleanDigits,
  cpfToShadowEmail,
  isValidCPF,
  memberSelfUpdateSchema,
  normalizeDependentKey,
  zodIssuesToFieldErrors,
} from "@/lib/validations/member.schema";
import type { ActionResponse } from "./auth.actions";
import type { Dependent, Family, Member, SpousePrefillData } from "@/types/database.types";

export interface CpfCheckResult {
  alreadyRegistered: boolean;
  spousePrefill: SpousePrefillData;
}

export async function checkCpfBeforeCensoAction(
  cpfInput: string
): Promise<ActionResponse<CpfCheckResult>> {
  if (!isSupabaseConfigured() || !hasServiceRoleKey()) {
    return {
      ok: false,
      error: "Ambiente Supabase não configurado completamente.",
    };
  }

  const cpf = cleanDigits(cpfInput);
  if (!isValidCPF(cpf)) {
    return { ok: false, error: "Informe um CPF válido com 11 dígitos." };
  }

  const admin = createSupabaseAdminClient();

  const { data: existingMember } = await admin
    .from("members")
    .select("id")
    .eq("cpf", cpf)
    .maybeSingle<{ id: string }>();

  if (existingMember) {
    return {
      ok: true,
      data: {
        alreadyRegistered: true,
        spousePrefill: { found: false },
      },
    };
  }

  // RN05: Verificar se o cônjuge já respondeu o censo informando este CPF
  const { data: spouseMember } = await admin
    .from("members")
    .select("id, nome_completo, cpf, family_id, nome_conjuge")
    .eq("conjuge_cpf", cpf)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      id: string;
      nome_completo: string;
      cpf: string;
      family_id: string | null;
      nome_conjuge: string | null;
    }>();

  if (!spouseMember) {
    return {
      ok: true,
      data: {
        alreadyRegistered: false,
        spousePrefill: { found: false },
      },
    };
  }

  const [{ data: family }, { data: dependents }] = spouseMember.family_id
    ? await Promise.all([
        admin
          .from("families")
          .select("*")
          .eq("id", spouseMember.family_id)
          .maybeSingle<Family>(),
        admin
          .from("dependents")
          .select("nome, data_nascimento")
          .eq("family_id", spouseMember.family_id)
          .order("data_nascimento", { ascending: true })
          .returns<Array<{ nome: string; data_nascimento: string }>>(),
      ])
    : [{ data: null as Family | null }, { data: [] as Array<{ nome: string; data_nascimento: string }> }];

  return {
    ok: true,
    data: {
      alreadyRegistered: false,
      spousePrefill: {
        found: true,
        prefilledMemberName: spouseMember.nome_conjuge?.trim() || undefined,
        spouseName: spouseMember.nome_completo,
        spouseCpf: spouseMember.cpf,
        familyId: spouseMember.family_id ?? undefined,
        cep: family?.cep ?? null,
        logradouro: family?.logradouro ?? null,
        numero: family?.numero ?? null,
        complemento: family?.complemento ?? null,
        bairro: family?.bairro ?? "Casa Forte",
        cidade: family?.cidade ?? "Recife",
        data_casamento: family?.data_casamento ?? null,
        dependents: dependents ?? [],
      },
    },
  };
}

export async function submitNewCensoAction(
  rawPayload: unknown
): Promise<ActionResponse<{ redirectTo: string }>> {
  if (!isSupabaseConfigured() || !hasServiceRoleKey()) {
    return {
      ok: false,
      error: "Supabase ou Service Role Key não configurados neste servidor.",
    };
  }

  const parsed = censoSchema.safeParse(rawPayload);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Verifique os campos destacados.",
      fieldErrors,
    };
  }

  const data = parsed.data;
  const admin = createSupabaseAdminClient();

  const { data: duplicateCpf } = await admin
    .from("members")
    .select("id")
    .eq("cpf", data.cpf)
    .maybeSingle<{ id: string }>();

  if (duplicateCpf) {
    return {
      ok: false,
      error:
        "Este CPF já possui cadastro no Dados IPCF. Acesse pela opção 'Já tenho cadastro'.",
    };
  }

  // Localiza possível cônjuge que já respondeu ao censo
  let matchedSpouse: Pick<Member, "id" | "family_id" | "nome_completo" | "cpf"> | null = null;
  const { data: listedAsSpouse } = await admin
    .from("members")
    .select("id, family_id, nome_completo, cpf")
    .eq("conjuge_cpf", data.cpf)
    .maybeSingle<Pick<Member, "id" | "family_id" | "nome_completo" | "cpf">>();

  if (listedAsSpouse) {
    matchedSpouse = listedAsSpouse;
  } else if (
    data.estado_civil === "Casado(a)" &&
    data.conjuge_congrega_ipcf &&
    data.conjuge_cpf
  ) {
    const { data: spouseByInputCpf } = await admin
      .from("members")
      .select("id, family_id, nome_completo, cpf, conjuge_cpf")
      .eq("cpf", data.conjuge_cpf)
      .maybeSingle<
        Pick<Member, "id" | "family_id" | "nome_completo" | "cpf" | "conjuge_cpf">
      >();

    if (
      spouseByInputCpf &&
      spouseByInputCpf.conjuge_cpf &&
      spouseByInputCpf.conjuge_cpf !== data.cpf
    ) {
      return {
        ok: false,
        error:
          "O CPF informado para o cônjuge já está vinculado a outro membro no Dados IPCF. Confira os dados ou procure a Secretaria.",
        fieldErrors: {
          conjuge_cpf: "Este CPF já está vinculado a outro cônjuge.",
        },
      };
    }

    if (spouseByInputCpf) {
      matchedSpouse = spouseByInputCpf;
    }
  }

  let familyId = matchedSpouse?.family_id ?? null;
  let createdFamilyId: string | null = null;

  const coords = await geocodeAddress(
    data.logradouro,
    data.numero,
    data.bairro,
    data.cidade
  );

  if (!familyId) {
    const { data: newFamily, error: familyError } = await admin
      .from("families")
      .insert({
        cep: data.cep || null,
        logradouro: data.logradouro,
        numero: data.numero,
        complemento: data.complemento || null,
        bairro: data.bairro,
        cidade: data.cidade,
        latitude: coords.latitude,
        longitude: coords.longitude,
        data_casamento:
          data.estado_civil === "Casado(a)" && data.data_casamento
            ? data.data_casamento
            : null,
      })
      .select("id")
      .single<{ id: string }>();

    if (familyError || !newFamily) {
      return {
        ok: false,
        error: "Erro ao registrar o endereço da família. Tente novamente.",
      };
    }
    familyId = newFamily.id;
    createdFamilyId = newFamily.id;
  } else {
    // Atualiza o lar compartilhado com a confirmação do 2º cônjuge
    await admin
      .from("families")
      .update({
        cep: data.cep || null,
        logradouro: data.logradouro,
        numero: data.numero,
        complemento: data.complemento || null,
        bairro: data.bairro,
        cidade: data.cidade,
        latitude: coords.latitude,
        longitude: coords.longitude,
        ...(data.estado_civil === "Casado(a)" && data.data_casamento
          ? { data_casamento: data.data_casamento }
          : {}),
      })
      .eq("id", familyId);
  }

  const shadowEmail = cpfToShadowEmail(data.cpf);
  const { data: authCreated, error: authError } =
    await admin.auth.admin.createUser({
      email: shadowEmail,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        nome_completo: data.nome_completo,
      },
    });

  if (authError || !authCreated.user) {
    if (createdFamilyId) {
      await admin.from("families").delete().eq("id", createdFamilyId);
    }
    return {
      ok: false,
      error:
        authError?.message.includes("already been registered")
          ? "Já existe uma conta de acesso com este CPF. Use 'Já tenho cadastro'."
          : "Não foi possível criar seu acesso. Tente novamente.",
    };
  }

  const userId = authCreated.user.id;
  const adminMasterList = getAdminMasterCpfs();
  const initialRole = adminMasterList.includes(data.cpf) ? "admin" : "membro";

  const spouseCpfNormalized =
    data.estado_civil === "Casado(a)" && data.conjuge_congrega_ipcf
      ? data.conjuge_cpf || matchedSpouse?.cpf || null
      : null;

  const { data: insertedMember, error: memberError } = await admin
    .from("members")
    .insert({
      user_id: userId,
      family_id: familyId,
      cpf: data.cpf,
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
      conjuge_cpf: spouseCpfNormalized,
      disponibilidade_dias: data.disponibilidade_dias,
      talentos_ministerios: data.talentos_ministerios || null,
      dificuldade_tempo: data.dificuldade_tempo || null,
      status_membresia: data.status_membresia,
      oficiato:
        data.status_membresia === "Membro Comungante" ? data.oficiato : "Não oficial",
      status_cadastro: "Ativo",
      role: initialRole,
      consentimento_lgpd: true,
      consentimento_em: new Date().toISOString(),
    })
    .select("id")
    .single<{ id: string }>();

  if (memberError || !insertedMember) {
    await admin.auth.admin.deleteUser(userId);
    if (createdFamilyId) {
      await admin.from("families").delete().eq("id", createdFamilyId);
    }
    return {
      ok: false,
      error: "Erro ao salvar sua ficha cadastral. Verifique os dados e tente novamente.",
    };
  }

  // RN05: Vínculo bidirecional no cônjuge que já estava cadastrado
  if (matchedSpouse) {
    await admin
      .from("members")
      .update({
        family_id: familyId,
        conjuge_congrega_ipcf: true,
        conjuge_cpf: data.cpf,
        nome_conjuge: data.nome_completo,
      })
      .eq("id", matchedSpouse.id);
  }

  // Deduplica dependentes já cadastrados na família antes de inserir novos
  if (data.dependents.length > 0) {
    const { data: existingDeps } = await admin
      .from("dependents")
      .select("nome, data_nascimento")
      .eq("family_id", familyId)
      .returns<Array<Pick<Dependent, "nome" | "data_nascimento">>>();

    const existingKeys = new Set(
      (existingDeps ?? []).map((d) =>
        normalizeDependentKey(d.nome, d.data_nascimento)
      )
    );

    const newDeps = data.dependents.filter((d) => {
      const key = normalizeDependentKey(d.nome, d.data_nascimento);
      if (existingKeys.has(key)) return false;
      existingKeys.add(key);
      return true;
    });

    if (newDeps.length > 0) {
      await admin.from("dependents").insert(
        newDeps.map((d) => ({
          family_id: familyId,
          nome: d.nome.trim(),
          data_nascimento: d.data_nascimento,
        }))
      );
    }
  }

  // RN07: Pedido de oração sigiloso 1:1
  await admin.from("prayer_requests").upsert(
    {
      member_id: insertedMember.id,
      motivo: data.pedido_oracao || "",
    },
    { onConflict: "member_id" }
  );

  // Autentica automaticamente a sessão SSR do novo recenseado
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signInWithPassword({
    email: shadowEmail,
    password: data.password,
  });

  revalidatePath("/");
  revalidatePath("/minha-ficha");
  revalidatePath("/admin");

  return {
    ok: true,
    data: {
      redirectTo: initialRole === "admin" ? "/admin" : "/minha-ficha",
    },
    message: "Cadastro concluído! Bem-vindo à sua ficha no Dados IPCF.",
  };
}

export async function updateMyProfileAction(
  rawPayload: unknown
): Promise<ActionResponse<null>> {
  const ctx = await getCurrentMemberContext();
  if (!ctx.configured || !ctx.authenticated || !ctx.member) {
    return { ok: false, error: "Você precisa estar autenticado." };
  }

  const parsed = memberSelfUpdateSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Verifique os campos preenchidos.",
      fieldErrors: zodIssuesToFieldErrors(parsed.error.issues),
    };
  }

  const supabase = await createSupabaseServerClient();
  const result = await applyCivilProfileUpdate({
    writerClient: supabase,
    targetMember: ctx.member,
    targetFamily: ctx.family,
    data: parsed.data,
    includePrayerRequest: true,
  });

  if (!result.ok) {
    return {
      ok: false,
      error: result.error ?? "Não foi possível salvar suas alterações.",
      fieldErrors: result.fieldErrors,
    };
  }

  revalidatePath("/minha-ficha");
  revalidatePath("/admin");
  revalidatePath(`/admin/membro/${ctx.member.id}`);

  return {
    ok: true,
    data: null,
    message: "Alterações salvas com sucesso!",
  };
}
