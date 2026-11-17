import { z } from "zod";
import {
  DIAS_SEMANA,
  type Dependent,
  type Family,
  type Member,
  type PrayerRequest,
} from "@/types/database.types";

export function cleanDigits(value: string): string {
  return (value || "").replace(/\D/g, "");
}

/**
 * Validação matemática oficial do CPF (Módulo 11).
 * Espelha exatamente a função SQL public.is_valid_cpf no Supabase.
 */
export function isValidCPF(input: string): boolean {
  const cpf = cleanDigits(input);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) {
    return false;
  }

  let sum1 = 0;
  for (let i = 0; i < 9; i++) {
    sum1 += Number(cpf[i]) * (10 - i);
  }
  let rem1 = (sum1 * 10) % 11;
  if (rem1 === 10) rem1 = 0;
  if (rem1 !== Number(cpf[9])) return false;

  let sum2 = 0;
  for (let i = 0; i < 10; i++) {
    sum2 += Number(cpf[i]) * (11 - i);
  }
  let rem2 = (sum2 * 10) % 11;
  if (rem2 === 10) rem2 = 0;
  return rem2 === Number(cpf[10]);
}

export function cpfToShadowEmail(cpf: string): string {
  return `${cleanDigits(cpf)}@membros.ipcf.local`;
}

