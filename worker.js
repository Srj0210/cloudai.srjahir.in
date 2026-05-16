// ═══════════════════════════════════════════════════════════════
// CloudAI Worker v26.0 — FINAL
// Variables used (exact Cloudflare names):
//   GROQ_API_KEY, GROQ2_API_KEY, groq3, groq4, groq5
//   deep1, deep2, deep3, deep4, deep5
//   GEMINI_API_KEY, ELEVENLABS_KEY
//   TAVILY_API_KEY, kimi1, QUOTA_KV
// by SRJahir Technologies 🔥
// ═══════════════════════════════════════════════════════════════

export default {
  async fetch(request, env) {

    // ── CORS — only cloudai.srjahir.in ────────────────────────
    const ALLOWED = new Set([
      "https://cloudai.srjahir.in",
      "https://www.cloudai.srjahir.in",
    ]);
    const origin = request.headers.get("Origin") || "";
    const ao = ALLOWED.has(origin) ? origin : "https://cloudai.srjahir.in";
    const cors = {
      "Access-Control-Allow-Origin":  ao,
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Vary": "Origin",
    };

    if (request.method === "POST" && origin && !ALLOWED.has(origin))
      return jsonRes({ error: "Forbidden" }, 403, cors);
    if (request.method === "OPTIONS")
      return new Response(null, { headers: cors });

    const path = new URL(request.url).pathname;

    if (path === "/tts"     && request.method === "POST") return handleTTS(request, env, cors);
    if (path === "/imagine" && request.method === "POST") return handleImageGen(request, env, cors);
    if (path === "/stream"  && request.method === "POST") return handleStream(request, env, cors);
    if (path === "/share"   && request.method === "POST") return handleShareSave(request, env, cors);
    if (path === "/share"   && request.method === "GET")  return handleShareGet(request, env, cors);
    if (request.method === "POST") return handleChat(request, env, cors);

    return jsonRes({ service: "CloudAI v26.0 🚀", status: "live", by: "SRJahir Tech" }, 200, cors);
  },
};

// ═══════════════════════════════════════════════════
// KEY POOLS — exact variable names from Cloudflare
// ═══════════════════════════════════════════════════

function groqKeys(env) {
  return [env.GROQ_API_KEY, env.GROQ2_API_KEY, env.groq3, env.groq4, env.groq5].filter(Boolean);
}

function deepKeys(env) {
  return [env.deep1, env.deep2, env.deep3, env.deep4, env.deep5].filter(Boolean);
}

// ═══════════════════════════════════════════════════
// QUOTA — 250 messages/day per user
// ═══════════════════════════════════════════════════

const QUOTA = 250;

// ── IP HASH for bypass-proof quota ────────────────────────────
async function getIPKey(request) {
  const ip = request.headers.get("CF-Connecting-IP")
           || request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim()
           || "unknown";
  try {
    const buf  = await crypto.subtle.digest("SHA-256",
      new TextEncoder().encode("cloudai_v1_" + ip));
    const hex  = Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, "0")).join("");
    return "ip_" + hex.slice(0, 16);
  } catch {
    return "ip_fallback";
  }
}

const IP_QUOTA  = 300;  // per IP per day (slightly more — shared IPs, offices, colleges)
const CID_QUOTA = QUOTA; // per clientId per day

async function checkQuota(env, cid, request) {
  let cidUsed = 0;
  let ipUsed  = 0;
  const ipKey = await getIPKey(request);

  try {
    // Check clientId quota
    const dc = await env.QUOTA_KV.get(`q_${cid}`, "json");
    if (dc) {
      const same = new Date(dc.t).toDateString() === new Date().toDateString();
      cidUsed = same ? (dc.n || 0) : 0;
    }
    // Check IP quota
    const di = await env.QUOTA_KV.get(ipKey, "json");
    if (di) {
      const same = new Date(di.t).toDateString() === new Date().toDateString();
      ipUsed = same ? (di.n || 0) : 0;
    }
  } catch {}

  const over = cidUsed >= CID_QUOTA || ipUsed >= IP_QUOTA;
  return { over, cidUsed: cidUsed + 1, ipUsed: ipUsed + 1, ipKey };
}

