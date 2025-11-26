// CloudAI frontend — final v12
const API_URL = "https://dawn-smoke-b354.sleepyspider6166.workers.dev/"; // worker endpoint
const chatBox = document.getElementById("chat-box");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const logo = document.getElementById("ai-logo");

let history = []; // will hold {role,text}
let isProcessing = false;
let quotaExceeded = false;
const clientId = "web_" + Math.random().toString(36).substring(2,9);

// ----- persistence: keep last 15 messages -----
// load on start
(function loadHistory(){
  try {
    const raw = localStorage.getItem("cloudai_history_v12");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        history = parsed.slice(-30); // we store both user+ai pairs (max 30 entries -> 15 pairs)
        history.forEach(m => appendMessage(m.text, m.role === "model" ? "ai-message" : "user-message", false));
        // keep UI scrolled
        chatBox.scrollTop = chatBox.scrollHeight;
      }
    } else {
      // show initial welcome AI message
      const welcome = "👋 Hi — I'm CloudAI. Ask me anything. I can fetch live info when needed.";
      history.push({role:"model", text: welcome});
      appendMessage(welcome, "ai-message");
      persistHistory();
    }
  } catch(e) { console.warn("History load failed", e); }
})();

function persistHistory(){
  try {
    // keep last 30 items (15 pairs)
    const trimmed = history.slice(-30);
    localStorage.setItem("cloudai_history_v12", JSON.stringify(trimmed));
  } catch(e){ console.warn("Persist failed", e); }
}

// ----- auto size textarea -----
userInput.addEventListener("input", () => {
  userInput.style.height = "auto";
  const max = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--max-input-height")) || 140;
  const h = Math.min(userInput.scrollHeight, max);
  userInput.style.height = h + "px";
});

// Enter to send (Shift+Enter newline)
userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault(); sendMessage();
  }
});

// click send
sendBtn.addEventListener("click", sendMessage);

// main send
async function sendMessage(){
  const prompt = userInput.value.trim();
  if (!prompt || isProcessing || quotaExceeded) return;

  // show user pill (small)
  appendMessage(prompt, "user-message");
  history.push({role:"user", text: prompt});
  persistHistory();

  userInput.value = "";
  userInput.style.height = "auto";
  isProcessing = true;
  logo.classList.add("thinking");

  // temp thinking AI card
  const temp = appendMessage("⏳ Thinking...", "ai-message", true);

  try {
    const reply = await fetchAIResponseWithRetry(prompt, 2);

    // remove temp
    if (temp && temp.parentNode) temp.remove();

    appendMessage(reply, "ai-message");
    history.push({role:"model", text: reply});
    // keep last 30
    if (history.length > 60) history = history.slice(-60);
    persistHistory();

  } catch (err) {
    if (temp && temp.parentNode) temp.remove();
    appendMessage("⚠️ Network issue. Try again later.", "ai-message");
    console.error(err);
  } finally {
    isProcessing = false;
    logo.classList.remove("thinking");
    chatBox.scrollTop = chatBox.scrollHeight;
  }
}

// ----- fetch with retries, truncated detection, quota handling -----
async function fetchAIResponseWithRetry(prompt, retries = 2){
  const smartPrompt = applyLanguageLock(prompt);

  for (let attempt=0; attempt<=retries; attempt++){
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ clientId, prompt: smartPrompt, history })
      });
      // handle non-200
      if (!res.ok) {
        let errBody = {};
        try { errBody = await res.json(); } catch {}
        if (errBody?.error === "quota_exceeded" || errBody?.quotaStatus === "quota_exceeded") {
          showAlert("🚫 Daily quota reached. Try again after 24 hours.");
          disableInput();
          quotaExceeded = true;
          return "🚫 Daily quota reached. Try again tomorrow.";
        }
        // else continue to next attempt
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
          if (detectTruncatedResponse(output) && attempt < retries) {
            const cont = await fetchContinuation(prompt);
            if (cont) output = output + "\n\n" + cont;
          }
          return output;
        }
      }
    } catch (e) {
      console.warn("Fetch attempt failed", e);
    }
  }
  return "⚠️ No valid response after multiple attempts. Please try again later.";
}

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

// ----- language lock (Hindi/Devanagari behavior) -----
function applyLanguageLock(prompt){
  const devanagariRegex = /[\u0900-\u097F]/;
  const wantsTranslation = /\btranslate\b|अनुवाद|भाषांतर/i.test(prompt);
  if (wantsTranslation) return prompt;
  if (devanagariRegex.test(prompt)) {
    return "उत्तर केवल उसी भाषा (हिंदी/देवनागरी) में दें, जिसमें प्रश्न पूछा गया है।\n\n" + prompt;
  }
  return "Answer strictly in the same language as the user's message. Do not translate unless explicitly asked.\n\n" + prompt;
}

// ----- truncated detection heuristic -----
function detectTruncatedResponse(text){
  const trimmed = (text||"").trim();
  if (!trimmed) return true;
  const last = trimmed.slice(-1);
  return ![".", "?", "!", "।", "॥"].includes(last) && /[A-Za-z\u0900-\u097F]$/.test(trimmed);
}

// ----- UI helpers -----
// append message; makeTemporary returns element for later removal
function appendMessage(text, className="ai-message", makeTemporary=false){
  const msg = document.createElement("div");
  msg.className = "message " + className;

  const content = document.createElement("div");
  content.className = "message-content";
  content.innerHTML = renderMarkdown(text || "");
  msg.appendChild(content);

  // add copy button to any code blocks inside when present
  setTimeout(()=> {
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
  }, 40);

  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
  if (makeTemporary) return msg;
  return msg;
}

// simple markdown render (bold, italic, codeblocks, links, newlines)
function renderMarkdown(text){
  if (!text) return "";
  const escape = s => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  // code blocks
  text = text.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${escape(code)}</code></pre>`);
  text = text.replace(/`([^`]+)`/g, (_, code) => `<code>${escape(code)}</code>`);
  text = text.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
  text = text.replace(/\*(.*?)\*/g, "<i>$1</i>");
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, `<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>`);
  return text.replace(/\n/g, "<br>");
}

// tiny toast
function showAlert(msg){
  const el = document.createElement("div");
  el.className = "alert-toast";
  el.textContent = msg;
  Object.assign(el.style, {position:"fixed", left:"50%", transform:"translateX(-50%)", bottom:"90px", background: "var(--accent)", color:"#021124", padding:"10px 16px", borderRadius:"10px", zIndex:3000, fontWeight:700, boxShadow:"0 8px 24px rgba(0,0,0,0.45)"});
  document.body.appendChild(el);
  setTimeout(()=> el.remove(), 3800);
}

function disableInput(){
  userInput.disabled = true;
  sendBtn.disabled = true;
  userInput.placeholder = "Daily limit reached. Try again tomorrow.";
  sendBtn.style.opacity = "0.6";
}

// small keyboard fix
(function keyboardFix(){
  window.addEventListener("resize", ()=> { userInput.style.height = "auto"; });
})();