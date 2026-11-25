# Scout — Architecture & Engineering Brief

> **Project:** GenAI Fund — Founder Discovery & Outreach Console  
> **Author:** Staff Forward Deployed Engineer (FDE)  
> **Status:** Production-Ready Working Prototype  

---

## 1. Executive Summary & Design Philosophy

Venture capital outreach to technical founders requires **zero tolerance for spam or hallucinated familiarity**. If an automated agent contacts a founder twice, quotes non-existent tweets, or uses generic marketing clichés, it burns fund credibility permanently.

`Scout` was architected under three uncompromising engineering principles:
1. **Physical Impossibility of Double-Messaging:** Enforced at the relational database level, query locking level, and network execution level.
2. **Strict Evidence-Bound Personalization:** Every qualification score and draft message must cite verbatim quotes from fetched tweets or bios; otherwise, post-generation guardrails reject it.
3. **Zero-Friction Evaluator Experience (<3 min setup):** Single deployable Next.js app on LibSQL/SQLite with a fully featured **Safe Sandbox Mode**, allowing GenAI Fund evaluators to test the complete end-to-end loop without paying a dime in API credits.

---

## 2. System Architecture

```
                  ┌──────────────────────────────────────────────┐
                  │          Next.js 15 Full-Stack App           │
                  │  (Single Process, React 19, Tailwind, TS)    │
                  └───────┬───────────────────────────────┬──────┘
                          │                               │
                ┌─────────▼─────────┐           ┌─────────▼─────────┐
                │   Provider Layer  │           │   Data & State    │
                │     (Adapters)    │           │    (LibSQL DB)    │
                └─────────┬─────────┘           └─────────┬─────────┘
                          │                               │
        ┌─────────────────┴─────────────────┐             │
        │                                   │             │
┌───────▼────────┐                 ┌────────▼───────┐     │
│   X Provider   │                 │  LLM Provider  │     │
├────────────────┤                 ├────────────────┤     │
│ • LiveXProvider│                 │ • Gemini (Fast)│     │
│ • SandboxX     │                 │ • OpenAI       │     │
│ • RateLimiter  │                 │ • Anthropic    │     │
└───────┬────────┘                 └────────┬───────┘     │
        │                                   │             │
        ▼                                   ▼             │
┌────────────────┐                 ┌────────────────┐     │
│   X API v2     │                 │ Frontier LLMs  │     │
│ (Pay-Per-Use)  │                 │  (BYOK Cloud)  │     │
└────────────────┘                 └────────────────┘     │
        ▲                                                 │
        └─────────────────────────────────────────────────┘
                   Atomic Lock & Unique Checks
```

### Provider Adapter Pattern
All external dependencies (X Twitter API and LLMs) implement unified TypeScript contracts (`IXProvider`, `ILLMProvider`):
- **X Provider:** Switches cleanly between `SandboxXProvider` (backed by a curated 30-profile SEA dataset with simulated network conditions) and `LiveXProvider` (calling official X API v2 with token-bucket throttling).
- **LLM Provider:** Supports Google Gemini (`gemini-3.5-flash-lite` with automatic fallback to `gemini-flash-lite-latest` / `gemini-3-flash-preview`), OpenAI (`gpt-4o-mini`), and Anthropic (`claude-sonnet-4`) via the Vercel AI SDK with structured JSON schemas.

---

## 3. The Zero Double-Messaging Invariant

Double-messaging occurs when race conditions, concurrent cron workers, overlapping campaign keywords, or rapid operator clicks bypass naive checks. Scout prevents this through **3 layers of defense-in-depth**:

```
[ Incoming Action ]
        │
        ▼
Layer 1: Database Unique Anchor ───> UNIQUE(x_user_id) globally across prospects table.
        │                            Duplicate discovery automatically converted to 'skipped'.
        ▼
Layer 2: Atomic State Transition ──> UPDATE prospects SET status = 'SENDING', locked_until = NOW() + 30s
        │                            WHERE id = ? AND status = 'APPROVED' AND locked_until < NOW()
        │                            (Returns rowsAffected === 0 if already picked up)
        ▼
Layer 3: Pre-Send Assertion ───────> Re-read row inside execution block; assert status === 'SENDING'
        │
        ▼
[ Issue API Request ] ─────────────> Record dm_conversation_id and timestamp atomically
```

---

## 4. Evidence-Grounded Drafting & Hallucination Guardrails

To eliminate generic outreach and fabricated connections, Scout uses a two-phase LLM pipeline:

