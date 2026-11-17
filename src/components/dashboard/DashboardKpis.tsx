"use client";

import { memo } from "react";
import { Award, Home, Lock, Users } from "lucide-react";
import {
  pctOf,
  type DashboardKpis as DashboardKpisData,
  type MarriageDashboardData,
} from "./dashboard.types";

interface DashboardKpisProps {
  kpis: DashboardKpisData;
  marriageData: MarriageDashboardData;
  statusMembresiaFilter: string;
  onlyPrayerFilter: boolean;
  onClearAllFilters: () => void;
  onToggleMembresia: (status: string) => void;
  onTogglePrayer: () => void;
}

export const DashboardKpis = memo(function DashboardKpis({
  kpis,
  marriageData,
  statusMembresiaFilter,
  onlyPrayerFilter,
  onClearAllFilters,
  onToggleMembresia,
  onTogglePrayer,
}: DashboardKpisProps) {
  const comungantesPct = pctOf(kpis.comungantes, kpis.totalVidasAtivas);
  const naoComungantesPct = pctOf(kpis.naoComungantes, kpis.totalVidasAtivas);
  const naoMembrosPct = pctOf(kpis.naoMembros, kpis.totalVidasAtivas);

  const officialParts: string[] = [];
  if (kpis.pastores > 0) officialParts.push(`${kpis.pastores} Pa`);
  if (kpis.presbiteros > 0) officialParts.push(`${kpis.presbiteros} Pb`);
  if (kpis.diaconos > 0) officialParts.push(`${kpis.diaconos} Di`);

  const officialSubtitle =
    kpis.oficiais === 0
      ? "0 no oficialato"
      : `${kpis.oficiais} oficiais (${officialParts.join(" · ")})`;

  return (
    <section
      aria-label="Indicadores do Rol da Igreja"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
    >
      <button
        type="button"
        onClick={onClearAllFilters}
        className="cursor-pointer rounded-2xl border border-ipcf-border bg-white p-4 text-left shadow-xs transition hover:border-ipcf-brand/40 hover:bg-ipcf-bg/40"
      >
        <div className="flex items-center justify-between text-ipcf-muted">
          <span className="text-xs font-semibold">Pessoas Ativas</span>
          <Users className="h-4 w-4 text-ipcf-brand" aria-hidden="true" />
        </div>
        <p className="mt-2 font-serif text-2xl font-bold text-ipcf-deep">
          {kpis.totalVidasAtivas}
        </p>
        <p className="text-[11px] text-ipcf-muted">
          {kpis.totalAtivos} fichas · {kpis.totalDependentes} filhos
        </p>
      </button>

      <button
        type="button"
        onClick={() => onToggleMembresia("Membro Comungante")}
        className={`cursor-pointer rounded-2xl border p-4 text-left shadow-xs transition hover:border-ipcf-brand/40 ${
          statusMembresiaFilter === "Membro Comungante"
            ? "border-ipcf-brand bg-emerald-50/50 ring-2 ring-ipcf-brand/30"
            : "border-ipcf-border bg-white"
        }`}
      >
        <div className="flex items-center justify-between text-ipcf-muted">
          <span className="text-xs font-semibold">Comungantes</span>
          <Award className="h-4 w-4 text-ipcf-brand" aria-hidden="true" />
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <p className="font-serif text-2xl font-bold text-ipcf-brand">
            {kpis.comungantes}
          </p>
          <span className="text-[11px] font-bold text-ipcf-brand/80">
            {comungantesPct}%
          </span>
        </div>
        <p className="text-[11px] text-ipcf-muted">{officialSubtitle}</p>
      </button>

      <button
        type="button"
        onClick={() => onToggleMembresia("Membro Não-Comungante")}
        className={`cursor-pointer rounded-2xl border p-4 text-left shadow-xs transition hover:border-ipcf-brand/40 ${
          statusMembresiaFilter === "Membro Não-Comungante"
            ? "border-ipcf-brand bg-emerald-50/50 ring-2 ring-ipcf-brand/30"
            : "border-ipcf-border bg-white"
        }`}
      >
        <div className="flex items-center justify-between text-ipcf-muted">
          <span className="text-xs font-semibold">Não-Comungantes</span>
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <p className="font-serif text-2xl font-bold text-ipcf-deep">
            {kpis.naoComungantes}
          </p>
          <span className="text-[11px] font-bold text-ipcf-muted">
            {naoComungantesPct}%
          </span>
        </div>
        <p className="text-[11px] text-ipcf-muted">
          {kpis.naoComungantesTitulares} tit. + {kpis.totalDependentes} filhos
        </p>
      </button>

      <button
        type="button"
        onClick={() => onToggleMembresia("Não-Membro")}
        className={`cursor-pointer rounded-2xl border p-4 text-left shadow-xs transition hover:border-ipcf-brand/40 ${
          statusMembresiaFilter === "Não-Membro"
            ? "border-ipcf-brand bg-emerald-50/50 ring-2 ring-ipcf-brand/30"
            : "border-ipcf-border bg-white"
        }`}
      >
        <span className="text-xs font-semibold text-ipcf-muted">Congregados</span>
        <div className="mt-2 flex items-baseline gap-1.5">
          <p className="font-serif text-2xl font-bold text-ipcf-deep">
            {kpis.naoMembros}
          </p>
          <span className="text-[11px] font-bold text-ipcf-muted">
            {naoMembrosPct}%
          </span>
        </div>
        <p className="text-[11px] text-ipcf-muted">Não-membros</p>
      </button>

      <div className="rounded-2xl border border-ipcf-border bg-white p-4 shadow-xs">
        <div className="flex items-center justify-between text-ipcf-muted">
          <span className="text-xs font-semibold">Lares / Famílias</span>
          <Home className="h-4 w-4 text-ipcf-brand" aria-hidden="true" />
        </div>
        <p className="mt-2 font-serif text-2xl font-bold text-ipcf-deep">
          {kpis.totalLares}
        </p>
        <p className="text-[11px] text-ipcf-muted">
          {marriageData.marriedFamiliesCount} casais · {marriageData.weekly.length} bodas na sem.
        </p>
      </div>

      <button
        type="button"
        onClick={onTogglePrayer}
        className={`cursor-pointer rounded-2xl border p-4 text-left shadow-xs transition hover:border-ipcf-gold ${
          onlyPrayerFilter
            ? "border-ipcf-gold bg-ipcf-gold-soft/35 ring-2 ring-ipcf-gold/40"
            : "border-ipcf-gold/50 bg-ipcf-gold-soft/15"
        }`}
      >
        <div className="flex items-center justify-between text-ipcf-deep">
          <span className="text-xs font-semibold">Pedidos de Oração</span>
          <Lock className="h-4 w-4 text-ipcf-brand" aria-hidden="true" />
        </div>
        <p className="mt-2 font-serif text-2xl font-bold text-ipcf-deep">
          {kpis.prayersActive}
        </p>
        <p className="text-[11px] text-ipcf-muted">
          {onlyPrayerFilter ? "Filtro ativo no rol" : "Clique para filtrar rol"}
        </p>
      </button>
    </section>
  );
});
