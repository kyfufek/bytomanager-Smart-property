# Frontend AGENT Notes

Frontend je aplikace postavena na React + Vite + Tailwind CSS.

## Spusteni dev serveru

1. Prejdi do `frontend/`
2. Nainstaluj zavislosti: `npm install`
3. Spust dev server: `npm run dev`

## API napojeni

- `DashboardPage` nacita data z:
  - `GET http://localhost:5000/api/properties`
  - `GET http://localhost:5000/api/tenants`
- `PropertiesPage` nacita data z:
  - `GET http://localhost:5000/api/properties`
- `TenantsPage` nacita data z:
  - `GET http://localhost:5000/api/tenants`
- Pri nedostupnem backendu zobrazujeme `loading` a `error` stavy.

## Auth flow

- auth route: `GET /auth`
- chranene route (`/`, `/properties`, `/tenants`, `/finance`, `/documents`, `/settings`) jsou obalene v `ProtectedRoute`
- auth stav spravuje `AuthContext` (`isAuthenticated`, `login`, `register`, `logout`)
- session je perzistentni v `localStorage` pres `authService`
- odhlaseni je v `AppHeader` a presmeruje na `/auth`

## Udrzba kontextu

Pokud pridas novou funkci, endpoint nebo zmenis strukturu projektu, aktualizuj prislusny AGENTS.md.
