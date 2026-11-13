# Deploy CipherShield

The frontend runs on Vercel, the FastAPI service runs on Render, and MongoDB Atlas stores the encrypted account and vault records. The master password and decrypted vault data stay in the browser.

## MongoDB Atlas

Create a MongoDB Atlas cluster and a database user with read/write access. Copy its `mongodb+srv://...` connection string. Configure Atlas network access so Render can connect.

## Render backend

Create a Blueprint service from this repository. Render uses `render.yaml` and installs dependencies from `backend/requirements.txt`.

Set these Render environment variables:

- `MONGODB_URI`: the Atlas connection string.
- `MONGODB_DATABASE`: `ciphershield`.
- `ALLOWED_ORIGINS`: your Vercel URL, such as `https://your-app.vercel.app`.
- `SECRET_KEY`: a long random value.

Render generates `JWT_SECRET` from the blueprint. After deployment, confirm `https://YOUR-RENDER-SERVICE.onrender.com/health` returns `healthy`.

## Vercel frontend

Import the same repository into Vercel. The root `vercel.json` builds the `frontend` directory.

Set the production environment variable:

- `VITE_API_URL`: `https://YOUR-RENDER-SERVICE.onrender.com/api/v1`

Deploy after the Render service is healthy.

## Local laptop use

Copy `.env.example` to `.env` and use `MONGODB_URI=mongodb://localhost:27017` after installing MongoDB Community Server. During local frontend development, accounts and encrypted vault items are also retained in the browser's IndexedDB on this laptop. They are device-local until you sign in through the deployed app.
