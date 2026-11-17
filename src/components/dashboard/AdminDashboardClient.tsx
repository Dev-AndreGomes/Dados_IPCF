"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, MapPin } from "lucide-react";
import { exportAllMembersCsvAction } from "@/actions/admin.actions";
import { LeafletMap, type MapMarkerItem } from "@/components/map/LeafletMap";
import { getCoordsForNeighborhood } from "@/lib/geocoding/recife-coords";
import {
  AGE_BANDS,
  buildMembersCsv,
  calculateAge,
  compareWeekCalendarDates,
  formatCPF,
  formatNeighborhoodLabel,
  getAgeBand,
  getBodasName,
  getDaysUntilNextCelebration,
  getRecifeToday,
  getWeekCelebrationInfo,
  normalizeSearchText,
  type AgeBand,
} from "@/lib/validations/member.schema";
import {
  DIAS_SEMANA,
  type Dependent,
  type DiaSemana,
  type Family,
  type Oficiato,
  type Sexo,
  type StatusCadastro,
  type StatusMembresia,
} from "@/types/database.types";
import { AvailabilityColumnsCard } from "./AvailabilityColumnsCard";
import { CelebrationsSection } from "./CelebrationsSection";
import { DashboardKpis } from "./DashboardKpis";
import { DemographicsSection } from "./DemographicsSection";
import { MembersDirectorySection } from "./MembersDirectorySection";
import { PrayerRequestsCard } from "./PrayerRequestsCard";
import {
  pctOf,
  type AdminMemberRecord,
  type AvailabilityData,
  type DashboardKpis as DashboardKpisData,
  type DemographicsData,
  type MarriageDashboardData,
  type MemberSortOption,
  type NeighborhoodStat,
  type UpcomingAnniversaryItem,
  type WeeklyAnniversaryItem,
  type WeeklyBirthdayItem,
} from "./dashboard.types";

export type { AdminMemberRecord } from "./dashboard.types";

function scoreNeighborhoodDisplay(label: string): number {
  const titleWords = label.match(/\b[A-ZÀ-Ú][a-zà-ú]+/g)?.length ?? 0;
  const accents = label.match(/[À-ú]/g)?.length ?? 0;
  return titleWords * 10 + accents;
}

function pickBestNeighborhoodLabel(current: string, candidateRaw: string): string {
  const candidate = formatNeighborhoodLabel(candidateRaw);
  if (!current) return candidate;
  if (!candidate) return current;
  return scoreNeighborhoodDisplay(candidate) > scoreNeighborhoodDisplay(current)
    ? candidate
    : current;
}

