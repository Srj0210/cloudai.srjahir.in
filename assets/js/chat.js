// CloudAI frontend — final merged chat.js (vFINAL)
// Uses your worker: update API_URL if needed
const API_URL = "https://dawn-smoke-b354.sleepyspider6166.workers.dev/";

const chatBox = document.getElementById("chat-box");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const logo = document.getElementById("ai-logo");

let history = []; // in-memory only (last 15 messages). NOT persisted across reloads.
let isProcessing = false;
let quotaExceeded = false;
const clientId = "web_" + Math.random().toString(36).substring(2, 9);

// --- IMPORTANT: ensure chat is CLEAN on every page load (user wanted refresh -> clean)
window.addEventListener("load", () => {
  // intentionally do NOT restore any saved history
  history = [];
  // make sure no old localStorage leftovers
  try { localStorage.removeItem("cloudai_chat_history"); } catch(e){}
});

// auto-resize textarea while typing
userInput.addEventListener("input", () => {
  userInput.style.height = "auto";
  const newH = Math.min(userInput.scrollHeight, parseInt(getComputedStyle(document.documentElement).getPropertyValue('--max-input-height')) || 140);
  userInput.style.height = newH + "px";
});

// Enter to send (Shift+Enter newline)
userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
sendBtn.addEventListener("click", sendMessage);

// appendMessage returns created element (if needed)
function appendMessage(text, className = "ai-message", temp=false){
  const msg = document.createElement("div");
  msg.className = `message ${className}`;
  const content = document.createElement("div");
  content.className = "message-content";
  content.innerHTML = renderMarkdown(text);
  msg.appendChild(content);
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;

  // highlight code & add copy buttons
  msg.querySelectorAll("pre code").forEach((block) => {
    try { hljs.highlightElement(block); } catch(e){}
    if (!block.parentNode.querySelector(".copy-btn")) {
      const copyBtn = document.createElement("button");
      copyBtn.className = "copy-btn";
      copyBtn.textContent = "Copy";
      copyBtn.onclick = async () => {
        try {
          await navigator.clipboard.writeText(block.innerText);
          copyBtn.textContent = "Copied!";
          setTimeout(()=> copyBtn.textContent = "Copy", 1500);
        } catch {
          copyBtn.textContent = "Failed";
          setTimeout(()=> copyBtn.textContent = "Copy", 1500);
        }
      };
      block.parentNode.style.position = "relative";
      block.parentNode.appendChild(copyBtn);
    }
  });

  if (temp) return msg;
  return msg;
}

// simple markdown renderer (bold, italics, codeblocks, inline code, links, newlines)
function renderMarkdown(text){
  if (!text) return "";
  const esc = s => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  // code blocks
  text = text.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${esc(code)}</code></pre>`);
  // inline code
  text = text.replace(/`([^`]+)`/g, (_, c) => `<code>${esc(c)}</code>`);
  // bold
  text = text.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
  // italics
  text = text.replace(/\*(.*?)\*/g, "<i>$1</i>");
  // links
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, `<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>`);
  // newlines
  text = text.replace(/\n/g, "<br>");
  return text;
}

// main send flow
async function sendMessage(){
  const prompt = userInput.value.trim();
  if (!prompt || isProcessing || quotaExceeded) return;

  // append user message (small pill like ChatGPT)
  appendMessage(prompt, "user-message");
  // prepare UI
  userInput.value = "";
  userInput.style.height = "auto";
  isProcessing = true;
  logo.classList.add("thinking");

  // show temporary thinking message (we'll remove it later)
  const thinkingEl = appendMessage("⏳ Thinking...", "ai-message", true);

  try {
    const reply = await fetchAIResponseWithRetry(prompt, 2);

    // remove thinking
    if (thinkingEl && thinkingEl.parentNode) thinkingEl.remove();

    appendMessage(reply, "ai-message");

    // update in-memory history (keep last 30 entries = 15 pairs)
    history.push({ role:"user", text: prompt });
    history.push({ role:"model", text: reply });
    if (history.length > 30) history = history.slice(-30);

  } catch (err) {
    if (thinkingEl && thinkingEl.parentNode) thinkingEl.remove();
    appendMessage("⚠️ Network issue. Try again later.", "ai-message");
    console.error("Send error:", err);
  } finally {
    isProcessing = false;
    logo.classList.remove("thinking");
    chatBox.scrollTop = chatBox.scrollHeight;
  }
}

