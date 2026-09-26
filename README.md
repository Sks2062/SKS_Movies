# Frame Movie Platform

Frame is a movie catalog with an Express API, MongoDB storage, and a React/Vite client. MixDrop is the only video host used by the application. Admins can upload a local video through MixDrop's multipart API or have MixDrop fetch a public video URL through its remote-upload API. API credentials stay on the backend, and the watch page embeds MixDrop's returned player URL.

## Configure MixDrop

1. Create a MixDrop account and find the API email and key on the [MixDrop API page](https://mixdrop.ag/api).
2. Copy `.env.example` to `.env` and set `MIXDROP_API_EMAIL` and `MIXDROP_API_KEY`. Never put these credentials in frontend environment variables or commit `.env`.
3. For Render, enter the same two values as the `MIXDROP_API_EMAIL` and `MIXDROP_API_KEY` service environment variables.
4. In the admin area, choose **Upload a video file** or **Import from a direct URL**. File uploads are limited to 5 GB and are sent as `multipart/form-data` to `https://ul.mixdrop.ag/api`; remote imports use `https://api.mixdrop.ag/remoteupload`.
5. Choose a destination folder. The form loads folders from MixDrop and defaults to `Movie` when that folder exists.
6. Check **Manage movies** and use **Refresh MixDrop status** to inspect conversion. Playback uses the embed URL returned by MixDrop.

MixDrop limits API requests to 10 per second. The app only checks import status when an administrator presses the refresh button.

## Run locally

1. Install dependencies: `npm install` and `npm --prefix frontend-files install`.
2. Configure `.env` with `MONGO_URI`, a long random `JWT_SECRET`, `ADMIN_PASSWORD`, and the MixDrop API credentials.
3. Start MongoDB, then run `npm run init-db` and `npm run create-admin` once.
4. Start the API with `npm run dev:server` and the client with `npm run dev:client` in separate terminals.
5. Open the Vite URL, usually `http://localhost:5173`. Vite proxies `/api` to the API on port 5000.

Build the client with `npm run build`; start the single-origin production app with `npm start`.

## Deploy to Render

Create a Render Blueprint using `render.yaml`, then provide `MONGO_URI`, `ADMIN_PASSWORD`, `MIXDROP_API_EMAIL`, and `MIXDROP_API_KEY`. Render generates `JWT_SECRET`. The health endpoint is `/api/health`.

## Project layout

- `backend/` — Express API, MixDrop API client, MongoDB models, and authentication.
- `frontend-files/src/` — React pages, components, and API client.
- `render.yaml` — Render service configuration.

Use videos you have the rights to distribute and follow MixDrop's terms and copyright policy.
