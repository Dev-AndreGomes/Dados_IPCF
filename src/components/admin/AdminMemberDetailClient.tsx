"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Heart,
  KeyRound,
  Lock,
  MapPin,
  MessageCircle,
  Navigation,
  Pencil,
  Plus,
  ShieldAlert,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  adminAddDependentAction,
  adminRemoveDependentAction,
  adminResetMemberPasswordAction,
  adminUpdateMemberProfileAction,
  updateMemberEcclesiasticalStatusAction,
} from "@/actions/admin.actions";
import { LeafletMap } from "@/components/map/LeafletMap";
import {
  CivilProfileForm,
  type CivilProfileFormPayload,
} from "@/components/member/CivilProfileForm";
import {
  CadastroStatusBadge,
  FormField,
  MemberAvatar,
  MembresiaBadge,
  OficiatoBadge,
} from "@/components/ui/FormControls";
import {
  buildGpsUrl,
  getCoordsForNeighborhood,
} from "@/lib/geocoding/recife-coords";
import {
  buildWhatsAppUrl,
  calculateAge,
  formatCEP,
  formatCPF,
  formatDateBR,
  formatWhatsApp,
  getMarriageInfo,
  getTodayIsoRecife,
  isValidPastOrTodayDate,
} from "@/lib/validations/member.schema";
import type {
  Dependent,
  Family,
  Member,
  Oficiato,
  PrayerRequest,
  Role,
  StatusCadastro,
  StatusMembresia,
} from "@/types/database.types";

interface AdminMemberDetailClientProps {
  member: Member;
  family: Family | null;
  dependents: Dependent[];
  prayerRequest: PrayerRequest | null;
  spouse: Pick<Member, "id" | "nome_completo" | "status_membresia"> | null;
  parents: Array<Pick<Member, "id" | "nome_completo">>;
  currentAdminId: string;
}

