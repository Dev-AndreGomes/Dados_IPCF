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
import { insertDependentIfUnique } from "@/lib/supabase/profile-update";
import {
  cpfToShadowEmail,
  inviteCompletionSchema,
  zodIssuesToFieldErrors,
} from "@/lib/validations/member.schema";
import type { ActionResponse } from "./auth.actions";
import type { Dependent, Family, Member, MemberInvite } from "@/types/database.types";

export async function addDependentAction(input: {
  nome: string;
  data_nascimento: string;
}): Promise<ActionResponse<Dependent>> {
  const ctx = await getCurrentMemberContext();
  if (!ctx.configured || !ctx.authenticated || !ctx.member?.family_id) {
    return { ok: false, error: "Sessão inválida para adicionar filho(a)." };
  }

  const supabase = await createSupabaseServerClient();
  const result = await insertDependentIfUnique(supabase, ctx.member.family_id, input);

  if (!result.ok || !result.data) {
    return {
      ok: false,
      error: result.error ?? "Não foi possível cadastrar o filho(a).",
      fieldErrors: result.fieldErrors,
    };
  }

  revalidatePath("/minha-ficha");
  revalidatePath("/admin");
  revalidatePath(`/admin/membro/${ctx.member.id}`);

  return {
    ok: true,
    data: result.data,
    message: `${result.data.nome} adicionado(a) à família.`,
  };
}

