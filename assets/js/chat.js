// ===================================================
// CloudAI v7 Hybrid Chat Script
// Gemini + Tavily + VS Code theme + Copy Button
// by SRJahir Technologies ⚡
// ===================================================

const chatContainer = document.getElementById("chat-container");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

let chatHistory = [];
let isGenerating = false;

// ⚙️ Replace with your Cloudflare Worker endpoint
const API_URL = "https://your-worker-name.workers.dev"; 

// ---------------------------------------------------
// ✉️ SEND MESSAGE
// ---------------------------------------------------
async function sendMessage() {
  if (isGenerating) return;
  const prompt = userInput.value.trim();
  if (!prompt) return;

  addMessage(prompt, "user");
  userInput.value = "";
  scrollToBottom();

  isGenerating = true;
  sendBtn.disabled = true;
  sendBtn.textContent = "Thinking...";

  const thinkingMsg = addMessage("💭 CloudAI is thinking...", "ai");

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

    if (data.error) {
      thinkingMsg.innerHTML = `<b>⚠️ Error:</b> ${data.error}`;
    } else {
      const formattedReply = formatMarkdown(data.reply || "⚠️ No reply found.");
      thinkingMsg.innerHTML = formattedReply;

      // 🌈 Apply VS Code style syntax highlighting
      document.querySelectorAll("pre code").forEach(block => {
        hljs.highlightElement(block);
      });

      // 📋 Add copy button to each code block
      document.querySelectorAll("pre").forEach(pre => {
        if (!pre.querySelector(".copy-btn")) {
          const copyBtn = document.createElement("button");
          copyBtn.className = "copy-btn";
          copyBtn.textContent = "Copy";
          copyBtn.onclick = () => copyCode(pre.innerText);
          pre.appendChild(copyBtn);
        }
      });

      // 💾 Update chat history
      chatHistory.push({ role: "user", text: prompt });
      chatHistory.push({ role: "model", text: data.reply });
    }
  } catch (err) {
    thinkingMsg.innerHTML = `<b>❌ Error:</b> ${err.message}`;
  }

  isGenerating = false;
  sendBtn.disabled = false;
  sendBtn.textContent = "Send";
  scrollToBottom();
}

// ---------------------------------------------------
// 💬 ADD MESSAGE TO CHAT UI
// ---------------------------------------------------
function addMessage(text, sender) {
  const msg = document.createElement("div");
  msg.classList.add("message", sender);

  const msgText = document.createElement("div");
  msgText.classList.add("msg-text");
  msgText.innerHTML = text;

  msg.appendChild(msgText);
  chatContainer.appendChild(msg);
  scrollToBottom();

  return msgText;
}

// ---------------------------------------------------
// 🧾 FORMAT MARKDOWN + CODE BLOCKS
// ---------------------------------------------------
function formatMarkdown(text) {
  let html = text
    // Bold **text**
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    // Inline `code`
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // Code blocks ```language ... ```
    .replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      const language = lang || "plaintext";
      const escaped = code.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return `<pre><code class="language-${language}">${escaped}</code></pre>`;
    })
    // Newlines
    .replace(/\n/g, "<br>");
  return html;
}

// ---------------------------------------------------
// 📋 COPY CODE BUTTON FUNCTION
// ---------------------------------------------------
function copyCode(codeText) {
  navigator.clipboard.writeText(codeText);
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = "✅ Code copied!";
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

// ---------------------------------------------------
// ⌨️ ENTER TO SEND
// ---------------------------------------------------
userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

sendBtn.addEventListener("click", sendMessage);

// ---------------------------------------------------
// 🔽 SCROLL TO BOTTOM
// ---------------------------------------------------
function scrollToBottom() {
  chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: "smooth" });
}
