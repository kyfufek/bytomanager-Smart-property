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
- Databaze: Supabase (PostgreSQL)
- Knihovny: `cors`, `dotenv`, `@supabase/supabase-js`
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
  - Finance (interni historie plateb)
  - Vyuctovani sluzeb
- Platby se zadavaji rucne pres aplikaci (zadne bankovni API / open banking).
- Vyuctovani sluzeb je workflow modul, ktery je vazany na:
  - najemnika (`tenant_id`)
  - nemovitost (`property_id`)
  - obdobi (`period_from`, `period_to`)
  - polozky sluzeb + zalohy z plateb.
- Modul Vyuctovani sluzeb rozlisuje:
  - operativni mesicni prehled zaloh / plateb / stavu uhrady
  - formalni vyuctovani za zuctovaci obdobi
- Formalni zuctovaci obdobi ma maximalni delku 12 mesicu.
- Formalni vyuctovani ma obsahovat:
  - najemnika a nemovitost / jednotku
  - zuctovaci obdobi
  - sluzby po polozkach
  - skutecne naklady
  - prijate zalohy
  - rozdily po polozkach
  - celkovy preplatek / nedoplatek
  - workflow stav a navazne datumy

## Backend Agent Guidance
### Struktura (`backend/`)
```text
backend/
 routes/           # Express routery (properties.js, tenants.js atd.)
 server.js         # Vstupni bod aplikace, middleware
 .env              # Ignorovano v Gitu
```

### Aktualni stav a ukoly
- Server bezi nad Supabase a vraci data pres auth-protected endpointy (napr. `/api/properties`, `/api/tenants`, `/api/tenants/:id`, `/api/payments`).
- Existuji i endpointy pro AI chat a pokrocile vyuctovani.
- Chat endpoint `POST /api/chat` je chraneny auth middleware a pouziva LLM service vrstvu.
- Platebni vrstva:
  - `GET /api/payments`
  - `GET /api/payments/tenant/:tenantId`
  - `POST /api/payments`
  - `PUT /api/payments/:id`
  - `owner_id` se vzdy bere z `req.user.id` (nikdy z request body)
  - `status` se odvozuje z `due_date` + `paid_date` (`paid`, `pending`, `overdue`)
  - tenant/property ownership se validuje proti prihlasenemu uzivateli
- Vyuctovani sluzeb (workflow vrstva):
  - `GET /api/billing/settlements`
  - `GET /api/billing/settlements/:id`
  - `POST /api/billing/settlements`
  - `PUT /api/billing/settlements/:id`
  - `POST /api/billing/settlements/:id/calculate`
  - `period_from` + `period_to` musi tvorit zuctovaci obdobi o max. delce 12 mesicu
  - stavy vyuctovani:
    - `draft` (koncept)
    - `calculated` (spocitano)
    - `reviewed` (zkontrolovano)
    - `exported` (exportovano)
    - `sent` (odeslano)
  - backend kontroluje vlastnictvi tenant/property pres `req.user.id`
  - zalohy se pro vypocet berou deterministicky z tabulky `payments` (bez AI)

### Pridani noveho endpointu
1. Definuj logiku v `backend/routes/`.
2. Zaregistruj router v `backend/server.js`.
3. Pri DB operacich pouzij `try/catch` a vrat srozumitelny HTTP status + chybu.
4. Pokud endpoint pouziva LLM, volej pouze `backend/services/llm` (nikdy ne provider API primo).

### Chatbot prompt disku pri kazdem requestu.

## Database (Supabase) Guidance
- Pripojeni pres:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Operace CRUD pres oficialniho klienta `@supabase/supabase-js` v backend routach.
- SQL pro prvni verzi plateb je v `backend/sql/2026-03-30-payments-v1.sql` (tabulka `payments`, indexy, trigger `updated_at`, RLS policies).
- SQL pro workflow vyuctovani sluzeb je v `backend/sql/2026-04-13-utility-settlements-workflow.sql`:
  - `utility_settlements`
  - `utility_settlement_items`
  - polozky vyuctovani mohou obsahovat i `allocation_method` (`persons`, `area`, `meter`, `fixed`) pro zpusob rozuctovani
  - settlement muze volitelne ukladat `advance_payment_ids`, tedy konkretni vybrane platby, ktere se maji zapocitat do zaloh
  - zalohy pro settlement se musi filtrovat podle `owner_id`, `tenant_id`, `property_id` a zuctovaciho obdobi, nikdy ne globalne
  - indexy + RLS policy pro owner-scoped pristup.

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

## Communication Preference
- Pri kazdem kroku agent strucne vysvetli:
  - co bude delat,
  - proc to dela,
  - co z vysledku vyplyva pro dalsi krok.
- Nepsat pouze prikazy bez slovniho kontextu.
