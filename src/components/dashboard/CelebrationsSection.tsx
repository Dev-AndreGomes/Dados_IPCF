"use client";

import { memo } from "react";
import Link from "next/link";
import { Cake, Heart, MessageCircle } from "lucide-react";
import { buildWhatsAppUrl } from "@/lib/validations/member.schema";
import type {
  MarriageDashboardData,
  WeeklyBirthdayItem,
} from "./dashboard.types";

interface CelebrationsSectionProps {
  weeklyBirthdays: WeeklyBirthdayItem[];
  marriageData: MarriageDashboardData;
  onlyAnniversaryFilter: boolean;
  onToggleAnniversaryFilter: () => void;
}

export const CelebrationsSection = memo(function CelebrationsSection({
  weeklyBirthdays,
  marriageData,
  onlyAnniversaryFilter,
  onToggleAnniversaryFilter,
}: CelebrationsSectionProps) {
  return (
    <>
      {/* Aniversariantes da Semana */}
      <section className="rounded-2xl border border-ipcf-border bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-serif text-lg font-bold text-ipcf-deep">
            <Cake className="h-5 w-5 text-ipcf-gold" aria-hidden="true" />
            <span>Aniversariantes da Semana</span>
          </h2>
          <span className="rounded-full border border-ipcf-border bg-ipcf-bg px-2.5 py-0.5 text-xs font-bold text-ipcf-deep">
            {weeklyBirthdays.length}
          </span>
        </div>

        <div className="mt-3 max-h-64 space-y-2.5 overflow-y-auto pr-0.5">
          {weeklyBirthdays.length === 0 ? (
            <p className="rounded-xl bg-ipcf-bg px-3 py-3 text-xs text-ipcf-muted">
              Nenhum aniversário de nascimento registrado para a semana corrente.
            </p>
          ) : (
            weeklyBirthdays.map((b) => {
              const waUrl = buildWhatsAppUrl(
                b.whatsapp,
                `Graça e paz, ${b.firstName}! Feliz aniversário! A Igreja Presbiteriana de Casa Forte celebra sua vida e ora por você.`
              );
              return (
                <div
                  key={b.key}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs ${
                    b.isToday
                      ? "border border-ipcf-gold bg-ipcf-gold-soft/25"
                      : "bg-ipcf-bg"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-bold text-ipcf-deep">{b.name}</span>
                      {b.isToday && (
                        <span className="rounded-full bg-ipcf-gold px-2 py-0.5 text-[10px] font-bold text-white">
                          Hoje!
                        </span>
                      )}
                    </div>
                    <p className="text-ipcf-muted">
                      {b.dateIso.slice(8, 10)}/{b.dateIso.slice(5, 7)} ·{" "}
                      {b.ageTurning} anos
                      {b.isChild ? " · Filho(a)" : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {waUrl && (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Enviar parabéns no WhatsApp para ${b.name}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-900 hover:bg-emerald-100"
                      >
                        <MessageCircle className="h-3 w-3" aria-hidden="true" />
                        <span>WhatsApp</span>
                      </a>
                    )}
                    {b.href && (
                      <Link
                        href={b.href}
                        className="rounded-lg border border-ipcf-border bg-white px-2 py-1 text-[11px] font-bold text-ipcf-brand hover:bg-ipcf-bg"
                      >
                        {b.isChild ? "Família" : "Ficha"}
                      </Link>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Bodas de Casamento (sempre visível para acompanhamento pastoral) */}
      <section className="rounded-2xl border border-ipcf-border bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 font-serif text-lg font-bold text-ipcf-deep">
              <Heart className="h-5 w-5 text-ipcf-brand" aria-hidden="true" />
              <span>Bodas de Casamento</span>
            </h2>
            <p className="text-xs text-ipcf-muted">
              Celebrantes da semana · {marriageData.familiesWithDateCount} de{" "}
              {marriageData.marriedFamiliesCount} casais com data
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {marriageData.weekly.length > 0 && (
              <button
                type="button"
                onClick={onToggleAnniversaryFilter}
                className={`cursor-pointer rounded-lg border px-2 py-1 text-[11px] font-bold transition ${
                  onlyAnniversaryFilter
                    ? "border-rose-400 bg-rose-100 text-rose-950"
                    : "border-ipcf-border bg-ipcf-bg text-ipcf-deep hover:border-rose-300"
                }`}
              >
                {onlyAnniversaryFilter ? "Mostrando no rol" : "Filtrar no rol"}
              </button>
            )}
            <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-900">
              {marriageData.weekly.length}
            </span>
          </div>
        </div>

        <div className="mt-3 max-h-72 space-y-2.5 overflow-y-auto pr-0.5">
          {marriageData.weekly.length === 0 ? (
            <div className="rounded-xl bg-ipcf-bg px-3 py-3 text-xs text-ipcf-muted">
              <p>Nenhum casal celebrando bodas nesta semana.</p>
              {marriageData.marriedFamiliesCount >
                marriageData.familiesWithDateCount && (
                <p className="mt-1 text-[11px]">
                  {marriageData.marriedFamiliesCount -
                    marriageData.familiesWithDateCount}{" "}
                  casal(is) ainda sem data de casamento cadastrada.
                </p>
              )}
            </div>
          ) : (
            marriageData.weekly.map((ann) => {
              const waUrl = buildWhatsAppUrl(
                ann.whatsapp,
                `Graça e paz! Parabéns pelas ${ann.bodasName} (${ann.years} anos de casamento — ${ann.label})! Que o Senhor continue abençoando o lar de vocês.`
              );
              return (
                <div
                  key={ann.id}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs ${
                    ann.isToday
                      ? "border-ipcf-gold bg-ipcf-gold-soft/30"
                      : "border-ipcf-gold/40 bg-ipcf-gold-soft/15"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <Heart
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ipcf-brand"
                      aria-hidden="true"
                    />
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-ipcf-deep">{ann.label}</span>
                        {ann.isToday && (
                          <span className="rounded-full bg-ipcf-gold px-2 py-0.5 text-[10px] font-bold text-white">
                            Hoje!
                          </span>
                        )}
                      </div>
                      <p className="font-semibold text-ipcf-brand">
                        💍 {ann.bodasName} · {ann.years}{" "}
                        {ann.years === 1 ? "ano" : "anos"} ({ann.dateIso.slice(8, 10)}
                        /{ann.dateIso.slice(5, 7)})
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {waUrl && (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Enviar felicitações de bodas no WhatsApp para ${ann.label}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-900 hover:bg-emerald-100"
                      >
                        <MessageCircle className="h-3 w-3" aria-hidden="true" />
                        <span>WhatsApp</span>
                      </a>
                    )}
                    {ann.href && (
                      <Link
                        href={ann.href}
                        className="rounded-lg border border-ipcf-border bg-white px-2 py-1 text-[11px] font-bold text-ipcf-brand hover:bg-ipcf-bg"
                      >
                        Ficha
                      </Link>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {marriageData.upcoming.length > 0 && (
            <div className="border-t border-ipcf-border pt-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-ipcf-muted">
                Nos próximos 30 dias
              </p>
              <ul className="mt-2 space-y-1.5">
                {marriageData.upcoming.slice(0, 4).map((ann) => (
                  <li
                    key={ann.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-ipcf-bg px-2.5 py-1.5 text-xs"
                  >
                    <div className="min-w-0">
                      <span className="block truncate font-semibold text-ipcf-deep">
                        {ann.label}
                      </span>
                      <span className="block text-[11px] text-ipcf-muted">
                        {ann.bodasName} ({ann.years}{" "}
                        {ann.years === 1 ? "ano" : "anos"}) ·{" "}
                        {ann.dateIso.slice(8, 10)}/{ann.dateIso.slice(5, 7)}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="rounded-full border border-ipcf-border bg-white px-2 py-0.5 text-[11px] font-bold text-ipcf-brand">
                        em {ann.daysUntil}d
                      </span>
                      {ann.href && (
                        <Link
                          href={ann.href}
                          className="text-[11px] font-bold text-ipcf-brand hover:underline"
                        >
                          Ficha
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
    </>
  );
});
