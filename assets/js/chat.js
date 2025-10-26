const API_URL = "https://dawn-smoke-b354.sleepyspider6166.workers.dev/";

const chatBox = document.getElementById("chat-box");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const logo = document.getElementById("ai-logo");

let history = [];
let isProcessing = false;
const clientId = "web_" + Math.random().toString(36).substring(2, 9);

// Restore last 5 messages
window.addEventListener("load", () => {
  const saved = JSON.parse(localStorage.getItem("chat_history")) || [];
  history = saved.slice(-5);
  for (const msg of history) appendMessage(msg.text, msg.role === "user" ? "user-message" : "ai-message");
});

// Input auto expand
userInput.addEventListener("input", () => {
  userInput.style.height = "auto";
  userInput.style.height = Math.min(userInput.scrollHeight, 120) + "px";
});

// Send events
sendBtn.addEventListener("click", sendMessage);
userInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

async function sendMessage() {
  const prompt = userInput.value.trim();
  if (!prompt || isProcessing) return;

  appendMessage(prompt, "user-message");
  userInput.value = "";
  userInput.style.height = "auto";
  isProcessing = true;
  logo.classList.add("thinking");

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, prompt, history, tools: { web: true } }),
    });

    const data = await res.json();
    if (data.reply) {
      appendMessage(data.reply, "ai-message");

      history.push({ role: "user", text: prompt });
      history.push({ role: "model", text: data.reply });
      localStorage.setItem("chat_history", JSON.stringify(history.slice(-5)));

      if (data.quotaStatus === "quota_warning") showAlert("⚠️ 80% quota used.");
      if (data.quotaStatus === "quota_exceeded") {
        showAlert("🚫 Daily quota reached. Try again after 24 hours.");
        disableInput();
      }
    } else appendMessage("⚠️ No response from AI.", "ai-message");
  } catch {
    appendMessage("⚠️ Network issue. Try again later.", "ai-message");
  } finally {
    isProcessing = false;
    logo.classList.remove("thinking");
  }
}

function appendMessage(text, className) {
  const msg = document.createElement("div");
  msg.className = `message ${className}`;
  msg.innerHTML = renderMarkdown(text);
  chatBox.appendChild(msg);

  msg.querySelectorAll("pre code").forEach((block) => {
    const copyBtn = document.createElement("button");
    copyBtn.className = "copy-btn";
    copyBtn.textContent = "Copy";
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(block.innerText);
      copyBtn.textContent = "Copied!";
      setTimeout(() => (copyBtn.textContent = "Copy"), 2000);
    };
    block.parentNode.appendChild(copyBtn);
    hljs.highlightElement(block);
  });

  chatBox.scrollTop = chatBox.scrollHeight;
}

// Markdown safe render
function renderMarkdown(text) {
  const escapeHTML = (str) =>
    str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  text = text.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${escapeHTML(code)}</code></pre>`);
  text = text.replace(/`([^`]+)`/g, (_, code) => `<code>${escapeHTML(code)}</code>`);
  text = text.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
  text = text.replace(/\*(.*?)\*/g, "<i>$1</i>");
  return text.replace(/\n/g, "<br>");
}

function showAlert(msg) {
  const alertBox = document.createElement("div");
  alertBox.textContent = msg;
  Object.assign(alertBox.style, {
    position: "fixed",
    bottom: "80px",
    left: "50%",
    transform: "translateX(-50%)",
    background: "#00b7ff",
    color: "white",
    padding: "10px 20px",
    borderRadius: "8px",
    fontSize: "14px",
    zIndex: "1000",
  });
  document.body.appendChild(alertBox);
  setTimeout(() => alertBox.remove(), 4000);
}

function disableInput() {
  userInput.disabled = true;
  sendBtn.disabled = true;
  userInput.placeholder = "Daily limit reached. Try again tomorrow.";
  localStorage.removeItem("chat_history");
}