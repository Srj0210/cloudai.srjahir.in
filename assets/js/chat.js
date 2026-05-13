// ═══════════════════════════════════════════════════════════════
// CloudAI Chat v25.0 — VIRAL EDITION
// ✅ Web Speech API TTS fallback (unlimited, free)
// ✅ Share conversation feature
// ✅ Copy response button on every AI message
// ✅ Suggestion chips
// ✅ Better voice UX
// by SRJahir Technologies 🔥
// ═══════════════════════════════════════════════════════════════

const API = "https://dawn-smoke-b354.sleepyspider6166.workers.dev";

const box        = document.getElementById("chat-box");
const sendBtn    = document.getElementById("send-btn");
const micBtn     = document.getElementById("mic-btn");
const input      = document.getElementById("user-input");
const pinBtn     = document.getElementById("pin-btn");
const attachMenu = document.getElementById("attachMenu");
const cameraInput= document.getElementById("cameraInput");
const imageInput = document.getElementById("imageInput");
const fileInput  = document.getElementById("fileInput");

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
let ttsEnabled   = localStorage.getItem("cloudai_tts") === "true";
let currentAudio = null;

/* ── SUGGESTION CHIPS ────────────────────────── */
const SUGGESTIONS = [
  { icon: "💡", text: "Explain machine learning in simple terms" },
  { icon: "🐍", text: "Write a Python script to rename files" },
  { icon: "📈", text: "Stock market kya hai, shuru kaise karu?" },
  { icon: "☁️", text: "AWS vs GCP — which should I learn first?" },
  { icon: "🔥", text: "Imagine: a futuristic city at sunset" },
  { icon: "📄", text: "Write a resume summary for a DevOps engineer" },
  { icon: "🇮🇳", text: "India ki economy next 10 years mein kaisi rahegi?" },
  { icon: "💻", text: "Debug this Python error: TypeError" },
];

function showSuggestions() {
  if (box.children.length > 0) return;

  const wrap = document.createElement("div");
  wrap.className = "suggestions-wrap";
  wrap.id = "suggestions";
  wrap.innerHTML = `
    <div class="suggestions-title">What can I help with?</div>
    <div class="chips-grid">
      ${SUGGESTIONS.map(s => `
        <button class="chip" onclick="useChip(this)" data-text="${s.text}">
          <span class="chip-icon">${s.icon}</span>
          <span class="chip-text">${s.text}</span>
        </button>`).join("")}
    </div>`;
  box.appendChild(wrap);
}

function useChip(btn) {
  const text = btn.dataset.text;
  input.value = text;
  document.getElementById("suggestions")?.remove();
  sendMessage();
}

function hideSuggestions() {
  document.getElementById("suggestions")?.remove();
}

/* ── RESTORE CHAT ─────────────────────────────── */
window.addEventListener("DOMContentLoaded", () => {
  const saved = JSON.parse(localStorage.getItem("cloudai_chat") || "[]");
  saved.forEach(m => {
    if (m.role === "user") addUser(m.text, "", false);
    else addAI(m.html, false);
  });
  if (!saved.length) showSuggestions();
  scrollBottom(true);

  // Load shared conversation if ?share= in URL
  const shareId = new URLSearchParams(location.search).get("share");
  if (shareId) loadSharedChat(shareId);

  // TTS toggle button
  updateTTSButton();
});

function saveChat() {
  const msgs = [];
  box.querySelectorAll(".user-msg, .ai-msg").forEach(el => {
    if (el.classList.contains("thinking-indicator")) return;
    if (el.classList.contains("user-msg")) msgs.push({ role: "user", text: el.textContent });
    else msgs.push({ role: "ai", html: el.innerHTML });
  });
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
  hideSuggestions();
  const div = document.createElement("div");
  div.className = "user-msg";
  if (previewHTML)
    div.innerHTML = DOMPurify.sanitize(previewHTML) +
      (text ? `<div style="margin-top:6px">${escapeHtml(text)}</div>` : "");
  else div.textContent = text;
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
  addAIActions(div);
  if (window.Prism) Prism.highlightAll();
  scrollBottom(true);
}

