import { redirect } from "next/navigation";
import { Header } from "@/components/Header";
import { SetupBanner } from "@/components/SetupBanner";
import { MemberPortalClient } from "@/components/minha-ficha/MemberPortalClient";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasServiceRoleKey } from "@/lib/supabase/env";
import { getCurrentMemberContext } from "@/lib/supabase/session-member";

export const dynamic = "force-dynamic";

export default async function MinhaFichaPage() {
  const ctx = await getCurrentMemberContext();

  if (!ctx.configured) {
    return (
      <>
        <Header activeRoute="minha-ficha" />
        <main id="main-content" className="flex-1 px-4 py-8 sm:px-6">
          <SetupBanner />
        </main>
      </>
    );
  }

  if (!ctx.authenticated || !ctx.member) {
    redirect("/login");
  }

  // Busca nomes dos pais caso o membro seja filho emancipado (apenas nomes)
  let parentsNames: string[] = [];
  const parentIds = [ctx.member.pai_membro_id, ctx.member.mae_membro_id].filter(
    Boolean
  ) as string[];

  if (parentIds.length > 0 && hasServiceRoleKey()) {
    const admin = createSupabaseAdminClient();
    const { data: parents } = await admin
      .from("members")
      .select("nome_completo")
      .in("id", parentIds);
    parentsNames = (parents ?? []).map((p) => p.nome_completo);
  }

  return (
    <>
      <Header member={ctx.member} activeRoute="minha-ficha" />
      <main id="main-content" className="flex-1 px-4 py-8 sm:px-6">
        <MemberPortalClient
          member={ctx.member}
          family={ctx.family}
          dependents={ctx.dependents}
          prayerRequest={ctx.prayerRequest}
          parentsNames={parentsNames}
        />
      </main>
    </>
  );
}
