# Catálogo Digital Alfa Eletrônicos

Aplicação web desenvolvida pela **NexaFlow** para a **Alfa Eletrônicos**.

Vitrine digital profissional com catálogo público e painel administrativo completo.

---

## Tecnologias

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 19 + TypeScript |
| Build | Vite |
| Estilização | Tailwind CSS |
| Backend/DB | Supabase (PostgreSQL) |
| Autenticação | Supabase Auth |
| Armazenamento | Supabase Storage |
| Hospedagem | Vercel |

---

## Pré-requisitos

- Node.js 18+
- npm 9+
- Conta no [Supabase](https://supabase.com)
- Conta na [Vercel](https://vercel.com) (para publicação)

---

## Instalação

```bash
# Clone o repositório
git clone <url-do-repositório>
cd catalogo-virtual-alfa

# Instale as dependências
npm install

# Copie o arquivo de variáveis de ambiente
cp .env.example .env.local
```

---

## Variáveis de Ambiente

Edite `.env.local` com as suas credenciais do Supabase:

```env
VITE_SUPABASE_URL=https://SEU_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_publica_anon_aqui
VITE_APP_URL=http://localhost:5173
```

> Nunca commite o arquivo `.env.local` com credenciais reais.

---

## Execução local

```bash
npm run dev
```

Acesse em: `http://localhost:5173`

---

## Configuração do Supabase

### 1. Criar o projeto

1. Acesse [supabase.com](https://supabase.com) e crie um novo projeto
2. Aguarde a inicialização completa
3. Copie a **URL do projeto** e a **anon key** (Settings -> API)

### 2. Executar migrações

No **SQL Editor** do Supabase, execute em ordem:

```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_storage_policies.sql
```

### 3. Criar buckets de Storage

No painel do Supabase -> **Storage** -> **New bucket**:

| Nome | Tipo |
|------|------|
| `product-images` | Público |
| `store-assets` | Público |

Após criar os buckets, execute o arquivo `002_storage_policies.sql`.

### 4. Criar o primeiro administrador

**Método recomendado:**
1. No painel -> **Authentication** -> **Users** -> **Invite user**
2. Insira o e-mail do administrador
3. O usuário receberá um e-mail para definir a senha
4. Acesse `/admin/login` com as credenciais definidas

---

## Estrutura do Projeto

```
src/
├── components/
│   ├── ui/          # Botões, inputs, modais, estados
│   ├── layout/      # Cabeçalho, rodapé, admin layout
│   └── catalog/     # Cards de produto
├── pages/
│   ├── public/      # Início, catálogo, produto
│   └── admin/       # Login, dashboard, produtos, categorias, configurações
├── services/        # Comunicação com Supabase
├── hooks/           # AuthContext, StoreContext
├── lib/             # Cliente Supabase, utilitários
└── types/           # Interfaces TypeScript
```

---

## Publicação na Vercel

### Deploy

```bash
npm i -g vercel
vercel login
vercel --prod
```

### Variáveis de ambiente na Vercel

No painel -> **Settings** -> **Environment Variables**:

| Variável | Valor |
|----------|-------|
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Chave anon pública |
| `VITE_APP_URL` | URL do site em produção |

---

## Configurações Pós-Deploy

1. **Login**: `/admin/login`
2. **Loja**: `/admin/configuracoes` -> configure nome, WhatsApp, logo
3. **Categorias**: `/admin/categorias`
4. **Produtos**: `/admin/produtos/novo`

---

## WhatsApp

Formato obrigatório: `5511999999999` (código do país + DDD + número)

---

## Segurança

- Row Level Security (RLS) ativado em todas as tabelas
- Visitantes anônimos leem apenas produtos/categorias publicados
- Escrita restrita a usuários autenticados
- Nenhuma credencial privada exposta no frontend

---

**NexaFlow** para **Alfa Eletrônicos**
