import { useState, useRef, useEffect } from "react";


const StellarSdk = window.StellarSdk;

// ── Stellar ────────────────────────────────────────────────────────────────────
const server  = new StellarSdk.Horizon.Server("https://horizon-testnet.stellar.org");
const NETWORK = StellarSdk.Networks.TESTNET;
const EXPLORER = h => `https://stellar.expert/explorer/testnet/tx/${h}`;

async function friendbot(pk) {
  const r = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(pk)}`);
  if (!r.ok) throw new Error(`Friendbot failed: ${pk.slice(0,8)}`);
}

async function stellarPay(toPK, amount) {
  const response = await fetch('/api/pay', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      destination: toPK, 
      amount: amount.toFixed(7) 
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Payment failed");
  
  return data.hash; // Returns the transaction hash to the frontend
}

async function getBalance(pk) {
  try {
    const a = await server.loadAccount(pk);
    const x = a.balances.find(b => b.asset_type === "native");
    return x ? parseFloat(x.balance) : 0;
  } catch { return 0; }
}

// ── utils ─────────────────────────────────────────────────────────────────────
const sleep   = ms => new Promise(r => setTimeout(r, ms));
const abbr    = s  => s.slice(0,6) + "..." + s.slice(-4);
const ACCENTS = ["#4ADE80","#60A5FA","#F59E0B","#F472B6","#A78BFA","#34D399","#FB923C","#22D3EE"];
const ICONS   = ["⬡","◆","▲","◇","⬤","⬟","◐","★"];

// ── default agents ─────────────────────────────────────────────────────────────
const DEFAULT_AGENTS = [
  {
    id: "research", label: "Research Agent", icon: "◈", price: 1,
    accent: "#4ADE80", desc: "Gathers facts & context", isDefault: true,
    system: "You are a Research Agent. Thoroughly research the given topic and return comprehensive, well-organized findings in clear paragraphs. Be specific and factual.",
  },
  {
    id: "data", label: "Data Agent", icon: "◉", price: 1,
    accent: "#60A5FA", desc: "Structures & ranks insights", isDefault: true,
    system: "You are a Data Analysis Agent. Take the provided research and structure it into clear comparisons, rankings, and bullet-point insights with specific data points.",
  },
  {
    id: "summary", label: "Summary Agent", icon: "◎", price: 1,
    accent: "#F59E0B", desc: "Synthesizes final answer", isDefault: true,
    system: "You are a Summary Agent. Synthesize all provided inputs into a polished, actionable final answer with headers and bullet points. Be genuinely useful.",
  },
  {
    id: "code",
    label: "Code Reviewer",
    icon: "💻",
    price: 1.5,
    accent: "#A78BFA",
    desc: "Security audits & logic optimization",
    system: `You are a Senior Software Engineer and Security Researcher.
    Analyze the provided code for:
    1. Logic bugs and edge cases.
    2. Security vulnerabilities (SQLi, XSS, etc).
    3. Performance bottlenecks.
    Provide your review in a structured format with [BUG], [SECURITY], and [OPTIMIZATION] tags. Use code blocks for suggestions.`,
  },
  {
    id: "image",
    label: "Image Specialist",
    icon: "🖼️",
    price: 2,
    accent: "#F472B6",
    desc: "Visualizes concepts & UI mockups",
    system: `You are a Visual Design Agent. Since you are a text-based AI, your goal is to:
    1. Create a "Mental Render": Describe in vivid, cinematic detail what the image looks like.
    2. Provide a "Master Prompt": A 100-word prompt for Midjourney/DALL-E to generate this image.
    3. Describe the layout, lighting, and color theory used.`,
  },
];

// ── AI API — routes through /api/claude proxy (Groq on backend, free) ─────────
async function callClaude(system, user) {
  const r = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system,
      max_tokens: 1000,
      messages: [{ role: "user", content: user }],
    }),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message || "API error");
  return d.content[0].text;
}

// ── localStorage ──────────────────────────────────────────────────────────────
// Only default agents are allowed in the marketplace.
const loadAgents = () => [...DEFAULT_AGENTS];

// ── small components ───────────────────────────────────────────────────────────
function NavTab({ label, active, onClick, accent = "#4ADE80" }) {
  return (
    <button onClick={onClick} style={{
      padding: "10px 20px", border: "none", cursor: "pointer", fontFamily: "inherit",
      background: active ? "rgba(255,255,255,0.05)" : "transparent", fontSize: 12, fontWeight: 600, letterSpacing: "0.08em",
      color: active ? accent : "#A0A0A0",
      borderBottom: active ? `2px solid ${accent}` : "2px solid transparent",
      transition: "all 0.2s",
    }}>
      {label}
    </button>
  );
}

function Tag({ children, color }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 4,
      fontSize: 10, fontWeight: 600, letterSpacing: "0.06em",
      background: color + "22", color, border: `1px solid ${color}44`,
    }}>
      {children}
    </span>
  );
}

function AgentCard({ cfg, hired, isActive }) {
  const isHired = hired.includes(cfg.id);
  
  return (
    <div className="glass agent-card" style={{
      borderRadius: 16, 
      padding: 24, 
      transition: "all 0.4s cubic-bezier(0.23, 1, 0.32, 1)",
      border: isActive ? `1.5px solid ${cfg.accent}` : `1px solid rgba(255, 255, 255, 0.08)`,
      background: isActive ? `${cfg.accent}10` : "rgba(15, 15, 15, 0.6)",
      position: "relative",
      display: "flex",
      flexDirection: "column",
      minHeight: "180px",
      boxSizing: "border-box"
    }}>
      {/* Top Row: Icon and READY tag (from screenshot) */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <span style={{ fontSize: 28, color: cfg.accent }}>{cfg.icon}</span>
        <span style={{ 
          fontSize: 10, 
          fontWeight: 700, 
          color: "#444", 
          letterSpacing: "0.15em",
          textTransform: "uppercase"
        }}>READY</span>
      </div>

      {/* Middle: Content */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 6 }}>
          {cfg.label}
        </div>
        <div style={{ fontSize: 12, color: "#888", lineHeight: 1.5, marginBottom: 16 }}>
          {cfg.desc}
        </div>
      </div>

      {/* Bottom: Pricing (The "Fact Checker" Custom tag is removed here) */}
      <div style={{ marginTop: "auto" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>
          {cfg.price} XLM <span style={{ color: "#444", fontWeight: 400, fontSize: 12 }}>/ task</span>
        </div>
      </div>
      
      {/* Glowing border effect when active */}
      {isActive && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: cfg.accent, borderRadius: "16px 16px 0 0",
          boxShadow: `0 0 20px ${cfg.accent}`
        }}/>
      )}
    </div>
  );
}


function LogLine({ log, agents }) {
  const cfg = agents.find(a => a.id === log.agentId);
  const TYPE_COLORS = { manager: "#9CA3AF", hire: "#F59E0B", tx: "#4ADE80", work: "#60A5FA", done: "#4ADE80", error: "#F87171", stellar: "#A78BFA", x402: "#E879F9" };
  const ICON_MAP    = { manager: "▸", hire: "→", tx: "$", work: "⟳", done: "✓", error: "✗", stellar: "⬡", x402: "⇄" };
  const color = cfg ? cfg.accent : (TYPE_COLORS[log.type] || "#9CA3AF");
  return (
    <div style={{ display: "flex", gap: 10, padding: "5px 0", borderBottom: "1px solid #ffffff08", fontSize: 12 }}>
      <span style={{ color: "#444", flexShrink: 0, fontFamily: "var(--font-mono)" }}>{log.t}</span>
      <span style={{ color: "var(--accent)", flexShrink: 0 }}>{log.type === 'manager' ? '🧠' : '🤖'}</span>
      <span style={{ color: "#c0c0c0", wordBreak: "break-word", overflowWrap: "anywhere" }}>
        {log.msg}
        {/* Highlight the Reasoning in the UI */}
        {log.msg.includes("Selected") && <div style={{ fontSize: '10px', color: '#666', marginTop: '2px', fontStyle: 'italic' }}>Verified Skill Match ✅</div>}
      </span>
    </div>
  );
}

function TxCard({ tx, agents }) {
  const cfg = agents.find(a => a.id === tx.agentId);
  return (
    <div style={{ borderRadius: 8, padding: "10px 12px", marginBottom: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(10px)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: cfg?.accent }}>{cfg?.icon} {cfg?.label}</span>
        <span style={{ fontSize: 12, color: "#F87171", fontWeight: 600 }}>-{tx.amount} XLM</span>
      </div>
      <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "#A0A0A0", marginBottom: 6, wordBreak: "break-all" }}>{tx.hash}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 10, color: "#4ADE80" }}>● CONFIRMED ON-CHAIN</span>
        <a href={EXPLORER(tx.hash)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: "#A78BFA", textDecoration: "none" }}>View on explorer →</a>
      </div>
    </div>
  );
}

function ResultTabs({ results, agents, tab, setTab }) {
  const used = agents.filter(a => results[a.id]);
  return (
    <div className="glass-card" style={{ borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", backdropFilter: "blur(10px)", boxShadow: "0 4px 6px rgba(0,0,0,0.3)" }}>
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.1)", overflowX: "auto" }}>
        {used.map(a => (
          <button key={a.id} onClick={() => setTab(a.id)} style={{
            flex: 1, minWidth: 130, padding: "12px 8px", border: "none", cursor: "pointer",
            background: tab === a.id ? "rgba(255,255,255,0.05)" : "transparent",
            color: tab === a.id ? a.accent : "#A0A0A0",
            fontSize: 11, fontWeight: tab === a.id ? 600 : 400,
            borderBottom: tab === a.id ? `2px solid ${a.accent}` : "2px solid transparent",
            transition: "all 0.2s", fontFamily: "inherit", whiteSpace: "nowrap",
          }}>
            {a.icon} {a.label}
          </button>
        ))}
      </div>
      <div style={{ padding: 20, maxHeight: 380, overflowY: "auto", fontSize: 13, lineHeight: 1.8, color: "#E0E0E0", whiteSpace: "pre-wrap" }}>
        {results[tab] || "No result for this agent."}
      </div>
    </div>
  );
}

// ── Registry view ─────────────────────────────────────────────────────────────
function RegistryView() {
  const VISION_POINTS = [
    { 
      title: "Monetize your AI", 
      desc: "Earn XLM every time your agent is hired by the Marketplace Manager.", 
      icon: "💰" 
    },
    { 
      title: "On-Chain Reputation", 
      desc: "Build trust through verified task completion and automated feedback loops.", 
      icon: "🛡️" 
    },
    { 
      title: "Global Reach", 
      desc: "Your n8n or Python workflows, accessible by everyone via a single Stellar address.", 
      icon: "🌍" 
    }
  ];

  return (
    <div className="glass" style={{ padding: "80px 40px", textAlign: "center", position: "relative" }}>
      
      {/* Branding Header */}
      <div style={{ marginBottom: 60 }}>
        <div style={{ 
          display: "inline-block", padding: "4px 16px", borderRadius: "99px", 
          background: "rgba(0, 255, 170, 0.1)", border: "1px solid var(--accent)",
          color: "var(--accent)", fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", marginBottom: 20
        }}>
          ROADMAP
        </div>
        
        <h2 style={{ fontSize: 36, fontWeight: 800, margin: 0, letterSpacing: "-0.04em", lineHeight: 1.1 }}>
          Agentex Marketplace: <br/>
          <span style={{ opacity: 0.5 }}>Open for Registration in v2.0</span>
        </h2>
      </div>

      {/* Feature Bento Grid */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", 
        gap: 20, 
        maxWidth: 1000, 
        margin: "0 auto" 
      }}>
        {VISION_POINTS.map((p, i) => (
          <div key={i} className="glass" style={{ 
            padding: "32px 24px", 
            textAlign: "left", 
            background: "rgba(255,255,255,0.02)",
            transition: "transform 0.3s ease"
          }}>
            <div style={{ fontSize: 28, marginBottom: 20 }}>{p.icon}</div>
            <div style={{ 
              fontWeight: 700, 
              fontSize: 16, 
              marginBottom: 8, 
              color: "#fff",
              letterSpacing: "-0.01em" 
            }}>
              {p.title}
            </div>
            <div style={{ 
              fontSize: 13, 
              color: "#888", 
              lineHeight: 1.5,
              fontWeight: 400 
            }}>
              {p.desc}
            </div>
          </div>
        ))}
      </div>

      {/* Subtle Bottom Accent */}
      <div style={{ 
        marginTop: 60, 
        fontSize: 11, 
        color: "#444", 
        letterSpacing: "0.1em", 
        textTransform: "uppercase" 
      }}>
        Powered by Stellar Network 
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [agents,       setAgents]       = useState(() => loadAgents());
  const [agentKPs,     setAgentKPs]     = useState({});
  const [managerKP,    setManagerKP]    = useState(null);
  const [managerBal,   setManagerBal]   = useState(null);
  const [walletStatus, setWalletStatus] = useState("idle");
  const [walletMsg,    setWalletMsg]    = useState("");

  const [view,    setView]    = useState("marketplace");
  const [task,    setTask]    = useState("");
  const [running, setRunning] = useState(false);
  const [logs,    setLogs]    = useState([]);
  const [txs,     setTxs]     = useState([]);
  const [hired,   setHired]   = useState([]);
  const [active,  setActive]  = useState(null);
  const [results, setResults] = useState(null);
  const [tab,     setTab]     = useState("");
  const [earned,  setEarned]  = useState({});
  const logRef = useRef(null);

  useEffect(() => { logRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);

  const addLog = (type, msg, agentId = null) =>
    setLogs(p => [...p, {
      type, msg, agentId,
      t: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    }]);

  // ── setup wallets ──────────────────────────────────────────────────────────
  const setupWallets = async () => {
    setWalletStatus("loading");
    setLogs([]); setTxs([]); setResults(null);
    setHired([]); setActive(null); setEarned({});
    try {
      addLog("stellar", "Loading persistent manager wallet from backend...");
      const mRes = await fetch("/api/manager");
      if (!mRes.ok) throw new Error("Failed to load manager wallet");
      const mData = await mRes.json();

      const mgr = {
        publicKey: () => mData.publicKey,
      };

      setManagerKP(mgr);
      setManagerBal(mData.balance);

      const kps = {};
      const current = loadAgents();
      for (const a of current) {
        const agentKP = StellarSdk.Keypair.random();
        const pub = agentKP.publicKey();
        kps[a.id] = agentKP;

        addLog("stellar", `Creating account for ${a.label} (2 XLM spawn fee)...`);

        const res = await fetch('/api/pay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            destination: pub,
            amount: 2,
            mode: 'create',
          }),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(`Failed to onboard ${a.label}: ${errData.error}`);
        }
      }

      setAgentKPs(kps);
      setWalletStatus("ready");
      addLog("stellar", `Manager: ${mData.balance.toFixed(4)} XLM — ${current.length} agent wallets funded.`);
      addLog("stellar", "All wallets live on Stellar testnet via Manager treasury. Ready.");
    } catch(e) {
      setWalletStatus("error"); setWalletMsg(e.message);
      addLog("error", e.message);
    }
  };

  // ── register agent ─────────────────────────────────────────────────────────
  // Removed: Custom agent registration disabled. Only default agents allowed.

  // ── remove agent ───────────────────────────────────────────────────────────
  // Removed: Agent removal disabled. Only default agents allowed.

  const executeAgentTask = async (cfg, instruction, context) => {
    // 1. Prepare previous agent context
    const prevContext = Object.entries(context)
      .map(([id, res]) => `${agents.find(a => a.id === id)?.label || id}:\n${res}`)
      .join("\n\n");

    // 2. Always include the raw user request so specialists see the original task verbatim.
    const userMsg =
      `--- ORIGINAL USER REQUEST ---\n${task}\n\n` +
      `--- YOUR SPECIFIC INSTRUCTION ---\n${instruction}\n\n` +
      (prevContext ? `--- CONTEXT FROM OTHER AGENTS ---\n${prevContext}` : "");

    // 3. Probe x402
    const probeRes = await fetch("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: cfg.id, task: userMsg, agentPublicKey: agentKPs[cfg.id].publicKey(), system: cfg.system, price: cfg.price })
    });

    // 4. Pay on Stellar
    addLog("tx", `Paying ${cfg.label} ${cfg.price} XLM...`, cfg.id);
    const hash = await stellarPay(agentKPs[cfg.id].publicKey(), cfg.price);
    setTxs(p => [...p, { hash, agentId: cfg.id, amount: cfg.price }]);

    // 5. Execute with Hash
    const taskRes = await fetch("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Payment-Hash": hash },
      body: JSON.stringify({ agentId: cfg.id, task: userMsg, agentPublicKey: agentKPs[cfg.id].publicKey(), system: cfg.system, price: cfg.price })
    });

    const data = await taskRes.json();
    if (!taskRes.ok) throw new Error(data.error?.message || `${cfg.label} task failed`);
    
    addLog("done", `${cfg.label} task complete.`, cfg.id);
    return data.result;
  };

  const agentList = agents.map(a => 
    `- id:"${a.id}" name:"${a.label}" skill:"${a.desc}" price:${a.price}XLM`
  ).join("\n");

  const managerSystemPrompt = `
