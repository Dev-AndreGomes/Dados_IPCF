"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { cpfToShadowEmail, loginSchema } from "@/lib/validations/member.schema";

export type ActionResponse<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function loginWithCpfAction(input: {
  cpf: string;
  password: string;
}): Promise<ActionResponse<{ redirectTo: string }>> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      error: "O Supabase ainda não foi configurado neste ambiente (.env.local).",
    };
  }

  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados de acesso inválidos.",
      fieldErrors,
    };
  }

  const supabase = await createSupabaseServerClient();
  const shadowEmail = cpfToShadowEmail(parsed.data.cpf);

  const { data: signInData, error: signInError } =
    await supabase.auth.signInWithPassword({
      email: shadowEmail,
      password: parsed.data.password,
    });

  if (signInError || !signInData.user) {
    return {
      ok: false,
      error:
        "CPF ou senha incorretos. Se esqueceu sua senha, solicite o reset ao Pastor ou à Secretaria da IPCF.",
    };
  }

  const { data: member } = await supabase
    .from("members")
    .select("role, status_cadastro")
    .eq("user_id", signInData.user.id)
    .maybeSingle<{ role: string; status_cadastro: string }>();

  revalidatePath("/");
  revalidatePath("/minha-ficha");
  revalidatePath("/admin");

  return {
    ok: true,
    data: {
      redirectTo: member?.role === "admin" ? "/admin" : "/minha-ficha",
    },
  };
}

export async function changeOwnPasswordAction(
  newPassword: string
): Promise<ActionResponse<null>> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase não configurado." };
  }

  if (!newPassword || newPassword.length < 6) {
    return {
      ok: false,
      error: "A nova senha deve ter pelo menos 6 dígitos ou caracteres.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Sessão expirada. Entre novamente." };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    return {
      ok: false,
      error: "Não foi possível atualizar a senha. Tente novamente.",
    };
  }

  return {
    ok: true,
    data: null,
    message: "Senha atualizada com sucesso!",
  };
}

export async function logoutAction() {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
