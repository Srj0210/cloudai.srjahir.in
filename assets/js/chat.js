/* ===========================================================
   CloudAI — ChatGPT-Style Frontend Engine
   SRJahir Technologies (2025)
   =========================================================== */

const API_URL = "https://dawn-smoke-b354.sleepyspider6166.workers.dev/";

const chatBox = document.getElementById("chat-box");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const LOGO = document.getElementById("ai-logo");

let history = [];
const MAX_HISTORY = 15;

let isProcessing = false;

// Reset chat every refresh
sessionStorage.removeItem("cloudai_chat");

/* ===========================================================
   EVENT LISTENERS
   =========================================================== */

sendBtn.onclick = () => handleSend();

userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});


/* ===========================================================
   SEND MESSAGE
   =========================================================== */

function handleSend() {
  const text = userInput.value.trim();
  if (!text || isProcessing) return;

  addUserBubble(text);
  userInput.value = "";

  pushHistory("user", text);
  askCloudAI(text);
}


/* ===========================================================
   ADD USER BUBBLE
   =========================================================== */

function addUserBubble(text) {
  const wrap = document.createElement("div");
  wrap.className = "user-message message";

  const bubble = document.createElement("div");
  bubble.className = "message-content";
  bubble.innerText = text;

  wrap.appendChild(bubble);
  chatBox.appendChild(wrap);
  scrollToBottom();
}


/* ===========================================================
   ADD AI BUBBLE
   =========================================================== */

function addAiBubble(html) {
  const wrap = document.createElement("div");
  wrap.className = "ai-message message";

  const bubble = document.createElement("div");
  bubble.className = "message-content";
  bubble.innerHTML = renderMarkdown(html);

  wrap.appendChild(bubble);
  chatBox.appendChild(wrap);

  applyCodeHighlighting(wrap);

  scrollToBottom();
}


/* ===========================================================
   TEMP “Thinking…” bubble
   =========================================================== */

let tempBubble = null;

function addThinking() {
  tempBubble = document.createElement("div");
  tempBubble.className = "ai-message message";

  const bubble = document.createElement("div");
  bubble.className = "message-content";
  bubble.innerText = "⏳ Thinking...";

  tempBubble.appendChild(bubble);
  chatBox.appendChild(tempBubble);

  scrollToBottom();
}

function removeThinking() {
  if (tempBubble) tempBubble.remove();
  tempBubble = null;
}


/* ===========================================================
   SCROLL SMOOTH
   =========================================================== */
function scrollToBottom() {
  setTimeout(() => {
    chatBox.scrollTop = chatBox.scrollHeight;
  }, 50);
}


/* ===========================================================
   LOGO GLOW (Old CloudAI style)
   =========================================================== */

function startGlow() {
  LOGO.classList.add("thinking");
}

function stopGlow() {
  LOGO.classList.remove("thinking");
}


/* ===========================================================
   HISTORY LIMITER
   =========================================================== */

function pushHistory(role, text) {
  history.push({ role, text });
  if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);
}


/* ===========================================================
   MAIN AI FETCH (Smart retry + detection)
   =========================================================== */

async function askCloudAI(prompt) {
  isProcessing = true;

  addThinking();
  startGlow();

  const payload = {
    clientId: "web_" + Math.random().toString(36).substring(2),
    prompt,
    history
  };

  try {
    const res = await smartFetch(API_URL, payload, 1);
    removeThinking();
    stopGlow();

    if (!res) {
      addAiBubble("⚠️ No valid response received. Try again.");
      return;
    }

    addAiBubble(res);
    pushHistory("model", res);

    // After answering, generate suggestions like ChatGPT
    addSuggestions(res);

  } catch (err) {
    removeThinking();
    stopGlow();
    addAiBubble("⚠️ Network error. Try again.");
  }

  isProcessing = false;
}


/* ===========================================================
   SMART FETCH with retry
   =========================================================== */

async function smartFetch(url, payload, retries = 1) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      // quota handling
      if (data?.quotaStatus === "quota_exceeded") {
        return "🚫 Daily limit reached. Try again tomorrow.";
      }

      if (data?.reply) return data.reply;

    } catch (e) {
      if (i === retries) return false;
    }
  }
  return false;
}


/* ===========================================================
   MARKDOWN RENDER
   =========================================================== */
function renderMarkdown(text) {
  if (!text) return "";

  const escapeHTML = (s) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // ``` code block ```
  text = text.replace(/```([\s\S]*?)```/g, (_, code) =>
    `<pre><code>${escapeHTML(code)}</code></pre>`
  );

  // inline `code`
  text = text.replace(/`([^`]+)`/g, (_, c) => `<code>${escapeHTML(c)}</code>`);

  // bold + italic
  text = text.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
  text = text.replace(/\*(.*?)\*/g, "<i>$1</i>");

  // links
  text = text.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    `<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>`
  );

  return text.replace(/\n/g, "<br>");
}


/* ===========================================================
   CODE HIGHLIGHTING + COPY BUTTONS
   =========================================================== */

function applyCodeHighlighting(wrap) {
  wrap.querySelectorAll("pre code").forEach((block) => {
    try {
      hljs.highlightElement(block);
    } catch {}

    if (!block.parentElement.querySelector(".copy-btn")) {
      const btn = document.createElement("button");
      btn.className = "copy-btn";
      btn.textContent = "Copy";

      btn.onclick = async () => {
        await navigator.clipboard.writeText(block.innerText);
        btn.textContent = "Copied!";
        setTimeout(() => (btn.textContent = "Copy"), 1200);
      };

      block.parentElement.style.position = "relative";
      block.parentElement.appendChild(btn);
    }
  });
}


/* ===========================================================
   SUGGESTIONS (ChatGPT style)
   =========================================================== */

function addSuggestions(answer) {
  const suggestions = generateSuggestions(answer);
  if (!suggestions.length) return;

  const container = document.createElement("div");
  container.className = "ai-message message";

  const wrap = document.createElement("div");
  wrap.className = "message-content";
  wrap.style.opacity = "0.85";

  wrap.innerHTML = suggestions
    .map((s) => `<button class="suggestion-btn">${s}</button>`)
    .join(" ");

  container.appendChild(wrap);
  chatBox.appendChild(container);

  chatBox.querySelectorAll(".suggestion-btn").forEach((btn) => {
    btn.onclick = () => {
      addUserBubble(btn.innerText);
      askCloudAI(btn.innerText);
    };
  });

  scrollToBottom();
}

function generateSuggestions(answer) {
  const base = [
    "Explain more",
    "Give examples",
    "Summarize it",
    "Translate this",
    "Give advanced details",
  ];

  return base.slice(0, 3);
}