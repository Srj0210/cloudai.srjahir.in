const API_URL = "https://cloudai.srjahir.workers.dev/";

const chatBox = document.getElementById("chat-box");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const fileBtn = document.getElementById("file-btn");
const fileInput = document.getElementById("file-input");
const micBtn = document.getElementById("mic-btn");
const LOGO = document.getElementById("ai-logo");

let history = [];
const MAX_HISTORY = 15;
let isProcessing = false;

sessionStorage.removeItem("cloudai_chat");  // always fresh

// --- Auto-resize ---
userInput.addEventListener("input", () => {
  userInput.style.height = "auto";
  userInput.style.height = Math.min(userInput.scrollHeight, 120) + "px";
});

// --- Send Events ---
sendBtn.addEventListener("click", sendMessage);
userInput.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// --- File Upload ---
fileBtn.onclick = () => fileInput.click();

fileInput.onchange = async () => {
  const file = fileInput.files[0];
  if (!file) return;
  addUserBubble(`📎 Uploaded: ${file.name}`);
  askCloudAI("", file);
};

// --- Voice Input ---
let recognition;
if ("webkitSpeechRecognition" in window) {
  recognition = new webkitSpeechRecognition();
  recognition.lang = "en-US";
  recognition.continuous = false;

  micBtn.onclick = () => {
    recognition.start();
    micBtn.textContent = "🎙️";
  };

  recognition.onresult = e => {
    let text = e.results[0][0].transcript;
    userInput.value = text;
    micBtn.textContent = "🎤";
  };

  recognition.onerror = () => micBtn.textContent = "🎤";
} else {
  micBtn.style.opacity = "0.3";
}

// --- UI Bubbles ---
function addUserBubble(text) {
  const msg = document.createElement("div");
  msg.className = "message user-message";
  const b = document.createElement("div");
  b.className = "message-content";
  b.innerText = text;
  msg.appendChild(b);
  chatBox.appendChild(msg);
  scrollBottom();
}

function addAiBubble(text) {
  const msg = document.createElement("div");
  msg.className = "message ai-message";
  const b = document.createElement("div");
  b.className = "message-content";
  b.innerHTML = renderMarkdown(text);
  msg.appendChild(b);
  chatBox.appendChild(msg);
  scrollBottom();
}

// --- Scroll ---
function scrollBottom() {
  setTimeout(() => {
    chatBox.scrollTop = chatBox.scrollHeight;
  }, 40);
}

// --- AI Glow ---
function startGlow() { LOGO.classList.add("thinking"); }
function stopGlow() { LOGO.classList.remove("thinking"); }

// --- Markdown ---
function renderMarkdown(text) {
  if (!text) return "";
  text = text.replace(/```([\s\S]*?)```/g, (_, c) => `<pre><code>${c}</code></pre>`);
  text = text.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
  text = text.replace(/\*(.*?)\*/g, "<i>$1</i>");
  text = text.replace(/\n/g, "<br>");
  return text;
}

// --- MAIN SEND ---
function sendMessage() {
  const t = userInput.value.trim();
  if (!t || isProcessing) return;

  addUserBubble(t);
  userInput.value = "";
  askCloudAI(t);
}

// --- SEND TO WORKER ---
async function askCloudAI(prompt, file = null) {
  isProcessing = true;
  startGlow();

  // thinking bubble
  const thinking = document.createElement("div");
  thinking.className = "message ai-message";
  thinking.innerHTML = `<div class="message-content">⏳ Thinking...</div>`;
  chatBox.appendChild(thinking);
  scrollBottom();

  // prepare payload
  const form = new FormData();
  form.append("prompt", prompt);
  form.append("history", JSON.stringify(history));
  if (file) form.append("file", file);

  try {
    const res = await fetch(API_URL, { method: "POST", body: form });
    const data = await res.json();

    thinking.remove();
    stopGlow();
    isProcessing = false;

    addAiBubble(data.reply);

    history.push({ role: "user", text: prompt });
    history.push({ role: "model", text: data.reply });
    if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);

    // --- suggestions like ChatGPT ---
    addAiBubble(
      `✨ <b>Suggested Questions</b><br>
      • Explain in simple words<br>
      • Give examples<br>
      • Continue<br>
      • Summarize this`
    );

  } catch (e) {
    thinking.remove();
    stopGlow();
    isProcessing = false;
    addAiBubble("⚠️ Network error. Try again.");
  }
}