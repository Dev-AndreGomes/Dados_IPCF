"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import {
  applyCivilProfileUpdate,
  insertDependentIfUnique,
} from "@/lib/supabase/profile-update";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentMemberContext } from "@/lib/supabase/session-member";
import { hasServiceRoleKey } from "@/lib/supabase/env";
import {
  adminMemberProfileUpdateSchema,
  adminStatusSchema,
  buildMembersCsv,
  getTodayIsoRecife,
  zodIssuesToFieldErrors,
} from "@/lib/validations/member.schema";
import type { ActionResponse } from "./auth.actions";
import type {
  Dependent,
  Family,
  Member,
  PrayerRequest,
} from "@/types/database.types";

async function requireAdminContext() {
  const ctx = await getCurrentMemberContext();
  if (!ctx.configured || !ctx.authenticated || !ctx.member) {
    throw new Error("Não autenticado.");
  }
  if (ctx.member.role !== "admin") {
    throw new Error("Acesso restrito à Liderança e Secretaria da IPCF.");
  }
  return ctx;
}

export async function updateMemberEcclesiasticalStatusAction(
  rawPayload: unknown
): Promise<ActionResponse<null>> {
  try {
    const ctx = await requireAdminContext();
    const parsed = adminStatusSchema.safeParse(rawPayload);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Parâmetros inválidos.",
      };
    }

    const { memberId, status_membresia, oficiato, status_cadastro, role } =
      parsed.data;

    if (
      (oficiato === "Diácono" || oficiato === "Presbítero") &&
      status_membresia !== "Membro Comungante"
    ) {
      return {
        ok: false,
        error:
          "Apenas Membros Comungantes podem exercer oficialato de Diácono ou Presbítero.",
      };
    }

    if (oficiato === "Pastor" && status_membresia === "Membro Não-Comungante") {
      return {
        ok: false,
        error: "Membros Não-Comungantes não podem receber a tag Pastor.",
      };
    }

    const supabase = await createSupabaseServerClient();

    // Evita remover o último admin ativo do sistema
    if (ctx.member?.id === memberId && role !== "admin") {
      const { count } = await supabase
        .from("members")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin");

      if ((count ?? 0) <= 1) {
        return {
          ok: false,
          error:
            "Não é permitido remover seu próprio acesso de administrador enquanto você for o único Admin do sistema.",
        };
      }
    }

    const { error } = await supabase
      .from("members")
      .update({
        status_membresia,
        oficiato,
        status_cadastro,
        role,
      })
      .eq("id", memberId);

    if (error) {
      console.error("[updateMemberEcclesiasticalStatusAction]", {
        code: error.code,
        message: error.message,
        details: error.details,
      });
      const isOficiatoConstraint =
        error.code === "23514" &&
        (error.message?.toLowerCase().includes("oficiato") ||
          error.details?.toLowerCase().includes("oficiato"));
      return {
        ok: false,
        error: isOficiatoConstraint
          ? "O banco Supabase ainda não liberou o oficialato 'Pastor'. Execute a migration 002_add_pastor_oficiato.sql no SQL Editor do Supabase."
          : `Erro ao atualizar status eclesiástico do membro${error.message ? `: ${error.message}` : "."}`,
      };
    }

    revalidatePath("/admin");
    revalidatePath(`/admin/membro/${memberId}`);
    revalidatePath("/minha-ficha");

    return {
      ok: true,
      data: null,
      message: "Status eclesiástico e perfil atualizados com sucesso!",
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Acesso não autorizado.",
    };
  }
}

export async function adminResetMemberPasswordAction(
  memberId: string
): Promise<ActionResponse<{ memberName: string; tempPassword: string }>> {
  try {
    await requireAdminContext();
    if (!hasServiceRoleKey()) {
      return {
        ok: false,
        error: "Chave de serviço não configurada para reset administrativo.",
      };
    }

    const admin = createSupabaseAdminClient();
    const { data: target } = await admin
      .from("members")
      .select("id, user_id, cpf, nome_completo")
      .eq("id", memberId)
      .maybeSingle<Pick<Member, "id" | "user_id" | "cpf" | "nome_completo">>();

    if (!target || !target.user_id) {
      return {
        ok: false,
        error: "Membro ou conta de autenticação não encontrada.",
      };
    }

    const tempPassword = target.cpf.slice(0, 6);
    const { error } = await admin.auth.admin.updateUserById(target.user_id, {
      password: tempPassword,
    });

    if (error) {
      return {
        ok: false,
        error: "Falha ao redefinir a senha deste membro no Supabase Auth.",
      };
    }

    return {
      ok: true,
      data: {
        memberName: target.nome_completo,
        tempPassword,
      },
      message: `Senha temporária definida para os 6 primeiros dígitos do CPF de ${target.nome_completo}.`,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Acesso não autorizado.",
    };
  }
}

