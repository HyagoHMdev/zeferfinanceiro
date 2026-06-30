# Zefer Financeiro

Sistema web de gestão financeira da imobiliária **Zefer** — substitui as planilhas
de comissões, entradas/distribuições e financeiro por um sistema único, com perfis
de acesso, dashboard, relatórios e DRE.

## Stack

- **Next.js 16** (App Router, TypeScript, Server Actions)
- **Supabase** (Postgres, Auth, Storage, RLS)
- **Tailwind CSS v4** + componentes shadcn/ui (Radix)
- **Recharts** (gráficos) · **Vitest** (testes)
- Deploy na **Vercel**

## Módulos

1. **Vendas / Comissões** — cadastro de venda com cálculo da comissão em tempo real.
2. **Pagamento de corretores** — extrato, adiantamentos, bonificações, pagamento com recibo.
3. **Entradas e Distribuições** — dízimo e distribuição automática empresa/pessoal.
4. **Financeiro** — custos fixos, despesas variáveis, investimentos, pessoal, caixa e fluxo.
5. **Dashboard, Relatórios e DRE** · **Configurações** (parâmetros, cadastros, usuários).

## Motor de cálculo

Toda a matemática vive em [`lib/calculos.ts`](lib/calculos.ts), com funções puras e
testes ([`lib/calculos.test.ts`](lib/calculos.test.ts)). A cadeia é calculada em
precisão total e arredondada (2 casas, _half away from zero_) só nos campos finais —
reproduzindo as planilhas ao centavo. Rode `npm test`.

## Configuração local

### 1. Dependências

```bash
npm install
```

### 2. Projeto Supabase

Crie um projeto em [supabase.com](https://supabase.com). Em **Project Settings → API**,
copie a **Project URL**, a **anon key** e a **service_role key**.

Copie `.env.example` para `.env.local` e preencha:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### 3. Banco de dados

Aplique as migrações **em ordem**. Duas opções:

**A) SQL Editor (mais simples):** no painel do Supabase, cole e rode, na ordem:
`supabase/migrations/0001_schema.sql`, `0002_rls.sql`, `0003_storage.sql` e por fim
`supabase/seed.sql`.

**B) Supabase CLI:**

```bash
supabase init           # se ainda não houver config.toml
supabase link --project-ref <ref-do-projeto>
supabase db push        # aplica as migrações
# rode o seed.sql pelo SQL Editor ou: psql "$DATABASE_URL" -f supabase/seed.sql
```

> O bucket de Storage `anexos` é criado pela `0003_storage.sql` (público; caminhos UUID).

### 4. Primeiro administrador

```bash
node scripts/criar-admin.mjs voce@zefer.com.br SuaSenha "Seu Nome"
```

### 5. Rodar

```bash
npm run dev
```

Acesse http://localhost:3000 e entre com o admin criado.

## Deploy na Vercel

1. Suba o repositório para o GitHub.
2. Em [vercel.com](https://vercel.com) → **Add New → Project** → importe o repositório.
3. Em **Environment Variables**, defina as três variáveis do `.env.local`.
4. **Deploy**. (O mesmo banco Supabase serve produção e desenvolvimento.)

## Perfis de acesso

- **Administrador** — acesso total, incluindo cadastros e usuários.
- **Financeiro** — opera vendas, entradas, pagamentos e financeiro.
- **Diretor** — leitura de dashboards e relatórios.
- **Corretor** — vê apenas o próprio extrato (`/meu-extrato`).

As regras são aplicadas no servidor (Server Actions) e no banco (RLS).

## Scripts

```bash
npm run dev        # desenvolvimento
npm run build      # build de produção
npm run lint       # ESLint
npm test           # testes (Vitest)
npm run typecheck  # checagem de tipos
```

## Observações

- **Recibo de pagamento**: página imprimível (`/recibo/pagamento/[id]`) — use "Salvar como PDF".
- **Dízimo** e **distribuição empresa/pessoal** são configuráveis em _Configurações → Parâmetros_
  (o documento cita 10% de dízimo como exemplo; o padrão vem zerado).
- Comece pelos cadastros (construtoras, corretores, etc.) em _Configurações → Cadastros_.
