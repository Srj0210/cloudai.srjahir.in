// CloudAI Hybrid Chat (v8)
// by SRJahir Technologies ⚡

const API_URL = "https://dawn-smoke-b354.sleepyspider6166.workers.dev/"; // Cloudflare Worker endpoint

const chatContainer = document.getElementById("chat-container");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

let chatHistory = [];

// --- Scroll helper ---
function scrollToBottom() {
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// --- Add messages to chat window ---
function addMessage(role, text) {
  const msg = document.createElement("div");
  msg.className = `message ${role}`;

  // Detect code blocks and highlight
  if (text.includes("```")) {
    const parts = text.split(/```(\w+)?\n([\s\S]*?)```/g);
    parts.forEach((part, i) => {
      if (i % 3 === 2) {
        const lang = parts[i - 1] || "plaintext";
        const pre = document.createElement("pre");
        pre.className = "code-block";
        pre.setAttribute("data-lang", lang);

        const code = document.createElement("code");
        code.textContent = part.trim();

        // Highlight + copy button
        hljs.highlightElement(code);
        pre.appendChild(code);

        const copyBtn = document.createElement("button");
        copyBtn.className = "copy-btn";
        copyBtn.textContent = "Copy";
        copyBtn.onclick = () => {
          navigator.clipboard.writeText(part.trim());
          copyBtn.textContent = "Copied!";
          setTimeout(() => (copyBtn.textContent = "Copy"), 1500);
        };

        pre.appendChild(copyBtn);
        msg.appendChild(pre);
      } else if (part.trim()) {
        const p = document.createElement("div");
        p.className = "msg-text";
        p.innerHTML = part.trim().replace(/\n/g, "<br>");
        msg.appendChild(p);
      }
    });
  } else {
    msg.innerHTML = `<div class="msg-text">${text}</div>`;
  }

  chatContainer.appendChild(msg);
  scrollToBottom();
}

// --- Send message ---
async function sendMessage() {
  const prompt = userInput.value.trim();
  if (!prompt) return;

  addMessage("user", prompt);
  userInput.value = "";
  scrollToBottom();

  addMessage("ai", "<i>Thinking...</i>");

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, history: chatHistory }),
    });

    if (!response.ok) throw new Error("Failed to reach CloudAI API");

    const data = await response.json();
    const aiReply = data.reply || "⚠️ No response from AI.";

    // Replace last "Thinking..." with actual reply
    chatContainer.lastElementChild.remove();
    addMessage("ai", aiReply);

    chatHistory.push({ role: "user", text: prompt });
    chatHistory.push({ role: "model", text: aiReply });
  } catch (err) {
    chatContainer.lastElementChild.remove();
    addMessage("ai", `❌ <b>Error:</b> ${err.message}`);
  }
}

// --- Event listeners ---
sendBtn.addEventListener("click", sendMessage);
userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
