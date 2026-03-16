# Backend AGENT Notes

Backend je Node.js + Express API server.

## Zaklad

- vstupni soubor: `server.js`
- port: `5000` (nebo `PORT` z `.env`)
- health endpoint: `GET /api/health`
- endpoint nemovitosti: `GET /api/properties`
- endpoint najemnici: `GET /api/tenants`
- endpoint AI chat: `POST /api/chat` (simulovana RAG odpoved)
- endpoint pokrocile vyuctovani: `POST /api/billing/generate-report` (osobomesice, vodomery, prime naklady, zalohy)

## Udrzba kontextu

Pokud pridas novou funkci, endpoint nebo zmenis strukturu projektu, aktualizuj prislusny AGENTS.md.