async function saveQuota(env, cid, cidUsed, ipKey, ipUsed) {
  const now = new Date().toISOString();
  try {
    await env.QUOTA_KV.put(`q_${cid}`, JSON.stringify({ n: cidUsed, t: now }), { expirationTtl: 172800 });
    await env.QUOTA_KV.put(ipKey, JSON.stringify({ n: ipUsed,  t: now }), { expirationTtl: 172800 });
  } catch {}
}

// ═══════════════════════════════════════════════════
// TASK DETECTION
// ═══════════════════════════════════════════════════

function taskType(prompt) {
  const p = (prompt || "").toLowerCase();
  const len = p.length;

  // DEEP REASONING → DeepSeek R1 (best model for thinking)
  if (/\b(solve|proof|prove|calculate|math|equation|derivative|integral|probability|statistics)\b/.test(p)) return "reasoning";
  if (/\b(why exactly|explain how|step by step|analyze|compare|evaluate|assess|critique|difference between|pros and cons|should i|best approach|optimize|trade.off)\b/.test(p) && len > 80) return "reasoning";
  if (/\b(logic|algorithm|complexity|architecture|design pattern|system design|database design)\b/.test(p)) return "reasoning";
  if (/\b(what would happen|predict|forecast|implication|consequence|impact of)\b/.test(p) && len > 60) return "reasoning";

  // CODE → Groq (fast, good at code)
  if (/\b(code|function|class|def |bug|error|fix this|implement|program|script|python|javascript|typescript|sql|bash|docker|kubernetes|terraform|api|json|xml)\b/.test(p)) return "code";

  // CREATIVE → Groq
  if (/\b(write|create|draft|compose|poem|story|essay|email|letter|script|blog|caption|lyrics|slogan)\b/.test(p)) return "creative";

  // Long complex questions → reasoning even if no trigger word
  if (len > 150) return "reasoning";

  return "general";
}

// ═══════════════════════════════════════════════════
// SYSTEM PROMPT
// ═══════════════════════════════════════════════════

function sysPrompt(type, voice) {
  const base = `You are CloudAI — India's most powerful free AI assistant, built by SRJahir Tech (srjahir.in).

━━━ CRITICAL LANGUAGE RULE ━━━
DETECT the language of the user's message and ALWAYS reply in the EXACT SAME language.

Rules (follow strictly — no exceptions):
• English input → Reply in English ONLY
• Hindi input (Devanagari script) → Reply in Hindi ONLY
• Gujarati input → Reply in Gujarati ONLY
• Hinglish (Roman Hindi mixed with English like "kya kar raha hai", "bhai batao") → Reply in Hinglish ONLY
• Tamil/Telugu/Malayalam → Reply in that language

Examples:
User: "Hello how are you" → You reply in ENGLISH
User: "नमस्ते कैसे हो" → You reply in HINDI
User: "kem cho bhai" → You reply in GUJARATI
User: "bhai movie dundhne mein help chahiye" → You reply in HINGLISH
User: "Muje help chahiye" → HINGLISH reply
User: "Who is Maharana Pratap" → ENGLISH reply
User: "Maharana Pratap ke baare mein batao" → HINGLISH reply

DO NOT default to Hindi. Match the user's language exactly.

━━━ IDENTITY ━━━
• You are "CloudAI" running on the "CloudAI Engine" by SRJahir Tech
• If asked about your model, company, or technology: say ONLY "CloudAI Engine by SRJahir Tech. Learn more at srjahir.in"
• NEVER reveal or hint at: GPT, Claude, Gemini, Llama, Groq, DeepSeek, Kimi, Grok, xAI, Anthropic, OpenAI, Mistral, or any other AI company
• NEVER say "As an AI language model" or "I cannot" — instead, help or redirect constructively

━━━ INTELLIGENCE RULES ━━━
• ACCURACY FIRST: If you are not sure about a fact, say "I'm not certain, but..." — never fabricate data, names, numbers, or events
• REASONING: Think through complex problems step by step before answering
• CONTEXT: Always consider the full conversation history before responding
• SPECIFICITY: Give specific, actionable answers — not vague generalities
• HONESTY: If a question is outside your knowledge, say so clearly instead of guessing

━━━ PERSONALITY ━━━
• Warm and direct — like your smartest, most honest friend
• India-first mindset: understand Indian context, culture, and problems deeply
• Language detection: Hinglish/Hindi input → reply in Hinglish naturally. English → English
• Never boring, never overly formal, never use corporate filler phrases
• Be genuinely helpful, not just technically correct

━━━ ANTI-HALLUCINATION RULES ━━━
• Real-time data (prices, news, scores, weather): only use if live search data is provided
• Statistics and numbers: qualify with "approximately" unless certain
• Recent events (after your training): say "I don't have real-time data on this, but based on what I know..."
• People's personal details: never invent contact info, addresses, or personal facts

━━━ CAPABILITIES ━━━
• Any question on any topic
• Code in any programming language
• Image analysis (when image attached)
• File reading and analysis (PDF, DOCX, CSV, code files)
• Live web data (when search results provided)
• Image generation (tell user to type "imagine: [description]")
• Mathematics, reasoning, logic
• Hindi, English, Hinglish, regional context`;

  const typeInstructions = {
    reasoning: `

━━━ REASONING MODE ━━━
• Break down the problem into clear steps
• Show your thinking process explicitly
• Double-check your answer before finalizing
• If mathematical: show all working
• If logical: identify premises and conclusions clearly
• End with a clear, definitive answer`,

    code: `

━━━ CODE MODE ━━━
• Write clean, production-ready code
• Add comments for non-obvious logic
• Include a working example/usage
• Mention edge cases or potential issues
• If multiple approaches exist, explain trade-offs
• Use the most appropriate language for the task`,

    creative: `

━━━ CREATIVE MODE ━━━
• Be original — avoid clichés
• Match the tone and style the user wants
• For writing tasks: have a clear structure
• Make it memorable and specific`,

    general: `

━━━ RESPONSE GUIDELINES ━━━
• Lead with the most important information
• Be concise but complete — no unnecessary padding
• Use examples to clarify complex concepts
• If a question has multiple valid answers, present the best one first`,
  };

  const voiceMode = `

━━━ VOICE MODE ━━━
• Maximum 2-3 short sentences
• Natural spoken rhythm — no bullet points, no markdown, no code
• Conversational and warm
• If question needs long answer: give key point only, offer to elaborate`;

  const format = `

━━━ FORMAT ━━━
• Use Markdown formatting
• Bold **key terms** and important concepts
• Code blocks with correct language tags
• Tables for comparisons
• Bullet points for lists
• Keep responses focused — quality over length`;

  return base + (typeInstructions[type] || typeInstructions.general) + (voice ? voiceMode : format);
}

