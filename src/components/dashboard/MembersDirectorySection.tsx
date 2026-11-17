"use client";

import { memo, useMemo } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import {
  CadastroStatusBadge,
  MemberAvatar,
  MembresiaBadge,
  OficiatoBadge,
} from "@/components/ui/FormControls";
import {
  calculateAge,
  formatDateBR,
  formatWhatsApp,
  getAgeBand,
  type AgeBand,
} from "@/lib/validations/member.schema";
import type {
  AdminMemberRecord,
  MarriageDashboardData,
  MemberSortOption,
  NeighborhoodStat,
} from "./dashboard.types";

interface ActiveFilterChip {
  id: string;
  label: string;
  onClear: () => void;
}

interface MembersDirectorySectionProps {
  filteredRecords: AdminMemberRecord[];
  paginatedRecords: AdminMemberRecord[];
  bairros: NeighborhoodStat[];
  familyDepsByBand: Map<string, Map<AgeBand, string[]>>;
  familyDepsLabelsByFamily: Map<string, string[]>;
  marriageData: MarriageDashboardData;
  prayersActiveCount: number;
  searchInput: string;
  statusMembresiaFilter: string;
  oficiatoFilter: string;
  bairroFilter: string;
  statusCadastroFilter: string;
  ageGroupFilter: AgeBand | "ALL";
  onlyPrayerFilter: boolean;
  onlyAnniversaryFilter: boolean;
  sortBy: MemberSortOption;
  activeFilters: ActiveFilterChip[];
  pageSize: 10 | 20 | 30;
  safePage: number;
  totalPages: number;
  onSearchChange: (val: string) => void;
  onStatusMembresiaChange: (val: string) => void;
  onOficiatoChange: (val: string) => void;
  onBairroChange: (val: string) => void;
  onStatusCadastroChange: (val: string) => void;
  onSortChange: (val: MemberSortOption) => void;
  onTogglePrayer: () => void;
  onToggleAnniversary: () => void;
  onClearFilters: () => void;
  onPageSizeChange: (size: 10 | 20 | 30) => void;
  onGoToPage: (page: number) => void;
}

function formatServiceSummary(
  talentos: string | null | undefined,
  dias: string[]
): string | null {
  const parts: string[] = [];
  if (talentos?.trim()) parts.push(talentos.trim());
  if (dias.length > 0) parts.push(dias.map((d) => d.slice(0, 3)).join(", "));
  return parts.length > 0 ? parts.join(" · ") : null;
}

