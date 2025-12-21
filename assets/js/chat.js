const API = "https://dawn-smoke-b354.sleepyspider6166.workers.dev/";

const box = document.getElementById("chat-box");
const sendBtn = document.getElementById("send-btn");
const input = document.getElementById("user-input");

/* SESSION */
const clientId =
  localStorage.getItem("cloudai_client") ||
  (() => {
    const id = "web_" + Math.random().toString(36).slice(2, 9);
    localStorage.setItem("cloudai_client", id);
    return id;
  })();

let history = [];
let isProcessing = false;

/* USER */
function addUser(text) {
  const div = document.createElement("div");
  div.className = "user-msg";
  div.textContent = text;
  box.appendChild(div);
}

/* AI */
function addAI(html) {
  const div = document.createElement("div");
  div.className = "ai-msg";
  box.appendChild(div);

  typeHTML(div, html, () => {
    enhanceCodeBlocks(div);
    box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
  });
}

/* MARKDOWN (🔥 ISOLATED CODE BLOCKS) */
function renderMarkdown(text) {
  const blocks = [];
  let i = 0;

  text = text.replace(/```([\s\S]*?)```/g, (_, code) => {
    const key = `__CODE_${i}__`;
    blocks.push(`
<pre>
<button class="copy-btn">Copy</button>
<code>${escapeHtml(code)}</code>
</pre>`);
    i++;
    return key;
  });

  text = text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, `<code class="inline-code">$1</code>`)
    .replace(/### (.*)/g, "<h3>$1</h3>")
    .replace(/## (.*)/g, "<h2>$1</h2>")
    .replace(/# (.*)/g, "<h1>$1</h1>")
    .replace(/\n/g, "<br>");

  blocks.forEach((b, idx) => {
    text = text.replace(`__CODE_${idx}__`, b);
  });

  return text;
}

function escapeHtml(str) {
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

/* COPY */
function enhanceCodeBlocks(container) {
  container.querySelectorAll(".copy-btn").forEach(btn => {
    btn.onclick = () => {
      navigator.clipboard.writeText(btn.nextElementSibling.innerText);
      btn.textContent = "Copied ✓";
      setTimeout(() => btn.textContent = "Copy", 1200);
    };
  });
}

/* SEND */
async function sendMessage() {
  const msg = input.value.trim();
  if (!msg || isProcessing) return;

  isProcessing = true;
  addUser(msg);
  input.value = "";
  document.body.classList.add("ai-thinking");

  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: msg, history, clientId })
    });

    const data = await res.json();
    addAI(renderMarkdown(data.reply || "⚠️ Error"));

  } finally {
    isProcessing = false;
    document.body.classList.remove("ai-thinking");
  }
}

sendBtn.onclick = sendMessage;
input.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
