# 🔭 Scout — AI Founder Discovery & Outreach Console

> **Built for GenAI Fund Take-Home Assignment**  
> An autonomous discovery and high-signal outreach console designed to find, qualify, draft, review, and safely DM AI & robotics founders in Southeast Asia.

---

## ⚡ Quick Start (< 3 Minutes)

Scout is built as a single-binary, zero-external-dependency Next.js application backed by SQLite (LibSQL). **No Docker, no database server, and zero cloud setup required.**

### 1. Install & Seed
```bash
cd scout
npm install
npm run db:seed
```
*The seed command auto-initializes the SQLite database (`scout.db`) and loads a flagship target campaign with 30 curated Southeast Asian AI & robotics profiles.*

### 2. Run the App
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🎯 What Evaluators Can Experience Immediately

Scout ships with **two operational modes**:

### 1. 🟢 Safe Sandbox Mode (Zero-Cost, Default)
- **Zero X API billing required** to fully test and evaluate every screen.
- Explores 30 realistic SEA AI builders (Singapore, Vietnam, Indonesia, Thailand, Malaysia, Philippines) across Embodied AI, Robotics Manipulation, LLM Infra, and Developer Tools.
- Tests the complete lifecycle: **Discover → AI Score with Evidence → Draft Grounded DMs → Human Review & Inline Edit → Safe Atomic Send → Reply Tracking**.
- Includes simulated response latencies, 10% simulated "DMs Closed" permission restrictions, and simulated replies.

### 2. 🔴 Live Mode (Official X API v2 BYOK)
- Connect real credentials directly in the **Settings** tab (Bearer Token & OAuth 2.0 User Access Token).
- Enforces official X API v2 endpoints (`GET /2/tweets/search/recent`, `GET /2/users/by`, `POST /2/dm_conversations/with/:id/messages`, `GET /2/dm_events`).
- Features a **Token-Bucket Rate Limiter**, exponential backoff, and graceful handling of `429` rate limits and `403` DMs-disabled responses.
- Operates under X API's Pay-Per-Use model (~$5-8 total per campaign run, saving evaluators from legacy $200/mo subscription locks).

---

## 🛡️ Core Engineering Guarantees

### 1. Zero Double-Messaging Invariant
- **Database Uniqueness Anchor:** `UNIQUE(x_user_id)` constraint on the `prospects` table guarantees no account can ever be contacted twice across campaigns.
- **Atomic Two-Phase State Lock:** Sending transitions rows atomically (`APPROVED → SENDING`) with optimistic locking (`locked_until = NOW() + 30s`). Re-clicking "Send", rapid double-clicks, or parallel queue workers return 0 affected rows.
- **Pre-Send Recheck Assertion:** The sender verifies the row status is strictly `SENDING` immediately prior to issuing network requests.

### 2. Evidence-Grounded Drafting (Zero Hallucination)
- **Structured Schema Enforcement:** The LLM pipeline forces strict JSON output requiring a verifiable `evidence_sources` citation (exact quote from bio or tweet text).
- **Post-LLM Guardrail Filter:** Checks that quoted text exists verbatim in fetched data, enforces 280-500 char length limits, blocks cringe sales tropes (`"pick your brain"`, `"synergy"`, `"stumbled upon"`), and bans fabricated familiarity (`"great meeting you"`).

---

## 🏗️ Architecture & Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 15 (App Router, TypeScript) |
| **Styling & UI** | Tailwind CSS + shadcn/ui components |
| **Database** | SQLite via LibSQL (`@libsql/client`) + Drizzle ORM |
| **AI Integration** | Vercel AI SDK (`@ai-sdk/google`, `@ai-sdk/openai`, `@ai-sdk/anthropic`) |
| **State Machine** | Strict 12-state deterministic transition map |

---

## 🔑 Bring Your Own Keys (BYOK) Configuration

You can supply keys via `.env` or interactively in the **Settings** tab in the UI:

```env
# Optional: LLM Keys (Gemini Flash recommended for ultra-low latency & cost)
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key

# Optional: Live X API v2 Credentials (only needed if switching off Sandbox mode)
X_BEARER_TOKEN=your_bearer_token
X_ACCESS_TOKEN=your_oauth2_user_token
```

---

## 📁 Repository Structure

```
scout/
├── src/
│   ├── app/
│   │   ├── page.tsx               # Consolidated 4-Screen outreach console
│   │   ├── layout.tsx             # Root layout with mode indicators
│   │   └── api/
│   │       ├── campaigns/         # Campaign CRUD
│   │       ├── discover/          # Provider-agnostic profile discovery & dedup
│   │       ├── score/             # Evidence-grounded fit scoring
│   │       ├── draft/             # Guardrailed DM generation
│   │       ├── approve/           # Human-in-the-loop review/edit/approval
│   │       ├── send/              # Atomic locked sending & failure handling
│   │       ├── prospects/         # Prospect query & status filtering
│   │       └── settings/          # BYOK key management
│   ├── lib/
│   │   ├── db/
│   │   │   ├── schema.ts          # Drizzle tables, unique indexes, state enum
│   │   │   ├── index.ts           # LibSQL client singleton & auto-migrations
│   │   │   └── seed.ts            # SEA demo seed data loader
│   │   ├── providers/
│   │   │   ├── x/                 # LiveXProvider vs SandboxXProvider + TokenBucket
│   │   │   └── llm/               # Gemini, OpenAI, Anthropic unified adapters
│   │   ├── guardrails/            # validateDraft post-generation checks
│   │   └── state-machine.ts       # Deterministic state transition validator
│   └── data/
│       └── seed-profiles.json     # 30 realistic SEA founder & builder profiles
```
