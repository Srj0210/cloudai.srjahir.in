const API = "https://dawn-smoke-b354.sleepyspider6166.workers.dev/";

const box = document.getElementById("chat-box");
const sendBtn = document.getElementById("send-btn");
const micBtn = document.getElementById("mic-btn");
const input = document.getElementById("user-input");
const pinBtn = document.getElementById("pin-btn");

const attachMenu = document.getElementById("attachMenu");
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

let history = [];
let isProcessing = false;

/* ===============================
   USER
   =============================== */
function addUser(text) {
  const d = document.createElement("div");
  d.className = "user-msg";
  d.textContent = text;
  box.appendChild(d);
  scrollBottom();
}

/* ===============================
   AI
   =============================== */
function addAI(html) {
  const d = document.createElement("div");
  d.className = "ai-msg";
  box.appendChild(d);

  if (window.typeHTML) {
    typeHTML(d, html, () => afterAI(d));
  } else {
    d.innerHTML = html;
    afterAI(d);
  }
}

function afterAI(d) {
  enhanceCodeBlocks(d);
  if (window.Prism) Prism.highlightAll();
  scrollBottom(true);
}

/* ===============================
   MARKDOWN (FIXED ORDER)
   =============================== */
function renderMarkdown(text) {
  if (!text) return "";

  const blocks = [];
  let i = 0;

  text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, l, c) => {
    const k = `__CODE_${i}__`;
    blocks.push(`
<pre class="language-${l || "javascript"}">
<button class="copy-btn">Copy</button>
<code class="language-${l || "javascript"}">${escapeHtml(c)}</code>
</pre>`);
    i++;
    return k;
  });

  text = text
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, `<code class="inline-code">$1</code>`)
    .replace(/(https?:\/\/[^\s<]+)/g, `<a href="$1" target="_blank">$1</a>`)
    .replace(/\n/g, "<br>");

  blocks.forEach((b, j) => {
    text = text.replace(`__CODE_${j}__`, b);
  });

  return text;
}

function escapeHtml(s) {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

/* ===============================
   COPY
   =============================== */
function enhanceCodeBlocks(c) {
  c.querySelectorAll(".copy-btn").forEach(b => {
    b.onclick = () => {
      navigator.clipboard.writeText(b.nextElementSibling.innerText);
      b.textContent = "Copied ✓";
      setTimeout(() => b.textContent = "Copy", 1200);
    };
  });
}

/* ===============================
   SEND (QUOTA SAFE)
   =============================== */
async function sendMessage() {
  const msg = input.value.trim();
  if (!msg || isProcessing) return;

  isProcessing = true;
  addUser(msg);
  input.value = "";

  history.push({ role:"user", text:msg });
  document.body.classList.add("ai-thinking");

  try {
    const r = await fetch(API,{
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({ prompt:msg, history, clientId })
    });

    const d = await r.json();

    if (d.error) {
      addAI(`<strong>⚠️ ${d.error}</strong>`);
      return;
    }

    addAI(renderMarkdown(d.reply));
    history.push({ role:"model", text:d.reply });

  } catch {
    addAI("⚠️ Network error");
  } finally {
    isProcessing = false;
    document.body.classList.remove("ai-thinking");
  }
}

/* ===============================
   SCROLL (FINAL FIX)
   =============================== */
function scrollBottom(force=false) {
  requestAnimationFrame(() => {
    const last = box.lastElementChild;
    if (last && force) last.scrollIntoView({ behavior:"smooth", block:"end" });
    box.scrollTop = box.scrollHeight;
  });
}

/* ===============================
   EVENTS
   =============================== */
sendBtn.onclick = sendMessage;
input.addEventListener("keydown",e=>{
  if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); sendMessage(); }
});

/* ===============================
   ATTACH
   =============================== */
pinBtn.onclick = ()=>{
  attachMenu.style.display =
    attachMenu.style.display==="flex"?"none":"flex";
};

attachMenu.onclick = e=>{
  const t = e.target.dataset.type;
  if(!t)return;
  attachMenu.style.display="none";
  if(t==="camera")cameraInput.click();
  if(t==="image")imageInput.click();
  if(t==="file")fileInput.click();
};

/* ===============================
   VOICE
   =============================== */
if ("webkitSpeechRecognition" in window) {
  const r = new webkitSpeechRecognition();
  r.lang="en-IN";
  micBtn.onclick=()=>r.start();
  r.onresult=e=>{
    input.value=e.results[0][0].transcript;
    sendMessage();
  };
}
