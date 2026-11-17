import { redirect } from "next/navigation";
import { Header } from "@/components/Header";
import { SetupBanner } from "@/components/SetupBanner";
import {
  AdminDashboardClient,
  type AdminMemberRecord,
} from "@/components/dashboard/AdminDashboardClient";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentMemberContext } from "@/lib/supabase/session-member";
import type {
  Dependent,
  Family,
  Member,
  PrayerRequest,
} from "@/types/database.types";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
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

  const familyMap = new Map(families.map((f) => [f.id, f]));
  const prayerMap = new Map(prayers.map((p) => [p.member_id, p.motivo]));

  const records: AdminMemberRecord[] = members.map((member) => ({
    member,
    family: member.family_id ? familyMap.get(member.family_id) ?? null : null,
    prayerMotivo: prayerMap.get(member.id) ?? "",
  }));

  return (
    <>
      <Header member={ctx.member} activeRoute="admin" />
      <main id="main-content" className="flex-1 px-4 py-8 sm:px-6">
        <AdminDashboardClient
          records={records}
          families={families}
          dependents={dependents}
        />
      </main>
    </>
  );
}
