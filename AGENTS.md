# BytoManazer

BytoManazer je projekt pro spravu bytove agendy rozdeleny na frontend a backend cast.

## Struktura projektu

- `frontend/`: klientska aplikace
- `backend/`: serverova aplikace a API

## Bezpecnostni pravidlo

Nikdy necommitovat .env soubory ani secrets.

## Spusteni cele aplikace

1. V koreni repozitare nainstaluj root zavislosti: `npm install`
2. Ujisti se, ze jsou nainstalovane zavislosti i v `frontend/` a `backend/`
3. Spust obe casti najednou prikazem: `npm run dev`
4. Frontend bezi na `http://localhost:8080` (Vite), backend API na `http://localhost:5000`

## Udrzba kontextu

Pokud pridas novou funkci, endpoint nebo zmenis strukturu projektu, aktualizuj prislusny AGENTS.md.
