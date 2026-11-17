"use client";

import { useState } from "react";
import { Lock, Save, Search } from "lucide-react";
import type { ActionResponse } from "@/actions/auth.actions";
import { FormField } from "@/components/ui/FormControls";
import { fetchViaCepAddress } from "@/lib/geocoding/viacep";
import {
  cleanDigits,
  formatCEP,
  formatCPF,
  formatWhatsApp,
  getMarriageInfo,
  getTodayIsoRecife,
  isValidCPF,
  isValidPastOrTodayDate,
  validateMarriageDate,
} from "@/lib/validations/member.schema";
import {
  DIAS_SEMANA,
  type DiaSemana,
  type EstadoCivil,
  type Family,
  type Member,
  type Sexo,
} from "@/types/database.types";

export interface CivilProfileFormPayload {
  nome_completo: string;
  sexo: Sexo;
  data_nascimento: string;
  naturalidade: string;
  profissao: string;
  whatsapp: string;
  email: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado_civil: EstadoCivil;
  conjuge_congrega_ipcf: boolean;
  nome_conjuge: string;
  conjuge_cpf: string;
  data_casamento: string;
  disponibilidade_dias: DiaSemana[];
  talentos_ministerios: string;
  dificuldade_tempo: string;
  pedido_oracao?: string;
}

interface CivilProfileFormProps {
  mode: "self" | "admin";
  member: Member;
  family: Family | null;
  initialPrayerMotivo?: string;
  submitLabel?: string;
  onSave: (payload: CivilProfileFormPayload) => Promise<ActionResponse<null>>;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
  onCancel?: () => void;
}

const FIELD_DOM_IDS: Record<string, string> = {
  nome_completo: "pf-nome",
  data_nascimento: "pf-nasc",
  whatsapp: "pf-whats",
  email: "pf-email",
  cep: "pf-cep",
  logradouro: "pf-log",
  numero: "pf-num",
  bairro: "pf-bairro",
  cidade: "pf-cidade",
  nome_conjuge: "pf-conjuge-nome",
  data_casamento: "pf-casamento",
  conjuge_cpf: "pf-conjuge-cpf",
};

