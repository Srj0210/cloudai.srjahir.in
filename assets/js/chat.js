const chatContainer = document.getElementById("chat-container");
const sendBtn = document.getElementById("send-btn");
const input = document.getElementById("user-input");

function appendMessage(text, sender) {
  const msg = document.createElement("div");
  msg.classList.add("message", sender);
  msg.textContent = text;
  chatContainer.appendChild(msg);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  return msg;
}

function typeEffect(element, text, speed = 30) {
  let i = 0;
  const interval = setInterval(() => {
    if (i < text.length) {
      element.textContent += text.charAt(i);
      i++;
      chatContainer.scrollTop = chatContainer.scrollHeight;
    } else clearInterval(interval);
  }, speed);
}

async function sendMessage() {
  const text = input.value.trim();
  if (!text) return;

  appendMessage(text, "user");
  input.value = "";

  const typing = appendMessage("💭 CloudAI is thinking...", "ai");

  try {
    const response = await fetch(
      "https://dawn-smoke-b354.sleepyspider6166.workers.dev/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      }
    );

    const data = await response.json();
    typing.textContent = "";

    if (data.answer) {
      typeEffect(typing, data.answer);
    } else {
      typing.textContent = "⚠️ No valid response from CloudAI.";
    }
  } catch (err) {
    typing.textContent = "❌ Error connecting to CloudAI backend.";
  }
}

sendBtn.addEventListener("click", sendMessage);
input.addEventListener("keypress", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