/* ── AI ACTIONS (copy + TTS + share) ─────────── */
function addAIActions(div) {
  if (div.classList.contains("thinking-indicator")) return;
  if (div.querySelector(".ai-actions")) return;

  const actions = document.createElement("div");
  actions.className = "ai-actions";

  // Copy button
  const copyBtn = document.createElement("button");
  copyBtn.className = "action-btn";
  copyBtn.innerHTML = "📋 Copy";
  copyBtn.onclick = () => {
    const text = div.innerText.replace("📋 Copy🔊 Speak🔗 Share", "").trim();
    navigator.clipboard.writeText(text);
    copyBtn.innerHTML = "✅ Copied!";
    setTimeout(() => copyBtn.innerHTML = "📋 Copy", 1500);
  };

  // TTS Speak button
  const speakBtn = document.createElement("button");
  speakBtn.className = "action-btn";
  speakBtn.innerHTML = "🔊 Speak";
  speakBtn.onclick = () => speakText(div, speakBtn);

  // Share button
  const shareBtn = document.createElement("button");
  shareBtn.className = "action-btn share-btn";
  shareBtn.innerHTML = "🔗 Share";
  shareBtn.onclick = () => shareConversation();

  actions.appendChild(copyBtn);
  actions.appendChild(speakBtn);
  actions.appendChild(shareBtn);
  div.appendChild(actions);
}

/* ── COPY BUTTON IN CODE BLOCKS ──────────────── */
function enhanceCodeBlocks(container) {
  container.querySelectorAll("pre code").forEach(block => {
    if (block.parentElement.querySelector(".copy-btn")) return;
    const cls = [...block.classList].find(c => c.startsWith("language-"));
    if (cls) block.parentElement.setAttribute("data-language", cls.replace("language-", ""));
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

/* ── TTS — ElevenLabs + Web Speech fallback ─── */
async function speakText(div, btn) {
  // Stop any current speech
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  window.speechSynthesis?.cancel();

  const rawText = div.innerText
    .replace(/📋 Copy🔊 Speak🔗 Share/g, "")
    .replace(/⚡ CloudAI Engine/g, "")
    .replace(/Copy|Copied ✓/g, "")
    .trim()
    .slice(0, 2500);

  if (!rawText) return;
  btn.innerHTML = "⏹ Stop";
  btn.onclick = () => {
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    window.speechSynthesis?.cancel();
    btn.innerHTML = "🔊 Speak";
    btn.onclick = () => speakText(div, btn);
  };

  // Try ElevenLabs first
  try {
    const res = await fetch(`${API}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: rawText }),
    });

    if (res.ok) {
      const data = await res.json().catch(() => null);
      // If fallback signal received, use Web Speech
      if (data?.fallback) {
        useWebSpeech(rawText, btn);
        return;
      }
    }

    if (!res.ok) throw new Error("TTS unavailable");

    const blob = await res.blob();
    if (blob.size < 100) throw new Error("Empty audio");

    const url  = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudio = audio;
    audio.play();
    audio.onended = () => {
      btn.innerHTML = "🔊 Speak";
      btn.onclick = () => speakText(div, btn);
      currentAudio = null;
    };
    return;
  } catch {}

  // Fallback: Web Speech API (unlimited, free)
  useWebSpeech(rawText, btn);
}

function useWebSpeech(text, btn) {
  if (!window.speechSynthesis) {
    showAlert("Speech not supported in this browser");
    btn.innerHTML = "🔊 Speak";
    return;
  }
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang  = "en-IN";
  utt.rate  = 0.95;
  utt.pitch = 1.0;

  // Prefer Indian English voice if available
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v => v.lang.includes("en-IN")) ||
                    voices.find(v => v.lang.startsWith("en"));
  if (preferred) utt.voice = preferred;

  utt.onend = () => {
    btn.innerHTML = "🔊 Speak";
    btn.onclick = () => speakText(btn.closest(".ai-msg"), btn);
  };
  window.speechSynthesis.speak(utt);
}

/* ── TTS TOGGLE ───────────────────────────────── */
function updateTTSButton() {
  const ttsBtn = document.getElementById("tts-toggle");
  if (!ttsBtn) return;
  ttsBtn.innerHTML = ttsEnabled ? "🔊 Voice On" : "🔇 Voice Off";
  ttsBtn.className = ttsEnabled ? "tts-btn active" : "tts-btn";
}

/* ── SHARE CONVERSATION ───────────────────────── */
async function shareConversation() {
  const msgs = [];
  box.querySelectorAll(".user-msg, .ai-msg").forEach(el => {
    if (el.classList.contains("thinking-indicator")) return;
    if (el.classList.contains("user-msg")) {
      msgs.push({ role: "user", text: el.textContent.trim() });
    } else {
      const text = el.innerText
        .replace(/📋 Copy🔊 Speak🔗 Share/g, "")
        .replace(/⚡ CloudAI Engine/g, "")
        .trim();
      msgs.push({ role: "ai", text });
    }
  });

  if (!msgs.length) { showAlert("Nothing to share yet!"); return; }

  showAlert("Creating share link...", "#0070f3");

  try {
    const res  = await fetch(`${API}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: msgs, title: "CloudAI Chat" }),
    });
    const data = await res.json();

    if (data.url) {
      // Copy to clipboard
      navigator.clipboard.writeText(data.url);
      showShareModal(data.url);
    } else {
      // Fallback: copy text
      const text = msgs.map(m => `${m.role === "user" ? "You" : "CloudAI"}: ${m.text}`).join("\n\n");
      navigator.clipboard.writeText(text);
      showAlert("Chat copied to clipboard!", "#22c55e");
    }
  } catch {
    // Offline fallback
    const text = msgs.map(m => `${m.role === "user" ? "You" : "CloudAI"}: ${m.text}`).join("\n\n---\n\n");
    navigator.clipboard.writeText(text);
    showAlert("Chat copied to clipboard!", "#22c55e");
  }
}