function downloadCsvFile(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

interface AdminDashboardClientProps {
  records: AdminMemberRecord[];
  families: Family[];
  dependents: Dependent[];
}

export function AdminDashboardClient({
  records,
  families,
  dependents,
}: AdminDashboardClientProps) {
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusMembresiaFilter, setStatusMembresiaFilter] = useState<string>("ALL");
  const [oficiatoFilter, setOficiatoFilter] = useState<string>("ALL");
  const [statusCadastroFilter, setStatusCadastroFilter] = useState<string>("Ativo");
  const [bairroFilter, setBairroFilter] = useState<string>("ALL");
  const [diaFilter, setDiaFilter] = useState<DiaSemana | "ALL">("ALL");
  const [ageGroupFilter, setAgeGroupFilter] = useState<AgeBand | "ALL">("ALL");
  const [sexoFilter, setSexoFilter] = useState<Sexo | "ALL">("ALL");
  const [onlyPrayerFilter, setOnlyPrayerFilter] = useState(false);
  const [onlyAnniversaryFilter, setOnlyAnniversaryFilter] = useState(false);
  const [sortBy, setSortBy] = useState<MemberSortOption>("name-asc");
  const [pageSize, setPageSize] = useState<10 | 20 | 30>(10);
  const [pageState, setPageState] = useState<{ page: number; signature: string }>({
    page: 1,
    signature: "",
  });
  const [exporting, setExporting] = useState(false);

  // Debounce leve na busca para evitar recálculos/re-renders do mapa a cada tecla
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // Base única de ativos + famílias + dependentes não-emancipados
  const {
    ativos,
    activeFamilyIds,
    activeDependents,
    familyDepsByBand,
    familyDepsLabelsByFamily,
    familyDepNamesSearchByFamily,
  } = useMemo(() => {
    const activeRecords: AdminMemberRecord[] = [];
    const famIds = new Set<string>();

    for (const r of records) {
      if (r.member.status_cadastro === "Ativo") {
        activeRecords.push(r);
        if (r.member.family_id) famIds.add(r.member.family_id);
      }
    }

    const activeDeps = dependents.filter(
      (d) => !d.promovido_membro_id && famIds.has(d.family_id)
    );

    const byBand = new Map<string, Map<AgeBand, string[]>>();
    const labelsByFam = new Map<string, string[]>();
    const namesByFam = new Map<string, string[]>();

    for (const dep of activeDeps) {
      const age = calculateAge(dep.data_nascimento);
      const band = getAgeBand(age);
      const shortLabel = `${dep.nome.split(" ")[0]} (${age})`;

      const famLabels = labelsByFam.get(dep.family_id) ?? [];
      famLabels.push(shortLabel);
      labelsByFam.set(dep.family_id, famLabels);

      const famNames = namesByFam.get(dep.family_id) ?? [];
      famNames.push(dep.nome);
      namesByFam.set(dep.family_id, famNames);

      let bandMap = byBand.get(dep.family_id);
      if (!bandMap) {
        bandMap = new Map<AgeBand, string[]>();
        byBand.set(dep.family_id, bandMap);
      }
      const list = bandMap.get(band) ?? [];
      list.push(shortLabel);
      bandMap.set(band, list);
    }

    const searchByFam = new Map<string, string>();
    for (const [famId, names] of namesByFam.entries()) {
      searchByFam.set(famId, names.join(" "));
    }

    return {
      ativos: activeRecords,
      activeFamilyIds: famIds,
      activeDependents: activeDeps,
      familyDepsByBand: byBand,
      familyDepsLabelsByFamily: labelsByFam,
      familyDepNamesSearchByFamily: searchByFam,
    };
  }, [records, dependents]);

  // Lista única e normalizada de bairros + ranking com contagem de fichas e lares distintos
  const neighborhoodData = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        label: string;
        activeCount: number;
        familyKeys: Set<string>;
      }
    >();

    for (const r of records) {
      const raw = r.family?.bairro;
      const key = normalizeSearchText(raw);
      if (!key || !raw) continue;

      const existing = map.get(key);
      const isAtivo = r.member.status_cadastro === "Ativo";
      const famKey = r.family?.id ?? `member-${r.member.id}`;

      if (existing) {
        existing.label = pickBestNeighborhoodLabel(existing.label, raw);
        if (isAtivo) {
          existing.activeCount += 1;
          existing.familyKeys.add(famKey);
        }
      } else {
        const familyKeys = new Set<string>();
        if (isAtivo) familyKeys.add(famKey);
        map.set(key, {
          key,
          label: formatNeighborhoodLabel(raw),
          activeCount: isAtivo ? 1 : 0,
          familyKeys,
        });
      }
    }

    const bairros: NeighborhoodStat[] = Array.from(map.values())
      .map((item) => ({
        key: item.key,
        label: item.label,
        activeCount: item.activeCount,
        familyCount: item.familyKeys.size,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

    const topNeighborhoods = bairros
      .filter((n) => n.activeCount > 0)
      .sort(
        (a, b) =>
          b.activeCount - a.activeCount ||
          b.familyCount - a.familyCount ||
          a.label.localeCompare(b.label, "pt-BR")
      )
      .slice(0, 6);

    const maxTop = Math.max(1, ...topNeighborhoods.map((n) => n.activeCount));
    const labelByKey = new Map(bairros.map((b) => [b.key, b.label]));

    return { bairros, topNeighborhoods, maxTop, labelByKey };
  }, [records]);

  // KPIs globais (crianças/dependentes ativos contam como Não-Comungantes)
  const kpis: DashboardKpisData = useMemo(() => {
    let comungantes = 0;
    let naoComungantesTitulares = 0;
    let naoMembros = 0;
    let pastores = 0;
    let presbiteros = 0;
    let diaconos = 0;
    let prayersActive = 0;

    for (const r of ativos) {
      const m = r.member;
      if (m.status_membresia === "Membro Comungante") comungantes += 1;
      else if (m.status_membresia === "Membro Não-Comungante") naoComungantesTitulares += 1;
      else if (m.status_membresia === "Não-Membro") naoMembros += 1;

      if (m.oficiato === "Pastor") pastores += 1;
      else if (m.oficiato === "Presbítero") presbiteros += 1;
      else if (m.oficiato === "Diácono") diaconos += 1;

      if (r.prayerMotivo.trim().length > 0) prayersActive += 1;
    }

    const totalDependentes = activeDependents.length;

    return {
      totalVidasAtivas: ativos.length + totalDependentes,
      totalAtivos: ativos.length,
      totalGeral: records.length,
      comungantes,
      naoComungantes: naoComungantesTitulares + totalDependentes,
      naoComungantesTitulares,
      naoMembros,
      oficiais: pastores + presbiteros + diaconos,
      pastores,
      presbiteros,
      diaconos,
      totalLares: activeFamilyIds.size,
      totalDependentes,
      prayersActive,
    };
  }, [ativos, records.length, activeFamilyIds.size, activeDependents.length]);

  // Perfil demográfico (faixa etária titulares + filhos; gênero entre titulares ativos)
  const demographics: DemographicsData = useMemo(() => {
    let homens = 0;
    let mulheres = 0;

    const counters = new Map<AgeBand, { members: number; dependents: number }>(
      AGE_BANDS.map((b) => [b.key, { members: 0, dependents: 0 }])
    );

    for (const r of ativos) {
      if (r.member.sexo === "Masculino") homens += 1;
      else if (r.member.sexo === "Feminino") mulheres += 1;

      const band = getAgeBand(calculateAge(r.member.data_nascimento));
      const entry = counters.get(band);
      if (entry) entry.members += 1;
    }

    for (const dep of activeDependents) {
      const band = getAgeBand(calculateAge(dep.data_nascimento));
      const entry = counters.get(band);
      if (entry) entry.dependents += 1;
    }

    const bands = AGE_BANDS.map(({ key, label }) => {
      const entry = counters.get(key) ?? { members: 0, dependents: 0 };
      return {
        key,
        label,
        members: entry.members,
        dependents: entry.dependents,
        total: entry.members + entry.dependents,
      };
    });

    const maxBand = Math.max(1, ...bands.map((b) => b.total));
    return { homens, mulheres, bands, maxBand };
  }, [ativos, activeDependents]);

  // Disponibilidade semanal para Opção A (Colunas Verticais Seg–Dom)
  const availability: AvailabilityData = useMemo(() => {
    let respondentsWithAvailability = 0;
    const dayCounts = new Map<DiaSemana, number>(DIAS_SEMANA.map((d) => [d, 0]));

    for (const r of ativos) {
      const dias = r.member.disponibilidade_dias;
      if (dias.length > 0) respondentsWithAvailability += 1;
      for (const d of dias) {
        if (dayCounts.has(d as DiaSemana)) {
          dayCounts.set(d as DiaSemana, (dayCounts.get(d as DiaSemana) ?? 0) + 1);
        }
      }
    }

    const counts = DIAS_SEMANA.map((dia) => {
      const count = dayCounts.get(dia) ?? 0;
      return {
        dia,
        shortLabel: dia.slice(0, 3),
        count,
        pct: pctOf(count, ativos.length),
      };
    });

    const rawMax = Math.max(0, ...counts.map((c) => c.count));
    const max = Math.max(1, rawMax);
    const peakDays =
      rawMax > 0 ? counts.filter((c) => c.count === rawMax).map((c) => c.dia) : [];

    return {
      counts,
      max,
      peakDays,
      respondentsWithAvailability,
    };
  }, [ativos]);

  // Lista consolidada de pedidos de oração ativos (sigiloso)
  const activePrayerRecords = useMemo(
    () =>
      ativos
        .filter((r) => r.prayerMotivo.trim().length > 0)
        .sort((a, b) =>
          a.member.nome_completo.localeCompare(b.member.nome_completo, "pt-BR")
        ),
    [ativos]
  );

  // Aniversariantes da semana (titulares ativos + filhos de lares ativos)
  const weeklyBirthdays: WeeklyBirthdayItem[] = useMemo(() => {
    const familyFirstActive = new Map<string, { id: string }>();
    for (const r of ativos) {
      if (r.member.family_id && !familyFirstActive.has(r.member.family_id)) {
        familyFirstActive.set(r.member.family_id, { id: r.member.id });
      }
    }

    const items: WeeklyBirthdayItem[] = [];

    for (const r of ativos) {
      const info = getWeekCelebrationInfo(r.member.data_nascimento);
      if (info) {
        items.push({
          key: `m-${r.member.id}`,
          name: r.member.nome_completo,
          firstName: r.member.nome_completo.split(" ")[0],
          dateIso: r.member.data_nascimento,
          ageTurning: info.completingYears,
          isToday: info.isToday,
          whatsapp: r.member.whatsapp,
          href: `/admin/membro/${r.member.id}`,
        });
      }
    }

    for (const dep of activeDependents) {
      const info = getWeekCelebrationInfo(dep.data_nascimento);
      if (info) {
        const parent = familyFirstActive.get(dep.family_id);
        items.push({
          key: `d-${dep.id}`,
          name: dep.nome,
          firstName: dep.nome.split(" ")[0],
          dateIso: dep.data_nascimento,
          ageTurning: info.completingYears,
          isToday: info.isToday,
          href: parent ? `/admin/membro/${parent.id}` : undefined,
          isChild: true,
        });
      }
    }

    return items.sort((a, b) => {
      if (a.isToday !== b.isToday) return a.isToday ? -1 : 1;
      return compareWeekCalendarDates(a.dateIso, b.dateIso);
    });
  }, [ativos, activeDependents]);

  // Bodas de Casamento da Semana e Próximos 30 dias
  const marriageData: MarriageDashboardData = useMemo(() => {
    const byFamily = new Map<
      string,
      {
        names: string[];
        fallbackSpouseName?: string;
        firstWhatsapp?: string;
        firstId?: string;
      }
    >();

    for (const r of ativos) {
      if (!r.member.family_id || r.member.estado_civil !== "Casado(a)") continue;

      const entry = byFamily.get(r.member.family_id);
      const firstName =
        r.member.nome_completo.trim().split(/\s+/)[0] || r.member.nome_completo;
      const spouseFirstName =
        r.member.nome_conjuge?.trim().split(/\s+/)[0] || undefined;

      if (entry) {
        if (!entry.names.includes(firstName)) entry.names.push(firstName);
        if (!entry.fallbackSpouseName && spouseFirstName) {
          entry.fallbackSpouseName = spouseFirstName;
        }
      } else {
        byFamily.set(r.member.family_id, {
          names: [firstName],
          fallbackSpouseName: spouseFirstName,
          firstWhatsapp: r.member.whatsapp,
          firstId: r.member.id,
        });
      }
    }

    let marriedFamiliesCount = 0;
    let familiesWithDateCount = 0;
    const weekly: WeeklyAnniversaryItem[] = [];
    const upcoming: UpcomingAnniversaryItem[] = [];

    for (const f of families) {
      const entry = byFamily.get(f.id);
      if (!entry || entry.names.length === 0) continue;

      marriedFamiliesCount += 1;
      if (!f.data_casamento) continue;
      familiesWithDateCount += 1;

      const coupleNames =
        entry.names.length >= 2
          ? entry.names.slice(0, 2)
          : entry.fallbackSpouseName && !entry.names.includes(entry.fallbackSpouseName)
            ? [entry.names[0], entry.fallbackSpouseName]
            : entry.names.slice(0, 1);

      const label = `Lar ${coupleNames.join(" & ")}`;
      const href = entry.firstId ? `/admin/membro/${entry.firstId}` : undefined;

      const weekInfo = getWeekCelebrationInfo(f.data_casamento);
      if (weekInfo) {
        weekly.push({
          id: f.id,
          label,
          dateIso: f.data_casamento,
          years: weekInfo.completingYears,
          bodasName: getBodasName(weekInfo.completingYears),
          isToday: weekInfo.isToday,
          whatsapp: entry.firstWhatsapp,
          href,
        });
        continue;
      }

      const nextInfo = getDaysUntilNextCelebration(f.data_casamento);
      if (nextInfo && nextInfo.daysUntil >= 1 && nextInfo.daysUntil <= 30) {
        upcoming.push({
          id: f.id,
          label,
          dateIso: f.data_casamento,
          years: nextInfo.turningYears,
          bodasName: getBodasName(nextInfo.turningYears),
          daysUntil: nextInfo.daysUntil,
          href,
        });
      }
    }

    weekly.sort((a, b) => {
      if (a.isToday !== b.isToday) return a.isToday ? -1 : 1;
      return compareWeekCalendarDates(a.dateIso, b.dateIso);
    });
    upcoming.sort((a, b) => a.daysUntil - b.daysUntil);

    return {
      marriedFamiliesCount,
      familiesWithDateCount,
      weekly,
      upcoming,
      weeklyFamilyIds: new Set(weekly.map((w) => w.id)),
      weeklyByFamilyId: new Map(weekly.map((w) => [w.id, w])),
    };
  }, [ativos, families]);

  // Registros filtrados e ordenados
  const filteredRecords = useMemo(() => {
    const q = normalizeSearchText(debouncedSearch);

    const matched = records.filter((r) => {
      const { member, family, prayerMotivo } = r;

      if (
        statusCadastroFilter !== "ALL" &&
        member.status_cadastro !== (statusCadastroFilter as StatusCadastro)
      ) {
        return false;
      }
      if (statusMembresiaFilter !== "ALL") {
        if (statusMembresiaFilter === "Membro Não-Comungante") {
          const isTitularNonComm = member.status_membresia === "Membro Não-Comungante";
          const hasActiveDeps = Boolean(
            member.status_cadastro === "Ativo" &&
              member.family_id &&
              familyDepsLabelsByFamily.get(member.family_id)?.length
          );
          if (!isTitularNonComm && !hasActiveDeps) return false;
        } else if (
          member.status_membresia !== (statusMembresiaFilter as StatusMembresia)
        ) {
          return false;
        }
      }
      if (oficiatoFilter !== "ALL" && member.oficiato !== (oficiatoFilter as Oficiato)) {
        return false;
      }
      if (bairroFilter !== "ALL" && normalizeSearchText(family?.bairro) !== bairroFilter) {
        return false;
      }
      if (diaFilter !== "ALL" && !member.disponibilidade_dias.includes(diaFilter)) {
        return false;
      }
      if (sexoFilter !== "ALL" && member.sexo !== sexoFilter) {
        return false;
      }
      if (ageGroupFilter !== "ALL") {
        const memberInBand =
          getAgeBand(calculateAge(member.data_nascimento)) === ageGroupFilter;
        const familyHasDepInBand = Boolean(
          member.status_cadastro === "Ativo" &&
            member.family_id &&
            familyDepsByBand.get(member.family_id)?.get(ageGroupFilter)?.length
        );
        if (!memberInBand && !familyHasDepInBand) return false;
      }
      if (onlyPrayerFilter && prayerMotivo.trim().length === 0) {
        return false;
      }
      if (
        onlyAnniversaryFilter &&
        (member.status_cadastro !== "Ativo" ||
          member.estado_civil !== "Casado(a)" ||
          !member.family_id ||
          !marriageData.weeklyFamilyIds.has(member.family_id))
      ) {
        return false;
      }

      if (q) {
        const haystack = normalizeSearchText(
          [
            member.nome_completo,
            member.cpf,
            formatCPF(member.cpf),
            member.profissao ?? "",
            member.naturalidade ?? "",
            member.talentos_ministerios ?? "",
            member.nome_conjuge ?? "",
            member.family_id
              ? familyDepNamesSearchByFamily.get(member.family_id) ?? ""
              : "",
            family?.bairro ?? "",
            family?.logradouro ?? "",
            family?.cidade ?? "",
          ].join(" ")
        );
        if (!haystack.includes(q)) return false;
      }

      return true;
    });

    if (sortBy === "name-asc") {
      return matched;
    }

    return [...matched].sort((a, b) => {
      if (sortBy === "age-asc") {
        return (
          b.member.data_nascimento.localeCompare(a.member.data_nascimento) ||
          a.member.nome_completo.localeCompare(b.member.nome_completo, "pt-BR")
        );
      }
      if (sortBy === "age-desc") {
        return (
          a.member.data_nascimento.localeCompare(b.member.data_nascimento) ||
          a.member.nome_completo.localeCompare(b.member.nome_completo, "pt-BR")
        );
      }
      return (
        b.member.created_at.localeCompare(a.member.created_at) ||
        a.member.nome_completo.localeCompare(b.member.nome_completo, "pt-BR")
      );
    });
  }, [
    records,
    debouncedSearch,
    statusCadastroFilter,
    statusMembresiaFilter,
    oficiatoFilter,
    bairroFilter,
    diaFilter,
    sexoFilter,
    ageGroupFilter,
    onlyPrayerFilter,
    onlyAnniversaryFilter,
    sortBy,
    marriageData.weeklyFamilyIds,
    familyDepsByBand,
    familyDepsLabelsByFamily,
    familyDepNamesSearchByFamily,
  ]);

  // Marcadores no mapa agrupados por lar (atualiza somente os pinos no LeafletMap)
  const mapMarkers: MapMarkerItem[] = useMemo(() => {
    const grouped = new Map<
      string,
      {
        family: Family | null;
        names: string[];
        firstMemberId: string;
        bairro: string;
      }
    >();

    for (const r of filteredRecords) {
      const key = r.family?.id ?? `member-${r.member.id}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.names.push(r.member.nome_completo);
      } else {
        grouped.set(key, {
          family: r.family,
          names: [r.member.nome_completo],
          firstMemberId: r.member.id,
          bairro: r.family?.bairro ?? "Casa Forte",
        });
      }
    }

    const baseList = Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, grp]) => {
        const [fallbackLat, fallbackLng] = getCoordsForNeighborhood(grp.bairro);
        const baseLat =
          grp.family?.latitude != null ? Number(grp.family.latitude) : fallbackLat;
        const baseLng =
          grp.family?.longitude != null ? Number(grp.family.longitude) : fallbackLng;
        return { key, grp, baseLat, baseLng };
      });

    const coordCounts = new Map<string, number>();

    return baseList.map(({ key, grp, baseLat, baseLng }) => {
      const coordKey = `${baseLat.toFixed(6)},${baseLng.toFixed(6)}`;
      const idx = coordCounts.get(coordKey) ?? 0;
      coordCounts.set(coordKey, idx + 1);

      let lat = baseLat;
      let lng = baseLng;
      if (idx > 0) {
        const ring = Math.floor((idx - 1) / 6) + 1;
        const posInRing = (idx - 1) % 6;
        const angle = posInRing * ((2 * Math.PI) / 6) + (ring - 1) * 0.5;
        const radiusDeg = 0.00028 * ring;
        lat = baseLat + Math.sin(angle) * radiusDeg;
        lng = baseLng + Math.cos(angle) * radiusDeg;
      }

      return {
        id: key,
        label:
          grp.names.length > 1
            ? `${grp.names[0].split(" ")[0]} & ${grp.names[1].split(" ")[0]} (${grp.names.length})`
            : grp.names[0],
        bairro: formatNeighborhoodLabel(grp.bairro) || "Casa Forte",
        subtitle: grp.family?.logradouro
          ? grp.family.numero
            ? `${grp.family.logradouro}, ${grp.family.numero}`
            : grp.family.logradouro
          : undefined,
        lat,
        lng,
        count: grp.names.length,
        href: `/admin/membro/${grp.firstMemberId}`,
      };
    });
  }, [filteredRecords]);

  const activeFilters = useMemo(() => {
    const chips: Array<{ id: string; label: string; onClear: () => void }> = [];
    if (debouncedSearch.trim()) {
      chips.push({
        id: "search",
        label: `Busca: "${debouncedSearch.trim()}"`,
        onClear: () => {
          setSearchInput("");
          setDebouncedSearch("");
        },
      });
    }
    if (statusMembresiaFilter !== "ALL") {
      chips.push({
        id: "membresia",
        label:
          statusMembresiaFilter === "Membro Não-Comungante"
            ? "Membro Não-Comungante (incl. lares c/ filhos)"
            : statusMembresiaFilter,
        onClear: () => setStatusMembresiaFilter("ALL"),
      });
    }
    if (oficiatoFilter !== "ALL") {
      chips.push({
        id: "oficiato",
        label: `Oficialato: ${oficiatoFilter}`,
        onClear: () => setOficiatoFilter("ALL"),
      });
    }
    if (bairroFilter !== "ALL") {
      chips.push({
        id: "bairro",
        label: `Bairro: ${neighborhoodData.labelByKey.get(bairroFilter) ?? bairroFilter}`,
        onClear: () => setBairroFilter("ALL"),
      });
    }
    if (diaFilter !== "ALL") {
      chips.push({
        id: "dia",
        label: `Disponível: ${diaFilter}`,
        onClear: () => setDiaFilter("ALL"),
      });
    }
    if (ageGroupFilter !== "ALL") {
      const bandLabel = AGE_BANDS.find((b) => b.key === ageGroupFilter)?.label ?? ageGroupFilter;
      chips.push({
        id: "age",
        label: `${bandLabel} (titulares e lares c/ filhos)`,
        onClear: () => setAgeGroupFilter("ALL"),
      });
    }
    if (sexoFilter !== "ALL") {
      chips.push({
        id: "sexo",
        label: `Sexo: ${sexoFilter}`,
        onClear: () => setSexoFilter("ALL"),
      });
    }
    if (onlyPrayerFilter) {
      chips.push({
        id: "prayer",
        label: "🙏 Com pedido de oração",
        onClear: () => setOnlyPrayerFilter(false),
      });
    }
    if (onlyAnniversaryFilter) {
      chips.push({
        id: "anniversary",
        label: "💍 Bodas da semana",
        onClear: () => setOnlyAnniversaryFilter(false),
      });
    }
    if (statusCadastroFilter !== "Ativo") {
      chips.push({
        id: "status",
        label: `Situação: ${statusCadastroFilter === "ALL" ? "Todos" : statusCadastroFilter}`,
        onClear: () => setStatusCadastroFilter("Ativo"),
      });
    }
    return chips;
  }, [
    debouncedSearch,
    statusMembresiaFilter,
    oficiatoFilter,
    bairroFilter,
    diaFilter,
    ageGroupFilter,
    sexoFilter,
    onlyPrayerFilter,
    onlyAnniversaryFilter,
    statusCadastroFilter,
    neighborhoodData.labelByKey,
  ]);

  const filterSignature = [
    debouncedSearch,
    statusMembresiaFilter,
    oficiatoFilter,
    statusCadastroFilter,
    bairroFilter,
    diaFilter,
    ageGroupFilter,
    sexoFilter,
    onlyPrayerFilter,
    onlyAnniversaryFilter,
    sortBy,
  ].join("\u0000");

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const rawPage = pageState.signature === filterSignature ? pageState.page : 1;
  const safePage = Math.min(Math.max(1, rawPage), totalPages);

  const paginatedRecords = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, safePage, pageSize]);

  const clearFilters = useCallback(() => {
    setSearchInput("");
    setDebouncedSearch("");
    setStatusMembresiaFilter("ALL");
    setOficiatoFilter("ALL");
    setStatusCadastroFilter("Ativo");
    setBairroFilter("ALL");
    setDiaFilter("ALL");
    setAgeGroupFilter("ALL");
    setSexoFilter("ALL");
    setOnlyPrayerFilter(false);
    setOnlyAnniversaryFilter(false);
    setSortBy("name-asc");
    setPageState({ page: 1, signature: "" });
  }, []);

  const handleToggleMembresia = useCallback((status: string) => {
    setStatusMembresiaFilter((prev) => (prev === status ? "ALL" : status));
  }, []);

  const handleTogglePrayer = useCallback(() => {
    setOnlyPrayerFilter((prev) => !prev);
  }, []);

  const handleToggleAnniversary = useCallback(() => {
    setOnlyAnniversaryFilter((prev) => !prev);
  }, []);

  const handleToggleSexo = useCallback((sexo: Sexo) => {
    setSexoFilter((prev) => (prev === sexo ? "ALL" : sexo));
  }, []);

  const handleToggleAgeBand = useCallback((band: AgeBand) => {
    setAgeGroupFilter((prev) => (prev === band ? "ALL" : band));
  }, []);

  const handleToggleBairro = useCallback((key: string) => {
    setBairroFilter((prev) => (prev === key ? "ALL" : key));
  }, []);

  const handleToggleDia = useCallback((dia: DiaSemana) => {
    setDiaFilter((prev) => (prev === dia ? "ALL" : dia));
  }, []);

  const handlePageSizeChange = useCallback(
    (nextSize: 10 | 20 | 30) => {
      setPageSize(nextSize);
      setPageState({ page: 1, signature: filterSignature });
    },
    [filterSignature]
  );

  const handleGoToPage = useCallback(
    (nextPage: number) => {
      const clamped = Math.min(Math.max(1, nextPage), totalPages);
      setPageState({ page: clamped, signature: filterSignature });
    },
    [filterSignature, totalPages]
  );

  async function handleExportBackup() {
    setExporting(true);
    const res = await exportAllMembersCsvAction();
    setExporting(false);

    if (!res.ok) {
      alert(res.error);
      return;
    }

    downloadCsvFile(res.data.filename, res.data.csvContent);
  }

  function handleExportFiltered() {
    if (filteredRecords.length === 0) return;
    const csvContent = buildMembersCsv({
      members: filteredRecords.map((r) => r.member),
      families,
      dependents,
      prayers: filteredRecords.map((r) => ({
        member_id: r.member.id,
        motivo: r.prayerMotivo,
      })),
    });
    const { year, month, day } = getRecifeToday();
    const dateStamp = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    downloadCsvFile(`dados-ipcf-filtro-${dateStamp}.csv`, csvContent);
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      {/* Cabeçalho Pastoral + Exportação */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <span className="inline-block rounded-full bg-ipcf-gold-soft/40 px-3 py-0.5 text-xs font-bold uppercase text-ipcf-deep">
            Visão do Conselho &amp; Secretaria
          </span>
          <h1 className="mt-1.5 font-serif text-2xl font-bold text-ipcf-deep sm:text-3xl">
            Painel Pastoral — Dados IPCF
          </h1>
          <p className="text-sm text-ipcf-muted">
            Acompanhamento de membresia, demografia, distribuição geográfica, aniversários e oração.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={handleExportFiltered}
            disabled={filteredRecords.length === 0}
            className="inline-flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-ipcf-border bg-white px-3.5 py-2 text-xs font-bold text-ipcf-deep shadow-xs transition hover:border-ipcf-brand/40 hover:bg-ipcf-bg disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            <Download className="h-3.5 w-3.5 text-ipcf-brand" aria-hidden="true" />
            <span>Exportar Filtro ({filteredRecords.length})</span>
          </button>

          <button
            type="button"
            onClick={() => void handleExportBackup()}
            disabled={exporting}
            className="inline-flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-ipcf-brand/30 bg-white px-4 py-2 text-xs font-bold text-ipcf-deep shadow-xs transition hover:bg-ipcf-bg disabled:opacity-60 sm:w-auto"
          >
            <Download className="h-4 w-4 text-ipcf-brand" aria-hidden="true" />
            <span>{exporting ? "Gerando CSV..." : "Backup Completo (CSV)"}</span>
          </button>
        </div>
      </div>

      {/* KPIs Interativos */}
      <DashboardKpis
        kpis={kpis}
        marriageData={marriageData}
        statusMembresiaFilter={statusMembresiaFilter}
        onlyPrayerFilter={onlyPrayerFilter}
        onClearAllFilters={clearFilters}
        onToggleMembresia={handleToggleMembresia}
        onTogglePrayer={handleTogglePrayer}
      />

      {/* Coluna Esquerda (Mapa + Demografia + Colunas Disponibilidade) & Coluna Direita (Celebrações + Oração) */}
      <div className="grid gap-6 lg:grid-cols-[1.45fr_1fr]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-ipcf-border bg-white p-5 shadow-xs">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="flex items-center gap-2 font-serif text-lg font-bold text-ipcf-deep">
                  <MapPin className="h-5 w-5 text-ipcf-brand" aria-hidden="true" />
                  <span>Mapa Pastoral dos Lares</span>
                </h2>
                <p className="text-xs text-ipcf-muted">
                  Pin verde: sede IPCF · Pinos dourados: residências filtradas ({mapMarkers.length} lares).
                </p>
              </div>
            </div>
            <LeafletMap markers={mapMarkers} heightClass="h-64 sm:h-80 lg:h-96" />
          </section>

          <DemographicsSection
            demographics={demographics}
            topNeighborhoods={neighborhoodData.topNeighborhoods}
            maxTopNeighborhood={neighborhoodData.maxTop}
            sexoFilter={sexoFilter}
            ageGroupFilter={ageGroupFilter}
            bairroFilter={bairroFilter}
            onToggleSexo={handleToggleSexo}
            onToggleAgeBand={handleToggleAgeBand}
            onToggleBairro={handleToggleBairro}
          />

          <AvailabilityColumnsCard
            availability={availability}
            diaFilter={diaFilter}
            onToggleDia={handleToggleDia}
          />
        </div>

        <div className="space-y-6">
          <CelebrationsSection
            weeklyBirthdays={weeklyBirthdays}
            marriageData={marriageData}
            onlyAnniversaryFilter={onlyAnniversaryFilter}
            onToggleAnniversaryFilter={handleToggleAnniversary}
          />

          <PrayerRequestsCard
            activePrayerRecords={activePrayerRecords}
            onlyPrayerFilter={onlyPrayerFilter}
            onTogglePrayerFilter={handleTogglePrayer}
          />
        </div>
      </div>

      {/* Rol Nominal de Cadastrados */}
      <MembersDirectorySection
        filteredRecords={filteredRecords}
        paginatedRecords={paginatedRecords}
        bairros={neighborhoodData.bairros}
        familyDepsByBand={familyDepsByBand}
        familyDepsLabelsByFamily={familyDepsLabelsByFamily}
        marriageData={marriageData}
        prayersActiveCount={kpis.prayersActive}
        searchInput={searchInput}
        statusMembresiaFilter={statusMembresiaFilter}
        oficiatoFilter={oficiatoFilter}
        bairroFilter={bairroFilter}
        statusCadastroFilter={statusCadastroFilter}
        ageGroupFilter={ageGroupFilter}
        onlyPrayerFilter={onlyPrayerFilter}
        onlyAnniversaryFilter={onlyAnniversaryFilter}
        sortBy={sortBy}
        activeFilters={activeFilters}
        pageSize={pageSize}
        safePage={safePage}
        totalPages={totalPages}
        onSearchChange={setSearchInput}
        onStatusMembresiaChange={setStatusMembresiaFilter}
        onOficiatoChange={setOficiatoFilter}
        onBairroChange={setBairroFilter}
        onStatusCadastroChange={setStatusCadastroFilter}
        onSortChange={setSortBy}
        onTogglePrayer={handleTogglePrayer}
        onToggleAnniversary={handleToggleAnniversary}
        onClearFilters={clearFilters}
        onPageSizeChange={handlePageSizeChange}
        onGoToPage={handleGoToPage}
      />
    </div>
  );
}
