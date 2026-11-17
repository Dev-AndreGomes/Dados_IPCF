import { createSupabaseServerClient } from "./server";
import { isSupabaseConfigured } from "./env";
import type { Member, Family, Dependent, PrayerRequest } from "@/types/database.types";

export interface SessionMemberContext {
  configured: boolean;
  authenticated: boolean;
  userId: string | null;
  member: Member | null;
  family: Family | null;
  dependents: Dependent[];
  prayerRequest: PrayerRequest | null;
}

export async function getCurrentMemberContext(): Promise<SessionMemberContext> {
  if (!isSupabaseConfigured()) {
    return {
      configured: false,
      authenticated: false,
      userId: null,
      member: null,
      family: null,
      dependents: [],
      prayerRequest: null,
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      configured: true,
      authenticated: false,
      userId: null,
      member: null,
      family: null,
      dependents: [],
      prayerRequest: null,
    };
  }

  const { data: member } = await supabase
    .from("members")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle<Member>();

  if (!member) {
    return {
      configured: true,
      authenticated: true,
      userId: user.id,
      member: null,
      family: null,
      dependents: [],
      prayerRequest: null,
    };
  }

  let family: Family | null = null;
  let dependents: Dependent[] = [];

  if (member.family_id) {
    const [{ data: familyData }, { data: depsData }] = await Promise.all([
      supabase
        .from("families")
        .select("*")
        .eq("id", member.family_id)
        .maybeSingle<Family>(),
      supabase
        .from("dependents")
        .select("*")
        .eq("family_id", member.family_id)
        .order("data_nascimento", { ascending: true })
        .returns<Dependent[]>(),
    ]);

    family = familyData ?? null;
    dependents = depsData ?? [];
  }

  const { data: prayerData } = await supabase
    .from("prayer_requests")
    .select("*")
    .eq("member_id", member.id)
    .maybeSingle<PrayerRequest>();

  return {
    configured: true,
    authenticated: true,
    userId: user.id,
    member,
    family,
    dependents,
    prayerRequest: prayerData ?? null,
  };
}
