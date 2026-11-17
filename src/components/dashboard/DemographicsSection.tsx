"use client";

import { memo } from "react";
import { BarChart3 } from "lucide-react";
import type { AgeBand } from "@/lib/validations/member.schema";
import type { Sexo } from "@/types/database.types";
import type { DemographicsData, NeighborhoodStat } from "./dashboard.types";

interface DemographicsSectionProps {
  demographics: DemographicsData;
  topNeighborhoods: NeighborhoodStat[];
  maxTopNeighborhood: number;
  sexoFilter: Sexo | "ALL";
  ageGroupFilter: AgeBand | "ALL";
  bairroFilter: string;
  onToggleSexo: (sexo: Sexo) => void;
  onToggleAgeBand: (band: AgeBand) => void;
  onToggleBairro: (key: string) => void;
}

export const DemographicsSection = memo(function DemographicsSection({
  demographics,
  topNeighborhoods,
  maxTopNeighborhood,
  sexoFilter,
  ageGroupFilter,
  bairroFilter,
  onToggleSexo,
  onToggleAgeBand,
  onToggleBairro,
}: DemographicsSectionProps) {
  return (
    <section className="rounded-2xl border border-ipcf-border bg-white p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-serif text-lg font-bold text-ipcf-deep">
            <BarChart3 className="h-5 w-5 text-ipcf-brand" aria-hidden="true" />
            <span>Perfil Demográfico &amp; Top Bairros</span>
          </h2>
          <p className="mt-0.5 text-xs text-ipcf-muted">
            Clique em uma faixa, sexo ou bairro para filtrar o rol abaixo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-ipcf-muted">Titulares:</span>
          <button
            type="button"
            onClick={() => onToggleSexo("Masculino")}
            className={`cursor-pointer rounded-full border px-2.5 py-1 text-xs font-bold transition ${
              sexoFilter === "Masculino"
                ? "border-ipcf-brand bg-ipcf-brand text-white"
                : "border-ipcf-border bg-ipcf-bg text-ipcf-deep hover:border-ipcf-brand/40"
            }`}
          >
            Homens: {demographics.homens}
          </button>
          <button
            type="button"
            onClick={() => onToggleSexo("Feminino")}
            className={`cursor-pointer rounded-full border px-2.5 py-1 text-xs font-bold transition ${
              sexoFilter === "Feminino"
                ? "border-ipcf-brand bg-ipcf-brand text-white"
                : "border-ipcf-border bg-ipcf-bg text-ipcf-deep hover:border-ipcf-brand/40"
            }`}
          >
            Mulheres: {demographics.mulheres}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-ipcf-muted">
              Faixas Etárias
            </p>
            <div className="flex items-center gap-2.5 text-[11px] text-ipcf-muted">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-ipcf-brand" aria-hidden="true" />
                <span>Titulares</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-ipcf-gold" aria-hidden="true" />
                <span>Filhos</span>
              </span>
            </div>
          </div>

          {demographics.bands.map((band) => {
            const membersPct = Math.round((band.members / demographics.maxBand) * 100);
            const dependentsPct = Math.round(
              (band.dependents / demographics.maxBand) * 100
            );
            const selected = ageGroupFilter === band.key;

            return (
              <button
                key={band.key}
                type="button"
                title={`${band.label}: ${band.members} titulares + ${band.dependents} filhos = ${band.total}`}
                onClick={() => onToggleAgeBand(band.key)}
                className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1 text-left text-xs transition ${
                  selected ? "bg-emerald-50 ring-1 ring-ipcf-brand" : "hover:bg-ipcf-bg"
                }`}
              >
                <span className="w-32 shrink-0 font-semibold text-ipcf-deep">
                  {band.label}
                </span>
                <div className="flex h-3 flex-1 overflow-hidden rounded-full bg-ipcf-bg">
                  {band.members > 0 && (
                    <div
                      className="h-full bg-ipcf-brand transition-all"
                      style={{ width: `${membersPct}%` }}
                    />
                  )}
                  {band.dependents > 0 && (
                    <div
                      className="h-full bg-ipcf-gold transition-all"
                      style={{ width: `${dependentsPct}%` }}
                    />
                  )}
                </div>
                <span className="shrink-0 text-right font-bold text-ipcf-deep">
                  {band.total}
                  {band.dependents > 0 && (
                    <span className="ml-1 font-normal text-[10px] text-ipcf-muted">
                      (+{band.dependents} filhos)
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-ipcf-muted">
              Principais Bairros (Ativos)
            </p>
            <span className="text-[11px] text-ipcf-muted">Fichas · Lares</span>
          </div>

          {topNeighborhoods.length === 0 ? (
            <p className="rounded-xl bg-ipcf-bg px-3 py-3 text-xs text-ipcf-muted">
              Nenhum bairro cadastrado ainda.
            </p>
          ) : (
            topNeighborhoods.map((b) => {
              const widthPct = Math.round(
                (b.activeCount / maxTopNeighborhood) * 100
              );
              const selected = bairroFilter === b.key;

              return (
                <button
                  key={b.key}
                  type="button"
                  title={`${b.label}: ${b.activeCount} fichas ativas em ${b.familyCount} ${b.familyCount === 1 ? "lar" : "lares"}`}
                  onClick={() => onToggleBairro(b.key)}
                  className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1 text-left text-xs transition ${
                    selected ? "bg-amber-50 ring-1 ring-ipcf-gold" : "hover:bg-ipcf-bg"
                  }`}
                >
                  <span className="w-28 shrink-0 truncate font-semibold text-ipcf-deep sm:w-32">
                    {b.label}
                  </span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-ipcf-bg">
                    <div
                      className="h-full rounded-full bg-ipcf-gold transition-all"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-right text-ipcf-deep">
                    <strong className="font-bold">{b.activeCount}</strong>
                    <span className="ml-1 text-[10px] text-ipcf-muted">
                      ({b.familyCount} {b.familyCount === 1 ? "lar" : "lares"})
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
});
