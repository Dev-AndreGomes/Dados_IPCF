import { redirect } from "next/navigation";
import Image from "next/image";
import { Header } from "@/components/Header";
import { SetupBanner } from "@/components/SetupBanner";
import { CensoWizard } from "@/components/wizard/CensoWizard";
import { getCurrentMemberContext } from "@/lib/supabase/session-member";

export const dynamic = "force-dynamic";

export default async function CensoPage() {
  const ctx = await getCurrentMemberContext();

  if (ctx.configured && ctx.authenticated && ctx.member) {
    redirect("/minha-ficha");
  }

  return (
    <>
      <Header activeRoute="censo" />
      <main id="main-content" className="flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {!ctx.configured ? (
          <SetupBanner />
        ) : (
          <div className="mx-auto max-w-3xl space-y-6">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-ipcf-border bg-white shadow-xs sm:h-20 sm:w-20">
                <Image
                  src="/dados-ipcf-logo.png"
                  alt="Logo Dados IPCF"
                  width={80}
                  height={80}
                  unoptimized
                  className="h-full w-full object-contain"
                  priority
                />
              </div>
              <span className="inline-flex items-center rounded-full border border-ipcf-gold/50 bg-ipcf-gold-soft/30 px-3 py-1 text-xs font-bold tracking-wide text-ipcf-deep uppercase">
                Cadastro Oficial 2026
              </span>
              <h1 className="mt-3 font-serif text-3xl font-bold text-ipcf-deep sm:text-4xl">
                Meu Cadastro no Dados IPCF
              </h1>
              <p className="mt-2 text-sm text-ipcf-muted sm:text-base">
                Leva cerca de 3 minutos. Seus dados ajudam nossa liderança pastoral a conhecer e cuidar melhor de cada família.
              </p>
            </div>
            <CensoWizard />
          </div>
        )}
      </main>
    </>
  );
}