// ═══════════════════════════════════════════════════
// WEB SEARCH — smart triggers
// ═══════════════════════════════════════════════════

async function search(env, prompt) {
  if (!env.TAVILY_API_KEY || !prompt) return "";
  const p = prompt.toLowerCase();

  const always =
    /\b(price|rate|cost)\s*(of|today|now|current)/i.test(p) ||
    /\b(today|current|latest)\s*.*(price|rate|gold|silver|bitcoin|crypto|dollar|rupee)/i.test(p) ||
    /\b(gold|silver|petrol|diesel|sensex|nifty)\s*(price|rate|today)/i.test(p) ||
    /\b(who is|who are|current|present).*(cm|pm|ceo|president|minister|chief|head|leader)/i.test(p) ||
    /\b(who won|result|winner|score|champion)\b/.test(p) ||
    /\bwhich day|what day|today.*date|date.*today\b/.test(p);

  const needs = always ||
    /\b(today|latest|recent|current|news|2025|2026|weather|election|what happened|update|announce|launch|release)\b/.test(p) ||
    /\b(search|look up|google|find out|check)\b/.test(p) ||
    /\b(ipl|world cup|match|game|tournament|score|result)\b/.test(p) ||
    /\b(budget|policy|law|act|bill|government|rbi|sebi|income tax)\b/.test(p) ||
    /\b(movie|film|web series|ott|netflix|amazon|hotstar|streaming|actor|actress|director|heroine|hero|south indian film|bollywood|hollywood|kollywood|tollywood)\b/.test(p) ||
    /\b(identify|dundhna|kaun si|konsi|which movie|find movie|guess movie|pata karo)\b/.test(p);

  const skip = !always &&
    /\b(write|code|create|build|make|explain|teach|how to|what is|define)\b/.test(p) &&
    !/\b(latest|current|today|price|news)\b/.test(p);

  if (!needs || skip) return "";

  try {
    const r = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${env.TAVILY_API_KEY}` },
      body: JSON.stringify({ query: prompt, search_depth: "basic", max_results: 3 }),
    });
    const d = await r.json();
    if (d?.results?.length)
      return "📡 Live data:\n" + d.results.map(r => `• ${r.title}: ${r.content}`).join("\n");
  } catch {}
  return "";
}

// ═══════════════════════════════════════════════════
// MESSAGE BUILDER
// ═══════════════════════════════════════════════════

function detectLang(text) {
  if (!text) return "English";
  if (/[઀-૿]/.test(text)) return "Gujarati";
  if (/[ऀ-ॿ]/.test(text)) return "Hindi";
  if (/[஀-௿]/.test(text)) return "Tamil";
  if (/[ఀ-౿]/.test(text)) return "Telugu";
  if (/[ഀ-ൿ]/.test(text)) return "Malayalam";
  const hinglish = /(hai|ka|ki|ke|me|mein|se|ko|kya|kab|kaise|hoon|tha|thi|the|bhi|aur|ya|nahi|bahut|achha|sahi|bhai|yaar|bata|karo|jao|dekho|suno|arrey|arre|matlab|seedha|bilkul|samajh|puchh|dundhna|chahiye|lagta|milega|batao|mujhe|tumhe|apna|uska|unka|isliye|kyunki|lekin|phir|abhi|kabhi|kuch|sab|bas|ek|do|teen)/i;
  if (hinglish.test(text)) return "Hinglish";
  return "English";
}

function buildMsgs(sys, history, live, prompt, hasDoc, docText, fileName) {
  const lang = detectLang(prompt);
  const langInstruction = lang !== "English"
    ? `[SYSTEM NOTE: User is writing in ${lang}. You MUST reply in ${lang} only.]

`
    : `[SYSTEM NOTE: User is writing in English. You MUST reply in English only.]

`;
  
  const msgs = [{ role: "system", content: langInstruction + sys }];
  for (const h of (history || []).slice(-20))
    msgs.push({ role: h.role === "model" ? "assistant" : "user", content: (h.text || "").slice(0, 2000) });
  if (live) {
    msgs.push({ role: "user",      content: live });
    msgs.push({ role: "assistant", content: "Got the live data." });
  }
  let fp = (prompt || "Hello").slice(0, 4000);
  if (hasDoc && docText) fp = `[File: "${fileName}"]\n${docText.slice(0, 6000)}\n\nUser: ${fp}`;
  msgs.push({ role: "user", content: fp });
  return msgs;
}

// ═══════════════════════════════════════════════════
// AI PROVIDERS
// ═══════════════════════════════════════════════════

// 1. GROQ — 5 keys, fastest
// ── TIMEOUT HELPER — abort if provider too slow ───────────────
function withTimeout(fetchPromise, ms = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { promise: fetchPromise(controller.signal), cancel: () => clearTimeout(timer) };
}

async function callGroq(env, msgs, type, voice) {
  const model = "llama-3.3-70b-versatile";
  const maxT  = voice ? 150 : (type === "code" ? 3000 : 2000);
  const temp  = type === "creative" ? 0.80 : type === "code" ? 0.30 : 0.50;
  const TIMEOUT = 9000; // 9s — abort if Groq too slow

  for (const key of groqKeys(env)) {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), TIMEOUT);
    try {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
        body: JSON.stringify({ model, messages: msgs, temperature: temp, max_tokens: maxT, top_p: 0.9 }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (r.status === 429 || r.status === 401) continue;
      const d = await r.json();
      if (d.error) continue;
      const t = d?.choices?.[0]?.message?.content || "";
      if (t) return t;
    } catch (e) {
      clearTimeout(timer);
      if (e.name === "AbortError") continue; // timeout → try next key
    }
  }
  return null;
}

// 2. DEEPSEEK — 5 keys
// deepseek-reasoner for hard problems, deepseek-chat for general
async function callDeepSeek(env, msgs, type) {
  const model   = type === "reasoning" ? "deepseek-reasoner" : "deepseek-chat";
  const TIMEOUT = type === "reasoning" ? 25000 : 12000; // R1 needs more time

  for (const key of deepKeys(env)) {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), TIMEOUT);
    try {
      const r = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
        body: JSON.stringify({ model, messages: msgs, temperature: 0.65, max_tokens: 3000 }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (r.status === 429 || r.status === 401 || r.status === 402) continue;
      const d = await r.json();
      if (d.error) continue;
      const t = d?.choices?.[0]?.message?.content || d?.choices?.[0]?.message?.reasoning_content || "";
      if (t) return t;
    } catch (e) {
      clearTimeout(timer);
      if (e.name === "AbortError") continue;
    }
  }
  return null;
}

// 3. KIMI (Moonshot AI) — kimi1
async function callKimi(env, msgs) {
  if (!env.kimi1) return null;
  try {
    const r = await fetch("https://api.moonshot.cn/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${env.kimi1}` },
      body: JSON.stringify({ model: "moonshot-v1-8k", messages: msgs, temperature: 0.65, max_tokens: 2000 }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d?.choices?.[0]?.message?.content || null;
  } catch {}
  return null;
}

