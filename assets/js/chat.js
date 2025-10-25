// ==============================
// CloudAI Chat System (Stable Build)
// by SRJahir Technologies
// ==============================

const apiUrl = "https://dawn-smoke-b354.sleepyspider6166.workers.dev/";

const chatContainer = document.getElementById("chat-container");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

// Basic Markdown Renderer
function renderMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") // bold
    .replace(/`([^`]+)`/g, "<code>$1</code>") // inline code
    .replace(/```(\w+)?\n([\s\S]*?)```/g, "<pre><code>$2</code></pre>") // code block
    .replace(/\n/g, "<br>"); // new lines
}

async function typeEffect(element, html, speed = 5) {
  const temp = document.createElement("div");
  temp.innerHTML = html;
  const text = temp.textContent || temp.innerText || "";

  for (let i = 0; i < text.length; i++) {
    element.innerHTML = renderMarkdown(text.substring(0, i + 1));
    await new Promise((resolve) => setTimeout(resolve, speed));
  }
}

function appendMessage(content, sender = "user") {
  const msg = document.createElement("div");
  msg.classList.add("message", sender);
  msg.innerHTML = content;
  chatContainer.appendChild(msg);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  return msg;
}

async function sendMessage() {
  const prompt = userInput.value.trim();
  if (!prompt) return;

  appendMessage(prompt, "user");
  userInput.value = "";

  const aiMsg = appendMessage("⏳ Thinking...", "ai");

  let tries = 0;
  const maxTries = 2;

  while (tries < maxTries) {
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
        signal: AbortSignal.timeout(20000), // 20 sec timeout
      });

      if (!response.ok) throw new Error("Worker error");

      const data = await response.json();
      aiMsg.innerHTML = "";
      await typeEffect(aiMsg, renderMarkdown(data.reply || "⚠️ No response from CloudAI."));
      return;
    } catch (error) {
      console.warn("Attempt", tries + 1, "failed:", error);
      tries++;
      if (tries === maxTries) {
        aiMsg.innerHTML = "❌ Request failed after retry.";
      } else {
        aiMsg.innerHTML = "🔄 Retrying...";
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }
}

sendBtn.addEventListener("click", sendMessage);
userInput.addEventListener("keypress", (e) => e.key === "Enter" && sendMessage());
