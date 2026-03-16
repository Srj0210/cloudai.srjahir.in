// ===================================================
// CloudAI Worker v19.1
// Text:  Groq Llama 3.3 70B (primary)
// Image: Groq Llama 4 Scout Vision (primary)
// Both fallback to Gemini 2.5 Flash
// Session-only memory (no KV bloat)
// by SRJahir Technologies 
// ===================================================

export default {
  async fetch(request, env) {

    const cors = {
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") return new Response(
      JSON.stringify({ error: "POST only." }),
      { status: 405, headers: { "Content-Type": "application/json", ...cors } }
    );

    /* ── INPUT ─────────────────────────────────── */
    let prompt = "", history = [], clientId = "";
    let fileBase64 = null, fileType = "", fileName = "";
    let voiceMode = false;

    try {
      const body = await request.json();
      prompt     = (body.prompt    || "").trim();
      history    = Array.isArray(body.history) ? body.history : [];
      clientId   = (body.clientId  || "").slice(0, 32);
      fileBase64 = body.fileBase64 || null;
      fileType   = body.fileType   || "";
      fileName   = body.fileName   || "";
      voiceMode  = body.voiceMode  || false;
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON." }),
        { status: 400, headers: { "Content-Type": "application/json", ...cors } }
      );
    }

    if (!prompt && !fileBase64) return new Response(
      JSON.stringify({ error: "No prompt or file." }),
      { status: 400, headers: { "Content-Type": "application/json", ...cors } }
    );
    if (!clientId) return new Response(
      JSON.stringify({ error: "Missing clientId." }),
      { status: 400, headers: { "Content-Type": "application/json", ...cors } }
    );

    /* ── QUOTA (KV — only this, no memory storage) ── */
    const QUOTA = 100; // 100/day per user — change as needed
    const kvKey = `q_${clientId}`;
    let quotaUsed = 0;

    try {
      const stored = await env.QUOTA_KV.get(kvKey, "json");
      if (stored) {
        const sameDay = new Date(stored.lastReset).toDateString() === new Date().toDateString();
        quotaUsed = sameDay ? (stored.quotaUsed || 0) : 0;
      }
    } catch {}

    if (quotaUsed >= QUOTA) return new Response(
      JSON.stringify({ reply: "🚫 Daily limit (200/day) reached. Try tomorrow.", quotaStatus: "quota_exceeded" }),
      { status: 200, headers: { "Content-Type": "application/json", ...cors } }
    );

    quotaUsed++;
    try {
      await env.QUOTA_KV.put(kvKey,
        JSON.stringify({ quotaUsed, lastReset: new Date().toISOString() }),
        { expirationTtl: 2 * 86400 }
      );
    } catch {}

    /* ── SMART WEB SEARCH ──────────────────────── */
    let liveContext = "";
    const searchWords = ["today","latest","news","price","current","live","weather","2025","2026","who won","score","stock"];
    if (env.TAVILY_API_KEY && prompt && searchWords.some(k => prompt.toLowerCase().includes(k))) {
      try {
        const tr = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type":"application/json", "Authorization":`Bearer ${env.TAVILY_API_KEY}` },
          body: JSON.stringify({ query: prompt, search_depth:"basic", max_results:3 }),
        });
        const td = await tr.json();
        if (td?.results?.length) {
          liveContext = "Live web data:\n" + td.results.map(r=>`- ${r.title}: ${r.content}`).join("\n");
        }
      } catch {}
    }

    /* ── SYSTEM PROMPT ─────────────────────────── */
    const systemPrompt = `You are CloudAI, a brilliant AI assistant by SRJahir Tech (Owner: Mr. Suraj Maitra).

PERSONALITY: Warm, confident, helpful. Like a smart friend who knows everything.
${voiceMode ? `
VOICE MODE: Reply in 2-3 short conversational sentences only. No markdown. Speak naturally like a human.` : `
FORMAT: Use clean Markdown. Bold key terms. Code blocks for code. Tables for comparisons. Be concise.`}

RULES:
- Never say "As an AI language model" or "I'm a large language model"
- You CAN see and analyze images — always describe what you see
- Be direct, helpful, and clear`;

    /* ── DETECT: has image? ─────────────────────── */
    const isImage = fileBase64 && fileType.startsWith("image/");
    const isDoc   = fileBase64 && !isImage;

    let reply = "";
    let usedModel = "";

    /* ════════════════════════════════════════════
       ROUTE A: IMAGE → Groq Llama 4 Scout Vision
       ════════════════════════════════════════════ */
    if (isImage && (env.GROQ_API_KEY || env.GROQ2_API_KEY)) {
      // Try GROQ_API_KEY first, then GROQ2_API_KEY if rate limited
      const groqKeys = [env.GROQ_API_KEY, env.GROQ2_API_KEY].filter(Boolean);

      for (const key of groqKeys) {
        if (reply) break;
        try {
          const visionMessages = [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                { type: "image_url", image_url: { url: `data:${fileType};base64,${fileBase64}` } },
                { type: "text",      text: prompt || "What is in this image? Describe in detail." }
              ]
            }
          ];

          const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
            body: JSON.stringify({
              model:       "meta-llama/llama-4-scout-17b-16e-instruct",
              messages:    visionMessages,
              temperature: 0.6,
              max_tokens:  1200,
            }),
          });

          const data = await res.json();
          // 429 = rate limited → try next key
          if (data.error?.code === "rate_limit_exceeded" || res.status === 429) {
            console.warn("Groq vision key rate limited, trying next...");
            continue;
          }
          if (!data.error) {
            reply     = data?.choices?.[0]?.message?.content || "";
            usedModel = "groq-vision";
          }
        } catch (err) {
          console.warn("Groq vision key failed:", err.message);
        }
      }
    }

    /* ════════════════════════════════════════════
       ROUTE B: TEXT → Groq Llama 3.3 70B
       ════════════════════════════════════════════ */
    if (!reply && !isImage && (env.GROQ_API_KEY || env.GROQ2_API_KEY)) {
      const groqKeys = [env.GROQ_API_KEY, env.GROQ2_API_KEY].filter(Boolean);

      for (const key of groqKeys) {
        if (reply) break;
        try {
          const messages = [{ role: "system", content: systemPrompt }];

          for (const h of history.slice(-20)) {
            messages.push({ role: h.role === "model" ? "assistant" : "user", content: h.text || "" });
          }
          if (liveContext) {
            messages.push({ role: "user",      content: liveContext });
            messages.push({ role: "assistant", content: "Got the live data." });
          }

          const finalPrompt = isDoc
            ? `[User attached file: "${fileName}" (${fileType})] ${prompt || "Please analyze this file."}`
            : (prompt || "Hello");

          messages.push({ role: "user", content: finalPrompt });

          const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
            body: JSON.stringify({
              model:       "llama-3.3-70b-versatile",
              messages,
              temperature: voiceMode ? 0.8 : 0.65,
              max_tokens:  voiceMode ? 150 : 1800,
              top_p:       0.9,
            }),
          });

          const data = await res.json();
          if (data.error?.code === "rate_limit_exceeded" || res.status === 429) {
            console.warn("Groq text key rate limited, trying next...");
            continue;
          }
          if (!data.error) {
            reply     = data?.choices?.[0]?.message?.content || "";
            usedModel = "groq";
          }
        } catch (err) {
          console.warn("Groq text key failed:", err.message);
        }
      }
    }

    /* ════════════════════════════════════════════
       ROUTE C: GEMINI FALLBACK (text + image + docs)
       ════════════════════════════════════════════ */
    if (!reply && env.GEMINI_API_KEY) {
      usedModel = "gemini";
      try {
        const contents = [];
        contents.push({ role:"user",  parts:[{ text: systemPrompt }] });
        contents.push({ role:"model", parts:[{ text: "Ready." }] });

        for (const h of history.slice(-20)) {
          contents.push({ role: h.role==="model"?"model":"user", parts:[{ text: h.text||"" }] });
        }
        if (liveContext) {
          contents.push({ role:"user",  parts:[{ text: liveContext }] });
          contents.push({ role:"model", parts:[{ text: "Got it." }] });
        }

        const gParts = [];
        // Gemini supports: images, pdf, text files, audio
        if (fileBase64 && fileType) {
          const supported = ["image/","application/pdf","text/","audio/","video/"];
          if (supported.some(t => fileType.startsWith(t))) {
            gParts.push({ inline_data: { mime_type: fileType, data: fileBase64 } });
          }
        }
        gParts.push({ text: prompt || "Analyze the attached file." });
        contents.push({ role:"user", parts: gParts });

        const gr = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents,
              generationConfig: {
                temperature:     voiceMode ? 0.8 : 0.65,
                topP:            0.9,
                maxOutputTokens: voiceMode ? 150 : 1800,
              },
            }),
          }
        );
        const gd = await gr.json();
        if (!gd.error) {
          reply = gd?.candidates?.[0]?.content?.parts?.map(p=>p.text).filter(Boolean).join("") || "";
        } else {
          console.error("Gemini error:", gd.error.message);
        }
      } catch (err) {
        console.error("Gemini failed:", err.message);
      }
    }

    if (!reply) reply = "⚠️ AI unavailable right now. Please try again in a moment.";

    return new Response(
      JSON.stringify({
        reply,
        model:       usedModel,
        quotaStatus: quotaUsed >= QUOTA * 0.85 ? "quota_warning" : "ok",
        quotaUsed,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...cors } }
    );
  },
};