export function CivilProfileForm({
  mode,
  member,
  family,
  initialPrayerMotivo = "",
  submitLabel = "Salvar Alterações",
  onSave,
  onSuccess,
  onError,
  onCancel,
}: CivilProfileFormProps) {
  const [nomeCompleto, setNomeCompleto] = useState(member.nome_completo);
  const [sexo, setSexo] = useState<Sexo>(member.sexo);
  const [dataNascimento, setDataNascimento] = useState(member.data_nascimento);
  const [naturalidade, setNaturalidade] = useState(member.naturalidade ?? "");
  const [profissao, setProfissao] = useState(member.profissao ?? "");
  const [whatsapp, setWhatsapp] = useState(formatWhatsApp(member.whatsapp));
  const [email, setEmail] = useState(member.email ?? "");

  const [cep, setCep] = useState(family?.cep ? formatCEP(family.cep) : "");
  const [logradouro, setLogradouro] = useState(family?.logradouro ?? "");
  const [numero, setNumero] = useState(family?.numero ?? "");
  const [complemento, setComplemento] = useState(family?.complemento ?? "");
  const [bairro, setBairro] = useState(family?.bairro ?? "Casa Forte");
  const [cidade, setCidade] = useState(family?.cidade ?? "Recife");
  const [loadingCep, setLoadingCep] = useState(false);
  const [cepNotice, setCepNotice] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [estadoCivil, setEstadoCivil] = useState<EstadoCivil>(member.estado_civil);
  const [conjugeIpcf, setConjugeIpcf] = useState(member.conjuge_congrega_ipcf);
  const [nomeConjuge, setNomeConjuge] = useState(member.nome_conjuge ?? "");
  const [conjugeCpf, setConjugeCpf] = useState(
    member.conjuge_cpf ? formatCPF(member.conjuge_cpf) : ""
  );
  const [dataCasamento, setDataCasamento] = useState(family?.data_casamento ?? "");

  const [disponibilidade, setDisponibilidade] = useState<DiaSemana[]>(
    (member.disponibilidade_dias ?? []) as DiaSemana[]
  );
  const [talentos, setTalentos] = useState(member.talentos_ministerios ?? "");
  const [dificuldadeTempo, setDificuldadeTempo] = useState(
    member.dificuldade_tempo ?? ""
  );
  const [pedidoOracao, setPedidoOracao] = useState(initialPrayerMotivo);

  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [inlineFeedback, setInlineFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const todayIso = getTodayIsoRecife();

  function clearFieldError(field: string) {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
    if (inlineFeedback) setInlineFeedback(null);
  }

  async function lookupCep(rawCep: string) {
    const digits = cleanDigits(rawCep);
    if (digits.length !== 8) return;
    setLoadingCep(true);
    setCepNotice(null);
    const result = await fetchViaCepAddress(digits);
    setLoadingCep(false);

    if (!result.ok) {
      setCepNotice({ type: "error", text: result.notice });
      return;
    }

    if (result.logradouro) {
      setLogradouro(result.logradouro);
      clearFieldError("logradouro");
    }
    if (result.bairro) {
      setBairro(result.bairro);
      clearFieldError("bairro");
    }
    if (result.cidade) {
      setCidade(result.cidade);
      clearFieldError("cidade");
    }
    setCepNotice({ type: "success", text: result.notice });
  }

  function toggleDay(day: DiaSemana) {
    setDisponibilidade((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
    if (inlineFeedback) setInlineFeedback(null);
  }

  function validateClientFields(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (nomeCompleto.trim().length < 3) {
      errs.nome_completo = "Informe o nome completo.";
    }
    if (!isValidPastOrTodayDate(dataNascimento)) {
      errs.data_nascimento =
        "Informe uma data de nascimento válida (não pode estar no futuro).";
    }
    const phoneDigits = cleanDigits(whatsapp);
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      errs.whatsapp = "WhatsApp inválido. Use DDD + número.";
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = "E-mail inválido.";
    }

    const cepDigits = cleanDigits(cep);
    if (cepDigits.length > 0 && cepDigits.length !== 8) {
      errs.cep = "CEP deve ter 8 dígitos.";
    }
    if (logradouro.trim().length < 2) {
      errs.logradouro = "Informe o logradouro.";
    }
    if (numero.trim().length < 1) {
      errs.numero = "Informe o número.";
    }
    if (bairro.trim().length < 2) {
      errs.bairro = "Informe o bairro.";
    }
    if (cidade.trim().length < 2) {
      errs.cidade = "Informe a cidade.";
    }

    if (estadoCivil === "Casado(a)") {
      if (nomeConjuge.trim().length < 2) {
        errs.nome_conjuge = "Informe o nome do cônjuge.";
      }
      const marriageErr = validateMarriageDate(dataCasamento, dataNascimento);
      if (marriageErr) {
        errs.data_casamento = marriageErr;
      }
      if (conjugeIpcf && conjugeCpf.trim()) {
        if (!isValidCPF(conjugeCpf)) {
          errs.conjuge_cpf = "CPF do cônjuge inválido.";
        } else if (cleanDigits(conjugeCpf) === cleanDigits(member.cpf)) {
          errs.conjuge_cpf = "O CPF do cônjuge não pode ser igual ao próprio CPF.";
        }
      }
    }

    return errs;
  }

  function focusFirstErrorField(errs: Record<string, string>) {
    const firstKey = Object.keys(errs)[0];
    if (!firstKey) return;
    const domId = FIELD_DOM_IDS[firstKey];
    if (domId) {
      requestAnimationFrame(() => {
        document.getElementById(domId)?.focus();
      });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setInlineFeedback(null);

    const clientErrors = validateClientFields();
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      const firstMsg =
        Object.values(clientErrors)[0] ?? "Revise os campos destacados.";
      setInlineFeedback({ type: "error", text: firstMsg });
      onError?.(firstMsg);
      focusFirstErrorField(clientErrors);
      return;
    }

    setFieldErrors({});
    setSaving(true);

    const payload: CivilProfileFormPayload = {
      nome_completo: nomeCompleto,
      sexo,
      data_nascimento: dataNascimento,
      naturalidade,
      profissao,
      whatsapp,
      email,
      cep,
      logradouro,
      numero,
      complemento,
      bairro,
      cidade,
      estado_civil: estadoCivil,
      conjuge_congrega_ipcf: conjugeIpcf,
      nome_conjuge: nomeConjuge,
      conjuge_cpf: conjugeCpf,
      data_casamento: dataCasamento,
      disponibilidade_dias: disponibilidade,
      talentos_ministerios: talentos,
      dificuldade_tempo: dificuldadeTempo,
      ...(mode === "self" ? { pedido_oracao: pedidoOracao } : {}),
    };

    const res = await onSave(payload);
    setSaving(false);

    if (!res.ok) {
      if (res.fieldErrors) {
        setFieldErrors(res.fieldErrors);
        focusFirstErrorField(res.fieldErrors);
      }
      setInlineFeedback({ type: "error", text: res.error });
      onError?.(res.error);
      return;
    }

    const okMsg = res.message ?? "Dados atualizados com sucesso!";
    setInlineFeedback({ type: "success", text: okMsg });
    onSuccess?.(okMsg);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <section className="rounded-2xl border border-ipcf-border bg-white p-5 shadow-xs sm:p-6">
        <h2 className="border-b border-ipcf-border pb-3 font-serif text-lg font-bold text-ipcf-deep">
          Dados Pessoais e Contato
        </h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <FormField
            id="pf-nome"
            label="Nome completo"
            required
            error={fieldErrors.nome_completo}
          >
            <input
              id="pf-nome"
              type="text"
              autoComplete={mode === "self" ? "name" : "off"}
              value={nomeCompleto}
              onChange={(e) => {
                setNomeCompleto(e.target.value);
                clearFieldError("nome_completo");
              }}
              aria-invalid={Boolean(fieldErrors.nome_completo)}
              className="ipcf-input"
            />
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField
              id="pf-nasc"
              label="Nascimento"
              required
              error={fieldErrors.data_nascimento}
            >
              <input
                id="pf-nasc"
                type="date"
                max={todayIso}
                value={dataNascimento}
                onChange={(e) => {
                  setDataNascimento(e.target.value);
                  clearFieldError("data_nascimento");
                }}
                aria-invalid={Boolean(fieldErrors.data_nascimento)}
                className="ipcf-input"
              />
            </FormField>

            <fieldset className="space-y-1.5">
              <legend className="text-sm font-semibold text-ipcf-ink">Sexo</legend>
              <div className="grid grid-cols-2 gap-1.5">
                {(["Masculino", "Feminino"] as const).map((opt) => (
                  <label
                    key={opt}
                    className={`flex cursor-pointer items-center justify-center rounded-xl border py-2.5 text-xs font-bold ${
                      sexo === opt
                        ? "border-ipcf-brand bg-ipcf-brand text-white"
                        : "border-ipcf-border bg-white text-ipcf-ink"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`pf-sexo-${mode}`}
                      checked={sexo === opt}
                      onChange={() => setSexo(opt)}
                      className="sr-only"
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <FormField id="pf-nat" label="Naturalidade" error={fieldErrors.naturalidade}>
            <input
              id="pf-nat"
              type="text"
              value={naturalidade}
              onChange={(e) => {
                setNaturalidade(e.target.value);
                clearFieldError("naturalidade");
              }}
              className="ipcf-input"
            />
          </FormField>

          <FormField
            id="pf-prof"
            label="Profissão / Ocupação"
            error={fieldErrors.profissao}
          >
            <input
              id="pf-prof"
              type="text"
              value={profissao}
              onChange={(e) => {
                setProfissao(e.target.value);
                clearFieldError("profissao");
              }}
              className="ipcf-input"
            />
          </FormField>

          <FormField
            id="pf-whats"
            label="WhatsApp"
            required
            error={fieldErrors.whatsapp}
          >
            <input
              id="pf-whats"
              type="tel"
              value={whatsapp}
              onChange={(e) => {
                setWhatsapp(formatWhatsApp(e.target.value));
                clearFieldError("whatsapp");
              }}
              aria-invalid={Boolean(fieldErrors.whatsapp)}
              className="ipcf-input"
            />
          </FormField>

          <FormField
            id="pf-email"
            label="E-mail (opcional)"
            error={fieldErrors.email}
          >
            <input
              id="pf-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearFieldError("email");
              }}
              aria-invalid={Boolean(fieldErrors.email)}
              className="ipcf-input"
            />
          </FormField>
        </div>
      </section>

      {/* Endereço do Lar Compartilhado */}
      <section className="rounded-2xl border border-ipcf-border bg-white p-5 shadow-xs sm:p-6">
        <h2 className="border-b border-ipcf-border pb-3 font-serif text-lg font-bold text-ipcf-deep">
          Endereço do Lar
        </h2>
        <div className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-[180px_1fr] sm:items-end">
            <FormField id="pf-cep" label="CEP" error={fieldErrors.cep}>
              <input
                id="pf-cep"
                type="text"
                inputMode="numeric"
                value={cep}
                onChange={(e) => {
                  const fmt = formatCEP(e.target.value);
                  setCep(fmt);
                  setCepNotice(null);
                  clearFieldError("cep");
                  if (cleanDigits(fmt).length === 8) void lookupCep(fmt);
                }}
                aria-invalid={Boolean(fieldErrors.cep)}
                className="ipcf-input"
              />
            </FormField>
            <button
              type="button"
              onClick={() => void lookupCep(cep)}
              disabled={loadingCep || cleanDigits(cep).length !== 8}
              className="inline-flex cursor-pointer items-center gap-1.5 self-start rounded-xl border border-ipcf-border bg-ipcf-bg px-3.5 py-2.5 text-xs font-semibold text-ipcf-deep disabled:opacity-50 sm:self-end"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              <span>{loadingCep ? "Buscando..." : "Buscar CEP"}</span>
            </button>
          </div>

          {cepNotice && (
            <p
              role={cepNotice.type === "error" ? "alert" : "status"}
              className={`text-xs font-medium ${
                cepNotice.type === "error"
                  ? "text-ipcf-danger"
                  : "text-ipcf-brand"
              }`}
            >
              {cepNotice.text}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-[1fr_130px]">
            <FormField
              id="pf-log"
              label="Logradouro"
              required
              error={fieldErrors.logradouro}
            >
              <input
                id="pf-log"
                type="text"
                value={logradouro}
                onChange={(e) => {
                  setLogradouro(e.target.value);
                  clearFieldError("logradouro");
                }}
                aria-invalid={Boolean(fieldErrors.logradouro)}
                className="ipcf-input"
              />
            </FormField>
            <FormField
              id="pf-num"
              label="Número"
              required
              error={fieldErrors.numero}
            >
              <input
                id="pf-num"
                type="text"
                value={numero}
                onChange={(e) => {
                  setNumero(e.target.value);
                  clearFieldError("numero");
                }}
                aria-invalid={Boolean(fieldErrors.numero)}
                className="ipcf-input"
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <FormField
              id="pf-comp"
              label="Complemento"
              error={fieldErrors.complemento}
            >
              <input
                id="pf-comp"
                type="text"
                value={complemento}
                onChange={(e) => {
                  setComplemento(e.target.value);
                  clearFieldError("complemento");
                }}
                className="ipcf-input"
              />
            </FormField>
            <FormField
              id="pf-bairro"
              label="Bairro"
              required
              error={fieldErrors.bairro}
            >
              <input
                id="pf-bairro"
                type="text"
                value={bairro}
                onChange={(e) => {
                  setBairro(e.target.value);
                  clearFieldError("bairro");
                }}
                aria-invalid={Boolean(fieldErrors.bairro)}
                className="ipcf-input"
              />
            </FormField>
            <FormField
              id="pf-cidade"
              label="Cidade"
              required
              error={fieldErrors.cidade}
            >
              <input
                id="pf-cidade"
                type="text"
                value={cidade}
                onChange={(e) => {
                  setCidade(e.target.value);
                  clearFieldError("cidade");
                }}
                aria-invalid={Boolean(fieldErrors.cidade)}
                className="ipcf-input"
              />
            </FormField>
          </div>
        </div>
      </section>

      {/* Casamento, Disponibilidade e (no modo membro) Pedido de Oração */}
      <section className="rounded-2xl border border-ipcf-border bg-white p-5 shadow-xs sm:p-6">
        <h2 className="border-b border-ipcf-border pb-3 font-serif text-lg font-bold text-ipcf-deep">
          {mode === "self"
            ? "Família, Ministérios e Oração Confidencial"
            : "Estado Civil, Cônjuge & Ministérios"}
        </h2>

        <div className="mt-4 space-y-5">
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-ipcf-ink">Estado civil</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(["Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)"] as const).map(
                (opt) => (
                  <label
                    key={opt}
                    className={`flex cursor-pointer items-center justify-center rounded-xl border px-3 py-2 text-xs font-bold ${
                      estadoCivil === opt
                        ? "border-ipcf-brand bg-ipcf-brand text-white"
                        : "border-ipcf-border bg-white text-ipcf-ink"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`pf-civil-${mode}`}
                      checked={estadoCivil === opt}
                      onChange={() => {
                        setEstadoCivil(opt);
                        clearFieldError("nome_conjuge");
                        clearFieldError("conjuge_cpf");
                        clearFieldError("data_casamento");
                      }}
                      className="sr-only"
                    />
                    <span>{opt}</span>
                  </label>
                )
              )}
            </div>
          </fieldset>

          {estadoCivil === "Casado(a)" && (
            <div className="grid gap-4 rounded-xl bg-ipcf-bg p-4 sm:grid-cols-2">
              <FormField
                id="pf-conjuge-nome"
                label="Nome do cônjuge"
                required
                error={fieldErrors.nome_conjuge}
              >
                <input
                  id="pf-conjuge-nome"
                  type="text"
                  value={nomeConjuge}
                  onChange={(e) => {
                    setNomeConjuge(e.target.value);
                    clearFieldError("nome_conjuge");
                  }}
                  aria-invalid={Boolean(fieldErrors.nome_conjuge)}
                  className="ipcf-input"
                />
              </FormField>
              <FormField
                id="pf-casamento"
                label="Data do casamento (Aniversário / Bodas)"
                hint="Usada para acompanhar e celebrar as bodas do casal na IPCF."
                error={fieldErrors.data_casamento}
              >
                <input
                  id="pf-casamento"
                  type="date"
                  max={todayIso}
                  value={dataCasamento}
                  onChange={(e) => {
                    setDataCasamento(e.target.value);
                    clearFieldError("data_casamento");
                  }}
                  aria-invalid={Boolean(fieldErrors.data_casamento)}
                  className="ipcf-input"
                />
                {(() => {
                  if (!dataCasamento || validateMarriageDate(dataCasamento, dataNascimento)) {
                    return null;
                  }
                  const info = getMarriageInfo(dataCasamento);
                  if (!info) return null;
                  return (
                    <p className="mt-1.5 inline-flex flex-wrap items-center gap-1.5 rounded-full border border-ipcf-gold/50 bg-ipcf-gold-soft/25 px-2.5 py-1 text-xs font-semibold text-ipcf-deep">
                      <span>
                        💍 {info.yearsCompleted > 0 ? `${info.yearsCompleted} anos · ` : ""}
                        {info.bodasLabel}
                      </span>
                      {info.isWeek && (
                        <span className="rounded-full bg-ipcf-gold px-2 py-0.5 text-[10px] font-bold text-white">
                          {info.isToday ? "Bodas hoje!" : "Bodas nesta semana!"}
                        </span>
                      )}
                    </p>
                  );
                })()}
              </FormField>
              <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-ipcf-deep sm:col-span-2">
                <input
                  type="checkbox"
                  checked={conjugeIpcf}
                  onChange={(e) => {
                    setConjugeIpcf(e.target.checked);
                    clearFieldError("conjuge_cpf");
                  }}
                  className="h-4 w-4 accent-ipcf-brand"
                />
                <span>
                  {mode === "self"
                    ? "Meu cônjuge também congrega na IPCF"
                    : "Cônjuge também congrega na IPCF"}
                </span>
              </label>
              {conjugeIpcf && (
                <FormField
                  id="pf-conjuge-cpf"
                  label="CPF do cônjuge"
                  hint="Ao preencher o CPF de quem já está no Dados IPCF, o lar e o vínculo conjugal serão sincronizados."
                  error={fieldErrors.conjuge_cpf}
                >
                  <input
                    id="pf-conjuge-cpf"
                    type="text"
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                    value={conjugeCpf}
                    onChange={(e) => {
                      setConjugeCpf(formatCPF(e.target.value));
                      clearFieldError("conjuge_cpf");
                    }}
                    aria-invalid={Boolean(fieldErrors.conjuge_cpf)}
                    className="ipcf-input"
                  />
                </FormField>
              )}
            </div>
          )}

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-ipcf-ink">
              Disponibilidade semanal na igreja
            </legend>
            <div className="flex flex-wrap gap-2">
              {DIAS_SEMANA.map((day) => (
                <label
                  key={day}
                  className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${
                    disponibilidade.includes(day)
                      ? "border-ipcf-brand bg-ipcf-brand text-white"
                      : "border-ipcf-border bg-white text-ipcf-ink"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={disponibilidade.includes(day)}
                    onChange={() => toggleDay(day)}
                    className="sr-only"
                  />
                  <span>{day}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="pf-talentos" label="Talentos e Ministérios">
              <textarea
                id="pf-talentos"
                rows={3}
                value={talentos}
                onChange={(e) => setTalentos(e.target.value)}
                className="ipcf-input"
              />
            </FormField>
            <FormField id="pf-dif" label="Maior dificuldade de horário">
              <textarea
                id="pf-dif"
                rows={3}
                value={dificuldadeTempo}
                onChange={(e) => setDificuldadeTempo(e.target.value)}
                className="ipcf-input"
              />
            </FormField>
          </div>

          {mode === "self" && (
            <div className="rounded-xl border border-ipcf-gold/50 bg-ipcf-gold-soft/15 p-4">
              <FormField
                id="pf-oracao"
                label="Meu Pedido de Oração Atual"
                hint="Sigilo 1:1 — visível apenas para você e para os pastores da IPCF (nem seu cônjuge acessa)."
              >
                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-ipcf-deep">
                  <Lock className="h-3.5 w-3.5 text-ipcf-brand" aria-hidden="true" />
                  <span>Pedido sigiloso</span>
                </div>
                <textarea
                  id="pf-oracao"
                  rows={3}
                  value={pedidoOracao}
                  onChange={(e) => setPedidoOracao(e.target.value)}
                  placeholder="Atualize aqui seu motivo de oração sempre que desejar..."
                  className="ipcf-input"
                />
              </FormField>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-ipcf-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-h-5">
            {inlineFeedback && (
              <p
                role={inlineFeedback.type === "error" ? "alert" : "status"}
                className={`text-xs font-bold ${
                  inlineFeedback.type === "error"
                    ? "text-ipcf-danger"
                    : "text-ipcf-brand"
                }`}
              >
                {inlineFeedback.text}
              </p>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={saving}
                className="inline-flex w-full cursor-pointer items-center justify-center rounded-xl border border-ipcf-border bg-white px-4 py-2.5 text-xs font-bold text-ipcf-ink hover:bg-ipcf-bg sm:w-auto"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-ipcf-brand px-6 py-3 text-sm font-bold text-white shadow-xs transition hover:bg-ipcf-deep disabled:opacity-60 sm:w-auto sm:py-2.5"
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              <span>{saving ? "Salvando..." : submitLabel}</span>
            </button>
          </div>
        </div>
      </section>
    </form>
  );
}
