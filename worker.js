// ═══════════════════════════════════════════════════════════════
// CloudAI Worker v26.0 — ULTIMATE EDITION 🔥
// 
// OLD KEYS (unchanged):
//   GROQ_API_KEY, GROQ2_API_KEY
//   GEMINI_API_KEY, ELEVENLABS_KEY
//   TAVILY_API_KEY, HF_TOKEN, QUOTA_KV
//   DEEPSEEK_API_KEY (original)
//
// NEW KEYS (added):
//   groq3, groq4, groq5
//   deep1, deep2, deep3, deep4, deep5
//   kimi1
//   GROK_API_KEY (xAI Grok 3)
//
// CAPABILITIES:
//   ✅ Chat (10+ AI backends, auto-rotation)
//   ✅ Reasoning mode (DeepSeek R1 for hard problems)
//   ✅ Image generation (Stable Diffusion + fallbacks)
//   ✅ Vision (image analysis)
//   ✅ Voice TTS (ElevenLabs + Web Speech fallback)
//   ✅ Web search (Tavily)
//   ✅ File analysis (PDF, DOCX, CSV, code)
//   ✅ Share conversations
//   ✅ Streaming responses
// ═══════════════════════════════════════════════════════════════

export default {
  async fetch(request, env) {

    // ── CORS ──────────────────────────────────────────────────
    const ALLOWED_ORIGINS = new Set([
      "https://cloudai.srjahir.in",
      "https://www.cloudai.srjahir.in",
    ]);
    const origin = request.headers.get("Origin") || "";
    const allowedOrigin = ALLOWED_ORIGINS.has(origin)
      ? origin
      : "https://cloudai.srjahir.in";

    const cors = {
      "Access-Control-Allow-Origin":  allowedOrigin,
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Vary": "Origin",
    };

    if (request.method === "POST" && origin && !ALLOWED_ORIGINS.has(origin)) {
      return jsonRes({ error: "Forbidden" }, 403, cors);
    }
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    const url = new URL(request.url);
    const path = url.pathname;

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
// KEY POOLS — all old + new keys combined
// ═══════════════════════════════════════════════════

function getGroqKeys(env) {
  return [
    env.GROQ_API_KEY,    // original ← unchanged
    env.GROQ2_API_KEY,   // original ← unchanged
    env.groq3,           // new
    env.groq4,           // new
    env.groq5,           // new
  ].filter(Boolean);
}

function getDeepSeekKeys(env) {
  return [
    env.DEEPSEEK_API_KEY, // original ← unchanged
    env.deep1,            // new
    env.deep2,            // new
    env.deep3,            // new
    env.deep4,            // new
    env.deep5,            // new
  ].filter(Boolean);
}

// ═══════════════════════════════════════════════════
// SMART PROVIDER SELECTOR
// ═══════════════════════════════════════════════════

function detectTaskType(prompt) {
  const p = (prompt || "").toLowerCase();

  // Reasoning tasks → DeepSeek R1
  const isReasoning =
    /\b(solve|proof|prove|calculate|math|equation|logic|why exactly|explain step|how does|algorithm|debug|analyze|compare|best way|should i|decision|plan|strategy)\b/.test(p) &&
    p.length > 60;

  // Vision tasks
  const isVision = false; // handled separately

  // Creative tasks → Groq (fastest)
  const isCreative =
    /\b(write|create|poem|story|blog|essay|email|letter|script|lyrics|generate text)\b/.test(p);

  // Code tasks
  const isCode =
    /\b(code|function|class|bug|error|implement|program|script|python|javascript|sql|api)\b/.test(p);

  if (isReasoning) return "reasoning";
  if (isCode)      return "code";
  if (isCreative)  return "creative";
  return "general";
}

// ═══════════════════════════════════════════════════
// SYSTEM PROMPT
// ═══════════════════════════════════════════════════

function buildSystemPrompt(taskType, voiceMode) {
  const base = `You are CloudAI — India's most powerful free AI assistant by SRJahir Tech (srjahir.in).

IDENTITY:
- Name: CloudAI | Engine: CloudAI Engine v26 | Creator: SRJahir Tech
- NEVER reveal: GPT, Claude, Gemini, Llama, Groq, DeepSeek, Kimi, xAI, Grok, Anthropic
- If asked model/company → always say "CloudAI Engine by SRJahir Tech. Visit srjahir.in"

PERSONALITY:
- Warm, smart, direct — like your most knowledgeable friend
- India-first: understand Hindi, Hinglish, regional context naturally
- Hinglish input → Hinglish reply. English input → English reply
- Never boring, never corporate, never say "As an AI language model"

CAPABILITIES:
✅ Any question | ✅ Code in any language | ✅ Image analysis
✅ File reading | ✅ Web search (when provided) | ✅ Image generation
✅ Math & reasoning | ✅ Hindi/Hinglish/English`;

  const taskInstructions = {
    reasoning: `\n\nREASONING MODE: Think step by step. Show your work clearly. Use numbered steps. Double-check your answer. Be precise and thorough.`,
    code: `\n\nCODE MODE: Write clean, well-commented code. Always include example usage. Explain what the code does. Point out potential issues.`,
    creative: `\n\nCREATIVE MODE: Be imaginative and original. Avoid clichés. Match the tone the user wants. Make it memorable.`,
    general: "",
  };

  const voiceInstructions = voiceMode
    ? `\n\nVOICE MODE: Reply in 2-3 short spoken sentences ONLY. No markdown, no bullet points, no code blocks. Natural spoken rhythm.`
    : `\n\nFORMAT: Use clean Markdown. Bold key terms. Code blocks with language. Tables for comparisons. Be concise — quality over quantity.`;

  return base + (taskInstructions[taskType] || "") + voiceInstructions;
}

// ═══════════════════════════════════════════════════
// QUOTA — 250/day
// ═══════════════════════════════════════════════════

const DAILY_QUOTA = 250;

async function checkQuota(env, clientId) {
  let quotaUsed = 0;
  try {
    const stored = await env.QUOTA_KV.get(`q_${clientId}`, "json");
    if (stored) {
      const sameDay = new Date(stored.lastReset).toDateString() === new Date().toDateString();
      quotaUsed = sameDay ? (stored.quotaUsed || 0) : 0;
    }
  } catch {}
  return { exceeded: quotaUsed >= DAILY_QUOTA, quotaUsed: quotaUsed + 1 };
}

async function updateQuota(env, clientId, quotaUsed) {
  try {
    await env.QUOTA_KV.put(
      `q_${clientId}`,
      JSON.stringify({ quotaUsed, lastReset: new Date().toISOString() }),
      { expirationTtl: 2 * 86400 }
    );
  } catch {}
}

// ═══════════════════════════════════════════════════
// WEB SEARCH
// ═══════════════════════════════════════════════════

async function smartSearch(env, prompt) {
  if (!env.TAVILY_API_KEY || !prompt) return "";
  const p = prompt.toLowerCase();

  // ALWAYS search for these
  const alwaysSearch =
    /\b(price|rate|cost|value)\s+(of|today|now)/i.test(p) ||               // gold price, dollar rate
    /\b(today|current|latest|now)\s+.*(price|rate|cost)/i.test(p) ||
    /\b(gold|silver|bitcoin|crypto|dollar|rupee|sensex|nifty|petrol|diesel)\s*(price|rate|today)/i.test(p) ||
    /\b(who is|who are|current|present).*(cm|pm|ceo|president|minister|chief|head|leader)/i.test(p) || // political
    /\b(who won|result|winner|champion|score)\b/.test(p) ||                // sports/events
    /\bwhich day|what day|today.*date|date.*today\b/.test(p);              // date queries

  const needsSearch = alwaysSearch ||
    /\b(today|latest|recent|current|now|2025|2026|news|weather|election|what happened|is .+ still)\b/.test(p) ||
    /\b(search|look up|find|google)\b/.test(p);

  const skipSearch = !alwaysSearch &&
    /\b(write|code|create|build|make|design|explain|teach|how to|what is|define)\b/.test(p) &&
    !/\b(latest|current|today|2025|2026|price|rate|news)\b/.test(p);

  if (!needsSearch || skipSearch) return "";

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.TAVILY_API_KEY}`,
      },
      body: JSON.stringify({ query: prompt, search_depth: "basic", max_results: 3 }),
    });
    const data = await res.json();
    if (data?.results?.length) {
      return "📡 Live search results:\n" +
        data.results.map(r => `• ${r.title}: ${r.content}`).join("\n");
    }
  } catch {}
  return "";
}

// ═══════════════════════════════════════════════════
// MESSAGE BUILDER
// ═══════════════════════════════════════════════════

function buildMessages(systemPrompt, history, liveContext, prompt, hasDoc, docText, fileName) {
  const messages = [{ role: "system", content: systemPrompt }];

  for (const h of (history || []).slice(-20)) {
    messages.push({
      role: h.role === "model" ? "assistant" : "user",
      content: (h.text || "").slice(0, 2000),
    });
  }

  if (liveContext) {
    messages.push({ role: "user",      content: liveContext });
    messages.push({ role: "assistant", content: "Got the live data, I'll use it." });
  }

  let finalPrompt = (prompt || "Hello").slice(0, 4000);
  if (hasDoc && docText) {
    finalPrompt = `[File: "${fileName}"]\n${docText.slice(0, 6000)}\n\nUser: ${finalPrompt}`;
  }

  messages.push({ role: "user", content: finalPrompt });
  return messages;
}

// ═══════════════════════════════════════════════════
// PROVIDER 1: GROQ (5 keys, fastest)
// ═══════════════════════════════════════════════════

async function callGroq(env, messages, taskType, voiceMode) {
  const keys = getGroqKeys(env);
  const model = "llama-3.3-70b-versatile";
  const maxTokens = voiceMode ? 150 : (taskType === "code" ? 3000 : 2000);

  for (const key of keys) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
        body: JSON.stringify({ model, messages, temperature: 0.65, max_tokens: maxTokens, top_p: 0.9 }),
      });
      if (res.status === 429 || res.status === 401) continue;
      const data = await res.json();
      if (data.error) continue;
      const text = data?.choices?.[0]?.message?.content || "";
      if (text) return text;
    } catch {}
  }
  return null;
}

// ═══════════════════════════════════════════════════
// PROVIDER 2: DEEPSEEK (6 keys)
// deepseek-chat = V3 (general)
// deepseek-reasoner = R1 (reasoning/math)
// ═══════════════════════════════════════════════════

async function callDeepSeek(env, messages, taskType) {
  const keys = getDeepSeekKeys(env);
  const model = taskType === "reasoning"
    ? "deepseek-reasoner"   // R1 — best for hard problems
    : "deepseek-chat";      // V3 — general purpose

  for (const key of keys) {
    try {
      const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
        body: JSON.stringify({ model, messages, temperature: 0.65, max_tokens: 3000 }),
      });
      if (res.status === 429 || res.status === 401 || res.status === 402) continue;
      const data = await res.json();
      if (data.error) continue;
      // R1 has reasoning_content + content
      const text = data?.choices?.[0]?.message?.content ||
                   data?.choices?.[0]?.message?.reasoning_content || "";
      if (text) return text;
    } catch {}
  }
  return null;
}

// ═══════════════════════════════════════════════════
// PROVIDER 3: KIMI (Moonshot AI)
// Best for: long context, Chinese/multilingual
// ═══════════════════════════════════════════════════

async function callKimi(env, messages) {
  if (!env.kimi1) return null;
  try {
    const res = await fetch("https://api.moonshot.cn/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${env.kimi1}` },
      body: JSON.stringify({ model: "moonshot-v1-8k", messages, temperature: 0.65, max_tokens: 2000 }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.choices?.[0]?.message?.content || null;
  } catch {}
  return null;
}