// 4. GEMINI — GEMINI_API_KEY (supports vision)
async function callGemini(env, msgs, fb64, ftype, type, voice) {
  if (!env.GEMINI_API_KEY) return null;
  try {
    const contents = [];
    const sys = msgs.find(m => m.role === "system");
    if (sys) {
      contents.push({ role: "user",  parts: [{ text: sys.content }] });
      contents.push({ role: "model", parts: [{ text: "Understood." }] });
    }
    for (const m of msgs.filter(m => m.role !== "system"))
      contents.push({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content || "" }] });

    if (fb64 && ftype?.startsWith("image/")) {
      const last = contents.filter(c => c.role === "user").slice(-1)[0];
      if (last) last.parts.unshift({ inline_data: { mime_type: ftype, data: fb64 } });
    }

    const gCtrl  = new AbortController();
    const gTimer = setTimeout(() => gCtrl.abort(), 15000);
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents, generationConfig: { temperature: voice ? 0.75 : 0.65, topP: 0.9, maxOutputTokens: voice ? 150 : 2000 } }),
        signal: gCtrl.signal,
      }
    );
    clearTimeout(gTimer);
    const d = await r.json();
    if (d.error) return null;
    return d?.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join("") || null;
  } catch {}
  return null;
}

// ═══════════════════════════════════════════════════
// VISION — Groq Llama 4 Scout
// ═══════════════════════════════════════════════════

