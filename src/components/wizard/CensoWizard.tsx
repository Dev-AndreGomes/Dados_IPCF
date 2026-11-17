"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  HeartHandshake,
  Lock,
  MapPin,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import {
  checkCpfBeforeCensoAction,
  submitNewCensoAction,
} from "@/actions/member.actions";
import { FormField } from "@/components/ui/FormControls";
import {
  DIAS_SEMANA,
  type DiaSemana,
  type EstadoCivil,
  type Oficiato,
  type Sexo,
  type SpousePrefillData,
  type StatusMembresia,
} from "@/types/database.types";
import {
  OFFICIAL_LGPD_TEXT,
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

const DRAFT_STORAGE_KEY = "censo_ipcf_draft_v1";

interface DependentDraft {
  nome: string;
  data_nascimento: string;
}

interface WizardState {
  cpf: string;
  password: string;
  nome_completo: string;
  sexo: Sexo | "";
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
  dependents: DependentDraft[];

  status_membresia: StatusMembresia;
  oficiato: Exclude<Oficiato, "Pastor">;
  disponibilidade_dias: DiaSemana[];
  talentos_ministerios: string;
  dificuldade_tempo: string;
  pedido_oracao: string;
  consentimento_lgpd: boolean;
}

const INITIAL_STATE: WizardState = {
  cpf: "",
  password: "",
  nome_completo: "",
  sexo: "",
  data_nascimento: "",
  naturalidade: "",
  profissao: "",
  whatsapp: "",
  email: "",

  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "Recife",

  estado_civil: "Solteiro(a)",
  conjuge_congrega_ipcf: false,
  nome_conjuge: "",
  conjuge_cpf: "",
  data_casamento: "",
  dependents: [],

  status_membresia: "Membro Comungante",
  oficiato: "Não oficial",
  disponibilidade_dias: [],
  talentos_ministerios: "",
  dificuldade_tempo: "",
  pedido_oracao: "",
  consentimento_lgpd: false,
};

const STEPS = [
  { id: 1, title: "Identificação", short: "Seus dados" },
  { id: 2, title: "Endereço", short: "Seu lar" },
  { id: 3, title: "Família", short: "Cônjuge e filhos" },
  { id: 4, title: "Igreja & Sigilo", short: "Ministérios e LGPD" },
] as const;

export function CensoWizard() {
  const router = useRouter();
  const [step, setStep] = useState<number>(1);
  const [form, setForm] = useState<WizardState>(INITIAL_STATE);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);

  const [checkingCpf, setCheckingCpf] = useState(false);
  const [cpfAlreadyExists, setCpfAlreadyExists] = useState(false);
  const [spousePrefill, setSpousePrefill] = useState<SpousePrefillData | null>(null);
  const lastCheckedCpfRef = useRef<string>("");

  const [loadingCep, setLoadingCep] = useState(false);
  const [cepNotice, setCepNotice] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const canPersistRef = useRef(false);

  const errorBannerRef = useRef<HTMLDivElement | null>(null);
  const stepHeadingRef = useRef<HTMLHeadingElement | null>(null);

  // Carrega rascunho salvo localmente de forma assíncrona (exceto senha)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(DRAFT_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as Partial<WizardState>;
          setForm((prev) => ({
            ...prev,
            ...parsed,
            password: "",
          }));
        }
      } catch {
        // Ignora erro de storage privado
      } finally {
        canPersistRef.current = true;
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  // Persiste rascunho automaticamente sem incluir senha
  useEffect(() => {
    if (!canPersistRef.current) return;
    try {
      const { password: _omittedPassword, ...safeDraft } = form;
      void _omittedPassword;
      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(safeDraft));
    } catch {
      // Ignora quota/storage privado
    }
  }, [form]);

  function updateField<K extends keyof WizardState>(key: K, value: WizardState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
    if (globalError) setGlobalError("");
  }

  async function runCpfCheck(rawCpf: string) {
    const digits = cleanDigits(rawCpf);
    if (!isValidCPF(digits) || digits === lastCheckedCpfRef.current) return;

    lastCheckedCpfRef.current = digits;
    setCheckingCpf(true);
    const res = await checkCpfBeforeCensoAction(digits);
    setCheckingCpf(false);

    if (!res.ok) {
      lastCheckedCpfRef.current = "";
      return;
    }

    setCpfAlreadyExists(res.data.alreadyRegistered);

    if (!res.data.alreadyRegistered && res.data.spousePrefill.found) {
      const sp = res.data.spousePrefill;
      setSpousePrefill(sp);
      if (sp.prefilledMemberName) {
        setErrors((prev) => ({ ...prev, nome_completo: "" }));
      }
      setForm((prev) => ({
        ...prev,
        nome_completo:
          prev.nome_completo.trim().length > 0
            ? prev.nome_completo
            : (sp.prefilledMemberName ?? prev.nome_completo),
        estado_civil: "Casado(a)",
        conjuge_congrega_ipcf: true,
        nome_conjuge: sp.spouseName ?? prev.nome_conjuge,
        conjuge_cpf: sp.spouseCpf ? formatCPF(sp.spouseCpf) : prev.conjuge_cpf,
        cep: sp.cep ? formatCEP(sp.cep) : prev.cep,
        logradouro: sp.logradouro ?? prev.logradouro,
        numero: sp.numero ?? prev.numero,
        complemento: sp.complemento ?? prev.complemento,
        bairro: sp.bairro ?? prev.bairro,
        cidade: sp.cidade ?? prev.cidade,
        data_casamento: sp.data_casamento ?? prev.data_casamento,
        dependents:
          prev.dependents.length === 0 && sp.dependents?.length
            ? sp.dependents
            : prev.dependents,
      }));
    } else if (!res.data.spousePrefill.found) {
      setSpousePrefill(null);
    }
  }

  async function lookupViaCep(rawCep: string) {
    const digits = cleanDigits(rawCep);
    if (digits.length !== 8) return;

    setLoadingCep(true);
    setCepNotice("");
    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = (await response.json()) as {
        erro?: boolean;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
      };
      if (data.erro) {
        setCepNotice("CEP não localizado automaticamente. Preencha o endereço abaixo.");
      } else {
        setForm((prev) => ({
          ...prev,
          logradouro: data.logradouro || prev.logradouro,
          bairro: data.bairro || prev.bairro,
          cidade: data.localidade || prev.cidade,
        }));
        setCepNotice("Endereço preenchido pelo CEP. Confira e informe o número.");
      }
    } catch {
      setCepNotice("Não foi possível consultar o CEP agora. Digite o endereço manualmente.");
    } finally {
      setLoadingCep(false);
    }
  }

  function validateBlur(field: keyof WizardState) {
    const nextErr: Record<string, string> = {};
    if (field === "cpf" && form.cpf && !isValidCPF(form.cpf)) {
      nextErr.cpf = "Informe um CPF válido com 11 dígitos.";
    }
    if (field === "password" && form.password && form.password.length < 6) {
      nextErr.password = "Crie uma senha simples com pelo menos 6 dígitos ou caracteres.";
    }
    if (field === "whatsapp" && form.whatsapp) {
      const d = cleanDigits(form.whatsapp);
      if (d.length < 10 || d.length > 11) {
        nextErr.whatsapp = "Informe o WhatsApp com DDD (10 ou 11 dígitos).";
      }
    }
    if (field === "email" && form.email.trim()) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
        nextErr.email = "E-mail inválido (ou deixe em branco).";
      }
    }
    if (field === "conjuge_cpf" && form.conjuge_cpf.trim()) {
      if (!isValidCPF(form.conjuge_cpf)) {
        nextErr.conjuge_cpf = "CPF do cônjuge inválido.";
      } else if (cleanDigits(form.conjuge_cpf) === cleanDigits(form.cpf)) {
        nextErr.conjuge_cpf = "O CPF do cônjuge não pode ser igual ao seu.";
      }
    }

    if (Object.keys(nextErr).length > 0) {
      setErrors((prev) => ({ ...prev, ...nextErr }));
    }
  }

  function validateStep(targetStep: number): Record<string, string> {
    const next: Record<string, string> = {};

    if (targetStep === 1) {
      if (!isValidCPF(form.cpf)) next.cpf = "Informe um CPF válido com 11 dígitos.";
      if (cpfAlreadyExists) {
        next.cpf = "Este CPF já tem cadastro. Acesse pela tela de Entrar.";
      }
      if (form.password.length < 6) {
        next.password = "A senha deve ter pelo menos 6 dígitos ou caracteres.";
      }
      if (form.nome_completo.trim().length < 3) {
        next.nome_completo = "Informe seu nome completo.";
      }
      if (!form.sexo) next.sexo = "Selecione o sexo.";
      if (!isValidPastOrTodayDate(form.data_nascimento)) {
        next.data_nascimento = "Informe uma data de nascimento válida (não pode estar no futuro).";
      }
      const phoneDigits = cleanDigits(form.whatsapp);
      if (phoneDigits.length < 10 || phoneDigits.length > 11) {
        next.whatsapp = "Informe o WhatsApp com DDD.";
      }
      if (
        form.email.trim() &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
      ) {
        next.email = "Informe um e-mail válido ou deixe em branco.";
      }
    }

    if (targetStep === 2) {
      const cepDigits = cleanDigits(form.cep);
      if (cepDigits.length > 0 && cepDigits.length !== 8) {
        next.cep = "O CEP deve ter 8 dígitos.";
      }
      if (form.logradouro.trim().length < 2) {
        next.logradouro = "Informe o logradouro (rua, avenida ou estrada).";
      }
      if (form.numero.trim().length < 1) {
        next.numero = "Informe o número (ou S/N).";
      }
      if (form.bairro.trim().length < 2) next.bairro = "Informe o bairro.";
      if (form.cidade.trim().length < 2) next.cidade = "Informe a cidade.";
    }

    if (targetStep === 3) {
      if (form.estado_civil === "Casado(a)") {
        if (form.nome_conjuge.trim().length < 2) {
          next.nome_conjuge = "Informe o nome do seu cônjuge.";
        }
        if (form.conjuge_congrega_ipcf && form.conjuge_cpf.trim()) {
          if (!isValidCPF(form.conjuge_cpf)) {
            next.conjuge_cpf = "CPF do cônjuge inválido.";
          } else if (cleanDigits(form.conjuge_cpf) === cleanDigits(form.cpf)) {
            next.conjuge_cpf = "O CPF do cônjuge não pode ser igual ao seu.";
          }
        }
        const marriageErr = validateMarriageDate(form.data_casamento, form.data_nascimento);
        if (marriageErr) {
          next.data_casamento = marriageErr;
        }
      }
      for (let i = 0; i < form.dependents.length; i++) {
        const dep = form.dependents[i];
        if (dep.nome.trim().length < 2 || !isValidPastOrTodayDate(dep.data_nascimento)) {
          next.dependents = `Preencha nome completo e data de nascimento válida (não futura) do filho(a) #${i + 1}.`;
          break;
        }
      }
    }

    if (targetStep === 4) {
      if (
        form.status_membresia !== "Membro Comungante" &&
        form.oficiato !== "Não oficial"
      ) {
        next.oficiato = "Apenas Membros Comungantes exercem oficialato.";
      }
      if (!form.consentimento_lgpd) {
        next.consentimento_lgpd =
          "Você precisa concordar com o termo de privacidade (LGPD) para concluir.";
      }
    }

    return next;
  }

  function focusFirstInvalid(errs: Record<string, string>) {
    const firstKey = Object.keys(errs)[0];
    if (!firstKey) return;
    requestAnimationFrame(() => {
      const target =
        document.getElementById(firstKey) ?? errorBannerRef.current;
      target?.focus();
    });
  }

  async function handleNextStep() {
    if (
      step === 1 &&
      isValidCPF(form.cpf) &&
      lastCheckedCpfRef.current !== cleanDigits(form.cpf)
    ) {
      await runCpfCheck(form.cpf);
    }

    const stepErrors = validateStep(step);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      setGlobalError("Por favor, revise os campos destacados antes de continuar.");
      focusFirstInvalid(stepErrors);
      return;
    }

    setErrors({});
    setGlobalError("");
    setStep((prev) => Math.min(4, prev + 1));
    requestAnimationFrame(() => {
      stepHeadingRef.current?.focus();
    });
  }

  function handlePrevStep() {
    setErrors({});
    setGlobalError("");
    setStep((prev) => Math.max(1, prev - 1));
    requestAnimationFrame(() => {
      stepHeadingRef.current?.focus();
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const stepErrors = validateStep(4);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      setGlobalError("Revise as informações antes de enviar seus dados.");
      focusFirstInvalid(stepErrors);
      return;
    }

    setSubmitting(true);
    setGlobalError("");

    const payload = {
      ...form,
      oficiato:
        form.status_membresia === "Membro Comungante" ? form.oficiato : "Não oficial",
    };

    const res = await submitNewCensoAction(payload);
    setSubmitting(false);

    if (!res.ok) {
      setGlobalError(res.error);
      if (res.fieldErrors) {
        setErrors(res.fieldErrors);
      }
      requestAnimationFrame(() => errorBannerRef.current?.focus());
      return;
    }

    try {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // Ignora
    }

    router.push(res.data.redirectTo);
    router.refresh();
  }

  function addDependent() {
    updateField("dependents", [
      ...form.dependents,
      { nome: "", data_nascimento: "" },
    ]);
  }

  function updateDependent(index: number, key: keyof DependentDraft, val: string) {
    const next = [...form.dependents];
    next[index] = { ...next[index], [key]: val };
    updateField("dependents", next);
  }

  function removeDependent(index: number) {
    updateField(
      "dependents",
      form.dependents.filter((_, idx) => idx !== index)
    );
  }

  function toggleDay(day: DiaSemana) {
    const exists = form.disponibilidade_dias.includes(day);
    updateField(
      "disponibilidade_dias",
      exists
        ? form.disponibilidade_dias.filter((d) => d !== day)
        : [...form.disponibilidade_dias, day]
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* Barra de progresso semântica */}
      <nav aria-label="Progresso do Dados IPCF" className="mb-6">
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {STEPS.map((item) => {
            const active = step === item.id;
            const completed = step > item.id;
            return (
              <li
                key={item.id}
                aria-current={active ? "step" : undefined}
                className={`rounded-xl border px-3 py-2.5 transition ${
                  active
                    ? "border-ipcf-brand bg-ipcf-deep text-white shadow-xs"
                    : completed
                    ? "border-ipcf-leaf/40 bg-emerald-50/70 text-ipcf-deep"
                    : "border-ipcf-border bg-white text-ipcf-muted"
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-bold">
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                      active
                        ? "bg-ipcf-gold text-ipcf-deep"
                        : completed
                        ? "bg-ipcf-brand text-white"
                        : "bg-stone-200 text-stone-700"
                    }`}
                  >
                    {completed ? "✓" : item.id}
                  </span>
                  <span>{item.title}</span>
                </div>
                <p
                  className={`mt-0.5 text-[11px] ${
                    active ? "text-ipcf-gold-soft" : "text-ipcf-muted"
                  }`}
                >
                  {item.short}
                </p>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Banner de cônjuge detectado (RN05) */}
      {spousePrefill?.found && (
        <div
          role="status"
          className="mb-5 flex items-start gap-3 rounded-2xl border border-ipcf-gold/60 bg-ipcf-gold-soft/25 p-4 text-ipcf-deep"
        >
          <HeartHandshake className="mt-0.5 h-5 w-5 shrink-0 text-ipcf-brand" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-bold">
              Identificamos que {spousePrefill.spouseName} já cadastrou o lar de vocês!
            </p>
            <p className="mt-0.5 text-xs text-ipcf-ink/80">
              {spousePrefill.prefilledMemberName
                ? "Seu nome, endereço, data de casamento e filhos já foram pré-preenchidos para você apenas conferir e ajustar se precisar."
                : "Endereço, data de casamento e filhos já foram pré-preenchidos nos passos 2 e 3 apenas para você confirmar."}
            </p>
          </div>
        </div>
      )}

      {/* Alerta global acessível */}
      {globalError && (
        <div
          ref={errorBannerRef}
          tabIndex={-1}
          role="alert"
          className="mb-5 rounded-xl border border-ipcf-danger/30 bg-ipcf-danger-bg px-4 py-3 text-sm font-medium text-ipcf-danger"
        >
          {globalError}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        noValidate
        className="rounded-2xl border border-ipcf-border bg-white p-5 shadow-sm sm:p-8"
      >
        {/* ETAPA 1 — IDENTIFICAÇÃO & ACESSO */}
        {step === 1 && (
          <section aria-labelledby="step1-heading" className="space-y-5">
            <div className="border-b border-ipcf-border pb-4">
              <h2
                id="step1-heading"
                ref={stepHeadingRef}
                tabIndex={-1}
                className="font-serif text-xl font-bold text-ipcf-deep focus:outline-none sm:text-2xl"
              >
                1. Identificação e Senha de Acesso
              </h2>
              <p className="mt-1 text-sm text-ipcf-muted">
                Seu CPF é a sua chave única na IPCF e servirá para entrar novamente quando precisar atualizar seus dados.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="cpf"
                label="CPF"
                required
                hint="Apenas dígitos; validamos automaticamente."
                error={errors.cpf}
              >
                <div className="relative">
                  <input
                    id="cpf"
                    name="cpf"
                    type="text"
                    inputMode="numeric"
                    autoComplete="username"
                    placeholder="000.000.000-00"
                    value={form.cpf}
                    onChange={(e) => {
                      const formatted = formatCPF(e.target.value);
                      const digits = cleanDigits(formatted);
                      setCpfAlreadyExists(false);
                      updateField("cpf", formatted);
                      if (digits.length < 11) {
                        lastCheckedCpfRef.current = "";
                        setSpousePrefill(null);
                      } else if (isValidCPF(digits)) {
                        void runCpfCheck(formatted);
                      }
                    }}
                    onBlur={() => {
                      validateBlur("cpf");
                      void runCpfCheck(form.cpf);
                    }}
                    aria-invalid={Boolean(errors.cpf) || cpfAlreadyExists}
                    className="ipcf-input"
                    required
                  />
                  {checkingCpf && (
                    <span className="mt-1 block text-xs text-ipcf-muted">
                      Verificando CPF...
                    </span>
                  )}
                </div>
              </FormField>

              <FormField
                id="password"
                label="Crie uma senha simples"
                required
                hint="Mínimo de 6 dígitos ou caracteres (ex: data especial)."
                error={errors.password}
              >
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Mínimo 6 caracteres"
                    value={form.password}
                    onChange={(e) => updateField("password", e.target.value)}
                    onBlur={() => validateBlur("password")}
                    aria-invalid={Boolean(errors.password)}
                    className="ipcf-input pr-11"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-md p-1.5 text-ipcf-muted hover:text-ipcf-deep"
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

            {cpfAlreadyExists && (
              <div
                role="alert"
                className="flex flex-col gap-3 rounded-xl border border-ipcf-gold/60 bg-ipcf-gold-soft/25 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="text-sm text-ipcf-deep">
                  <strong>Este CPF já está cadastrado no Dados IPCF!</strong>
                  <p className="text-xs text-ipcf-muted">
                    Entre com sua senha ou peça ao Pastor/Secretaria para redefinir em 1 clique.
                  </p>
                </div>
                <Link
                  href="/login"
                  className="inline-flex shrink-0 items-center justify-center rounded-lg bg-ipcf-deep px-4 py-2 text-xs font-bold text-white hover:bg-ipcf-brand"
                >
                  Ir para Entrar →
                </Link>
              </div>
            )}

            <FormField id="nome_completo" label="Nome completo" required error={errors.nome_completo}>
              <input
                id="nome_completo"
                name="nome_completo"
                type="text"
                autoComplete="name"
                placeholder="Nome completo sem abreviações"
                value={form.nome_completo}
                onChange={(e) => updateField("nome_completo", e.target.value)}
                aria-invalid={Boolean(errors.nome_completo)}
                className="ipcf-input"
                required
              />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <fieldset className="space-y-1.5" aria-invalid={Boolean(errors.sexo)}>
                <legend className="text-sm font-semibold text-ipcf-ink">
                  Sexo <span className="text-ipcf-danger" aria-hidden="true">*</span>
                </legend>
                <div id="sexo" tabIndex={-1} className="grid grid-cols-2 gap-2.5 pt-0.5">
                  {(["Masculino", "Feminino"] as const).map((option) => (
                    <label
                      key={option}
                      className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                        form.sexo === option
                          ? "border-ipcf-brand bg-ipcf-brand text-white"
                          : "border-ipcf-border bg-white text-ipcf-ink hover:bg-ipcf-bg"
                      }`}
                    >
                      <input
                        type="radio"
                        name="sexo"
                        value={option}
                        checked={form.sexo === option}
                        onChange={() => updateField("sexo", option)}
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

              <FormField
                id="data_nascimento"
                label="Data de nascimento"
                required
                error={errors.data_nascimento}
              >
                <input
                  id="data_nascimento"
                  name="data_nascimento"
                  type="date"
                  autoComplete="bday"
                  max={getTodayIsoRecife()}
                  value={form.data_nascimento}
                  onChange={(e) => updateField("data_nascimento", e.target.value)}
                  aria-invalid={Boolean(errors.data_nascimento)}
                  className="ipcf-input"
                  required
                />
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="naturalidade"
                label="Naturalidade (Cidade / UF)"
                hint="Onde você nasceu (opcional)."
                error={errors.naturalidade}
              >
                <input
                  id="naturalidade"
                  name="naturalidade"
                  type="text"
                  placeholder="Ex: Recife - PE"
                  value={form.naturalidade}
                  onChange={(e) => updateField("naturalidade", e.target.value)}
                  className="ipcf-input"
                />
              </FormField>

              <FormField
                id="profissao"
                label="Profissão / Ocupação"
                hint="Ajuda no cuidado diaconal e recomendações."
                error={errors.profissao}
              >
                <input
                  id="profissao"
                  name="profissao"
                  type="text"
                  autoComplete="organization-title"
                  placeholder="Ex: Professor, Médica, Aposentado, Estudante"
                  value={form.profissao}
                  onChange={(e) => updateField("profissao", e.target.value)}
                  className="ipcf-input"
                />
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="whatsapp"
                label="WhatsApp"
                required
                hint="Com DDD, para contato pastoral."
                error={errors.whatsapp}
              >
                <input
                  id="whatsapp"
                  name="whatsapp"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="(81) 99999-9999"
                  value={form.whatsapp}
                  onChange={(e) =>
                    updateField("whatsapp", formatWhatsApp(e.target.value))
                  }
                  onBlur={() => validateBlur("whatsapp")}
                  aria-invalid={Boolean(errors.whatsapp)}
                  className="ipcf-input"
                  required
                />
              </FormField>

              <FormField
                id="email"
                label="E-mail (opcional)"
                hint="Opcional — caso utilize no dia a dia."
                error={errors.email}
              >
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="voce@exemplo.com"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  onBlur={() => validateBlur("email")}
                  aria-invalid={Boolean(errors.email)}
                  className="ipcf-input"
                />
              </FormField>
            </div>
          </section>
        )}

        {/* ETAPA 2 — LAR & ENDEREÇO */}
        {step === 2 && (
          <section aria-labelledby="step2-heading" className="space-y-5">
            <div className="border-b border-ipcf-border pb-4">
              <h2
                id="step2-heading"
                ref={stepHeadingRef}
                tabIndex={-1}
                className="font-serif text-xl font-bold text-ipcf-deep focus:outline-none sm:text-2xl"
              >
                2. Endereço do Lar
              </h2>
              <p className="mt-1 text-sm text-ipcf-muted">
                Usamos o endereço para organizar visitas pastorais e células/redes por bairro.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-[200px_1fr] sm:items-end">
              <FormField id="cep" label="CEP" hint="Preenchimento automático ViaCEP" error={errors.cep}>
                <input
                  id="cep"
                  name="cep"
                  type="text"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  placeholder="52061-000"
                  value={form.cep}
                  onChange={(e) => {
                    const formatted = formatCEP(e.target.value);
                    updateField("cep", formatted);
                    if (cleanDigits(formatted).length === 8) {
                      void lookupViaCep(formatted);
                    }
                  }}
                  aria-invalid={Boolean(errors.cep)}
                  className="ipcf-input"
                />
              </FormField>

              <div className="flex items-center gap-3 pb-1">
                <button
                  type="button"
                  onClick={() => void lookupViaCep(form.cep)}
                  disabled={loadingCep || cleanDigits(form.cep).length !== 8}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-ipcf-border bg-ipcf-bg px-3.5 py-2.5 text-xs font-semibold text-ipcf-deep transition hover:bg-stone-200/70 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Search className="h-4 w-4" aria-hidden="true" />
                  <span>{loadingCep ? "Buscando CEP..." : "Buscar CEP"}</span>
                </button>
                {cepNotice && (
                  <span className="text-xs font-medium text-ipcf-brand">{cepNotice}</span>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
              <FormField id="logradouro" label="Logradouro (Rua / Avenida)" required error={errors.logradouro}>
                <input
                  id="logradouro"
                  name="logradouro"
                  type="text"
                  autoComplete="address-line1"
                  placeholder="Ex: Estrada do Encanamento"
                  value={form.logradouro}
                  onChange={(e) => updateField("logradouro", e.target.value)}
                  aria-invalid={Boolean(errors.logradouro)}
                  className="ipcf-input"
                  required
                />
              </FormField>

              <FormField id="numero" label="Número" required error={errors.numero}>
                <input
                  id="numero"
                  name="numero"
                  type="text"
                  placeholder="123 ou S/N"
                  value={form.numero}
                  onChange={(e) => updateField("numero", e.target.value)}
                  aria-invalid={Boolean(errors.numero)}
                  className="ipcf-input"
                  required
                />
              </FormField>
            </div>

            <FormField
              id="complemento"
              label="Complemento (opcional)"
              hint="Apartamento, bloco, casa, referência."
              error={errors.complemento}
            >
              <input
                id="complemento"
                name="complemento"
                type="text"
                autoComplete="address-line2"
                placeholder="Ex: Apto 802, Bloco B"
                value={form.complemento}
                onChange={(e) => updateField("complemento", e.target.value)}
                className="ipcf-input"
              />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="bairro" label="Bairro" required error={errors.bairro}>
                <input
                  id="bairro"
                  name="bairro"
                  type="text"
                  autoComplete="address-level3"
                  placeholder="Ex: Casa Forte"
                  value={form.bairro}
                  onChange={(e) => updateField("bairro", e.target.value)}
                  aria-invalid={Boolean(errors.bairro)}
                  className="ipcf-input"
                  required
                />
              </FormField>

              <FormField id="cidade" label="Cidade" required error={errors.cidade}>
                <input
                  id="cidade"
                  name="cidade"
                  type="text"
                  autoComplete="address-level2"
                  placeholder="Recife"
                  value={form.cidade}
                  onChange={(e) => updateField("cidade", e.target.value)}
                  aria-invalid={Boolean(errors.cidade)}
                  className="ipcf-input"
                  required
                />
              </FormField>
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-ipcf-bg px-3.5 py-2.5 text-xs text-ipcf-muted">
              <MapPin className="h-4 w-4 shrink-0 text-ipcf-brand" aria-hidden="true" />
              <span>
                Ao finalizar, o mapa pastoral posicionará o seu lar automaticamente para facilitar visitas.
              </span>
            </div>
          </section>
        )}

        {/* ETAPA 3 — FAMÍLIA & CASAMENTO */}
        {step === 3 && (
          <section aria-labelledby="step3-heading" className="space-y-6">
            <div className="border-b border-ipcf-border pb-4">
              <h2
                id="step3-heading"
                ref={stepHeadingRef}
                tabIndex={-1}
                className="font-serif text-xl font-bold text-ipcf-deep focus:outline-none sm:text-2xl"
              >
                3. Núcleo Familiar
              </h2>
              <p className="mt-1 text-sm text-ipcf-muted">
                Vincule seu cônjuge e registre seus filhos ou dependentes para acompanhamento da família na IPCF.
              </p>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-ipcf-ink">
                Estado civil <span className="text-ipcf-danger" aria-hidden="true">*</span>
              </legend>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {(["Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)"] as const).map(
                  (option) => (
                    <label
                      key={option}
                      className={`flex cursor-pointer items-center justify-center rounded-xl border px-3 py-2.5 text-center text-sm font-semibold transition ${
                        form.estado_civil === option
                          ? "border-ipcf-brand bg-ipcf-brand text-white"
                          : "border-ipcf-border bg-white text-ipcf-ink hover:bg-ipcf-bg"
                      }`}
                    >
                      <input
                        type="radio"
                        name="estado_civil"
                        value={option}
                        checked={form.estado_civil === option}
                        onChange={() => updateField("estado_civil", option)}
                        className="sr-only"
                      />
                      <span>{option}</span>
                    </label>
                  )
                )}
              </div>
            </fieldset>

            {form.estado_civil === "Casado(a)" && (
              <div className="space-y-4 rounded-2xl border border-ipcf-border bg-ipcf-bg/60 p-4 sm:p-5">
                <fieldset className="space-y-2">
                  <legend className="text-sm font-semibold text-ipcf-ink">
                    Seu cônjuge também congrega na IPCF?
                  </legend>
                  <div className="grid grid-cols-2 gap-2.5 max-w-xs">
                    {[
                      { label: "Sim, congrega", val: true },
                      { label: "Não", val: false },
                    ].map((opt) => (
                      <label
                        key={opt.label}
                        className={`flex cursor-pointer items-center justify-center rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                          form.conjuge_congrega_ipcf === opt.val
                            ? "border-ipcf-brand bg-ipcf-brand text-white"
                            : "border-ipcf-border bg-white text-ipcf-ink"
                        }`}
                      >
                        <input
                          type="radio"
                          name="conjuge_congrega_ipcf"
                          checked={form.conjuge_congrega_ipcf === opt.val}
                          onChange={() => updateField("conjuge_congrega_ipcf", opt.val)}
                          className="sr-only"
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    id="nome_conjuge"
                    label="Nome completo do cônjuge"
                    required
                    error={errors.nome_conjuge}
                  >
                    <input
                      id="nome_conjuge"
                      name="nome_conjuge"
                      type="text"
                      placeholder="Nome do(a) esposo(a)"
                      value={form.nome_conjuge}
                      onChange={(e) => updateField("nome_conjuge", e.target.value)}
                      aria-invalid={Boolean(errors.nome_conjuge)}
                      className="ipcf-input"
                    />
                  </FormField>

                  <FormField
                    id="data_casamento"
                    label="Data do casamento (Aniversário / Bodas)"
                    hint="Usada para celebrarmos as bodas e aniversário de casamento do casal na IPCF."
                    error={errors.data_casamento}
                  >
                    <input
                      id="data_casamento"
                      name="data_casamento"
                      type="date"
                      max={getTodayIsoRecife()}
                      value={form.data_casamento}
                      onChange={(e) => updateField("data_casamento", e.target.value)}
                      className="ipcf-input"
                    />
                    {(() => {
                      if (
                        !form.data_casamento ||
                        validateMarriageDate(form.data_casamento, form.data_nascimento)
                      ) {
                        return null;
                      }
                      const info = getMarriageInfo(form.data_casamento);
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
                </div>

                {form.conjuge_congrega_ipcf && (
                  <FormField
                    id="conjuge_cpf"
                    label="CPF do cônjuge (para vínculo automático do lar)"
                    hint="Quando seu cônjuge entrar no Dados IPCF, nome, endereço, bodas e filhos aparecerão prontos para ele(a)!"
                    error={errors.conjuge_cpf}
                  >
                    <input
                      id="conjuge_cpf"
                      name="conjuge_cpf"
                      type="text"
                      inputMode="numeric"
                      placeholder="000.000.000-00"
                      value={form.conjuge_cpf}
                      onChange={(e) =>
                        updateField("conjuge_cpf", formatCPF(e.target.value))
                      }
                      onBlur={() => validateBlur("conjuge_cpf")}
                      aria-invalid={Boolean(errors.conjuge_cpf)}
                      className="ipcf-input"
                    />
                  </FormField>
                )}
              </div>
            )}

            {/* Filhos / Dependentes */}
            <div className="space-y-3 rounded-2xl border border-ipcf-border bg-white p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-bold text-ipcf-deep">
                    <Users className="h-4 w-4 text-ipcf-brand" aria-hidden="true" />
                    <span>Filhos e Dependentes no Lar</span>
                  </h3>
                  <p className="text-xs text-ipcf-muted">
                    Cadastre seus filhos (nome e nascimento). Jovens/adultos podem receber link próprio depois.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addDependent}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-ipcf-bg px-3 py-2 text-xs font-bold text-ipcf-brand ring-1 ring-ipcf-border transition hover:bg-emerald-50"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>Adicionar Filho(a)</span>
                </button>
              </div>

              {errors.dependents && (
                <p id="dependents" role="alert" className="text-xs font-medium text-ipcf-danger">
                  {errors.dependents}
                </p>
              )}

              {form.dependents.length === 0 ? (
                <p className="rounded-xl bg-ipcf-bg px-4 py-3 text-xs text-ipcf-muted">
                  Nenhum filho adicionado neste momento. Se não houver, pode avançar.
                </p>
              ) : (
                <ul className="space-y-3">
                  {form.dependents.map((dep, idx) => (
                    <li
                      key={idx}
                      className="grid gap-3 rounded-xl border border-ipcf-border bg-ipcf-bg/40 p-3 sm:grid-cols-[1fr_170px_auto] sm:items-end"
                    >
                      <FormField id={`dep-nome-${idx}`} label={`Nome do filho(a) #${idx + 1}`}>
                        <input
                          id={`dep-nome-${idx}`}
                          type="text"
                          placeholder="Nome completo"
                          value={dep.nome}
                          onChange={(e) =>
                            updateDependent(idx, "nome", e.target.value)
                          }
                          className="ipcf-input"
                        />
                      </FormField>

                      <FormField id={`dep-nasc-${idx}`} label="Nascimento">
                        <input
                          id={`dep-nasc-${idx}`}
                          type="date"
                          max={getTodayIsoRecife()}
                          value={dep.data_nascimento}
                          onChange={(e) =>
                            updateDependent(idx, "data_nascimento", e.target.value)
                          }
                          className="ipcf-input"
                        />
                      </FormField>

                      <button
                        type="button"
                        onClick={() => removeDependent(idx)}
                        aria-label={`Remover filho(a) ${dep.nome || idx + 1}`}
                        className="inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2.5 text-xs font-semibold text-ipcf-danger hover:bg-red-50 sm:w-auto"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        <span className="sm:sr-only">Remover</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        {/* ETAPA 4 — IGREJA, ENGAJAMENTO & SIGILO */}
        {step === 4 && (
          <section aria-labelledby="step4-heading" className="space-y-6">
            <div className="border-b border-ipcf-border pb-4">
              <h2
                id="step4-heading"
                ref={stepHeadingRef}
                tabIndex={-1}
                className="font-serif text-xl font-bold text-ipcf-deep focus:outline-none sm:text-2xl"
              >
                4. Vida na Igreja, Ministérios e Privacidade
              </h2>
              <p className="mt-1 text-sm text-ipcf-muted">
                Ajude a IPCF a conhecer seus dons, disponibilidade de horários e motivos de oração.
              </p>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-ipcf-ink">
                Qual é a sua situação hoje na IPCF?{" "}
                <span className="text-ipcf-danger" aria-hidden="true">*</span>
              </legend>
              <div className="grid gap-2.5 sm:grid-cols-3">
                {(
                  [
                    {
                      value: "Membro Comungante",
                      desc: "Recebido por Profissão de Fé ou Transferência",
                    },
                    {
                      value: "Membro Não-Comungante",
                      desc: "Batizado na infância (ainda sem profissão de fé)",
                    },
                    {
                      value: "Não-Membro",
                      desc: "Congregado ou visitante frequente",
                    },
                  ] as const
                ).map((item) => (
                  <label
                    key={item.value}
                    className={`flex cursor-pointer flex-col rounded-xl border p-3 text-left transition ${
                      form.status_membresia === item.value
                        ? "border-ipcf-brand bg-ipcf-deep text-white"
                        : "border-ipcf-border bg-white text-ipcf-ink hover:bg-ipcf-bg"
                    }`}
                  >
                    <input
                      type="radio"
                      name="status_membresia"
                      value={item.value}
                      checked={form.status_membresia === item.value}
                      onChange={() => {
                        updateField("status_membresia", item.value);
                        if (item.value !== "Membro Comungante") {
                          updateField("oficiato", "Não oficial");
                        }
                      }}
                      className="sr-only"
                    />
                    <span className="text-sm font-bold">{item.value}</span>
                    <span
                      className={`mt-1 text-[11px] leading-snug ${
                        form.status_membresia === item.value
                          ? "text-ipcf-gold-soft"
                          : "text-ipcf-muted"
                      }`}
                    >
                      {item.desc}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {form.status_membresia === "Membro Comungante" && (
              <fieldset className="space-y-2 rounded-2xl border border-ipcf-border bg-ipcf-bg/60 p-4">
                <legend className="text-sm font-semibold text-ipcf-ink">
                  Exerce algum oficialato ordenado na IPCF?
                </legend>
                <div id="oficiato" tabIndex={-1} className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  {(["Não oficial", "Diácono", "Presbítero"] as const).map((opt) => (
                    <label
                      key={opt}
                      className={`flex cursor-pointer items-center justify-center rounded-xl border px-3 py-2 text-xs font-bold transition sm:text-sm ${
                        form.oficiato === opt
                          ? "border-ipcf-brand bg-ipcf-brand text-white"
                          : "border-ipcf-border bg-white text-ipcf-ink"
                      }`}
                    >
                      <input
                        type="radio"
                        name="oficiato"
                        value={opt}
                        checked={form.oficiato === opt}
                        onChange={() => updateField("oficiato", opt)}
                        className="sr-only"
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
                {errors.oficiato && (
                  <p role="alert" className="text-xs font-medium text-ipcf-danger">
                    {errors.oficiato}
                  </p>
                )}
              </fieldset>
            )}

            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-ipcf-ink">
                Dias da semana com maior disponibilidade para participar ou servir
              </legend>
              <div className="flex flex-wrap gap-2">
                {DIAS_SEMANA.map((day) => {
                  const selected = form.disponibilidade_dias.includes(day);
                  return (
                    <label
                      key={day}
                      className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${
                        selected
                          ? "border-ipcf-brand bg-ipcf-brand text-white"
                          : "border-ipcf-border bg-white text-ipcf-ink hover:bg-ipcf-bg"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleDay(day)}
                        className="sr-only"
                      />
                      <span>{day}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="talentos_ministerios"
                label="Onde serve ou talentos que deseja oferecer"
                hint="Ex: Louvor, Ministério Infantil, Diaconia, Mídia, Recepção, Cozinha..."
              >
                <textarea
                  id="talentos_ministerios"
                  rows={3}
                  value={form.talentos_ministerios}
                  onChange={(e) =>
                    updateField("talentos_ministerios", e.target.value)
                  }
                  placeholder="Conte seus dons e áreas em que gostaria de ajudar..."
                  className="ipcf-input resize-y"
                />
              </FormField>

              <FormField
                id="dificuldade_tempo"
                label="Maior dificuldade de horário / agenda"
                hint="Ex: Trabalho por escala, aulas à noite, condução, cuidados familiares..."
              >
                <textarea
                  id="dificuldade_tempo"
                  rows={3}
                  value={form.dificuldade_tempo}
                  onChange={(e) => updateField("dificuldade_tempo", e.target.value)}
                  placeholder="Opcional: ajuda o pastor e ministérios a entenderem sua rotina..."
                  className="ipcf-input resize-y"
                />
              </FormField>
            </div>

            <div className="rounded-2xl border border-ipcf-gold/50 bg-ipcf-gold-soft/15 p-4 sm:p-5">
              <FormField
                id="pedido_oracao"
                label="Pedido de Oração Atual (Confidencial)"
                hint="Sigilo 1:1 — visível apenas para você e para os pastores/liderança, nunca para cônjuge ou outros membros."
              >
                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-ipcf-deep">
                  <Lock className="h-3.5 w-3.5 text-ipcf-brand" aria-hidden="true" />
                  <span>Protegido por sigilo pastoral</span>
                </div>
                <textarea
                  id="pedido_oracao"
                  rows={3}
                  value={form.pedido_oracao}
                  onChange={(e) => updateField("pedido_oracao", e.target.value)}
                  placeholder="Escreva aqui como a igreja pode orar por você nesta semana..."
                  className="ipcf-input resize-y"
                />
              </FormField>
            </div>

            {/* Aceite LGPD */}
            <div className="rounded-2xl border border-ipcf-border bg-ipcf-bg p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  id="consentimento_lgpd"
                  type="checkbox"
                  checked={form.consentimento_lgpd}
                  onChange={(e) =>
                    updateField("consentimento_lgpd", e.target.checked)
                  }
                  aria-invalid={Boolean(errors.consentimento_lgpd)}
                  className="mt-1 h-4 w-4 rounded border-ipcf-border accent-ipcf-brand"
                />
                <span className="text-xs leading-relaxed text-ipcf-ink">
                  <strong className="block text-ipcf-deep">
                    Termo de Ciência e Consentimento (LGPD):
                  </strong>
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
        )}

        {/* Rodapé de Navegação */}
        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-ipcf-border pt-5 sm:flex-row sm:items-center sm:justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={handlePrevStep}
              className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-ipcf-border bg-white px-4 py-3 text-sm font-semibold text-ipcf-deep transition hover:bg-ipcf-bg sm:w-auto sm:py-2.5"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>Voltar</span>
            </button>
          ) : (
            <div className="flex items-center justify-center gap-1.5 text-xs text-ipcf-muted sm:justify-start">
              <Sparkles className="h-4 w-4 text-ipcf-gold" aria-hidden="true" />
              <span>Progresso salvo neste aparelho</span>
            </div>
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={() => void handleNextStep()}
              className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-ipcf-brand px-5 py-3 text-sm font-bold text-white shadow-xs transition hover:bg-ipcf-deep sm:w-auto sm:py-2.5"
            >
              <span>Continuar</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-ipcf-deep px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-ipcf-brand disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {submitting ? (
                <span>Finalizando cadastro...</span>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 text-ipcf-gold-soft" aria-hidden="true" />
                  <span>Concluir Meu Cadastro</span>
                </>
              )}
            </button>
          )}
        </div>
      </form>

      <p className="mt-4 text-center text-xs text-ipcf-muted">
        Já enviou seus dados antes?{" "}
        <Link href="/login" className="font-bold text-ipcf-brand underline">
          Entre com seu CPF e senha aqui
        </Link>
        .
      </p>
    </div>
  );
}