export function AdminMemberDetailClient({
  member,
  family,
  dependents: initialDependents,
  prayerRequest,
  spouse,
  parents,
  currentAdminId,
}: AdminMemberDetailClientProps) {
  const router = useRouter();

  const [statusMembresia, setStatusMembresia] = useState<StatusMembresia>(
    member.status_membresia
  );
  const [oficiato, setOficiato] = useState<Oficiato>(member.oficiato);
  const [statusCadastro, setStatusCadastro] = useState<StatusCadastro>(
    member.status_cadastro
  );
  const [role, setRole] = useState<Role>(member.role);

  const [savingStatus, setSavingStatus] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const feedbackRef = useRef<HTMLDivElement | null>(null);

  // Edição assistida pela Secretaria (dados civis + dependentes)
  const [editingCivil, setEditingCivil] = useState(false);
  const [managingDeps, setManagingDeps] = useState(false);
  const [addedDeps, setAddedDeps] = useState<Dependent[]>([]);
  const [removedDepIds, setRemovedDepIds] = useState<string[]>([]);
  const [newDepName, setNewDepName] = useState("");
  const [newDepBirth, setNewDepBirth] = useState("");
  const [addingDep, setAddingDep] = useState(false);
  const [depError, setDepError] = useState("");
  const [confirmRemoveDepId, setConfirmRemoveDepId] = useState<string | null>(null);
  const [removingDepId, setRemovingDepId] = useState<string | null>(null);

  const dependents = [
    ...initialDependents.filter((d) => !removedDepIds.includes(d.id)),
    ...addedDeps.filter(
      (a) =>
        !removedDepIds.includes(a.id) &&
        !initialDependents.some((d) => d.id === a.id)
    ),
  ];

  const todayIso = getTodayIsoRecife();
  const marriageInfo =
    member.estado_civil === "Casado(a)"
      ? getMarriageInfo(family?.data_casamento)
      : null;
  const anniversaryWhatsappUrl = marriageInfo?.isWeek
    ? buildWhatsAppUrl(
        member.whatsapp,
        `Graça e paz, ${member.nome_completo.trim().split(/\s+/)[0] || member.nome_completo}! Parabéns pelas ${marriageInfo.weekBodasLabel} (${marriageInfo.weekYears} ${marriageInfo.weekYears === 1 ? "ano" : "anos"} de casamento)! Que o Senhor continue abençoando o lar de vocês.`
      )
    : null;

  // Reset de senha (RN02)
  const resetDialogRef = useRef<HTMLDialogElement | null>(null);
  const [resetting, setResetting] = useState(false);
  const [tempPasswordResult, setTempPasswordResult] = useState<string | null>(null);
  const [copiedPass, setCopiedPass] = useState(false);

  const [fallbackLat, fallbackLng] = getCoordsForNeighborhood(
    family?.bairro ?? "Casa Forte"
  );
  const lat =
    family?.latitude != null ? Number(family.latitude) : fallbackLat;
  const lng =
    family?.longitude != null ? Number(family.longitude) : fallbackLng;

  const fullAddressString = family
    ? [
        family.logradouro,
        family.numero,
        family.complemento,
        family.bairro,
        family.cidade,
      ]
        .filter(Boolean)
        .join(", ")
    : "Casa Forte, Recife - PE";

  const gpsHref = buildGpsUrl(
    family?.logradouro,
    family?.numero,
    family?.bairro ?? "Casa Forte",
    family?.cidade ?? "Recife"
  );
  const waHref = `https://wa.me/55${member.whatsapp.replace(/\D/g, "")}`;

  async function handleSaveStatus(e: React.FormEvent) {
    e.preventDefault();
    setSavingStatus(true);
    setFeedback(null);

    const effectiveOficiato: Oficiato =
      statusMembresia === "Membro Comungante"
        ? oficiato
        : statusMembresia === "Não-Membro" && oficiato === "Pastor"
          ? "Pastor"
          : "Não oficial";

    const res = await updateMemberEcclesiasticalStatusAction({
      memberId: member.id,
      status_membresia: statusMembresia,
      oficiato: effectiveOficiato,
      status_cadastro: statusCadastro,
      role,
    });

    setSavingStatus(false);
    if (!res.ok) {
      showAdminFeedback("error", res.error);
      return;
    }

    showAdminFeedback(
      "success",
      res.message ?? "Alterações eclesiásticas salvas!"
    );
    router.refresh();
  }

  function showAdminFeedback(type: "success" | "error", text: string) {
    setFeedback({ type, text });
    requestAnimationFrame(() => {
      feedbackRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  async function handleSaveAssistedProfile(payload: CivilProfileFormPayload) {
    const res = await adminUpdateMemberProfileAction(member.id, payload);
    if (res.ok) {
      router.refresh();
    }
    return res;
  }

  async function handleAdminAddDependent() {
    setDepError("");
    if (newDepName.trim().length < 2) {
      setDepError("Informe o nome completo do filho(a).");
      return;
    }
    if (!isValidPastOrTodayDate(newDepBirth)) {
      setDepError("Informe uma data de nascimento válida (não pode ser futura).");
      return;
    }

    setAddingDep(true);
    const res = await adminAddDependentAction(member.id, {
      nome: newDepName,
      data_nascimento: newDepBirth,
    });
    setAddingDep(false);

    if (!res.ok) {
      setDepError(res.error);
      return;
    }

    setAddedDeps((prev) => [...prev, res.data]);
    setNewDepName("");
    setNewDepBirth("");
    showAdminFeedback(
      "success",
      res.message ?? `${res.data.nome} adicionado(a) à família.`
    );
    router.refresh();
  }

  async function handleAdminRemoveDependent(depId: string) {
    setRemovingDepId(depId);
    const res = await adminRemoveDependentAction(member.id, depId);
    setRemovingDepId(null);
    setConfirmRemoveDepId(null);

    if (!res.ok) {
      showAdminFeedback("error", res.error);
      return;
    }

    setRemovedDepIds((prev) => [...prev, depId]);
    showAdminFeedback("success", res.message ?? "Dependente removido do lar.");
    router.refresh();
  }

  async function handleConfirmResetPassword() {
    setResetting(true);
    const res = await adminResetMemberPasswordAction(member.id);
    setResetting(false);

    if (!res.ok) {
      resetDialogRef.current?.close();
      setFeedback({ type: "error", text: res.error });
      return;
    }

    setTempPasswordResult(res.data.tempPassword);
    setCopiedPass(false);
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 rounded-xl border border-ipcf-border bg-white px-3.5 py-2 text-xs font-bold text-ipcf-deep hover:bg-ipcf-bg"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Voltar ao Painel Pastoral</span>
        </Link>

        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-ipcf-brand px-4 py-2 text-xs font-bold text-white hover:bg-ipcf-deep"
        >
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
          <span>Conversar no WhatsApp</span>
        </a>
      </div>

      {/* Cabeçalho do Membro */}
      <section className="flex flex-col justify-between gap-4 rounded-2xl border border-ipcf-border bg-white p-5 shadow-xs sm:flex-row sm:items-center sm:p-6">
        <div className="flex items-center gap-4">
          <MemberAvatar name={member.nome_completo} size="lg" />
          <div>
            <h1 className="font-serif text-2xl font-bold text-ipcf-deep">
              {member.nome_completo}
            </h1>
            <p className="text-xs font-medium text-ipcf-muted">
              CPF: {formatCPF(member.cpf)} · {member.sexo} · {calculateAge(member.data_nascimento)} anos ({formatDateBR(member.data_nascimento)})
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <MembresiaBadge status={member.status_membresia} />
              <OficiatoBadge oficiato={member.oficiato} />
              <CadastroStatusBadge status={member.status_cadastro} />
              {member.role === "admin" && (
                <span className="inline-flex items-center rounded-full border border-amber-400 bg-ipcf-deep px-2.5 py-0.5 text-xs font-bold text-ipcf-gold-soft">
                  Admin Pastoral
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setTempPasswordResult(null);
            resetDialogRef.current?.showModal();
          }}
          className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs font-bold text-amber-950 transition hover:bg-amber-100 sm:w-auto"
        >
          <KeyRound className="h-4 w-4" aria-hidden="true" />
          <span>Resetar Senha (1 Clique)</span>
        </button>
      </section>

      {feedback && (
        <div
          ref={feedbackRef}
          role={feedback.type === "error" ? "alert" : "status"}
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${
            feedback.type === "success"
              ? "border-emerald-300 bg-emerald-50 text-ipcf-deep"
              : "border-ipcf-danger/30 bg-ipcf-danger-bg text-ipcf-danger"
          }`}
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{feedback.text}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        {/* Coluna Esquerda: Ficha Civil + Edição Assistida pela Secretaria */}
        <div className="space-y-6">
          {editingCivil ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-300 bg-amber-50/75 px-4 py-3">
                <div className="text-xs text-amber-950">
                  <strong className="block">Edição Assistida pela Secretaria</strong>
                  <span>
                    Use este modo para corrigir endereço, telefone, casamento ou ministérios em nome do membro.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingCivil(false)}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-ipcf-deep hover:bg-ipcf-bg"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Fechar Edição</span>
                </button>
              </div>

              <CivilProfileForm
                mode="admin"
                member={member}
                family={family}
                submitLabel="Salvar Alterações da Secretaria"
                onSave={handleSaveAssistedProfile}
                onSuccess={(msg) => {
                  setEditingCivil(false);
                  showAdminFeedback("success", msg);
                }}
                onError={(msg) => showAdminFeedback("error", msg)}
                onCancel={() => setEditingCivil(false)}
              />
            </div>
          ) : (
            <>
              <section className="rounded-2xl border border-ipcf-border bg-white p-5 shadow-xs sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ipcf-border pb-3">
                  <h2 className="font-serif text-lg font-bold text-ipcf-deep">
                    Dados Pessoais e Contato
                  </h2>
                  <button
                    type="button"
                    onClick={() => setEditingCivil(true)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-ipcf-border bg-ipcf-bg px-3 py-1.5 text-xs font-bold text-ipcf-deep transition hover:border-ipcf-brand/40 hover:bg-emerald-50"
                  >
                    <Pencil className="h-3.5 w-3.5 text-ipcf-brand" aria-hidden="true" />
                    <span>Editar Dados (Secretaria)</span>
                  </button>
                </div>

                <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold text-ipcf-muted">WhatsApp</dt>
                    <dd className="font-bold text-ipcf-deep">
                      {formatWhatsApp(member.whatsapp)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-ipcf-muted">E-mail</dt>
                    <dd className="font-medium text-ipcf-ink">{member.email || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-ipcf-muted">Naturalidade</dt>
                    <dd className="font-medium text-ipcf-ink">
                      {member.naturalidade || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-ipcf-muted">Profissão / Ocupação</dt>
                    <dd className="font-medium text-ipcf-ink">
                      {member.profissao || "—"}
                    </dd>
                  </div>
                </dl>
              </section>

              {/* Núcleo Familiar */}
              <section className="rounded-2xl border border-ipcf-border bg-white p-5 shadow-xs sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ipcf-border pb-3">
                  <h2 className="flex items-center gap-2 font-serif text-lg font-bold text-ipcf-deep">
                    <Users className="h-5 w-5 text-ipcf-brand" aria-hidden="true" />
                    <span>Vínculos Familiares</span>
                  </h2>
                  <button
                    type="button"
                    onClick={() => setManagingDeps((prev) => !prev)}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-ipcf-border bg-ipcf-bg px-3 py-1.5 text-xs font-bold text-ipcf-deep hover:bg-emerald-50"
                  >
                    <Plus className="h-3.5 w-3.5 text-ipcf-brand" aria-hidden="true" />
                    <span>{managingDeps ? "Concluir Filhos" : "Gerenciar Filhos"}</span>
                  </button>
                </div>

                {marriageInfo?.isWeek && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ipcf-gold/60 bg-ipcf-gold-soft/25 px-3.5 py-2.5 text-xs">
                    <div className="flex items-center gap-2 font-bold text-ipcf-deep">
                      <Heart className="h-4 w-4 text-ipcf-brand" aria-hidden="true" />
                      <span>
                        💍 {marriageInfo.isToday ? "Bodas hoje!" : "Bodas esta semana!"} ·{" "}
                        {marriageInfo.weekBodasLabel} ({marriageInfo.weekYears}{" "}
                        {marriageInfo.weekYears === 1 ? "ano" : "anos"})
                      </span>
                    </div>
                    {anniversaryWhatsappUrl && (
                      <a
                        href={anniversaryWhatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-900 hover:bg-emerald-100"
                      >
                        <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Parabenizar no WhatsApp</span>
                      </a>
                    )}
                  </div>
                )}

                <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold text-ipcf-muted">Estado Civil</dt>
                    <dd className="font-bold text-ipcf-deep">{member.estado_civil}</dd>
                  </div>
                  {member.estado_civil === "Casado(a)" && (
                    <>
                      <div>
                        <dt className="text-xs font-semibold text-ipcf-muted">Cônjuge</dt>
                        <dd className="font-semibold text-ipcf-deep">
                          {spouse ? (
                            <Link
                              href={`/admin/membro/${spouse.id}`}
                              className="text-ipcf-brand underline"
                            >
                              {spouse.nome_completo}
                            </Link>
                          ) : (
                            member.nome_conjuge || "—"
                          )}
                          {member.conjuge_congrega_ipcf && (
                            <span className="ml-1.5 text-xs font-normal text-ipcf-muted">
                              (Congrega na IPCF)
                            </span>
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold text-ipcf-muted">
                          Data de Casamento (Bodas)
                        </dt>
                        <dd className="font-medium text-ipcf-ink">
                          {family?.data_casamento
                            ? formatDateBR(family.data_casamento)
                            : "Não informada"}
                          {marriageInfo && (
                            <span className="mt-0.5 block text-xs font-bold text-ipcf-brand">
                              💍{" "}
                              {marriageInfo.yearsCompleted === 0
                                ? marriageInfo.bodasLabel
                                : `${marriageInfo.yearsCompleted} ${marriageInfo.yearsCompleted === 1 ? "ano" : "anos"} · ${marriageInfo.bodasLabel}`}
                            </span>
                          )}
                        </dd>
                      </div>
                    </>
                  )}
                  {parents.length > 0 && (
                    <div className="sm:col-span-2">
                      <dt className="text-xs font-semibold text-ipcf-muted">
                        Pais Vinculados (Genealogia)
                      </dt>
                      <dd className="mt-1 flex flex-wrap gap-2">
                        {parents.map((p) => (
                          <Link
                            key={p.id}
                            href={`/admin/membro/${p.id}`}
                            className="rounded-lg border border-ipcf-border bg-ipcf-bg px-3 py-1 text-xs font-bold text-ipcf-brand hover:underline"
                          >
                            {p.nome_completo}
                          </Link>
                        ))}
                      </dd>
                    </div>
                  )}
                </dl>

                {(dependents.length > 0 || managingDeps) && (
                  <div className="mt-4 border-t border-ipcf-border pt-4 space-y-3">
                    <h3 className="text-xs font-bold text-ipcf-muted uppercase">
                      Filhos / Dependentes do Lar
                    </h3>
                    {dependents.length === 0 ? (
                      <p className="rounded-xl bg-ipcf-bg px-3 py-2.5 text-xs text-ipcf-muted">
                        Nenhum filho/dependente cadastrado neste lar.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {dependents.map((d) => (
                          <li
                            key={d.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-ipcf-bg px-3 py-2 text-xs"
                          >
                            <span>
                              <strong className="text-ipcf-deep">{d.nome}</strong> ·{" "}
                              {formatDateBR(d.data_nascimento)} ({calculateAge(d.data_nascimento)} anos)
                            </span>
                            <div className="flex items-center gap-2">
                              {d.promovido_membro_id ? (
                                <Link
                                  href={`/admin/membro/${d.promovido_membro_id}`}
                                  className="font-bold text-ipcf-brand underline"
                                >
                                  Ficha própria →
                                </Link>
                              ) : (
                                managingDeps &&
                                (confirmRemoveDepId === d.id ? (
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      disabled={removingDepId === d.id}
                                      onClick={() => void handleAdminRemoveDependent(d.id)}
                                      className="cursor-pointer rounded-lg bg-ipcf-danger px-2.5 py-1 text-[11px] font-bold text-white hover:bg-red-700 disabled:opacity-60"
                                    >
                                      {removingDepId === d.id
                                        ? "Excluindo..."
                                        : "Confirmar"}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={removingDepId === d.id}
                                      onClick={() => setConfirmRemoveDepId(null)}
                                      className="cursor-pointer rounded-lg border border-ipcf-border bg-white px-2 py-1 text-[11px] font-semibold text-ipcf-ink"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmRemoveDepId(d.id)}
                                    aria-label={`Remover ${d.nome}`}
                                    className="inline-flex cursor-pointer items-center rounded-lg border border-red-200 bg-white p-1.5 text-ipcf-danger hover:bg-red-50"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                  </button>
                                ))
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}

                    {managingDeps && (
                      <div className="space-y-2 rounded-xl border border-dashed border-ipcf-border bg-ipcf-bg/40 p-3">
                        <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto] sm:items-end">
                          <FormField id="adm-new-dep-name" label="Adicionar filho(a)">
                            <input
                              id="adm-new-dep-name"
                              type="text"
                              placeholder="Nome completo"
                              value={newDepName}
                              onChange={(e) => {
                                setNewDepName(e.target.value);
                                if (depError) setDepError("");
                              }}
                              className="ipcf-input"
                            />
                          </FormField>
                          <FormField id="adm-new-dep-birth" label="Nascimento">
                            <input
                              id="adm-new-dep-birth"
                              type="date"
                              max={todayIso}
                              value={newDepBirth}
                              onChange={(e) => {
                                setNewDepBirth(e.target.value);
                                if (depError) setDepError("");
                              }}
                              className="ipcf-input"
                            />
                          </FormField>
                          <button
                            type="button"
                            disabled={addingDep || !newDepName.trim() || !newDepBirth}
                            onClick={() => void handleAdminAddDependent()}
                            className="inline-flex cursor-pointer items-center justify-center gap-1 rounded-xl bg-ipcf-deep px-3.5 py-2.5 text-xs font-bold text-white hover:bg-ipcf-brand disabled:opacity-50"
                          >
                            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>{addingDep ? "Salvando..." : "Adicionar"}</span>
                          </button>
                        </div>
                        {depError && (
                          <p role="alert" className="text-xs font-semibold text-ipcf-danger">
                            {depError}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* Ministérios & Pedido de Oração */}
              <section className="rounded-2xl border border-ipcf-border bg-white p-5 shadow-xs sm:p-6 space-y-4">
                <h2 className="border-b border-ipcf-border pb-3 font-serif text-lg font-bold text-ipcf-deep">
                  Engajamento & Cuidado Pastoral
                </h2>

                <div>
                  <h3 className="text-xs font-semibold text-ipcf-muted">
                    Disponibilidade semanal
                  </h3>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {member.disponibilidade_dias.length > 0 ? (
                      member.disponibilidade_dias.map((d) => (
                        <span
                          key={d}
                          className="rounded-full bg-ipcf-bg px-3 py-1 text-xs font-bold text-ipcf-deep border border-ipcf-border"
                        >
                          {d}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-ipcf-muted">Não informada</span>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-ipcf-muted">
                    Talentos e Ministérios
                  </h3>
                  <p className="mt-1 rounded-xl bg-ipcf-bg p-3 text-sm text-ipcf-ink">
                    {member.talentos_ministerios || "Nenhum registrado."}
                  </p>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-ipcf-muted">
                    Maior dificuldade de horário / agenda
                  </h3>
                  <p className="mt-1 rounded-xl bg-ipcf-bg p-3 text-sm text-ipcf-ink">
                    {member.dificuldade_tempo || "Não informada."}
                  </p>
                </div>

                <div className="rounded-xl border border-ipcf-gold/50 bg-ipcf-gold-soft/20 p-4">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-ipcf-deep">
                    <Lock className="h-3.5 w-3.5 text-ipcf-brand" aria-hidden="true" />
                    <span>Pedido de Oração Individual (Sigiloso)</span>
                  </div>
                  <p className="mt-1.5 text-sm text-ipcf-ink">
                    {prayerRequest?.motivo?.trim()
                      ? prayerRequest.motivo
                      : "Nenhum pedido de oração registrado até o momento."}
                  </p>
                </div>
              </section>
            </>
          )}
        </div>

        {/* Coluna Direita: Controle Eclesiástico + MiniMapa de Visitação */}
        <div className="space-y-6">
          <section className="rounded-2xl border border-ipcf-brand/30 bg-white p-5 shadow-xs sm:p-6">
            <h2 className="flex items-center gap-2 border-b border-ipcf-border pb-3 font-serif text-lg font-bold text-ipcf-deep">
              <ShieldAlert className="h-5 w-5 text-ipcf-brand" aria-hidden="true" />
              <span>Gestão Eclesiástica (Admin)</span>
            </h2>
            <p className="mt-2 text-xs text-ipcf-muted">
              Apenas Presbíteros/Pastores e Secretaria com perfil Admin alteram estas definições oficiais.
            </p>

            <form onSubmit={handleSaveStatus} className="mt-4 space-y-4">
              <FormField id="adm-membresia" label="Status de Membresia">
                <select
                  id="adm-membresia"
                  value={statusMembresia}
                  onChange={(e) => {
                    const next = e.target.value as StatusMembresia;
                    setStatusMembresia(next);
                    if (
                      next === "Membro Não-Comungante" ||
                      (next !== "Membro Comungante" && oficiato !== "Pastor")
                    ) {
                      setOficiato("Não oficial");
                    }
                  }}
                  className="ipcf-input"
                >
                  <option value="Membro Comungante">Membro Comungante</option>
                  <option value="Membro Não-Comungante">Membro Não-Comungante</option>
                  <option value="Não-Membro">Não-Membro</option>
                </select>
              </FormField>

              <FormField
                id="adm-oficiato"
                label="Oficialato"
                hint="A tag Pastor é restrita à Administração (não aparece no formulário público)."
              >
                <select
                  id="adm-oficiato"
                  value={oficiato}
                  disabled={statusMembresia === "Membro Não-Comungante"}
                  onChange={(e) => setOficiato(e.target.value as Oficiato)}
                  className="ipcf-input disabled:bg-stone-100"
                >
                  <option value="Não oficial">Não oficial</option>
                  <option
                    value="Diácono"
                    disabled={statusMembresia !== "Membro Comungante"}
                  >
                    Diácono
                    {statusMembresia !== "Membro Comungante"
                      ? " (requer Comungante)"
                      : ""}
                  </option>
                  <option
                    value="Presbítero"
                    disabled={statusMembresia !== "Membro Comungante"}
                  >
                    Presbítero
                    {statusMembresia !== "Membro Comungante"
                      ? " (requer Comungante)"
                      : ""}
                  </option>
                  <option value="Pastor">Pastor</option>
                </select>
              </FormField>

              <FormField
                id="adm-cadastro"
                label="Situação no Rol (Soft-delete / Histórico)"
              >
                <select
                  id="adm-cadastro"
                  value={statusCadastro}
                  onChange={(e) => setStatusCadastro(e.target.value as StatusCadastro)}
                  className="ipcf-input"
                >
                  <option value="Ativo">Ativo</option>
                  <option value="Ausente">Ausente</option>
                  <option value="Transferido">Transferido</option>
                  <option value="Falecido">Falecido</option>
                </select>
              </FormField>

              <FormField id="adm-role" label="Nível de Acesso no Sistema">
                <select
                  id="adm-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className="ipcf-input"
                >
                  <option value="membro">Membro Comum (apenas própria ficha)</option>
                  <option value="admin">Administrador / Conselho (acesso total)</option>
                </select>
              </FormField>

              {member.id === currentAdminId && role !== "admin" && (
                <p className="text-xs font-semibold text-amber-800">
                  Atenção: você está removendo seu próprio privilégio administrativo.
                </p>
              )}

              <button
                type="submit"
                disabled={savingStatus}
                className="w-full cursor-pointer rounded-xl bg-ipcf-deep px-5 py-3 text-sm font-bold text-white transition hover:bg-ipcf-brand disabled:opacity-60"
              >
                {savingStatus ? "Salvando..." : "Atualizar Situação Oficial"}
              </button>
            </form>
          </section>

          {/* Endereço + MiniMapa + Botão GPS */}
          <section className="rounded-2xl border border-ipcf-border bg-white p-5 shadow-xs sm:p-6 space-y-3">
            <h2 className="flex items-center gap-2 font-serif text-lg font-bold text-ipcf-deep">
              <MapPin className="h-5 w-5 text-ipcf-brand" aria-hidden="true" />
              <span>Endereço & Visitação</span>
            </h2>
            <p className="text-sm font-medium text-ipcf-ink">{fullAddressString}</p>
            {family?.cep && (
              <p className="text-xs text-ipcf-muted">CEP: {formatCEP(family.cep)}</p>
            )}

            <LeafletMap
              markers={[
                {
                  id: member.id,
                  label: member.nome_completo,
                  bairro: family?.bairro ?? "Casa Forte",
                  subtitle: fullAddressString,
                  lat,
                  lng,
                },
              ]}
              center={[lat, lng]}
              zoom={15}
              heightClass="h-56"
              showSede={false}
            />

            <a
              href={gpsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-ipcf-border bg-ipcf-bg px-4 py-2.5 text-xs font-bold text-ipcf-deep hover:bg-ipcf-gold-soft/35"
            >
              <Navigation className="h-4 w-4 text-ipcf-brand" aria-hidden="true" />
              <span>Abrir Rota GPS no Google Maps</span>
            </a>
          </section>
        </div>
      </div>

      {/* Dialog Nativo para Reset de Senha em 1 Clique (RN02) */}
      <dialog
        ref={resetDialogRef}
        aria-labelledby="reset-pass-title"
        className="ipcf-dialog m-auto w-full max-w-md rounded-2xl border border-ipcf-border bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-ipcf-deep">
            <KeyRound className="h-5 w-5 text-ipcf-brand" aria-hidden="true" />
            <h3 id="reset-pass-title" className="font-serif text-lg font-bold">
              Redefinir Senha de Acesso
            </h3>
          </div>
          <button
            type="button"
            onClick={() => resetDialogRef.current?.close()}
            aria-label="Fechar janela"
            className="cursor-pointer rounded-lg p-1 text-ipcf-muted hover:bg-ipcf-bg"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {!tempPasswordResult ? (
          <>
            <p className="mt-2 text-sm text-ipcf-muted">
              A senha de <strong className="text-ipcf-deep">{member.nome_completo}</strong> será redefinida para os <strong>6 primeiros dígitos do CPF</strong>. Você poderá informar essa senha temporária ao irmão para que ele acesse e troque depois.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => resetDialogRef.current?.close()}
                className="cursor-pointer rounded-xl border border-ipcf-border bg-white px-4 py-2 text-xs font-bold text-ipcf-ink"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={resetting}
                onClick={() => void handleConfirmResetPassword()}
                className="cursor-pointer rounded-xl bg-ipcf-deep px-4 py-2 text-xs font-bold text-white hover:bg-ipcf-brand disabled:opacity-60"
              >
                {resetting ? "Redefinindo..." : "Confirmar Reset Agora"}
              </button>
            </div>
          </>
        ) : (
          <div className="mt-3 space-y-4">
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-center">
              <span className="text-xs font-semibold text-ipcf-muted">
                Nova senha temporária ativa:
              </span>
              <p className="mt-1 font-mono text-2xl font-bold tracking-widest text-ipcf-deep">
                {tempPasswordResult}
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(tempPasswordResult);
                  setCopiedPass(true);
                }}
                className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-ipcf-border bg-white px-3 py-2.5 text-xs font-bold text-ipcf-deep"
              >
                <Copy className="h-4 w-4" aria-hidden="true" />
                <span>{copiedPass ? "Copiada!" : "Copiar Senha"}</span>
              </button>

              <a
                href={`https://wa.me/55${member.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
                  `Paz do Senhor, ${member.nome_completo.split(" ")[0]}! Redefinimos sua senha do Dados IPCF para os 6 primeiros dígitos do seu CPF (${tempPasswordResult}). Acesse com seu CPF e depois você pode alterar dentro de Minha Ficha.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-ipcf-brand px-3 py-2.5 text-xs font-bold text-white hover:bg-ipcf-deep"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                <span>Enviar no WhatsApp</span>
              </a>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
