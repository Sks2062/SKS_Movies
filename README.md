# FRAME Movie Platform

The app runs as one Node service: Express serves both the API and the built React client from the same origin. The React/Vite source is in `frontend-files/`; API source is in `backend/`.

## Deploy to Render

1. Push this repository to GitHub.
2. Create a MongoDB Atlas database and database user. Add the service's outbound IP access as required by your Atlas network settings.
3. In Render, choose **New → Blueprint**, connect the repository, and use the included `render.yaml`.
4. Enter `MONGO_URI`, `ADMIN_PASSWORD`, and the Mux secrets below. Render generates `JWT_SECRET` for the service.
5. Render runs `npm run init-db` and `npm run create-admin` after the first successful deploy. This creates the `users` and `movies` collections, their indexes, and the configured administrator.
6. In Mux, add a webhook pointing to `https://YOUR-RENDER-SERVICE.onrender.com/api/webhooks/mux`. Subscribe to `video.asset.ready`, `video.asset.errored`, `video.upload.asset_created`, and `video.upload.errored`; save its signing secret as `MUX_WEBHOOK_SECRET` in Render and redeploy.
7. Open the Render service URL. The health endpoint is `/api/health`.

### Configure Mux

1. Create a Mux API access token with Video read/write permission and set its ID and secret as `MUX_TOKEN_ID` and `MUX_TOKEN_SECRET`.
2. Create a Mux signing key and set its ID as `MUX_SIGNING_KEY` and its private key as `MUX_PRIVATE_KEY`. The app creates signed playback tokens on the backend; do not expose these values in frontend settings or source code.
3. Add all five variables to local `.env` for development and to the Render service environment for deployment. For the signing key, paste the full private key including its PEM header and footer.
4. Set up the webhook at the public Render URL as described above. For local testing, use a public tunnel or Mux's webhook listener to forward events to `http://localhost:5000/api/webhooks/mux`.
5. Admins can add a movie, save its details, then upload its video directly from the admin page. Mux processing status appears in Manage movies; playback becomes available after Mux sends `video.asset.ready`.

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

New videos are uploaded to Mux with signed playback. Previously stored direct video URLs remain supported during migration. Use media you have the rights to distribute.

### TeraBox share links

In **Add a movie**, choose **TeraBox share link** and paste an HTTPS TeraBox share URL. The protected watch page opens the share page in an embedded player and provides a link to open it directly on TeraBox if embedding is blocked. The shared file must be accessible to viewers. For direct HLS playback through TeraBox's official API, configure an approved TeraBox developer app and its authorization flow; a public share URL alone does not provide API playback credentials.
