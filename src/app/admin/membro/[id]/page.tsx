import { notFound, redirect } from "next/navigation";
import { Header } from "@/components/Header";
import { SetupBanner } from "@/components/SetupBanner";
import { AdminMemberDetailClient } from "@/components/admin/AdminMemberDetailClient";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentMemberContext } from "@/lib/supabase/session-member";
import type {
  Dependent,
  Family,
  Member,
  PrayerRequest,
} from "@/types/database.types";

export const dynamic = "force-dynamic";

export default async function AdminMemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getCurrentMemberContext();

  if (!ctx.configured) {
    return (
      <>
        <Header activeRoute="admin" />
        <main id="main-content" className="flex-1 px-4 py-8 sm:px-6">
          <SetupBanner />
        </main>
      </>
    );
  }

  if (!ctx.authenticated || !ctx.member) {
    redirect("/login");
  }

  if (ctx.member.role !== "admin") {
    redirect("/minha-ficha");
  }

  const supabase = await createSupabaseServerClient();
  const { data: targetMember } = await supabase
    .from("members")
    .select("*")
    .eq("id", id)
    .maybeSingle<Member>();

  if (!targetMember) {
    notFound();
  }

  const [{ data: family }, { data: dependents }, { data: prayer }] =
    await Promise.all([
      targetMember.family_id
        ? supabase
            .from("families")
            .select("*")
            .eq("id", targetMember.family_id)
            .maybeSingle<Family>()
        : Promise.resolve({ data: null }),
      targetMember.family_id
        ? supabase
            .from("dependents")
            .select("*")
            .eq("family_id", targetMember.family_id)
            .order("data_nascimento", { ascending: true })
            .returns<Dependent[]>()
        : Promise.resolve({ data: [] }),
      supabase
        .from("prayer_requests")
        .select("*")
        .eq("member_id", targetMember.id)
        .maybeSingle<PrayerRequest>(),
    ]);

  let spouse: Pick<Member, "id" | "nome_completo" | "status_membresia"> | null =
    null;

  if (targetMember.conjuge_cpf) {
    const { data: sp } = await supabase
      .from("members")
      .select("id, nome_completo, status_membresia")
      .eq("cpf", targetMember.conjuge_cpf)
      .maybeSingle<Pick<Member, "id" | "nome_completo" | "status_membresia">>();
    spouse = sp ?? null;
  }

  if (!spouse) {
    const { data: reverseSp } = await supabase
      .from("members")
      .select("id, nome_completo, status_membresia")
      .eq("conjuge_cpf", targetMember.cpf)
      .limit(1)
      .maybeSingle<Pick<Member, "id" | "nome_completo" | "status_membresia">>();
    spouse = reverseSp ?? null;
  }

  const parentIds = [
    targetMember.pai_membro_id,
    targetMember.mae_membro_id,
  ].filter(Boolean) as string[];

  let parents: Array<Pick<Member, "id" | "nome_completo">> = [];
  if (parentIds.length > 0) {
    const { data: parentsData } = await supabase
      .from("members")
      .select("id, nome_completo")
      .in("id", parentIds)
      .returns<Array<Pick<Member, "id" | "nome_completo">>>();
    parents = parentsData ?? [];
  }

  return (
    <>
      <Header member={ctx.member} activeRoute="admin" />
      <main id="main-content" className="flex-1 px-4 py-8 sm:px-6">
        <AdminMemberDetailClient
          member={targetMember}
          family={family ?? null}
          dependents={dependents ?? []}
          prayerRequest={prayer ?? null}
          spouse={spouse}
          parents={parents}
          currentAdminId={ctx.member.id}
        />
      </main>
    </>
  );
}
