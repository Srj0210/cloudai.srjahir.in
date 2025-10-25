const chatContainer = document.getElementById("chat-container");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

// Worker URL
const WORKER_URL = "https://dawn-smoke-b354.sleepyspider6166.workers.dev/"; // Replace with your deployed worker

// Local quota limit (resets every 24h)
const MAX_TOKENS_PER_DAY = 50;

// Check or reset daily quota
function getQuota() {
  const saved = JSON.parse(localStorage.getItem("cloudai_quota") || "{}");
  const today = new Date().toDateString();

  if (saved.date !== today) {
    localStorage.setItem("cloudai_quota", JSON.stringify({ date: today, used: 0 }));
    return 0;
  }
  return saved.used || 0;
}

function useQuota() {
  const saved = JSON.parse(localStorage.getItem("cloudai_quota") || "{}");
  const today = new Date().toDateString();
  const used = (saved.used || 0) + 1;
  localStorage.setItem("cloudai_quota", JSON.stringify({ date: today, used }));
  return used;
}

// Toast
function showToast(msg, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// Add message
function addMessage(role, text) {
  const div = document.createElement("div");
  div.className = `message ${role}`;
  div.innerHTML = text;
  chatContainer.appendChild(div);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Send
sendBtn.addEventListener("click", async () => {
  const prompt = userInput.value.trim();
  if (!prompt) return;

  addMessage("user", prompt);
  userInput.value = "";

  const quotaUsed = useQuota();
  if (quotaUsed > MAX_TOKENS_PER_DAY) {
    showToast("You used your 100% CloudAI quota.", "error");
    return;
  }

  addMessage("ai", "⏳ Thinking...");

  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, history: [] }),
    });

    const data = await res.json();
    document.querySelector(".message.ai:last-child").innerHTML = data.reply
      ? marked.parse(data.reply)
      : "⚠️ Gemini not responding. Try again.";

    hljs.highlightAll();
  } catch (err) {
    document.querySelector(".message.ai:last-child").innerHTML = "⚠️ Connection failed. Try again.";
  }
});
