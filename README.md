# BIM Elétrico — Documentação Completa

> Acompanhamento de Instalações Elétricas com visualizador 3D BIM

**URL em produção:** https://bim-electrical-dashboard.vercel.app  
**Stack:** Next.js 16 · React 18 · TypeScript · Tailwind CSS · xeokit-sdk · Drizzle ORM  
**Armazenamento:** localStorage (padrão) ou NeonDB Postgres (opcional)

---

## Sumário

1. [Visão geral](#1-visão-geral)
2. [Funcionalidades](#2-funcionalidades)
3. [Estrutura de arquivos](#3-estrutura-de-arquivos)
4. [Dependências](#4-dependências)
5. [Como rodar localmente](#5-como-rodar-localmente)
6. [Arquitetura](#6-arquitetura)
7. [Tipos principais](#7-tipos-principais)
8. [Camada de dados](#8-camada-de-dados)
9. [Viewer 3D — xeokit](#9-viewer-3d--xeokit)
10. [API Routes](#10-api-routes)
11. [PWA e mobile](#11-pwa-e-mobile)
12. [Variáveis de ambiente](#12-variáveis-de-ambiente)
13. [Deploy — Vercel](#13-deploy--vercel)
14. [Deploy — Netlify](#14-deploy--netlify)
15. [NeonDB (opcional)](#15-neondb-opcional)
16. [Password gate (opcional)](#16-password-gate-opcional)
17. [Segurança](#17-segurança)
18. [Problemas conhecidos e soluções](#18-problemas-conhecidos-e-soluções)

---

## 1. Visão geral

Sistema web para acompanhamento de progresso de instalações elétricas sobre modelos BIM (IFC/XKT). O técnico carrega o modelo 3D no browser, clica em elementos, registra status de execução, horas trabalhadas, equipe e fotos. Os dados ficam no localStorage do dispositivo (sem servidor obrigatório) ou no Supabase se configurado.

---

## 2. Funcionalidades

| Funcionalidade | Descrição |
|---|---|
| Carregar IFC | Carrega modelo IFC diretamente no browser via WebIFC/WASM |
| Carregar XKT | Carrega modelo XKT (formato otimizado do xeokit) via ArrayBuffer |
| Carregar ZIP | Descompacta ZIP contendo .ifc ou .xkt automaticamente (fflate) |
| Converter IFC→XKT | Envia IFC para `/api/convert`, recebe XKT para download |
| Selecionar elemento | Clique/toque no modelo → painel lateral com dados do elemento |
| Registrar progresso | Status, quantidade, equipe, horas, produtividade, observações, foto |
| Câmera mobile | Botão "Câmera" usa `capture="environment"` para abrir câmera traseira |
| Filtros | Por status, pavimento (IfcBuildingStorey) e tipo de elemento |
| Barra de progresso | Conta todos os elementos do modelo como denominador |
| Exportar/Importar | JSON com todos os registros do projeto |
| Relatório | Modal com tabela por pavimento, exportável para PDF/impressão |
| PWA | Instalável no celular, funciona offline |
| Full screen mobile | Viewer 3D ocupa 100% da tela; painel desliza de baixo (bottom sheet) |
| Auth local com hash | Senhas hasheadas com bcryptjs (rounds=10); migração automática de plaintext legado |
| CSRF + rate limit | Double-submit cookie em rotas mutativas; 5 tentativas/5min/IP em `/login` |
| Validação de input | Schemas Zod em `/api/execution` e limite de 200 MB em uploads IFC |
| Observabilidade | Sentry captura falhas no viewer, save de progresso e login (opt-in via DSN) |

---

## 3. Estrutura de arquivos

```
bim-electrical-dashboard/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── convert/route.ts          # IFC → XKT server-side
│   │   │   └── execution/route.ts        # CRUD execução (Supabase)
│   │   ├── globals.css
│   │   ├── layout.tsx                    # PWA meta tags + Service Worker
│   │   ├── manifest.ts                   # PWA manifest
│   │   └── page.tsx                      # Página principal + layout mobile
│   ├── components/
│   │   ├── filters/FilterBar.tsx         # Filtros de status/pavimento/tipo
│   │   ├── panel/
│   │   │   ├── ElementPanel.tsx          # Painel lateral do elemento selecionado
│   │   │   ├── ProductivityCard.tsx      # Card de produtividade calculada
│   │   │   └── ProgressForm.tsx          # Formulário de registro + câmera
│   │   ├── ui/
│   │   │   ├── ProgressSummary.tsx       # Barra de progresso geral
│   │   │   └── ReportModal.tsx           # Modal de relatório imprimível
│   │   └── viewer/
│   │       ├── BIMViewer.tsx             # Canvas xeokit + loading/error states
│   │       ├── ModelUploader.tsx         # Tela de upload (IFC/XKT/ZIP)
│   │       └── ViewerControls.tsx        # Busca, filtro pavimento, XKT converter
│   ├── hooks/
│   │   ├── useExecution.ts               # Estado de registros + CRUD
│   │   └── useXeokit.ts                  # Inicialização do viewer + pick/touch
│   ├── lib/
│   │   ├── api/
│   │   │   ├── execution.ts              # Funções CRUD (Supabase ou localStorage)
│   │   │   └── schemas.ts                # Schemas Zod (ExecutionUpsertSchema, limites)
│   │   ├── auth/index.ts                 # signIn/signUp + bcryptjs + migração de plaintext
│   │   ├── observability/sentry.ts       # Wrapper opcional do Sentry
│   │   ├── security/
│   │   │   ├── csrf.ts                   # assertCsrf + token (double-submit)
│   │   │   ├── csrfClient.ts             # csrfFetch helper (lado cliente)
│   │   │   └── rateLimit.ts              # Limit in-memory por IP
│   │   ├── shims/
│   │   │   ├── fs.js                     # Stub de `fs` para browser
│   │   │   └── path.js                   # Stub de `path` para browser
│   │   ├── storage/
│   │   │   ├── constants.ts              # Prefixos centralizados (EXEC_, DAILY_, …)
│   │   │   ├── extras.ts                 # Comments, annotations, history (audit)
│   │   │   └── local.ts                  # localStorage CRUD completo
│   │   ├── supabase/
│   │   │   ├── client.ts                 # Lazy client (não quebra sem variáveis)
│   │   │   └── schema.sql                # Schema SQL completo
│   │   └── viewer/
│   │       ├── colorizer.ts              # Colorir elementos por status
│   │       └── elementMapper.ts          # Mapear GlobalId ↔ objectId + nível
│   ├── middleware.ts                     # Basic Auth + cookie CSRF + rate limit /login
│   └── types/
│       ├── index.ts                      # Todos os tipos TypeScript
│       └── xeokit.d.ts                   # Shim de tipos (xeokit-sdk publica .d.ts quebrados)
├── public/
│   ├── icon.svg                          # Ícone PWA
│   ├── icon-maskable.svg                 # Ícone PWA maskable (Android)
│   └── sw.js                             # Service Worker (cache offline)
├── .npmrc                                # legacy-peer-deps=true
├── netlify.toml                          # Configuração Netlify
├── next.config.mjs                       # Aliases webpack/turbopack
├── vercel.json                           # Configuração Vercel
└── package.json
```

---

## 4. Dependências

### Produção

| Pacote | Versão | Uso |
|---|---|---|
| `next` | ^16.2.4 | Framework React (App Router) |
| `react` / `react-dom` | ^18 | UI |
| `@xeokit/xeokit-sdk` | ^2.6.36 | Viewer 3D BIM (WebGL) |
| `@xeokit/xeokit-convert` | ^1.3.1 | Conversão IFC→XKT no servidor |
| `web-ifc` | ^0.0.51 | Parser IFC via WebAssembly |
| `fflate` | ^0.8.2 | Descompactação ZIP no browser |
| `@supabase/supabase-js` | ^2.43.4 | Banco de dados (opcional) |
| `lucide-react` | ^0.383.0 | Ícones |
| `bcryptjs` | ^2.4.3 | Hash de senha (auth local) |
| `zod` | ^3.23.8 | Validação de input nas API routes |
| `@sentry/nextjs` | ^8.45.0 | Captura opcional de erros em produção |
| `drizzle-orm` | ^0.45.2 | ORM tipado para NeonDB Postgres |
| `@neondatabase/serverless` | ^1.1.0 | Driver Postgres serverless |

### Dev

| Pacote | Versão | Uso |
|---|---|---|
| `tailwindcss` | ^3.4.4 | CSS utilitário |
| `typescript` | ^5 | Tipagem |
| `@netlify/plugin-nextjs` | ^5.15.10 | Deploy no Netlify |

### `.npmrc` (obrigatório)
```
legacy-peer-deps=true
```
Necessário porque `eslint-config-next@16` exige ESLint 9+, mas o projeto usa ESLint 8.

---

## 5. Como rodar localmente

```bash
# Clonar / abrir a pasta do projeto
cd bim-electrical-dashboard

# Instalar dependências
npm install

# Iniciar em desenvolvimento
npm run dev
# → http://localhost:3000

# Build de produção
npm run build
npm run start
```

**Node.js recomendado:** 20.x (o 24.x funciona mas pode ter avisos de deprecação no build)

---

## 6. Arquitetura

### Fluxo principal

```
ModelUploader
  ↓ (arquivo IFC/XKT/ZIP)
  → processFiles() — lê como ArrayBuffer, descompacta ZIP se necessário
  → onModelLoad({ type, name, data: ArrayBuffer })

BIMViewer
  ↓ useXeokit({ model })
  → inicializa Viewer (xeokit) no <canvas id="xeokit-canvas">
  → carrega modelo via WebIFCLoaderPlugin ou XKTLoaderPlugin
  → on('loaded'): buildGlobalIdMap, buildLevelMap, conta elementos
  → mouseclicked / touchend → pickAndSelect → onElementSelect(IFCElement)

page.tsx
  ↓ handleElementSelect(element)
  → loadElementRecord(globalId)  [localStorage ou Supabase]
  → setSelectedElement → abre bottom sheet (mobile) ou painel lateral (desktop)

ProgressForm
  ↓ handleSubmit
  → saveRecord(element, form)
  → upsertExecutionRecord → localStorage ou Supabase
  → applyColors(records) → atualiza cores no viewer
```

### Supabase vs localStorage

O sistema detecta automaticamente se o Supabase está configurado via `isSupabaseReady()`:

```ts
function isSupabaseReady(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  return url.startsWith('https://') && !url.includes('YOUR_PROJECT') && key.length > 10
}
```

Se não estiver configurado (padrão), todos os dados vão para `localStorage` com prefixo `bim_exec_{projectId}_{globalId}`.

---

## 7. Tipos principais

```ts
// src/types/index.ts

type ExecutionStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'ISSUE'

interface IFCElement {
  globalId: string    // IFC GlobalId (ex: "3Zkc5p5KH1d8olZ6VoTX$g")
  name:     string    // Nome do elemento no modelo
  type:     string    // Tipo IFC (ex: "IfcCableCarrierSegment")
  level:    string    // Pavimento (IfcBuildingStorey)
  objectId?: string   // ID interno do xeokit
}

interface ExecutionRecord {
  id?:                string
  project_id:         string
  ifc_global_id:      string
  element_name:       string
  element_type:       string
  level:              string
  status:             ExecutionStatus
  executed_quantity:  number
  team_size:          number
  worked_hours:       number
  productivity:       number   // calculado: qty / (team × hours)
  notes:              string
  photo_url?:         string
  created_at?:        string
}

interface LoadedModel {
  type:     'xkt' | 'ifc'
  url:      string         // blob URL (raramente usado)
  metaUrl?: string         // URL do JSON de metadados (XKT)
  name:     string         // nome do arquivo
  data?:    ArrayBuffer    // conteúdo binário (usado para evitar bug de blob URL no xeokit)
}
```

---

## 8. Camada de dados

### `src/lib/api/execution.ts`
Funções públicas usadas pelo app. Tentam Supabase, fazem fallback para localStorage:

```ts
getExecutionRecord(projectId, globalId)     → ExecutionRecord | null
getProjectRecords(projectId, filters?)      → ExecutionRecord[]
upsertExecutionRecord(projectId, element, form, photoUrl?) → ExecutionRecord
uploadExecutionPhoto(projectId, globalId, file) → string (URL)
getProjectLevels(projectId)                 → string[]
getProjectElementTypes(projectId)           → string[]
exportProjectData(projectId)                → string (JSON)
importProjectData(projectId, json)          → number (qtd importada)
```

### `src/lib/storage/local.ts`
CRUD direto no localStorage. Chave: `bim_exec_{projectId}_{globalId}`.

### `src/lib/supabase/client.ts`
Cliente lazy — só instancia quando chamado, usa `placeholder.supabase.co` durante o build:

```ts
// Nunca quebra o build mesmo sem variáveis de ambiente
export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, prop) {
    if (!_client) _client = getSupabaseClient()
    return (_client as any)[prop]
  },
})
```

---

## 9. Viewer 3D — xeokit

### Conceitos críticos

**xeokit tem dois espaços separados:**
- `viewer.scene.objects` — objetos renderizáveis (geometria, cores, visibilidade)
- `viewer.metaScene.metaObjects` — metadados IFC (nome, tipo, hierarquia)

Ambos são indexados pelo mesmo IFC GlobalId. O `MetaObject.parent` é uma **referência de objeto**, não uma string — a travessia de hierarquia deve usar `node.parent` diretamente.

### Detecção de pavimento

```ts
// Percorre a cadeia de pais até encontrar IfcBuildingStorey
function findStorey(node: any): string | null {
  if (!node) return null
  if (node.type === 'IfcBuildingStorey') return node.name
  return findStorey(node.parent ?? null)  // parent é objeto, não string
}
```

### Seleção por toque (mobile)

O hook `useXeokit` implementa detecção de tap com tolerância de 22px:

```ts
// Tenta pick exato → se falhar, busca em espiral ao redor
function pickAndSelect(canvasPos: number[]) {
  let pick = viewer.scene.pick({ canvasPos, pickSurface: true })
  if (!pick) {
    const radius = 22  // px de tolerância
    // busca em espiral em 3 raios, 12 direções
  }
  // seleciona elemento encontrado
}

// Tap = movimento < 12px e duração < 300ms
canvas.addEventListener('touchend', (e) => {
  const isTap = distancia < 12 && tempo < 300
  if (isTap) pickAndSelect([x, y])
})
```

### Carregamento de XKT

**Nunca use `src: blobUrl` para XKT** — o xeokit faz uma requisição HTTP ao servidor para checar o arquivo e isso falha com blob URLs. Use sempre `xkt: ArrayBuffer`:

```ts
xktParams.xkt = model.data  // ArrayBuffer direto
```

### WASM do web-ifc

O IFC usa WebAssembly. O arquivo `web-ifc.wasm` precisa estar acessível. Em dev, o Turbopack serve automaticamente. Em produção (Netlify/Vercel), o `next.config.mjs` resolve o alias:

```js
config.resolve.alias['web-ifc'] = path.resolve(__dirname, 'node_modules/web-ifc/web-ifc-api.js')
```

---

## 10. API Routes

### `POST /api/convert`

Converte IFC → XKT no servidor.

**Request:** `FormData` com campo `file` (arquivo `.ifc`, até 200 MB) + header `x-csrf-token`  
**Response:** `application/octet-stream` (binário XKT) · 413 se exceder o limite · 403 se faltar token CSRF válido

**Funcionamento:**
1. Recebe o arquivo IFC
2. Importa `@xeokit/xeokit-convert` e `web-ifc` dinamicamente
3. Resolve o diretório WASM via `createRequire(import.meta.url)`
4. Faz patch do `IfcAPI.SetWasmPath` para usar URL absoluta `file://`
5. Chama `convert2xkt()` e retorna o XKT

**Timeout:** 60s local, 26s Netlify Pro, 10s Netlify Free

### `GET /api/execution`

Parâmetros: `project_id`, `ifc_global_id` (opcional)  
Retorna registros do Supabase.

### `POST /api/execution`

Body JSON validado por `ExecutionUpsertSchema` (Zod). Exige header
`x-csrf-token` que bate com o cookie `csrf_token` (use `csrfFetch` no
cliente). Faz upsert no Postgres com `onConflict: (project_id, ifc_global_id)`.
Retorna 400 com `issues[]` em caso de schema inválido, 403 em CSRF
ausente/inválido, 503 quando `DATABASE_URL` não está configurado.

---

## 11. PWA e mobile

### Manifest

`src/app/manifest.ts` — gerado automaticamente pelo Next.js em `/manifest.webmanifest`:

```ts
{
  name: 'BIM Elétrico',
  short_name: 'BIM',
  display: 'standalone',
  theme_color: '#2563eb',
  icons: [
    { src: '/icon.svg', sizes: 'any', purpose: 'any' },
    { src: '/icon-maskable.svg', sizes: 'any', purpose: 'maskable' },
  ]
}
```

### Service Worker

`public/sw.js` — estratégia cache-first para assets estáticos:
- Pré-cacheia `/`, `/manifest.webmanifest`, ícones
- Não intercepta rotas `/api/` nem origens externas
- Atualiza cache em background quando há nova versão

### Layout mobile

No mobile (< `md` = 768px):
- Viewer ocupa 100% da largura e altura disponível
- Barra de progresso, filtros e legenda ficam ocultos
- Cabeçalho compacto (só ícone + botões sem texto)
- Elemento selecionado abre **bottom sheet** com animação `translate-y`
- Backdrop semitransparente escurece o viewer; toque fora fecha

### Câmera no formulário

```tsx
// Câmera traseira diretamente (mobile)
<input type="file" accept="image/*" capture="environment" ... />

// Galeria
<input type="file" accept="image/*" ... />
```

---

## 12. Variáveis de ambiente

Crie um `.env.local` na raiz do projeto:

```env
# ID do projeto (usado como prefixo no localStorage)
NEXT_PUBLIC_PROJECT_ID=minha-obra-2024

# NeonDB Postgres (opcional — sem isso, usa localStorage)
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require

# Password gate (opcional — protege todo o domínio com Basic Auth)
SITE_PASSWORD=
SITE_USERNAME=admin

# Supabase Auth — em standby (não usado em produção; auth roda em modo local)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Sentry (opcional — sem DSN o wrapper vira no-op e cai pra console.error)
NEXT_PUBLIC_SENTRY_DSN=
```

Sem Supabase configurado, **tudo funciona normalmente** via localStorage.

---

## 13. Deploy — Vercel (recomendado)

```bash
npm install -g vercel
vercel login
vercel --prod
```

Responder durante o setup:
- Link to existing project? → **N**
- Project name → `bim-eletrico` (ou outro)
- Override settings? → **N**

Redeploy após mudanças:
```bash
vercel --prod
```

**`vercel.json`:**
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "functions": {
    "src/app/api/convert/route.ts": { "maxDuration": 60 }
  }
}
```

---

## 14. Deploy — Netlify

**`netlify.toml`:**
```toml
[build]
  command   = "npm run build"
  publish   = ".next"

[build.environment]
  NODE_VERSION = "20"

[[plugins]]
  package = "@netlify/plugin-nextjs"

[functions]
  node_bundler = "nft"
  included_files = ["node_modules/web-ifc/**"]
```

Via CLI:
```bash
npm install -g netlify-cli
netlify login
netlify deploy --build --prod
```

**Atenção:** timeout de 10s no plano gratuito para `/api/convert`. Arquivos IFC grandes falharão.

---

## 15. NeonDB (opcional)

Para persistir dados de execução na nuvem (multi-dispositivo), o app usa
**NeonDB** (Postgres serverless) via **Drizzle ORM**. Sem isso configurado,
tudo cai automaticamente no `localStorage` (igual à versão sem banco).

### Setup

1. Crie um projeto em [neon.tech](https://neon.tech) (plano grátis)
2. Abra **Dashboard → SQL Editor**, cole o conteúdo de `drizzle/init.sql`
   e execute. Isso cria a tabela `execution_records` com índices e trigger.
3. Em **Connection Details**, copie a connection string (formato
   `postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require`).
4. No Vercel: **Settings → Environment Variables** → adicionar:
   ```
   DATABASE_URL = postgresql://user:pass@ep-xxx.../neondb?sslmode=require
   ```
5. Faça redeploy.

### Como funciona

- O cliente Drizzle em `src/lib/db/client.ts` é **lazy** — só conecta na
  primeira query, não quebra o build se a env var faltar.
- A função `isDatabaseReady()` checa `DATABASE_URL` e decide se vai pro
  Neon ou cai no `localStorage`. Toda função em `src/lib/api/execution.ts`
  segue esse padrão (try Neon → catch → localStorage).
- Fotos são comprimidas a 1024px @ 65% JPEG e armazenadas como base64 na
  coluna `photo_url` (TEXT). Sem necessidade de bucket de storage separado.

### Migração de dados locais → nuvem

Após configurar `DATABASE_URL` e fazer redeploy, ao abrir a página
`/projects` o app detecta automaticamente registros antigos no
localStorage e mostra um banner **"Encontramos N registros salvos…
Migrar para a nuvem?"**. Um clique faz upsert em batch via
`/api/migrate` e marca a flag `bim_migrated_to_cloud=true` no
localStorage para não exibir de novo.

### Schema

Definido em `src/lib/db/schema.ts` (Drizzle). Para regenerar o SQL após
mudanças:
```bash
npx drizzle-kit generate
```
> **Nota:** o `drizzle/init.sql` é um arquivo curado com índices, CHECK
> constraint do status e trigger de `updated_at`, coisas que o
> drizzle-kit não emite. Não é regenerado automaticamente.

---

## 16. Password gate (opcional)

Enquanto a auth de usuário está em standby, dá pra proteger o domínio
inteiro com HTTP Basic Auth via `src/middleware.ts`. Ative com env vars
no Vercel:

```env
SITE_PASSWORD = sua-senha-forte
SITE_USERNAME = admin   # opcional, default "admin"
```

- Sem `SITE_PASSWORD` → middleware é no-op (site aberto, comportamento padrão).
- Com `SITE_PASSWORD` → o browser exibe o popup nativo de Basic Auth na
  primeira visita. Após autenticar, fica cached na sessão.
- Não bloqueia `/sw.js`, `/manifest.webmanifest`, ícones PWA e
  `/_next/*` — sem isso a PWA não conseguiria carregar.

Pode desativar a qualquer momento removendo a env var e fazendo
redeploy.

---

## 17. Segurança

Mudanças recentes endureceram a superfície de ataque do app. Cada item
abaixo tem um arquivo correspondente — abra direto pra ver o detalhe.

### Hash de senhas (modo local)

`src/lib/auth/index.ts` usa **bcryptjs** (rounds=10) em `signUp`,
`signIn` e nos aliases legados (`createUser`/`login`). Registros antigos
em plaintext continuam funcionando: o `verifyPassword` aceita ambos os
formatos e re-hasheia o registro do usuário no primeiro login
bem-sucedido (detecta o prefixo `$2[aby]$`). O modo Supabase não é
afetado — a senha trafega direto pro `auth.signInWithPassword`.

### CSRF — double-submit cookie

O `middleware.ts` emite um cookie `csrf_token` (não-HttpOnly, SameSite=lax,
secure em produção) na primeira navegação. O cliente reenvia o mesmo
valor no header `x-csrf-token` via o helper `csrfFetch` em
`src/lib/security/csrfClient.ts`. As routes mutativas
(`POST /api/execution`, `POST /api/convert`) chamam `assertCsrf` antes
de qualquer trabalho — também checa `origin`/`referer` contra o host
para bloquear submissão cross-site.

### Rate limit em /login

`src/lib/security/rateLimit.ts` mantém um mapa in-memory por IP.
Configurado para **5 tentativas / 5 min** em POST `/login`. Excedeu →
`429` com header `Retry-After`. Para ambiente serverless distribuído,
trocar a implementação por Upstash/Redis.

### Validação de input com Zod

`src/lib/api/schemas.ts` define `ExecutionUpsertSchema` com bounds em
todos os números (quantidades, horas, tamanho de string). O
`/api/convert` rejeita uploads > 200 MB (`MAX_IFC_UPLOAD_BYTES`)
retornando `413`.

### Observabilidade

`src/lib/observability/sentry.ts` é um wrapper opcional — sem
`NEXT_PUBLIC_SENTRY_DSN`, vira no-op e cai pra `console.error`. As
exceções já estão capturadas com contexto em:

| Local | Contexto |
|---|---|
| `useXeokit` | `where: 'useXeokit.init' \| 'useXeokit.modelLoad'`, `modelType` |
| `ProgressForm` | `where: 'ProgressForm.save'`, `projectId`, `globalId` |
| `LoginPage` | `where: 'LoginPage.submit'`, `mode: signIn \| signUp` |

### TypeScript e ESLint na build

Removidos `typescript.ignoreBuildErrors` e `eslint.ignoreDuringBuilds`
do `next.config.mjs`. O xeokit-sdk publica `.d.ts` quebrados — em vez
de silenciar a build inteira, declaramos o módulo como `any` em
`src/types/xeokit.d.ts` (uso real do Viewer já é dinâmico). `tsc
--noEmit` agora passa limpo.

---

## 18. Problemas conhecidos e soluções

### `supabaseUrl is required` no build

**Causa:** `createClient()` chamado no nível do módulo sem variáveis configuradas.  
**Solução:** Cliente lazy com `Proxy` em `src/lib/supabase/client.ts`.

### `getXKT error : null` no viewer

**Causa:** xeokit tenta fazer requisição HTTP para verificar o XKT quando recebe uma URL.  
**Solução:** Sempre carregar XKT via `xkt: ArrayBuffer` no `XKTLoaderPlugin.load()`.

### `path.resolve is not a function` na API route

**Causa:** Turbopack aplica alias `{ browser: './shims/path.js' }` ao bundle do servidor.  
**Solução:** Usar sintaxe `{ browser: '...' }` no `turbopack.resolveAlias` — só aplica ao bundle cliente.

### IFC não aparece no seletor de arquivos do iOS

**Causa:** iOS Safari não reconhece `.ifc` como tipo de arquivo e filtra tudo.  
**Solução:** Remover o atributo `accept` do input; validar por extensão em JavaScript após seleção.

### `npm install` falha no Vercel/Netlify

**Causa:** Conflito de peer dependencies entre `eslint@8` e `eslint-config-next@16` (que exige `eslint@9+`).  
**Solução:** Arquivo `.npmrc` com `legacy-peer-deps=true`.

### `btoa.node` não encontrado (Node.js 24)

**Causa:** `@loaders.gl/polyfills` faz import sem extensão `.js`, inválido no ESM estrito do Node 24.  
**Solução:** Patchear os 5 arquivos em `node_modules/@loaders.gl/polyfills/dist/` adicionando `.js` nos imports. Usar Node 20 evita esse problema.

### Elementos sem pavimento mapeado

**Causa:** xeokit `MetaObject.parent` é uma referência de objeto, não uma string — iteração por `children` como array de strings não funciona.  
**Solução:** Traversal pelo parent: `findStorey(node.parent ?? null)` de forma recursiva.

---

## Reconstrução rápida (do zero)

```bash
npx create-next-app@latest bim-electrical-dashboard \
  --typescript --tailwind --app --no-src-dir

cd bim-electrical-dashboard

npm install \
  @xeokit/xeokit-sdk @xeokit/xeokit-convert \
  web-ifc fflate \
  @supabase/supabase-js \
  lucide-react

npm install -D @netlify/plugin-nextjs

# Criar .npmrc
echo "legacy-peer-deps=true" > .npmrc

# Copiar os arquivos src/ conforme estrutura acima
# Configurar next.config.mjs com aliases de fs/path/web-ifc
# Configurar vercel.json e netlify.toml

npm run dev
```

**Ordem de implementação sugerida:**
1. `src/types/index.ts` — tipos
2. `src/lib/storage/local.ts` — localStorage
3. `src/lib/api/execution.ts` — funções de dados
4. `src/lib/viewer/elementMapper.ts` + `colorizer.ts`
5. `src/hooks/useXeokit.ts` — viewer
6. `src/components/viewer/` — BIMViewer, ModelUploader, ViewerControls
7. `src/components/panel/` — ElementPanel, ProgressForm
8. `src/components/ui/` — ProgressSummary, ReportModal
9. `src/app/page.tsx` — montagem final
10. `src/app/api/convert/route.ts` — conversão servidor
11. `next.config.mjs`, `vercel.json`, `netlify.toml`
12. PWA: `manifest.ts`, `public/sw.js`, `layout.tsx`
