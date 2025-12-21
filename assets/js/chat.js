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
   QUOTA UI HELPERS
   =============================== */
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
   USER MESSAGE
   =============================== */
function addUser(text) {
  const div = document.createElement("div");
  div.className = "user-msg";
  div.textContent = text;
  box.appendChild(div);
  scrollBottom();
}

/* ===============================
   AI MESSAGE (TYPING SUPPORT)
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
  scrollBottom();
}

/* ===============================
   MARKDOWN RENDER (SAFE)
   =============================== */
function renderMarkdown(text) {
  if (!text) return "";

  const blocks = [];
  let idx = 0;

  text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
    const key = `__CODE_${idx}__`;
    blocks.push(`
<pre class="language-${lang || "javascript"}">
<button class="copy-btn">Copy</button>
<code class="language-${lang || "javascript"}">${escapeHtml(code)}</code>
</pre>`);
    idx++;
    return key;
  });

  text = text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, `<code class="inline-code">$1</code>`)
    .replace(
      /(https?:\/\/[^\s<]+)/g,
      `<a href="$1" target="_blank" rel="noopener">$1</a>`
    )
    .replace(/\n/g, "<br>");

  blocks.forEach((b, i) => {
    text = text.replace(`__CODE_${i}__`, b);
  });

  return text;
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
}

/* ===============================
   COPY BUTTON
   =============================== */
function enhanceCodeBlocks(container) {
  container.querySelectorAll(".copy-btn").forEach(btn => {
    btn.onclick = () => {
      const code = btn.nextElementSibling.innerText;
      navigator.clipboard.writeText(code);
      btn.textContent = "Copied ✓";
      setTimeout(() => (btn.textContent = "Copy"), 1200);
    };
  });
}

/* ===============================
   SEND MESSAGE (WITH QUOTA)
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

    const reply = data.reply || "⚠️ AI response not available.";
    addAI(renderMarkdown(reply));
    history.push({ role: "model", text: reply });

    /* ===== QUOTA HANDLING ===== */
    if (data.quotaStatus === "quota_warning") {
      showAlert("⚠️ 80% of daily quota used");
    }

    if (data.quotaStatus === "quota_exceeded") {
      showAlert("🚫 Daily quota reached");
      disableInput();
    }

  } catch {
    addAI("⚠️ Network error. Please try again.");
  } finally {
    isProcessing = false;
    document.body.classList.remove("ai-thinking");
  }
}

/* ===============================
   SCROLL FIX
   =============================== */
function scrollBottom() {
  requestAnimationFrame(() => {
    box.scrollTop = box.scrollHeight + 200;
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
   ATTACH MENU
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

/* ===============================
   VOICE INPUT
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
