# Frontend AGENT Notes

Frontend je aplikace postavena na React + Vite + Tailwind CSS.

## Spusteni dev serveru

1. Prejdi do `frontend/`
2. Nainstaluj zavislosti: `npm install`
3. Spust dev server: `npm run dev`

## Docker nasazeni

- Produkcni image je definovany ve `frontend/Dockerfile`.
- Build-time env se predavaji z root `docker-compose.yml` jako build args:
  - `VITE_API_URL`
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
  - `VITE_SUPABASE_ANON_KEY`
- Vystupni build se servuje pres nginx s SPA fallback konfiguraci v `frontend/nginx.conf`.

## API napojeni

- `DashboardPage`, `PropertiesPage`, `TenantsPage` pouzivaji `apiFetch` helper z `src/lib/api.ts`
- `FinancePage` a `TenantsPage` pouzivaji backend payments endpointy (`/api/payments*`) pro interni historii plateb
- `SettingsPage` nacita/uklada profil pres backend endpointy:
  - `GET /api/profile`
  - `PUT /api/profile`
- `ContactPage` poskytuje route `/kontakt` v hlavni sidebar navigaci a odesila formular na:
  - `POST /api/contact`
  - po uspechu zobrazuje success toast a textovou potvrzovaci hlasku v karte
  - pri chybe zobrazuje destructive toast a ponecha vyplnenou zpravu pro opakovani
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
- chranene route (`/`, `/properties`, `/tenants`, `/finance`, `/kontakt`, `/documents`, `/settings`) jsou obalene v `ProtectedRoute`
- auth stav spravuje `AuthContext` pres Supabase (`isAuthenticated`, `login`, `register`, `logout`, `onAuthStateChange`)
- session je perzistentni pres Supabase klienta
- odhlaseni je v `AppHeader` a presmeruje na `/auth`
- frontend env:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY` nebo `VITE_SUPABASE_ANON_KEY`
  - `VITE_API_URL`

## Udrzba kontextu

Pokud pridas novou funkci, endpoint nebo zmenis strukturu projektu, aktualizuj prislusny AGENTS.md.

## Platby v1 (frontend)

- Platby jsou aktualne vedene pouze interne v aplikaci (manualni zadavani), bez bank API/importu.
- `TenantsPage` zobrazuje per-tenant stav platby (`paid`, `pending`, `overdue`, `none`) + posledni splatnost/uhradu.
- `FinancePage` zobrazuje globalni seznam plateb, KPI souhrn a formular pro rucni pridani platby.
- Oznaceni platby jako uhrazene jde pres `PUT /api/payments/:id` s `paid_date`.
- Povinne UX stavy:
  - loading: skeletony
  - empty: `DataState`
  - error: `DataState` + destructive toast

## UX reusable vrstva (product polish)

- Sdilene komponenty pro konzistenci mezi strankami:
  - `src/components/product/PageHeader.tsx`
  - `src/components/product/DataState.tsx`
- `PageHeader` pouzivej pro jednotny titulek + popis + volitelne akce.
- `DataState` pouzivej pro `empty/error` stavy seznamu nebo datovych sekci.
- Pro user feedback po akcich (vytvoreni/uprava/smazani/ulozeni) pouzivej toast z `src/hooks/use-toast.ts`.

## Vyuctovani sluzeb UX pravidla

- Stranka `UtilityBillingPage.tsx` rozdeluje modul na:
  - `Prehled`
  - `Prubezne zalohy a platby`
  - `Vyuctovani podle obdobi`
  - `Detail vyuctovani`
  - `Podklady / namitky / stav`
  - `Export / doruceni`
- Rozlisuj:
  - operativni mesicni prehled plateb a zaloh bez pravni finality
  - formalni vyuctovani za zuctovaci obdobi max. 12 mesicu
- Pro formalni cast vzdy zobraz:
  - najemnika
  - nemovitost / jednotku
  - zuctovaci obdobi
  - sluzby po polozkach
  - prijate zalohy
  - skutecne naklady
  - rozdily
  - celkovy vysledek
  - workflow stav
- Pokud settlement backend nebo DB schema neni dostupne, stranka ma zachovat funkcni operativni cast a formalni cast zobrazit jako rizeny error state.
