// ═══════════════════════════════════════════════════════════════
// CloudAI Worker v27.0 — MAXIMUM INTELLIGENCE EDITION 🔥
//
// KEYS (exact Cloudflare variable names):
//   Groq:    GROQ_API_KEY, GROQ2_API_KEY, groq3, groq4, groq5
//   Gemini:  GEMINI_API_KEY, GEMINI_API_KEY2-5  (5 keys = 7500 req/day!)
//   DeepSeek:deep1-5                            (5 keys)
//   Tavily:  TAVILY_API_KEY, TAVILY_API_KEY2-5  (5 keys = 5000/month!)
//   TTS:     ELEVENLABS_KEY
//   KV:      QUOTA_KV
//
// ARCHITECTURE:
//   Speed:       Groq Llama 3.3 70B (fastest)
//   Intelligence:Gemini 2.5 Flash   (smartest free model, large context)
//   Reasoning:   DeepSeek R1        (best free math/logic)
//   Vision:      Groq Llama 4 Scout → Gemini vision
//   Search:      Tavily rotation (5000/month, very aggressive)
// ═══════════════════════════════════════════════════════════════

export default {
  async fetch(request, env) {

    // ── CORS ─────────────────────────────────────────────────────
    const ALLOWED = new Set([
      "https://cloudai.srjahir.in",
      "https://www.cloudai.srjahir.in",
    ]);
    const origin = request.headers.get("Origin") || "";
    const ao     = ALLOWED.has(origin) ? origin : "https://cloudai.srjahir.in";
    const cors   = {
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

    return jsonRes({
      service: "CloudAI v27.0 🚀",
      status: "live",
      by: "SRJahir Tech",
      engines: ["Groq", "Gemini", "DeepSeek"],
      search: "Tavily (5 keys)",
    }, 200, cors);
  },
};

// ═══════════════════════════════════════════════════════════════
// KEY POOLS
// ═══════════════════════════════════════════════════════════════

function groqKeys(env) {
  return [
    env.GROQ_API_KEY, env.GROQ2_API_KEY,
    env.groq3, env.groq4, env.groq5,
  ].filter(Boolean);
}

function geminiKeys(env) {
  return [
    env.GEMINI_API_KEY,  env.GEMINI_API_KEY2,
    env.GEMINI_API_KEY3, env.GEMINI_API_KEY4,
    env.GEMINI_API_KEY5,
  ].filter(Boolean);
}

function deepKeys(env) {
  return [
    env.deep1, env.deep2, env.deep3, env.deep4, env.deep5,
  ].filter(Boolean);
}

function tavilyKeys(env) {
  return [
    env.TAVILY_API_KEY,  env.TAVILY_API_KEY2,
    env.TAVILY_API_KEY3, env.TAVILY_API_KEY4,
    env.TAVILY_API_KEY5,
  ].filter(Boolean);
}

// ═══════════════════════════════════════════════════════════════
// QUOTA — 300/day per user (increased with more keys)
// ═══════════════════════════════════════════════════════════════

const DAILY_QUOTA = 300;
const IP_QUOTA    = 400;

async function getIPKey(request) {
  const ip = request.headers.get("CF-Connecting-IP")
           || request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim()
           || "unknown";
  try {
    const buf = await crypto.subtle.digest("SHA-256",
      new TextEncoder().encode("cloudai_v1_" + ip));
    const hex = Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, "0")).join("");
    return "ip_" + hex.slice(0, 16);
  } catch { return "ip_fallback"; }
}

async function checkQuota(env, cid, request) {
  let cidUsed = 0, ipUsed = 0;
  const ipKey = await getIPKey(request);
  try {
    const dc = await env.QUOTA_KV.get(`q_${cid}`, "json");
    if (dc) {
      const same = new Date(dc.t).toDateString() === new Date().toDateString();
      cidUsed = same ? (dc.n || 0) : 0;
    }
    const di = await env.QUOTA_KV.get(ipKey, "json");
    if (di) {
      const same = new Date(di.t).toDateString() === new Date().toDateString();
      ipUsed = same ? (di.n || 0) : 0;
    }
  } catch {}
  const over = cidUsed >= DAILY_QUOTA || ipUsed >= IP_QUOTA;
  return { over, cidUsed: cidUsed + 1, ipUsed: ipUsed + 1, ipKey };
}

