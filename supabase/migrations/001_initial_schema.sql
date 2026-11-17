-- ==============================================================================
-- CENSO IPCF — Schema Oficial Supabase (PostgreSQL + RLS + Triggers)
-- Igreja Presbiteriana em Casa Forte (Recife - PE)
-- Execute este script completo no SQL Editor do seu projeto Supabase.
-- ==============================================================================

-- 1. EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. FUNÇÃO DE VALIDAÇÃO MATEMÁTICA DE CPF (MÓDULO 11)
CREATE OR REPLACE FUNCTION public.is_valid_cpf(cpf_input TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    cpf TEXT := regexp_replace(COALESCE(cpf_input, ''), '\D', '', 'g');
    sum1 INT := 0;
    sum2 INT := 0;
    rem1 INT;
    rem2 INT;
    i INT;
BEGIN
    IF length(cpf) != 11 OR cpf ~ '^(\d)\1{10}$' THEN
        RETURN FALSE;
    END IF;

    FOR i IN 1..9 LOOP
        sum1 := sum1 + substring(cpf FROM i FOR 1)::INT * (11 - i);
    END LOOP;
    rem1 := (sum1 * 10) % 11;
    IF rem1 = 10 THEN rem1 := 0; END IF;
    IF rem1 != substring(cpf FROM 10 FOR 1)::INT THEN
        RETURN FALSE;
    END IF;

    FOR i IN 1..10 LOOP
        sum2 := sum2 + substring(cpf FROM i FOR 1)::INT * (12 - i);
    END LOOP;
    rem2 := (sum2 * 10) % 11;
    IF rem2 = 10 THEN rem2 := 0; END IF;
    IF rem2 != substring(cpf FROM 11 FOR 1)::INT THEN
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. TABELA DE NÚCLEOS FAMILIARES / LARES
CREATE TABLE public.families (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cep VARCHAR(8),
    logradouro VARCHAR(255),
    numero VARCHAR(30),
    complemento VARCHAR(100),
    bairro VARCHAR(100) NOT NULL DEFAULT 'Casa Forte',
    cidade VARCHAR(100) NOT NULL DEFAULT 'Recife',
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    data_casamento DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. TABELA DE MEMBROS
CREATE TABLE public.members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
    family_id UUID REFERENCES public.families(id) ON DELETE SET NULL,

    -- Identificação Pessoal
    cpf VARCHAR(11) UNIQUE NOT NULL CHECK (public.is_valid_cpf(cpf)),
    nome_completo VARCHAR(255) NOT NULL,
    sexo VARCHAR(10) NOT NULL CHECK (sexo IN ('Masculino', 'Feminino')),
    data_nascimento DATE NOT NULL,
    naturalidade VARCHAR(100),
    profissao VARCHAR(150),
    whatsapp VARCHAR(15) NOT NULL,
    email VARCHAR(255),

    -- Vínculo Conjugal & Genealógico
    estado_civil VARCHAR(20) NOT NULL DEFAULT 'Solteiro(a)'
        CHECK (estado_civil IN ('Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)')),
    conjuge_congrega_ipcf BOOLEAN NOT NULL DEFAULT FALSE,
    nome_conjuge VARCHAR(255),
    conjuge_cpf VARCHAR(11),
    pai_membro_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
    mae_membro_id UUID REFERENCES public.members(id) ON DELETE SET NULL,

    -- Engajamento & Voluntariado
    disponibilidade_dias TEXT[] NOT NULL DEFAULT '{}',
    talentos_ministerios TEXT,
    dificuldade_tempo TEXT,

    -- Controle Eclesiástico (Preenchido inicialmente no Censo; promovido apenas por Admin)
    status_membresia VARCHAR(30) NOT NULL DEFAULT 'Não-Membro'
        CHECK (status_membresia IN ('Membro Comungante', 'Membro Não-Comungante', 'Não-Membro')),
    oficiato VARCHAR(20) NOT NULL DEFAULT 'Não oficial'
        CHECK (oficiato IN ('Não oficial', 'Diácono', 'Presbítero', 'Pastor')),
    status_cadastro VARCHAR(20) NOT NULL DEFAULT 'Ativo'
        CHECK (status_cadastro IN ('Ativo', 'Ausente', 'Transferido', 'Falecido')),
    role VARCHAR(20) NOT NULL DEFAULT 'membro'
        CHECK (role IN ('membro', 'admin')),

    -- LGPD & Auditoria Enxuta
    consentimento_lgpd BOOLEAN NOT NULL DEFAULT TRUE,
    consentimento_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices úteis para buscas de cônjuge e filtros administrativos
CREATE INDEX idx_members_conjuge_cpf ON public.members(conjuge_cpf) WHERE conjuge_cpf IS NOT NULL;
CREATE INDEX idx_members_family_id ON public.members(family_id);
CREATE INDEX idx_members_status_cadastro ON public.members(status_cadastro);

-- 5. TABELA DE DEPENDENTES (FILHOS)
CREATE TABLE public.dependents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    data_nascimento DATE NOT NULL,
    promovido_membro_id UUID UNIQUE REFERENCES public.members(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dependents_family_id ON public.dependents(family_id);

-- 6. TABELA DE CONVITES DE EMANCIPAÇÃO (LINK MÁGICO PARA FILHOS)
CREATE TABLE public.member_invites (
    token UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dependent_id UUID NOT NULL REFERENCES public.dependents(id) ON DELETE CASCADE,
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    criado_por UUID REFERENCES public.members(id) ON DELETE SET NULL,
    usado BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. TABELA DE PEDIDO DE ORAÇÃO ATUAL (1:1 INDIVIDUAL E SIGILOSA)
CREATE TABLE public.prayer_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id UUID UNIQUE NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    motivo TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. TRIGGERS DE ATUALIZAÇÃO AUTOMÁTICA DE updated_at E PROTEÇÃO DE PRIVILÉGIOS
CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_families_timestamp
BEFORE UPDATE ON public.families
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

CREATE TRIGGER update_members_timestamp
BEFORE UPDATE ON public.members
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

CREATE TRIGGER update_prayers_timestamp
BEFORE UPDATE ON public.prayer_requests
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- Trigger de Blindagem: Impede que um membro comum altere seu próprio 'role', 'status_membresia', 'oficiato', 'status_cadastro' ou 'cpf'
CREATE OR REPLACE FUNCTION public.protect_ecclesiastical_columns()
RETURNS TRIGGER AS $$
DECLARE
    caller_role TEXT;
BEGIN
    IF COALESCE(auth.role(), '') = 'authenticated' THEN
        SELECT role INTO caller_role FROM public.members WHERE user_id = auth.uid() LIMIT 1;
        IF COALESCE(caller_role, 'membro') IS DISTINCT FROM 'admin' THEN
            NEW.role := OLD.role;
            NEW.status_membresia := OLD.status_membresia;
            NEW.oficiato := OLD.oficiato;
            NEW.status_cadastro := OLD.status_cadastro;
            NEW.cpf := OLD.cpf;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER enforce_member_column_security
BEFORE UPDATE ON public.members
FOR EACH ROW
EXECUTE FUNCTION public.protect_ecclesiastical_columns();

-- 9. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dependents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prayer_requests ENABLE ROW LEVEL SECURITY;

-- Funções Auxiliares Seguras (SECURITY DEFINER evita recursão infinita em policies)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS VARCHAR AS $$
    SELECT role FROM public.members WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_my_family_id()
RETURNS UUID AS $$
    SELECT family_id FROM public.members WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Políticas: MEMBERS
CREATE POLICY "Leitura: proprio membro, conjuge da mesma familia ou admin"
ON public.members FOR SELECT
USING (
    user_id = auth.uid()
    OR (family_id IS NOT NULL AND family_id = public.get_my_family_id())
    OR public.get_my_role() = 'admin'
);

CREATE POLICY "Edicao Pessoal: membro edita apenas a si mesmo"
ON public.members FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Gestao Admin: admin visualiza e promove status"
ON public.members FOR ALL
USING (public.get_my_role() = 'admin')
WITH CHECK (public.get_my_role() = 'admin');

-- Políticas: FAMILIES, DEPENDENTS & INVITES (Compartilhados pelo Casal)
CREATE POLICY "Acesso ao Lar: membros da familia ou admin"
ON public.families FOR ALL
USING (id = public.get_my_family_id() OR public.get_my_role() = 'admin')
WITH CHECK (id = public.get_my_family_id() OR public.get_my_role() = 'admin');

CREATE POLICY "Acesso aos Filhos: pais da familia ou admin"
ON public.dependents FOR ALL
USING (family_id = public.get_my_family_id() OR public.get_my_role() = 'admin')
WITH CHECK (family_id = public.get_my_family_id() OR public.get_my_role() = 'admin');

CREATE POLICY "Convites de Filhos: pais da familia ou admin gerenciam convites"
ON public.member_invites FOR ALL
USING (family_id = public.get_my_family_id() OR public.get_my_role() = 'admin')
WITH CHECK (family_id = public.get_my_family_id() OR public.get_my_role() = 'admin');

-- Políticas: PRAYER_REQUESTS (Sigilo Absoluto — Cônjuge NÃO vê!)
CREATE POLICY "Oracao Privada: apenas o autor ou admin"
ON public.prayer_requests FOR ALL
USING (
    member_id = (SELECT id FROM public.members WHERE user_id = auth.uid() LIMIT 1)
    OR public.get_my_role() = 'admin'
)
WITH CHECK (
    member_id = (SELECT id FROM public.members WHERE user_id = auth.uid() LIMIT 1)
    OR public.get_my_role() = 'admin'
);
