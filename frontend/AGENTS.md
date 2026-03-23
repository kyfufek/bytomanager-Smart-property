# Frontend AGENT Notes

Frontend je aplikace postavena na React + Vite + Tailwind CSS.

## Spusteni dev serveru

1. Prejdi do `frontend/`
2. Nainstaluj zavislosti: `npm install`
3. Spust dev server: `npm run dev`

## API napojeni

- `DashboardPage`, `PropertiesPage`, `TenantsPage` pouzivaji `apiFetch` helper z `src/lib/api.ts`
- `SettingsPage` nacita/uklada profil pres backend endpointy:
  - `GET /api/profile`
  - `PUT /api/profile`
- `DocumentsPage` (AI Pravnik) pouziva existujici Lovable UI a je napojena na:
  - `POST /api/chat`
  - frontend drzi historii konverzace lokalne ve state a posila ji na backend
- `apiFetch`:
  - bere base URL z `VITE_API_URL` (fallback `http://localhost:5000`)
  - nacita aktualni Supabase session
  - automaticky pridava `Authorization: Bearer <access_token>`
- Pri nedostupnem backendu zobrazujeme `loading` a `error` stavy.

## Auth flow

- auth route: `GET /auth`
- chranene route (`/`, `/properties`, `/tenants`, `/finance`, `/documents`, `/settings`) jsou obalene v `ProtectedRoute`
- auth stav spravuje `AuthContext` pres Supabase (`isAuthenticated`, `login`, `register`, `logout`, `onAuthStateChange`)
- session je perzistentni pres Supabase klienta
- odhlaseni je v `AppHeader` a presmeruje na `/auth`
- frontend env:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY` nebo `VITE_SUPABASE_ANON_KEY`
  - `VITE_API_URL`

## Udrzba kontextu

Pokud pridas novou funkci, endpoint nebo zmenis strukturu projektu, aktualizuj prislusny AGENTS.md.

## UX reusable vrstva (product polish)

- Sdilene komponenty pro konzistenci mezi strankami:
  - `src/components/product/PageHeader.tsx`
  - `src/components/product/DataState.tsx`
- `PageHeader` pouzivej pro jednotny titulek + popis + volitelne akce.
- `DataState` pouzivej pro `empty/error` stavy seznamu nebo datovych sekci.
- Pro user feedback po akcich (vytvoreni/uprava/smazani/ulozeni) pouzivej toast z `src/hooks/use-toast.ts`.