// smart fetch with retry, truncated detection, quota handling
async function fetchAIResponseWithRetry(prompt, retries = 2){
  const smartPrompt = applyLanguageLock(prompt);

  for (let attempt = 0; attempt <= retries; attempt++){
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, prompt: smartPrompt, history })
      });

      // if non-200, try to parse body for quota info
      if (!res.ok) {
        let errBody = {};
        try { errBody = await res.json(); } catch(e){}
        if (errBody?.error === "quota_exceeded" || errBody?.quotaStatus === "quota_exceeded") {
          showAlert("🚫 Daily quota reached. Try again after 24 hours.");
          disableInput();
          quotaExceeded = true;
          return "🚫 Daily quota reached. Try again tomorrow.";
        }
        // continue to retry
      } else {
        const data = await res.json();

        if (data.quotaStatus === "quota_warning") showAlert("⚠️ 80% quota used.");
        if (data.quotaStatus === "quota_exceeded") {
          showAlert("🚫 Daily quota reached. Try again after 24 hours.");
          disableInput();
          quotaExceeded = true;
          return "🚫 Daily quota reached. Try again tomorrow.";
        }

        if (data.reply && data.reply.trim() !== "") {
          let output = data.reply.trim();

          // detect truncated
          if (detectTruncatedResponse(output) && attempt < retries) {
            const cont = await fetchContinuation(prompt);
            if (cont) output = output + "\n\n" + cont;
          }

          return output;
        }
      }
    } catch (err) {
      console.warn("Fetch attempt failed:", err);
    }
  }
  return "⚠️ No valid response after multiple attempts. Please try again later.";
}

// fetch continuation helper
async function fetchContinuation(previousPrompt){
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ clientId, prompt: previousPrompt + " (continue)", history })
    });
    if (!res.ok) return "";
    const data = await res.json();
    return data.reply ? data.reply.trim() : "";
  } catch {
    return "";
  }
}

// language lock (supports Devanagari special-case)
function applyLanguageLock(prompt){
  const devanagari = /[\u0900-\u097F]/;
  const wantsTranslation = /\btranslate\b|अनुवाद|भाषांतर/i.test(prompt);
  if (wantsTranslation) return prompt;
  if (devanagari.test(prompt)) {
    return "उत्तर केवल उसी भाषा (हिंदी/देवनागरी) में दीजिये।\n\n" + prompt;
  }
  return "Answer strictly in the same language as the user's message. Do not translate unless explicitly asked.\n\n" + prompt;
}

// truncated response detection: check last char
function detectTruncatedResponse(text){
  const trimmed = text.trim();
  if (!trimmed) return true;
  const last = trimmed.slice(-1);
  return ![".", "?", "!", "।", "॥"].includes(last) && /[A-Za-z\u0900-\u097F]$/.test(trimmed);
}

// basic UI helpers
function showAlert(msg){
  const el = document.createElement("div");
  el.className = "alert-toast";
  el.textContent = msg;
  Object.assign(el.style, {
    position: "fixed",
    left: "50%",
    transform: "translateX(-50%)",
    bottom: "90px",
    background: "#00b7ff",
    color: "#021124",
    padding: "10px 16px",
    borderRadius: "10px",
    zIndex: 3000,
    fontWeight: 700,
  });
  document.body.appendChild(el);
  setTimeout(()=> el.remove(), 3800);
}

function disableInput(){
  userInput.disabled = true;
  sendBtn.disabled = true;
  userInput.placeholder = "Daily limit reached. Try again tomorrow.";
  sendBtn.style.opacity = "0.6";
}

/* small keyboard fix to reset textarea on resize */
(function keyboardFix(){
  window.addEventListener("resize", ()=> { userInput.style.height = "auto"; });
})();