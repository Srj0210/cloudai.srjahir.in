// CloudAI frontend v1 — chat.js
// Replace API_URL with your Cloudflare worker endpoint if needed
const API_URL = "https://dawn-smoke-b354.sleepyspider6166.workers.dev/"; // <--- set to your worker

const chatBox = document.getElementById("chat-box");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const logo = document.getElementById("ai-logo");

let history = []; // in-memory conversation (keeps last 15 entries)
const MAX_HISTORY = 15;
let isProcessing = false;
let quotaExceeded = false;
const clientId = "web_" + Math.random().toString(36).substring(2, 9);

// On load: clear any persisted session storage (you asked to clean on reload)
window.addEventListener("load", () => {
  sessionStorage.removeItem("cloudai_session_history");
  // Optionally reinsert initial message (already in HTML)
});

// auto-resize textarea
userInput.addEventListener("input", () => {
  userInput.style.height = "auto";
  userInput.style.height = Math.min(userInput.scrollHeight, 140) + "px";
});

// send on click or enter (shift+enter -> newline)
sendBtn.addEventListener("click", sendMessage);
userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

async function sendMessage(){
  const prompt = userInput.value.trim();
  if (!prompt || isProcessing || quotaExceeded) return;

  appendMessage(prompt, "user-message");
  userInput.value = "";
  userInput.style.height = "auto";

  isProcessing = true;
  logo.classList.add("thinking");
  const thinkingEl = appendMessage("⏳ Thinking...", "ai-message", true);

  try {
    const reply = await fetchAIResponseWithRetry(prompt, 2);

    // remove placeholder
    if (thinkingEl && thinkingEl.parentNode) thinkingEl.remove();
    appendMessage(reply, "ai-message");
    pushHistory("user", prompt);
    pushHistory("model", reply);
  } catch (err) {
    if (thinkingEl && thinkingEl.parentNode) thinkingEl.remove();
    appendMessage("⚠️ Network error. Try again later.", "ai-message");
    console.error("sendMessage error:", err);
  } finally {
    isProcessing = false;
    logo.classList.remove("thinking");
  }
}

// appendMessage: className = "user-message" or "ai-message". If makeTemporary true -> return element for removal.
function appendMessage(text, className = "ai-message", makeTemporary = false){
  const msg = document.createElement("div");
  msg.className = `message ${className}`;
  const inner = document.createElement("div");
  inner.className = "message-content";
  inner.innerHTML = renderMarkdown(text);
  msg.appendChild(inner);
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;

  // code blocks: add copy buttons
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
          setTimeout(()=> copyBtn.textContent = "Copy", 1400);
        } catch {
          copyBtn.textContent = "Failed";
          setTimeout(()=> copyBtn.textContent = "Copy", 1400);
        }
      };
      block.parentNode.style.position = "relative";
      block.parentNode.appendChild(copyBtn);
    }
  });

  if (makeTemporary) return msg;
  return msg;
}

// simple markdown renderer (bold, italic, inline code, code blocks, links, line breaks)
function renderMarkdown(text){
  if (!text) return "";
  const esc = s => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  // code blocks
  text = text.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${esc(code)}</code></pre>`);
  // inline code
  text = text.replace(/`([^`]+)`/g, (_, code) => `<code>${esc(code)}</code>`);
  // bold / italic
  text = text.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
  text = text.replace(/\*(.*?)\*/g, "<i>$1</i>");
  // links
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, `<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>`);
  // line breaks
  text = text.replace(/\n/g, "<br>");
  return text;
}

// history helper
function pushHistory(role, text){
  history.push({ role, text, time: Date.now() });
  if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);
  // store in session storage for session (but we remove on load)
  try { sessionStorage.setItem("cloudai_session_history", JSON.stringify(history)); } catch(e){}
}

// robust fetch with retries and truncated-detection
async function fetchAIResponseWithRetry(prompt, retries = 2){
  const smartPrompt = applyLanguageLock(prompt);

  for (let attempt=0; attempt<=retries; attempt++){
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, prompt: smartPrompt, history })
      });

      const data = await res.json().catch(()=>null);

      // handle server-side quota
      if (data?.quotaStatus === "quota_warning") showToast("⚠️ 80% quota used.");
      if (data?.quotaStatus === "quota_exceeded") {
        showToast("🚫 Daily quota reached. Try again after 24 hours.");
        disableInput();
        quotaExceeded = true;
        return "🚫 Daily quota reached. Try again tomorrow.";
      }

      if (res.ok && data?.reply) {
        let output = data.reply.trim();
        // if truncated, attempt continuation (one attempt)
        if (detectTruncatedResponse(output) && attempt < retries) {
          const cont = await fetchContinuation(prompt);
          if (cont) output = output + "\n\n" + cont;
        }
        return output;
      } else {
        console.warn("Server returned not-ok or missing reply", res.status, data);
      }
    } catch (err) {
      console.warn("Fetch attempt failed:", err);
      await new Promise(r => setTimeout(r, 450));
    }
  }
  throw new Error("No valid response after retries");
}

async function fetchContinuation(prevPrompt){
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, prompt: prevPrompt + " (continue)", history })
    });
    const data = await res.json().catch(()=>null);
    return data?.reply ? data.reply.trim() : "";
  } catch {
    return "";
  }
}

// naive truncated detector: if the last char isn't a sentence terminator
function detectTruncatedResponse(text){
  if (!text) return true;
  const last = text.trim().slice(-1);
  return ![".", "?", "!", "।", "॥"].includes(last);
}

// small toast
function showToast(msg){
  const el = document.createElement("div");
  el.className = "alert-toast";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(()=> el.remove(), 3800);
}

function disableInput(){
  userInput.disabled = true;
  sendBtn.disabled = true;
  userInput.placeholder = "Daily limit reached. Try again tomorrow.";
  sendBtn.style.opacity = "0.6";
}

// language lock — keep reply language same as input
function applyLanguageLock(prompt){
  const devanagariRegex = /[\u0900-\u097F]/;
  if (devanagariRegex.test(prompt)) {
    return "उत्तर केवल उसी भाषा में दें जिसमे प्रश्न पूछा गया है।\n\n" + prompt;
  }
  return "Answer strictly in the same language as the user's message. Do not translate unless explicitly asked.\n\n" + prompt;
}