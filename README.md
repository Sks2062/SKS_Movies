# FRAME Movie Platform

The app runs as one Node service: Express serves both the API and the built React client from the same origin. The React/Vite source is in `frontend-files/`; API source is in `backend/`.

## Deploy to Render

1. Push this repository to GitHub.
2. Create a MongoDB Atlas database and database user. Add the service's outbound IP access as required by your Atlas network settings.
3. In Render, choose **New → Blueprint**, connect the repository, and use the included `render.yaml`.
4. When prompted, enter `MONGO_URI` and `ADMIN_PASSWORD`. Render generates `JWT_SECRET` for the service.
5. Render runs `npm run init-db` and `npm run create-admin` after the first successful deploy. This creates the `users` and `movies` collections, their indexes, and the configured administrator.
6. Open the Render service URL. The health endpoint is `/api/health`.

Never commit `.env` or put passwords in source files. Public registration is disabled; the API only accepts the configured admin email and role.

## Local development

1. Install backend dependencies from the repository root: `npm install`.
2. Copy `.env.example` to `.env`, replace `<db_password>` in `MONGO_URI`, then set a long random `JWT_SECRET` and `ADMIN_PASSWORD`.
3. Start MongoDB, then run `npm run init-db` and `npm run create-admin` once.
4. In one terminal run `npm run dev:server`; in a second run `npm run dev:client`.
5. Open the Vite URL, usually `http://localhost:5173`. Vite forwards `/api` requests to the local API at port 5000.

For a production build, run `npm ci`, `npm --prefix frontend-files ci`, `npm run build`, then `npm start` from the repository root.

## Project layout

- `backend/` — Express API, MongoDB models, authentication and administrator provisioning script
- `frontend-files/src/` — React pages, components and API client
- `render.yaml` — one-service Render deployment configuration

Movie streaming and download routes currently return stored `videoUrl` values as placeholders. Use media you have the rights to distribute and replace those placeholders with protected, short-lived storage URLs before production use.
