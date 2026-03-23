# AGENTS.md

## Purpose
Tento soubor poskytuje konkretni instrukce a kontext pro AI programovaci agenty (napr. Codex) a lidske vyvojare pracujici na projektu Bytomanager. Definuje strukturu projektu, vyvojove postupy a striktni pravidla pro udrzeni konzistence kodu.

## Repo Map
Projekt pouziva oddelenou strukturu pro frontend a backend v jednom repozitari (nejde o plnohodnotne monorepo pres Turborepo).

```text
/
 frontend/          # React + Vite + Tailwind CSS aplikace
 backend/           # Node.js + Express backend server
 .env.example       # Vzor root promennych
 package.json       # Root skripty (frontend/backend maji vlastni package.json)
```

## Quickstart
Predpoklady:
- Node.js (doporuceno v20+)
- npm

### 1. Klonovani a instalace
```bash
git clone https://github.com/kyfufek/bytomanager-62a8b6c4.git
cd bytomanager-62a8b6c4

# Instalace zavislosti pro frontend
cd frontend
npm install

# Instalace zavislosti pro backend
cd ../backend
npm install

# Instalace root zavislosti (pro concurrently skript)
cd ..
npm install
```

### 2. Spusteni vyvojoveho prostredi
V korenovem adresari:

```bash
npm run dev
```

- Frontend bezi na: `http://localhost:8080` (nastaveno ve `frontend/vite.config.ts`)
- Backend bezi na: `http://localhost:5000`

## Architecture & Tech Stack
### Frontend
- Framework: React (Vite)
- Styling: Tailwind CSS
- Architektura: vychazi z kodu generovaneho nastrojem Lovable

### Backend
- Runtime: Node.js
- Framework: Express.js
- Databaze: aktualne mock data, planovany prechod na Supabase (PostgreSQL)
- Knihovny: `cors`, `dotenv`, planovane `@supabase/supabase-js`
- LLM architektura: provider-agnosticka vrstva v `backend/services/llm/` (vychozi OpenAI adapter)

## Code Quality & Security Rules
Dodrzuj bezpodminecne:

1. `SECRETS & ENV`: nikdy necommitovat `.env` ani realne API klice/hesla.
2. Udrzuj kontext: pokud pridas funkci, endpoint nebo zmenis strukturu, aktualizuj prislusny `AGENTS.md`.
3. Konzistence dat: backend vraci JSON; frontend musi resit `loading` a `error` stavy.
4. CORS: backend musi mit korektne nastaveny `cors()` middleware pro lokalni frontend.

## Frontend Agent Guidance
### Struktura (`frontend/`)
Slozka obsahuje standardni Vite/React strukturu vytvorenou nastrojem Lovable. Zmeny UI delej s ohledem na existujici Tailwind tridy.

### Komunikace s API
- Volani smeruj na `import.meta.env.VITE_API_URL`, s fallbackem na `http://localhost:5000`.
- Vzor promenne je ve `frontend/.env.example`.
- Aktualne jsou implementovane pohledy typu:
  - Moje nemovitosti
  - Najemnici
  - Dashboard
  - Vyuctovani sluzeb
- Cast formularu je zatim pripravena na zapis, ale plne ukladani do DB ceka na Supabase integraci.

## Backend Agent Guidance
### Struktura (`backend/`)
```text
backend/
 routes/           # Express routery (properties.js, tenants.js atd.)
 server.js         # Vstupni bod aplikace, middleware
 .env              # Ignorovano v Gitu
```

### Aktualni stav a ukoly
- Server bezi a vraci mock data z GET endpointu (napr. `/api/properties`, `/api/tenants`, `/api/tenants/:id`).
- Existuji i endpointy pro AI chat a pokrocile vyuctovani.
- Chat endpoint `POST /api/chat` je chraneny auth middleware a pouziva LLM service vrstvu.

### Pridani noveho endpointu
1. Definuj logiku v `backend/routes/`.
2. Zaregistruj router v `backend/server.js`.
3. Pri DB operacich pouzij `try/catch` a vrat srozumitelny HTTP status + chybu.
4. Pokud endpoint pouziva LLM, volej pouze `backend/services/llm` (nikdy ne provider API primo).

### Chatbot prompt
- System prompt pro chatbot je v `backend/chatbot-instructions.md`.
- Nacita se pri startu backendu a backend ho necte z disku pri kazdem requestu.

## Database (Supabase) Guidance
(Plne relevantni po dokonceni migrace na Supabase)

- Pripojeni pres:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
- Operace CRUD pres oficialniho klienta `@supabase/supabase-js` v backend routach.

## Environment Variables & Secrets
Kazda cast aplikace ma vlastni `.env` soubor pro lokalni vyvoj. Nikdy je necommituj.

### Root (`/.env.example`)
```env
VITE_API_URL=http://localhost:5000
PORT=5000
SUPABASE_URL=
SUPABASE_ANON_KEY=
```

### Backend (`backend/.env`)
```env
PORT=5000
SUPABASE_URL=
SUPABASE_ANON_KEY=
```

### Frontend (`frontend/.env`)
```env
VITE_API_URL=http://localhost:5000
```