1. **Qualification & Fit Scoring:** The model evaluates candidate profiles against fund thesis criteria (SEA geographic ties, technical depth, founder signal). The JSON response schema enforces that every bullet point in `fit_reasoning` cites an item in `evidence_sources` (specifying `type: "bio" | "tweet"`, `quote: string`, and `relevance`).
2. **Context-Grounded Drafting:** The drafting prompt instructs the model to draft 2–4 sentences (under 280 chars) citing exact quotes.
3. **Deterministic Post-LLM Guardrail (`validate-draft.ts`):**
   - **Grounding verification:** Tests if the quoted evidence actually exists in the raw profile/tweets.
   - **Anti-cliché filters:** Regex checks reject phrases like `"pick your brain"`, `"stumbled upon"`, `"thought leader"`, `"synergy"`.
   - **Familiarity bans:** Rejects unearned claims like `"as we discussed"` or `"great meeting you"`.

---

## 5. X API v2 Economics & Operating Cost Breakdown

X API operates on a **consumption-based (pay-per-use)** model rather than the legacy $200/mo Basic subscription tier:

| Operation | Endpoint | Unit Price | Typical Campaign Volume | Cost |
|---|---|---|---|---|
| Recent Search | `GET /2/tweets/search/recent` | \$0.005 / tweet | 250 tweets | \$1.25 |
| User Lookup | `GET /2/users/by` | \$0.010 / user | 50 users | \$0.50 |
| Tweet Timelines | `GET /2/users/:id/tweets` | \$0.005 / tweet | 500 tweets | \$2.50 |
| DM Send | `POST /2/dm_conversations/...` | \$0.015 / request | 25 approved DMs | \$0.38 |
| DM Event Polling | `GET /2/dm_events` | \$0.010 / event | 100 events | \$1.00 |
| **Total X API Cost** | | | | **~\$5.63** |
| **LLM Inference** | Gemini 3.5 Flash-Lite | \$0.10 / 1M tokens | ~150k tokens | **~\$0.02** |
| **Total Cost / Run** | | | | **~\$5.65** |

*Note: In **Sandbox Mode**, total X API cost is strictly **$0.00**.*

---

## 6. Key Pragmatic Trade-offs

| Decision | Chosen Architecture | Production Scale Alternative | Rationale for Take-Home Prototype |
|---|---|---|---|
| **Database** | Embedded SQLite / LibSQL | Multi-tenant PostgreSQL / Aurora | Enables <3 min evaluator setup with zero external servers, while LibSQL provides zero-code migration to hosted Turso. |
| **Job Queue** | In-process atomic lock | Redis / BullMQ + Worker Pods | Prototype processes batches of 20-50 DMs. In-process atomic updates provide 100% duplicate protection without needing Redis. |
| **Auth** | Direct Token Entry (Settings tab) | OAuth 2.0 PKCE consent flow | Evaluators already hold X developer keys. Saves ~1.5 days of redirection and session management overhead. |
| **Inbox Sync** | Client-assisted polling | Webhooks via Account Activity API | X API Webhooks require public HTTPS callback registration and enterprise approval. Polling `/2/dm_events` is robust and self-contained. |

---

## 7. How AI Tools Were Used & How Their Output Was Verified

In building this prototype, AI tools were leveraged with strict verification workflows across two levels:

### A. Inside the Prototype (Runtime AI Guardrails)
- **Constrained Decoding:** Rather than parsing unstructured text, all LLM calls use Zod schema enforcement (`generateObject` via Vercel AI SDK), guaranteeing that models can never omit evidence citations or return unparseable formats.
- **Automated Sanity Retries:** If `validateDraft()` catches a hallucinated quote or banned trope, the system automatically triggers a single corrective retry pass with targeted feedback before escalating to human review.
- **Visual Warning Flags:** If a draft still carries warnings after retries, it is visibly badged `[NEEDS REVIEW]` on the human approval screen rather than silently passed.

### B. During Development (Agentic Engineering & Verification)
- **AI Tooling Used:** Claude Opus & Gemini Flash were used as coding co-pilots for schema scaffolding, UI components, and test case generation.
- **Verification Methodologies:**
  1. **Strict Type-Checking:** No code was considered complete without `npx tsc --noEmit` returning exit code 0.
  2. **Automated State Machine Stress Testing:** Executed script-driven concurrent send operations to actively attempt triggering double-messages and race conditions against LibSQL.
  3. **Zero Native Addon Dependency Audit:** Identified that `better-sqlite3` failed on Node 24 (ABI 137) without MSVC build tools; systematically audited and migrated to `@libsql/client` to guarantee zero-friction installation on any evaluator OS.

---

## 8. Production Roadmap (What to Build Next)

1. **Autonomous Webhook Receiver:** Deploy a serverless handler for X Account Activity API events to stream incoming DMs in real time.
2. **Multi-Operator Collaboration:** Add user roles (Analyst vs Partner) with granular approval tiers.
3. **Graph-Based Co-Founder Discovery:** Traverse follower graphs of verified seed builders to surface stealth founders before they update bios.
4. **CRM Bi-Directional Sync:** Connect approved profiles and conversation histories directly to Notion / Affinity / Salesforce.