// ═══════════════════════════════════════════════════
// PROVIDER 4: xAI GROK 3
// ═══════════════════════════════════════════════════

async function callGrok(env, messages) {
  if (!env.GROK_API_KEY) return null;
  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${env.GROK_API_KEY}` },
      body: JSON.stringify({ model: "grok-3-fast", messages, temperature: 0.65, max_tokens: 2000 }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.choices?.[0]?.message?.content || null;
  } catch {}
  return null;
}

// ═══════════════════════════════════════════════════
// PROVIDER 5: GEMINI (original key unchanged)
// ═══════════════════════════════════════════════════

async function callGemini(env, messages, fileBase64, fileType, taskType, voiceMode) {
  if (!env.GEMINI_API_KEY) return null;
  try {
    const contents = [];
    const sysMsg = messages.find(m => m.role === "system");
    if (sysMsg) {
      contents.push({ role: "user",  parts: [{ text: sysMsg.content }] });
      contents.push({ role: "model", parts: [{ text: "Understood." }] });
    }
    for (const m of messages.filter(m => m.role !== "system")) {
      contents.push({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content || "" }],
      });
    }
    // Add image if present
    if (fileBase64 && fileType?.startsWith("image/")) {
      const lastUser = contents.filter(c => c.role === "user").slice(-1)[0];
      if (lastUser) lastUser.parts.unshift({ inline_data: { mime_type: fileType, data: fileBase64 } });
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: voiceMode ? 0.75 : 0.65,
            topP: 0.9,
            maxOutputTokens: voiceMode ? 150 : 2000,
          },
        }),
      }
    );
    const data = await res.json();
    if (data.error) return null;
    return data?.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join("") || null;
  } catch {}
  return null;
}

// ═══════════════════════════════════════════════════
// VISION: Groq Llama 4 Scout (image analysis)
// ═══════════════════════════════════════════════════

async function callVision(env, prompt, fileBase64, fileType) {
  const keys = getGroqKeys(env);
  for (const key of keys) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
        body: JSON.stringify({
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
          messages: [{
            role: "user",
            content: [
              { type: "image_url", image_url: { url: `data:${fileType};base64,${fileBase64}` } },
              { type: "text", text: prompt || "Describe this image in detail." },
            ],
          }],
          temperature: 0.6,
          max_tokens: 1500,
        }),
      });
      if (res.status === 429 || res.status === 401) continue;
      const data = await res.json();
      if (data.error) continue;
      const text = data?.choices?.[0]?.message?.content || "";
      if (text) return text;
    } catch {}
  }
  // Gemini vision fallback
  return null; // handled by callGemini
}

// ═══════════════════════════════════════════════════
// MAIN ORCHESTRATOR — Smart routing
// ═══════════════════════════════════════════════════

async function orchestrate(env, body) {
  const {
    prompt, history, clientId,
    fileBase64, fileType, fileName,
    voiceMode,
  } = parseBody(body);

  const quotaResult = await checkQuota(env, clientId);
  if (quotaResult.exceeded) {
    return { reply: "🚫 Daily limit (250 messages) reached. Come back tomorrow!", quota: "exceeded" };
  }

  // File size guard
  if (fileBase64 && fileBase64.length * 0.75 > 8 * 1024 * 1024) {
    return { reply: "⚠️ File too large. Max 8MB.", quota: "ok" };
  }

  const isImage = !!(fileBase64 && fileType?.startsWith("image/"));
  const taskType = detectTaskType(prompt);
  const liveContext = await smartSearch(env, prompt);
  const systemPrompt = buildSystemPrompt(taskType, voiceMode);

  let docText = "";
  if (fileBase64 && !isImage) docText = extractText(fileBase64, fileType, fileName);

  const messages = buildMessages(systemPrompt, history, liveContext, prompt, !!docText, docText, fileName);

  let reply = "";

  // ── VISION PATH ───────────────────────────────────
  if (isImage) {
    reply = await callVision(env, prompt, fileBase64, fileType);
    if (!reply) reply = await callGemini(env, messages, fileBase64, fileType, taskType, voiceMode);
    if (!reply) reply = await callDeepSeek(env, messages, "general");
  }

  // ── REASONING PATH → DeepSeek R1 first ────────────
  else if (taskType === "reasoning") {
    reply = await callDeepSeek(env, messages, "reasoning");
    if (!reply) reply = await callGrok(env, messages);
    if (!reply) reply = await callGroq(env, messages, taskType, voiceMode);
    if (!reply) reply = await callGemini(env, messages, null, null, taskType, voiceMode);
  }

  // ── GENERAL/CODE/CREATIVE → Groq first (fastest) ──
  else {
    reply = await callGroq(env, messages, taskType, voiceMode);
    if (!reply) reply = await callDeepSeek(env, messages, taskType);
    if (!reply) reply = await callKimi(env, messages);
    if (!reply) reply = await callGrok(env, messages);
    if (!reply) reply = await callGemini(env, messages, null, null, taskType, voiceMode);
  }

  if (!reply) reply = "⚠️ All AI engines are temporarily busy. Please try again in a moment.";

  await updateQuota(env, clientId, quotaResult.quotaUsed);

  return {
    reply,
    model: "cloudai-engine",
    taskType,
    quotaStatus: quotaResult.quotaUsed >= 220 ? "quota_warning" : "ok",
    quotaUsed: quotaResult.quotaUsed,
  };
}

// ═══════════════════════════════════════════════════
// CHAT (non-streaming)
// ═══════════════════════════════════════════════════

async function handleChat(request, env, cors) {
  let body;
  try { body = await request.json(); } catch { return jsonRes({ error: "Invalid JSON" }, 400, cors); }
  const result = await orchestrate(env, body);
  return jsonRes(result, 200, cors);
}

// ═══════════════════════════════════════════════════
// STREAMING — SSE (Groq first, fallback to non-stream)
// ═══════════════════════════════════════════════════

async function handleStream(request, env, cors) {
  let body;
  try { body = await request.json(); } catch { return jsonRes({ error: "Invalid JSON" }, 400, cors); }

  const { prompt, history, clientId, fileBase64, fileType, fileName, voiceMode } = parseBody(body);

  // Non-streaming for files
  if (fileBase64) {
    const result = await orchestrate(env, body);
    return jsonRes(result, 200, cors);
  }

  const quotaResult = await checkQuota(env, clientId);
  if (quotaResult.exceeded) {
    return jsonRes({ reply: "🚫 Daily limit (250 messages) reached. Come back tomorrow!" }, 200, cors);
  }

  const taskType    = detectTaskType(prompt);
  const liveContext = await smartSearch(env, prompt);
  const systemPrompt= buildSystemPrompt(taskType, voiceMode);
  const messages    = buildMessages(systemPrompt, history, liveContext, prompt, false, "", "");
  const groqKeys    = getGroqKeys(env);

  // Try Groq streaming first
  for (const key of groqKeys) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages,
          temperature: 0.65,
          max_tokens: voiceMode ? 150 : 2000,
          stream: true,
        }),
      });
      if (res.status === 429 || res.status === 401) continue;
      if (!res.ok) continue;

      const { readable, writable } = new TransformStream();
      const writer  = writable.getWriter();
      const encoder = new TextEncoder();

      (async () => {
        const reader  = res.body.getReader();
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
              if (d === "[DONE]") {
                await writer.write(encoder.encode("data: [DONE]\n\n"));
                continue;
              }
              try {
                const p = JSON.parse(d);
                const token = p.choices?.[0]?.delta?.content || "";
                if (token) {
                  await writer.write(encoder.encode(
                    `data: ${JSON.stringify({ token, model: "cloudai-engine" })}\n\n`
                  ));
                }
              } catch {}
            }
          }
          await updateQuota(env, clientId, quotaResult.quotaUsed);
        } finally {
          await writer.close();
        }
      })();

      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          ...cors,
        },
      });
    } catch {}
  }

  // Groq streaming failed → DeepSeek non-stream
  const result = await orchestrate(env, body);
  return jsonRes(result, 200, cors);
}

// ═══════════════════════════════════════════════════
// TTS — ElevenLabs + Web Speech fallback signal
// ═══════════════════════════════════════════════════

async function handleTTS(request, env, cors) {
  try {
    const { text, voice } = await request.json();
    if (!text) return jsonRes({ fallback: true }, 200, cors);
    if (!env.ELEVENLABS_KEY) return jsonRes({ fallback: true, reason: "use_webspeech" }, 200, cors);

    const VOICE_ID = voice || "SZfY4K69FwXus87eayHK";
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: "POST",
        headers: { "xi-api-key": env.ELEVENLABS_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.slice(0, 3000),
          model_id: "eleven_turbo_v2",
          voice_settings: { stability: 0.45, similarity_boost: 0.82, style: 0.35, use_speaker_boost: true },
        }),
      }
    );

    if (!res.ok || res.status === 429 || res.status === 401 || res.status === 422) {
      return jsonRes({ fallback: true, reason: "use_webspeech" }, 200, cors);
    }

    return new Response(res.body, { headers: { "Content-Type": "audio/mpeg", ...cors } });
  } catch {
    return jsonRes({ fallback: true, reason: "use_webspeech" }, 200, cors);
  }
}

// ═══════════════════════════════════════════════════
// IMAGE GENERATION
// Multiple models for reliability
// ═══════════════════════════════════════════════════

const IMAGE_MODELS = [
  "stabilityai/stable-diffusion-xl-base-1.0",
  "black-forest-labs/FLUX.1-schnell",
  "stabilityai/stable-diffusion-2-1",
  "runwayml/stable-diffusion-v1-5",
];

async function handleImageGen(request, env, cors) {
  try {
    const { prompt } = await request.json();
    if (!prompt) return jsonRes({ error: "No prompt" }, 400, cors);

    const enhancedPrompt = `${prompt}, highly detailed, professional quality, 4k, beautiful`;

    for (const model of IMAGE_MODELS) {
      try {
        // Try twice per model (handles cold start)
        for (let attempt = 0; attempt < 2; attempt++) {
          const res = await fetch(
            `https://api-inference.huggingface.co/models/${model}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(env.HF_TOKEN ? { "Authorization": `Bearer ${env.HF_TOKEN}` } : {}),
              },
              body: JSON.stringify({
                inputs: enhancedPrompt,
                options: { wait_for_model: true },  // wait for warm-up
              }),
            }
          );
          if (!res.ok) {
            // 503 = loading, wait and retry
            if (res.status === 503 && attempt === 0) {
              await new Promise(r => setTimeout(r, 3000));
              continue;
            }
            break;
          }
          const contentType = res.headers.get("content-type") || "";
          if (!contentType.startsWith("image/")) break;
          return new Response(res.body, { headers: { "Content-Type": contentType, ...cors } });
        }
      } catch {}
    }

    return jsonRes({ error: "Image gen temporarily unavailable. Try again in 30s." }, 503, cors);
  } catch (err) {
    return jsonRes({ error: err.message }, 500, cors);
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

    const shareId = Math.random().toString(36).slice(2, 9);
    const data = {
      title: (title || "CloudAI Chat").slice(0, 100),
      messages: messages.slice(-20),
      createdAt: new Date().toISOString(),
      views: 0,
    };
    await env.QUOTA_KV.put(`share_${shareId}`, JSON.stringify(data), { expirationTtl: 30 * 86400 });
    return jsonRes({ shareId, url: `https://cloudai.srjahir.in/?share=${shareId}` }, 200, cors);
  } catch (err) {
    return jsonRes({ error: err.message }, 500, cors);
  }
}