export const MembersDirectorySection = memo(function MembersDirectorySection({
  filteredRecords,
  paginatedRecords,
  bairros,
  familyDepsByBand,
  familyDepsLabelsByFamily,
  marriageData,
  prayersActiveCount,
  searchInput,
  statusMembresiaFilter,
  oficiatoFilter,
  bairroFilter,
  statusCadastroFilter,
  ageGroupFilter,
  onlyPrayerFilter,
  onlyAnniversaryFilter,
  sortBy,
  activeFilters,
  pageSize,
  safePage,
  totalPages,
  onSearchChange,
  onStatusMembresiaChange,
  onOficiatoChange,
  onBairroChange,
  onStatusCadastroChange,
  onSortChange,
  onTogglePrayer,
  onToggleAnniversary,
  onClearFilters,
  onPageSizeChange,
  onGoToPage,
}: MembersDirectorySectionProps) {
  const visiblePages = useMemo(() => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    let start = Math.max(1, safePage - 2);
    const end = Math.min(totalPages, start + 4);
    if (end - start < 4) {
      start = Math.max(1, end - 4);
    }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [safePage, totalPages]);

  return (
    <section className="space-y-4 rounded-2xl border border-ipcf-border bg-white p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="table-heading" className="font-serif text-lg font-bold text-ipcf-deep">
          Rol Nominal de Cadastrados ({filteredRecords.length})
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onTogglePrayer}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold transition ${
              onlyPrayerFilter
                ? "border-amber-400 bg-amber-100 text-amber-950"
                : "border-ipcf-border bg-ipcf-bg text-ipcf-deep hover:border-amber-300"
            }`}
          >
            <span>🙏 Somente com Oração ({prayersActiveCount})</span>
          </button>

          <button
            type="button"
            onClick={onToggleAnniversary}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold transition ${
              onlyAnniversaryFilter
                ? "border-rose-400 bg-rose-100 text-rose-950"
                : "border-ipcf-border bg-ipcf-bg text-ipcf-deep hover:border-rose-300"
            }`}
          >
            <span>💍 Bodas da semana ({marriageData.weekly.length})</span>
          </button>

          <button
            type="button"
            onClick={onClearFilters}
            className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-ipcf-muted hover:bg-ipcf-bg hover:text-ipcf-deep"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Limpar filtros</span>
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="relative lg:col-span-2">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ipcf-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            aria-label="Buscar membro por nome, filho, CPF, bairro, profissão ou ministério"
            placeholder="Buscar nome, filho, CPF, bairro ou dom..."
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            className="ipcf-input pl-10"
          />
        </div>

        <select
          aria-label="Filtrar por situação de membresia"
          value={statusMembresiaFilter}
          onChange={(e) => onStatusMembresiaChange(e.target.value)}
          className="ipcf-input"
        >
          <option value="ALL">Toda Membresia</option>
          <option value="Membro Comungante">Membro Comungante</option>
          <option value="Membro Não-Comungante">Membro Não-Comungante</option>
          <option value="Não-Membro">Não-Membro</option>
        </select>

        <select
          aria-label="Filtrar por oficialato"
          value={oficiatoFilter}
          onChange={(e) => onOficiatoChange(e.target.value)}
          className="ipcf-input"
        >
          <option value="ALL">Todo Oficialato</option>
          <option value="Pastor">Pastores</option>
          <option value="Presbítero">Presbíteros</option>
          <option value="Diácono">Diáconos</option>
          <option value="Não oficial">Sem oficialato</option>
        </select>

        <div className="grid grid-cols-2 gap-2">
          <select
            aria-label="Filtrar por bairro"
            value={bairroFilter}
            onChange={(e) => onBairroChange(e.target.value)}
            className="ipcf-input"
          >
            <option value="ALL">Bairros</option>
            {bairros.map((b) => (
              <option key={b.key} value={b.key}>
                {b.label}
              </option>
            ))}
          </select>

          <select
            aria-label="Filtrar por status do cadastro"
            value={statusCadastroFilter}
            onChange={(e) => onStatusCadastroChange(e.target.value)}
            className="ipcf-input"
          >
            <option value="Ativo">Ativos</option>
            <option value="ALL">Todos</option>
            <option value="Ausente">Ausentes</option>
            <option value="Transferido">Transferidos</option>
            <option value="Falecido">Falecidos</option>
          </select>
        </div>

        <select
          aria-label="Ordenar cadastrados"
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as MemberSortOption)}
          className="ipcf-input"
        >
          <option value="name-asc">Ordenar: Nome (A–Z)</option>
          <option value="age-asc">Ordenar: Mais jovens</option>
          <option value="age-desc">Ordenar: Mais velhos</option>
          <option value="recent">Ordenar: Mais recentes</option>
        </select>
      </div>

      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-[11px] font-semibold text-ipcf-muted">Filtros ativos:</span>
          {activeFilters.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={chip.onClear}
              className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-ipcf-brand/30 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-ipcf-deep hover:bg-emerald-100"
            >
              <span>{chip.label}</span>
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}

      {/* Visão Mobile em Cards (sem rolagem horizontal forçada) */}
      <ul className="space-y-3 md:hidden" aria-label="Lista de cadastrados em cards">
        {paginatedRecords.length === 0 ? (
          <li className="rounded-xl bg-ipcf-bg px-4 py-6 text-center text-sm text-ipcf-muted">
            Nenhum cadastro corresponde aos filtros selecionados.
          </li>
        ) : (
          paginatedRecords.map(({ member, family, prayerMotivo }) => {
            const allFamilyDeps =
              member.status_cadastro === "Ativo" && member.family_id
                ? familyDepsLabelsByFamily.get(member.family_id) ?? []
                : [];
            const matchedDeps =
              ageGroupFilter !== "ALL" &&
              getAgeBand(calculateAge(member.data_nascimento)) !== ageGroupFilter &&
              member.family_id
                ? familyDepsByBand.get(member.family_id)?.get(ageGroupFilter) ?? []
                : [];
            const nonCommDeps =
              matchedDeps.length === 0 &&
              statusMembresiaFilter === "Membro Não-Comungante" &&
              member.status_membresia !== "Membro Não-Comungante"
                ? allFamilyDeps
                : [];
            const weeklyAnniv =
              member.status_cadastro === "Ativo" &&
              member.estado_civil === "Casado(a)" &&
              member.family_id
                ? marriageData.weeklyByFamilyId.get(member.family_id)
                : undefined;
            const serviceSummary = formatServiceSummary(
              member.talentos_ministerios,
              member.disponibilidade_dias
            );

            return (
              <li
                key={member.id}
                className="space-y-3 rounded-2xl border border-ipcf-border bg-ipcf-bg/40 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <MemberAvatar name={member.nome_completo} size="md" />
                    <div className="min-w-0">
                      <Link
                        href={`/admin/membro/${member.id}`}
                        className="block truncate text-sm font-bold text-ipcf-deep hover:underline"
                      >
                        {member.nome_completo}
                      </Link>
                      <p className="text-xs text-ipcf-muted">
                        {calculateAge(member.data_nascimento)} anos ·{" "}
                        {formatDateBR(member.data_nascimento)}
                        {allFamilyDeps.length > 0 && (
                          <>
                            {" "}
                            · {allFamilyDeps.length}{" "}
                            {allFamilyDeps.length === 1 ? "filho" : "filhos"}
                          </>
                        )}
                      </p>
                      {serviceSummary && (
                        <p className="mt-0.5 truncate text-[11px] text-ipcf-brand">
                          {serviceSummary}
                        </p>
                      )}
                    </div>
                  </div>
                  <CadastroStatusBadge status={member.status_cadastro} />
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <MembresiaBadge status={member.status_membresia} />
                  <OficiatoBadge oficiato={member.oficiato} />
                  {weeklyAnniv && (
                    <span className="inline-flex items-center rounded-full border border-rose-300 bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-900">
                      💍 {weeklyAnniv.bodasName} ({weeklyAnniv.years} anos)
                    </span>
                  )}
                  {prayerMotivo.trim() && (
                    <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                      🙏 Oração
                    </span>
                  )}
                  {matchedDeps.length > 0 && (
                    <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-ipcf-deep">
                      Filho(a): {matchedDeps.join(", ")}
                    </span>
                  )}
                  {nonCommDeps.length > 0 && (
                    <span className="inline-flex items-center rounded-full border border-ipcf-gold/50 bg-ipcf-gold-soft/30 px-2.5 py-0.5 text-xs font-semibold text-ipcf-deep">
                      Não-comungante(s): {nonCommDeps.join(", ")}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ipcf-border pt-2.5 text-xs">
                  <span className="text-ipcf-muted">
                    <strong className="text-ipcf-deep">{family?.bairro ?? "—"}</strong> ·{" "}
                    {family?.cidade ?? "Recife"}
                  </span>
                  <span className="font-semibold text-ipcf-ink">
                    {formatWhatsApp(member.whatsapp)}
                  </span>
                </div>

                <Link
                  href={`/admin/membro/${member.id}`}
                  className="flex min-h-10 w-full items-center justify-center rounded-xl border border-ipcf-border bg-white px-4 py-2 text-xs font-bold text-ipcf-deep hover:bg-ipcf-gold-soft/35"
                >
                  Abrir Ficha Completa →
                </Link>
              </li>
            );
          })
        )}
      </ul>

      {/* Tabela Acessível Tablet/Desktop com Scroll Lateral por Teclado */}
      <div
        className="table-scroll-region hidden md:block"
        tabIndex={0}
        role="region"
        aria-labelledby="table-heading"
      >
        <table className="w-full min-w-[780px] border-collapse text-left text-sm">
          <caption className="visually-hidden">
            Lista de membros e congregados da IPCF filtrada por status e bairro
          </caption>
          <thead className="sticky top-0 z-10 bg-ipcf-deep text-xs uppercase text-white">
            <tr>
              <th scope="col" className="sticky left-0 z-20 bg-ipcf-deep px-4 py-3 font-bold">
                Membro / Congregado
              </th>
              <th scope="col" className="px-4 py-3 font-bold">
                Membresia &amp; Cargo
              </th>
              <th scope="col" className="px-4 py-3 font-bold">
                Bairro / Cidade
              </th>
              <th scope="col" className="px-4 py-3 font-bold">
                WhatsApp
              </th>
              <th scope="col" className="px-4 py-3 font-bold">
                Situação
              </th>
              <th scope="col" className="px-4 py-3 text-right font-bold">
                Ação
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ipcf-border bg-white">
            {paginatedRecords.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-ipcf-muted">
                  Nenhum cadastro corresponde aos filtros selecionados.
                </td>
              </tr>
            ) : (
              paginatedRecords.map(({ member, family, prayerMotivo }) => {
                const allFamilyDeps =
                  member.status_cadastro === "Ativo" && member.family_id
                    ? familyDepsLabelsByFamily.get(member.family_id) ?? []
                    : [];
                const matchedDeps =
                  ageGroupFilter !== "ALL" &&
                  getAgeBand(calculateAge(member.data_nascimento)) !== ageGroupFilter &&
                  member.family_id
                    ? familyDepsByBand.get(member.family_id)?.get(ageGroupFilter) ?? []
                    : [];
                const nonCommDeps =
                  matchedDeps.length === 0 &&
                  statusMembresiaFilter === "Membro Não-Comungante" &&
                  member.status_membresia !== "Membro Não-Comungante"
                    ? allFamilyDeps
                    : [];
                const weeklyAnniv =
                  member.status_cadastro === "Ativo" &&
                  member.estado_civil === "Casado(a)" &&
                  member.family_id
                    ? marriageData.weeklyByFamilyId.get(member.family_id)
                    : undefined;
                const serviceSummary = formatServiceSummary(
                  member.talentos_ministerios,
                  member.disponibilidade_dias
                );

                return (
                  <tr key={member.id} className="hover:bg-ipcf-bg/60">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 bg-white px-4 py-3 font-normal"
                    >
                      <div className="flex items-center gap-3">
                        <MemberAvatar name={member.nome_completo} size="sm" />
                        <div className="min-w-0 max-w-xs">
                          <Link
                            href={`/admin/membro/${member.id}`}
                            className="block truncate font-bold text-ipcf-deep hover:underline"
                          >
                            {member.nome_completo}
                          </Link>
                          <p className="text-xs text-ipcf-muted">
                            {calculateAge(member.data_nascimento)} anos ·{" "}
                            {formatDateBR(member.data_nascimento)}
                            {allFamilyDeps.length > 0 && (
                              <>
                                {" "}
                                · {allFamilyDeps.length}{" "}
                                {allFamilyDeps.length === 1 ? "filho" : "filhos"}
                              </>
                            )}
                            {prayerMotivo.trim() && (
                              <span
                                title="Possui pedido de oração registrado"
                                className="ml-1.5 inline-flex items-center gap-0.5 text-amber-800"
                              >
                                · 🙏 Oração
                              </span>
                            )}
                            {weeklyAnniv && (
                              <span
                                title={`${weeklyAnniv.bodasName} (${weeklyAnniv.years} anos)`}
                                className="ml-1.5 inline-flex items-center gap-0.5 font-semibold text-rose-800"
                              >
                                · 💍 {weeklyAnniv.bodasName}
                              </span>
                            )}
                          </p>
                          {serviceSummary && (
                            <p
                              title={serviceSummary}
                              className="mt-0.5 truncate text-[11px] text-ipcf-brand"
                            >
                              {serviceSummary}
                            </p>
                          )}
                          {matchedDeps.length > 0 && (
                            <span className="mt-1 inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-ipcf-deep">
                              Filho(a) na faixa: {matchedDeps.join(", ")}
                            </span>
                          )}
                          {nonCommDeps.length > 0 && (
                            <span className="mt-1 inline-flex items-center rounded-full border border-ipcf-gold/50 bg-ipcf-gold-soft/30 px-2 py-0.5 text-[11px] font-semibold text-ipcf-deep">
                              Não-comungante(s): {nonCommDeps.join(", ")}
                            </span>
                          )}
                        </div>
                      </div>
                    </th>

                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <MembresiaBadge status={member.status_membresia} />
                        <OficiatoBadge oficiato={member.oficiato} />
                      </div>
                    </td>

                    <td className="px-4 py-3 text-xs text-ipcf-ink">
                      <strong className="block">{family?.bairro ?? "—"}</strong>
                      <span className="text-ipcf-muted">{family?.cidade ?? "Recife"}</span>
                    </td>

                    <td className="px-4 py-3 text-xs font-medium text-ipcf-ink">
                      {formatWhatsApp(member.whatsapp)}
                    </td>

                    <td className="px-4 py-3">
                      <CadastroStatusBadge status={member.status_cadastro} />
                    </td>

                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/membro/${member.id}`}
                        className="inline-flex items-center rounded-lg border border-ipcf-border bg-ipcf-bg px-3 py-1.5 text-xs font-bold text-ipcf-deep hover:bg-ipcf-gold-soft/40"
                      >
                        Abrir Ficha →
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Controles de Paginação e Itens por Página */}
      {filteredRecords.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-ipcf-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3 text-xs text-ipcf-muted">
            <span>
              Mostrando{" "}
              <strong className="text-ipcf-deep">
                {(safePage - 1) * pageSize + 1}–
                {Math.min(safePage * pageSize, filteredRecords.length)}
              </strong>{" "}
              de <strong className="text-ipcf-deep">{filteredRecords.length}</strong>{" "}
              {filteredRecords.length === 1 ? "pessoa" : "pessoas"}
            </span>

            <label className="inline-flex items-center gap-1.5">
              <span className="sr-only">Pessoas por página</span>
              <select
                aria-label="Quantidade de pessoas por página"
                value={pageSize}
                onChange={(e) => {
                  const nextSize = Number(e.target.value) as 10 | 20 | 30;
                  onPageSizeChange(nextSize);
                }}
                className="cursor-pointer rounded-xl border border-ipcf-border bg-white px-2.5 py-1.5 text-xs font-semibold text-ipcf-deep focus:border-ipcf-brand focus:outline-none"
              >
                <option value={10}>10 por página</option>
                <option value={20}>20 por página</option>
                <option value={30}>30 por página</option>
              </select>
            </label>
          </div>

          <nav
            aria-label="Paginação do rol nominal"
            className="flex flex-wrap items-center gap-1.5"
          >
            <button
              type="button"
              onClick={() => onGoToPage(safePage - 1)}
              disabled={safePage <= 1}
              aria-label="Página anterior"
              className="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-xl border border-ipcf-border bg-white px-2.5 py-1.5 text-xs font-bold text-ipcf-deep transition hover:bg-ipcf-bg disabled:cursor-not-allowed disabled:opacity-45"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Anterior</span>
            </button>

            {visiblePages[0] > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => onGoToPage(1)}
                  className="inline-flex min-h-9 min-w-9 cursor-pointer items-center justify-center rounded-xl border border-ipcf-border bg-white px-2.5 py-1.5 text-xs font-bold text-ipcf-deep hover:bg-ipcf-bg"
                >
                  1
                </button>
                {visiblePages[0] > 2 && (
                  <span className="px-1 text-xs text-ipcf-muted" aria-hidden="true">
                    …
                  </span>
                )}
              </>
            )}

            {visiblePages.map((pageNum) => {
              const isCurrent = pageNum === safePage;
              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => onGoToPage(pageNum)}
                  aria-current={isCurrent ? "page" : undefined}
                  className={`inline-flex min-h-9 min-w-9 cursor-pointer items-center justify-center rounded-xl border px-2.5 py-1.5 text-xs font-bold transition ${
                    isCurrent
                      ? "border-ipcf-brand bg-ipcf-brand text-white"
                      : "border-ipcf-border bg-white text-ipcf-deep hover:bg-ipcf-bg"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            {visiblePages[visiblePages.length - 1] < totalPages && (
              <>
                {visiblePages[visiblePages.length - 1] < totalPages - 1 && (
                  <span className="px-1 text-xs text-ipcf-muted" aria-hidden="true">
                    …
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onGoToPage(totalPages)}
                  className="inline-flex min-h-9 min-w-9 cursor-pointer items-center justify-center rounded-xl border border-ipcf-border bg-white px-2.5 py-1.5 text-xs font-bold text-ipcf-deep hover:bg-ipcf-bg"
                >
                  {totalPages}
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => onGoToPage(safePage + 1)}
              disabled={safePage >= totalPages}
              aria-label="Próxima página"
              className="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-xl border border-ipcf-border bg-white px-2.5 py-1.5 text-xs font-bold text-ipcf-deep transition hover:bg-ipcf-bg disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span>Próxima</span>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </nav>
        </div>
      )}
    </section>
  );
});
