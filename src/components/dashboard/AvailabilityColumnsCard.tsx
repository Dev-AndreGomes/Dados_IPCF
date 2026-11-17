"use client";

import { memo } from "react";
import { CalendarDays } from "lucide-react";
import type { DiaSemana } from "@/types/database.types";
import type { AvailabilityData } from "./dashboard.types";

interface AvailabilityColumnsCardProps {
  availability: AvailabilityData;
  diaFilter: DiaSemana | "ALL";
  onToggleDia: (dia: DiaSemana) => void;
}

export const AvailabilityColumnsCard = memo(function AvailabilityColumnsCard({
  availability,
  diaFilter,
  onToggleDia,
}: AvailabilityColumnsCardProps) {
  const hasAny = availability.counts.some((c) => c.count > 0);
  const peakText =
    hasAny && availability.peakDays.length > 0
      ? availability.peakDays.map((d) => d.slice(0, 3)).join(", ")
      : "—";

  return (
    <section
      aria-label="Disponibilidade Semanal para Servir"
      className="rounded-2xl border border-ipcf-border bg-white p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-serif text-lg font-bold text-ipcf-deep">
            <CalendarDays className="h-5 w-5 text-ipcf-brand" aria-hidden="true" />
            <span>Disponibilidade para Servir</span>
          </h2>
          <p className="mt-0.5 text-xs text-ipcf-muted">
            Clique em uma coluna (Seg–Dom) para filtrar o rol abaixo. ·{" "}
            {availability.respondentsWithAvailability} pessoas informaram horários
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1 text-ipcf-muted">
            <span className="h-2.5 w-2.5 rounded-xs bg-ipcf-brand" aria-hidden="true" />
            <span>Padrão</span>
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-amber-900">
            <span className="h-2.5 w-2.5 rounded-xs bg-ipcf-gold" aria-hidden="true" />
            <span>Pico ({peakText})</span>
          </span>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-ipcf-border/70 bg-ipcf-bg/45 px-2.5 pt-4 pb-3 sm:px-4">
        <div className="grid grid-cols-7 items-end gap-1.5 sm:gap-3">
          {availability.counts.map(({ dia, shortLabel, count, pct }) => {
            const selected = diaFilter === dia;
            const isPeak = hasAny && count === availability.max;
            const heightPct =
              count === 0
                ? 0
                : Math.max(14, Math.round((count / availability.max) * 100));

            return (
              <button
                key={dia}
                type="button"
                aria-pressed={selected}
                aria-label={`${dia}: ${count} ${count === 1 ? "pessoa disponível" : "pessoas disponíveis"} (${pct}%)`}
                title={`${dia}: ${count} disponíveis (${pct}% dos titulares ativos)`}
                onClick={() => onToggleDia(dia)}
                className={`group flex cursor-pointer flex-col items-center rounded-xl p-1.5 transition ${
                  selected
                    ? "bg-emerald-50 ring-2 ring-ipcf-brand"
                    : "hover:bg-white/90"
                }`}
              >
                <span
                  className={`mb-1.5 text-xs font-bold sm:text-sm ${
                    selected
                      ? "text-ipcf-deep"
                      : isPeak
                        ? "text-amber-900"
                        : count === 0
                          ? "text-ipcf-muted"
                          : "text-ipcf-deep"
                  }`}
                >
                  {count}
                </span>

                <div className="flex h-28 w-full items-end justify-center rounded-lg bg-white/80 px-1 pt-2 pb-1 sm:h-32 sm:px-2">
                  <div
                    className={`w-full max-w-8 rounded-t-md transition-all ${
                      selected
                        ? "bg-ipcf-deep"
                        : isPeak
                          ? "bg-ipcf-gold group-hover:bg-ipcf-gold/90"
                          : count === 0
                            ? "bg-stone-200"
                            : "bg-ipcf-brand group-hover:bg-ipcf-deep"
                    }`}
                    style={{ height: count === 0 ? "4px" : `${heightPct}%` }}
                  />
                </div>

                <span
                  className={`mt-2 text-[11px] font-bold sm:text-xs ${
                    selected ? "text-ipcf-brand" : "text-ipcf-deep"
                  }`}
                >
                  {shortLabel}
                </span>
                <span className="text-[10px] text-ipcf-muted">{pct}%</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
});