async function saveQuota(env, cid, cidUsed, ipKey, ipUsed) {
  const now = new Date().toISOString();
  try {
    await Promise.all([
      env.QUOTA_KV.put(`q_${cid}`,  JSON.stringify({ n: cidUsed, t: now }), { expirationTtl: 172800 }),
      env.QUOTA_KV.put(ipKey,        JSON.stringify({ n: ipUsed,  t: now }), { expirationTtl: 172800 }),
    ]);
  } catch {}
}

// ═══════════════════════════════════════════════════════════════
// LANGUAGE DETECTION
// ═══════════════════════════════════════════════════════════════

function detectLang(text) {
  if (!text) return "English";
  if (/[\u0A80-\u0AFF]/.test(text)) return "Gujarati";
  if (/[\u0900-\u097F]/.test(text)) return "Hindi";
  if (/[\u0B80-\u0BFF]/.test(text)) return "Tamil";
  if (/[\u0C00-\u0C7F]/.test(text)) return "Telugu";
  if (/[\u0D00-\u0D7F]/.test(text)) return "Malayalam";
  const hinglish = /\b(hai|ka|ki|ke|me|mein|se|ko|kya|kab|kaise|hoon|tha|thi|the|bhi|aur|ya|nahi|bahut|achha|sahi|bhai|yaar|bata|karo|jao|dekho|suno|arrey|arre|matlab|seedha|bilkul|samajh|puchh|dundhna|chahiye|lagta|milega|batao|mujhe|tumhe|apna|uska|unka|isliye|kyunki|lekin|phir|abhi|kabhi|kuch|sab|bas|hoga|karunga|dunga|lunga|karti|karta|bolna|sunna|dekhna|dena|lena|karna|milna|aana|jaana|rehna)\b/i;
  if (hinglish.test(text)) return "Hinglish";
  return "English";
}

// ═══════════════════════════════════════════════════════════════
// TASK TYPE DETECTION
// ═══════════════════════════════════════════════════════════════

function taskType(prompt) {
  const p = (prompt || "").toLowerCase();
  const len = p.length;

  // REASONING → DeepSeek R1 (world's best free reasoner)
  if (/\b(solve|proof|prove|calculate|math|equation|derivative|integral|probability|statistics|theorem)\b/.test(p)) return "reasoning";
  if (/\b(why exactly|explain how|step by step|analyze|compare deeply|evaluate|assess|critique|difference between|pros and cons|best approach|optimize|trade.off|architecture|system design)\b/.test(p) && len > 80) return "reasoning";
  if (/\b(logic|algorithm|complexity|database design|machine learning|neural network|data science)\b/.test(p)) return "reasoning";

  // CODE → Groq (fastest, great at code)
  if (/\b(code|function|class|def |bug|error|fix|implement|program|script|python|javascript|typescript|sql|bash|docker|kubernetes|terraform|api|json|xml|html|css|react|node|flask|django)\b/.test(p)) return "code";

  // CREATIVE → Gemini (best creative writing)
  if (/\b(write|create|draft|compose|poem|story|essay|email|letter|script|blog|caption|lyrics|slogan|generate text|create content)\b/.test(p)) return "creative";

  // LONG/COMPLEX → Gemini (1M context, smartest)
  if (len > 200) return "complex";

  return "general";
}

// ═══════════════════════════════════════════════════════════════
// SYSTEM PROMPT
// ═══════════════════════════════════════════════════════════════