export async function removeDependentAction(
  dependentId: string
): Promise<ActionResponse<null>> {
  const ctx = await getCurrentMemberContext();
  if (!ctx.configured || !ctx.authenticated || !ctx.member?.family_id) {
    return { ok: false, error: "Sessão inválida." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: deleted, error } = await supabase
    .from("dependents")
    .delete()
    .eq("id", dependentId)
    .eq("family_id", ctx.member.family_id)
    .is("promovido_membro_id", null)
    .select("id");

  if (error || !deleted || deleted.length === 0) {
    return {
      ok: false,
      error: "Não foi possível remover este dependente (ou ele já possui conta própria).",
    };
  }

  revalidatePath("/minha-ficha");
  revalidatePath("/admin");
  revalidatePath(`/admin/membro/${ctx.member.id}`);

  return { ok: true, data: null };
}

export async function createChildInviteAction(
  dependentId: string
): Promise<ActionResponse<{ token: string; invitePath: string; childName: string }>> {
  const ctx = await getCurrentMemberContext();
  if (!ctx.configured || !ctx.authenticated || !ctx.member?.family_id) {
    return { ok: false, error: "Sessão inválida para gerar convite." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: dependent } = await supabase
    .from("dependents")
    .select("*")
    .eq("id", dependentId)
    .eq("family_id", ctx.member.family_id)
    .maybeSingle<Dependent>();

  if (!dependent) {
    return { ok: false, error: "Filho(a) não encontrado neste núcleo familiar." };
  }

  if (dependent.promovido_membro_id) {
    return {
      ok: false,
      error: `${dependent.nome} já concluiu sua ficha própria no Dados IPCF.`,
    };
  }

  // Reutiliza convite ativo não expirado caso exista
  const { data: existingInvite } = await supabase
    .from("member_invites")
    .select("token, expires_at")
    .eq("dependent_id", dependent.id)
    .eq("usado", false)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<Pick<MemberInvite, "token" | "expires_at">>();

  if (existingInvite) {
    return {
      ok: true,
      data: {
        token: existingInvite.token,
        invitePath: `/convite/${existingInvite.token}`,
        childName: dependent.nome,
      },
    };
  }

  const { data: created, error } = await supabase
    .from("member_invites")
    .insert({
      dependent_id: dependent.id,
      family_id: ctx.member.family_id,
      criado_por: ctx.member.id,
    })
    .select("token")
    .single<{ token: string }>();

  if (error || !created) {
    return { ok: false, error: "Não foi possível gerar o link de convite." };
  }

  return {
    ok: true,
    data: {
      token: created.token,
      invitePath: `/convite/${created.token}`,
      childName: dependent.nome,
    },
  };
}

export interface InviteContextData {
  valid: boolean;
  reason?: string;
  token: string;
  childName?: string;
  childBirthDate?: string;
  familyAddress?: {
    cep: string | null;
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string;
    cidade: string;
  };
  parentsNames?: string[];
}

export async function getInviteContextForPage(
  token: string
): Promise<InviteContextData> {
  if (!isSupabaseConfigured() || !hasServiceRoleKey()) {
    return {
      valid: false,
      token,
      reason: "Ambiente Supabase não configurado neste servidor.",
    };
  }

  const admin = createSupabaseAdminClient();
  const { data: invite } = await admin
    .from("member_invites")
    .select("*")
    .eq("token", token)
    .maybeSingle<MemberInvite>();

  if (!invite) {
    return { valid: false, token, reason: "Convite não encontrado." };
  }

  if (invite.usado) {
    return {
      valid: false,
      token,
      reason: "Este link já foi utilizado para ativar uma ficha própria.",
    };
  }

  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return {
      valid: false,
      token,
      reason: "Este convite expirou. Peça aos seus pais ou à IPCF para gerar um novo link.",
    };
  }

  const [{ data: dependent }, { data: family }, { data: familyMembers }] =
    await Promise.all([
      admin
        .from("dependents")
        .select("*")
        .eq("id", invite.dependent_id)
        .maybeSingle<Dependent>(),
      admin
        .from("families")
        .select("*")
        .eq("id", invite.family_id)
        .maybeSingle<Family>(),
      admin
        .from("members")
        .select("nome_completo")
        .eq("family_id", invite.family_id)
        .returns<Array<Pick<Member, "nome_completo">>>(),
    ]);

  if (!dependent || dependent.promovido_membro_id) {
    return {
      valid: false,
      token,
      reason: "Este dependente já foi emancipado para conta própria.",
    };
  }

  return {
    valid: true,
    token,
    childName: dependent.nome,
    childBirthDate: dependent.data_nascimento,
    familyAddress: family
      ? {
          cep: family.cep,
          logradouro: family.logradouro,
          numero: family.numero,
          complemento: family.complemento,
          bairro: family.bairro,
          cidade: family.cidade,
        }
      : undefined,
    parentsNames: (familyMembers ?? []).map((m) => m.nome_completo),
  };
}

export async function completeChildInviteAction(
  rawPayload: unknown
): Promise<ActionResponse<{ redirectTo: string }>> {
  if (!isSupabaseConfigured() || !hasServiceRoleKey()) {
    return { ok: false, error: "Supabase não configurado." };
  }

  const parsed = inviteCompletionSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
      fieldErrors: zodIssuesToFieldErrors(parsed.error.issues),
    };
  }

  const data = parsed.data;
  const admin = createSupabaseAdminClient();

  const { data: invite } = await admin
    .from("member_invites")
    .select("*")
    .eq("token", data.token)
    .maybeSingle<MemberInvite>();

  if (!invite || invite.usado || new Date(invite.expires_at).getTime() < Date.now()) {
    return {
      ok: false,
      error: "Convite inválido, expirado ou já utilizado.",
    };
  }

  const { data: dependent } = await admin
    .from("dependents")
    .select("*")
    .eq("id", invite.dependent_id)
    .maybeSingle<Dependent>();

  if (!dependent || dependent.promovido_membro_id) {
    return {
      ok: false,
      error: "Este cadastro de dependente já possui acesso próprio.",
    };
  }

  const { data: existingCpf } = await admin
    .from("members")
    .select("id")
    .eq("cpf", data.cpf)
    .maybeSingle<{ id: string }>();

  if (existingCpf) {
    return {
      ok: false,
      error: "Este CPF já possui cadastro no Dados IPCF. Faça login normalmente.",
    };
  }

  // Verifica possível vínculo conjugal informado pelo filho emancipado
  let matchedSpouse: Pick<
    Member,
    "id" | "cpf" | "family_id" | "nome_completo" | "conjuge_cpf"
  > | null = null;
  if (
    data.estado_civil === "Casado(a)" &&
    data.conjuge_congrega_ipcf &&
    data.conjuge_cpf
  ) {
    const { data: spouseFound } = await admin
      .from("members")
      .select("id, cpf, family_id, nome_completo, conjuge_cpf")
      .eq("cpf", data.conjuge_cpf)
      .maybeSingle<
        Pick<Member, "id" | "cpf" | "family_id" | "nome_completo" | "conjuge_cpf">
      >();

    if (
      spouseFound &&
      spouseFound.conjuge_cpf &&
      spouseFound.conjuge_cpf !== data.cpf
    ) {
      return {
        ok: false,
        error:
          "O CPF informado para o cônjuge já está vinculado a outro membro no Dados IPCF.",
        fieldErrors: {
          conjuge_cpf: "Este CPF já está vinculado a outro cônjuge.",
        },
      };
    }

    matchedSpouse = spouseFound ?? null;
  }

  // Identifica pai/mãe biológicos ou responsáveis no lar de origem (RN06)
  const { data: familyAdults } = await admin
    .from("members")
    .select("id, sexo")
    .eq("family_id", invite.family_id)
    .returns<Array<Pick<Member, "id" | "sexo">>>();

  const paiId =
    familyAdults?.find((a) => a.sexo === "Masculino")?.id ?? null;
  const maeId =
    familyAdults?.find((a) => a.sexo === "Feminino")?.id ?? null;

  let targetFamilyId = invite.family_id;
  let createdNewFamilyId: string | null = null;

  if (!data.mora_com_pais) {
    const coords = await geocodeAddress(
      data.logradouro || "",
      data.numero || "S/N",
      data.bairro || "Casa Forte",
      data.cidade || "Recife"
    );

    const { data: newFamily, error: familyError } = await admin
      .from("families")
      .insert({
        cep: data.cep || null,
        logradouro: data.logradouro,
        numero: data.numero,
        complemento: data.complemento || null,
        bairro: data.bairro,
        cidade: data.cidade || "Recife",
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
      return { ok: false, error: "Erro ao registrar seu novo endereço." };
    }

    targetFamilyId = newFamily.id;
    createdNewFamilyId = newFamily.id;
  }

  const shadowEmail = cpfToShadowEmail(data.cpf);
  const { data: authCreated, error: authError } =
    await admin.auth.admin.createUser({
      email: shadowEmail,
      password: data.password,
      email_confirm: true,
      user_metadata: { nome_completo: dependent.nome },
    });

  if (authError || !authCreated.user) {
    if (createdNewFamilyId) {
      await admin.from("families").delete().eq("id", createdNewFamilyId);
    }
    return {
      ok: false,
      error: "Não foi possível criar seu acesso. Verifique se o CPF já não foi usado.",
    };
  }

  const role = getAdminMasterCpfs().includes(data.cpf) ? "admin" : "membro";

  const { data: newMember, error: insertError } = await admin
    .from("members")
    .insert({
      user_id: authCreated.user.id,
      family_id: targetFamilyId,
      cpf: data.cpf,
      nome_completo: dependent.nome,
      sexo: data.sexo,
      data_nascimento: dependent.data_nascimento,
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
          ? data.conjuge_cpf || matchedSpouse?.cpf || null
          : null,
      pai_membro_id: paiId,
      mae_membro_id: maeId,
      disponibilidade_dias: data.disponibilidade_dias,
      talentos_ministerios: data.talentos_ministerios || null,
      dificuldade_tempo: data.dificuldade_tempo || null,
      status_membresia: data.status_membresia,
      oficiato: "Não oficial",
      status_cadastro: "Ativo",
      role,
      consentimento_lgpd: true,
      consentimento_em: new Date().toISOString(),
    })
    .select("id")
    .single<{ id: string }>();

  if (insertError || !newMember) {
    await admin.auth.admin.deleteUser(authCreated.user.id);
    if (createdNewFamilyId) {
      await admin.from("families").delete().eq("id", createdNewFamilyId);
    }
    return { ok: false, error: "Erro ao concluir seu cadastro." };
  }

  // Vincula histórico de dependente, encerra o token de uso único e registra pedido de oração
  const [depLinkRes, inviteRes, prayerRes] = await Promise.all([
    admin
      .from("dependents")
      .update({ promovido_membro_id: newMember.id })
      .eq("id", dependent.id),
    admin.from("member_invites").update({ usado: true }).eq("token", data.token),
    admin.from("prayer_requests").upsert(
      {
        member_id: newMember.id,
        motivo: data.pedido_oracao || "",
      },
      { onConflict: "member_id" }
    ),
  ]);

  if (matchedSpouse) {
    await admin
      .from("members")
      .update({
        estado_civil: "Casado(a)",
        conjuge_congrega_ipcf: true,
        conjuge_cpf: data.cpf,
        nome_conjuge: dependent.nome,
        ...(!matchedSpouse.family_id && !data.mora_com_pais
          ? { family_id: targetFamilyId }
          : {}),
      })
      .eq("id", matchedSpouse.id);
  }

  if (depLinkRes.error || inviteRes.error || prayerRes.error) {
    console.error("Erro parcial pós-criação em completeChildInviteAction", {
      depError: depLinkRes.error,
      inviteError: inviteRes.error,
      prayerError: prayerRes.error,
    });
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signInWithPassword({
    email: shadowEmail,
    password: data.password,
  });

  revalidatePath("/minha-ficha");
  revalidatePath("/admin");

  return {
    ok: true,
    data: { redirectTo: role === "admin" ? "/admin" : "/minha-ficha" },
  };
}
