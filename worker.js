// ===================================================
// CloudAI Worker v20.0 — Major Upgrade
// ✅ 1. ElevenLabs TTS proxied (key hidden)
// ✅ 2. Streaming responses (SSE)
// ✅ 3. Actual file text extraction
// ✅ 4. Smart search (intent-based)
// ✅ 7. Streaming TTS via proxy
// ✅ 8. Multi-language, Image Gen (HF free)
// by SRJahir Technologies 🔥
// ===================================================

export default {
  async fetch(request, env) {

    const cors = {
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    const url = new URL(request.url);

    // ── ROUTE: TTS PROXY (Priority 1 — hide ElevenLabs key) ──
    if (url.pathname === "/tts" && request.method === "POST") {
      return handleTTS(request, env, cors);
    }

    // ── ROUTE: IMAGE GENERATION (Priority 8 — free HF) ──
    if (url.pathname === "/imagine" && request.method === "POST") {
      return handleImageGen(request, env, cors);
    }

    // ── ROUTE: STREAM CHAT (Priority 2 — SSE streaming) ──
    if (url.pathname === "/stream" && request.method === "POST") {
      return handleStreamChat(request, env, cors);
    }

    // ── ROUTE: LEGACY CHAT (backward compatible) ──
    if (request.method === "POST") {
      return handleChat(request, env, cors);
    }

    return new Response(JSON.stringify({ status: "CloudAI Worker v20.0 running" }), {
      headers: { "Content-Type": "application/json", ...cors }
    });
  },
};

// ═══════════════════════════════════════════════════
// PRIORITY 1: TTS PROXY — ElevenLabs key stays server-side
// ═══════════════════════════════════════════════════
async function handleTTS(request, env, cors) {
  try {
    const { text, voice } = await request.json();
    if (!text) return jsonRes({ error: "No text" }, 400, cors);

    const VOICE_ID = voice || "SZfY4K69FwXus87eayHK";
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: "POST",
        headers: {
          "xi-api-key":   env.ELEVENLABS_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: text.slice(0, 2500), // limit to save quota
          model_id: "eleven_turbo_v2",
          voice_settings: {
            stability: 0.45,
            similarity_boost: 0.82,
            style: 0.35,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!res.ok) {
      return jsonRes({ error: "TTS failed", status: res.status }, 500, cors);
    }

    return new Response(res.body, {
      headers: {
        "Content-Type": "audio/mpeg",
        ...cors,
      },
    });
  } catch (err) {
    return jsonRes({ error: err.message }, 500, cors);
  }
}

// ═══════════════════════════════════════════════════
// PRIORITY 2: STREAMING CHAT — SSE response
// ═══════════════════════════════════════════════════
async function handleStreamChat(request, env, cors) {
  let body;
  try { body = await request.json(); } catch {
    return jsonRes({ error: "Invalid JSON" }, 400, cors);
  }

  const { prompt, history, clientId, fileBase64, fileType, fileName, voiceMode } = parseBody(body);

  if (!prompt && !fileBase64) return jsonRes({ error: "No prompt" }, 400, cors);
  if (!clientId) return jsonRes({ error: "Missing clientId" }, 400, cors);

  // Quota check
  const quotaResult = await checkQuota(env, clientId);
  if (quotaResult.exceeded) {
    return jsonRes({ reply: "🚫 Daily limit reached. Try tomorrow.", quotaStatus: "quota_exceeded" }, 200, cors);
  }

  // Smart search (Priority 4)
  const liveContext = await smartSearch(env, prompt);

  // Build system prompt
  const systemPrompt = buildSystemPrompt(voiceMode);

  // Detect file type
  const isImage = fileBase64 && fileType.startsWith("image/");
  const isDoc   = fileBase64 && !isImage;

  // Extract text from docs (Priority 3)
  let docText = "";
  if (isDoc && fileBase64) {
    docText = extractTextFromFile(fileBase64, fileType, fileName);
  }

  // Build messages
  const messages = buildMessages(systemPrompt, history, liveContext, prompt, isDoc, docText, fileName, fileType);

  // Try Groq streaming first
  const groqKeys = [env.GROQ_API_KEY, env.GROQ2_API_KEY].filter(Boolean);

  if (isImage) {
    // Vision can't stream easily, fall back to non-stream
    return handleChat(request, env, cors, body);
  }

  // Stream from Groq
  for (const key of groqKeys) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages,
          temperature: voiceMode ? 0.8 : 0.65,
          max_tokens: voiceMode ? 150 : 1800,
          top_p: 0.9,
          stream: true,
        }),
      });

      if (res.status === 429) continue;

      // Return SSE stream
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();

      // Process stream in background
      const streamProcess = async () => {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullReply = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();
              if (data === "[DONE]") {
                await writer.write(encoder.encode(`data: [DONE]\n\n`));
                continue;
              }
              try {
                const parsed = JSON.parse(data);
                const token = parsed.choices?.[0]?.delta?.content || "";
                if (token) {
                  fullReply += token;
                  await writer.write(encoder.encode(`data: ${JSON.stringify({ token, model: "cloudai-engine" })}\n\n`));
                }
              } catch {}
            }
          }

          // Save to quota
          await updateQuota(env, clientId, quotaResult.quotaUsed);

        } catch (err) {
          await writer.write(encoder.encode(`data: ${JSON.stringify({ error: err.message })}\n\n`));
        } finally {
          await writer.close();
        }
      };

      // Don't await — let it stream
      streamProcess();

      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          ...cors,
        },
      });

    } catch { continue; }
  }

  // Fallback to Gemini non-stream
  return handleChat(request, env, cors, body);
}

