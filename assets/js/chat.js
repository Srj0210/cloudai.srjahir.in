// === CloudAI Chat Logic by SRJahir Technologies ===

const chatContainer = document.getElementById("chat-container");
const sendBtn = document.getElementById("send-btn");
const input = document.getElementById("user-input");

let controller;
const memory = {};

// Stop Button
const stopBtn = document.createElement("button");
stopBtn.id = "stop-btn";
stopBtn.textContent = "■ Stop";
stopBtn.classList.add("stop-button");
stopBtn.style.display = "none";
document.querySelector("footer").appendChild(stopBtn);

// === Add Message to Chat ===
function appendMessage(content, sender) {
  const msgBox = document.createElement("div");
  msgBox.classList.add("message", sender);

  // Add copy button
  const copyBtn = document.createElement("button");
  copyBtn.classList.add("copy-btn");
  copyBtn.textContent = "📋 Copy";
  copyBtn.onclick = () => {
    navigator.clipboard.writeText(msgBox.innerText);
    copyBtn.textContent = "✅ Copied!";
    setTimeout(() => (copyBtn.textContent = "📋 Copy"), 1500);
  };
  msgBox.appendChild(copyBtn);

  const msgText = document.createElement("div");
  msgText.classList.add("msg-text");

  // Format code blocks
  const parts = content.split(/```([\s\S]*?)```/g);
  msgText.innerHTML = parts
    .map((part, i) =>
      i % 2 === 1
        ? `<pre class="code-block" data-lang="${detectLang(part)}"><code>${escapeHtml(
            part.trim()
          )}</code></pre>`
        : part.replace(/\n/g, "<br>")
    )
    .join("");

  msgBox.appendChild(msgText);
  chatContainer.appendChild(msgBox);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// === Detect Language from Code Block ===
function detectLang(code) {
  if (code.includes("<html") || code.includes("<!DOCTYPE")) return "HTML";
  if (code.includes("console.log") || code.includes("function")) return "JS";
  if (code.includes("body {") || code.includes("background-color")) return "CSS";
  if (code.includes("def ") || code.includes("import")) return "Python";
  return "Code";
}

// === Escape HTML to Prevent Injection ===
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// === Send Message to AI ===
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
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=AIzaSyDn-vRZpHtA4vKHOZ-J1x5BGLy_QTUEQhY",
      {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: text }],
            },
          ],
        }),
      }
    );

    const data = await res.json();
    stopBtn.style.display = "none";

    let reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "⚠️ Sorry, I didn’t get a proper response.";

    // Filter only code if asked for 'code'
    if (text.toLowerCase().includes("code")) {
      const codeBlocks = reply.match(/```[\s\S]*?```/g);
      if (codeBlocks) reply = codeBlocks.join("\n\n");
    }

    typing.remove();
    appendMessage(reply, "ai");
  } catch (err) {
    typing.remove();
    appendMessage("❌ Request cancelled or failed.", "ai");
  }
}

// === Stop Button Click ===
stopBtn.addEventListener("click", () => {
  if (controller) controller.abort();
  stopBtn.style.display = "none";
});

// === Handle Send Button & Enter Key ===
sendBtn.addEventListener("click", sendMessage);
input.addEventListener("keypress", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
