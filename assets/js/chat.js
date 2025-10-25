// assets/js/chat.js
// CloudAI front-end: Markdown rendering + localStorage memory + auto-retry

// ======= CONFIG =======
const PROXY_URL = "https://YOUR-WORKER-SUBDOMAIN.workers.dev"; // <-- change me
const STORAGE_KEY = "cloudai_chat_history";
const MAX_TURNS = 8; // persist last N messages

// ======= DOM =======
const form = document.querySelector("#chat-form");
const input = document.querySelector("#chat-input");
const sendBtn = document.querySelector("#send-btn");
const messagesEl = document.querySelector("#messages");

// Fallback if selectors differ
if (!form || !input || !messagesEl) {
  console.error("Chat elements not found. Check #chat-form, #chat-input, #messages IDs.");
}

// ======= State (persisted) =======
let history = loadHistory();
renderHistory(history);

// ======= Helpers =======
function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveHistory() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-MAX_TURNS)));
  } catch {}
}

function mdToHtml(markdown) {
  // Requires marked & DOMPurify (added in index.html)
  const dirty = marked.parse(markdown ?? "");
  return DOMPurify.sanitize(dirty, { USE_PROFILES: { html: true } });
}

function renderMessage(role, text) {
  const wrapper = document.createElement("div");
  wrapper.className = `msg ${role === "user" ? "msg-user" : "msg-ai"}`;
  wrapper.innerHTML = mdToHtml(text);
  messagesEl.appendChild(wrapper);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function renderHistory(list) {
  messagesEl.innerHTML = "";
  for (const m of list) {
    renderMessage(m.role, m.text);
  }
}

function setSending(state) {
  sendBtn?.toggleAttribute?.("disabled", state);
  input?.toggleAttribute?.("disabled", state);
}

// Auto-retry fetch once if it fails (your “Request cancelled or failed”)
async function postWithRetry(url, payload, tries = 2) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 800)); // brief wait before retry
    }
  }
  throw lastErr;
}

// ======= Send flow =======
async function handleSend(e) {
  e?.preventDefault?.();
  const prompt = (input.value || "").trim();
  if (!prompt) return;

  // Show user bubble immediately
  history.push({ role: "user", text: prompt });
  saveHistory();
  renderMessage("user", prompt);

  input.value = "";
  setSending(true);

  try {
    const payload = {
      prompt,
      history: history.slice(-MAX_TURNS), // send recent context
    };

    const data = await postWithRetry(PROXY_URL, payload, 2);

    const reply = data?.reply || "⚠️ No response.";
    history.push({ role: "model", text: reply });
    saveHistory();
    renderMessage("model", reply);
  } catch (err) {
    const msg = `Request failed. ${err?.message || ""} (auto-retry exhausted)`;
    renderMessage("model", `> ${msg}`);
  } finally {
    setSending(false);
  }
}

// ======= Events =======
form?.addEventListener?.("submit", handleSend);
sendBtn?.addEventListener?.("click", handleSend);

// Optional: Enter to send if you’re not already preventing default
input?.addEventListener?.("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend(e);
  }
});
