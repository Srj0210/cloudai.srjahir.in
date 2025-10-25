// ===================================================
// CloudAI v8.2 Chat Script
// by SRJahir Technologies ⚡
// ===================================================

const API_URL = "https://dawn-smoke-b354.sleepyspider6166.workers.dev/";
const chatContainer = document.getElementById("chat-container");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

let chatHistory = [];

// === Add message to chat ===
function addMessage(text, sender, isCode = false) {
  const msg = document.createElement("div");
  msg.classList.add("message", sender);

  if (isCode) {
    msg.innerHTML = `<pre><code>${text}</code></pre><button class="copy-btn">Copy</button>`;
  } else {
    msg.innerHTML = text;
  }

  chatContainer.appendChild(msg);
  chatContainer.scrollTop = chatContainer.scrollHeight;

  // Enable copy button
  const copyBtn = msg.querySelector(".copy-btn");
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(text);
      copyBtn.textContent = "Copied!";
      setTimeout(() => (copyBtn.textContent = "Copy"), 2000);
    });
  }
}

// === Typing animation ===
function showTyping() {
  const typing = document.createElement("div");
  typing.classList.add("message", "ai");
  typing.innerHTML = `
    <div class="typing-dots">
      <span></span><span></span><span></span>
    </div>`;
  chatContainer.appendChild(typing);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  return typing;
}

// === Handle user message ===
async function sendMessage() {
  const prompt = userInput.value.trim();
  if (!prompt) return;

  addMessage(prompt, "user");
  userInput.value = "";

  const typingEl = showTyping();

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        history: chatHistory,
      }),
    });

    const data = await response.json();
    typingEl.remove();

    if (data.reply) {
      // Detect code blocks
      if (data.reply.includes("<") || data.reply.includes("```")) {
        const clean = data.reply.replace(/```[a-z]*|```/g, "");
        addMessage(clean, "ai", true);
        hljs.highlightAll();
      } else {
        addMessage(data.reply, "ai");
      }

      chatHistory.push({ role: "user", text: prompt });
      chatHistory.push({ role: "model", text: data.reply });
    } else {
      addMessage("⚠️ No response from CloudAI.", "ai");
    }
  } catch (err) {
    typingEl.remove();
    addMessage("⚠️ Connection failed. Please try again.", "ai");
    console.error("Error:", err);
  }
}

// === Send button + Enter key ===
sendBtn.addEventListener("click", sendMessage);
userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