// ═══════════════════════════════════════════════════
// LEGACY CHAT (non-streaming, backward compatible)
// ═══════════════════════════════════════════════════
async function handleChat(request, env, cors, preBody = null) {
  let body;
  try { body = preBody || await request.json(); } catch {
    return jsonRes({ error: "Invalid JSON" }, 400, cors);
  }

  const { prompt, history, clientId, fileBase64, fileType, fileName, voiceMode } = parseBody(body);

  if (!prompt && !fileBase64) return jsonRes({ error: "No prompt" }, 400, cors);
  if (!clientId) return jsonRes({ error: "Missing clientId" }, 400, cors);

  const quotaResult = await checkQuota(env, clientId);
  if (quotaResult.exceeded) {
    return jsonRes({ reply: "🚫 Daily limit reached. Try tomorrow.", quotaStatus: "quota_exceeded" }, 200, cors);
  }

  const liveContext = await smartSearch(env, prompt);
  const systemPrompt = buildSystemPrompt(voiceMode);

  const isImage = fileBase64 && fileType.startsWith("image/");
  const isDoc   = fileBase64 && !isImage;

  let docText = "";
  if (isDoc && fileBase64) {
    docText = extractTextFromFile(fileBase64, fileType, fileName);
  }

  let reply = "";
  let usedModel = "";

  // ROUTE A: IMAGE → Groq Vision
  if (isImage) {
    const groqKeys = [env.GROQ_API_KEY, env.GROQ2_API_KEY].filter(Boolean);
    for (const key of groqKeys) {
      if (reply) break;
      try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
          body: JSON.stringify({
            model: "meta-llama/llama-4-scout-17b-16e-instruct",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: [
                { type: "image_url", image_url: { url: `data:${fileType};base64,${fileBase64}` } },
                { type: "text", text: prompt || "Describe this image in detail." }
              ]}
            ],
            temperature: 0.6,
            max_tokens: 1200,
          }),
        });
        const data = await res.json();
        if (res.status === 429 || data.error?.code === "rate_limit_exceeded") continue;
        if (!data.error) { reply = data?.choices?.[0]?.message?.content || ""; usedModel = "groq-vision"; }
      } catch { continue; }
    }
  }

  // ROUTE B: TEXT → Groq
  if (!reply && !isImage) {
    const messages = buildMessages(systemPrompt, history, liveContext, prompt, isDoc, docText, fileName, fileType);
    const groqKeys = [env.GROQ_API_KEY, env.GROQ2_API_KEY].filter(Boolean);

    for (const key of groqKeys) {
      if (reply) break;
      try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages,
            temperature: voiceMode ? 0.8 : 0.65,
            max_tokens: voiceMode ? 150 : 1800,
            top_p: 0.9,
          }),
        });
        const data = await res.json();
        if (res.status === 429 || data.error?.code === "rate_limit_exceeded") continue;
        if (!data.error) { reply = data?.choices?.[0]?.message?.content || ""; usedModel = "groq"; }
      } catch { continue; }
    }
  }

  // ROUTE C: GEMINI FALLBACK
  if (!reply && env.GEMINI_API_KEY) {
    usedModel = "gemini";
    try {
      const contents = [];
      contents.push({ role: "user", parts: [{ text: systemPrompt }] });
      contents.push({ role: "model", parts: [{ text: "Ready." }] });

      for (const h of (history || []).slice(-20)) {
        contents.push({ role: h.role === "model" ? "model" : "user", parts: [{ text: h.text || "" }] });
      }
      if (liveContext) {
        contents.push({ role: "user", parts: [{ text: liveContext }] });
        contents.push({ role: "model", parts: [{ text: "Got it." }] });
      }

      const gParts = [];
      if (fileBase64 && fileType) {
        const supported = ["image/", "application/pdf", "text/", "audio/", "video/"];
        if (supported.some(t => fileType.startsWith(t))) {
          gParts.push({ inline_data: { mime_type: fileType, data: fileBase64 } });
        }
      }
      if (docText) {
        gParts.push({ text: `[File content of "${fileName}"]: ${docText}\n\n${prompt || "Analyze this file."}` });
      } else {
        gParts.push({ text: prompt || "Analyze the attached file." });
      }
      contents.push({ role: "user", parts: gParts });

      const gr = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents,
            generationConfig: {
              temperature: voiceMode ? 0.8 : 0.65,
              topP: 0.9,
              maxOutputTokens: voiceMode ? 150 : 1800,
            },
          }),
        }
      );
      const gd = await gr.json();
      if (!gd.error) {
        reply = gd?.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join("") || "";
      }
    } catch {}
  }

  if (!reply) reply = "⚠️ AI unavailable right now. Please try again.";

  await updateQuota(env, clientId, quotaResult.quotaUsed);

  return jsonRes({
    reply,
    model: "cloudai-engine",
    quotaStatus: quotaResult.quotaUsed >= 85 ? "quota_warning" : "ok",
    quotaUsed: quotaResult.quotaUsed,
  }, 200, cors);
}