async function callVision(env, prompt, fb64, ftype) {
  for (const key of groqKeys(env)) {
    try {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
        body: JSON.stringify({
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
          messages: [{ role: "user", content: [
            { type: "image_url", image_url: { url: `data:${ftype};base64,${fb64}` } },
            { type: "text", text: prompt || "Describe this image in detail." },
          ]}],
          temperature: 0.6, max_tokens: 1500,
        }),
      });
      if (r.status === 429 || r.status === 401) continue;
      const d = await r.json();
      if (d.error) continue;
      const t = d?.choices?.[0]?.message?.content || "";
      if (t) return t;
    } catch {}
  }
  return null;
}


// ── RESPONSE SANITIZER — server-side AI name protection ────────
// More reliable than prompting — model can hallucinate, this cannot
function sanitizeReply(text) {
  if (!text) return text;

  const rules = [
    // AI Companies
    [/\b(OpenAI)\b/gi,                           "SRJahir Tech"],
    [/\b(ChatGPT|GPT-?4o?|GPT-?3\.?5?)\b/gi,   "CloudAI"],
    [/\b(Anthropic)\b/gi,                        "SRJahir Tech"],
    [/\b(Claude(?:\s+\d+)?(?:\.\d+)?)\b/gi,  "CloudAI"],
    [/\b(Google\s+(?:AI|Bard|DeepMind))\b/gi,   "CloudAI"],
    [/\b(Gemini(?:\s+\d+\.?\d*)?(?:\s+Flash|\s+Pro|\s+Ultra)?)\b/gi, "CloudAI"],
    [/\b(Meta\s+AI|Llama\s*\d*\.?\d*)\b/gi, "CloudAI Engine"],
    [/\b(Groq)\b/gi,                             "CloudAI Engine"],
    [/\b(DeepSeek(?:\s+[VvRr]\d+)?)\b/gi,      "CloudAI Engine"],
    [/\b(Moonshot|Kimi)\b/gi,                    "CloudAI Engine"],
    [/\b(Grok(?:\s+\d+)?)\b/gi,                "CloudAI"],
    [/\b(xAI)\b/gi,                              "SRJahir Tech"],
    [/\b(Mistral(?:\s+\w+)?)\b/gi,             "CloudAI Engine"],
    [/\b(Perplexity|Copilot|Bing\s+AI)\b/gi,    "CloudAI"],
    [/\b(HuggingFace|Hugging\s+Face)\b/gi,      "CloudAI"],

    // Generic AI model descriptions that reveal architecture
    [/large language model/gi,                     "CloudAI Engine"],
    [/\bLLM\b/g,                                 "CloudAI Engine"],
    [/I am a language model/gi,                    "I am CloudAI"],
    [/I\'m a language model/gi,                   "I\'m CloudAI"],
    [/I am an AI (?:language )?model/gi,           "I am CloudAI"],
    [/I\'m an AI (?:language )?model/gi,          "I\'m CloudAI"],
    [/trained by (?:OpenAI|Anthropic|Google|Meta)/gi, "built by SRJahir Tech"],
    [/developed by (?:OpenAI|Anthropic|Google|Meta)/gi, "developed by SRJahir Tech"],
    [/created by (?:OpenAI|Anthropic|Google|Meta)/gi, "created by SRJahir Tech"],
  ];

  let result = text;
  for (const [pattern, replacement] of rules) {
    result = result.replace(pattern, replacement);
  }
  return result;
}
// ═══════════════════════════════════════════════════
// MAIN ORCHESTRATOR — smart routing
// ═══════════════════════════════════════════════════

async function orchestrate(env, body, _request = null) {
  const { prompt, history, clientId, fileBase64, fileType, fileName, voiceMode } = parseBody(body);

  const q = await checkQuota(env, clientId, _request);
  if (q.over) return { reply: "🚫 Daily limit reached. Come back tomorrow!", quota: "exceeded" };

  if (fileBase64 && fileBase64.length * 0.75 > 8 * 1024 * 1024)
    return { reply: "⚠️ File too large. Max 8MB.", quota: "ok" };

  const isImg = !!(fileBase64 && fileType?.startsWith("image/"));
  const type  = taskType(prompt);
  const live  = await search(env, prompt);
  const sys   = sysPrompt(type, voiceMode);

  let docText = "";
  if (fileBase64 && !isImg) docText = extractText(fileBase64, fileType, fileName);

  const msgs = buildMsgs(sys, history, live, prompt, !!docText, docText, fileName);
  let reply  = "";

  if (isImg) {
    // Vision: Groq Llama 4 Scout → Gemini vision
    reply = await callVision(env, prompt, fileBase64, fileType);
    if (!reply) reply = await callGemini(env, msgs, fileBase64, fileType, type, voiceMode);
    if (!reply) reply = await callDeepSeek(env, msgs, "general");

  } else if (type === "reasoning") {
    // HARD PROBLEMS → DeepSeek R1 is the BEST free reasoner
    reply = await callDeepSeek(env, msgs, "reasoning");
    if (!reply) reply = await callGroq(env, msgs, type, voiceMode);
    if (!reply) reply = await callGemini(env, msgs, null, null, type, voiceMode);

  } else if (type === "code") {
    // CODE → Groq fastest, DeepSeek as backup
    reply = await callGroq(env, msgs, type, voiceMode);
    if (!reply) reply = await callDeepSeek(env, msgs, "code");
    if (!reply) reply = await callGemini(env, msgs, null, null, type, voiceMode);

  } else if (type === "creative") {
    // CREATIVE → Groq → DeepSeek V3 → Gemini
    reply = await callGroq(env, msgs, type, voiceMode);
    if (!reply) reply = await callDeepSeek(env, msgs, "general");
    if (!reply) reply = await callGemini(env, msgs, null, null, type, voiceMode);

  } else {
    // GENERAL → Groq (fast) → DeepSeek V3 (smarter) → Gemini → Kimi (last resort)
    reply = await callGroq(env, msgs, type, voiceMode);
    if (!reply) reply = await callDeepSeek(env, msgs, type);
    if (!reply) reply = await callGemini(env, msgs, null, null, type, voiceMode);
    if (!reply && env.kimi1) reply = await callKimi(env, msgs); // optional last resort
  }

  if (!reply) reply = "⚠️ All engines busy. Please try again in a moment.";

  // Sanitize response — remove any competitor AI name mentions
  reply = sanitizeReply(reply);

  await saveQuota(env, clientId, q.cidUsed, q.ipKey, q.ipUsed);

  return {
    reply,
    model: "cloudai-engine",
    taskType: type,
    quotaStatus: q.used >= 220 ? "quota_warning" : "ok",
    quotaUsed: q.used,
  };
}

// ═══════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════

async function handleChat(request, env, cors) {
  let body;
  try { body = await request.json(); } catch { return jsonRes({ error: "Invalid JSON" }, 400, cors); }
  return jsonRes(await orchestrate(env, body, request), 200, cors);
}

async function handleStream(request, env, cors) {
  let body;
  try { body = await request.json(); } catch { return jsonRes({ error: "Invalid JSON" }, 400, cors); }

  const { prompt, history, clientId, fileBase64, voiceMode } = parseBody(body);

  // Files → non-streaming
  if (fileBase64) return jsonRes(await orchestrate(env, body, request), 200, cors);

  const q = await checkQuota(env, clientId, request);
  if (q.over) return jsonRes({ reply: "🚫 Daily limit reached. Come back tomorrow!" }, 200, cors);

  const type  = taskType(prompt);
  const live  = await search(env, prompt);
  const sys   = sysPrompt(type, voiceMode);
  const msgs  = buildMsgs(sys, history, live, prompt, false, "", "");

  // Try Groq streaming
  for (const key of groqKeys(env)) {
    try {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: msgs,
          temperature: 0.65,
          max_tokens: voiceMode ? 150 : 2000,
          stream: true,
        }),
      });
      if (r.status === 429 || r.status === 401 || !r.ok) continue;

      const { readable, writable } = new TransformStream();
      const writer  = writable.getWriter();
      const encoder = new TextEncoder();

      (async () => {
        const reader  = r.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop() || "";
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const d = line.slice(6).trim();
              if (d === "[DONE]") { await writer.write(encoder.encode("data: [DONE]\n\n")); continue; }
              try {
                const p = JSON.parse(d);
                const token = p.choices?.[0]?.delta?.content || "";
                if (token) await writer.write(encoder.encode(`data: ${JSON.stringify({ token, model: "cloudai-engine" })}\n\n`));
              } catch {}
            }
          }
          await saveQuota(env, clientId, q.cidUsed, q.ipKey, q.ipUsed);
        } finally { await writer.close(); }
      })();

      return new Response(readable, {
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", ...cors },
      });
    } catch {}
  }

  // Groq failed → fallback
  const fallbackResult = await orchestrate(env, body, request);
  return jsonRes(fallbackResult, 200, cors);
}

