"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Home,
  Lock,
  Search,
  Sparkles,
} from "lucide-react";
import { completeChildInviteAction } from "@/actions/family.actions";
import type { InviteContextData } from "@/actions/family.actions";
import { FormField } from "@/components/ui/FormControls";
import { fetchViaCepAddress } from "@/lib/geocoding/viacep";
import {
  DIAS_SEMANA,
  type DiaSemana,
  type EstadoCivil,
  type Sexo,
  type StatusMembresia,
} from "@/types/database.types";
import {
  OFFICIAL_LGPD_TEXT,
  cleanDigits,
  formatCEP,
  formatCPF,
  formatDateBR,
  formatWhatsApp,
  getMarriageInfo,
  getTodayIsoRecife,
  isValidCPF,
  validateMarriageDate,
} from "@/lib/validations/member.schema";

export function InviteCompletionClient({
  context,
}: {
  context: InviteContextData;
}) {
  const router = useRouter();
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [sexo, setSexo] = useState<Sexo | "">("");
  const [naturalidade, setNaturalidade] = useState("");
  const [profissao, setProfissao] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [estadoCivil, setEstadoCivil] = useState<EstadoCivil>("Solteiro(a)");
  const [conjugeIpcf, setConjugeIpcf] = useState(false);
  const [nomeConjuge, setNomeConjuge] = useState("");
  const [conjugeCpf, setConjugeCpf] = useState("");
  const [dataCasamento, setDataCasamento] = useState("");

  const [moraComPais, setMoraComPais] = useState<boolean>(true);
  const [cep, setCep] = useState("");
  const [logradouro, setLogradouro] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("Recife");
  const [loadingCep, setLoadingCep] = useState(false);
  const [cepNotice, setCepNotice] = useState<{
    type: "ok" | "error";
    text: string;
  } | null>(null);

  const [statusMembresia, setStatusMembresia] = useState<StatusMembresia>(
    "Membro Comungante"
  );
  const [disponibilidade, setDisponibilidade] = useState<DiaSemana[]>([]);
  const [talentos, setTalentos] = useState("");
  const [dificuldadeTempo, setDificuldadeTempo] = useState("");
  const [pedidoOracao, setPedidoOracao] = useState("");
  const [consentimentoLgpd, setConsentimentoLgpd] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const errorRef = useRef<HTMLDivElement | null>(null);

  async function handleLookupCep(rawCep: string) {
    if (cleanDigits(rawCep).length !== 8) return;
    setLoadingCep(true);
    setCepNotice(null);
    const result = await fetchViaCepAddress(rawCep);
    setLoadingCep(false);

    if (!result.ok) {
      setCepNotice({ type: "error", text: result.notice });
      return;
    }

    if (result.logradouro) setLogradouro(result.logradouro);
    if (result.bairro) setBairro(result.bairro);
    if (result.cidade) setCidade(result.cidade);
    setErrors((prev) => ({
      ...prev,
      cep: "",
      logradouro: "",
      bairro: "",
      cidade: "",
    }));
    setCepNotice({
      type: "ok",
      text: result.notice,
    });
  }

  function toggleDay(day: DiaSemana) {
    setDisponibilidade((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErr: Record<string, string> = {};

    if (!isValidCPF(cpf)) nextErr.cpf = "Informe um CPF válido com 11 dígitos.";
    if (password.length < 6) {
      nextErr.password = "Crie uma senha com pelo menos 6 caracteres.";
    }
    if (!sexo) nextErr.sexo = "Selecione o sexo.";
    const phoneDigits = cleanDigits(whatsapp);
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      nextErr.whatsapp = "Informe seu WhatsApp com DDD.";
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErr.email = "E-mail inválido (ou deixe em branco).";
    }
    if (estadoCivil === "Casado(a)") {
      if (nomeConjuge.trim().length < 2) {
        nextErr.nome_conjuge = "Informe o nome do cônjuge.";
      }
      if (conjugeIpcf && conjugeCpf.trim()) {
        if (!isValidCPF(conjugeCpf)) {
          nextErr.conjuge_cpf = "CPF do cônjuge inválido.";
        } else if (cleanDigits(conjugeCpf) === cleanDigits(cpf)) {
          nextErr.conjuge_cpf = "O CPF do cônjuge não pode ser igual ao seu.";
        }
      }
      const marriageErr = validateMarriageDate(dataCasamento, context.childBirthDate);
      if (marriageErr) {
        nextErr.data_casamento = marriageErr;
      }
    }
    if (!moraComPais) {
      const cepDigits = cleanDigits(cep);
      if (cepDigits.length > 0 && cepDigits.length !== 8) {
        nextErr.cep = "CEP deve conter 8 dígitos (ou ficar em branco).";
      }
      if (logradouro.trim().length < 2) nextErr.logradouro = "Informe o logradouro.";
      if (numero.trim().length < 1) nextErr.numero = "Informe o número.";
      if (bairro.trim().length < 2) nextErr.bairro = "Informe o bairro.";
      if (cidade.trim().length < 2) nextErr.cidade = "Informe a cidade.";
    }
    if (!consentimentoLgpd) {
      nextErr.consentimento_lgpd = "Aceite o termo da LGPD para finalizar.";
    }

    if (Object.keys(nextErr).length > 0) {
      setErrors(nextErr);
      setGlobalError("Revise os campos destacados antes de concluir.");
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }

    setSubmitting(true);
    setGlobalError("");

    const res = await completeChildInviteAction({
      token: context.token,
      cpf,
      password,
      sexo,
      naturalidade,
      profissao,
      whatsapp,
      email,
      estado_civil: estadoCivil,
      conjuge_congrega_ipcf: conjugeIpcf,
      nome_conjuge: nomeConjuge,
      conjuge_cpf: conjugeCpf,
      data_casamento: dataCasamento,
      mora_com_pais: moraComPais,
      cep,
      logradouro,
      numero,
      complemento,
      bairro,
      cidade,
      status_membresia: statusMembresia,
      disponibilidade_dias: disponibilidade,
      talentos_ministerios: talentos,
      dificuldade_tempo: dificuldadeTempo,
      pedido_oracao: pedidoOracao,
      consentimento_lgpd: consentimentoLgpd,
    });

    setSubmitting(false);

    if (!res.ok) {
      setGlobalError(res.error);
      if (res.fieldErrors) setErrors(res.fieldErrors);
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }

    router.push(res.data.redirectTo);
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      {/* Boas-vindas com genealogia preservada */}
      <div className="rounded-2xl border border-ipcf-gold/50 bg-white p-6 shadow-xs sm:p-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-ipcf-gold-soft/35 px-3 py-1 text-xs font-bold text-ipcf-deep">
          <Sparkles className="h-3.5 w-3.5 text-ipcf-brand" aria-hidden="true" />
          <span>Convite Familiar · Dados IPCF</span>
        </div>

        <h1 className="mt-3 font-serif text-2xl font-bold text-ipcf-deep sm:text-3xl">
          Olá, {context.childName}!
        </h1>
        <p className="mt-1 text-sm text-ipcf-muted">
          Sua família iniciou seu registro na IPCF. Agora você assume sua própria ficha individual com CPF e senha.
        </p>

        <dl className="mt-4 grid gap-3 rounded-xl bg-ipcf-bg p-4 text-xs sm:grid-cols-3">
          <div>
            <dt className="font-semibold text-ipcf-muted">Nome na Ficha</dt>
            <dd className="mt-0.5 font-bold text-ipcf-deep">{context.childName}</dd>
          </div>
          <div>
            <dt className="font-semibold text-ipcf-muted">Nascimento</dt>
            <dd className="mt-0.5 font-bold text-ipcf-deep">
              {formatDateBR(context.childBirthDate)}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-ipcf-muted">Responsáveis / Pais na IPCF</dt>
            <dd className="mt-0.5 font-bold text-ipcf-deep">
              {context.parentsNames?.length
                ? context.parentsNames.join(" & ")
                : "Família IPCF"}
            </dd>
          </div>
        </dl>
      </div>

      {globalError && (
        <div
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="rounded-xl border border-ipcf-danger/30 bg-ipcf-danger-bg px-4 py-3 text-sm font-medium text-ipcf-danger"
        >
          {globalError}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        noValidate
        className="space-y-6 rounded-2xl border border-ipcf-border bg-white p-6 shadow-sm sm:p-8"
      >
        {/* Acesso e Dados Pessoais */}
        <section className="space-y-4">
          <h2 className="border-b border-ipcf-border pb-2 font-serif text-lg font-bold text-ipcf-deep">
            1. Seu CPF e Dados Pessoais
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="conv-cpf" label="Seu CPF" required error={errors.cpf}>
              <input
                id="conv-cpf"
                type="text"
                inputMode="numeric"
                autoComplete="username"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(e) => {
                  setCpf(formatCPF(e.target.value));
                  setErrors((prev) => ({ ...prev, cpf: "" }));
                }}
                aria-invalid={Boolean(errors.cpf)}
                className="ipcf-input"
              />
            </FormField>

            <FormField
              id="conv-pass"
              label="Crie sua senha pessoal"
              required
              hint="Mínimo 6 dígitos ou caracteres."
              error={errors.password}
            >
              <div className="relative">
                <input
                  id="conv-pass"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrors((prev) => ({ ...prev, password: "" }));
                  }}
                  aria-invalid={Boolean(errors.password)}
                  className="ipcf-input pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-md p-1.5 text-ipcf-muted"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <fieldset className="space-y-1.5">
              <legend className="text-sm font-semibold text-ipcf-ink">
                Sexo <span className="text-ipcf-danger">*</span>
              </legend>
              <div className="grid grid-cols-2 gap-2.5">
                {(["Masculino", "Feminino"] as const).map((option) => (
                  <label
                    key={option}
                    className={`flex cursor-pointer items-center justify-center rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                      sexo === option
                        ? "border-ipcf-brand bg-ipcf-brand text-white"
                        : "border-ipcf-border bg-white text-ipcf-ink"
                    }`}
                  >
                    <input
                      type="radio"
                      name="conv-sexo"
                      value={option}
                      checked={sexo === option}
                      onChange={() => {
                        setSexo(option);
                        setErrors((prev) => ({ ...prev, sexo: "" }));
                      }}
                      className="sr-only"
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
              {errors.sexo && (
                <p role="alert" className="text-xs font-medium text-ipcf-danger">
                  {errors.sexo}
                </p>
              )}
            </fieldset>

            <FormField id="conv-whats" label="Seu WhatsApp" required error={errors.whatsapp}>
              <input
                id="conv-whats"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="(81) 99999-9999"
                value={whatsapp}
                onChange={(e) => {
                  setWhatsapp(formatWhatsApp(e.target.value));
                  setErrors((prev) => ({ ...prev, whatsapp: "" }));
                }}
                aria-invalid={Boolean(errors.whatsapp)}
                className="ipcf-input"
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <FormField id="conv-nat" label="Naturalidade (opcional)">
              <input
                id="conv-nat"
                type="text"
                placeholder="Ex: Recife - PE"
                value={naturalidade}
                onChange={(e) => setNaturalidade(e.target.value)}
                className="ipcf-input"
              />
            </FormField>
            <FormField id="conv-prof" label="Profissão / Curso">
              <input
                id="conv-prof"
                type="text"
                placeholder="Ex: Universitário, Designer"
                value={profissao}
                onChange={(e) => setProfissao(e.target.value)}
                className="ipcf-input"
              />
            </FormField>
            <FormField id="conv-email" label="E-mail (opcional)" error={errors.email}>
              <input
                id="conv-email"
                type="email"
                autoComplete="email"
                placeholder="voce@exemplo.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrors((prev) => ({ ...prev, email: "" }));
                }}
                aria-invalid={Boolean(errors.email)}
                className="ipcf-input"
              />
            </FormField>
          </div>

          <div className="space-y-4 border-t border-ipcf-border pt-4">
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-ipcf-ink">
                Estado civil
              </legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(["Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)"] as const).map(
                  (opt) => (
                    <label
                      key={opt}
                      className={`flex cursor-pointer items-center justify-center rounded-xl border px-3 py-2 text-xs font-bold transition ${
                        estadoCivil === opt
                          ? "border-ipcf-brand bg-ipcf-brand text-white"
                          : "border-ipcf-border bg-white text-ipcf-ink hover:bg-ipcf-bg"
                      }`}
                    >
                      <input
                        type="radio"
                        name="conv-civil"
                        checked={estadoCivil === opt}
                        onChange={() => {
                          setEstadoCivil(opt);
                          setErrors((prev) => ({
                            ...prev,
                            nome_conjuge: "",
                            conjuge_cpf: "",
                            data_casamento: "",
                          }));
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
              <div className="grid gap-4 rounded-2xl border border-ipcf-border bg-ipcf-bg/60 p-4 sm:grid-cols-2">
                <FormField
                  id="conv-conjuge-nome"
                  label="Nome completo do cônjuge"
                  required
                  error={errors.nome_conjuge}
                >
                  <input
                    id="conv-conjuge-nome"
                    type="text"
                    placeholder="Nome do(a) esposo(a)"
                    value={nomeConjuge}
                    onChange={(e) => {
                      setNomeConjuge(e.target.value);
                      setErrors((prev) => ({ ...prev, nome_conjuge: "" }));
                    }}
                    aria-invalid={Boolean(errors.nome_conjuge)}
                    className="ipcf-input"
                  />
                </FormField>

                <FormField
                  id="conv-casamento"
                  label="Data do casamento (Aniversário / Bodas)"
                  hint="Para celebrarmos as bodas do casal na IPCF."
                  error={errors.data_casamento}
                >
                  <input
                    id="conv-casamento"
                    type="date"
                    max={getTodayIsoRecife()}
                    value={dataCasamento}
                    onChange={(e) => {
                      setDataCasamento(e.target.value);
                      setErrors((prev) => ({ ...prev, data_casamento: "" }));
                    }}
                    aria-invalid={Boolean(errors.data_casamento)}
                    className="ipcf-input"
                  />
                  {(() => {
                    if (
                      !dataCasamento ||
                      validateMarriageDate(dataCasamento, context.childBirthDate)
                    ) {
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
                      setErrors((prev) => ({ ...prev, conjuge_cpf: "" }));
                    }}
                    className="h-4 w-4 accent-ipcf-brand"
                  />
                  <span>Meu cônjuge também congrega na IPCF</span>
                </label>

                {conjugeIpcf && (
                  <FormField
                    id="conv-conjuge-cpf"
                    label="CPF do cônjuge (opcional)"
                    hint="Ajuda a vincular os dois perfis se o cônjuge já estiver no Dados IPCF."
                    error={errors.conjuge_cpf}
                  >
                    <input
                      id="conv-conjuge-cpf"
                      type="text"
                      inputMode="numeric"
                      placeholder="000.000.000-00"
                      value={conjugeCpf}
                      onChange={(e) => {
                        setConjugeCpf(formatCPF(e.target.value));
                        setErrors((prev) => ({ ...prev, conjuge_cpf: "" }));
                      }}
                      aria-invalid={Boolean(errors.conjuge_cpf)}
                      className="ipcf-input"
                    />
                  </FormField>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Regra de Emancipação Residencial (RN06) */}
        <section className="space-y-4">
          <h2 className="flex items-center gap-2 border-b border-ipcf-border pb-2 font-serif text-lg font-bold text-ipcf-deep">
            <Home className="h-5 w-5 text-ipcf-brand" aria-hidden="true" />
            <span>2. Residência Atual</span>
          </h2>

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-ipcf-ink">
              Você ainda mora no mesmo endereço dos seus pais?
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                {
                  val: true,
                  title: "Sim, ainda moro com meus pais",
                  desc: context.familyAddress
                    ? `${context.familyAddress.logradouro ?? ""}, ${context.familyAddress.numero ?? ""} — ${context.familyAddress.bairro}`
                    : "Compartilhar o endereço já cadastrado pela família.",
                },
                {
                  val: false,
                  title: "Não, moro em outro endereço",
                  desc: "Informar meu endereço atual (mantendo o vínculo familiar com meus pais).",
                },
              ].map((opt) => (
                <label
                  key={String(opt.val)}
                  className={`flex cursor-pointer flex-col rounded-xl border p-3.5 transition ${
                    moraComPais === opt.val
                      ? "border-ipcf-brand bg-ipcf-deep text-white"
                      : "border-ipcf-border bg-white text-ipcf-ink hover:bg-ipcf-bg"
                  }`}
                >
                  <input
                    type="radio"
                    name="mora_com_pais"
                    checked={moraComPais === opt.val}
                    onChange={() => setMoraComPais(opt.val)}
                    className="sr-only"
                  />
                  <span className="text-sm font-bold">{opt.title}</span>
                  <span
                    className={`mt-1 text-xs ${
                      moraComPais === opt.val ? "text-ipcf-gold-soft" : "text-ipcf-muted"
                    }`}
                  >
                    {opt.desc}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {!moraComPais && (
            <div className="space-y-4 rounded-2xl border border-ipcf-border bg-ipcf-bg/60 p-4">
              <div className="grid gap-4 sm:grid-cols-[180px_1fr] sm:items-end">
                <FormField id="conv-cep" label="CEP" error={errors.cep}>
                  <input
                    id="conv-cep"
                    type="text"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    placeholder="00000-000"
                    value={cep}
                    onChange={(e) => {
                      const fmt = formatCEP(e.target.value);
                      setCep(fmt);
                      setCepNotice(null);
                      setErrors((prev) => ({ ...prev, cep: "" }));
                      if (cleanDigits(fmt).length === 8) void handleLookupCep(fmt);
                    }}
                    aria-invalid={Boolean(errors.cep)}
                    className="ipcf-input"
                  />
                </FormField>
                <button
                  type="button"
                  onClick={() => void handleLookupCep(cep)}
                  disabled={loadingCep || cleanDigits(cep).length !== 8}
                  className="inline-flex cursor-pointer items-center gap-1.5 self-start rounded-xl border border-ipcf-border bg-white px-3 py-2.5 text-xs font-semibold text-ipcf-deep disabled:opacity-50 sm:self-end"
                >
                  <Search className="h-4 w-4" aria-hidden="true" />
                  <span>{loadingCep ? "Buscando..." : "Buscar CEP"}</span>
                </button>
              </div>

              {cepNotice && (
                <p
                  role={cepNotice.type === "error" ? "alert" : "status"}
                  className={`text-xs font-medium ${
                    cepNotice.type === "error" ? "text-ipcf-danger" : "text-ipcf-brand"
                  }`}
                >
                  {cepNotice.text}
                </p>
              )}

              <div className="grid gap-4 sm:grid-cols-[1fr_130px]">
                <FormField id="conv-logradouro" label="Logradouro" required error={errors.logradouro}>
                  <input
                    id="conv-logradouro"
                    type="text"
                    autoComplete="address-line1"
                    value={logradouro}
                    onChange={(e) => {
                      setLogradouro(e.target.value);
                      setErrors((prev) => ({ ...prev, logradouro: "" }));
                    }}
                    aria-invalid={Boolean(errors.logradouro)}
                    className="ipcf-input"
                  />
                </FormField>
                <FormField id="conv-numero" label="Número" required error={errors.numero}>
                  <input
                    id="conv-numero"
                    type="text"
                    value={numero}
                    onChange={(e) => {
                      setNumero(e.target.value);
                      setErrors((prev) => ({ ...prev, numero: "" }));
                    }}
                    aria-invalid={Boolean(errors.numero)}
                    className="ipcf-input"
                  />
                </FormField>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <FormField id="conv-comp" label="Complemento">
                  <input
                    id="conv-comp"
                    type="text"
                    autoComplete="address-line2"
                    value={complemento}
                    onChange={(e) => setComplemento(e.target.value)}
                    className="ipcf-input"
                  />
                </FormField>
                <FormField id="conv-bairro" label="Bairro" required error={errors.bairro}>
                  <input
                    id="conv-bairro"
                    type="text"
                    autoComplete="address-level3"
                    value={bairro}
                    onChange={(e) => {
                      setBairro(e.target.value);
                      setErrors((prev) => ({ ...prev, bairro: "" }));
                    }}
                    aria-invalid={Boolean(errors.bairro)}
                    className="ipcf-input"
                  />
                </FormField>
                <FormField id="conv-cidade" label="Cidade" required error={errors.cidade}>
                  <input
                    id="conv-cidade"
                    type="text"
                    autoComplete="address-level2"
                    value={cidade}
                    onChange={(e) => {
                      setCidade(e.target.value);
                      setErrors((prev) => ({ ...prev, cidade: "" }));
                    }}
                    aria-invalid={Boolean(errors.cidade)}
                    className="ipcf-input"
                  />
                </FormField>
              </div>
            </div>
          )}
        </section>

        {/* Membresia, Disponibilidade & Oração */}
        <section className="space-y-4">
          <h2 className="border-b border-ipcf-border pb-2 font-serif text-lg font-bold text-ipcf-deep">
            3. Vida na Igreja & Privacidade
          </h2>

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-ipcf-ink">
              Sua situação na IPCF
            </legend>
            <div className="grid gap-2.5 sm:grid-cols-3">
              {(
                ["Membro Comungante", "Membro Não-Comungante", "Não-Membro"] as const
              ).map((opt) => (
                <label
                  key={opt}
                  className={`flex cursor-pointer items-center justify-center rounded-xl border px-3 py-2.5 text-center text-xs font-bold transition sm:text-sm ${
                    statusMembresia === opt
                      ? "border-ipcf-brand bg-ipcf-deep text-white"
                      : "border-ipcf-border bg-white text-ipcf-ink"
                  }`}
                >
                  <input
                    type="radio"
                    name="conv-membresia"
                    checked={statusMembresia === opt}
                    onChange={() => setStatusMembresia(opt)}
                    className="sr-only"
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-ipcf-ink">
              Disponibilidade semanal
            </legend>
            <div className="flex flex-wrap gap-2">
              {DIAS_SEMANA.map((day) => (
                <label
                  key={day}
                  className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-bold transition ${
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
            <FormField id="conv-talentos" label="Talentos e áreas de interesse">
              <textarea
                id="conv-talentos"
                rows={2}
                value={talentos}
                onChange={(e) => setTalentos(e.target.value)}
                className="ipcf-input"
              />
            </FormField>
            <FormField id="conv-dif" label="Maior dificuldade de horário (opcional)">
              <textarea
                id="conv-dif"
                rows={2}
                value={dificuldadeTempo}
                onChange={(e) => setDificuldadeTempo(e.target.value)}
                className="ipcf-input"
              />
            </FormField>
          </div>

          <div className="rounded-xl border border-ipcf-gold/50 bg-ipcf-gold-soft/15 p-4">
            <FormField
              id="conv-oracao"
              label="Seu Pedido de Oração (Sigiloso)"
              hint="Visível apenas para você e para os pastores da IPCF — nem mesmo seus pais visualizam."
            >
              <div className="mb-1 flex items-center gap-1.5 text-xs font-bold text-ipcf-deep">
                <Lock className="h-3.5 w-3.5 text-ipcf-brand" aria-hidden="true" />
                <span>Confidencial</span>
              </div>
              <textarea
                id="conv-oracao"
                rows={2}
                value={pedidoOracao}
                onChange={(e) => setPedidoOracao(e.target.value)}
                className="ipcf-input"
              />
            </FormField>
          </div>

          <div className="rounded-xl border border-ipcf-border bg-ipcf-bg p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={consentimentoLgpd}
                onChange={(e) => setConsentimentoLgpd(e.target.checked)}
                className="mt-1 h-4 w-4 accent-ipcf-brand"
              />
              <span className="text-xs leading-relaxed text-ipcf-ink">
                <strong className="block text-ipcf-deep">Termo LGPD:</strong>
                {OFFICIAL_LGPD_TEXT}
              </span>
            </label>
            {errors.consentimento_lgpd && (
              <p role="alert" className="mt-2 text-xs font-semibold text-ipcf-danger">
                {errors.consentimento_lgpd}
              </p>
            )}
          </div>
        </section>

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-ipcf-deep px-6 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-ipcf-brand disabled:opacity-60"
        >
          <CheckCircle2 className="h-5 w-5 text-ipcf-gold-soft" aria-hidden="true" />
          <span>{submitting ? "Ativando sua ficha..." : "Ativar Minha Ficha Própria"}</span>
        </button>
      </form>
    </div>
  );
}
