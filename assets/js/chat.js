// ===================================================
// CloudAI Chat v17.1 — All review fixes applied
// marked.js + DOMPurify + history cap + voice fix
// by SRJahir Technologies 🔥
// ===================================================

const API = "https://dawn-smoke-b354.sleepyspider6166.workers.dev/";

const box         = document.getElementById("chat-box");
const sendBtn     = document.getElementById("send-btn");
const micBtn      = document.getElementById("mic-btn");
const input       = document.getElementById("user-input");
const pinBtn      = document.getElementById("pin-btn");
const attachMenu  = document.getElementById("attachMenu");
const cameraInput = document.getElementById("cameraInput");
const imageInput  = document.getElementById("imageInput");
const fileInput   = document.getElementById("fileInput");

/* ===============================
   SESSION
   =============================== */
const clientId =
  localStorage.getItem("cloudai_client") ||
  (() => {
    const id = "web_" + Math.random().toString(36).slice(2, 9);
    localStorage.setItem("cloudai_client", id);
    return id;
  })();

let history      = [];
let isProcessing = false;
let pendingFile  = null;

/* ===============================
   MARKDOWN — marked.js + DOMPurify
   FIX: replaces fragile custom renderer + closes XSS
   =============================== */
function renderMarkdown(text) {
  if (!text) return "";
  // Configure marked for safe output
  marked.setOptions({ breaks: true, gfm: true });
  // DOMPurify strips any injected scripts/HTML from AI reply
  return DOMPurify.sanitize(marked.parse(text));
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

/* ===============================
   USER MESSAGE
   =============================== */
function addUser(text, previewHTML = "") {
  const div = document.createElement("div");
  div.className = "user-msg";
  if (previewHTML)
    div.innerHTML =
      DOMPurify.sanitize(previewHTML) +
      (text ? `<div style="margin-top:6px">${escapeHtml(text)}</div>` : "");
  else
    div.textContent = text;
  box.appendChild(div);
  scrollBottom(true);
}

/* ===============================
   AI MESSAGE
   =============================== */
function addAI(html) {
  const div = document.createElement("div");
  div.className = "ai-msg";
  box.appendChild(div);
  if (typeof typeHTML === "function") {
    typeHTML(div, html, () => afterAI(div));
  } else {
    div.innerHTML = html;
    afterAI(div);
  }
}

function afterAI(div) {
  enhanceCodeBlocks(div);
  if (window.Prism) Prism.highlightAll();
  scrollBottom(true);
}

/* ===============================
   COPY BUTTON
   =============================== */
function enhanceCodeBlocks(container) {
  container.querySelectorAll("pre code").forEach(block => {
    // Avoid adding duplicate copy buttons
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

/* ===============================
   ALERT (single instance guard)
   FIX: won't stack infinite alerts
   =============================== */
function showAlert(msg, color = "#F57F17") {
  if (document.getElementById("cloudai-alert")) return; // already showing
  const el = document.createElement("div");
  el.id = "cloudai-alert";
  el.className = "cloudai-alert";
  el.style.background = color;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

/* ===============================
   FILE → BASE64 (no stack overflow)
   =============================== */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ===============================
   FILE PREVIEW
   =============================== */
async function getFilePreview(file) {
  if (file.type.startsWith("image/")) {
    return new Promise(res => {
      const r = new FileReader();
      r.onload = () =>
        res(`<img src="${r.result}" class="file-preview-img">`);
      r.readAsDataURL(file);
    });
  }
  const icon =
    file.type.includes("pdf")   ? "📄" :
    file.type.includes("audio") ? "🎵" :
    file.type.includes("video") ? "🎬" : "📎";
  return `<div class="file-chip">${icon} ${escapeHtml(file.name)} <span class="file-size">(${(file.size/1024).toFixed(1)} KB)</span></div>`;
}

/* ===============================
   ATTACH FILE
   =============================== */
async function attachFile(file) {
  const MAX_MB = 10;
  if (file.size > MAX_MB * 1024 * 1024) {
    addAI(`⚠️ File too large. Max ${MAX_MB}MB allowed.`);
    return;
  }
  const preview = await getFilePreview(file);
  pendingFile = { file, previewHTML: preview };

  let bar = document.getElementById("file-preview-bar");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "file-preview-bar";
    bar.className = "file-preview-bar";
    document.body.appendChild(bar);
  }
  bar.innerHTML =
    DOMPurify.sanitize(preview) +
    `<span class="file-bar-name">${escapeHtml(file.name)}</span>` +
    `<button id="remove-file" class="file-bar-remove">✕</button>`;
  document.getElementById("remove-file").onclick = () => {
    pendingFile = null;
    bar.remove();
  };
}

/* ===============================
   SEND MESSAGE
   =============================== */
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

  // FIX: cap history at 40 entries (20 exchanges) to avoid huge payloads
  history.push({ role: "user", text: msg || "[file attached]" });
  if (history.length > 40) history = history.slice(-40);

  document.body.classList.add("ai-thinking");

  // Thinking dots
  const thinking = document.createElement("div");
  thinking.className = "ai-msg thinking-indicator";
  thinking.innerHTML = `<span class="dot"></span><span class="dot"></span><span class="dot"></span>`;
  box.appendChild(thinking);
  scrollBottom(true);

  try {
    let body;
    if (fileToSend) {
      const b64 = await fileToBase64(fileToSend);
      body = JSON.stringify({
        prompt:     msg || "Please analyze this file.",
        history,
        clientId,
        fileBase64: b64,
        fileType:   fileToSend.type,
        fileName:   fileToSend.name,
      });
    } else {
      body = JSON.stringify({ prompt: msg, history, clientId });
    }

    const res  = await fetch(API, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const data = await res.json();
    thinking.remove();

    if (data.error) {
      addAI(`<strong>⚠️ ${escapeHtml(data.error)}</strong>`);
    } else {
      const reply = data.reply || "No response";
      addAI(renderMarkdown(reply));
      history.push({ role: "model", text: reply });
      if (history.length > 40) history = history.slice(-40);
    }

    if (data.quotaStatus === "quota_warning")
      showAlert("⚠️ Approaching daily quota limit (80%+).");

  } catch (err) {
    thinking.remove();
    addAI("⚠️ Network error. Please try again.");
    console.error(err);
  } finally {
    isProcessing = false;
    document.body.classList.remove("ai-thinking");
  }
}

/* ===============================
   SCROLL
   =============================== */
function scrollBottom(force = false) {
  requestAnimationFrame(() => {
    if (force && box.lastElementChild)
      box.lastElementChild.scrollIntoView({ behavior: "smooth", block: "end" });
    box.scrollTop = box.scrollHeight;
  });
}

/* ===============================
   EVENTS
   =============================== */
sendBtn.onclick = sendMessage;
input.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

/* ===============================
   ATTACH MENU
   =============================== */
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
  inp.onchange = () => {
    const f = inp.files?.[0];
    if (f) attachFile(f);
    inp.value = "";
  };
});

/* ===============================
   VOICE INPUT
   =============================== */
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition && micBtn) {
  const rec = new SpeechRecognition();
  rec.lang = "en-IN";
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  let micActive = false;

  micBtn.onclick = () => { micActive ? rec.stop() : rec.start(); };

  rec.onstart = () => { micActive = true;  micBtn.classList.add("mic-active");    micBtn.title = "Listening... tap to stop"; };
  rec.onend   = () => { micActive = false; micBtn.classList.remove("mic-active"); micBtn.title = "Voice input"; };

  rec.onresult = e => {
    input.value = e.results[0][0].transcript;
    sendMessage();
  };
  rec.onerror = e => {
    console.warn("Mic:", e.error);
    if (e.error === "not-allowed")
      addAI("⚠️ Microphone permission denied. Allow mic in browser settings.");
  };
} else if (micBtn) {
  micBtn.style.opacity = "0.35";
  micBtn.onclick = () => addAI("⚠️ Voice input requires Chrome on HTTPS.");
}
