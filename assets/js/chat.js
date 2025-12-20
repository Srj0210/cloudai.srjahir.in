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

  enhanceCodeBlocks(div);
  Prism.highlightAll();
}

/* ===============================
   MARKDOWN RENDER
   =============================== */
function renderMarkdown(text) {
  if (!text) return "";

  let html = text;

  // CODE BLOCKS
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
    const language = lang || "javascript";
    return `
<pre class="language-${language}">
<button class="copy-btn">Copy</button>
<code class="language-${language}">${escapeHtml(code)}</code>
</pre>`;
  });

  // INLINE CODE
  html = html.replace(/`([^`]+)`/g, `<code class="inline-code">$1</code>`);

  // BOLD & ITALIC
  html = html.replace(/\*\*(.*?)\*\*/g, `<strong>$1</strong>`);
  html = html.replace(/\*(.*?)\*/g, `<em>$1</em>`);

  // LINKS
  html = html.replace(
    /(https?:\/\/[^\s<]+)/g,
    `<a href="$1" target="_blank" rel="noopener">$1</a>`
  );

  // NORMAL LINE BREAKS
  html = html.replace(/\n/g, "<br>");

  return html;
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
      setTimeout(() => (btn.textContent = "Copy"), 1500);
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
    const reply = data.reply || "⚠️ AI response not available.";

    addAI(renderMarkdown(reply));
    history.push({ role: "model", text: reply });

  } catch {
    addAI("⚠️ Network error.");
  } finally {
    isProcessing = false;
    document.body.classList.remove("ai-thinking");
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
