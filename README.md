# BytoManager

BytoManager je full-stack aplikace pro spravu nemovitosti, najemniku, plateb a vyuctovani sluzeb.

Projekt bezi jako jeden repozitar se samostatnym frontendem a backendem.

## Co je aktualne implementovane

- Supabase Auth (email/password) na frontendu
- Chranene backend endpointy pres Bearer token (`requireAuth`)
- CRUD pro:
  - nemovitosti
  - najemniky
  - platby
- Profil prihlaseneho uzivatele (`/api/profile`) navazany na `public.profiles`
- Dashboard, settings a dalsi obrazovky s UX stavy (loading/empty/error + toasty)
- Simulovany AI chat endpoint (`/api/chat`)
- LLM abstrakcni vrstva na backendu (`backend/services/llm`) s OpenAI adapterem pripravena pro budouci napojeni

## Co zatim neni plne produkcni

- `POST /api/chat` je zatim simulace odpovedi, nevola realne LLM
- cast financnich/AI workflow je stale v mock nebo demo rezimu

## Architektura

```text
/
|-- frontend/                      # React + Vite + TypeScript + Tailwind
|-- backend/                       # Node.js + Express + Supabase server client
|-- AGENTS.md                      # instrukce pro vyvoj/AI agenty
|-- .env.example                   # vzor env promennych
`-- package.json                   # root script pro spusteni FE+BE
```

## Tech stack

### Frontend
- React 18
- Vite
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase JS client

### Backend
- Node.js
- Express
- `@supabase/supabase-js`

### Databaze a auth
- Supabase (PostgreSQL + Auth)

### LLM vrstva
- Provider-agnosticka service vrstva v `backend/services/llm`
- Vychozi provider adapter: OpenAI (`providers/openaiAdapter.js`)

## Pozadavky

- Node.js 20+
- npm
- Supabase projekt (URL + klice)

## Instalace

```bash
# 1) Root zavislosti (concurrently)
npm install

# 2) Frontend zavislosti
cd frontend
npm install

# 3) Backend zavislosti
cd ../backend
npm install

# 4) Zpet do rootu
cd ..
```

## Environment variables

Vytvor si lokalni `.env` soubory podle tohoto prehledu.

### `backend/.env`

```env
PORT=5000
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini
LLM_TEMPERATURE=0.2
LLM_MAX_TOKENS=700
LLM_TIMEOUT_MS=30000
OPENAI_API_KEY=

# optional aliases (LLM_* ma prednost)
OPENAI_MODEL=gpt-4o-mini
OPENAI_TEMPERATURE=0.2
OPENAI_MAX_TOKENS=700
```

### `frontend/.env`

```env
VITE_API_URL=http://localhost:5000
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
# nebo
# VITE_SUPABASE_ANON_KEY=
```

## Spusteni

Z rootu:

```bash
npm run dev
```

- Frontend: `http://localhost:8080`
- Backend: `http://localhost:5000`

## API endpointy (aktualni stav)

### Public
- `GET /api/health`
- `POST /api/chat` (simulace)
- `POST /api/billing/generate-report`

### Auth required (Bearer token)
- `GET /api/properties`
- `POST /api/properties`
- `PUT /api/properties/:id`
- `PATCH /api/properties/:id`
- `DELETE /api/properties/:id`
- `GET /api/tenants`
- `GET /api/tenants/:id`
- `POST /api/tenants`
- `DELETE /api/tenants/:id`
- `GET /api/payments/tenant/:tenantId`
- `POST /api/payments`
- `GET /api/profile`
- `PUT /api/profile`

## LLM service pouziti (backend)

Aplikacni kod ma volat pouze:

```js
const { llmService } = require("../services/llm");
const text = await llmService.generateText({
  systemPrompt: "You are a helpful assistant.",
  prompt: "Summarize this text...",
});
```

Nevolat OpenAI API/SDK primo v route/controller souborech.

## Skripty

### Root
- `npm run dev` - spusti frontend + backend paralelne

### Frontend (`frontend/package.json`)
- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run test`

### Backend (`backend/package.json`)
- `npm run dev`
- `npm run start`

## Bezpecnost

- Nikdy necommituj `.env` soubory ani realne API klice
- `SUPABASE_SERVICE_ROLE_KEY` patri jen na backend

## Poznamka k frontend slozce

Ve repu je navic vnorena slozka `frontend/bytomanager-62a8b6c4/` (historicky artefakt). Aktivni aplikace je `frontend/src`.
