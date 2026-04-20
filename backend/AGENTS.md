# Backend AGENT Notes

Backend je Node.js + Express API server.

## Zaklad

- vstupni soubor: `server.js`
- port: `5000` (nebo `PORT` z `.env`)
- produkcni image: `backend/Dockerfile`
- health endpoint: `GET /api/health`
- endpoint nemovitosti: `GET /api/properties`
- endpoint najemnici: `GET /api/tenants`
- endpoint platby:
  - `GET /api/payments`
  - `GET /api/payments/tenant/:tenantId`
  - `POST /api/payments`
  - `PUT /api/payments/:id`
- endpoint profil: `GET /api/profile`, `PUT /api/profile`
- endpoint AI chat: `POST /api/chat` (auth required, prijima `message` + `history`, vraci `answer`)
- endpoint pokrocile vyuctovani: `POST /api/billing/generate-report` (osobomesice, vodomery, prime naklady, zalohy)

## LLM vrstva (abstrakce)

- Vsechny budouci LLM volani musi jit pres `backend/services/llm/index.js`.
- Provider-specific implementace je oddelena v `backend/services/llm/providers/` (vychozi: OpenAI adapter).
- Ostatni casti backendu nesmi volat OpenAI SDK/API napriamo.
- Chat route pouziva pouze `llmService.generateText(...)`.
- Konfigurace se bere z env:
  - `LLM_PROVIDER` (default `openai`)
  - `LLM_MODEL`, `LLM_TEMPERATURE`, `LLM_MAX_TOKENS`, `LLM_TIMEOUT_MS`
  - `OPENAI_API_KEY`
  - volitelne aliasy `OPENAI_MODEL`, `OPENAI_TEMPERATURE`, `OPENAI_MAX_TOKENS`

## Chatbot system prompt

- System prompt je ulozen v `backend/chatbot-instructions.md`.
- Nacita se pri startu backendu pres `backend/config/chatbotPrompt.js` (jen jednou).
- Pri requestu se prompt znovu necte ze souboru.
- Backend historii chatu neuklada do DB, pouze ji validuje a preda LLM vrstve.

## Udrzba kontextu

Pokud pridas novou funkci, endpoint nebo zmenis strukturu projektu, aktualizuj prislusny AGENTS.md.

## Docker nasazeni

- Backend je v Docker Compose definovan jako sluzba `backend`.
- Compose mu predava env z root `/.env` pres `env_file` a `environment`.
- Kriticke promenne pro start:
  - `PORT`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - volitelne LLM promene (`LLM_*`, `OPENAI_*`)
- Pri Docker troubleshooting over:
  - `docker logs bytomanager-backend`
  - `docker exec bytomanager-backend printenv`
  - `GET /api/health`

## Platby v1 (internal tracking)

- Ownership:
  - `owner_id` se vzdy odvozuje z `req.user.id` (nikdy z request body).
  - tenant i property musi patrit prihlasenemu uzivateli.
- Validace:
  - `amount` musi byt > 0
  - `due_date` musi byt validni datum
  - `paid_date` je volitelne, ale pokud je zadano, musi byt validni datum
- Stav platby:
  - `paid`: ma vyplnene `paid_date`
  - `overdue`: nema `paid_date` a `due_date` je v minulosti
  - `pending`: nema `paid_date` a `due_date` jeste nenastalo
- Sdilena logika validace/normalizace plateb je v `backend/services/payments/paymentUtils.js`.
- SQL schema + RLS pro payments je v `backend/sql/2026-03-30-payments-v1.sql`.

## Vyuctovani sluzeb workflow

- API:
  - `GET /api/billing/settlements`
  - `GET /api/billing/settlements/:id`
  - `POST /api/billing/settlements`
  - `PUT /api/billing/settlements/:id`
  - `POST /api/billing/settlements/:id/calculate`
- Modul rozlisuje:
  - operativni prehled zaloh / plateb / stavu uhrady
  - formalni vyuctovani za zuctovaci obdobi
- Formalni vyuctovani:
  - je vzdy navazane na `tenant_id` a `property_id`
  - pouziva `period_from` a `period_to`
  - musi mit zuctovaci obdobi o max. delce 12 mesicu
  - pocita `advances_total`, `actual_cost_total`, `balance_total`, `result_type` deterministicky bez AI
- Workflow stavy:
  - `draft`
  - `calculated`
  - `reviewed`
  - `exported`
  - `sent`
