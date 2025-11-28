// assets/js/chat.js (REPLACE existing file with this)

const chatBox = document.getElementById("chat-box");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const LOGO = document.getElementById("ai-logo");

// keep last 15 messages in memory (not persisted across reload)
let history = []; // { role: "user"|"model", text: "..." }
const MAX_HISTORY = 15;

let isProcessing = false;
const clientId = "web_" + Math.random().toString(36).substring(2, 9);

// --- events ---
sendBtn.addEventListener("click", handleSend);
userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

// --- helpers: markdown renderer (simple) ---
function escapeHTML(s){ return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function renderMarkdown(text){
  if (text == null) return "";
  // code blocks
  text = text.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${escapeHTML(code)}</code></pre>`);
  // inline code
  text = text.replace(/`([^`]+)`/g, (_, c) => `<code>${escapeHTML(c)}</code>`);
  // bold/italic (simple)
  text = text.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
  text = text.replace(/\*(.*?)\*/g, "<i>$1</i>");
  // links
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, `<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>`);
  // linebreaks
  text = text.replace(/\n/g, "<br>");
  return text;
}

// --- UI: add user bubble ---
function addUserBubble(text){
  const wrap = document.createElement("div");
  wrap.className = "message user-message"; // match CSS: user-message

  const bubble = document.createElement("div");
  bubble.className = "message-content"; // reuse same content class as AI
  bubble.style.display = "inline-block";
  bubble.style.maxWidth = "78%";
  bubble.style.whiteSpace = "pre-wrap";
  bubble.style.wordBreak = "break-word";
  bubble.innerText = text;

  wrap.appendChild(bubble);
  chatBox.appendChild(wrap);
  scrollToBottom();
}

// --- UI: add ai bubble ---
function addAiBubble(text){
  const wrap = document.createElement("div");
  wrap.className = "message ai-message"; // match CSS: ai-message

  const content = document.createElement("div");
  content.className = "message-content";
  content.innerHTML = renderMarkdown(text);

  wrap.appendChild(content);
  chatBox.appendChild(wrap);

  // highlight and add copy buttons for code blocks
  try {
    wrap.querySelectorAll("pre code").forEach((block) => {
      try { hljs.highlightElement(block); } catch(e){/*ignore*/}

      // add copy button if not present
      if (!block.parentNode.querySelector(".copy-btn")){
        const btn = document.createElement("button");
        btn.className = "copy-btn";
        btn.textContent = "Copy";
        btn.title = "Copy code";
        btn.onclick = async () => {
          try {
            await navigator.clipboard.writeText(block.innerText);
            btn.textContent = "Copied!";
            setTimeout(()=> btn.textContent = "Copy", 1200);
          } catch {
            btn.textContent = "Failed";
            setTimeout(()=> btn.textContent = "Copy", 1200);
          }
        };
        block.parentNode.style.position = "relative";
        block.parentNode.appendChild(btn);
      }
    });
  } catch(e){ console.warn(e); }

  scrollToBottom();
}

// --- scroll ---
function scrollToBottom(){
  setTimeout(() => {
    chatBox.scrollTop = chatBox.scrollHeight;
  }, 60);
}

// --- glow while thinking (toggle class to keep CSS animation) ---
function startGlow(){
  if (LOGO) LOGO.classList.add("thinking");
}
function stopGlow(){
  if (LOGO) LOGO.classList.remove("thinking");
}

// --- update history (keep only last MAX_HISTORY entries) ---
function pushHistory(role, text){
  history.push({ role, text });
  if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);
}

// --- network: robust fetch with one retry ---
async function askCloudAI(prompt){
  if (isProcessing) return;
  isProcessing = true;

  addTemporaryThinkingBubble(); // small UX placeholder
  startGlow();

  // push to local history (for worker context)
  pushHistory("user", prompt);

  const payload = { clientId, prompt, history };

  const API_URL = "https://cloudai.srjahir.workers.dev/"; // update if your worker URL differs

  try {
    const reply = await fetchWithRetry(API_URL, payload, 1);
    removeTemporaryThinkingBubble();
    stopGlow();

    if (reply && reply.trim) {
      addAiBubble(reply.trim());
      pushHistory("model", reply.trim());
    } else {
      addAiBubble("⚠️ No valid response received. Try again.");
    }
  } catch (err) {
    removeTemporaryThinkingBubble();
    stopGlow();
    console.error("askCloudAI error:", err);
    addAiBubble("⚠️ Network error. Try again.");
  } finally {
    isProcessing = false;
  }
}

// small "thinking" placeholder bubble so UI isn't empty
let tempThinkingEl = null;
function addTemporaryThinkingBubble(){
  tempThinkingEl = document.createElement("div");
  tempThinkingEl.className = "message ai-message thinking-temp";
  const c = document.createElement("div");
  c.className = "message-content";
  c.innerText = "⏳ Thinking...";
  tempThinkingEl.appendChild(c);
  chatBox.appendChild(tempThinkingEl);
  scrollToBottom();
}
function removeTemporaryThinkingBubble(){
  if (tempThinkingEl && tempThinkingEl.parentNode) tempThinkingEl.parentNode.removeChild(tempThinkingEl);
  tempThinkingEl = null;
}

// fetch with retry and JSON-safe parse
async function fetchWithRetry(url, payload, retries = 1){
  let lastErr = null;
  for (let attempt=0; attempt<=retries; attempt++){
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        // mode: "cors" // leave default unless your worker needs otherwise
      });

      // try parse json
      let data;
      try { data = await res.json(); } catch(e){ data = null; }

      if (!res.ok){
        // server-level error
        console.warn("Server error", res.status, data);
        // if quota info present, return friendly message
        if (data && (data.quotaStatus === "quota_exceeded" || data.error === "quota_exceeded")){
          throw new Error("quota_exceeded");
        }
        lastErr = new Error("Server returned " + res.status);
        continue; // retry if attempts left
      }

      // if server responded with reply
      if (data && data.reply) return data.reply;

      // fallback: maybe data.text or data.output
      if (data && (data.text || data.output)) return (data.text || data.output);

      lastErr = new Error("No reply field from server");
    } catch (err){
      lastErr = err;
      console.warn("Fetch attempt failed:", err);
      // small delay before retry
      await new Promise(r => setTimeout(r, 450));
    }
  }
  throw lastErr;
}

// --- handle send from UI ---
function handleSend(){
  const text = userInput.value.trim();
  if (!text) return;

  addUserBubble(text);
  userInput.value = "";
  scrollToBottom();

  // call backend async (no await here)
  askCloudAI(text);
}

/* --- End of file --- */