function showShareModal(url) {
  const existing = document.getElementById("share-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "share-modal";
  modal.className = "share-modal";
  modal.innerHTML = `
    <div class="share-modal-inner">
      <button class="share-close" onclick="document.getElementById('share-modal').remove()">✕</button>
      <div class="share-icon">🔗</div>
      <h3>Share Link Ready!</h3>
      <p>Link copied to clipboard</p>
      <input class="share-url" value="${url}" readonly onclick="this.select()" />
      <div class="share-btns">
        <a href="https://twitter.com/intent/tweet?text=Check+this+CloudAI+conversation!&url=${encodeURIComponent(url)}" 
           target="_blank" class="share-twitter">𝕏 Share on X</a>
        <a href="https://wa.me/?text=${encodeURIComponent('Check this CloudAI conversation! ' + url)}" 
           target="_blank" class="share-wa">💬 WhatsApp</a>
      </div>
      <p class="share-note">Link expires in 30 days</p>
    </div>`;
  document.body.appendChild(modal);
}

async function loadSharedChat(shareId) {
  try {
    const res  = await fetch(`${API}/share?id=${shareId}`);
    const data = await res.json();
    if (!data.messages) return;

    box.innerHTML = "";
    history = [];

    const banner = document.createElement("div");
    banner.className = "shared-banner";
    banner.innerHTML = `<span>🔗 Shared conversation from CloudAI</span> <a href="/">Start your own →</a>`;
    box.appendChild(banner);

    data.messages.forEach(m => {
      if (m.role === "user") addUser(m.text, "", false);
      else addAI(renderMarkdown(m.text), false);
    });
    scrollBottom(true);
  } catch {}
}

/* ── ALERT ────────────────────────────────────── */
function showAlert(msg, color = "#F57F17") {
  const existing = document.getElementById("cloudai-alert");
  if (existing) existing.remove();
  const el = document.createElement("div");
  el.id = "cloudai-alert";
  el.className = "cloudai-alert";
  el.style.background = color;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
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
  const icon = file.type.includes("pdf") ? "📄" : file.type.includes("audio") ? "🎵" : "📎";
  return `<div class="file-chip">${icon} ${escapeHtml(file.name)} <span class="file-size">(${(file.size/1024).toFixed(1)} KB)</span></div>`;
}

async function attachFile(file) {
  if (file.size > 10 * 1024 * 1024) { showAlert("File too large. Max 10MB."); return; }
  const preview = await getFilePreview(file);
  pendingFile = { file, previewHTML: preview };

  let bar = document.getElementById("file-preview-bar");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "file-preview-bar";
    bar.className = "file-preview-bar";
    document.body.appendChild(bar);
  }
  bar.innerHTML = DOMPurify.sanitize(preview) +
    `<span class="file-bar-name">${escapeHtml(file.name)}</span>` +
    `<button id="remove-file" class="file-bar-remove">✕</button>`;
  document.getElementById("remove-file").onclick = () => { pendingFile = null; bar.remove(); };
}

