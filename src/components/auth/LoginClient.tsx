"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Eye, EyeOff, KeyRound, ArrowRight } from "lucide-react";
import { loginWithCpfAction } from "@/actions/auth.actions";
import { FormField } from "@/components/ui/FormControls";
import { formatCPF, isValidCPF } from "@/lib/validations/member.schema";

export function LoginClient() {
  const router = useRouter();
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [cpfError, setCpfError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const errorBannerRef = useRef<HTMLDivElement | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setCpfError("");
    setPasswordError("");

    if (!isValidCPF(cpf)) {
      setCpfError("Informe um CPF válido com 11 dígitos.");
      document.getElementById("login-cpf")?.focus();
      return;
    }

    if (password.length < 6) {
      setPasswordError("Sua senha tem pelo menos 6 dígitos ou caracteres.");
      document.getElementById("login-password")?.focus();
      return;
    }

    setSubmitting(true);
    const res = await loginWithCpfAction({ cpf, password });
    setSubmitting(false);

    if (!res.ok) {
      setFormError(res.error);
      requestAnimationFrame(() => errorBannerRef.current?.focus());
      return;
    }

    router.push(res.data.redirectTo);
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-ipcf-border bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-ipcf-border bg-white shadow-xs sm:h-24 sm:w-24">
          <Image
            src="/dados-ipcf-logo.png"
            alt="Logo Dados IPCF"
            width={96}
            height={96}
            unoptimized
            className="h-full w-full object-contain"
            priority
          />
        </div>
        <h1 className="font-serif text-2xl font-bold text-ipcf-deep">
          Entrar no Dados IPCF
        </h1>
        <p className="mt-1 text-sm text-ipcf-muted">
          Acesse com o seu CPF e a senha criada no seu cadastro.
        </p>
      </div>

      {formError && (
        <div
          ref={errorBannerRef}
          tabIndex={-1}
          role="alert"
          className="mb-5 rounded-xl border border-ipcf-danger/30 bg-ipcf-danger-bg px-4 py-3 text-sm font-medium text-ipcf-danger"
        >
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <FormField id="login-cpf" label="CPF" required error={cpfError}>
          <input
            id="login-cpf"
            name="cpf"
            type="text"
            inputMode="numeric"
            autoComplete="username"
            placeholder="000.000.000-00"
            value={cpf}
            onChange={(e) => {
              setCpf(formatCPF(e.target.value));
              if (cpfError) setCpfError("");
              if (formError) setFormError("");
            }}
            onBlur={() => {
              if (cpf && !isValidCPF(cpf)) {
                setCpfError("Informe um CPF válido com 11 dígitos.");
              }
            }}
            aria-invalid={Boolean(cpfError)}
            className="ipcf-input"
            required
          />
        </FormField>

        <FormField id="login-password" label="Senha" required error={passwordError}>
          <div className="relative">
            <input
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Sua senha (mínimo 6 dígitos)"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) setPasswordError("");
                if (formError) setFormError("");
              }}
              aria-invalid={Boolean(passwordError)}
              className="ipcf-input pr-11"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-md p-1.5 text-ipcf-muted hover:text-ipcf-deep"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </FormField>

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-ipcf-brand px-5 py-3 text-sm font-bold text-white shadow-xs transition hover:bg-ipcf-deep disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span>{submitting ? "Entrando..." : "Acessar Minha Ficha"}</span>
          {!submitting && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
        </button>
      </form>

      <div className="mt-6 space-y-3 border-t border-ipcf-border pt-5 text-xs text-ipcf-muted">
        <div className="flex items-start gap-2 rounded-xl bg-ipcf-bg p-3">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-ipcf-brand" aria-hidden="true" />
          <p>
            <strong>Esqueceu sua senha?</strong> Como este portal é exclusivo para membros e não usa e-mail automático, peça ao Pastor ou à Secretaria da IPCF para redefinir sua senha em 1 clique.
          </p>
        </div>

        <p className="text-center">
          Ainda não tem cadastro no Dados IPCF?{" "}
          <Link href="/censo" className="font-bold text-ipcf-brand underline">
            Fazer meu cadastro agora
          </Link>
        </p>
      </div>
    </div>
  );
}
