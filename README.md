# CipherShield 🔐

[![CI](https://github.com/your-org/ciphershield/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/ciphershield/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-7c3aed.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.11-3776ab?logo=python&logoColor=white)](https://python.org)
[![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=black)](https://react.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)

> **Zero-knowledge password manager.** Your master key and all vault data are encrypted client-side using Argon2id + AES-256-GCM. The server never sees your plaintext secrets — only encrypted blobs it cannot decrypt.

---

## ✨ Features

- 🔒 **Zero-knowledge architecture** — client-side encryption with Argon2id key derivation
- 🛡️ **AES-256-GCM** vault encryption with per-item IVs
- 🔑 **TOTP 2FA** support (RFC 6238)
- 🕵️ **Have I Been Pwned** breach detection (k-anonymity model)
- 📊 **Password health dashboard** — strength scoring via zxcvbn
- 🔍 **Command palette** (⌘K) for instant search
- 🌓 **Dark/Light mode** with system preference detection
- 📱 **PWA** — installable, offline-capable
- 🔄 **Real-time sync** via Supabase Realtime
- 🧩 **Drag-and-drop** vault organisation (dnd-kit)

---

## 🏗️ Tech Stack

| Layer       | Technology                          | Purpose                            |
|-------------|-------------------------------------|------------------------------------|
| Frontend    | React 18 + TypeScript 5.5           | UI framework                       |
| Styling     | Tailwind CSS 3 + shadcn/ui          | Design system                      |
| State       | Zustand 4                           | Client state                       |
| Server State| TanStack Query 5                    | Async data fetching & caching      |
| Routing     | React Router 6                      | Client-side routing                |
| Forms       | React Hook Form + Zod               | Validated forms                    |
| Animation   | Framer Motion 11                    | Transitions & micro-interactions   |
| Crypto      | Argon2-browser + Web Crypto API     | Key derivation & symmetric encryption |
| 2FA         | @otplib/preset-browser              | TOTP generation & verification     |
| Backend     | FastAPI + Python 3.11               | REST API, auth proxy               |
| Auth & DB   | Supabase (Postgres + Auth)          | User management & encrypted storage|
| Rate Limit  | SlowAPI                             | API rate limiting                  |
| Email       | aiosmtplib                          | Breach alert notifications         |
| CI/CD       | GitHub Actions                      | Automated testing & linting        |
| Container   | Docker + Docker Compose             | Local dev & production deployment  |

---

## 🏛️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT BROWSER                           │
│                                                                 │
│  ┌─────────────────────┐    ┌──────────────────────────────┐   │
│  │   React 18 + Vite   │    │     Web Crypto API           │   │
│  │  (TypeScript, PWA)  │    │   Argon2id Key Derivation    │   │
│  │                     │◄──►│   AES-256-GCM Encrypt/Decrypt│   │
│  │  Zustand (state)    │    │   (runs entirely client-side)│   │
│  │  TanStack Query     │    └──────────────────────────────┘   │
│  └──────────┬──────────┘                                        │
│             │  HTTPS (encrypted blobs only)                     │
└─────────────┼───────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        NGINX (reverse proxy)                    │
│            TLS termination · rate limiting · headers            │
└──────────┬────────────────────────────┬────────────────────────┘
           │                            │
           ▼                            ▼
┌────────────────────┐      ┌──────────────────────────┐
│  FastAPI Backend   │      │    Supabase Platform      │
│  (Python 3.11)     │      │                          │
│                    │      │  ┌────────────────────┐  │
│  · Auth proxy      │◄────►│  │  PostgreSQL (RLS)  │  │
│  · HIBP checks     │      │  │  Encrypted vault   │  │
│  · Email alerts    │      │  │  storage           │  │
│  · Rate limiting   │      │  └────────────────────┘  │
│  · Audit logging   │      │                          │
└────────────────────┘      │  ┌────────────────────┐  │
                            │  │  Supabase Auth     │  │
                            │  │  (JWT + RLS)       │  │
                            │  └────────────────────┘  │
                            └──────────────────────────┘

ZERO-KNOWLEDGE GUARANTEE:
  Master Password ──► Argon2id ──► Encryption Key (client-only)
  Vault Data ──────► AES-256-GCM ──► Encrypted Blob ──► Server
  Server sees: encrypted_blob, user_id, timestamps — NEVER plaintext
```

---

## 🚀 Quick Start

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) ≥ 24.0
- [Node.js](https://nodejs.org/) ≥ 20 (for local dev without Docker)
- [Python](https://python.org/) ≥ 3.11 (for local dev without Docker)
- A [Supabase](https://supabase.com) project

### 1. Clone & configure

```bash
git clone https://github.com/your-org/ciphershield.git
cd ciphershield

# Copy and fill in your environment variables
cp .env.example .env
```

Edit `.env` with your Supabase credentials, HIBP API key, and SMTP settings.

### 2. Run with Docker Compose

```bash
# Start frontend + backend (hot-reload enabled)
docker-compose up --build

# Optional: also start the nginx reverse proxy
docker-compose --profile proxy up --build
```

| Service   | URL                      |
|-----------|--------------------------|
| Frontend  | http://localhost:5173    |
| Backend   | http://localhost:8000    |
| API Docs  | http://localhost:8000/docs |
| Nginx     | http://localhost:80      |

### 3. Local development (without Docker)

**Frontend:**
```bash
cd frontend
npm ci
npm run dev
```

**Backend:**
```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# One-time setup: install dependencies once in this virtual environment.
pip install -r requirements.txt
# Later runs: activate the environment and start the server; don't reinstall.
uvicorn app.main:app --reload --port 8000
```

For local-only use, the frontend stores accounts and encrypted vault items in this browser's IndexedDB. Set `USE_SUPABASE=false` in `backend/.env` and `VITE_USE_SUPABASE=false` (or leave it unset) for the frontend; local account and vault use does not require Supabase. Browser-local data stays in that browser profile and does not sync to other devices.

---

## 🔒 Security Architecture

### Zero-Knowledge Encryption Flow

```
1. User enters Master Password
2. Email (used as salt seed) + Master Password fed to Argon2id
   · m=65536 KiB, t=3 iterations, p=4 parallelism
3. Derived 256-bit key stored only in memory (never persisted)
4. Each vault entry encrypted with AES-256-GCM:
   · Unique 96-bit random IV per item
   · Encrypted payload: JSON({ title, username, password, notes, url })
5. Only { user_id, encrypted_data, iv, auth_tag, updated_at } sent to server
```

### Authentication

- Supabase Auth handles user sessions (JWT)
- Row Level Security (RLS) ensures users can only access their own rows
- Optional TOTP 2FA via @otplib (RFC 6238)
- Backend validates JWTs independently using SUPABASE_JWT_SECRET

### Breach Detection (k-Anonymity)

```
1. SHA-1 hash the candidate password (never sent whole)
2. Send only first 5 hex chars to HIBP API
3. Server returns matching hash suffixes
4. Client compares locally — full hash never transmitted
```

---

## 🧪 Testing

```bash
# Frontend unit tests (Vitest)
cd frontend && npm run test

# Frontend with UI explorer
cd frontend && npm run test:ui

# End-to-end tests (Playwright)
cd frontend && npm run test:e2e

# Backend unit tests (pytest)
cd backend && pytest -v

# Lint checks
cd frontend && npm run lint
cd backend && ruff check .
```

---

## 📁 Project Structure

```
ciphershield/
├── .github/
│   └── workflows/
│       └── ci.yml              # GitHub Actions CI
├── frontend/
│   ├── src/
│   │   ├── api/                # API client functions
│   │   ├── components/         # Reusable UI components
│   │   │   └── ui/             # shadcn/ui primitives
│   │   ├── hooks/              # Custom React hooks
│   │   ├── lib/
│   │   │   ├── crypto.ts       # Argon2id + AES-256-GCM
│   │   │   ├── supabase.ts     # Supabase client
│   │   │   └── hibp.ts         # HIBP breach check
│   │   ├── pages/              # Route-level components
│   │   ├── stores/             # Zustand stores
│   │   ├── types/              # TypeScript type definitions
│   │   └── utils/              # Pure utility functions
│   ├── Dockerfile
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── vite.config.ts
├── backend/
│   ├── app/
│   │   ├── api/                # FastAPI routers
│   │   ├── core/               # Config, security, middleware
│   │   ├── models/             # Pydantic models
│   │   └── main.py             # App entrypoint
│   ├── tests/                  # pytest test suite
│   ├── Dockerfile
│   └── requirements.txt
├── nginx/
│   └── nginx.conf
├── .env.example
├── .gitignore
├── docker-compose.yml
└── README.md
```

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork** the repository
2. **Create a branch**: `git checkout -b feat/your-feature`
3. **Write tests** for any new functionality
4. **Ensure CI passes**: `npm run lint && npm run test` / `ruff check . && pytest`
5. **Commit** using [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `chore:`
6. **Open a Pull Request** against `main`

### Security Vulnerabilities

**Please do NOT open public GitHub issues for security vulnerabilities.**  
Email **security@ciphershield.app** with details. We follow responsible disclosure and will respond within 48 hours.

---

## 📄 License

MIT © CipherShield Contributors — see [LICENSE](LICENSE) for details.
