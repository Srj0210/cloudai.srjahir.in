const API = "https://dawn-smoke-b354.sleepyspider6166.workers.dev/";

const chatBox = document.getElementById("chat-box");
const input = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

function addUser(text) {
  const d = document.createElement("div");
  d.className = "user-msg";
  d.textContent = text;
  chatBox.appendChild(d);
}

function addAI(text) {
  const d = document.createElement("div");
  d.className = "ai-msg";
  d.textContent = text;
  chatBox.appendChild(d);
}

async function sendMessage() {
  const msg = input.value.trim();
  if (!msg) return;

  addUser(msg);
  input.value = "";

  const thinking = document.createElement("div");
  thinking.className = "ai-msg";
  thinking.textContent = "Thinking...";
  chatBox.appendChild(thinking);

  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: msg,
        clientId: "live_" + Date.now()
      })
    });

    const data = await res.json();
    thinking.textContent = data.reply || "⚠️ No response";

  } catch {
    thinking.textContent = "⚠️ Network error";
  }

  chatBox.scrollTop = chatBox.scrollHeight;
}

sendBtn.onclick = sendMessage;

input.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
