// === CloudAI v4 by SRJahir Technologies ===
// Clean version: no copy button, Gemini proxy fixed, safe rendering

const chatContainer = document.getElementById("chat-container");
const sendBtn = document.getElementById("send-btn");
const input = document.getElementById("user-input");

let controller;

// Stop Button
const stopBtn = document.createElement("button");
stopBtn.id = "stop-btn";
stopBtn.textContent = "■ Stop";
stopBtn.classList.add("stop-button");
stopBtn.style.display = "none";
document.querySelector("footer").appendChild(stopBtn);

// === Append Message ===
function appendMessage(content, sender) {
  const msgBox = document.createElement("div");
  msgBox.classList.add("message", sender);

  const msgText = document.createElement("div");
  msgText.classList.add("msg-text");

  // Split and detect code blocks
  const parts = content.split(/```([\s\S]*?)```/g);
  msgText.innerHTML = parts
    .map((part, i) =>
      i % 2 === 1
        ? `<pre class="code-block" data-lang="${detectLang(part)}"><code>${escapeHtml(
            part.trim()
          )}</code></pre>`
        : escapeHtml(part)
            .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
            .replace(/\n/g, "<br>")
            .replace(/^- /gm, "• ")
    )
    .join("");

  msgBox.appendChild(msgText);
  chatContainer.appendChild(msgBox);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// === Detect Programming Language ===
function detectLang(code) {
  code = code.toLowerCase();
  if (code.includes("<html") || code.includes("<body")) return "HTML";
  if (code.includes("console.log") || code.includes("function")) return "JavaScript";
  if (code.includes("background-color") || code.includes("margin")) return "CSS";
  if (code.includes("def ") || code.includes("import")) return "Python";
  if (code.includes("SELECT") || code.includes("FROM")) return "SQL";
  if (code.includes("<?php") || code.includes("echo")) return "PHP";
  return "Code";
}

// === Escape HTML for safety ===
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// === Send Message ===
async function sendMessage() {
  const text = input.value.trim();
  if (!text) return;

  appendMessage(text, "user");
  input.value = "";

  const typing = document.createElement("div");
  typing.classList.add("message", "ai");
  typing.innerHTML = `<span>💬 Thinking...</span>`;
  chatContainer.appendChild(typing);
  chatContainer.scrollTop = chatContainer.scrollHeight;

  controller = new AbortController();
  stopBtn.style.display = "inline-block";

  try {
    // ✅ Safe proxy (CORS fix)
    const proxyUrl = "https://api.codetabs.com/v1/proxy?quest=";
    const apiUrl =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=AIzaSyDn-vRZpHtA4vKHOZ-J1x5BGLy_QTUEQhY";

    const res = await fetch(proxyUrl + encodeURIComponent(apiUrl), {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text }] }],
      }),
    });

    const data = await res.json();
    stopBtn.style.display = "none";

    let reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "⚠️ Sorry, I couldn’t generate a response.";

    // If user asked for code, extract clean code block
    if (text.toLowerCase().includes("code")) {
      const codeBlocks = reply.match(/```[\s\S]*?```/g);
      if (codeBlocks?.length) {
        reply = codeBlocks.join("\n\n");
      } else {
        const htmlBlock = reply.match(/<html[\s\S]*<\/html>/i);
        if (htmlBlock) reply = "```html\n" + htmlBlock[0].trim() + "\n```";
        else reply = reply.split(/How to|Explanation|Steps|Save:/i)[0].trim();
      }
    }

    typing.remove();
    appendMessage(reply, "ai");
  } catch (err) {
    console.error("Error:", err);
    typing.remove();
    appendMessage("❌ Request cancelled or failed.", "ai");
  }
}

// === Stop Button ===
stopBtn.addEventListener("click", () => {
  if (controller) controller.abort();
  stopBtn.style.display = "none";
});

// === Send Events ===
sendBtn.addEventListener("click", sendMessage);
input.addEventListener("keypress", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