function sysPrompt(type, voice, lang) {
  const langRule = lang !== "English"
    ? `\n\n⚡ CRITICAL: User is writing in ${lang}. YOU MUST reply in ${lang} ONLY. No exceptions.`
    : `\n\n⚡ CRITICAL: User is writing in English. YOU MUST reply in English ONLY. Do not use Hindi or any other language.`;

  const base = `You are CloudAI — India's most powerful free AI assistant by SRJahir Tech (srjahir.in).${langRule}

━━━ IDENTITY ━━━
• You are "CloudAI" powered by the "CloudAI Engine" built by SRJahir Tech
• If asked about your model/company/technology: "CloudAI Engine by SRJahir Tech. Visit srjahir.in"
• NEVER mention or hint at: GPT, Claude, Gemini, Llama, Groq, DeepSeek, Grok, xAI, Anthropic, OpenAI, Mistral, Moonshot, HuggingFace
• NEVER say "As an AI language model"

━━━ LANGUAGE DETECTION EXAMPLES ━━━
"Hello how are you" → English reply
"नमस्ते कैसे हो" → Hindi reply  
"kem cho bhai" → Gujarati reply
"bhai movie dundhne mein help chahiye" → Hinglish reply
"Who is Maharana Pratap" → English reply
"Maharana Pratap ke baare mein batao" → Hinglish reply

━━━ INTELLIGENCE STANDARDS ━━━
• ACCURACY: Never fabricate facts, numbers, names. Say "I'm not certain" when unsure
• REASONING: Think step by step for complex problems
• HONESTY: If outside knowledge, say so clearly — never guess
• CONTEXT: Always consider full conversation before answering
• SPECIFICITY: Give specific, actionable answers — not vague generalities

━━━ REAL-TIME DATA RULE ━━━
If live search data is provided in context → use it and cite it
If not provided → clearly say "I don't have real-time data on this"
NEVER make up prices, scores, news, or current events`;

  const modes = {
    reasoning: `\n\n━━━ REASONING MODE ━━━
• Show your complete thinking process
• Break into numbered steps
• Double-check every calculation
• State assumptions clearly
• End with a definitive answer`,

    code: `\n\n━━━ CODE MODE ━━━
• Write clean, production-ready code
• Add comments for non-obvious logic
• Include usage example
• Mention edge cases
• Use best practices for the language`,

    creative: `\n\n━━━ CREATIVE MODE ━━━
• Be original — avoid clichés
• Match the tone requested
• Structure content well
• Make it engaging and memorable`,

    complex: `\n\n━━━ DEEP ANALYSIS MODE ━━━
• Take time to think comprehensively
• Cover multiple angles
• Use examples to illustrate
• Structure with clear sections
• Be thorough but concise`,

    general: `\n\n━━━ RESPONSE GUIDELINES ━━━
• Lead with the most important info
• Be concise but complete
• Use examples when helpful
• Quality over length`,
  };

  const voiceMode = `\n\n━━━ VOICE MODE ━━━
• Maximum 2-3 short sentences ONLY
• Natural spoken rhythm
• No markdown, bullets, or code
• Conversational and warm`;

  const format = `\n\n━━━ FORMAT ━━━
• Use clean Markdown formatting
• **Bold** key terms
• Code blocks with language tags
• Tables for comparisons
• Keep focused — quality over length`;

  return base + (modes[type] || modes.general) + (voice ? voiceMode : format);
}

// ═══════════════════════════════════════════════════════════════
// WEB SEARCH — 5 Tavily keys = 5000 searches/month
// More aggressive triggering with 5x quota
// ═══════════════════════════════════════════════════════════════

async function smartSearch(env, prompt) {
  const keys = tavilyKeys(env);
  if (!keys.length || !prompt) return "";
  const p = prompt.toLowerCase();

  // Always search (high-value real-time queries)
  const always =
    /\b(price|rate|cost)\s*(of|today|now|current)/i.test(p) ||
    /\b(today|current|latest)\s*.*(price|rate|gold|silver|bitcoin|crypto|dollar|rupee|petrol|diesel)/i.test(p) ||
    /\b(who is|who are|current|present).*(cm|pm|ceo|president|minister|chief|head|leader|governor)\b/i.test(p) ||
    /\b(who won|result|winner|score|champion)\b/.test(p) ||
    /\bwhich day|what day|today.*date|date.*today\b/.test(p) ||
    /\b(sensex|nifty|stock market|share price|ipo)\b/.test(p);

  // Search for these topics (with 5 keys, be liberal)
  const search =  always ||
    /\b(today|latest|recent|current|now|news|2025|2026|weather|election|what happened|update|launch|release|announce)\b/.test(p) ||
    /\b(search|look up|google|find|check)\b/.test(p) ||
    /\b(ipl|cricket|football|match|game|tournament|score)\b/.test(p) ||
    /\b(budget|policy|law|government|rbi|sebi|income tax|gst)\b/.test(p) ||
    /\b(movie|film|web series|ott|netflix|amazon|hotstar|streaming|actor|actress|director)\b/.test(p) ||
    /\b(identify|kaun si|which movie|find movie|guess movie)\b/.test(p) ||
    /\b(recipe|ingredients|how to cook|restaurant)\b/.test(p) ||
    /\b(hospital|doctor|medicine|drug|treatment|symptoms)\b/.test(p);

  // Skip for pure creative/code tasks
  const skip = !always && !search;
  if (skip) return "";

  // Rotate through Tavily keys
  const key = keys[Math.floor(Math.random() * keys.length)];
  try {
    const r = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify({
        query: prompt.slice(0, 300),
        search_depth: "basic",
        max_results: 4,
      }),
    });
    const d = await r.json();
    if (d?.results?.length) {
      return "📡 Live web data:\n" + d.results
        .map(r => `• ${r.title}: ${r.content}`)
        .join("\n")
        .slice(0, 1500);
    }
  } catch {}
  return "";
}