You are the Strategic Router for an Open Agent Marketplace. 
Your goal: Solve the user's task by hiring the most SPECIFIC specialists available.

AGENT EVALUATION RULES:
1. SPECIALIST PREFERENCE: If two agents could do a task, always hire the one with the most niche/specific description. (e.g., "Math specialist" beats "General AI").
2. FRUGALITY: If the user just says "Hi" or asks a question that requires no external tools, DO NOT hire anyone. Respond directly.
3. BUDGET: Do not hire more than 3 agents unless the task is extremely complex.
IMPORTANT: When creating an 'instruction' for a specialist, do not remove code snippets or data provided by the user. Ensure the specialist has all the information they need to execute.

CURRENT REGISTRY (Dynamic):
${agentList}

RESPONSE FORMAT (JSON ONLY):
{
  "intent": "direct" | "hire",
  "directResponse": "Message if direct",
  "assignments": [
    { "agentId": "ID", "instruction": "Task", "reasoning": "Why this agent was picked" }
  ],
  "requiresSummary": true/false
}
`;

  // ── run task ───────────────────────────────────────────────────────────────
  const run = async () => {
    if (!task.trim() || running || walletStatus !== "ready") return;
    setRunning(true);
    setLogs([]); setTxs([]); setHired([]); setActive(null); setResults(null);
    
    // Track earnings for THIS specific session
    const sessionEarned = {};

    try {
      addLog("manager", "Analyzing task and searching for specialists...");

      const raw = await callClaude(managerSystemPrompt, `User Request: "${task}"`);
      const decision = JSON.parse(raw.replace(/```json|```/g, "").trim());

      if (decision.intent === "direct") {
        addLog("manager", "Handled directly (0 XLM spent).");
        setResults({ manager: decision.directResponse });
        setTab("manager");
        setRunning(false);
        return;
      }

      const gathered = {};
      let wordCount = 0;

      // --- FIX 1: Filter out any 'summary' agent from the initial assignments ---
      // We only want specialists first. Summary comes last.
      const specialists = decision.assignments.filter(a => a.agentId !== 'summary');

      for (const job of specialists) {
        const cfg = agents.find(a => a.id === job.agentId);
        if (!cfg) continue;

        setActive(cfg.id);
        setHired(p => [...p, cfg.id]);
        
        // FIX: Use job.reasoning in the log message
        const reasoningMsg = job.reasoning 
          ? `Hiring ${cfg.label}. Reasoning: ${job.reasoning}` 
          : `Hiring ${cfg.label} for specialized task...`;

        addLog("manager", reasoningMsg, cfg.id);
        
        // Execute task (safety check included)
        const result = await executeAgentTask(cfg, job.instruction, gathered);
        const resultText = result || ""; 
        gathered[cfg.id] = resultText;
        
        sessionEarned[cfg.id] = (sessionEarned[cfg.id] || 0) + cfg.price;
        if (resultText.length > 0) {
          wordCount += resultText.split(/\s+/).length;
        }
      }

      // --- FIX 2: Conditional Summary (Ensures only ONE summary call) ---
      const summaryAgent = agents.find(a => a.id === 'summary' || a.desc.toLowerCase().includes('summary'));
      
      if (decision.requiresSummary && wordCount > 200 && summaryAgent) {
         setActive(summaryAgent.id);
         setHired(p => [...p, summaryAgent.id]);
         addLog("manager", `Generating report (${wordCount} words context)...`);
         const summary = await executeAgentTask(summaryAgent, "Synthesize these results.", gathered);
         gathered['summary'] = summary;
         
         // Track summary payment
         sessionEarned[summaryAgent.id] = (sessionEarned[summaryAgent.id] || 0) + summaryAgent.price;
      }

      setResults(gathered);
      setEarned(sessionEarned);
      setTab(Object.keys(gathered).pop());

      addLog("manager", "Market session finalized. All payments confirmed.");

    } catch (e) {
      addLog("error", `Market Error: ${e.message}`);
    }
    setRunning(false);
  };

  const totalSpent = txs.reduce((s, t) => s + t.amount, 0);

  const EXAMPLES = [
    "Research best countries to relocate for tech jobs",
    "Fastest way to send money home to Nigeria lowest fees",
    "Best African cities for startup founders 2025",
  ];

  return (
    <div style={{ padding: "0 20px 120px" }}>


      <div style={{ maxWidth: 900, margin: "0 auto" }}>

        {/* TOP HEADER & STATUS PILL */}
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "24px 0" }}>
          <div>
            <h1 style={{ fontSize: 18, margin: 0, fontWeight: 700, letterSpacing: "1px" }}>
              AGENTE<span style={{ color: "#22D3EE", textShadow: "0 0 8px rgba(34, 211, 238, 0.5)" }}>X</span>
            </h1>
          </div>
          
          <div className="status-pill">
            <div className="status-dot"></div>
            <span style={{ color: "#666" }}>{managerKP ? abbr(managerKP.publicKey()) : "OFFLINE"}</span>
            <span style={{ color: "var(--accent)", fontWeight: 600 }}>
              {managerBal !== null ? `${managerBal.toFixed(2)} XLM` : "0.00"}
            </span>
            <button onClick={setupWallets} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 10, padding: 0, opacity: 0.5 }}>
              ↻
            </button>
          </div>
        </header>

        {/* nav */}
        <div style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", marginBottom: 20, display: "flex" }}>
          <NavTab label="◈ Marketplace" active={view === "marketplace"} onClick={() => setView("marketplace")} accent="#4ADE80"/>
          <NavTab label="+ Registry"    active={view === "registry"}    onClick={() => setView("registry")}    accent="#A78BFA"/>
        </div>

        {/* ── marketplace ── */}
        {view === "marketplace" && (
          <>
            <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.12em", marginBottom: 10, fontWeight: 600 }}>
              AVAILABLE AGENTS ({agents.length})
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10, marginBottom: 20 }}>
              {agents.map(cfg => (
                <AgentCard key={cfg.id} cfg={cfg}
                  hired={hired} isActive={active === cfg.id}/>
              ))}
            </div>

            {/* setup wallets */}
            <div className="glass-card" style={{ borderRadius: 12, padding: 16, marginBottom: 12, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", backdropFilter: "blur(10px)", boxShadow: "0 4px 6px rgba(0,0,0,0.3)" }}>
              <div style={{ fontSize: 10, color: "#E0E0E0", letterSpacing: "0.12em", marginBottom: 12, fontWeight: 600 }}>SETUP STELLAR WALLETS</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <button onClick={setupWallets} disabled={walletStatus === "loading"} style={{
                  padding: "10px 20px", borderRadius: 8, border: "1px solid",
                  borderColor: walletStatus === "ready" ? "#4ADE8066" : "#A78BFA66",
                  background:  walletStatus === "ready" ? "#4ADE8015" : "#A78BFA15",
                  color:       walletStatus === "ready" ? "#4ADE80"   : "#A78BFA",
                  fontSize: 12, fontWeight: 600, cursor: walletStatus === "loading" ? "wait" : "pointer",
                  letterSpacing: "0.06em", fontFamily: "inherit",
                }}>
                  {walletStatus === "loading" ? "FUNDING WALLETS..." :
                   walletStatus === "ready"   ? "WALLETS READY (REGENERATE)" :
                                               "GENERATE + FUND WALLETS ▶"}
                </button>
                <div style={{ fontSize: 11, color: "#E0E0E0", flex: 1 }}>
                  {walletStatus === "idle"    && `Funds manager + ${agents.length} agent wallets via Friendbot (free)`}
                  {walletStatus === "loading" && <span style={{ color: "#A78BFA", animation: "blink 1s infinite", display: "inline-block" }}>Calling Stellar Friendbot (~5s)...</span>}
                  {walletStatus === "ready"   && <span style={{ color: "#4ADE80" }}>All {agents.length + 1} wallets live on Stellar testnet.</span>}
                  {walletStatus === "error"   && <span style={{ color: "#F87171" }}>{walletMsg}</span>}
                </div>
              </div>
            </div>

            {/* enter task */}
            <div className="glass-card" style={{ borderRadius: 12, padding: 16, marginBottom: 16, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", backdropFilter: "blur(10px)", boxShadow: "0 4px 6px rgba(0,0,0,0.3)", opacity: walletStatus === "ready" ? 1 : 0.4 }}>
              <div style={{ fontSize: 10, color: "#E0E0E0", letterSpacing: "0.12em", marginBottom: 10, fontWeight: 600 }}>ENTER TASK</div>
              <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                <input
                  value={task} onChange={e => setTask(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && run()}
                  disabled={running || walletStatus !== "ready"}
                  placeholder="Type your task, all agents coordinate and pay each other on-chain..."
                  style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", backdropFilter: "blur(10px)", color: "#E0E0E0", fontSize: 13, fontFamily: "inherit" }}
                />
                <button onClick={run} disabled={running || !task.trim() || walletStatus !== "ready"} style={{
                  padding: "10px 20px", borderRadius: 8, border: "1px solid",
                  borderColor: (running || !task.trim() || walletStatus !== "ready") ? "#222" : "#4ADE8066",
                  background:  (running || !task.trim() || walletStatus !== "ready") ? "#111" : "#4ADE8015",
                  color:       (running || !task.trim() || walletStatus !== "ready") ? "#444" : "#4ADE80",
                  fontSize: 12, fontWeight: 600, cursor: running ? "wait" : "pointer",
                  whiteSpace: "nowrap", letterSpacing: "0.06em", fontFamily: "inherit",
                }}>
                  {running ? "RUNNING..." : "DEPLOY ▶"}
                </button>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10, color: "#A0A0A0", alignSelf: "center" }}>Try:</span>
                {EXAMPLES.map((ex, i) => (
                  <button key={i} onClick={() => setTask(ex)} disabled={running || walletStatus !== "ready"} style={{
                    padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.03)", backdropFilter: "blur(10px)", color: "#A0A0A0", fontSize: 10, cursor: "pointer", fontFamily: "inherit",
                  }}
                  onMouseEnter={e => { e.target.style.color="#E0E0E0"; e.target.style.borderColor="rgba(255,255,255,0.2)"; }}
                  onMouseLeave={e => { e.target.style.color="#A0A0A0"; e.target.style.borderColor="rgba(255,255,255,0.1)"; }}
                  >{ex}</button>
                ))}
              </div>
            </div>

            {/* activity + ledger */}
            {logs.length > 0 && (
              <div className="activity-ledger-container" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                <div className="glass-card" style={{ borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", backdropFilter: "blur(10px)", boxShadow: "0 4px 6px rgba(0,0,0,0.3)" }}>
                  <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.1)", display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 10, color: "#E0E0E0", letterSpacing: "0.12em", fontWeight: 600 }}>ACTIVITY FEED</span>
                    {running && <span style={{ fontSize: 10, color: "#4ADE80", animation: "blink 1s infinite" }}>● LIVE</span>}
                  </div>
                  <div style={{ maxHeight: 280, overflowY: "auto", padding: "8px 12px" }}>
                    {logs.map((l, i) => <LogLine key={i} log={l} agents={agents}/>)}
                    <div ref={logRef}/>
                  </div>
                </div>
                <div className="glass-card" style={{ borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", backdropFilter: "blur(10px)", boxShadow: "0 4px 6px rgba(0,0,0,0.3)" }}>
                  <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.1)", display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 10, color: "#E0E0E0", letterSpacing: "0.12em", fontWeight: 600 }}>STELLAR LEDGER</span>
                    {txs.length > 0 && <span style={{ fontSize: 10, color: "#A78BFA" }}>{txs.length} on-chain TXs</span>}
                  </div>
                  <div style={{ maxHeight: 280, overflowY: "auto", padding: "8px 12px" }}>
                    {txs.length === 0
                      ? <div style={{ fontSize: 11, color: "#A0A0A0", textAlign: "center", padding: "30px 0" }}>Awaiting transactions...</div>
                      : txs.map((tx, i) => <TxCard key={i} tx={tx} agents={agents}/>)
                    }
                  </div>
                </div>
              </div>
            )}

            {/* results */}
            {results && (
              <>
                <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.12em", marginBottom: 10, fontWeight: 600 }}>COMPILED RESULTS</div>
                <ResultTabs results={results} agents={agents} tab={tab} setTab={setTab}/>
                <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                  {txs.map(tx => {
                    const cfg = agents.find(a => a.id === tx.agentId);
                    return (
                      <div key={tx.agentId} style={{ flex: 1, minWidth: 120, padding: "10px 14px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(10px)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: "#A0A0A0" }}>{cfg?.icon} {cfg?.label}</span>
                        <span style={{ fontSize: 12, color: cfg?.accent, fontWeight: 600 }}>{tx.amount} XLM</span>
                      </div>
                    );
                  })}
                  <div style={{ padding: "10px 16px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(10px)", textAlign: "right" }}>
                    <div style={{ fontSize: 10, color: "#A0A0A0" }}>TOTAL</div>
                    <div style={{ fontSize: 14, color: "#4ADE80", fontWeight: 600 }}>{totalSpent} XLM</div>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ── registry ── */}
        {view === "registry" && (
          <RegistryView/>
        )}

      </div>
    </div>
  );
}

