<div align="center">

# 🛍️ E-commerce API

### RESTful API for managing Clients, Commerces and Products

Project developed for the **DevOps** asignature — Universidad de Medellín

[![Node.js](https://img.shields.io/badge/Node.js-≥20.19-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-5.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-C5F74F?logo=drizzle&logoColor=black)](https://orm.drizzle.team/)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Docker](https://img.shields.io/badge/Docker-Containerized-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)

[View Demo (Production)](https://ecommerce-backend-yi4o.onrender.com/) · [Repository](https://github.com/jfpa11100/ecommerce-backend)

</div>

---

## 📋 Table of contents

- [Description](#-description)
- [Academic objective](#-academic-objective)
- [Environments](#-environments)
- [CI/CD Pipelines](#-cicd-pipelines)
- [Quality rules (Quality Gates)](#-quality-rules-quality-gates)
- [Docker](#-docker)
- [How to run the project locally](#-how-to-run-the-project-locally)
- [Testing and coverage](#-testing-and-coverage)
- [Author](#-author)

---

## 📖 Description

**E-commerce API** is a RESTful API built with **Express + TypeScript**, which manages three related entities — **Clients**, **Commerces** and **Products** — using **PostgreSQL** (hosted on **Supabase**) as the database and **Drizzle ORM** as the data access layer.

The project follows a layered architecture (**Router → Controller → Service → Repository**) that separates responsibilities, makes testing easier, and allows the data infrastructure to evolve without affecting the business logic.

> This repository is the practical implementation of the **DevOps** emphasis track, so in addition to the application code, it includes all the **CI/CD infrastructure, containers, separate environments, and automated quality control**.

---

## 🎯 Academic objective

Deploy a production-ready application while following core DevOps practices:

| Requirement | Status |
|---|:---:|
| Git versioning with a meaningful history | ✅ |
| Standardized commits with GitMoji | ✅ |
| Complete RESTful API (includes the `QUERY` verb) | ✅ |
| At least 3 entities with real persistence | ✅ |
| 2 independent environments (Testing / Production) | ✅ |
| CI/CD pipeline | ✅ |
| Coverage and testing quality gates | ✅ |
| Containerization with Docker | ✅ |

---

- **Routes**: define the endpoints and the HTTP verb (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `QUERY`).
- **Controllers**: receive the HTTP request, delegate to the service, and return the response.
- **Services**: contain the business rules (validations, orchestration).
- **Repositories**: the only layer that knows the ORM and runs queries against the database.

---

## 🛠️ Tech stack

| Category | Technology |
|---|---|
| Runtime | Node.js (≥ 20.19.3 &lt;21 or ≥ 22.2.0) |
| Language | TypeScript |
| HTTP Framework | Express 5 |
| ORM | Drizzle ORM |
| Database | PostgreSQL (Supabase) |
| Containerization | Docker & Docker Compose |
| Testing | Vitest |
| CI/CD | GitHub Actions |
| Hosting | Render |

---


## 🌍 Environments

The project has **two fully independent environments**, each with its own database, deployment URL, and environment variables/secrets.

| | 🧪 Testing | 🚀 Production |
|---|---|---|
| **URL** | https://test-ecommerce-3jtf.onrender.com | https://ecommerce-backend-yi4o.onrender.com/ |
| **Database** | Supabase |
| **Deploying branch** | `test-environment` | `main` |
| **Minimum coverage required** | ≥ 60% | ≥ 85% |

> Both environments deploy **automatically and independently**: a change on the testing branch never affects production, and vice versa.

---

## ⚙️ CI/CD Pipelines

**Two independent pipelines** were implemented on Github Actions :

```
🧪 Testing Pipeline                       🚀 Production Pipeline
──────────────────────                    ──────────────────────
1️⃣  Install dependencies                  1️⃣  Install dependencies
2️⃣  Build                                 2️⃣  Build
3️⃣  Run tests                             3️⃣  Run tests
4️⃣  Validate coverage (≥ 60%)             4️⃣  Validate coverage (≥ 85%)
5️⃣  Deploy to Testing environment         5️⃣  Deploy to Production environment
```

Each stage is a **quality gate**: if any step fails, the pipeline stops immediately and **nothing gets deployed**.

---

## ✅ Quality rules (Quality Gates)

| Rule | Testing | Production |
|---|:---:|:---:|
| The pipeline stops if any test fails | ✅ | ✅ |
| Minimum code coverage | **60%** | **85%** |
| Allowed failing tests | **0** | **0** |
| Automatic deployment if rules are met | ✅ | ✅ |

---

## 🐳 Docker

The project is fully containerized with a `Dockerfile` (for the API) and `docker-compose.yml` (to run the API + database together locally).

```bash
# Start API + database
docker compose up --build

# Stop and clean up containers
docker compose down
```

---

## 🔐 Environment variables

Copy `.env.example` to `.env` and  the values:

```env
# Database - direct connection (used for migrations)
DATABASE_URL=
IS_PRODUCTION=
```

---

## 💻 How to run the project locally

```bash
# 1. Clone the repository
git clone https://github.com/jfpa11100/ecommerce-backend

# 2. Install dependencies
pnpm install

# 3. Set up environment variables
cp .env.example .env

# 4. Start the development server
npm run dev
```

The API will be available at `http://localhost:3000`.

---

## 🧪 Testing and coverage

```bash
# Run tests
npm run test

# Run tests with a coverage report
npm run test:coverage
```

---


## 👥 Author

| Name | GitHub | Role |
|---|---|---|
| Juan Felipe Palacio | github.com/jfpa11100 | Developer |

**University:** Universidad de Medellín
**Course / Emphasis:** DevOps

Made with ☕ and lots of commits with GitMoji

</div>
