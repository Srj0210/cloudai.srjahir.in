const CLOUDAI_VERSION = "v27-FIXED-20260517";
console.log("CloudAI Chat loaded:", CLOUDAI_VERSION);

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
let ttsEnabled   = localStorage.getItem("cloudai_tts") !== "false"; // ON by default
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

  // ── COPY ──────────────────────────────────────────────────
  const copyBtn = document.createElement("button");
  copyBtn.className = "action-btn";
  copyBtn.innerHTML = "📋 Copy";
  copyBtn.onclick = () => {
    const text = cleanForSpeech(div.innerHTML)
      .replace(/📋 Copy|🔊 Speak|⏹ Stop|🔗 Share|⚡ CloudAI Engine/g, "")
      .trim();
    navigator.clipboard.writeText(text);
    copyBtn.innerHTML = "✅ Copied!";
    setTimeout(() => copyBtn.innerHTML = "📋 Copy", 1500);
  };

  // ── SPEAK (toggle on/off) ─────────────────────────────────
  const speakBtn = document.createElement("button");
  speakBtn.className = "action-btn";
  speakBtn.innerHTML = "🔊 Speak";
  let isSpeaking = false;
  speakBtn.onclick = () => {
    if (isSpeaking) {
      window.speechSynthesis?.cancel();
      if (window.currentAudio) { window.currentAudio.pause(); window.currentAudio = null; }
      isSpeaking = false;
      speakBtn.innerHTML = "🔊 Speak";
      const logo = document.getElementById("logoImg");
      if (logo) logo.classList.remove("speaking");
    } else {
      isSpeaking = true;
      speakText(div, speakBtn);
    }
  };

  // ── SHARE ─────────────────────────────────────────────────
  const shareBtn = document.createElement("button");
  shareBtn.className = "action-btn share-btn";
  shareBtn.innerHTML = "🔗 Share";
  shareBtn.onclick = () => shareConversation();

  // ── SPEED SLIDER (right after speak button) ───────────────
  const spd = parseFloat(localStorage.getItem("cloudai_tts_speed") || "1.05");
  const speedWrap = document.createElement("div");
  speedWrap.className = "inline-tts-controls";
  speedWrap.innerHTML =
    `<span class="spd-label">🐢</span>` +
    `<input type="range" class="inline-speed" min="0.7" max="1.8" step="0.1" value="${spd}"
      title="${spd.toFixed(1)}x"
      oninput="window.ttsCurrentSpeed=parseFloat(this.value);localStorage.setItem('cloudai_tts_speed',this.value);this.title=parseFloat(this.value).toFixed(1)+'x'" />` +
    `<span class="spd-label">🐇</span>`;

  actions.appendChild(copyBtn);
  actions.appendChild(speakBtn);
  actions.appendChild(shareBtn);
  actions.appendChild(speedWrap);
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

  const rawText = cleanForSpeech(div.innerHTML)
    .replace(/📋 Copy|🔊 Speak|🔗 Share|⚡ CloudAI Engine|Copy|Copied ✓/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 2000);

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