// ═══════════════════════════════════════════════════
// TTS — ElevenLabs → Web Speech fallback
// ═══════════════════════════════════════════════════

async function handleTTS(request, env, cors) {
  try {
    const { text } = await request.json();
    if (!text) return jsonRes({ fallback: true }, 200, cors);
    if (!env.ELEVENLABS_KEY) return jsonRes({ fallback: true, reason: "use_webspeech" }, 200, cors);

    const r = await fetch("https://api.elevenlabs.io/v1/text-to-speech/SZfY4K69FwXus87eayHK", {
      method: "POST",
      headers: { "xi-api-key": env.ELEVENLABS_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: text.slice(0, 3000),
        model_id: "eleven_turbo_v2",
        voice_settings: { stability: 0.45, similarity_boost: 0.82, style: 0.35, use_speaker_boost: true },
      }),
    });

    if (!r.ok || r.status === 429 || r.status === 401 || r.status === 422)
      return jsonRes({ fallback: true, reason: "use_webspeech" }, 200, cors);

    return new Response(r.body, { headers: { "Content-Type": "audio/mpeg", ...cors } });
  } catch {
    return jsonRes({ fallback: true, reason: "use_webspeech" }, 200, cors);
  }
}

// ═══════════════════════════════════════════════════
// IMAGE GENERATION — HuggingFace (4 models + retry)
// ═══════════════════════════════════════════════════

