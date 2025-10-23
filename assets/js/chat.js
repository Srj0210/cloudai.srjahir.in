const chatContainer = document.getElementById("chat-container");
const sendBtn = document.getElementById("send-btn");
const input = document.getElementById("user-input");

function appendMessage(text, sender) {
  const msg = document.createElement("div");
  msg.classList.add("message", sender);
  msg.textContent = text;
  chatContainer.appendChild(msg);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

async function sendMessage() {
  const text = input.value.trim();
  if (!text) return;

  appendMessage(text, "user");
  input.value = "";

  const typing = document.createElement("div");
  typing.classList.add("message", "ai");
  typing.textContent = "💭 CloudAI is thinking...";
  chatContainer.appendChild(typing);

  try {
    const response = await fetch("https://dawn-smoke-b354.sleepyspider6166.workers.dev", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });

    const data = await response.json();
    typing.remove();
    appendMessage(data.answer || "⚠️ No response received.", "ai");
  } catch (err) {
    typing.remove();
    appendMessage("❌ Error connecting to CloudAI backend.", "ai");
  }
}

sendBtn.addEventListener("click", sendMessage);
input.addEventListener("keypress", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