export function formatCPF(value: string): string {
  const digits = cleanDigits(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

export function formatCEP(value: string): string {
  const digits = cleanDigits(value).slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function formatWhatsApp(value: string): string {
  const digits = cleanDigits(value).slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

export function calculateAge(dateIso: string | null | undefined): number {
  if (!dateIso) return 0;
  const [y, m, d] = dateIso.split("-").map(Number);
  if (!y || !m || !d) return 0;
  const today = getRecifeToday();
  let age = today.year - y;
  if (today.month < m || (today.month === m && today.day < d)) {
    age--;
  }
  return Math.max(0, age);
}

/**
 * Retorna a data de hoje no fuso America/Recife (UTC-3).
 */
export function getRecifeToday(): { year: number; month: number; day: number; date: Date } {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Recife",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const [year, month, day] = fmt.split("-").map(Number);
  return { year, month, day, date: new Date(Date.UTC(year, month - 1, day)) };
}

/**
 * Verifica se um aniversário (nascimento ou casamento) cai na semana calendário atual (Segunda a Domingo).
 */
export function getWeekCelebrationInfo(
  dateIso: string | null | undefined
): { isToday: boolean; completingYears: number } | null {
  if (!dateIso) return null;
  const [y, m, d] = dateIso.split("-").map(Number);
  if (!y || !m || !d) return null;

  const { year: todayYear, month: todayMonth, day: todayDay, date: todayUtc } = getRecifeToday();
  const dow = todayUtc.getUTCDay(); // 0=Dom, 1=Seg, ...
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(todayUtc);
  monday.setUTCDate(todayUtc.getUTCDate() + diffToMonday);

  for (let i = 0; i < 7; i++) {
    const check = new Date(monday);
    check.setUTCDate(monday.getUTCDate() + i);
    const checkYear = check.getUTCFullYear();
    const checkMonth = check.getUTCMonth() + 1;
    const checkDay = check.getUTCDate();

    if (checkMonth === m && checkDay === d) {
      return {
        isToday: checkYear === todayYear && checkMonth === todayMonth && checkDay === todayDay,
        completingYears: Math.max(0, checkYear - y),
      };
    }
  }
  return null;
}

export function isDateInCurrentWeek(dateIso: string | null | undefined): boolean {
  return getWeekCelebrationInfo(dateIso) !== null;
}

export function getTodayIsoRecife(): string {
  const { year, month, day } = getRecifeToday();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function isValidPastOrTodayDate(
  dateIso: string | null | undefined,
  minYear = 1900
): boolean {
  if (!dateIso || !/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return false;
  const [y, m, d] = dateIso.split("-").map(Number);
  if (y < minYear) return false;
  const check = new Date(Date.UTC(y, m - 1, d));
  if (
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() + 1 !== m ||
    check.getUTCDate() !== d
  ) {
    return false;
  }
  return dateIso <= getTodayIsoRecife();
}

export function validateMarriageDate(
  marriageDate: string | null | undefined,
  birthDate?: string | null
): string | null {
  const value = (marriageDate ?? "").trim();
  if (!value) return null;
  if (!isValidPastOrTodayDate(value, 1920)) {
    return "Informe uma data de casamento válida (não pode estar no futuro).";
  }
  if (birthDate && isValidPastOrTodayDate(birthDate) && value <= birthDate) {
    return "A data de casamento não pode ser anterior ou igual ao nascimento.";
  }
  return null;
}

export function compareWeekCalendarDates(aIso: string, bIso: string): number {
  const aMonth = Number(aIso.slice(5, 7));
  const bMonth = Number(bIso.slice(5, 7));
  if (aMonth === 12 && bMonth === 1) return -1;
  if (aMonth === 1 && bMonth === 12) return 1;
  return aIso.slice(5).localeCompare(bIso.slice(5));
}

const BODAS_BY_YEAR: Record<number, string> = {
  1: "Bodas de Papel",
  2: "Bodas de Algodão",
  3: "Bodas de Trigo",
  4: "Bodas de Flores e Frutas",
  5: "Bodas de Madeira",
  6: "Bodas de Perfume",
  7: "Bodas de Latão",
  8: "Bodas de Papoula",
  9: "Bodas de Cerâmica",
  10: "Bodas de Estanho",
  11: "Bodas de Aço",
  12: "Bodas de Ônix",
  13: "Bodas de Linho",
  14: "Bodas de Marfim",
  15: "Bodas de Cristal",
  16: "Bodas de Safira",
  17: "Bodas de Rosa",
  18: "Bodas de Turquesa",
  19: "Bodas de Água-Marinha",
  20: "Bodas de Porcelana",
  25: "Bodas de Prata",
  30: "Bodas de Pérola",
  35: "Bodas de Coral",
  36: "Bodas de Cedro",
  40: "Bodas de Esmeralda",
  45: "Bodas de Rubi",
  50: "Bodas de Ouro",
  55: "Bodas de Ametista",
  60: "Bodas de Diamante",
  65: "Bodas de Platina",
  70: "Bodas de Vinho",
  75: "Bodas de Brilhante",
};

export function getBodasName(years: number): string {
  if (!Number.isFinite(years) || years < 1) {
    return "Recém-casados (< 1 ano)";
  }
  return BODAS_BY_YEAR[years] ?? `${years} anos de Casados`;
}

function makeCelebrationUtcDate(year: number, month: number, day: number): Date {
  // Trata 29/02 em anos não bissextos como 28/02 para cálculo de janela próxima
  if (month === 2 && day === 29) {
    const probe = new Date(Date.UTC(year, 1, 29));
    if (probe.getUTCMonth() !== 1) {
      return new Date(Date.UTC(year, 1, 28));
    }
  }
  return new Date(Date.UTC(year, month - 1, day));
}

export function getDaysUntilNextCelebration(
  dateIso: string | null | undefined
): { daysUntil: number; turningYears: number } | null {
  if (!dateIso || !/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return null;
  const [y, m, d] = dateIso.split("-").map(Number);
  if (!y || !m || !d) return null;

  const { year: todayYear, date: todayUtc } = getRecifeToday();
  let targetYear = todayYear;
  let targetDate = makeCelebrationUtcDate(targetYear, m, d);

  if (targetDate.getTime() < todayUtc.getTime()) {
    targetYear = todayYear + 1;
    targetDate = makeCelebrationUtcDate(targetYear, m, d);
  }

  const daysUntil = Math.round(
    (targetDate.getTime() - todayUtc.getTime()) / 86_400_000
  );
  return {
    daysUntil,
    turningYears: Math.max(0, targetYear - y),
  };
}

export function getMarriageInfo(dateIso: string | null | undefined): {
  yearsCompleted: number;
  bodasLabel: string;
  isWeek: boolean;
  isToday: boolean;
  weekYears: number;
  weekBodasLabel: string;
} | null {
  if (!dateIso || !isValidPastOrTodayDate(dateIso, 1920)) return null;
  const yearsCompleted = calculateAge(dateIso);
  const week = getWeekCelebrationInfo(dateIso);
  const weekYears = week?.completingYears ?? yearsCompleted;
  return {
    yearsCompleted,
    bodasLabel: getBodasName(yearsCompleted),
    isWeek: week !== null,
    isToday: week?.isToday ?? false,
    weekYears,
    weekBodasLabel: getBodasName(weekYears),
  };
}

export function normalizeDependentKey(
  nome: string,
  dataNascimento: string
): string {
  return `${normalizeSearchText(nome)}|${dataNascimento}`;
}

export function zodIssuesToFieldErrors(
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>
): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

export function normalizeSearchText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function formatNeighborhoodLabel(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/\s+/g, " ").trim();
}

export type AgeBand = "0-11" | "12-17" | "18-29" | "30-59" | "60+";

export const AGE_BANDS: ReadonlyArray<{ key: AgeBand; label: string }> = [
  { key: "0-11", label: "Crianças (0–11)" },
  { key: "12-17", label: "Adolescentes (12–17)" },
  { key: "18-29", label: "Jovens (18–29)" },
  { key: "30-59", label: "Adultos (30–59)" },
  { key: "60+", label: "Idosos (60+)" },
];

export function getAgeBand(age: number): AgeBand {
  if (age <= 11) return "0-11";
  if (age <= 17) return "12-17";
  if (age <= 29) return "18-29";
  if (age <= 59) return "30-59";
  return "60+";
}

export function buildWhatsAppUrl(
  phone: string | null | undefined,
  message?: string
): string | null {
  const digits = cleanDigits(phone ?? "");
  if (digits.length < 10) return null;
  const intl = digits.length >= 12 && digits.startsWith("55") ? digits : `55${digits}`;
  return message
    ? `https://wa.me/${intl}?text=${encodeURIComponent(message)}`
    : `https://wa.me/${intl}`;
}

export function csvCell(value: string | number | boolean | null | undefined): string {
  const str = String(value ?? "").replace(/\r?\n/g, " ");
  // Evita execução acidental de fórmulas ao abrir em Excel/Planilhas
  const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function buildMembersCsv(input: {
  members: Member[];
  families: Family[];
  dependents: Dependent[];
  prayers?: Array<Pick<PrayerRequest, "member_id" | "motivo">>;
}): string {
  const familyMap = new Map(input.families.map((f) => [f.id, f]));
  const prayerMap = new Map(
    (input.prayers ?? []).map((p) => [p.member_id, p.motivo])
  );
  const depsByFamily = new Map<string, Dependent[]>();
  for (const dep of input.dependents) {
    const list = depsByFamily.get(dep.family_id) ?? [];
    list.push(dep);
    depsByFamily.set(dep.family_id, list);
  }

  const headers = [
    "Nome Completo",
    "CPF",
    "Sexo",
    "Nascimento",
    "Naturalidade",
    "Profissão",
    "WhatsApp",
    "E-mail",
    "Status Membresia",
    "Oficialato",
    "Status Cadastro",
    "Perfil",
    "Estado Civil",
    "Cônjuge na IPCF",
    "Nome Cônjuge",
    "Data Casamento",
    "CEP",
    "Logradouro",
    "Número",
    "Complemento",
    "Bairro",
    "Cidade",
    "Filhos / Dependentes",
    "Disponibilidade Semanal",
    "Talentos e Ministérios",
    "Maior Dificuldade (Tempo)",
    "Pedido de Oração",
    "Consentimento LGPD em",
  ];

  const rows = input.members.map((m) => {
    const fam = m.family_id ? familyMap.get(m.family_id) : undefined;
    const deps = m.family_id ? depsByFamily.get(m.family_id) ?? [] : [];
    const depsSummary = deps
      .map((d) => `${d.nome} (${formatDateBR(d.data_nascimento)})`)
      .join(" | ");

    return [
      csvCell(m.nome_completo),
      csvCell(formatCPF(m.cpf)),
      csvCell(m.sexo),
      csvCell(formatDateBR(m.data_nascimento)),
      csvCell(m.naturalidade),
      csvCell(m.profissao),
      csvCell(formatWhatsApp(m.whatsapp)),
      csvCell(m.email),
      csvCell(m.status_membresia),
      csvCell(m.oficiato),
      csvCell(m.status_cadastro),
      csvCell(m.role === "admin" ? "Administrador" : "Membro"),
      csvCell(m.estado_civil),
      csvCell(m.conjuge_congrega_ipcf ? "Sim" : "Não"),
      csvCell(m.nome_conjuge),
      csvCell(fam?.data_casamento ? formatDateBR(fam.data_casamento) : ""),
      csvCell(fam?.cep ? formatCEP(fam.cep) : ""),
      csvCell(fam?.logradouro),
      csvCell(fam?.numero),
      csvCell(fam?.complemento),
      csvCell(fam?.bairro),
      csvCell(fam?.cidade),
      csvCell(depsSummary),
      csvCell((m.disponibilidade_dias ?? []).join(", ")),
      csvCell(m.talentos_ministerios),
      csvCell(m.dificuldade_tempo),
      csvCell(prayerMap.get(m.id) ?? ""),
      csvCell(new Date(m.consentimento_em).toLocaleString("pt-BR", { timeZone: "America/Recife" })),
    ].join(";");
  });

  const bom = "\uFEFF";
  return bom + [headers.map(csvCell).join(";"), ...rows].join("\r\n");
}

export function formatDateBR(dateIso: string | null | undefined): string {
  if (!dateIso) return "—";
  const [y, m, d] = dateIso.split("-");
  if (!y || !m || !d) return dateIso;
  return `${d}/${m}/${y}`;
}

export const OFFICIAL_LGPD_TEXT =
  "Reconheço que estou fornecendo estas informações, necessárias para manter o Rol de Membros da Igreja atualizado, de forma voluntária e consciente e que estas serão armazenadas com segurança na base de dados do Portal Dados IPCF e que em hipótese alguma compartilharemos estes dados com terceiros para fins comerciais e publicitários.";

const cpfField = z
  .string()
  .transform(cleanDigits)
  .refine((val) => isValidCPF(val), { message: "Informe um CPF válido com 11 dígitos." });

const optionalCpfField = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v ? cleanDigits(v) : ""))
  .refine((v) => !v || isValidCPF(v), { message: "CPF do cônjuge inválido." });

const birthDateField = z
  .string()
  .refine((v) => isValidPastOrTodayDate(v), {
    message: "Informe uma data de nascimento válida (não pode estar no futuro).",
  });

export const dependentInputSchema = z.object({
  id: z.string().optional(),
  nome: z.string().trim().min(2, "Informe o nome completo do filho(a)."),
  data_nascimento: birthDateField,
});

export const loginSchema = z.object({
  cpf: cpfField,
  password: z.string().min(6, "A senha deve ter pelo menos 6 dígitos ou caracteres."),
});

const civilProfileShape = {
  nome_completo: z.string().trim().min(3, "Informe o nome completo."),
  sexo: z.enum(["Masculino", "Feminino"]),
  data_nascimento: birthDateField,
  naturalidade: z.string().trim().max(100).optional().default(""),
  profissao: z.string().trim().max(150).optional().default(""),
  whatsapp: z
    .string()
    .transform(cleanDigits)
    .refine((v) => v.length >= 10 && v.length <= 11, {
      message: "Informe o WhatsApp com DDD (10 ou 11 dígitos).",
    }),
  email: z
    .string()
    .trim()
    .optional()
    .default("")
    .refine((v) => !v || z.string().email().safeParse(v).success, {
      message: "Informe um e-mail válido ou deixe em branco.",
    }),

  // Endereço / Lar
  cep: z
    .string()
    .transform(cleanDigits)
    .refine((v) => v.length === 8 || v.length === 0, {
      message: "O CEP deve ter 8 dígitos.",
    }),
  logradouro: z.string().trim().min(2, "Informe o logradouro (rua/avenida)."),
  numero: z.string().trim().min(1, "Informe o número (ou S/N)."),
  complemento: z.string().trim().max(100).optional().default(""),
  bairro: z.string().trim().min(2, "Informe o bairro."),
  cidade: z.string().trim().min(2, "Informe a cidade.").default("Recife"),

  // Família & Casamento
  estado_civil: z.enum(["Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)"]),
  conjuge_congrega_ipcf: z.boolean().default(false),
  nome_conjuge: z.string().trim().optional().default(""),
  conjuge_cpf: optionalCpfField,
  data_casamento: z.string().optional().default(""),

  // Engajamento
  disponibilidade_dias: z.array(z.enum(DIAS_SEMANA)).default([]),
  talentos_ministerios: z.string().trim().max(500).optional().default(""),
  dificuldade_tempo: z.string().trim().max(300).optional().default(""),
};

function applyCivilMarriageRefinements(
  data: {
    estado_civil: string;
    nome_conjuge?: string;
    conjuge_congrega_ipcf?: boolean;
    conjuge_cpf?: string;
    data_casamento?: string;
    data_nascimento?: string;
  },
  ctx: z.RefinementCtx,
  ownCpf?: string
) {
  if (data.estado_civil !== "Casado(a)") return;

  if (!data.nome_conjuge || data.nome_conjuge.trim().length < 2) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["nome_conjuge"],
      message: "Informe o nome do cônjuge.",
    });
  }

  if (
    ownCpf &&
    data.conjuge_congrega_ipcf &&
    data.conjuge_cpf &&
    data.conjuge_cpf === ownCpf
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["conjuge_cpf"],
      message: "O CPF do cônjuge não pode ser igual ao seu.",
    });
  }

  const marriageError = validateMarriageDate(data.data_casamento, data.data_nascimento);
  if (marriageError) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["data_casamento"],
      message: marriageError,
    });
  }
}

