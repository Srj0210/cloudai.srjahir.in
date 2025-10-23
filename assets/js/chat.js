const chatContainer = document.getElementById("chat-container");
const sendBtn = document.getElementById("send-btn");
const input = document.getElementById("user-input");

// Append message bubbles
function appendMessage(text, sender) {
  const msg = document.createElement("div");
  msg.classList.add("message", sender);
  msg.textContent = text;
  chatContainer.appendChild(msg);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Send message to backend (replace URL later with your Worker API)
async function sendMessage() {
  const text = input.value.trim();
  if (!text) return;

  appendMessage(text, "user");
  input.value = "";

  // Show "typing..."
  const typing = document.createElement("div");
  typing.classList.add("message", "ai");
  typing.textContent = "💭 CloudAI is thinking...";
  chatContainer.appendChild(typing);

  try {
    // Replace with your Cloudflare Worker API endpoint later
    const response = await fetch("https://api.cloudai.srjahir.in/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: text }),
    });

    const data = await response.json();
    typing.remove();
    appendMessage(data.reply || "⚠️ No response received.", "ai");
  } catch (err) {
    typing.remove();
    appendMessage("❌ Error connecting to CloudAI backend.", "ai");
  }
}

// Event listeners
sendBtn.addEventListener("click", sendMessage);
input.addEventListener("keypress", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
