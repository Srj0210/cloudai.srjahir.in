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
   USER MESSAGE
   =============================== */
function addUser(text) {
  const div = document.createElement("div");
  div.className = "user-msg";
  div.textContent = text;
  box.appendChild(div);
  scrollBottom(true);
}

/* ===============================
   AI MESSAGE
   =============================== */
function addAI(html) {
  const div = document.createElement("div");
  div.className = "ai-msg";
  box.appendChild(div);

  if (typeof typeHTML === "function") {
    typeHTML(div, html, () => afterAI(div));
  } else {
    div.innerHTML = html;
    afterAI(div);
  }
}

function afterAI(div) {
  enhanceCodeBlocks(div);
  if (window.Prism) Prism.highlightAll();
  scrollBottom(true);
}

/* ===============================
   MARKDOWN (FIXED ORDER 🔥)
   =============================== */
function renderMarkdown(text) {
  if (!text) return "";

  const blocks = [];
  let i = 0;

  // 1️⃣ CODE BLOCKS FIRST
  text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
    const key = `__CODE_${i}__`;
    blocks.push(`
<pre class="language-${lang || "javascript"}">
<button class="copy-btn">Copy</button>
<code class="language-${lang || "javascript"}">${escapeHtml(code)}</code>
</pre>`);
    i++;
    return key;
  });

  // 2️⃣ HEADINGS
  text = text
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^# (.*)$/gm, "<h1>$1</h1>");

  // 3️⃣ INLINE
  text = text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, `<code class="inline-code">$1</code>`)
    .replace(
      /(https?:\/\/[^\s<]+)/g,
      `<a href="$1" target="_blank" rel="noopener">$1</a>`
    );

  // 4️⃣ LINE BREAK LAST
  text = text.replace(/\n/g, "<br>");

  // 5️⃣ RESTORE CODE
  blocks.forEach((b, j) => {
    text = text.replace(`__CODE_${j}__`, b);
  });

  return text;
}

function escapeHtml(str) {
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

/* ===============================
   COPY BUTTON
   =============================== */
function enhanceCodeBlocks(container) {
  container.querySelectorAll(".copy-btn").forEach(btn => {
    btn.onclick = () => {
      navigator.clipboard.writeText(btn.nextElementSibling.innerText);
      btn.textContent = "Copied ✓";
      setTimeout(() => btn.textContent = "Copy", 1200);
    };
  });
}

/* ===============================
   SEND MESSAGE
   =============================== */
async function sendMessage() {
  const msg = input.value.trim();
  if (!msg || isProcessing) return;

  isProcessing = true;
  addUser(msg);
  input.value = "";

  history.push({ role: "user", text: msg });
  document.body.classList.add("ai-thinking");

  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: msg, history, clientId })
    });

    const data = await res.json();

    if (data.error) {
      addAI(`<strong>⚠️ ${data.error}</strong>`);
      return;
    }

    addAI(renderMarkdown(data.reply || "No response"));
    history.push({ role: "model", text: data.reply });

  } catch {
    addAI("⚠️ Network error");
  } finally {
    isProcessing = false;
    document.body.classList.remove("ai-thinking");
  }
}

/* ===============================
   SCROLL (REAL FIX 🔥)
   =============================== */
function scrollBottom(force = false) {
  requestAnimationFrame(() => {
    const last = box.lastElementChild;
    if (last && force) {
      last.scrollIntoView({ behavior: "smooth", block: "end" });
    }
    box.scrollTop = box.scrollHeight;
  });
}

/* ===============================
   EVENTS
   =============================== */
sendBtn.onclick = sendMessage;
input.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

/* ===============================
   ATTACH
   =============================== */
pinBtn.onclick = () => {
  attachMenu.style.display =
    attachMenu.style.display === "flex" ? "none" : "flex";
};

attachMenu.onclick = e => {
  const type = e.target.dataset.type;
  if (!type) return;
  attachMenu.style.display = "none";
  if (type === "camera") cameraInput.click();
  if (type === "image") imageInput.click();
  if (type === "file") fileInput.click();
};

/* ===============================
   VOICE
   =============================== */
if ("webkitSpeechRecognition" in window) {
  const recognition = new webkitSpeechRecognition();
  recognition.lang = "en-IN";
  micBtn.onclick = () => recognition.start();
  recognition.onresult = e => {
    input.value = e.results[0][0].transcript;
    sendMessage();
  };
}
