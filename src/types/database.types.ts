export type Sexo = "Masculino" | "Feminino";
export type EstadoCivil = "Solteiro(a)" | "Casado(a)" | "Divorciado(a)" | "Viúvo(a)";
export type StatusMembresia = "Membro Comungante" | "Membro Não-Comungante" | "Não-Membro";
export type Oficiato = "Não oficial" | "Diácono" | "Presbítero" | "Pastor";
export type StatusCadastro = "Ativo" | "Ausente" | "Transferido" | "Falecido";
export type Role = "membro" | "admin";

export const DIAS_SEMANA = [
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
  "Domingo",
] as const;

export type DiaSemana = (typeof DIAS_SEMANA)[number];

export interface Family {
  id: string;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string;
  cidade: string;
  latitude: number | null;
  longitude: number | null;
  data_casamento: string | null;
  created_at: string;
  updated_at: string;
}

export interface Member {
  id: string;
  user_id: string | null;
  family_id: string | null;
  cpf: string;
  nome_completo: string;
  sexo: Sexo;
  data_nascimento: string;
  naturalidade: string | null;
  profissao: string | null;
  whatsapp: string;
  email: string | null;
  estado_civil: EstadoCivil;
  conjuge_congrega_ipcf: boolean;
  nome_conjuge: string | null;
  conjuge_cpf: string | null;
  pai_membro_id: string | null;
  mae_membro_id: string | null;
  disponibilidade_dias: string[];
  talentos_ministerios: string | null;
  dificuldade_tempo: string | null;
  status_membresia: StatusMembresia;
  oficiato: Oficiato;
  status_cadastro: StatusCadastro;
  role: Role;
  consentimento_lgpd: boolean;
  consentimento_em: string;
  created_at: string;
  updated_at: string;
}

export interface Dependent {
  id: string;
  family_id: string;
  nome: string;
  data_nascimento: string;
  promovido_membro_id: string | null;
  created_at: string;
}

export interface MemberInvite {
  token: string;
  dependent_id: string;
  family_id: string;
  criado_por: string | null;
  usado: boolean;
  expires_at: string;
  created_at: string;
}

export interface PrayerRequest {
  id: string;
  member_id: string;
  motivo: string;
  updated_at: string;
}

export interface MemberWithFamily extends Member {
  family: Family | null;
  dependents: Dependent[];
  prayer_request?: PrayerRequest | null;
  spouse?: Pick<Member, "id" | "nome_completo" | "cpf" | "whatsapp" | "status_membresia"> | null;
  pai?: Pick<Member, "id" | "nome_completo"> | null;
  mae?: Pick<Member, "id" | "nome_completo"> | null;
}

export interface SpousePrefillData {
  found: boolean;
  prefilledMemberName?: string;
  spouseName?: string;
  spouseCpf?: string;
  familyId?: string;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string;
  cidade?: string;
  data_casamento?: string | null;
  dependents?: Array<{ nome: string; data_nascimento: string }>;
}