/* ── IMAGE GENERATION ─────────────────────────── */
function isImageGenRequest(text) {
  return /^(generate|imagine|create|draw|make|design)\s+(an?\s+)?(image|picture|photo|art|illustration|poster|logo)/i.test(text) ||
         /^(imagine|draw|paint):/i.test(text);
}

async function generateImage(prompt) {
  hideSuggestions();
  const div = document.createElement("div");
  div.className = "ai-msg";
  div.innerHTML = `<div class="img-gen-loading">🎨 Generating: "${escapeHtml(prompt)}"...</div>`;
  box.appendChild(div);
  scrollBottom(true);

  try {
    const res = await fetch(`${API}/imagine`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) throw new Error("Failed");
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    div.innerHTML = `<div class="generated-image-wrap">
      <img src="${url}" class="generated-image" alt="${escapeHtml(prompt)}">
      <div class="img-gen-caption">🎨 "${escapeHtml(prompt)}"</div>
      <div class="img-actions">
        <button class="download-btn" onclick="downloadImage('${url}')">⬇ Download</button>
        <button class="action-btn share-btn" onclick="shareConversation()">🔗 Share</button>
      </div>
    </div>`;
    history.push({ role: "model", text: `[Generated image: ${prompt}]` });
    saveChat();
  } catch {
    div.innerHTML = `<strong>⚠️ Image gen failed — model loading. Try again in 30s.</strong>`;
  }
}

function downloadImage(url) {
  const a = document.createElement("a");
  a.href = url; a.download = "cloudai-image.png"; a.click();
}

/* ── SEND MESSAGE ─────────────────────────────── */
async function sendMessage() {
  const msg = input.value.trim();
  if ((!msg && !pendingFile) || isProcessing) return;

  isProcessing = true;
  input.value  = "";
  input.style.height = "auto";

  addUser(msg, pendingFile?.previewHTML || "");

  const bar = document.getElementById("file-preview-bar");
  if (bar) bar.remove();

  const fileToSend = pendingFile?.file || null;
  pendingFile = null;

  history.push({ role: "user", text: msg || "[file attached]" });
  if (history.length > 40) history = history.slice(-40);

  // Image generation
  if (msg && isImageGenRequest(msg) && !fileToSend) {
    isProcessing = false;
    const imgPrompt = msg.replace(/^(generate|imagine|create|draw|make|design)\s+(an?\s+)?(image|picture|photo|art|illustration|poster|logo)\s*(of|:)?\s*/i, "").trim() || msg;
    return generateImage(imgPrompt);
  }

  document.body.classList.add("ai-thinking");

  const thinking = document.createElement("div");
  thinking.className = "ai-msg thinking-indicator";
  thinking.innerHTML = `<span class="dot"></span><span class="dot"></span><span class="dot"></span>`;
  box.appendChild(thinking);
  scrollBottom(true);

  try {
    if (fileToSend) {
      // Non-streaming for files
      const b64 = await fileToBase64(fileToSend);
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: msg || "Analyze this file.",
          history, clientId,
          fileBase64: b64,
          fileType: fileToSend.type,
          fileName: fileToSend.name,
        }),
      });
      const data = await res.json();
      thinking.remove();
      const reply = data.reply || "No response";
      addAI(renderMarkdown(reply));
      history.push({ role: "model", text: reply });
      addModelBadge();
      if (ttsEnabled) autoSpeak(reply);
    } else {
      // Streaming
      const res = await fetch(`${API}/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: msg, history, clientId }),
      });

      if (!res.ok || !res.headers.get("content-type")?.includes("text/event-stream")) {
        const data = await res.json();
        thinking.remove();
        const reply = data.reply || "No response";
        addAI(renderMarkdown(reply));
        history.push({ role: "model", text: reply });
        addModelBadge();
        if (ttsEnabled) autoSpeak(reply);
      } else {
        thinking.remove();
        const aiDiv = document.createElement("div");
        aiDiv.className = "ai-msg streaming";
        box.appendChild(aiDiv);

        const reader  = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullReply = "";

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
            } catch {}
          }
        }

        aiDiv.classList.remove("streaming");
        afterAI(aiDiv);
        history.push({ role: "model", text: fullReply });
        addModelBadge();
        if (ttsEnabled) autoSpeak(fullReply);
      }
    }
    saveChat();
  } catch (err) {
    thinking.remove();
    addAI("⚠️ Network error. Please check your connection and try again.");
  } finally {
    isProcessing = false;
    document.body.classList.remove("ai-thinking");
  }
}

function autoSpeak(text) {
  const clean = text.replace(/[#*`_~\[\]()]/g, "").trim().slice(0, 1000);
  useWebSpeech(clean, document.createElement("button"));
}