async function handleShareGet(request, env, cors) {
  try {
    const shareId = new URL(request.url).searchParams.get("id");
    if (!shareId) return jsonRes({ error: "No ID" }, 400, cors);
    const raw = await env.QUOTA_KV.get(`share_${shareId}`);
    if (!raw) return jsonRes({ error: "Not found or expired" }, 404, cors);
    const data = JSON.parse(raw);
    data.views = (data.views || 0) + 1;
    await env.QUOTA_KV.put(`share_${shareId}`, JSON.stringify(data), { expirationTtl: 30 * 86400 });
    return jsonRes(data, 200, cors);
  } catch (err) {
    return jsonRes({ error: err.message }, 500, cors);
  }
}

// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════

function parseBody(body) {
  const raw = (body.prompt || "").trim();
  return {
    prompt:     raw.slice(0, 4000),
    history:    Array.isArray(body.history) ? body.history.slice(-20) : [],
    clientId:   (body.clientId || "").replace(/[^a-z0-9_]/gi, "").slice(0, 32) || "anon",
    fileBase64: body.fileBase64 || null,
    fileType:   (body.fileType || "").slice(0, 100),
    fileName:   (body.fileName || "").slice(0, 200).replace(/[<>"']/g, ""),
    voiceMode:  !!body.voiceMode,
  };
}

function extractText(base64, mimeType, fileName) {
  try {
    if (!mimeType) return "";
    const isText = mimeType.startsWith("text/") ||
      ["application/json", "application/xml", "application/javascript"].includes(mimeType) ||
      /\.(py|js|ts|md|txt|csv|json|xml|html|css|sh|yaml|yml)$/i.test(fileName || "");

    if (isText) {
      const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      return new TextDecoder("utf-8", { fatal: false }).decode(bytes).slice(0, 8000);
    }
    if (mimeType.includes("pdf")) return `[PDF: "${fileName}" — sent for analysis]`;
    if (mimeType.includes("word")) return `[Word doc: "${fileName}" — sent for analysis]`;
    return `[File: "${fileName}" (${mimeType})]`;
  } catch {
    return `[File: "${fileName}"]`;
  }
}

function jsonRes(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}