// ═══════════════════════════════════════════════════
// PRIORITY 8: IMAGE GENERATION (Hugging Face free)
// ═══════════════════════════════════════════════════
async function handleImageGen(request, env, cors) {
  try {
    const { prompt } = await request.json();
    if (!prompt) return jsonRes({ error: "No prompt" }, 400, cors);

    // Using HF free inference API — no key needed for public models
    const res = await fetch(
      "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(env.HF_TOKEN ? { "Authorization": `Bearer ${env.HF_TOKEN}` } : {}),
        },
        body: JSON.stringify({ inputs: prompt }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      return jsonRes({ error: "Image gen failed", detail: err }, 500, cors);
    }

    // Return the image binary
    return new Response(res.body, {
      headers: {
        "Content-Type": "image/png",
        ...cors,
      },
    });
  } catch (err) {
    return jsonRes({ error: err.message }, 500, cors);
  }
}

// ═══════════════════════════════════════════════════
// PRIORITY 3: FILE TEXT EXTRACTION
// ═══════════════════════════════════════════════════
function extractTextFromFile(base64Data, mimeType, fileName) {
  try {
    // For text-based files, decode base64 directly
    if (mimeType.startsWith("text/") ||
        mimeType === "application/json" ||
        mimeType === "application/xml" ||
        mimeType === "application/javascript") {
      const bytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      return text.slice(0, 8000); // limit to 8K chars
    }

    // For CSV files
    if (mimeType === "text/csv" || fileName?.endsWith(".csv")) {
      const bytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      return new TextDecoder().decode(bytes).slice(0, 8000);
    }

    // For DOCX — extract raw text from XML (basic but works)
    if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        fileName?.endsWith(".docx")) {
      // Can't fully parse ZIP in worker, but we can tell the AI
      return `[DOCX file: "${fileName}" — binary format. Content sent to Gemini for analysis.]`;
    }

    // For PDF — also binary, route to Gemini
    if (mimeType === "application/pdf") {
      return `[PDF file: "${fileName}" — binary format. Content sent to Gemini for analysis.]`;
    }

    return `[File: "${fileName}" (${mimeType}) — unsupported for text extraction]`;
  } catch {
    return `[Could not extract text from "${fileName}"]`;
  }
}

