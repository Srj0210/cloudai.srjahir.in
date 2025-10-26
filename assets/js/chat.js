const API_URL = "https://dawn-smoke-b354.sleepyspider6166.workers.dev/";

const chatBox = document.getElementById("chat-box");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const logo = document.getElementById("ai-logo");

let history = [];
let isProcessing = false;
const clientId = "web_" + Math.random().toString(36).substring(2, 9);

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
  isProcessing = true;
  logo.classList.add("blinking");

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, prompt, history }),
    });

    const data = await res.json();

    if (data.reply) {
      appendMessage(data.reply, "ai-message");
      history.push({ role: "user", text: prompt });
      history.push({ role: "model", text: data.reply });

      // Quota Handling
      if (data.quotaStatus === "quota_warning") {
        appendMessage("⚠️ You’ve used 80% of your daily quota.", "ai-message");
      }
      if (data.quotaStatus === "quota_exceeded") {
        appendMessage("🚫 You’ve reached your daily limit. Try again after 24 hours.", "ai-message");
        disableInput();
      }
    } else {
      appendMessage("⚠️ No response from AI.", "ai-message");
    }
  } catch {
    appendMessage("⚠️ Network issue. Try again.", "ai-message");
  } finally {
    isProcessing = false;
    logo.classList.remove("blinking");
  }
}

function appendMessage(text, className) {
  const msg = document.createElement("div");
  msg.className = `message ${className}`;
  msg.innerHTML = renderMarkdown(text);
  chatBox.appendChild(msg);

  // Copy button for code blocks
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

function disableInput() {
  userInput.disabled = true;
  sendBtn.disabled = true;
  userInput.placeholder = "Daily quota reached. Try again tomorrow.";
}