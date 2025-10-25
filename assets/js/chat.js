// === CloudAI Chat.js (VS Code Style + Copy Button Edition) ===

const chatContainer = document.getElementById("chat-container");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

const API_URL = "https://dawn-smoke-b354.sleepyspider6166.workers.dev/";

function appendMessage(text, sender, isCode = false) {
  const msgDiv = document.createElement("div");
  msgDiv.classList.add("message", sender);

  if (isCode) {
    const codeBlock = document.createElement("pre");
    const codeEl = document.createElement("code");
    codeEl.textContent = text.trim();
    codeBlock.appendChild(codeEl);

    const copyBtn = document.createElement("button");
    copyBtn.className = "copy-btn";
    copyBtn.innerHTML = "📋 Copy";
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(text);
      copyBtn.innerText = "✅ Copied!";
      setTimeout(() => (copyBtn.innerText = "📋 Copy"), 1500);
    };

    const wrapper = document.createElement("div");
    wrapper.className = "code-wrapper";
    wrapper.append(copyBtn, codeBlock);
    msgDiv.appendChild(wrapper);

    // Highlight syntax
    setTimeout(() => hljs.highlightElement(codeEl), 50);
  } else {
    msgDiv.innerHTML = `<div class="msg-text">${text}</div>`;
  }

  chatContainer.appendChild(msgDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

async function sendMessage() {
  const prompt = userInput.value.trim();
  if (!prompt) return;

  appendMessage(prompt, "user");
  userInput.value = "";

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    const data = await response.json();
    if (data.reply) {
      const reply = data.reply;
      // Detect code block style from Gemini markdown
      if (reply.includes("<") && reply.includes(">") && reply.includes("</")) {
        appendMessage(reply, "ai");
      } else if (reply.match(/```[\s\S]+?```/)) {
        const code = reply.match(/```([\s\S]+?)```/)[1];
        appendMessage(code, "ai", true);
      } else {
        appendMessage(reply, "ai");
      }
    } else {
      appendMessage("⚠️ No response from CloudAI.", "ai");
    }
  } catch (err) {
    appendMessage("❌ Request failed. Please try again.", "ai");
  }
}

sendBtn.addEventListener("click", sendMessage);
userInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
