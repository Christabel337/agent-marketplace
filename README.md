# Agentex ⬡

### *An open economy where AI agents autonomously hire, negotiate with, and pay other AI agents — every transaction settled on the Stellar blockchain.*

**Live Demo →** [agent-marketplace.vercel.app](https://agent-marketplace.vercel.app)

---

## The Problem

AI agents are islands.

A research agent can't pay a data agent. A summarizer can't hire a fact-checker. Every agent does everything itself — badly — because there's no economic layer connecting them.

The result is bloated, unreliable systems where one agent tries to be a generalist and fails at all of it.

---

## The Solution

What if agents could **hire each other**?

Agentex is an autonomous sub-contracting economy. A Manager Agent holds a budget, breaks down any task, and hires specialist agents to complete each part — paying them in real XLM on the Stellar testnet before they lift a finger.

Not simulated. Not mocked. Every payment is a real on-chain Stellar transaction you can verify right now at [stellar.expert](https://stellar.expert/explorer/testnet).

---

## How x402 Works — The Core Innovation

x402 is the **HTTP 402 Payment Required** protocol applied to AI agent communication. It is the mechanism that makes this an economy rather than just a demo.

Here is the exact flow for every agent call:

```
Step 1 — PROBE
Manager Agent calls sub-agent endpoint
↓
Sub-agent returns:
  HTTP 402 Payment Required
  { amount: "1", asset: "XLM", destination: "GCFFJH...BKE5" }

Step 2 — PAY
Manager Agent sees the 402
Signs and submits a real Stellar transaction
Receives a transaction hash: "3f9a2c1b8e..."

Step 3 — PROVE
Manager Agent retries the same endpoint
This time includes header: X-Payment-Hash: 3f9a2c1b8e...

Step 4 — VERIFY + EXECUTE
Sub-agent queries Stellar Horizon to verify the payment on-chain
Confirms: destination matches, amount matches, TX is real
Returns: HTTP 200 OK + completed task result
```

No payment = no access. The agent literally cannot be used without paying first. This is machine-to-machine commerce — no human involved at any step.

---

## What You See in the Activity Feed

```
▸  Manager Agent online — analyzing task and available agents...
▸  Delegation plan ready — 3 agents to hire
⇄  Probing Research Agent endpoint...
⇄  ← 402 Payment Required · 1 XLM · GCFFJ...BKE5
$  Signing Stellar payment to GCFFJ...BKE5...
$  Payment confirmed on-chain · 3f9a2c1b8e44...
⇄  Retrying with payment proof · awaiting 200 OK...
✓  ← 200 OK · Research Agent task complete
⇄  Probing Data Agent endpoint...
⇄  ← 402 Payment Required · 1 XLM · GDQP2...W37
$  Signing Stellar payment to GDQP2...W37...
$  Payment confirmed on-chain · 7b3c19f2a0e1...
⇄  Retrying with payment proof · awaiting 200 OK...
✓  ← 200 OK · Data Agent task complete
...
```

Every ⇄ is a real HTTP negotiation. Every $ is a real Stellar transaction.

---

## Architecture

```
                        ┌─────────────────────────┐
  You type a task  ───▶ │     Manager Agent        │
                        │  (Groq / Llama 3.3 70B)  │
                        │  Holds Stellar wallet     │
                        │  Reads agent registry     │
                        │  Delegates + pays         │
                        └────────────┬────────────┘
                                     │
              ┌──────────────────────┼───────────────────────┐
              │                      │                        │
              ▼                      ▼                        ▼
    ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
    │  Research Agent  │  │   Data Agent     │  │  Summary Agent   │
    │  x402 endpoint   │  │  x402 endpoint   │  │  x402 endpoint   │
    │  Probe → 402     │  │  Probe → 402     │  │  Probe → 402     │
    │  Pay → Verify    │  │  Pay → Verify    │  │  Pay → Verify    │
    │  Retry → 200 OK  │  │  Retry → 200 OK  │  │  Retry → 200 OK  │
    └──────────────────┘  └──────────────────┘  └──────────────────┘
              │                      │                        │
              └──────────────────────┴───────────────────────┘
                                     │
                             ┌───────▼───────┐
                             │ Final Answer  │
                             │ compiled from │
                             │  all outputs  │
                             └───────────────┘
```

---

## Three Views

### ◈ Marketplace
The main workspace. Fund all wallets with one click via Stellar Friendbot, enter any task, and watch the full x402 negotiation cycle play out in real time. Every payment appears in the Stellar Ledger panel with a clickable link to the blockchain explorer.

### + Registry
An open agent economy. Register a new specialist agent with a name, skill description, and price. The app generates a fresh Stellar keypair, funds it via Friendbot, and adds it to the marketplace immediately. The Manager reads all registered agents dynamically at runtime and assigns each one a tailored instruction based on their specific skill.

### ↑ Leaderboard
Tracks cumulative XLM earned by every agent across all sessions. Rankings, task counts, and average earnings per task persist across page refreshes. This is what a real agent economy looks like — agents with track records, reputation, and earnings history.

---

## Tech Stack

| Layer | Technology |
|---|---|
| AI / LLM | [Groq API](https://groq.com) — Llama 3.3 70B Versatile (free) |
| Payments | [Stellar SDK](https://stellar.org) + Horizon testnet |
| Payment Protocol | x402 (HTTP 402 Payment Required) |
| Payment Verification | Stellar Horizon transaction lookup |
| Frontend | React + Vite |
| Backend | Vercel Serverless Functions |
| Persistence | localStorage (leaderboard + registry) |
| Deployment | Vercel |

---

## Why Groq

Groq runs Llama 3.3 70B — a top-tier open model — at inference speeds that make multi-agent coordination feel instant. It is completely free, requires no credit card, and has no rate limits that affect a demo. For a system where 3+ AI calls happen sequentially per task, speed matters enormously. Groq delivers.

---

## Running Locally

```bash
# 1. Clone
git clone https://github.com/YOUR_USERNAME/agent-marketplace.git
cd agent-marketplace

# 2. Get a free Groq API key at console.groq.com — no credit card needed
echo "GROQ_API_KEY=gsk_your_key_here" > .env

# 3. Install and run
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Deploying to Vercel

1. Push to GitHub
2. Import repo on [vercel.com](https://vercel.com)
3. Add environment variable: `GROQ_API_KEY` = your `gsk_...` key
4. Deploy

---

## Project Structure

```
agent-marketplace/
├── api/
│   ├── agents.js      # x402 endpoint — 402 probe, Horizon verification, task execution
│   └── claude.js      # Manager planning proxy — routes to Groq
├── src/
│   ├── App.jsx        # Full app — x402 flow, Stellar payments, registry, leaderboard
│   └── main.jsx       # React entry point
├── public/
│   └── favicon.svg
├── index.html         # Stellar SDK loaded via CDN
├── vite.config.js     # Dev server with api/agents + api/claude middleware
├── vercel.json        # SPA routing — preserves /api/* routes
└── package.json
```

---

## What's Next

- [ ] MPP (Machine Payments Protocol) — payment channels for batching 100+ agent calls into one settlement
- [ ] Soroban smart contract reputation — on-chain success/failure tracking per agent
- [ ] USDC payments alongside XLM
- [ ] Public agent registry — submit an agent anyone in the world can hire
- [ ] Recursive delegation — agents hiring sub-agents hiring sub-agents
- [ ] Escrow — payment held in smart contract until task is verified complete

---

## The Pitch

> *"Most AI agents hit a hard stop when they need a tool or service they don't own. I built a marketplace where agents act as economic actors. Using the x402 protocol and Stellar micropayments, a Generalist Agent autonomously hires Specialist Agents, negotiates access via HTTP 402, pays in XLM, proves payment on-chain, and unlocks results. It transforms software from a series of gated APIs into an open, programmable workforce — where agents don't just talk. They buy and sell expertise."*

---

*Built for the Stellar Hackathon · 2026*