// ═══════════════════════════════════════════════════════════════
// MESSAGE BUILDER
// ═══════════════════════════════════════════════════════════════

function buildMsgs(sys, history, live, prompt, hasDoc, docText, fileName) {
  const msgs = [{ role: "system", content: sys }];
  for (const h of (history || []).slice(-24))
    msgs.push({ role: h.role === "model" ? "assistant" : "user",
                content: (h.text || "").slice(0, 2000) });
  if (live) {
    msgs.push({ role: "user",      content: live });
    msgs.push({ role: "assistant", content: "Got the live data, I'll use it." });
  }
  let fp = (prompt || "Hello").slice(0, 4000);
  if (hasDoc && docText) fp = `[File: "${fileName}"]\n${docText.slice(0, 8000)}\n\nQuestion: ${fp}`;
  msgs.push({ role: "user", content: fp });
  return msgs;
}

// ═══════════════════════════════════════════════════════════════
// AI PROVIDERS
// ═══════════════════════════════════════════════════════════════

// ── GROQ — 5 keys, 9s timeout, fastest ─────────────────────────
async function callGroq(env, msgs, type, voice) {
  const model = "llama-3.3-70b-versatile";
  const maxT  = voice ? 150 : type === "code" ? 3000 : 2000;
  const temp  = type === "creative" ? 0.80 : type === "code" ? 0.30 : 0.55;

  for (const key of groqKeys(env)) {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 9000);
    try {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
        body: JSON.stringify({ model, messages: msgs, temperature: temp, max_tokens: maxT, top_p: 0.9 }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (r.status === 429 || r.status === 401) continue;
      const d = await r.json();
      if (d.error) continue;
      const t = d?.choices?.[0]?.message?.content || "";
      if (t) return t;
    } catch(e) { clearTimeout(timer); if (e.name === "AbortError") continue; }
  }
  return null;
}

// ── GEMINI 2.5 FLASH — 5 keys, 7500 req/day, SMARTEST FREE ────
// Best for: creative, complex, vision, long context (1M tokens!)
async function callGemini(env, msgs, fb64, ftype, type, voice) {
  const keys = geminiKeys(env);
  if (!keys.length) return null;

  // Build contents
  const contents = [];
  const sys = msgs.find(m => m.role === "system");
  if (sys) {
    contents.push({ role: "user",  parts: [{ text: sys.content }] });
    contents.push({ role: "model", parts: [{ text: "Understood. Ready." }] });
  }
  for (const m of msgs.filter(m => m.role !== "system"))
    contents.push({ role: m.role === "assistant" ? "model" : "user",
                    parts: [{ text: m.content || "" }] });

  // Attach image OR PDF as inline_data (Gemini reads both natively!)
  if (fb64 && (ftype?.startsWith("image/") || ftype === "application/pdf")) {
    const last = contents.filter(c => c.role === "user").slice(-1)[0];
    if (last) last.parts.unshift({ inline_data: { mime_type: ftype, data: fb64 } });
  }

  const maxT = voice ? 150 : type === "code" ? 4096 : type === "complex" ? 4096 : 2048;
  const temp = type === "creative" ? 0.80 : type === "code" ? 0.25 : 0.60;

  for (const key of keys) {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents,
            generationConfig: { temperature: temp, topP: 0.9, maxOutputTokens: maxT },
          }),
          signal: ctrl.signal,
        }
      );
      clearTimeout(timer);
      if (r.status === 429 || r.status === 403) continue;
      const d = await r.json();
      if (d.error) continue;
      const t = d?.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join("") || "";
      if (t) return t;
    } catch(e) { clearTimeout(timer); if (e.name === "AbortError") continue; }
  }
  return null;
}

