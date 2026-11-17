"use client";

import { memo, useState } from "react";
import Link from "next/link";
import { Lock, LockOpen, MessageCircle } from "lucide-react";
import { buildWhatsAppUrl, calculateAge } from "@/lib/validations/member.schema";
import type { AdminMemberRecord } from "./dashboard.types";

interface PrayerRequestsCardProps {
  activePrayerRecords: AdminMemberRecord[];
  onlyPrayerFilter: boolean;
  onTogglePrayerFilter: () => void;
}

export const PrayerRequestsCard = memo(function PrayerRequestsCard({
  activePrayerRecords,
  onlyPrayerFilter,
  onTogglePrayerFilter,
}: PrayerRequestsCardProps) {
  const [revealPrayers, setRevealPrayers] = useState(false);

  return (
    <section
      aria-label="Pedidos de Oração Sigilosos"
      className="rounded-2xl border border-ipcf-gold/60 bg-white p-5 shadow-xs"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-serif text-lg font-bold text-ipcf-deep">
            {revealPrayers ? (
              <LockOpen className="h-5 w-5 text-ipcf-brand" aria-hidden="true" />
            ) : (
              <Lock className="h-5 w-5 text-ipcf-gold" aria-hidden="true" />
            )}
            <span>Pedidos de Oração ({activePrayerRecords.length})</span>
          </h2>
          <p className="mt-0.5 text-xs text-ipcf-muted">
            Acesso sigiloso do Conselho · Protegido na tela.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setRevealPrayers((prev) => !prev)}
          aria-expanded={revealPrayers}
          aria-label={
            revealPrayers
              ? "Ocultar pedidos de oração"
              : "Destrancar e visualizar pedidos de oração"
          }
          className={`inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
            revealPrayers
              ? "border-ipcf-border bg-ipcf-bg text-ipcf-deep hover:bg-ipcf-gold-soft/25"
              : "border-ipcf-gold/60 bg-ipcf-gold-soft/25 text-ipcf-deep hover:bg-ipcf-gold-soft/45"
          }`}
        >
          {revealPrayers ? (
            <>
              <Lock className="h-3.5 w-3.5 text-ipcf-brand" aria-hidden="true" />
              <span>Ocultar</span>
            </>
          ) : (
            <>
              <LockOpen className="h-3.5 w-3.5 text-ipcf-brand" aria-hidden="true" />
              <span>Ver pedidos</span>
            </>
          )}
        </button>
      </div>

      {!revealPrayers ? (
        <div className="mt-3 space-y-2.5 rounded-xl border border-dashed border-ipcf-gold/60 bg-ipcf-gold-soft/15 px-4 py-5 text-center">
          <Lock className="mx-auto h-5 w-5 text-ipcf-brand/80" aria-hidden="true" />
          {activePrayerRecords.length === 0 ? (
            <p className="text-xs text-ipcf-muted">
              Nenhum pedido de oração ativo registrado no momento.
            </p>
          ) : (
            <>
              <p className="text-xs font-semibold text-ipcf-deep">
                {activePrayerRecords.length} pedido(s) ativo(s) oculto(s) por privacidade.
              </p>
              <p className="text-[11px] text-ipcf-muted">
                Clique em “Ver pedidos” acima para ler os motivos com sigilo.
              </p>
            </>
          )}
        </div>
      ) : activePrayerRecords.length === 0 ? (
        <p className="mt-3 rounded-xl bg-ipcf-bg px-3 py-3 text-xs text-ipcf-muted">
          Nenhum pedido de oração ativo registrado no momento.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="max-h-72 space-y-2.5 overflow-y-auto pr-1">
            {activePrayerRecords.map(({ member, family, prayerMotivo }) => {
              const firstName = member.nome_completo.split(" ")[0];
              const waUrl = buildWhatsAppUrl(
                member.whatsapp,
                `Graça e paz, ${firstName}! A liderança da IPCF está orando pelo seu pedido compartilhado no Dados IPCF.`
              );
              return (
                <article
                  key={member.id}
                  className="space-y-2 rounded-xl border border-ipcf-gold/40 bg-ipcf-gold-soft/15 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/admin/membro/${member.id}`}
                        className="block truncate text-xs font-bold text-ipcf-deep hover:underline"
                      >
                        {member.nome_completo}
                      </Link>
                      <p className="text-[11px] text-ipcf-muted">
                        {family?.bairro ? `${family.bairro} · ` : ""}
                        {calculateAge(member.data_nascimento)} anos
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {waUrl && (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Enviar mensagem no WhatsApp para ${member.nome_completo}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-900 hover:bg-emerald-100"
                        >
                          <MessageCircle className="h-3 w-3" aria-hidden="true" />
                          <span>WhatsApp</span>
                        </a>
                      )}
                      <Link
                        href={`/admin/membro/${member.id}`}
                        className="rounded-lg border border-ipcf-border bg-white px-2 py-1 text-[11px] font-bold text-ipcf-deep hover:bg-ipcf-bg"
                      >
                        Ficha
                      </Link>
                    </div>
                  </div>
                  <p className="whitespace-pre-line rounded-lg bg-white/85 px-2.5 py-2 text-xs leading-relaxed text-ipcf-ink">
                    “{prayerMotivo}”
                  </p>
                </article>
              );
            })}
          </div>

          <div className="flex items-center justify-end border-t border-ipcf-border pt-2.5">
            <button
              type="button"
              onClick={onTogglePrayerFilter}
              className={`cursor-pointer rounded-lg border px-2.5 py-1 text-[11px] font-bold transition ${
                onlyPrayerFilter
                  ? "border-ipcf-brand bg-ipcf-brand text-white"
                  : "border-ipcf-border bg-ipcf-bg text-ipcf-deep hover:border-ipcf-brand/40"
              }`}
            >
              {onlyPrayerFilter
                ? "✓ Rol filtrado por oração"
                : "Filtrar rol abaixo por oração"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
});
