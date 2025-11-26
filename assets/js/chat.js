// ============================================================
// CloudAI Frontend — ChatGPT Style Engine v12
// by SRJahir Technologies ⚡
// ============================================================

const API_URL = "https://dawn-smoke-b354.sleepyspider6166.workers.dev/";

const chatBox = document.getElementById("chat-box");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const logo = document.getElementById("ai-logo");

let history = [];
let isProcessing = false;
let quotaExceeded = false;

const clientId = "web_" + Math.random().toString(36).substring(2, 10);

// Load last 15 messages
window.addEventListener("load", () => {
  const saved = localStorage.getItem("cloudai_history");
  if (saved) {
    history = JSON.parse(saved);
    history.forEach(msg => appendMessage(msg.text, msg.role === "user" ? "user-message" : "ai-message"));
  }
});

// Auto resize textarea
userInput.addEventListener("input", () => {
  userInput.style.height = "auto";
  userInput.style.height = Math.min(userInput.scrollHeight, 150) + "px";
});

// Enter to send (Shift+Enter = newline)
userInput.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Click to send
sendBtn.addEventListener("click", sendMessage);

// ============================================================
// SEND MESSAGE
// ============================================================
async function sendMessage() {
  const prompt = userInput.value.trim();
  if (!prompt || isProcessing || quotaExceeded) return;

  appendMessage(prompt, "user-message");
  saveHistory("user", prompt);

  userInput.value = "";
  userInput.style.height = "auto";
  isProcessing = true;

  logo.classList.add("thinking"); // Glow start

  const thinkingBubble = appendMessage("⏳ CloudAI is thinking...", "ai-message", true);

  try {
    const reply = await fetchAIResponseWithRetry(prompt, 2);

    thinkingBubble.remove();
    appendMessage(reply, "ai-message");
    saveHistory("ai", reply);

  } catch (err) {
    thinkingBubble.remove();
    appendMessage("⚠️ Network issue. Try again.", "ai-message");
  }

  isProcessing = false;
  logo.classList.remove("thinking"); // Glow stop
}

// ============================================================
// FETCH AI RESPONSE (RETRY + TRUNCATION FIX)
// ============================================================
async function fetchAIResponseWithRetry(prompt, retries = 2) {
  const smartPrompt = applyLanguageLock(prompt);

  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ clientId, prompt: smartPrompt, history })
      });

      const data = await res.json();

      // QUOTA CHECK
      if (data.quotaStatus === "quota_warning") showAlert("⚠️ You've used 80% of your daily quota.");
      if (data.quotaStatus === "quota_exceeded") {
        showAlert("🚫 Daily quota reached. Try again tomorrow.");
        quotaExceeded = true;
        disableInput();
        return "🚫 Daily quota reached. Try again tomorrow.";
      }

      let output = (data.reply || "").trim();

      if (output && detectTruncated(output) && i < retries) {
        const cont = await fetchContinuation(prompt);
        output = output + "\n\n" + cont;
      }

      return output;

    } catch (err) { console.warn("Retrying fetch..."); }
  }

  return "⚠️ Unable to get a complete response.";
}

// Continuation fetch
async function fetchContinuation(prompt) {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        clientId,
        prompt: prompt + " (continue same context)",
        history
      })
    });
    const data = await res.json();
    return data.reply ? data.reply.trim() : "";
  } catch {
    return "";
  }
}

// ============================================================
// MESSAGE RENDERING
// ============================================================
function appendMessage(text, className = "ai-message", temporary = false) {
  const wrap = document.createElement("div");
  wrap.className = `message ${className}`;

  const content = document.createElement("div");
  content.className = "message-content";
  content.innerHTML = renderMarkdown(text);

  wrap.appendChild(content);
  chatBox.appendChild(wrap);
  chatBox.scrollTop = chatBox.scrollHeight;

  // Highlight + copy button
  wrap.querySelectorAll("pre code").forEach(block => {
    hljs.highlightElement(block);
    if (!block.parentNode.querySelector(".copy-btn")) {
      const btn = document.createElement("button");
      btn.className = "copy-btn";
      btn.textContent = "Copy";
      btn.onclick = () => {
        navigator.clipboard.writeText(block.innerText);
        btn.textContent = "Copied!";
        setTimeout(() => btn.textContent = "Copy", 1500);
      };
      block.parentNode.appendChild(btn);
    }
  });

  return temporary ? wrap : null;
}

// Markdown render
function renderMarkdown(text) {
  const escape = s => s.replace(/[&<>]/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[m]));

  text = text.replace(/```([\s\S]*?)```/g, (_, code) =>
    `<pre><code>${escape(code)}</code></pre>`
  );

  text = text.replace(/`([^`]+)`/g, (_, code) =>
    `<code>${escape(code)}</code>`
  );

  text = text.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
             .replace(/\*(.*?)\*/g, "<i>$1</i>")
             .replace(/\[([^\]]+)\]\((https?:\/\/[^\s]+)\)/g, `<a href="$2" target="_blank">$1</a>`);

  return text.replace(/\n/g, "<br>");
}

// Save last 15 messages
function saveHistory(role, text) {
  history.push({ role, text });
  if (history.length > 15) history = history.slice(-15);
  localStorage.setItem("cloudai_history", JSON.stringify(history));
}

// Detect truncated response
function detectTruncated(t) {
  const last = t.trim().slice(-1);
  return !".?!।॥".includes(last);
}

// Language lock
function applyLanguageLock(prompt) {
  const hindi = /[\u0900-\u097F]/;
  const wantsTranslate = /translate|अनुवाद/i.test(prompt);

  if (wantsTranslate) return prompt;
  if (hindi.test(prompt))
    return "उत्तर केवल हिंदी में दें।\n\n" + prompt;

  return "Answer strictly in the same language as the user.\n\n" + prompt;
}

// Toast alert
function showAlert(msg) {
  const el = document.createElement("div");
  el.className = "alert-toast";
  el.textContent = msg;

  Object.assign(el.style, {
    position: "fixed",
    bottom: "100px",
    left: "50%",
    transform: "translateX(-50%)",
    background: "#00b7ff",
    padding: "10px 20px",
    color: "#02141f",
    borderRadius: "10px",
    fontWeight: "600",
    zIndex: "9999",
    boxShadow: "0 5px 20px rgba(0,0,0,0.4)",
  });

  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// Disable input when quota exceeded
function disableInput() {
  userInput.disabled = true;
  sendBtn.disabled = true;
  userInput.placeholder = "Daily limit reached.";
}