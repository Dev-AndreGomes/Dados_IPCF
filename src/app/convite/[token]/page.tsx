import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Header } from "@/components/Header";
import { InviteCompletionClient } from "@/components/invite/InviteCompletionClient";
import { getInviteContextForPage } from "@/actions/family.actions";

export const dynamic = "force-dynamic";

export default async function ConvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const context = await getInviteContextForPage(token);

  return (
    <>
      <Header activeRoute="convite" />
      <main id="main-content" className="flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {!context.valid ? (
          <section className="mx-auto max-w-lg rounded-2xl border border-ipcf-border bg-white p-6 text-center shadow-sm sm:p-8">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
              <AlertTriangle className="h-6 w-6" aria-hidden="true" />
            </div>
            <h1 className="font-serif text-2xl font-bold text-ipcf-deep">
              Link de Convite Indisponível
            </h1>
            <p className="mt-2 text-sm text-ipcf-muted">{context.reason}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href="/login"
                className="rounded-xl bg-ipcf-brand px-4 py-2.5 text-xs font-bold text-white hover:bg-ipcf-deep"
              >
                Já tenho acesso · Entrar
              </Link>
              <Link
                href="/censo"
                className="rounded-xl border border-ipcf-border bg-white px-4 py-2.5 text-xs font-bold text-ipcf-deep hover:bg-ipcf-bg"
              >
                Fazer Cadastro do Zero
              </Link>
            </div>
          </section>
        ) : (
          <InviteCompletionClient context={context} />
        )}
      </main>
    </>
  );
}