// ── Clean text for speech — remove ALL markdown/code/symbols ──
function cleanForSpeech(html) {
  return html
    .replace(/<pre[\s\S]*?<\/pre>/gi, "")       // remove entire code blocks
    .replace(/<code[\s\S]*?<\/code>/gi, "")      // inline code
    .replace(/<[^>]+>/g, " ")                       // all HTML tags
    .replace(/={2,}/g, "")                          // === ==
    .replace(/#{1,6}\s*/g, "")                     // ## headers
    .replace(/\*{1,3}/g, "")                       // bold/italic **
    .replace(/`{1,3}/g, "")                         // backticks
    .replace(/_{2,}/g, "")                          // __underline__
    .replace(/~{2}/g, "")                           // ~~strikethrough~~
    .replace(/\[|\]/g, "")                        // brackets
    .replace(/\|/g, ", ")                          // table pipes
    .replace(/\\n/g, " ")                         // escaped newlines
    .replace(/https?:\/\/\S+/g, "")              // URLs
    .replace(/[<>{}\\]/g, "")                     // special chars
    .replace(/[-•*]\s/g, "")                       // bullet points
    .replace(/\d+\.\s/g, "")                     // numbered lists
    .replace(/\s{2,}/g, " ")                       // multiple spaces
    .trim();
}

function useWebSpeech(text, btn) {
  if (!window.speechSynthesis) {
    if (btn) btn.innerHTML = "🔊 Speak";
    return;
  }
  window.speechSynthesis.cancel();

  const clean = typeof text === "string" ? text : cleanForSpeech(text);
  if (!clean.trim()) return;

  const utt = new SpeechSynthesisUtterance(clean);
  utt.rate  = window.ttsCurrentSpeed || 1.05;
  utt.pitch = 1.05;

  // ── Best Indian female voice selection ─────────────────────
  const getVoice = () => {
    const voices = window.speechSynthesis.getVoices();
    return voices.find(v => v.lang === "en-IN" && /female|woman|zira|heera|priya/i.test(v.name)) ||
           voices.find(v => v.lang === "en-IN") ||
           voices.find(v => v.lang === "hi-IN" && /female|woman/i.test(v.name)) ||
           voices.find(v => v.name.includes("Google") && v.lang.startsWith("en")) ||
           voices.find(v => v.lang.startsWith("en-")) ||
           null;
  };

  const voice = getVoice();
  if (voice) { utt.voice = voice; utt.lang = voice.lang; }
  else utt.lang = "en-IN";

  const logo = document.getElementById("logoImg");
  utt.onstart = () => {
    if (logo) logo.classList.add("speaking");
    if (btn) { btn.innerHTML = "⏹ Stop"; btn.onclick = () => { window.speechSynthesis.cancel(); }; }
  };
  utt.onend = utt.onerror = () => {
    if (logo) logo.classList.remove("speaking");
    if (btn) {
      btn.innerHTML = "🔊 Speak";
      btn.onclick = () => speakText(btn.closest(".ai-msg"), btn);
    }
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
  
  // Extract file content client-side — AI reads REAL content!
  let extractedText = "";
  const isExtractable = !file.type.startsWith("image/");
  if (isExtractable) {
    try {
      const label = file.name.endsWith(".pdf") ? "📄 Reading PDF..."
                  : file.name.endsWith(".docx") ? "📝 Reading DOCX..."
                  : "📎 Reading file...";
      showAlert(label, "#0070f3");
      extractedText = await extractFileText(file);
      if (extractedText) showAlert("✅ File read successfully!", "#22c55e");
    } catch (e) {
      console.warn("File extraction failed:", e);
    }
  }
  
  pendingFile = { file, previewHTML: preview, extractedText };

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
  const t = text.trim().toLowerCase();

  // Explicit image keywords
  if (/^(imagine|draw|paint|sketch|dall.e):/i.test(t)) return true;
  if (/^(genrat|genrate|generate|creat|create|make|draw|imagin|imagine|design)e?\s+(a\s+|an\s+)?(image|img|picture|pic|photo|art|illustration|poster|logo|painting|wallpaper|avatar)/i.test(t)) return true;
  if (/^(image|picture|photo|art|illustration)\s+(of|for|showing)\s+/i.test(t)) return true;

  // "generate image" or "create image" standalone → use prev context
  if (/^(genrat|genrate|generate|creat|create)e?\s+image\s*$/i.test(t)) return "use_context";

  // "generate a [visual noun]" — no image keyword needed
  if (/^(genrat|genrate|generate|creat|create|draw|make|imagin|imagine)e?\s+(a\s+|an\s+)[a-z]/i.test(t)) {
    // Skip if clearly text/code request
    const isText = /essay|poem|story|code|script|email|letter|plan|list|summary|report|article|blog|caption|speech|function|class|program/i.test(t);
    if (!isText) return true;
  }
  return false;
}

async function generateImage(prompt) {
  hideSuggestions();
  const div = document.createElement("div");
  div.className = "ai-msg";
  div.innerHTML = `<div class="img-gen-loading">🎨 Generating image...</div>`;
  box.appendChild(div);
  scrollBottom(true);

  // Pollinations.ai — FREE, no API key, instant, reliable!
  const seed   = Math.floor(Math.random() * 9999);
  const imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&enhance=true&seed=${seed}`;

  const img = new Image();
  img.onload = () => {
    div.innerHTML = `<div class="generated-image-wrap">
      <img src="${imgUrl}" class="generated-image" alt="${escapeHtml(prompt)}" />
      <div class="img-gen-caption">🎨 "${escapeHtml(prompt)}"</div>
      <div class="img-actions">
        <button class="download-btn" onclick="downloadPollinationsImg('${imgUrl}', '${encodeURIComponent(prompt)}')">⬇ Download</button>
        <button class="action-btn share-btn" onclick="shareConversation()">🔗 Share</button>
      </div>
    </div>`;
    afterAI(div);
    history.push({ role: "model", text: `[Generated image: ${prompt}]` });
    saveChat();
    scrollBottom(true);
  };
  img.onerror = () => {
    div.innerHTML = `<p>⚠️ Image gen failed. Try: "Imagine: a sunset over mountains"</p>`;
  };
  img.src = imgUrl;
}

async function downloadPollinationsImg(url, encodedPrompt) {
  try {
    const r = await fetch(url);
    const blob = await r.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `cloudai-${decodeURIComponent(encodedPrompt).slice(0,30)}.png`;
    a.click();
  } catch {
    window.open(url, "_blank");
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

  const fileToSend    = pendingFile?.file || null;
  const pendingFileText = pendingFile?.extractedText || null;
  pendingFile = null;

  history.push({ role: "user", text: msg || "[file attached]" });
  if (history.length > 40) history = history.slice(-40);

  // Image generation detection
  const imgCheck = msg ? isImageGenRequest(msg) : false;
  if (imgCheck && !fileToSend) {
    isProcessing = false;
    if (imgCheck === "use_context") {
      // Get context from last AI message
      const lastAI = [...box.querySelectorAll(".ai-msg:not(.thinking-indicator)")].slice(-1)[0];
      const context = lastAI
        ? lastAI.innerText.replace(/📋 Copy|🔊 Speak|🔗 Share|⚡ CloudAI Engine/g,"").trim().slice(0,200)
        : "abstract digital art";
      return generateImage(context);
    }
    const imgPrompt = msg
      .replace(/^(genrat|genrate|generate|creat|create|make|draw|imagin|imagine|design)e?\s+(a\s+|an\s+)?(image|img|picture|pic|photo|art|illustration|poster|logo|painting|wallpaper)\s*(of|:)?\s*/i, "")
      .trim() || msg;
    return generateImage(imgPrompt || msg);
  }

  // Inject PDF context into follow-up messages automatically
  let effectiveMsg = msg;
  if (pdfContext && !fileToSend && msg) {
    const isPdfRelated = msg.length < 200; // short follow-up questions
    if (isPdfRelated) {
      effectiveMsg = `[Context from uploaded file: "${pdfContext.fileName}"]\n${pdfContext.text.slice(0, 4000)}\n\nUser question: ${msg}`;
    }
  }

  document.body.classList.add("ai-thinking");

  const thinking = document.createElement("div");
  thinking.className = "ai-msg thinking-indicator";
  thinking.innerHTML = `<span class="dot"></span><span class="dot"></span><span class="dot"></span>`;
  box.appendChild(thinking);
  scrollBottom(true);

  try {
    if (fileToSend) {
      // Smart file routing — PDF to Gemini, images to vision
      const ftype  = fileToSend.type || "";
      const fname  = (fileToSend.name || "").toLowerCase();
      const isPDF  = ftype === "application/pdf" || fname.endsWith(".pdf");
      const isImg  = ftype.startsWith("image/");

      const b64 = await fileToBase64(fileToSend);

      const filePrompt = isPDF
        ? (msg || "Read this ENTIRE PDF carefully. Extract ALL real information — name, contact, skills, experience, education, projects. Do NOT invent any data.")
        : isImg
        ? (msg || "Analyze this image in complete detail.")
        : (msg || "Analyze this file thoroughly.");

      if (isPDF) pdfContext = { fileName: fileToSend.name, text: "[PDF uploaded]" };

      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: filePrompt,
          history, clientId,
          fileBase64: b64,
          fileType: ftype,
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
        body: JSON.stringify({ prompt: effectiveMsg || msg, history, clientId }),
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
        if (!fullReply.trim()) {
          // Empty stream — remove blank div, show error
          aiDiv.remove();
          thinking.remove();
          addAI("⚠️ No response received. Please try again.");
        } else {
          afterAI(aiDiv);
          history.push({ role: "model", text: fullReply });
          addModelBadge();
          if (ttsEnabled) autoSpeak(fullReply);
        }
      }
    }
    saveChat();
  } catch (err) {
    thinking.remove();
    addAI("⚠️ Connection error. Please try again.");
  } finally {
    isProcessing = false;
    document.body.classList.remove("ai-thinking");
  }
}

function autoSpeak(text) {
  // Use full cleanForSpeech — removes code, ===, ##, **, | etc
  const clean = cleanForSpeech(text).slice(0, 1500);
  if (clean.trim()) useWebSpeech(clean, null);
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
/* ── FILE TEXT EXTRACTION (Real parsing — no hallucination) ─── */

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function extractPDFText(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        if (!window.pdfjsLib) {
          await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js");
          window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        }
        const arr = new Uint8Array(e.target.result);
        const pdf = await window.pdfjsLib.getDocument({ data: arr }).promise;
        let text = `[PDF: ${file.name} | ${pdf.numPages} pages]

`;
        const maxPages = Math.min(pdf.numPages, 15);
        for (let i = 1; i <= maxPages; i++) {
          const page    = await pdf.getPage(i);
          const content = await page.getTextContent();
          const pg = content.items.map(s => s.str).join(" ").trim();
          if (pg) text += `--- Page ${i} ---
${pg}

`;
        }
        resolve(text.trim().slice(0, 10000));
      } catch(err) {
        console.warn("PDF.js failed:", err);
        resolve("");
      }
    };
    reader.onerror = () => resolve("");
    reader.readAsArrayBuffer(file);
  });
}

