// ===================================================
// CloudAI Chat v20.0 — Streaming + Image Gen + TTS Proxy
// marked.js + DOMPurify + SSE streaming
// by SRJahir Technologies 🔥
// ===================================================

const API = "https://dawn-smoke-b354.sleepyspider6166.workers.dev";

const box         = document.getElementById("chat-box");
const sendBtn     = document.getElementById("send-btn");
const micBtn      = document.getElementById("mic-btn");
const input       = document.getElementById("user-input");
const pinBtn      = document.getElementById("pin-btn");
const attachMenu  = document.getElementById("attachMenu");
const cameraInput = document.getElementById("cameraInput");
const imageInput  = document.getElementById("imageInput");
const fileInput   = document.getElementById("fileInput");

/* ── SESSION ──────────────────────────────────── */
const clientId =
  localStorage.getItem("cloudai_client") ||
  (() => {
    const id = "web_" + Math.random().toString(36).slice(2, 9);
    localStorage.setItem("cloudai_client", id);
    return id;
  })();

let history      = JSON.parse(localStorage.getItem("cloudai_history") || "[]");
let isProcessing = false;
let pendingFile  = null;

// Restore chat on load (Priority 6 bonus — chat persistence)
window.addEventListener("DOMContentLoaded", () => {
  const saved = JSON.parse(localStorage.getItem("cloudai_chat") || "[]");
  saved.forEach(m => {
    if (m.role === "user") addUser(m.text, "", false);
    else addAI(m.html, false);
  });
  scrollBottom(true);
});

function saveChat() {
  const msgs = [];
  box.querySelectorAll(".user-msg, .ai-msg").forEach(el => {
    if (el.classList.contains("user-msg")) {
      msgs.push({ role: "user", text: el.textContent });
    } else if (!el.classList.contains("thinking-indicator")) {
      msgs.push({ role: "ai", html: el.innerHTML });
    }
  });
  // Keep last 50 messages
  localStorage.setItem("cloudai_chat", JSON.stringify(msgs.slice(-50)));
  localStorage.setItem("cloudai_history", JSON.stringify(history.slice(-40)));
}

/* ── MARKDOWN ─────────────────────────────────── */
function renderMarkdown(text) {
  if (!text) return "";
  marked.setOptions({ breaks: true, gfm: true });
  return DOMPurify.sanitize(marked.parse(text));
}