/* ── MODEL BADGE ──────────────────────────────── */
function addModelBadge() {
  const last = box.querySelector(".ai-msg:last-child");
  if (!last || last.querySelector(".model-badge")) return;
  const badge = document.createElement("span");
  badge.className = "model-badge";
  badge.textContent = "⚡ CloudAI Engine";
  last.appendChild(badge);
}

/* ── SCROLL ───────────────────────────────────── */
function scrollBottom(force = false) {
  requestAnimationFrame(() => {
    if (force) {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    }
    box.scrollTop = box.scrollHeight;
  });
}

/* ── AUTO-RESIZE INPUT ────────────────────────── */
input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 140) + "px";
});

/* ── EVENTS ───────────────────────────────────── */
sendBtn.onclick = sendMessage;
input.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

/* ── ATTACH ───────────────────────────────────── */
pinBtn.onclick = () => {
  attachMenu.style.display = attachMenu.style.display === "flex" ? "none" : "flex";
};
document.addEventListener("click", e => {
  if (!e.target.closest(".input-inner")) attachMenu.style.display = "none";
});
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
  let micActive = false;

  micBtn.onclick = () => { micActive ? rec.stop() : rec.start(); };
  rec.onstart = () => { micActive = true;  micBtn.classList.add("mic-active"); };
  rec.onend   = () => { micActive = false; micBtn.classList.remove("mic-active"); };
  rec.onresult = e => { input.value = e.results[0][0].transcript; sendMessage(); };
  rec.onerror  = e => {
    if (e.error === "not-allowed") showAlert("Mic permission denied");
  };
} else if (micBtn) {
  micBtn.style.opacity = "0.35";
  micBtn.title = "Voice requires Chrome on HTTPS";
}

/* ── CLEAR CHAT ───────────────────────────────── */
function clearChat() {
  if (!confirm("Clear chat history?")) return;
  box.innerHTML = "";
  history = [];
  localStorage.removeItem("cloudai_chat");
  localStorage.removeItem("cloudai_history");
  showSuggestions();
}

/* ── EXPORT CHAT ──────────────────────────────── */
function exportChat() {
  const msgs = [];
  box.querySelectorAll(".user-msg, .ai-msg").forEach(el => {
    if (el.classList.contains("thinking-indicator")) return;
    const role = el.classList.contains("user-msg") ? "You" : "CloudAI";
    const text = el.innerText.replace(/📋 Copy🔊 Speak🔗 Share/g, "").replace(/⚡ CloudAI Engine/g, "").trim();
    msgs.push(`${role}: ${text}`);
  });
  const blob = new Blob([msgs.join("\n\n---\n\n")], { type: "text/plain" });
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(blob),
    download: `cloudai-${new Date().toISOString().slice(0,10)}.txt`,
  });
  a.click();
}