export const censoSchema = z
  .object({
    cpf: cpfField,
    password: z.string().min(6, "Crie uma senha simples com pelo menos 6 dígitos ou caracteres."),
    ...civilProfileShape,
    dependents: z.array(dependentInputSchema).default([]),

    // Igreja & Oração Privada
    status_membresia: z.enum(["Membro Comungante", "Membro Não-Comungante", "Não-Membro"]),
    oficiato: z.enum(["Não oficial", "Diácono", "Presbítero"]).default("Não oficial"),
    pedido_oracao: z.string().trim().max(1000).optional().default(""),

    // LGPD
    consentimento_lgpd: z.literal(true, {
      message: "Você precisa concordar com o termo da LGPD para finalizar.",
    }),
  })
  .superRefine((data, ctx) => {
    applyCivilMarriageRefinements(data, ctx, data.cpf);
    if (data.status_membresia !== "Membro Comungante" && data.oficiato !== "Não oficial") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["oficiato"],
        message: "Apenas Membros Comungantes exercem oficialato (Diácono/Presbítero).",
      });
    }
  });

export const adminMemberProfileUpdateSchema = z
  .object(civilProfileShape)
  .superRefine((data, ctx) => {
    applyCivilMarriageRefinements(data, ctx);
  });

export const memberSelfUpdateSchema = z
  .object({
    ...civilProfileShape,
    pedido_oracao: z.string().trim().max(1000).optional().default(""),
  })
  .superRefine((data, ctx) => {
    applyCivilMarriageRefinements(data, ctx);
  });