// ── DEEPSEEK — 5 keys, R1 for reasoning, V3 for general ────────
async function callDeepSeek(env, msgs, type) {
  const model   = type === "reasoning" ? "deepseek-reasoner" : "deepseek-chat";
  const TIMEOUT = type === "reasoning" ? 25000 : 12000;

  for (const key of deepKeys(env)) {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
    try {
      const r = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
        body: JSON.stringify({ model, messages: msgs, temperature: 0.60, max_tokens: 4000 }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (r.status === 429 || r.status === 401 || r.status === 402) continue;
      const d = await r.json();
      if (d.error) continue;
      const t = d?.choices?.[0]?.message?.content ||
                d?.choices?.[0]?.message?.reasoning_content || "";
      if (t) return t;
    } catch(e) { clearTimeout(timer); if (e.name === "AbortError") continue; }
  }
  return null;
}

// ── VISION — Groq Llama 4 Scout → Gemini ─────────────────────
async function callVision(env, prompt, fb64, ftype) {
  for (const key of groqKeys(env)) {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    try {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
        body: JSON.stringify({
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
          messages: [{ role: "user", content: [
            { type: "image_url", image_url: { url: `data:${ftype};base64,${fb64}` } },
            { type: "text", text: prompt || "Describe this image in full detail." },
          ]}],
          temperature: 0.5, max_tokens: 2000,
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (r.status === 429 || r.status === 401) continue;
      const d = await r.json();
      if (d.error) continue;
      const t = d?.choices?.[0]?.message?.content || "";
      if (t) return t;
    } catch(e) { clearTimeout(timer); if (e.name === "AbortError") continue; }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
// SERVER-SIDE SANITIZER — competitor names → CloudAI
// ═══════════════════════════════════════════════════════════════

function sanitize(text) {
  if (!text) return text;
  const rules = [
    [/\b(OpenAI|ChatGPT|GPT-?4?o?|GPT-?3\.?5?)\b/gi,           "CloudAI"],
    [/\b(Anthropic)\b/gi,                                         "SRJahir Tech"],
    [/\b(Claude(?:\s+\d+)?(?:\.\d+)?(?:\s+\w+)?)\b/gi,          "CloudAI"],
    [/\b(Google\s+(?:AI|Bard|DeepMind))\b/gi,                    "CloudAI"],
    [/\b(Gemini(?:\s+\d+\.?\d*)?(?:\s+Flash|\s+Pro|\s+Ultra)?)\b/gi, "CloudAI"],
    [/\b(Meta\s+AI|Llama\s*\d*\.?\d*)\b/gi,                      "CloudAI Engine"],
    [/\b(Groq)\b/gi,                                              "CloudAI Engine"],
    [/\b(DeepSeek(?:\s+[VvRr]\d+)?)\b/gi,                        "CloudAI Engine"],
    [/\b(Grok(?:\s+\d+)?)\b/gi,                                   "CloudAI"],
    [/\b(xAI)\b/gi,                                               "SRJahir Tech"],
    [/\b(Mistral(?:\s+\w+)?)\b/gi,                                "CloudAI Engine"],
    [/\b(Perplexity|Copilot|Bing\s+AI|Cortana)\b/gi,             "CloudAI"],
    [/\b(HuggingFace|Hugging\s+Face)\b/gi,                       "CloudAI"],
    [/large language model/gi,                                    "CloudAI Engine"],
    [/\bLLM\b/g,                                                  "CloudAI Engine"],
    [/I am a language model/gi,                                   "I am CloudAI"],
    [/I'm a language model/gi,                                    "I'm CloudAI"],
    [/I am an AI (?:language )?model/gi,                         "I am CloudAI"],
    [/I'm an AI (?:language )?model/gi,                          "I'm CloudAI"],
    [/trained by (?:OpenAI|Anthropic|Google|Meta|DeepSeek)/gi,   "built by SRJahir Tech"],
    [/developed by (?:OpenAI|Anthropic|Google|Meta)/gi,          "developed by SRJahir Tech"],
  ];
  let result = text;
  for (const [pattern, rep] of rules)
    result = result.replace(pattern, rep);
  return result;
}

// ═══════════════════════════════════════════════════════════════
// MAIN ORCHESTRATOR — Smart routing with all engines
// ═══════════════════════════════════════════════════════════════

async function orchestrate(env, body, _request = null) {
  const { prompt, history, clientId, fileBase64, fileType, fileName, voiceMode } = parseBody(body);

  const q = await checkQuota(env, clientId, _request || new Request("https://cloudai.srjahir.in"));
  if (q.over) return { reply: "🚫 Daily limit (300 messages) reached. Come back tomorrow!", quota: "exceeded" };

  if (fileBase64 && fileBase64.length * 0.75 > 8 * 1024 * 1024)
    return { reply: "⚠️ File too large. Max 8MB.", quota: "ok" };

  const isImg  = !!(fileBase64 && fileType?.startsWith("image/"));
  const isPDF  = !!(fileBase64 && fileType === "application/pdf");
  const type   = taskType(prompt);
  const lang   = detectLang(prompt);
  const live   = await smartSearch(env, prompt);
  const sys    = sysPrompt(type, voiceMode, lang);

  let docText = "";
  if (fileBase64 && !isImg) docText = extractText(fileBase64, fileType, fileName);
  const msgs = buildMsgs(sys, history, live, prompt, !!docText, docText, fileName);

  let reply = "";

  if (isImg) {
    // ── VISION: Groq Llama 4 Scout → Gemini vision ─────────────
    reply = await callVision(env, prompt, fileBase64, fileType);
    if (!reply) reply = await callGemini(env, msgs, fileBase64, fileType, "vision", voiceMode);
    if (!reply) reply = await callDeepSeek(env, msgs, "general");

  } else if (isPDF) {
    // ── PDF: Gemini reads PDF natively (1M context!) ────────────
    const pdfPrompt = prompt || "Please analyze this PDF document in detail. Extract and summarize ALL key information accurately.";
    const pdfMsgs = buildMsgs(sys, history, live, pdfPrompt, false, "", fileName);
    reply = await callGemini(env, pdfMsgs, fileBase64, fileType, "complex", voiceMode);
    if (!reply) reply = await callDeepSeek(env, pdfMsgs, "general");
    if (!reply) reply = await callGroq(env, pdfMsgs, "general", voiceMode);

  } else if (type === "reasoning") {
    // ── REASONING: DeepSeek R1 (world-class) → Gemini → Groq ───
    reply = await callDeepSeek(env, msgs, "reasoning");
    if (!reply) reply = await callGemini(env, msgs, null, null, type, voiceMode);
    if (!reply) reply = await callGroq(env, msgs, type, voiceMode);

  } else if (type === "code") {
    // ── CODE: Groq (fast+precise) → DeepSeek V3 → Gemini ────────
    reply = await callGroq(env, msgs, type, voiceMode);
    if (!reply) reply = await callDeepSeek(env, msgs, "code");
    if (!reply) reply = await callGemini(env, msgs, null, null, type, voiceMode);

  } else if (type === "creative") {
    // ── CREATIVE: Gemini (best) → Groq → DeepSeek ───────────────
    reply = await callGemini(env, msgs, null, null, type, voiceMode);
    if (!reply) reply = await callGroq(env, msgs, type, voiceMode);
    if (!reply) reply = await callDeepSeek(env, msgs, "general");

  } else if (type === "complex") {
    // ── COMPLEX: Gemini (1M context) → DeepSeek → Groq ──────────
    reply = await callGemini(env, msgs, null, null, type, voiceMode);
    if (!reply) reply = await callDeepSeek(env, msgs, "general");
    if (!reply) reply = await callGroq(env, msgs, type, voiceMode);

  } else {
    // ── GENERAL: Groq (speed) → Gemini → DeepSeek ───────────────
    reply = await callGroq(env, msgs, type, voiceMode);
    if (!reply) reply = await callGemini(env, msgs, null, null, type, voiceMode);
    if (!reply) reply = await callDeepSeek(env, msgs, "general");
  }

  if (!reply) reply = "⚠️ All engines temporarily busy. Please try again in a moment.";

  reply = sanitize(reply);
  await saveQuota(env, clientId, q.cidUsed, q.ipKey, q.ipUsed);

  return {
    reply,
    model: "cloudai-engine",
    taskType: type,
    lang,
    quotaStatus: q.cidUsed >= 270 ? "quota_warning" : "ok",
    quotaUsed: q.cidUsed,
  };
}

// ═══════════════════════════════════════════════════════════════
// ROUTE HANDLERS
// ═══════════════════════════════════════════════════════════════

async function handleChat(request, env, cors) {
  let body;
  try { body = await request.json(); } catch { return jsonRes({ error: "Invalid JSON" }, 400, cors); }
  return jsonRes(await orchestrate(env, body, request), 200, cors);
}

async function handleStream(request, env, cors) {
  let body;
  try { body = await request.json(); } catch { return jsonRes({ error: "Invalid JSON" }, 400, cors); }

  const { prompt, history, clientId, fileBase64, voiceMode } = parseBody(body);

  if (fileBase64) return jsonRes(await orchestrate(env, body, request), 200, cors);

  const q = await checkQuota(env, clientId, request);
  if (q.over) return jsonRes({ reply: "🚫 Daily limit (300 messages) reached." }, 200, cors);

  const type  = taskType(prompt);
  const lang  = detectLang(prompt);
  const live  = await smartSearch(env, prompt);
  const sys   = sysPrompt(type, voiceMode, lang);
  const msgs  = buildMsgs(sys, history, live, prompt, false, "", "");

  // Groq streaming (fastest)
  for (const key of groqKeys(env)) {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 9000);
    try {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: msgs,
          temperature: type === "creative" ? 0.80 : type === "code" ? 0.30 : 0.55,
          max_tokens: voiceMode ? 150 : 2000,
          stream: true,
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (r.status === 429 || r.status === 401 || !r.ok) continue;

      const { readable, writable } = new TransformStream();
      const writer  = writable.getWriter();
      const encoder = new TextEncoder();

      (async () => {
        const reader  = r.body.getReader();
        const decoder = new TextDecoder();
        let buf = "", fullReply = "";
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
                const parsed  = JSON.parse(d);
                const rawTok  = parsed.choices?.[0]?.delta?.content || "";
                if (rawTok) {
                  fullReply += rawTok;
                  await writer.write(encoder.encode(
                    `data: ${JSON.stringify({ token: rawTok, model: "cloudai-engine" })}\n\n`
                  ));
                }
              } catch {}
            }
          }
          // Fallback: if nothing was streamed, send a message
          if (!fullReply) {
            const fb = await orchestrate(env, body, request);
            await writer.write(encoder.encode(
              `data: ${JSON.stringify({ token: fb.reply, model: "cloudai-engine" })}

data: [DONE]

`
            ));
          }
          await saveQuota(env, clientId, q.cidUsed, q.ipKey, q.ipUsed);
        } finally { await writer.close(); }
      })();

      return new Response(readable, {
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", ...cors },
      });
    } catch(e) { clearTimeout(timer); if (e.name !== "AbortError") break; }
  }

  // Fallback to non-streaming
  const result = await orchestrate(env, body, request);
  return jsonRes(result, 200, cors);
}

// ═══════════════════════════════════════════════════════════════
// TTS — ElevenLabs → Web Speech fallback signal
// ═══════════════════════════════════════════════════════════════

async function handleTTS(request, env, cors) {
  try {
    const { text } = await request.json();
    if (!text) return jsonRes({ fallback: true }, 200, cors);
    if (!env.ELEVENLABS_KEY) return jsonRes({ fallback: true, reason: "use_webspeech" }, 200, cors);

    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);

    const r = await fetch("https://api.elevenlabs.io/v1/text-to-speech/SZfY4K69FwXus87eayHK", {
      method: "POST",
      headers: { "xi-api-key": env.ELEVENLABS_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: text.slice(0, 3000),
        model_id: "eleven_turbo_v2",
        voice_settings: { stability: 0.45, similarity_boost: 0.82, style: 0.35, use_speaker_boost: true },
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    if (!r.ok || r.status === 429 || r.status === 401)
      return jsonRes({ fallback: true, reason: "use_webspeech" }, 200, cors);

    const ct = r.headers.get("content-type") || "";
    if (ct.includes("application/json"))
      return jsonRes({ fallback: true, reason: "use_webspeech" }, 200, cors);

    return new Response(r.body, { headers: { "Content-Type": "audio/mpeg", ...cors } });
  } catch {
    return jsonRes({ fallback: true, reason: "use_webspeech" }, 200, cors);
  }
}

// ═══════════════════════════════════════════════════════════════
// IMAGE GENERATION — Pollinations primary, HuggingFace fallback
// ═══════════════════════════════════════════════════════════════

async function handleImageGen(request, env, cors) {
  try {
    const { prompt } = await request.json();
    if (!prompt) return jsonRes({ error: "No prompt" }, 400, cors);

    const ep   = encodeURIComponent(`${prompt}, highly detailed, beautiful, professional quality, 4k`);
    const seed = Math.floor(Math.random() * 99999);

    // Primary: Pollinations.ai
    try {
      const ctrl  = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20000);
      const r = await fetch(
        `https://image.pollinations.ai/prompt/${ep}?width=1024&height=1024&nologo=true&enhance=true&seed=${seed}&model=flux`,
        { headers: { "User-Agent": "CloudAI/1.0" }, signal: ctrl.signal }
      );
      clearTimeout(timer);
      if (r.ok) {
        const ct = r.headers.get("content-type") || "image/jpeg";
        if (ct.startsWith("image/"))
          return new Response(r.body, { headers: { "Content-Type": ct, ...cors } });
      }
    } catch {}

    // Fallback: HuggingFace
    for (const model of ["stabilityai/stable-diffusion-xl-base-1.0", "stabilityai/stable-diffusion-2-1"]) {
      try {
        const r = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inputs: decodeURIComponent(ep), options: { wait_for_model: true } }),
        });
        if (!r.ok) continue;
        const ct = r.headers.get("content-type") || "";
        if (ct.startsWith("image/"))
          return new Response(r.body, { headers: { "Content-Type": ct, ...cors } });
      } catch {}
    }

    return jsonRes({ error: "Image gen unavailable. Try again in 30s." }, 503, cors);
  } catch(e) { return jsonRes({ error: e.message }, 500, cors); }
}

