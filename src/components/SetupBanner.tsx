import { DatabaseZap, FileCode2, KeyRound } from "lucide-react";

export function SetupBanner() {
  return (
    <section
      aria-labelledby="setup-banner-title"
      className="mx-auto my-8 max-w-3xl rounded-2xl border border-ipcf-gold/50 bg-white p-6 shadow-sm sm:p-8"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-ipcf-gold/15 text-ipcf-brand">
          <DatabaseZap className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="space-y-4">
          <div>
            <span className="inline-block rounded-full bg-ipcf-gold-soft/40 px-3 py-0.5 text-xs font-bold text-ipcf-deep">
              Ambiente Pronto para Conectar
            </span>
            <h2
              id="setup-banner-title"
              className="mt-2 font-serif text-xl font-bold text-ipcf-deep sm:text-2xl"
            >
              Conecte seu projeto Supabase para ativar o Dados IPCF
            </h2>
            <p className="mt-1 text-sm text-ipcf-muted">
              A aplicação Next.js já está compilada com todas as telas, regras e migração SQL.
              Faltam apenas os 3 passos abaixo no seu ambiente:
            </p>
          </div>

          <ol className="space-y-3 text-sm text-ipcf-ink">
            <li className="flex items-start gap-2.5">
              <FileCode2 className="mt-0.5 h-4 w-4 shrink-0 text-ipcf-brand" aria-hidden="true" />
              <span>
                <strong>1. Rodar o SQL no Supabase:</strong> Abra o{" "}
                <em>SQL Editor</em> no painel do Supabase e execute integralmente o arquivo{" "}
                <code className="rounded bg-ipcf-bg px-1.5 py-0.5 text-xs font-semibold">
                  supabase/migrations/001_initial_schema.sql
                </code>
                .
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-ipcf-brand" aria-hidden="true" />
              <span>
                <strong>2. Criar o arquivo .env.local:</strong> Copie{" "}
                <code className="rounded bg-ipcf-bg px-1.5 py-0.5 text-xs font-semibold">
                  .env.example
                </code>{" "}
                para{" "}
                <code className="rounded bg-ipcf-bg px-1.5 py-0.5 text-xs font-semibold">
                  .env.local
                </code>{" "}
                preenchendo URL, Anon Key, Service Role Key e{" "}
                <code className="rounded bg-ipcf-bg px-1.5 py-0.5 text-xs font-semibold">
                  ADMIN_MASTER_CPFS
                </code>
                .
              </span>
            </li>
          </ol>
        </div>
      </div>
    </section>
  );
}