function escapeHtml(str) {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

/* ── USER MESSAGE ─────────────────────────────── */
function addUser(text, previewHTML = "", save = true) {
  const div = document.createElement("div");
  div.className = "user-msg";
  if (previewHTML)
    div.innerHTML = DOMPurify.sanitize(previewHTML) +
      (text ? `<div style="margin-top:6px">${escapeHtml(text)}</div>` : "");
  else
    div.textContent = text;
  box.appendChild(div);
  scrollBottom(true);
  if (save) saveChat();
}

/* ── AI MESSAGE ───────────────────────────────── */
function addAI(html, save = true) {
  const div = document.createElement("div");
  div.className = "ai-msg";
  box.appendChild(div);
  if (typeof typeHTML === "function" && save) {
    typeHTML(div, html, () => afterAI(div));
  } else {
    div.innerHTML = html;
    afterAI(div);
  }
  if (save) saveChat();
}

function afterAI(div) {
  enhanceCodeBlocks(div);
  if (window.Prism) Prism.highlightAll();
  scrollBottom(true);
}

/* ── COPY BUTTON ──────────────────────────────── */
function enhanceCodeBlocks(container) {
  container.querySelectorAll("pre code").forEach(block => {
    if (block.parentElement.querySelector(".copy-btn")) return;
    const btn = document.createElement("button");
    btn.className = "copy-btn";
    btn.textContent = "Copy";
    btn.onclick = () => {
      navigator.clipboard.writeText(block.innerText);
      btn.textContent = "Copied ✓";
      setTimeout(() => btn.textContent = "Copy", 1500);
    };
    block.parentElement.prepend(btn);
  });
}

/* ── ALERT ────────────────────────────────────── */
function showAlert(msg, color = "#F57F17") {
  if (document.getElementById("cloudai-alert")) return;
  const el = document.createElement("div");
  el.id = "cloudai-alert";
  el.className = "cloudai-alert";
  el.style.background = color;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

/* ── FILE UTILS ───────────────────────────────── */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function getFilePreview(file) {
  if (file.type.startsWith("image/")) {
    return new Promise(res => {
      const r = new FileReader();
      r.onload = () => res(`<img src="${r.result}" class="file-preview-img">`);
      r.readAsDataURL(file);
    });
  }
  const icon = file.type.includes("pdf") ? "📄" : file.type.includes("audio") ? "🎵" : file.type.includes("video") ? "🎬" : "📎";
  return `<div class="file-chip">${icon} ${escapeHtml(file.name)} <span class="file-size">(${(file.size/1024).toFixed(1)} KB)</span></div>`;
}

async function attachFile(file) {
  if (file.size > 10 * 1024 * 1024) { addAI("⚠️ File too large. Max 10MB."); return; }
  const preview = await getFilePreview(file);
  pendingFile = { file, previewHTML: preview };

  let bar = document.getElementById("file-preview-bar");
  if (!bar) { bar = document.createElement("div"); bar.id = "file-preview-bar"; bar.className = "file-preview-bar"; document.body.appendChild(bar); }
  bar.innerHTML = DOMPurify.sanitize(preview) +
    `<span class="file-bar-name">${escapeHtml(file.name)}</span>` +
    `<button id="remove-file" class="file-bar-remove">✕</button>`;
  document.getElementById("remove-file").onclick = () => { pendingFile = null; bar.remove(); };
}

/* ══════════════════════════════════════════════════
   PRIORITY 8: IMAGE GENERATION DETECTION
   ══════════════════════════════════════════════════ */
function isImageGenRequest(text) {
  const t = text.toLowerCase();
  return /^(generate|imagine|create|draw|make|design)\s+(an?\s+)?(image|picture|photo|art|illustration|poster|logo)/i.test(t) ||
         /^(imagine|draw|paint):/i.test(t);
}

async function generateImage(prompt) {
  const div = document.createElement("div");
  div.className = "ai-msg";
  div.innerHTML = `<div class="img-gen-loading">🎨 Generating image: "${escapeHtml(prompt)}"...</div>`;
  box.appendChild(div);
  scrollBottom(true);

  try {
    const res = await fetch(`${API}/imagine`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    if (!res.ok) throw new Error("Generation failed");

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    div.innerHTML = `<div class="generated-image-wrap">
      <img src="${url}" class="generated-image" alt="${escapeHtml(prompt)}">
      <div class="img-gen-caption">🎨 "${escapeHtml(prompt)}"</div>
      <button class="download-btn" onclick="downloadImage('${url}', 'cloudai-image.png')">⬇ Download</button>
    </div>`;
    history.push({ role: "model", text: `[Generated image: ${prompt}]` });
    saveChat();
  } catch {
    div.innerHTML = `<strong>⚠️ Image generation failed. The model might be loading — try again in 30 seconds.</strong>`;
  }
}

function downloadImage(url, name) {
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
}

/* ══════════════════════════════════════════════════
   PRIORITY 2: STREAMING SEND MESSAGE
   ══════════════════════════════════════════════════ */
async function sendMessage() {
  const msg = input.value.trim();
  if ((!msg && !pendingFile) || isProcessing) return;

  isProcessing = true;
  input.value  = "";

  addUser(msg, pendingFile?.previewHTML || "");

  const bar = document.getElementById("file-preview-bar");
  if (bar) bar.remove();

  const fileToSend = pendingFile?.file || null;
  pendingFile = null;

  history.push({ role: "user", text: msg || "[file attached]" });
  if (history.length > 40) history = history.slice(-40);

  // Check if image generation request
  if (msg && isImageGenRequest(msg) && !fileToSend) {
    isProcessing = false;
    document.body.classList.remove("ai-thinking");
    const imgPrompt = msg.replace(/^(generate|imagine|create|draw|make|design)\s+(an?\s+)?(image|picture|photo|art|illustration|poster|logo)\s*(of|:)?\s*/i, "").trim() || msg;
    return generateImage(imgPrompt);
  }

  document.body.classList.add("ai-thinking");

  // Thinking dots
  const thinking = document.createElement("div");
  thinking.className = "ai-msg thinking-indicator";
  thinking.innerHTML = `<span class="dot"></span><span class="dot"></span><span class="dot"></span>`;
  box.appendChild(thinking);
  scrollBottom(true);

  try {
    // If file is attached, use legacy non-stream endpoint
    if (fileToSend) {
      const b64 = await fileToBase64(fileToSend);
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: msg || "Please analyze this file.",
          history, clientId,
          fileBase64: b64, fileType: fileToSend.type, fileName: fileToSend.name,
        }),
      });
      const data = await res.json();
      thinking.remove();

      if (data.error) {
        addAI(`<strong>⚠️ ${escapeHtml(data.error)}</strong>`);
      } else {
        const reply = data.reply || "No response";
        addAI(renderMarkdown(reply));
        history.push({ role: "model", text: reply });
        addModelBadge(data.model);
      }
    } else {
      // ── STREAMING RESPONSE ──
      const res = await fetch(`${API}/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: msg, history, clientId }),
      });

      // If stream endpoint not available, fall back
      if (!res.ok || !res.headers.get("content-type")?.includes("text/event-stream")) {
        const data = await res.json();
        thinking.remove();
        const reply = data.reply || "No response";
        addAI(renderMarkdown(reply));
        history.push({ role: "model", text: reply });
        addModelBadge(data.model);
      } else {
        // SSE streaming
        thinking.remove();
        const aiDiv = document.createElement("div");
        aiDiv.className = "ai-msg streaming";
        box.appendChild(aiDiv);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullReply = "";
        let modelUsed = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.token) {
                fullReply += parsed.token;
                aiDiv.innerHTML = renderMarkdown(fullReply);
                scrollBottom(true);
              }
              if (parsed.model) modelUsed = parsed.model;
            } catch {}
          }
        }

        aiDiv.classList.remove("streaming");
        afterAI(aiDiv);
        history.push({ role: "model", text: fullReply });
        addModelBadge(modelUsed);
      }
    }

    saveChat();

  } catch (err) {
    thinking.remove();
    addAI("⚠️ Network error. Please try again.");
    console.error(err);
  } finally {
    isProcessing = false;
    document.body.classList.remove("ai-thinking");
  }
}

/* ── MODEL BADGE (shows which model responded) ── */
function addModelBadge(model) {
  if (!model) return;
  const last = box.querySelector(".ai-msg:last-child");
  if (!last) return;
  const badge = document.createElement("span");
  badge.className = "model-badge";
  badge.textContent = "⚡ CloudAI Engine";
  last.appendChild(badge);
}

/* ── SCROLL ───────────────────────────────────── */
function scrollBottom(force = false) {
  requestAnimationFrame(() => {
    const inputBar  = document.querySelector(".input-area");
    const barHeight = inputBar ? inputBar.getBoundingClientRect().height + 24 : 100;
    if (force && box.lastElementChild) {
      const last   = box.lastElementChild;
      const rect   = last.getBoundingClientRect();
      const bottom = window.innerHeight - barHeight;
      if (rect.bottom > bottom) {
        window.scrollBy({ top: rect.bottom - bottom + 16, behavior: "smooth" });
      }
    }
    box.scrollTop = box.scrollHeight;
  });
}

/* ── EVENTS ───────────────────────────────────── */
sendBtn.onclick = sendMessage;
input.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

/* ── ATTACH MENU ──────────────────────────────── */
pinBtn.onclick = () => {
  attachMenu.style.display = attachMenu.style.display === "flex" ? "none" : "flex";
};
attachMenu.onclick = e => {
  const type = e.target.dataset.type;
  if (!type) return;
  attachMenu.style.display = "none";
  if (type === "camera") cameraInput.click();
  if (type === "image")  imageInput.click();
  if (type === "file")   fileInput.click();
};
[cameraInput, imageInput, fileInput].forEach(inp => {
  inp.onchange = () => { const f = inp.files?.[0]; if (f) attachFile(f); inp.value = ""; };
});

/* ── VOICE INPUT ──────────────────────────────── */
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition && micBtn) {
  const rec = new SpeechRecognition();
  rec.lang = "en-IN";
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  let micActive = false;

  micBtn.onclick = () => { micActive ? rec.stop() : rec.start(); };
  rec.onstart = () => { micActive = true;  micBtn.classList.add("mic-active"); };
  rec.onend   = () => { micActive = false; micBtn.classList.remove("mic-active"); };
  rec.onresult = e => { input.value = e.results[0][0].transcript; sendMessage(); };
  rec.onerror = e => {
    console.warn("Mic:", e.error);
    if (e.error === "not-allowed") addAI("⚠️ Mic permission denied.");
  };
} else if (micBtn) {
  micBtn.style.opacity = "0.35";
  micBtn.onclick = () => addAI("⚠️ Voice input requires Chrome on HTTPS.");
}

/* ── EXPORT CHAT (Priority 8) ─────────────────── */
function exportChat(format = "text") {
  const msgs = [];
  box.querySelectorAll(".user-msg, .ai-msg").forEach(el => {
    if (el.classList.contains("thinking-indicator")) return;
    const role = el.classList.contains("user-msg") ? "You" : "CloudAI";
    msgs.push(`${role}: ${el.textContent.trim()}`);
  });

  const content = msgs.join("\n\n---\n\n");
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cloudai-chat-${new Date().toISOString().slice(0,10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── CLEAR CHAT ───────────────────────────────── */
function clearChat() {
  if (!confirm("Clear all chat history?")) return;
  box.innerHTML = "";
  history = [];
  localStorage.removeItem("cloudai_chat");
  localStorage.removeItem("cloudai_history");
}
