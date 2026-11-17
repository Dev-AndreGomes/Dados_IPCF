import type { AgeBand } from "@/lib/validations/member.schema";
import type { DiaSemana, Family, Member } from "@/types/database.types";

export interface AdminMemberRecord {
  member: Member;
  family: Family | null;
  prayerMotivo: string;
}

export type MemberSortOption = "name-asc" | "age-asc" | "age-desc" | "recent";

export interface DashboardKpis {
  totalVidasAtivas: number;
  totalAtivos: number;
  totalGeral: number;
  comungantes: number;
  naoComungantes: number;
  naoComungantesTitulares: number;
  naoMembros: number;
  oficiais: number;
  pastores: number;
  presbiteros: number;
  diaconos: number;
  totalLares: number;
  totalDependentes: number;
  prayersActive: number;
}

export interface NeighborhoodStat {
  key: string;
  label: string;
  activeCount: number;
  familyCount: number;
}

export interface DemographicBandStat {
  key: AgeBand;
  label: string;
  members: number;
  dependents: number;
  total: number;
}

export interface DemographicsData {
  homens: number;
  mulheres: number;
  bands: DemographicBandStat[];
  maxBand: number;
}

export interface AvailabilityDayStat {
  dia: DiaSemana;
  shortLabel: string;
  count: number;
  pct: number;
}

export interface AvailabilityData {
  counts: AvailabilityDayStat[];
  max: number;
  peakDays: DiaSemana[];
  respondentsWithAvailability: number;
}

export interface WeeklyBirthdayItem {
  key: string;
  name: string;
  firstName: string;
  dateIso: string;
  ageTurning: number;
  isToday: boolean;
  whatsapp?: string;
  href?: string;
  isChild?: boolean;
}

export interface WeeklyAnniversaryItem {
  id: string;
  label: string;
  dateIso: string;
  years: number;
  bodasName: string;
  isToday: boolean;
  whatsapp?: string;
  href?: string;
}

export interface UpcomingAnniversaryItem {
  id: string;
  label: string;
  dateIso: string;
  years: number;
  bodasName: string;
  daysUntil: number;
  href?: string;
}

export interface MarriageDashboardData {
  marriedFamiliesCount: number;
  familiesWithDateCount: number;
  weekly: WeeklyAnniversaryItem[];
  upcoming: UpcomingAnniversaryItem[];
  weeklyFamilyIds: Set<string>;
  weeklyByFamilyId: Map<string, WeeklyAnniversaryItem>;
}

export function pctOf(part: number, total: number): number {
  if (total <= 0 || part <= 0) return 0;
  return Math.round((part / total) * 100);
}
