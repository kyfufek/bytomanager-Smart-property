# Backend AGENT Notes

Backend je Node.js + Express API server.

## Zaklad

- vstupni soubor: `server.js`
- port: `5000` (nebo `PORT` z `.env`)
- health endpoint: `GET /api/health`
- endpoint nemovitosti: `GET /api/properties`
- endpoint najemnici: `GET /api/tenants`
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
