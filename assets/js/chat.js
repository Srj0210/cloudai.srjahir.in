// CloudAI frontend chat.js — final integrated v1
const API_URL = "https://dawn-smoke-b354.sleepyspider6166.workers.dev/";

const chatBox = document.getElementById("chat-box");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const logo = document.getElementById("ai-logo");

let history = []; // in-memory only (keeps last 15 messages during session)
let isProcessing = false;
let quotaExceeded = false;
const clientId = "web_" + Math.random().toString(36).substring(2, 9);

// Do NOT persist across refresh — session-only memory as requested
window.addEventListener("load", () => {
  history = [];
});

// Auto-resize input while typing
userInput.addEventListener("input", () => {
  userInput.style.height = "auto";
  const newHeight = Math.min(userInput.scrollHeight, 140);
  userInput.style.height = (newHeight) + "px";
});

// Enter to send, Shift+Enter newline
userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Click send
sendBtn.addEventListener("click", sendMessage);

async function sendMessage(){
  const prompt = userInput.value.trim();
  if (!prompt || isProcessing || quotaExceeded) return;

  appendMessage(prompt, "user-message");
  userInput.value = "";
  userInput.style.height = "auto";

  isProcessing = true;
  logo.classList.add("thinking");

  // temporary thinking bubble
  const thinkingEl = appendMessage("⏳ Thinking...", "ai-message", true);

  try {
    const reply = await fetchAIResponseWithRetry(prompt, 2);

    // remove thinking
    if (thinkingEl && thinkingEl.parentNode) thinkingEl.remove();

    appendMessage(reply, "ai-message");

    // update in-memory history - keep last 15 messages (pairs => 30 entries max; we keep 15 turns = 30)
    history.push({ role: "user", text: prompt });
    history.push({ role: "model", text: reply });
    if (history.length > 30) history = history.slice(-30);

  } catch (err) {
    if (thinkingEl && thinkingEl.parentNode) thinkingEl.remove();
    appendMessage("⚠️ Network issue. Try again later.", "ai-message");
    console.error("Send error:", err);
  } finally {
    isProcessing = false;
    logo.classList.remove("thinking");
  }
}

// Smart fetch with retry + truncated detection
async function fetchAIResponseWithRetry(prompt, retries = 2){
  const smartPrompt = applyLanguageLock(prompt);

  for (let attempt = 0; attempt <= retries; attempt++){
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, prompt: smartPrompt, history })
      });

      // if server returns non-ok, try to parse body (quota info often returned)
      let data = null;
      try { data = await res.json(); } catch(e){ data = null; }

      if (!res.ok) {
        // quota server-side
        if (data?.error === "quota_exceeded" || data?.quotaStatus === "quota_exceeded") {
          showAlert("🚫 Daily quota reached. Try again after 24 hours.");
          disableInput();
          quotaExceeded = true;
          return "🚫 Daily quota reached. Try again tomorrow.";
        }
        // otherwise retry
        console.warn("Server error", res.status, data);
      } else {
        // success path
        if (data.quotaStatus === "quota_warning") showAlert("⚠️ 80% quota used.");
        if (data.quotaStatus === "quota_exceeded") {
          showAlert("🚫 Daily quota reached. Try again after 24 hours.");
          disableInput();
          quotaExceeded = true;
          return "🚫 Daily quota reached. Try again tomorrow.";
        }

        if (data.reply && data.reply.trim() !== "") {
          let output = data.reply.trim();

          // detect truncated answer
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

// Fetch continuation (once) if truncated
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
  } catch { return ""; }
}

// Language lock preserves language (handles Devanagari special-case)
function applyLanguageLock(prompt){
  const devanagariRegex = /[\u0900-\u097F]/;
  const wantsTranslation = /\btranslate\b|अनुवाद|भाषांतर/i.test(prompt);
  if (wantsTranslation) return prompt;
  if (devanagariRegex.test(prompt)) {
    return "उत्तर केवल उसी भाषा (हिंदी/देवनागरी) में दें। अनुवाद न करें।\n\n" + prompt;
  }
  return "Answer strictly in the same language as the user's message. Do not translate unless explicitly asked.\n\n" + prompt;
}

// Truncated detection heuristic
function detectTruncatedResponse(text){
  const trimmed = text.trim();
  if (!trimmed) return true;
  const last = trimmed.slice(-1);
  return ![".", "?", "!", "।", "॥"].includes(last) && /[A-Za-z\u0900-\u097F]$/.test(trimmed);
}

// UI helpers: appendMessage
function appendMessage(text, className = "ai-message", makeTemporary = false){
  const msg = document.createElement("div");
  msg.className = `message ${className}`;
  const content = document.createElement("div");
  content.className = "message-content";
  content.innerHTML = renderMarkdown(text);
  msg.appendChild(content);

  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;

  // code blocks -> copy button + highlight
  msg.querySelectorAll("pre code").forEach((block) => {
    try { hljs.highlightElement(block); } catch(e) {}
    if (!block.parentNode.querySelector(".copy-btn")) {
      const copyBtn = document.createElement("button");
      copyBtn.className = "copy-btn";
      copyBtn.textContent = "Copy";
      copyBtn.title = "Copy code";
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

  if (makeTemporary) return msg;
  return msg;
}

// Basic markdown -> html (bold, italic, inline code, code blocks, links, newlines)
function renderMarkdown(text){
  if (!text) return "";
  const escapeHTML = s => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  text = text.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${escapeHTML(code)}</code></pre>`);
  text = text.replace(/`([^`]+)`/g, (_, code) => `<code>${escapeHTML(code)}</code>`);
  text = text.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
  text = text.replace(/\*(.*?)\*/g, "<i>$1</i>");
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, `<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>`);
  text = text.replace(/\n/g, "<br>");
  return text;
}

// Toast alert
function showAlert(msg){
  const el = document.createElement("div");
  el.className = "alert-toast";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(()=> el.remove(), 3800);
}

// Disable input when quota exceeded
function disableInput(){
  userInput.disabled = true;
  sendBtn.disabled = true;
  userInput.placeholder = "Daily limit reached. Try again tomorrow.";
  sendBtn.style.opacity = "0.6";
}