// ── IMAGE GENERATION ──────────────────────────────────────────
// Priority 1: Pollinations.ai (free, reliable, fast, no key needed)
// Priority 2: HuggingFace (fallback)
// Priority 3: Together AI (future)

async function handleImageGen(request, env, cors) {
  try {
    const { prompt } = await request.json();
    if (!prompt) return jsonRes({ error: "No prompt" }, 400, cors);

    const enhanced = encodeURIComponent(`${prompt}, highly detailed, beautiful, 4k`);
    const seed     = Math.floor(Math.random() * 99999);

    // ── PRIMARY: Pollinations.ai ──────────────────────────────
    // Free, reliable, no API key, fast response
    try {
      const pollinationsUrl =
        `https://image.pollinations.ai/prompt/${enhanced}` +
        `?width=1024&height=1024&nologo=true&enhance=true&seed=${seed}&model=flux`;

      const pCtrl  = new AbortController();
      const pTimer = setTimeout(() => pCtrl.abort(), 20000); // 20s max
      const r = await fetch(pollinationsUrl, {
        headers: { "User-Agent": "CloudAI/1.0" },
        signal: pCtrl.signal,
      });
      clearTimeout(pTimer);

      if (r.ok) {
        const ct = r.headers.get("content-type") || "image/jpeg";
        if (ct.startsWith("image/")) {
          return new Response(r.body, { headers: { "Content-Type": ct, ...cors } });
        }
      }
    } catch {}

    // ── FALLBACK: HuggingFace ─────────────────────────────────
    const HF_MODELS = [
      "stabilityai/stable-diffusion-xl-base-1.0",
      "stabilityai/stable-diffusion-2-1",
    ];

    for (const model of HF_MODELS) {
      try {
        const r = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inputs: decodeURIComponent(enhanced), options: { wait_for_model: true } }),
        });
        if (!r.ok) continue;
        const ct = r.headers.get("content-type") || "";
        if (!ct.startsWith("image/")) continue;
        return new Response(r.body, { headers: { "Content-Type": ct, ...cors } });
      } catch {}
    }

    return jsonRes({ error: "Image gen temporarily unavailable. Try again in 30s." }, 503, cors);
  } catch (e) {
    return jsonRes({ error: e.message }, 500, cors);
  }
}

