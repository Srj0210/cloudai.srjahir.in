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
   UI HELPERS
   =============================== */
function addUser(text) {
  const div = document.createElement("div");
  div.className = "user-msg";
  div.textContent = text;
  box.appendChild(div);
}

function addAI(html) {
  const div = document.createElement("div");
  div.className = "ai-msg";
  div.innerHTML = html;
  box.appendChild(div);

  // 🔥 Prism highlight after render
  Prism.highlightAll();
}

function showAlert(msg) {
  const a = document.createElement("div");
  a.textContent = msg;
  Object.assign(a.style, {
    position: "fixed",
    bottom: "90px",
    left: "50%",
    transform: "translateX(-50%)",
    background: "#0078ff",
    color: "#fff",
    padding: "10px 16px",
    borderRadius: "10px",
    fontSize: "14px",
    zIndex: 9999
  });
  document.body.appendChild(a);
  setTimeout(() => a.remove(), 4000);
}

function disableInput() {
  input.disabled = true;
  sendBtn.disabled = true;
  input.placeholder = "Daily limit reached. Try again tomorrow.";
}

/* ===============================
   MARKDOWN RENDERER
   =============================== */
function renderMarkdown(text) {
  if (!text) return "";

  return text
    // code block ```lang
    .replace(/```(\w+)?([\s\S]*?)```/g, (_, lang, code) => {
      const language = lang || "javascript";
      return `<pre class="language-${language}"><code class="language-${language}">${escapeHtml(code)}</code></pre>`;
    })
    // inline code
    .replace(/`([^`]+)`/g, `<code class="inline-code">$1</code>`)
    // bold
    .replace(/\*\*(.*?)\*\*/g, `<strong>$1</strong>`)
    // italic
    .replace(/\*(.*?)\*/g, `<em>$1</em>`)
    // new lines
    .replace(/\n/g, "<br>");
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* ===============================
   SEND MESSAGE (FIXED)
   =============================== */
async function sendMessage() {
  const msg = input.value.trim();
  if (!msg || isProcessing) return;

  isProcessing = true;
  addUser(msg);
  input.value = "";

  history.push({ role: "user", text: msg });

  // 🔥 AI THINKING START (logo glow)
  document.body.classList.add("ai-thinking");

  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: msg, history, clientId })
    });

    const data = await res.json();
    const reply = data.reply || "⚠️ AI response not available.";

    // ✅ SINGLE RESPONSE ONLY (BUG FIX)
    addAI(renderMarkdown(reply));
    history.push({ role: "model", text: reply });

    if (data.quotaStatus === "quota_warning")
      showAlert("⚠️ 80% of daily quota used.");

    if (data.quotaStatus === "quota_exceeded") {
      showAlert("🚫 Daily quota reached.");
      disableInput();
    }

  } catch {
    addAI("⚠️ Network / Worker error.");
  } finally {
    isProcessing = false;
    document.body.classList.remove("ai-thinking"); // 🔥 stop glow
    box.scrollTop = box.scrollHeight;
  }
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
   📌 ATTACH MENU
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
  if (type === "file")  fileInput.click();
};

function handleFile(file) {
  if (!file) return;
  addUser(`📎 ${file.name}`);
}

cameraInput.onchange = () => handleFile(cameraInput.files[0]);
imageInput.onchange  = () => handleFile(imageInput.files[0]);
fileInput.onchange   = () => handleFile(fileInput.files[0]);

/* ===============================
   🎙️ VOICE INPUT
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