export async function adminUpdateMemberProfileAction(
  memberId: string,
  rawPayload: unknown
): Promise<ActionResponse<null>> {
  try {
    await requireAdminContext();
    if (!z.string().uuid().safeParse(memberId).success) {
      return { ok: false, error: "Identificador de membro inválido." };
    }

    const parsed = adminMemberProfileUpdateSchema.safeParse(rawPayload);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Verifique os campos preenchidos.",
        fieldErrors: zodIssuesToFieldErrors(parsed.error.issues),
      };
    }

    const supabase = await createSupabaseServerClient();
    const { data: targetMember } = await supabase
      .from("members")
      .select("*")
      .eq("id", memberId)
      .maybeSingle<Member>();

    if (!targetMember) {
      return { ok: false, error: "Membro não encontrado." };
    }

    const targetFamily = targetMember.family_id
      ? (
          await supabase
            .from("families")
            .select("*")
            .eq("id", targetMember.family_id)
            .maybeSingle<Family>()
        ).data ?? null
      : null;

    const result = await applyCivilProfileUpdate({
      writerClient: supabase,
      targetMember,
      targetFamily,
      data: parsed.data,
      includePrayerRequest: false,
    });

    if (!result.ok) {
      return {
        ok: false,
        error: result.error ?? "Não foi possível salvar os dados do membro.",
        fieldErrors: result.fieldErrors,
      };
    }

    revalidatePath("/admin");
    revalidatePath(`/admin/membro/${memberId}`);
    revalidatePath("/minha-ficha");

    return {
      ok: true,
      data: null,
      message: "Dados cadastrais atualizados pela Secretaria com sucesso!",
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Acesso não autorizado.",
    };
  }
}

export async function adminAddDependentAction(
  memberId: string,
  input: { nome: string; data_nascimento: string }
): Promise<ActionResponse<Dependent>> {
  try {
    await requireAdminContext();
    if (!z.string().uuid().safeParse(memberId).success) {
      return { ok: false, error: "Identificador de membro inválido." };
    }

    const supabase = await createSupabaseServerClient();
    const { data: targetMember } = await supabase
      .from("members")
      .select("id, family_id")
      .eq("id", memberId)
      .maybeSingle<Pick<Member, "id" | "family_id">>();

    if (!targetMember?.family_id) {
      return {
        ok: false,
        error:
          "Este membro ainda não possui um núcleo familiar/endereço registrado. Salve os dados cadastrais primeiro.",
      };
    }

    const result = await insertDependentIfUnique(supabase, targetMember.family_id, input);
    if (!result.ok || !result.data) {
      return {
        ok: false,
        error: result.error ?? "Não foi possível cadastrar o dependente.",
        fieldErrors: result.fieldErrors,
      };
    }

    revalidatePath("/admin");
    revalidatePath(`/admin/membro/${memberId}`);
    revalidatePath("/minha-ficha");

    return {
      ok: true,
      data: result.data,
      message: `${result.data.nome} adicionado(a) à família.`,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Acesso não autorizado.",
    };
  }
}

export async function adminRemoveDependentAction(
  memberId: string,
  dependentId: string
): Promise<ActionResponse<null>> {
  try {
    await requireAdminContext();
    if (
      !z.string().uuid().safeParse(memberId).success ||
      !z.string().uuid().safeParse(dependentId).success
    ) {
      return { ok: false, error: "Identificador inválido." };
    }

    const supabase = await createSupabaseServerClient();
    const { data: targetMember } = await supabase
      .from("members")
      .select("family_id")
      .eq("id", memberId)
      .maybeSingle<Pick<Member, "family_id">>();

    if (!targetMember?.family_id) {
      return { ok: false, error: "Família do membro não encontrada." };
    }

    const { data: deleted, error } = await supabase
      .from("dependents")
      .delete()
      .eq("id", dependentId)
      .eq("family_id", targetMember.family_id)
      .is("promovido_membro_id", null)
      .select("id");

    if (error || !deleted || deleted.length === 0) {
      return {
        ok: false,
        error: "Não foi possível remover este dependente (ou ele já possui conta própria).",
      };
    }

    revalidatePath("/admin");
    revalidatePath(`/admin/membro/${memberId}`);
    revalidatePath("/minha-ficha");

    return { ok: true, data: null, message: "Dependente removido do lar." };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Acesso não autorizado.",
    };
  }
}

export async function exportAllMembersCsvAction(): Promise<
  ActionResponse<{ filename: string; csvContent: string }>
> {
  try {
    await requireAdminContext();
    const supabase = await createSupabaseServerClient();

    const [members, families, dependents, prayers] = await Promise.all([
      fetchAllRows<Member>((from, to) =>
        supabase
          .from("members")
          .select("*")
          .order("nome_completo", { ascending: true })
          .range(from, to)
          .returns<Member[]>()
      ),
      fetchAllRows<Family>((from, to) =>
        supabase.from("families").select("*").range(from, to).returns<Family[]>()
      ),
      fetchAllRows<Dependent>((from, to) =>
        supabase
          .from("dependents")
          .select("*")
          .order("data_nascimento", { ascending: true })
          .range(from, to)
          .returns<Dependent[]>()
      ),
      fetchAllRows<PrayerRequest>((from, to) =>
        supabase
          .from("prayer_requests")
          .select("*")
          .range(from, to)
          .returns<PrayerRequest[]>()
      ),
    ]);

    const csvContent = buildMembersCsv({
      members,
      families,
      dependents,
      prayers,
    });
    const todayIso = getTodayIsoRecife();

    return {
      ok: true,
      data: {
        filename: `dados-ipcf-backup-${todayIso}.csv`,
        csvContent,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Falha na exportação.",
    };
  }
}