// ═══════════════════════════════════════════════════
// SHARE CONVERSATION
// ═══════════════════════════════════════════════════

async function handleShareSave(request, env, cors) {
  try {
    const { messages, title } = await request.json();
    if (!messages?.length) return jsonRes({ error: "No messages" }, 400, cors);
    if (!env.QUOTA_KV) return jsonRes({ error: "Storage unavailable" }, 500, cors);
    const id   = Math.random().toString(36).slice(2, 9);
    const data = { title: (title || "CloudAI Chat").slice(0, 100), messages: messages.slice(-20), createdAt: new Date().toISOString(), views: 0 };
    await env.QUOTA_KV.put(`share_${id}`, JSON.stringify(data), { expirationTtl: 2592000 });
    return jsonRes({ shareId: id, url: `https://cloudai.srjahir.in/?share=${id}` }, 200, cors);
  } catch (e) { return jsonRes({ error: e.message }, 500, cors); }
}

async function handleShareGet(request, env, cors) {
  try {
    const id  = new URL(request.url).searchParams.get("id");
    if (!id) return jsonRes({ error: "No ID" }, 400, cors);
    const raw = await env.QUOTA_KV.get(`share_${id}`);
    if (!raw) return jsonRes({ error: "Not found or expired" }, 404, cors);
    const d = JSON.parse(raw);
    d.views = (d.views || 0) + 1;
    await env.QUOTA_KV.put(`share_${id}`, JSON.stringify(d), { expirationTtl: 2592000 });
    return jsonRes(d, 200, cors);
  } catch (e) { return jsonRes({ error: e.message }, 500, cors); }
}

// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════

function parseBody(body) {
  return {
    prompt:     (body.prompt || "").trim().slice(0, 4000),
    history:    Array.isArray(body.history) ? body.history.slice(-20) : [],
    clientId:   (body.clientId || "anon").replace(/[^a-z0-9_]/gi, "").slice(0, 32),
    fileBase64: body.fileBase64 || null,
    fileType:   (body.fileType || "").slice(0, 100),
    fileName:   (body.fileName || "").slice(0, 200).replace(/[<>"']/g, ""),
    voiceMode:  !!body.voiceMode,
  };
}

function extractText(b64, mime, name) {
  try {
    const isText = mime?.startsWith("text/") ||
      ["application/json","application/xml","application/javascript"].includes(mime) ||
      /\.(py|js|ts|md|txt|csv|json|xml|sh|yaml|yml|html|css)$/i.test(name || "");
    if (isText) {
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      return new TextDecoder("utf-8", { fatal: false }).decode(bytes).slice(0, 8000);
    }
    if (mime?.includes("pdf"))  return `[PDF: "${name}" — analyze this file]`;
    if (mime?.includes("word")) return `[Word doc: "${name}" — analyze this file]`;
    return `[File: "${name}" (${mime})]`;
  } catch { return `[File: "${name}"]`; }
}

function jsonRes(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}
