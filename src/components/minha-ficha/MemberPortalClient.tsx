"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Copy,
  KeyRound,
  MessageCircle,
  Plus,
  Share2,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { updateMyProfileAction } from "@/actions/member.actions";
import {
  addDependentAction,
  createChildInviteAction,
  removeDependentAction,
} from "@/actions/family.actions";
import { changeOwnPasswordAction } from "@/actions/auth.actions";
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
import type {
  Dependent,
  Family,
  Member,
  PrayerRequest,
} from "@/types/database.types";
import {
  calculateAge,
  formatCPF,
  formatDateBR,
  getMarriageInfo,
  getTodayIsoRecife,
  isValidPastOrTodayDate,
} from "@/lib/validations/member.schema";

interface MemberPortalClientProps {
  member: Member;
  family: Family | null;
  dependents: Dependent[];
  prayerRequest: PrayerRequest | null;
  parentsNames: string[];
}

export function MemberPortalClient({
  member,
  family,
  dependents: initialDependents,
  prayerRequest,
  parentsNames,
}: MemberPortalClientProps) {
  const router = useRouter();

  const statusBannerRef = useRef<HTMLDivElement | null>(null);
  const [statusBanner, setStatusBanner] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Filhos e Convite Mágico (RN06)
  const [dependents, setDependents] = useState<Dependent[]>(initialDependents);
  const [newDepName, setNewDepName] = useState("");
  const [newDepBirth, setNewDepBirth] = useState("");
  const [addingDep, setAddingDep] = useState(false);
  const [depError, setDepError] = useState("");
  const [confirmRemoveDepId, setConfirmRemoveDepId] = useState<string | null>(null);
  const [removingDepId, setRemovingDepId] = useState<string | null>(null);

  const [inviteModalData, setInviteModalData] = useState<{
    childName: string;
    fullUrl: string;
  } | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const inviteDialogRef = useRef<HTMLDialogElement | null>(null);

  // Troca de senha opcional
  const [newPassword, setNewPassword] = useState("");
  const [passMessage, setPassMessage] = useState<string>("");
  const [savingPass, setSavingPass] = useState(false);

  const todayIso = getTodayIsoRecife();

  function announceStatus(type: "success" | "error", text: string, scroll = true) {
    setStatusBanner({ type, text });
    if (scroll) {
      requestAnimationFrame(() => {
        statusBannerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        statusBannerRef.current?.focus();
      });
    }
  }

  async function handleSaveProfile(payload: CivilProfileFormPayload) {
    const res = await updateMyProfileAction(payload);
    if (res.ok) {
      router.refresh();
    }
    return res;
  }

  async function handleAddDependent() {
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
    const res = await addDependentAction({
      nome: newDepName,
      data_nascimento: newDepBirth,
    });
    setAddingDep(false);

    if (!res.ok) {
      setDepError(res.error);
      return;
    }

    setDependents((prev) => [...prev, res.data]);
    setNewDepName("");
    setNewDepBirth("");
    announceStatus("success", res.message ?? `${res.data.nome} adicionado(a) à família.`, false);
    router.refresh();
  }

  async function handleRemoveDependent(depId: string) {
    setRemovingDepId(depId);
    const res = await removeDependentAction(depId);
    setRemovingDepId(null);
    setConfirmRemoveDepId(null);

    if (!res.ok) {
      announceStatus("error", res.error);
      return;
    }
    setDependents((prev) => prev.filter((d) => d.id !== depId));
    announceStatus("success", "Dependente removido da lista familiar.", false);
    router.refresh();
  }

  async function handleGenerateInvite(depId: string) {
    const res = await createChildInviteAction(depId);
    if (!res.ok) {
      setStatusBanner({ type: "error", text: res.error });
      return;
    }

    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    setInviteModalData({
      childName: res.data.childName,
      fullUrl: `${origin}${res.data.invitePath}`,
    });
    setCopiedInvite(false);
    inviteDialogRef.current?.showModal();
  }

  async function copyInviteUrl() {
    if (!inviteModalData) return;
    await navigator.clipboard.writeText(inviteModalData.fullUrl);
    setCopiedInvite(true);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setSavingPass(true);
    setPassMessage("");
    const res = await changeOwnPasswordAction(newPassword);
    setSavingPass(false);
    if (!res.ok) {
      setPassMessage(res.error);
      return;
    }
    setNewPassword("");
    setPassMessage("Senha alterada com sucesso!");
  }

  const whatsappInviteHref = inviteModalData
    ? `https://wa.me/?text=${encodeURIComponent(
        `Olá ${inviteModalData.childName}! Criei seu acesso próprio no Dados IPCF. Acesse este link único para preencher sua ficha: ${inviteModalData.fullUrl}`
      )}`
    : "#";

  const marriageInfo =
    member.estado_civil === "Casado(a)"
      ? getMarriageInfo(family?.data_casamento)
      : null;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      {/* Cabeçalho da Ficha do Membro */}
      <section className="flex flex-col justify-between gap-4 rounded-2xl border border-ipcf-border bg-white p-5 shadow-xs sm:flex-row sm:items-center sm:p-6">
        <div className="flex items-center gap-4">
          <MemberAvatar name={member.nome_completo} size="lg" />
          <div>
            <h1 className="font-serif text-xl font-bold text-ipcf-deep sm:text-2xl">
              {member.nome_completo}
            </h1>
            <p className="text-xs font-medium text-ipcf-muted">
              CPF: {formatCPF(member.cpf)} · Nascimento: {formatDateBR(member.data_nascimento)} ({calculateAge(member.data_nascimento)} anos)
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <MembresiaBadge status={member.status_membresia} />
              <OficiatoBadge oficiato={member.oficiato} />
              <CadastroStatusBadge status={member.status_cadastro} />
              {marriageInfo && (
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                    marriageInfo.isWeek
                      ? "border-ipcf-gold bg-ipcf-gold-soft/35 text-ipcf-deep"
                      : "border-rose-200 bg-rose-50 text-rose-900"
                  }`}
                >
                  💍{" "}
                  {marriageInfo.isWeek
                    ? `${marriageInfo.isToday ? "Bodas hoje" : "Bodas esta semana"} · ${marriageInfo.weekBodasLabel} (${marriageInfo.weekYears} ${marriageInfo.weekYears === 1 ? "ano" : "anos"})`
                    : marriageInfo.yearsCompleted > 0
                      ? `${marriageInfo.yearsCompleted} ${marriageInfo.yearsCompleted === 1 ? "ano" : "anos"} de casados · ${marriageInfo.bodasLabel}`
                      : marriageInfo.bodasLabel}
                </span>
              )}
            </div>
          </div>
        </div>

        <aside className="rounded-xl border border-ipcf-border bg-ipcf-bg px-4 py-3 text-xs text-ipcf-muted sm:max-w-xs">
          <strong className="block text-ipcf-deep">Situação Eclesiástica</strong>
          A alteração oficial de membresia ou oficialato é realizada exclusivamente pela liderança pastoral e Secretaria da IPCF.
          {parentsNames.length > 0 && (
            <p className="mt-1 text-ipcf-brand font-medium">
              Pais vinculados: {parentsNames.join(" & ")}
            </p>
          )}
        </aside>
      </section>

      {statusBanner && (
        <div
          ref={statusBannerRef}
          tabIndex={-1}
          role={statusBanner.type === "error" ? "alert" : "status"}
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold focus:outline-none ${
            statusBanner.type === "success"
              ? "border-emerald-300 bg-emerald-50 text-ipcf-deep"
              : "border-ipcf-danger/30 bg-ipcf-danger-bg text-ipcf-danger"
          }`}
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{statusBanner.text}</span>
        </div>
      )}

      {/* Formulário Civil Editável pelo Próprio Membro (RN03) */}
      <CivilProfileForm
        mode="self"
        member={member}
        family={family}
        initialPrayerMotivo={prayerRequest?.motivo ?? ""}
        submitLabel="Salvar Alterações"
        onSave={handleSaveProfile}
        onSuccess={(msg) => announceStatus("success", msg, false)}
        onError={(msg) => announceStatus("error", msg, true)}
      />

      {/* Seção de Filhos & Emancipação com Link Mágico (RN06) */}
      <section className="rounded-2xl border border-ipcf-border bg-white p-5 shadow-xs sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ipcf-border pb-3">
          <div>
            <h2 className="flex items-center gap-2 font-serif text-lg font-bold text-ipcf-deep">
              <Users className="h-5 w-5 text-ipcf-brand" aria-hidden="true" />
              <span>Filhos e Dependentes no Lar</span>
            </h2>
            <p className="text-xs text-ipcf-muted">
              Quando um filho já tiver celular ou autonomia para preencher sua própria ficha, clique em &ldquo;Liberar Acesso Próprio&rdquo;.
            </p>
          </div>
        </div>

        <ul className="mt-4 space-y-2.5">
          {dependents.length === 0 ? (
            <li className="rounded-xl bg-ipcf-bg px-4 py-3 text-xs text-ipcf-muted">
              Nenhum filho/dependente listado nesta família ainda.
            </li>
          ) : (
            dependents.map((dep) => (
              <li
                key={dep.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ipcf-border bg-ipcf-bg/40 p-3.5"
              >
                <div>
                  <p className="text-sm font-bold text-ipcf-deep">{dep.nome}</p>
                  <p className="text-xs text-ipcf-muted">
                    Nascimento: {formatDateBR(dep.data_nascimento)} ({calculateAge(dep.data_nascimento)} anos)
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {dep.promovido_membro_id ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-ipcf-deep">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Já possui conta própria</span>
                    </span>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => void handleGenerateInvite(dep.id)}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-ipcf-gold-soft/45 px-3 py-2 text-xs font-bold text-ipcf-deep transition hover:bg-ipcf-gold-soft"
                      >
                        <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Liberar Acesso Próprio</span>
                      </button>

                      {confirmRemoveDepId === dep.id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={removingDepId === dep.id}
                            onClick={() => void handleRemoveDependent(dep.id)}
                            className="cursor-pointer rounded-xl bg-ipcf-danger px-2.5 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-60"
                          >
                            {removingDepId === dep.id ? "Excluindo..." : "Confirmar exclusão"}
                          </button>
                          <button
                            type="button"
                            disabled={removingDepId === dep.id}
                            onClick={() => setConfirmRemoveDepId(null)}
                            className="cursor-pointer rounded-xl border border-ipcf-border bg-white px-2.5 py-1.5 text-xs font-semibold text-ipcf-ink hover:bg-ipcf-bg"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmRemoveDepId(dep.id)}
                          aria-label={`Remover ${dep.nome}`}
                          className="inline-flex cursor-pointer items-center rounded-xl border border-red-200 bg-white p-2 text-ipcf-danger hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </li>
            ))
          )}
        </ul>

        <div className="mt-4 space-y-2 rounded-xl border border-dashed border-ipcf-border bg-ipcf-bg/40 p-3.5">
          <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
            <FormField id="new-dep-name" label="Adicionar novo filho(a)">
              <input
                id="new-dep-name"
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
            <FormField id="new-dep-birth" label="Nascimento">
              <input
                id="new-dep-birth"
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
              onClick={() => void handleAddDependent()}
              className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-ipcf-deep px-4 py-2.5 text-xs font-bold text-white hover:bg-ipcf-brand disabled:opacity-50"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>{addingDep ? "Salvando..." : "Adicionar"}</span>
            </button>
          </div>
          {depError && (
            <p role="alert" className="text-xs font-semibold text-ipcf-danger">
              {depError}
            </p>
          )}
        </div>
      </section>

      {/* Segurança da Conta — Troca de Senha */}
      <section className="rounded-2xl border border-ipcf-border bg-white p-5 shadow-xs sm:p-6">
        <h2 className="flex items-center gap-2 font-serif text-lg font-bold text-ipcf-deep">
          <KeyRound className="h-5 w-5 text-ipcf-brand" aria-hidden="true" />
          <span>Segurança e Senha</span>
        </h2>
        <p className="mt-1 text-xs text-ipcf-muted">
          Deseja definir uma nova senha pessoal (ou trocar a senha temporária gerada pela Secretaria)?
        </p>

        <form
          onSubmit={handleChangePassword}
          className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <div className="flex-1 max-w-sm">
            <FormField id="pf-new-pass" label="Nova senha (mínimo 6 caracteres)">
              <input
                id="pf-new-pass"
                type="password"
                autoComplete="new-password"
                placeholder="Digite sua nova senha"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="ipcf-input"
              />
            </FormField>
          </div>
          <button
            type="submit"
            disabled={savingPass || newPassword.length < 6}
            className="inline-flex w-full cursor-pointer items-center justify-center rounded-xl border border-ipcf-border bg-ipcf-bg px-4 py-3 text-xs font-bold text-ipcf-deep hover:bg-stone-200/70 disabled:opacity-50 sm:w-auto sm:py-2.5"
          >
            {savingPass ? "Atualizando..." : "Atualizar Senha"}
          </button>
          {passMessage && (
            <span className="text-xs font-semibold text-ipcf-brand">{passMessage}</span>
          )}
        </form>
      </section>

      {/* Dialog nativo acessível (.showModal()) para enviar link mágico ao filho */}
      <dialog
        ref={inviteDialogRef}
        aria-labelledby="invite-dialog-title"
        className="ipcf-dialog m-auto w-full max-w-md rounded-2xl border border-ipcf-border bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-ipcf-deep">
            <Share2 className="h-5 w-5 text-ipcf-brand" aria-hidden="true" />
            <h3 id="invite-dialog-title" className="font-serif text-lg font-bold">
              Link Exclusivo Gerado!
            </h3>
          </div>
          <button
            type="button"
            onClick={() => inviteDialogRef.current?.close()}
            aria-label="Fechar janela"
            className="cursor-pointer rounded-lg p-1 text-ipcf-muted hover:bg-ipcf-bg"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <p className="mt-2 text-sm text-ipcf-muted">
          Envie o link abaixo para <strong className="text-ipcf-deep">{inviteModalData?.childName}</strong> preencher a própria ficha (válido por 7 dias, uso único):
        </p>

        <div className="mt-3 rounded-xl border border-ipcf-border bg-ipcf-bg p-3 text-xs font-mono break-all text-ipcf-deep">
          {inviteModalData?.fullUrl}
        </div>

        <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
          <button
            type="button"
            onClick={() => void copyInviteUrl()}
            className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-ipcf-border bg-white px-4 py-2.5 text-xs font-bold text-ipcf-deep hover:bg-ipcf-bg"
          >
            <Copy className="h-4 w-4" aria-hidden="true" />
            <span>{copiedInvite ? "Link Copiado!" : "Copiar Link"}</span>
          </button>

          <a
            href={whatsappInviteHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-ipcf-brand px-4 py-2.5 text-xs font-bold text-white hover:bg-ipcf-deep"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            <span>Enviar no WhatsApp</span>
          </a>
        </div>
      </dialog>
    </div>
  );
}
