import type { ReactNode } from "react";
import type { Oficiato, StatusCadastro, StatusMembresia } from "@/types/database.types";

export function MemberAvatar({
  name,
  size = "md",
}: {
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const parts = (name || "IP")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const initials =
    parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : (parts[0] || "IP").slice(0, 2).toUpperCase();

  const sizeClass =
    size === "lg"
      ? "h-16 w-16 text-xl"
      : size === "sm"
      ? "h-8 w-8 text-xs"
      : "h-11 w-11 text-sm";

  return (
    <div
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full border border-ipcf-gold/40 bg-ipcf-deep font-serif font-bold text-ipcf-gold-soft shadow-xs ${sizeClass}`}
    >
      {initials}
    </div>
  );
}

export function MembresiaBadge({ status }: { status: StatusMembresia }) {
  const styles: Record<StatusMembresia, string> = {
    "Membro Comungante": "bg-emerald-950/10 text-ipcf-deep border-emerald-900/20",
    "Membro Não-Comungante": "bg-ipcf-gold-soft/35 text-amber-950 border-ipcf-gold/40",
    "Não-Membro": "bg-stone-100 text-stone-700 border-stone-300",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${styles[status]}`}
    >
      {status}
    </span>
  );
}

export function OficiatoBadge({ oficiato }: { oficiato: Oficiato }) {
  if (oficiato === "Não oficial") return null;

  if (oficiato === "Pastor") {
    return (
      <span className="inline-flex items-center rounded-full border border-ipcf-brand bg-ipcf-brand px-2.5 py-0.5 text-xs font-bold text-white">
        Pastor
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full border border-ipcf-gold/60 bg-ipcf-gold/15 px-2.5 py-0.5 text-xs font-bold text-amber-950">
      {oficiato}
    </span>
  );
}

export function CadastroStatusBadge({ status }: { status: StatusCadastro }) {
  const styles: Record<StatusCadastro, string> = {
    Ativo: "bg-lime-900/10 text-lime-950 border-lime-800/20",
    Ausente: "bg-amber-100 text-amber-900 border-amber-300",
    Transferido: "bg-sky-100 text-sky-900 border-sky-300",
    Falecido: "bg-stone-200 text-stone-700 border-stone-400",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${styles[status]}`}
    >
      {status}
    </span>
  );
}

export function FormField({
  id,
  label,
  required,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-ipcf-ink">
        {label}
        {required && (
          <span className="ml-1 text-ipcf-danger" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-ipcf-muted">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-ipcf-danger">
          {error}
        </p>
      )}
    </div>
  );
}
