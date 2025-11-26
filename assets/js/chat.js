/* ---------------------------------------------------------
   CloudAI Frontend Engine — ChatGPT-Style v12 (Final)
   Features:
   ✔ ChatGPT bubble style (centered wide messages)
   ✔ Glow logo while thinking
   ✔ Auto-resize input
   ✔ Memory: save last 15 messages (session only)
   ✔ Smart Retry (2x)
   ✔ Truncation detection + auto continuation
   ✔ Quota: warning + lock
   ✔ Code highlighting + copy button
--------------------------------------------------------- */

const API_URL = "https://dawn-smoke-b354.sleepyspider6166.workers.dev/";

// DOM Elements
const chatBox = document.getElementById("chat-box");
const userInput = document.getElementById("user-input");
const sendBtn   = document.getElementById("send-btn");
const logo      = document.getElementById("ai-logo");

// State
let history = [];
let isProcessing = false;
let quotaExceeded = false;

const clientId = "web_" + Math.random().toString(36).substring(2, 10);

/* ----------------- Auto Resize Input ----------------- */
userInput.addEventListener("input", () => {
  userInput.style.height = "auto";
  userInput.style.height = Math.min(userInput.scrollHeight, 150) + "px";
});

/* -------------- Enter to Send (Shift+Enter = newline) -------------- */
userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

sendBtn.addEventListener("click", sendMessage);

/* ---------------------- Main Send Logic ---------------------- */
async function sendMessage() {
  const prompt = userInput.value.trim();
  if (!prompt || isProcessing || quotaExceeded) return;

  appendMessage(prompt, "user-message");

  userInput.value = "";
  userInput.style.height = "40px";

  isProcessing = true;
  logo.classList.add("thinking");

  const tempThinking = appendMessage("⏳ Thinking...", "ai-message", true);

  try {
    const reply = await fetchAIResponseWithRetry(prompt, 2);

    if (tempThinking) tempThinking.remove();

    appendMessage(reply, "ai-message");

    history.push({ role: "user", text: prompt });
    history.push({ role: "model", text: reply });

    if (history.length > 30) history = history.slice(-30);

  } catch {
    if (tempThinking) tempThinking.remove();
    appendMessage("⚠️ Network issue. Please try again.", "ai-message");
  } finally {
    isProcessing = false;
    logo.classList.remove("thinking");
  }
}

/* ---------------- SMART RETRY SYSTEM ---------------- */
async function fetchAIResponseWithRetry(prompt, retries = 2) {

  const finalPrompt = applyLanguageLock(prompt);

  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, prompt: finalPrompt, history })
      });

      const data = await res.json();

      // QUOTA HANDLING
      if (data.quotaStatus === "quota_warning") {
        showAlert("⚠️ 80% quota used.");
      }
      if (data.quotaStatus === "quota_exceeded") {
        showAlert("🚫 Daily quota reached. Try again tomorrow.");
        disableInput();
        quotaExceeded = true;
        return "🚫 Daily quota reached. Try again tomorrow.";
      }

      if (data.reply && data.reply.trim() !== "") {
        let output = data.reply.trim();

        if (detectTruncated(output) && i < retries) {
          const cont = await fetchContinuation(prompt);
          if (cont) output += "\n\n" + cont;
        }

        return output;
      }

    } catch {}
  }

  return "⚠️ No valid response after multiple attempts.";
}

/* -------------- Fetch Continuation (if needed) -------------- */
async function fetchContinuation(prompt) {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, prompt: prompt + " (continue)", history })
    });

    const data = await res.json();
    return data.reply?.trim() || "";
  } catch {
    return "";
  }
}

/* ---------------- Language Lock (Hindi Safe) ---------------- */
function applyLanguageLock(text) {
  const devanagari = /[\u0900-\u097F]/;
  const wantsTranslation = /\btranslate\b|अनुवाद/i.test(text);

  if (wantsTranslation) return text;

  if (devanagari.test(text)) {
    return "उत्तर केवल उसी भाषा में दो जिसमें प्रश्न पूछा गया है।\n\n" + text;
  }

  return "Answer strictly in the same language as the user's message.\n\n" + text;
}

/* ---------------- Truncated Response Detection ---------------- */
function detectTruncated(text) {
  const last = text.trim().slice(-1);
  return ![".", "?", "!", "।", "॥"].includes(last);
}

/* ---------------- Render + Append Message ---------------- */
function appendMessage(text, type = "ai-message", temporary = false) {

  const wrapper = document.createElement("div");
  wrapper.className = `message ${type}`;

  const content = document.createElement("div");
  content.className = "message-content";
  content.innerHTML = renderMarkdown(text);

  wrapper.appendChild(content);
  chatBox.appendChild(wrapper);

  chatBox.scrollTop = chatBox.scrollHeight;

  wrapper.querySelectorAll("pre code").forEach(block => {
    try { hljs.highlightElement(block); } catch {}

    if (!block.parentNode.querySelector(".copy-btn")) {
      const btn = document.createElement("button");
      btn.className = "copy-btn";
      btn.textContent = "Copy";

      btn.onclick = () => {
        navigator.clipboard.writeText(block.innerText);
        btn.textContent = "Copied!";
        setTimeout(() => (btn.textContent = "Copy"), 1500);
      };

      block.parentNode.appendChild(btn);
    }
  });

  return temporary ? wrapper : null;
}

/* ---------------- Markdown Renderer ---------------- */
function renderMarkdown(text) {
  const escapeHTML = s =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  text = text.replace(/```([\s\S]*?)```/g, (_, code) =>
    `<pre><code>${escapeHTML(code)}</code></pre>`
  );

  text = text.replace(/`([^`]+)`/g, (_, code) =>
    `<code>${escapeHTML(code)}</code>`
  );

  text = text.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
  text = text.replace(/\*(.*?)\*/g, "<i>$1</i>");

  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    `<a href="$2" target="_blank" rel="noopener">$1</a>`
  );

  return text.replace(/\n/g, "<br>");
}

/* ---------------- Alert Toast ---------------- */
function showAlert(msg) {
  const el = document.createElement("div");
  el.className = "alert-toast";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

/* ---------------- Disable Input on Quota Lock ---------------- */
function disableInput() {
  userInput.disabled = true;
  sendBtn.disabled = true;
  sendBtn.style.opacity = 0.5;
}