const API_URL = "https://dawn-smoke-b354.sleepyspider6166.workers.dev/";

const chatBox = document.getElementById("chat-box");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const logo = document.getElementById("ai-logo");

let history = [];
let isProcessing = false;
const clientId = "web_" + Math.random().toString(36).substring(2, 9);

// Auto resize input
userInput.addEventListener("input", () => {
  userInput.style.height = "auto";
  userInput.style.height = userInput.scrollHeight + "px";
});

// Send message
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
  logo.style.animation = "reactorGlow 1s infinite ease-in-out";

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
    logo.style.animation = "reactorGlow 3s infinite ease-in-out";
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

function renderMarkdown(text) {
  text = text.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
  text = text.replace(/\*(.*?)\*/g, "<i>$1</i>");
  text = text.replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>");
  text = text.replace(/`([^`]+)`/g, "<code>$1</code>");
  text = text.replace(/\n/g, "<br>");
  return text;
}

function showAlert(msg) {
  const alertBox = document.createElement("div");
  alertBox.textContent = msg;
  alertBox.style.position = "fixed";
  alertBox.style.bottom = "80px";
  alertBox.style.left = "50%";
  alertBox.style.transform = "translateX(-50%)";
  alertBox.style.background = "#00b7ff";
  alertBox.style.color = "white";
  alertBox.style.padding = "10px 20px";
  alertBox.style.borderRadius = "8px";
  alertBox.style.fontSize = "14px";
  alertBox.style.zIndex = "1000";
  document.body.appendChild(alertBox);
  setTimeout(() => alertBox.remove(), 4000);
}

function disableInput() {
  userInput.disabled = true;
  sendBtn.disabled = true;
  userInput.placeholder = "Daily limit reached. Try again tomorrow.";
}