# Agentex: Autonomous AI Labor, Settled On-Chain

> *"Most AI agents halt when they need a service they don't own. Agentex gives them a wallet, a marketplace, and a reputation. Now they can buy expertise."*

**Live Demo → [(https://agentex-stellar.vercel.app/](https://agentex-stellar.vercel.app/))**  &nbsp;|&nbsp; **Network → Stellar Testnet** &nbsp;|&nbsp; **Explorer → [stellar.expert/testnet](https://stellar.expert/explorer/testnet)**

---

## The Problem

The AI ecosystem today feels scattered.
Working with AI right now means juggling a bunch of separate tools.

A Research Agent can't compensate a Summarizer, a Fact-Checker can't subcontract a Code Reviewer. There is no economic primitive connecting them. Every agent is forced to generalize across tasks it was never specialized for, producing mediocre output across the board.

Three systemic failures compound this:

**No division of labor.** A single monolithic agent handles research, analysis, and synthesis simultaneously. Specialization is architecturally impossible.

**No accountability.** When an agent calls a downstream service, there is no cryptographic proof of delivery, no payment ledger, no consequence for failure. Services cannot price their output. Agents cannot prove they paid for what they received.

**No economic layer.** AI coordination protocols are built on trust and API keys. There is no machine-native payment primitive, no way for software to autonomously hire, pay, and verify other software without human intermediation.

Agentex is the infrastructure layer that fixes this.

---

## The Solution

**Agentex is a decentralized AI labor marketplace where a Manager Agent autonomously hires, pays, and orchestrates a network of Specialist Agents, every transaction settled on the Stellar blockchain in real time.**

When you submit a task, the system does not ask a single agent to do everything. Instead:

1. Manager Orchestration: A Manager Agent analyzes the task and assembles a delegation plan.

2. The x402 Protocol: The Manager negotiates access using the HTTP 402 Payment Required protocol.

3. On-Chain Settlement: Specialist agents require a real Stellar (XLM) transaction to unlock their endpoint.

4. Proof of Work: The Manager proves the payment on-chain via Stellar Horizon, triggering execution.

---

## Core Innovation: The x402 Protocol

x402 is the application of **HTTP 402 Payment Required** to machine-to-machine AI commerce. It is the mechanism that transforms Agentex from a demo into an economy.

```
┌────────────────────────────────────────────────────────────────┐
│                    x402 PAYMENT CYCLE                          │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  STEP 1 — PROBE                                               │
│  Manager → POST /api/agents                                   │
│  Agent   ← HTTP 402  { amount: "1", asset: "XLM",            │
│                        destination: "GCFFJ...BKE5" }          │
│                                                                │
│  STEP 2 — PAY                                                 │
│  Manager signs + submits Stellar transaction                  │
│  Stellar Horizon returns tx_hash: "3f9a2c1b8e..."             │
│                                                                │
│  STEP 3 — PROVE                                               │
│  Manager → POST /api/agents                                   │
│            Header: X-Payment-Hash: 3f9a2c1b8e...             │
│                                                                │
│  STEP 4 — VERIFY + EXECUTE                                    │
│  Agent queries Horizon, confirms: destination ✓ amount ✓ TX ✓ │
│  Agent   ← HTTP 200  { result: "..." }                        │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**No payment hash → no access. Period.** The agent endpoint is architecturally locked until a valid on-chain transaction is proven. This is not rate-limiting — it is programmable commerce at the protocol level.

---

## Architecture

### System Overview

```
                     ┌──────────────────────────────┐
  User Task ───────▶ │        Manager Agent          │
                     │  Llama 3.3 70B via Groq        │
                     │  Holds Stellar keypair         │
                     │  Reads live Agent Registry     │
                     │  Plans + delegates tasks       │
                     └──────────────┬───────────────┘
                                    │
                   ┌────────────────┼────────────────┐
                   │                │                 │
                   ▼                ▼                 ▼
         ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
         │ Research      │  │ Data         │  │ Summary      │
         │ Agent         │  │ Agent        │  │ Agent        │
         │ x402 endpoint │  │ x402 endpoint│  │ x402 endpoint│
         │ Probe → 402   │  │ Probe → 402  │  │ Probe → 402  │
         │ Pay → Verify  │  │ Pay → Verify │  │ Pay → Verify │
         │ Retry → 200   │  │ Retry → 200  │  │ Retry → 200  │
         └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
                │                 │                  │
                └─────────────────┴──────────────────┘
                                  │
                        ┌─────────▼──────────┐
                        │   Compiled Result   │
                        │  (all outputs fused │
                        │   by Manager Agent) │
                        └────────────────────┘
```

### The Deterministic Wallet System

Every entity in Agentex, the Manager and each Specialist Agent, has its own **Stellar keypair**. Wallet architecture is layered:

**Manager Wallet** — The Manager's secret key (`MANAGER_SECRET`) is stored as a server-side environment variable. This means the Manager's public key is deterministic and permanent across deployments. The wallet is funded automatically: the `/api/manager` endpoint checks the balance on every boot and calls Stellar Friendbot to top up to 10,000 XLM if the balance falls below threshold. The private key never touches the client.

**Agent Wallets** — Each Specialist Agent is provisioned a fresh Stellar keypair at session initialization via the "Generate + Fund Wallets" flow. Keypairs are created client-side using `StellarSdk.Keypair.random()`. To activate these accounts on the Stellar network, the Manager performs a Create Account operation for each agent, seeding them with 2 XLM from its own balance. This 2 XLM covers the network's base reserve requirement, enabling the agent to exist on-chain and receive subsequent x402 payments. Agent public keys are passed in every API request so the payment destination is always agent-specific and verifiable.

**Payment Execution** — All transaction signing happens exclusively on the backend (`/api/pay`). The client submits a payment intent `{ destination, amount }`, the server loads the Manager's account from Horizon, constructs a `TransactionBuilder` operation, signs with `MANAGER_SECRET`, and submits. The resulting `tx.hash` is returned to the client and passed as the `X-Payment-Hash` proof header on the follow-up agent call.

### Live UI: Activity Feed + Stellar Ledger
 
Every task execution surfaces two real-time panels side by side.
 
**Activity Feed**: A timestamped, human-readable log of every decision the Manager Agent makes and every action the system takes. It is not a progress bar, it is a transparent audit trail of the orchestration logic. A real execution looks like this:
 
```
12:26:18  ● Analyzing task and searching for specialists...
12:26:20  ● Hiring Research Agent.
             Reasoning: The Research Agent is the most suitable for this
             task as it specializes in gathering facts and context, which
             is necessary for providing a comprehensive answer.
12:26:21  ⬡ Paying Research Agent 1 XLM...
12:26:31  ✓ Research Agent task complete.
12:26:31  ● Hiring Data Agent.
             Reasoning: The Data Agent is necessary to organize and
             prioritize the information gathered by the Research Agent,
             ensuring a clear and logical presentation of the data.
12:26:31  ⬡ Paying Data Agent 1 XLM...
```
 
**Stellar Ledger** — Running in parallel, the right panel captures every confirmed on-chain transaction as it settles. Each entry shows the agent name, the exact XLM deducted, the full 64-character transaction hash, a `● CONFIRMED ON-CHAIN` status badge, and a direct `View on explorer →` link to `stellar.expert`. The transaction count (`1 on-chain TXs`, `2 on-chain TXs`, ...) increments in real time as the pipeline progresses.
 
```
┌─────────────────────────────────────────────────────────────┐
│  STELLAR LEDGER                              1 on-chain TXs  │
├─────────────────────────────────────────────────────────────┤
│  ◆ Research Agent                                  -1 XLM   │
│  ba4436af7d6ba71bfcca28f56238a5feccf436e9e5c9d17ac08abc65f6a │
│  ● CONFIRMED ON-CHAIN              View on explorer →        │
└─────────────────────────────────────────────────────────────┘
```
 
Every entry in the Stellar Ledger is independently verifiable. Click "View on explorer" and the Stellar testnet explorer shows the full transaction: sender, recipient, amount, fee, ledger sequence, and timestamp. The payment is real. The hash is real. Nothing is simulated.
 
**On-Chain Verification** — Horizon verification (`verifyPayment`) queries the full operation set of each submitted transaction and confirms: operation type is `payment`, destination matches the specific agent public key, and amount is greater than or equal to the negotiated price. Verification retries up to 5 times at 2-second intervals to accommodate Horizon indexing latency. Only after this on-chain proof passes does the agent execute its task.

---

## n8n Workflow Integration

Agentex supports **pluggable agents via n8n workflows**. Any n8n workflow that implements the x402 protocol can be registered as a Specialist Agent in the marketplace — replacing the built-in serverless endpoints with full workflow automation.

The included **Research Agent workflow** (`agentex-research-agent.workflow.json`) adds live web intelligence to the pipeline:

```
Manager Agent
    │  POST /webhook/research-agent  (no payment header)
    ▼
  n8n ──▶  HTTP 402  { amount, destination, network }
    │
    │  Manager signs Stellar TX, retries with X-Payment-Hash
    ▼
  n8n ──▶  Verify on Stellar Horizon  (retry ×5)
         ──▶  SerpAPI: live Google search
         ──▶  Groq Llama 3.3 70B: AI analysis grounded in search results
         ──▶  HTTP 200  { result, meta: { txHash, explorerUrl, ... } }
```

**What this unlocks:** The Research Agent produces findings grounded in live web data, not just LLM training knowledge while remaining fully payment-gated via the standard x402 cycle. The Manager cannot retrieve results without first paying in XLM, verified on-chain.



---

## Tech Stack

| Layer | Technology | Role |
|---|---|---|
| **LLM / AI** | Groq API · Llama 3.3 70B Versatile | Manager planning + all Specialist execution |
| **Workflow Automation** | n8n | Pluggable Research Agent with live web search |
| **Web Search** | SerpAPI (Google) | Live research grounding for n8n Research Agent |
| **Blockchain** | Stellar Network (Testnet) | Micro-payment settlement layer |
| **Blockchain SDK** | `@stellar/stellar-sdk` v15 | Transaction construction, signing, submission |
| **Blockchain Explorer** | Stellar Horizon API | On-chain payment verification |
| **Payment Protocol** | x402 (HTTP 402 Payment Required) | Machine-to-machine payment negotiation |
| **Frontend** | React 18 + Vite 5 | UI, wallet management, real-time activity feed |
| **Backend** | Vercel Serverless Functions | `/api/agents`, `/api/claude`, `/api/pay`, `/api/manager` |
| **Deployment** | Vercel | Edge-deployed, zero-config CI/CD |

### Why Groq

Multi-agent coordination is latency-sensitive. The Manager makes planning calls, then 3+ sequential Specialist calls execute in order, each waiting on the previous. Groq delivers Llama 3.3 70B at inference speeds that make this feel near-instant, is completely free with no credit card required, and has no rate limits that affect a live demo.

### Why Stellar

Stellar was purpose-built for programmable micro-payments at scale. It settles in 3–5 seconds, charges sub-cent fees, has a mature TypeScript SDK, and provides Friendbot, a testnet faucet that funds wallets instantly with no friction. Crucially, Horizon gives us a clean REST API for transaction verification without requiring a full node. For an application where every agent call is preceded by a payment, these properties are not nice-to-haves, they are IMPORTANT.

---

## Project Structure

```
agentex/
├── api/
│   ├── agents.js       # x402 endpoint — 402 probe, Horizon verification, task execution
│   ├── claude.js       # Manager planning proxy — routes to Groq API
│   ├── pay.js          # Stellar payment signer — signs & submits transactions server-side
│   └── manager.js      # Manager wallet — keypair management, auto-refill via Friendbot
├── src/
│   ├── App.jsx         # Full app — x402 flow, Stellar payments, registry, leaderboard
│   ├── index.css       # Premium dark fintech theme with glassmorphism
│   └── main.jsx        # React entry point
├── public/
│   └── favicon.svg
├── index.html          # Stellar SDK loaded via CDN (avoids Vite bundler conflicts)
├── vite.config.js      # Dev server with full api/* middleware stack
├── vercel.json         # SPA routing — preserves /api/* Serverless routes
└── package.json
```




### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | **Yes** | Groq API key for Llama 3.3 70B inference |
| `MANAGER_SECRET` | Optional | Stellar secret key for a persistent Manager wallet. Auto-generated if absent. |

---

## Walkthrough

**1. Generate Wallets** — Click "Generate + Fund Wallets." The app creates a Stellar keypair for the Manager and each Specialist Agent. The Manager’s wallet is funded via Stellar Friendbot, and it then autonomously distributes 2 XLM to each specialist agent to initialize their accounts on the testnet. This sequence demonstrates the Manager's role as the central economic coordinator of the fleet. This takes ~5 seconds.

**2. Submit a Task** — Type any research, analysis, or coding task. Use the example prompts for inspiration.

**3. Watch the x402 Cycle** — The Activity Feed shows every step in real time: the Manager's plan, each Stellar payment submission,and each on-chain verification . The Stellar Ledger panel displays every transaction with a live link to `stellar.expert`.

**4. Review Results** — Compiled output from all Specialist Agents is displayed in tabbed panels — one tab per agent, one summary tab for the synthesized final answer.

---

## Future Roadmap

Agentex establishes the foundation. The following milestones define the path to production-grade infrastructure:

**v1.1 — Soroban Smart Contract Reputation**  
An immutable leaderboard on-chain reputation contract deployed on Stellar's Soroban EVM. Every task completion and payment writes a record to the contract giving agents a cryptographically verifiable, tamper-proof performance history that any consumer can audit before hiring.

**v1.2 — USDC Settlements + Asset Abstraction**  
Add USDC (via Circle's CCTP) alongside XLM as a settlement asset, with an asset-negotiation phase in the x402 protocol. Agents advertise accepted assets; the Manager selects the optimal denomination based on available balance and exchange rate.

**v1.3 — Escrow & Dispute Resolution**  
Introduce a Soroban escrow contract that holds payment until the Manager verifies task quality. If the output fails a validation rubric, funds are returned. This transforms the payment model from pre-payment to performance-based settlement, a prerequisite for high-value professional tasks.

**v1.4 — Recursive Delegation**  
Allow Specialist Agents to themselves act as Managers, hiring and paying sub-agents to complete sub-tasks. Enables deep hierarchical pipelines: a Research Agent might hire a Web Scraper Agent, a PDF Parser Agent, and a Citation Verifier Agent, each paid autonomously, before returning its result to the top-level Manager.

**v1.5 — Machine Payment Channels (MPP)**  
Implement Stellar payment channels for high-frequency agent coordination. Instead of one on-chain transaction per agent call, open a channel, batch 100+ micro-payments off-chain, and settle the net balance in a single transaction. Reduces cost and latency for large pipelines by two orders of magnitude.

**v2.0 — Public Agent Registry & Permissionless Listing**  
A globally accessible, on-chain agent registry where any developer can list a Specialist Agent, setting their own price, accepted assets, and SLA terms. Any Manager Agent in the world can discover and hire any listed agent. This is the open, programmable workforce layer for the AI economy.

---



## License

MIT — see [LICENSE](./LICENSE)

---

*Built for the Stellar Hackathon · 2026*  
*Agentex: where agents don't just talk. They trade.*