async function extractDOCXText(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        if (!window.mammoth) {
          await loadScript("https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js");
        }
        const result = await window.mammoth.extractRawText({ arrayBuffer: e.target.result });
        resolve(`[DOCX: ${file.name}]

${result.value.slice(0, 10000)}`);
      } catch(err) {
        console.warn("Mammoth failed:", err);
        resolve("");
      }
    };
    reader.onerror = () => resolve("");
    reader.readAsArrayBuffer(file);
  });
}

async function extractTextFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(`[${file.name}]

${e.target.result.slice(0, 10000)}`);
    reader.onerror = () => resolve("");
    reader.readAsText(file, "utf-8");
  });
}

async function extractFileText(file) {
  const name = (file.name || "").toLowerCase();
  const type = (file.type || "").toLowerCase();
  if (type === "application/pdf" || name.endsWith(".pdf"))
    return await extractPDFText(file);
  if (type.includes("wordprocessingml") || name.endsWith(".docx"))
    return await extractDOCXText(file);
  if (type.startsWith("text/") || name.match(/\.(txt|csv|md|json|js|py|ts|html|css|xml|yaml|yml|sh|sql)$/))
    return await extractTextFile(file);
  return "";
}

sendBtn.onclick = sendMessage;
// Enter = new line always (mobile-friendly)
// Ctrl+Enter or Cmd+Enter = send (power user shortcut)
input.addEventListener("keydown", e => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    sendMessage();
  }
  // Plain Enter = new line (default textarea behavior)
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