export type CivilProfileUpdateInput = z.infer<typeof adminMemberProfileUpdateSchema> & {
  pedido_oracao?: string;
};

export const inviteCompletionSchema = z
  .object({
    token: z.string().uuid("Token de convite inválido."),
    cpf: cpfField,
    password: z.string().min(6, "Crie uma senha simples com pelo menos 6 caracteres."),
    sexo: z.enum(["Masculino", "Feminino"]),
    naturalidade: z.string().trim().max(100).optional().default(""),
    profissao: z.string().trim().max(150).optional().default(""),
    whatsapp: z
      .string()
      .transform(cleanDigits)
      .refine((v) => v.length >= 10 && v.length <= 11, {
        message: "Informe seu WhatsApp com DDD.",
      }),
    email: z
      .string()
      .trim()
      .optional()
      .default("")
      .refine((v) => !v || z.string().email().safeParse(v).success, {
        message: "E-mail inválido.",
      }),
    estado_civil: z
      .enum(["Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)"])
      .default("Solteiro(a)"),
    conjuge_congrega_ipcf: z.boolean().default(false),
    nome_conjuge: z.string().trim().optional().default(""),
    conjuge_cpf: optionalCpfField,
    data_casamento: z.string().optional().default(""),
    mora_com_pais: z.boolean(),
    cep: z
      .string()
      .optional()
      .default("")
      .transform(cleanDigits)
      .refine((v) => v.length === 0 || v.length === 8, {
        message: "CEP deve conter 8 dígitos (ou ficar em branco).",
      }),
    logradouro: z.string().trim().optional().default(""),
    numero: z.string().trim().optional().default(""),
    complemento: z.string().trim().max(100).optional().default(""),
    bairro: z.string().trim().optional().default(""),
    cidade: z.string().trim().optional().default("Recife"),
    status_membresia: z.enum(["Membro Comungante", "Membro Não-Comungante", "Não-Membro"]),
    disponibilidade_dias: z.array(z.enum(DIAS_SEMANA)).default([]),
    talentos_ministerios: z.string().trim().max(500).optional().default(""),
    dificuldade_tempo: z.string().trim().max(300).optional().default(""),
    pedido_oracao: z.string().trim().max(1000).optional().default(""),
    consentimento_lgpd: z.literal(true, {
      message: "Aceite o termo LGPD para concluir seu cadastro.",
    }),
  })
  .superRefine((data, ctx) => {
    applyCivilMarriageRefinements(data, ctx, data.cpf);
    if (!data.mora_com_pais) {
      if (!data.logradouro || data.logradouro.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["logradouro"],
          message: "Informe o logradouro do seu novo endereço.",
        });
      }
      if (!data.numero || data.numero.trim().length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["numero"],
          message: "Informe o número do endereço.",
        });
      }
      if (!data.bairro || data.bairro.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["bairro"],
          message: "Informe o bairro.",
        });
      }
      if (!data.cidade || data.cidade.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["cidade"],
          message: "Informe a cidade.",
        });
      }
    }
  });

export const adminStatusSchema = z.object({
  memberId: z.string().uuid(),
  status_membresia: z.enum(["Membro Comungante", "Membro Não-Comungante", "Não-Membro"]),
  oficiato: z.enum(["Não oficial", "Diácono", "Presbítero", "Pastor"]),
  status_cadastro: z.enum(["Ativo", "Ausente", "Transferido", "Falecido"]),
  role: z.enum(["membro", "admin"]),
});
