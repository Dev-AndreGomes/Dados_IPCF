# Censo IPCF

Sistema oficial de recenseamento, gestão familiar e acompanhamento pastoral da **Igreja Presbiteriana em Casa Forte (Recife - PE)**.

## Stack Principal

- **Next.js (App Router) + React 19 + TypeScript**
- **Tailwind CSS v4** (Design System IPCF com tokens verde profundo `#12392a`, institucional `#1b4d37`, dourado `#cf9841` e papel cremoso `#faf8f3`)
- **Supabase (PostgreSQL + Auth + Row Level Security + Triggers)**
- **Zod** (Validação estrita incluindo Módulo 11 de CPF)
- **Leaflet** (Mapa interativo com camada Google Maps sem chave de API)

---

## Como Configurar e Rodar Localmente

### 1. Banco de Dados no Supabase

1. Crie um projeto gratuito no [Supabase](https://supabase.com).
2. No menu **SQL Editor**, cole e execute todo o conteúdo de:
   - `supabase/migrations/001_initial_schema.sql`
3. Em **Authentication → Providers → Email**, mantenha o provedor de Email ativo (usado internamente via Shadow Email `<cpf>@membros.ipcf.local`; os novos usuários são confirmados via `service_role` pelo servidor).

### 2. Variáveis de Ambiente

Copie `.env.example` para `.env.local` na raiz do projeto e preencha:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
ADMIN_MASTER_CPFS=00000000000
CRON_SECRET=uma-chave-aleatoria-segura
```

> **Dica de Bootstrap (`ADMIN_MASTER_CPFS`):** Informe os 11 dígitos do(s) CPF(s) do Pastor / Secretaria (separados por vírgula). Na primeira vez que essa pessoa responder ao `/censo`, a conta já nasce com perfil `admin` no Painel Pastoral (`/admin`).

### 3. Desenvolvimento Local

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`.

---

## Rotas Principais

- `/` — Portal de entrada (*Fazer Meu Censo* ou *Já tenho cadastro*)
- `/censo` — Formulário wizard em 4 etapas com ViaCEP, auto-save de rascunho local e pré-preenchimento automático entre cônjuges
- `/login` — Acesso simplificado via CPF + senha
- `/minha-ficha` — Portal de autoatendimento do membro, edição civil, gestão de filhos e geração de link mágico (`/convite/[token]`) via WhatsApp
- `/convite/[token]` — Emancipação de dependente jovem/adulto preservando genealogia e residência
- `/admin` — Painel Pastoral (KPIs, Aniversariantes e Bodas da Semana, Mapa geográfico, Disponibilidade por dia, Filtros e Exportação CSV/Excel)
- `/admin/membro/[id]` — Visão detalhada somente-leitura dos dados civis + Controles eclesiásticos + Reset de senha em 1 clique + Rota GPS
- `/api/cron/keep-alive` — Endpoint agendado em `vercel.json` (a cada 48h) para evitar pausa por inatividade no plano gratuito do Supabase

---

## Deploy na Vercel

1. Conecte o repositório na **Vercel**.
2. Cadastre todas as variáveis do `.env.local` nas **Environment Variables** da Vercel.
3. O arquivo `vercel.json` ativará automaticamente o Vercel Cron em `/api/cron/keep-alive`.
4. Os cabeçalhos `X-Robots-Tag: noindex, nofollow, noarchive` e `robots` metadata impedem que buscadores públicos indexem o portal.