// ═══════════════════════════════════════════════════════════════
// SHARE CONVERSATION
// ═══════════════════════════════════════════════════════════════

async function handleShareSave(request, env, cors) {
  try {
    const { messages, title } = await request.json();
    if (!messages?.length) return jsonRes({ error: "No messages" }, 400, cors);
    if (!env.QUOTA_KV) return jsonRes({ error: "Storage unavailable" }, 500, cors);
    const id   = Math.random().toString(36).slice(2, 9);
    const data = { title: (title || "CloudAI Chat").slice(0, 100), messages: messages.slice(-20), createdAt: new Date().toISOString(), views: 0 };
    await env.QUOTA_KV.put(`share_${id}`, JSON.stringify(data), { expirationTtl: 2592000 });
    return jsonRes({ shareId: id, url: `https://cloudai.srjahir.in/?share=${id}` }, 200, cors);
  } catch(e) { return jsonRes({ error: e.message }, 500, cors); }
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
  } catch(e) { return jsonRes({ error: e.message }, 500, cors); }
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function parseBody(body) {
  return {
    prompt:     (body.prompt || "").trim().slice(0, 4000),
    history:    Array.isArray(body.history) ? body.history.slice(-24) : [],
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
    if (mime?.includes("pdf"))  return `[PDF: "${name}"]`;
    if (mime?.includes("word")) return `[DOCX: "${name}"]`;
    return `[File: "${name}" (${mime})]`;
  } catch { return `[File: "${name}"]`; }
}

function jsonRes(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}
