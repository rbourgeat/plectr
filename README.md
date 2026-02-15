# 🎼 PLECTR : The Unified Engineering Forge

> **“Resonate with your data.”**
> The alternative to GitHub, Hugging Face, and Docker Hub. One single forge for Code, AI, and Data.

---

## I. Why PLECTR?

Modern engineering is fragmented. Your code lives on GitHub, your models on Hugging Face, and your datasets on S3.
**PLECTR unifies everything.** It’s a universal versioning system, “Local-First”, written in Rust for raw performance.

### The 4 Pillars

1. **Universal Repository**
   A single repo contains code (`.rs`, `.ts`), AI models (`.safetensors`), and data (`.parquet`).

2. **Smart Storage (CAS)**
   Native deduplication (Content Addressable Storage). If 10 projects use the same 5GB model, it’s stored only once.

3. **Data Intelligence**
   Native visualization of CSV/Parquet files (via DuckDB Wasm) and neural network layer inspection (SafeTensors) without downloading.

4. **Native Performance**
   Rust backend (Axum) + optimized Next.js frontend + SeaweedFS storage.

---

## II. Development Status (v0.2)

### ✅ Active Features

* **“White Label” Auth**
  Authentication via Keycloak integrated directly into the UI (no visible redirect).

* **Repository Management**
  Public/Private creation, secure deletion, permission-filtered listing.

* **Smart Agent (CLI)**

  * `plectr init` / `save` / `clone`
  * Intelligent `.gitignore` handling and automatic exclusion of heavy folders (`node_modules`, `target`)
  * Support for cloning empty repositories (“Void State”)

* **Advanced Visualization**

  * **AI**: `.safetensors` metadata inspection (layers, params)
  * **Data**: SQL preview on CSV/Parquet files
  * **Code**: Syntax highlighting and Markdown rendering

* **Security**
  Personal CLI access tokens, RBAC (Private repos invisible to non-members)

---

### 🚧 In Progress

* Real-time timeline (WebSockets)
* Semantic search (pgvector)
* Resilient uploads for files >50GB (Tus protocol)

---

## III. Technical Architecture

### 1. The Core (Backend)

* **Rust (Axum)** — High-performance API
* **PostgreSQL 16** — Relational metadata & RBAC
* **SeaweedFS** — Distributed S3-compatible storage

---

### 2. Interface (UX/UI)

* **Next.js 15 (App Router)** + **Tailwind v4**
* **Design**: “Ultimate” glassmorphism, fluid animations, deep dark mode
* **Auth**: NextAuth.js connected to Keycloak via Direct Grants

---

### 3. The Agent (CLI)

* **Rust** — Single binary, no runtime dependencies
* **Performance** — File scanning via `ignore` (ripgrep engine), Blake3 hashing

---

## IV. Quick Start (Dev)

### Prerequisites

* Docker & Docker Compose
* Rust (Cargo) & Node.js 20+

---

### 1. Configure secrets

Create the file `infra/.env` (do not commit!):

```ini
POSTGRES_USER=plectr
POSTGRES_PASSWORD=change_me
KEYCLOAK_ADMIN_PASSWORD=change_me
NEXTAUTH_SECRET=generate_with_openssl
KEYCLOAK_CLIENT_SECRET=get_from_keycloak_console
```


---

### 2. Start the infrastructure

```bash
cd infra
docker compose up -d
```

---

### 3. Install the CLI

```bash
cd agent
cargo install --path .
```

---

### 4. First steps

1. Go to `http://localhost:3000` (or your domain).
2. Log in.
3. Create a repo called `my-project`.
4. In a terminal:

```bash
# Retrieve your token in Settings > Tokens on the UI
plectr login
plectr init --name my-project
plectr save -m "Initial resonance"
```

---

**Lead Architect:** Raphaël Bourgeat
**License:** Apache License, Version 2.0
