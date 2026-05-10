# Architecture

Agent Board is organized as a deployable two-service app: a FastAPI backend in `backend/` and a Vite/React frontend in `frontend/`. Shared automation for local agents lives outside those services in `hooks/` and `tools/`.

## Backend

The backend app entry point is `backend/app/main.py`. It should stay small and only own process-level concerns:

- loading environment variables
- database startup through the FastAPI lifespan hook
- CORS and global exception handling
- health check
- Socket.IO mounting

API router registration lives in `backend/app/routing.py`. Add a new backend resource by creating a router module under `backend/app/routes/`, then adding one `RouteConfig` entry in `routing.py`.

Backend folders:

- `backend/app/routes/` contains HTTP resource modules.
- `backend/app/services/` contains reusable business logic that should not be duplicated inside route handlers.
- `backend/app/models/` contains Pydantic request/response schemas.
- `backend/app/middleware/` contains request authentication and cross-cutting middleware.
- `backend/src/db/` contains SQLite schema and seed data.

## Frontend

The frontend app shell is split into three clear layers:

- `frontend/src/main.jsx` mounts React and browser routing.
- `frontend/src/app/providers.jsx` owns global providers such as React Query and toast configuration.
- `frontend/src/App.jsx` owns auth gating and route rendering.

The route and sidebar contract lives in `frontend/src/app/navigation.jsx`. When adding a screen, add the route once there and set `nav: true` only if it should appear in the sidebar.

Frontend folders:

- `frontend/src/pages/` contains route-level screens.
- `frontend/src/components/` contains reusable layout and UI components.
- `frontend/src/api/` contains axios wrappers for backend endpoints.
- `frontend/src/hooks/` contains React Query hooks and view-facing data access.
- `frontend/src/stores/` contains client-side Zustand state.
- `frontend/src/remotion/` contains video/demo compositions and should stay isolated from app runtime UI.

## Contribution Rules

- Keep API behavior in `api/` plus `hooks/`, and keep page files focused on composition and workflow state.
- Put shared frontend UI in `components/` before copying it between pages.
- Put shared backend behavior in `services/` before copying it between route modules.
- Keep generated media and marketing assets in `marketing-video-launch/`; do not import those files into runtime app code.
- Verify frontend changes with `npm run build` from `frontend/`.
- Verify backend imports with `python -m compileall app` from `backend/`.
