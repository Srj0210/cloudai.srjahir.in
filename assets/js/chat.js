const API_URL = "https://dawn-smoke-b354.sleepyspider6166.workers.dev/";
const chatContainer = document.getElementById("chat-container");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const aiLogo = document.getElementById("ai-logo");

// Add message to chat
function addMessage(sender, text, isHTML = false) {
  const msg = document.createElement("div");
  msg.classList.add("message", sender, "glow");
  msg.innerHTML = isHTML ? text : marked.parse(text);
  chatContainer.appendChild(msg);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Typing indicator
function showTyping() {
  const typing = document.createElement("div");
  typing.classList.add("message", "ai", "typing");
  typing.innerHTML = `<span></span><span></span><span></span>`;
  chatContainer.appendChild(typing);
  aiLogo.classList.add("logo-thinking");
  chatContainer.scrollTop = chatContainer.scrollHeight;
  return typing;
}

// Copy button for code
function addCopyButtons() {
  document.querySelectorAll("pre code").forEach(block => {
    const btn = document.createElement("button");
    btn.textContent = "Copy";
    btn.className = "copy-btn";
    btn.onclick = () => {
      navigator.clipboard.writeText(block.textContent);
      btn.textContent = "Copied!";
      setTimeout(() => (btn.textContent = "Copy"), 1500);
    };
    block.parentNode.appendChild(btn);
  });
}

// Send message
async function sendMessage() {
  const text = userInput.value.trim();
  if (!text) return;
  addMessage("user", text);
  userInput.value = "";

  const typing = showTyping();

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: text }),
    });
    const data = await res.json();
    typing.remove();
    aiLogo.classList.remove("logo-thinking");

    const reply = data.reply || "⚠️ No response.";
    addMessage("ai", reply, true);

    Prism.highlightAll();
    addCopyButtons();
  } catch (err) {
    typing.remove();
    aiLogo.classList.remove("logo-thinking");
    addMessage("ai", "⚠️ Error: Gemini not responding.");
  }
}

sendBtn.addEventListener("click", sendMessage);
userInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});