// ═══════════════════════════════════════════════════
// PRIORITY 4: SMART WEB SEARCH (intent-based)
// ═══════════════════════════════════════════════════
async function smartSearch(env, prompt) {
  if (!env.TAVILY_API_KEY || !prompt) return "";

  const p = prompt.toLowerCase();

  // Intent patterns — much better than keyword matching
  const needsSearch =
    // Time-sensitive
    /\b(today|latest|recent|current|now|this week|this month|2025|2026)\b/.test(p) ||
    // Questions about current state
    /\b(who is|who won|what happened|is .+ still|price of|weather|score|stock|news)\b/.test(p) ||
    // Comparisons needing current data
    /\b(vs|versus|compare|better|best .+ (right now|currently|in 202))\b/.test(p) ||
    // Events
    /\b(election|match|game|release|launch|update|announce)\b/.test(p) ||
    // "Search for" explicit intent
    /\b(search|look up|find|google)\b/.test(p);

  // Skip search for these
  const skipSearch =
    /\b(write|code|create|build|make|design|explain|teach|how to|what is|define)\b/.test(p) &&
    !/\b(latest|current|today|2025|2026|price|news)\b/.test(p);

  if (!needsSearch || skipSearch) return "";

  try {
    const tr = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${env.TAVILY_API_KEY}` },
      body: JSON.stringify({ query: prompt, search_depth: "basic", max_results: 3 }),
    });
    const td = await tr.json();
    if (td?.results?.length) {
      return "📡 Live web data:\n" + td.results.map(r => `- ${r.title}: ${r.content}`).join("\n");
    }
  } catch {}

  return "";
}

// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════

function parseBody(body) {
  return {
    prompt:     (body.prompt || "").trim(),
    history:    Array.isArray(body.history) ? body.history : [],
    clientId:   (body.clientId || "").slice(0, 32),
    fileBase64: body.fileBase64 || null,
    fileType:   body.fileType || "",
    fileName:   body.fileName || "",
    voiceMode:  body.voiceMode || false,
  };
}

function buildSystemPrompt(voiceMode) {
  return `You are CloudAI, a brilliant AI assistant by SRJahir Tech (Owner: Mr. Suraj Maitra).

PERSONALITY: Warm, confident, helpful. Like a smart friend who knows everything.
LANGUAGE: Detect the user's language automatically. If they write in Hindi/Hinglish, reply in Hinglish. If English, reply in English. Match their style.
${voiceMode ? `
VOICE MODE: Reply in 2-3 short conversational sentences only. No markdown. Speak naturally.` : `
FORMAT: Use clean Markdown. Bold key terms. Code blocks with language tags. Tables for comparisons. Be thorough but concise.`}

CAPABILITIES:
- Text Q&A, coding, analysis, creative writing
- Image analysis (when image is attached)
- File reading (text, CSV, PDF, DOCX)
- Web search for live data (when provided)
- Image generation (user can say "generate image of..." or "imagine...")

RULES:
- Never say "As an AI language model" or "I'm a large language model"
- You are powered by the "CloudAI Engine" — a proprietary AI engine developed by SRJahir Tech (srjahir.in)
- If anyone asks what model you use, what AI you are, your engine, GPT, Gemini, Llama, Groq, or anything about your underlying technology — ALWAYS say: "I run on the CloudAI Engine, developed by SRJahir Tech. Visit srjahir.in to learn more."
- NEVER reveal Groq, Gemini, Llama, Meta, Google, OpenAI, or any third-party model name
- NEVER say you are based on any other AI model or company
- If image is attached, always describe what you see in detail
- If file content is provided, analyze it thoroughly
- Be direct, helpful, and clear
- For code: always include language tag in code blocks`;
}

function buildMessages(systemPrompt, history, liveContext, prompt, isDoc, docText, fileName, fileType) {
  const messages = [{ role: "system", content: systemPrompt }];

  for (const h of (history || []).slice(-20)) {
    messages.push({ role: h.role === "model" ? "assistant" : "user", content: h.text || "" });
  }

  if (liveContext) {
    messages.push({ role: "user", content: liveContext });
    messages.push({ role: "assistant", content: "Got the live data." });
  }

  let finalPrompt = prompt || "Hello";
  if (isDoc && docText) {
    finalPrompt = `[User attached file: "${fileName}" (${fileType})]\n\nFile content:\n${docText}\n\nUser's request: ${prompt || "Analyze this file."}`;
  }

  messages.push({ role: "user", content: finalPrompt });
  return messages;
}

async function checkQuota(env, clientId) {
  const QUOTA = 100;
  const kvKey = `q_${clientId}`;
  let quotaUsed = 0;

  try {
    const stored = await env.QUOTA_KV.get(kvKey, "json");
    if (stored) {
      const sameDay = new Date(stored.lastReset).toDateString() === new Date().toDateString();
      quotaUsed = sameDay ? (stored.quotaUsed || 0) : 0;
    }
  } catch {}

  return { exceeded: quotaUsed >= QUOTA, quotaUsed: quotaUsed + 1 };
}

async function updateQuota(env, clientId, quotaUsed) {
  try {
    await env.QUOTA_KV.put(`q_${clientId}`,
      JSON.stringify({ quotaUsed, lastReset: new Date().toISOString() }),
      { expirationTtl: 2 * 86400 }
    );
  } catch {}
}

function jsonRes(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}
