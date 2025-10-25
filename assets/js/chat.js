const API_URL = "https://dawn-smoke-b354.sleepyspider6166.workers.dev/";
const chatContainer = document.getElementById("chat-container");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

let history = JSON.parse(localStorage.getItem("chatHistory")) || [];
let quota = JSON.parse(localStorage.getItem("userQuota")) || { used: 0, reset: Date.now() };

function checkQuota() {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  if (now - quota.reset > day) quota = { used: 0, reset: now };
  if (quota.used >= 100) {
    appendMessage("ai", "❌ You’ve used your 100% CloudAI quota. Try again after 24h.");
    return false;
  }
  if (quota.used === 80) appendMessage("ai", "⚠️ You’ve used 80% of your CloudAI quota.");
  return true;
}

function appendMessage(role, text) {
  const msg = document.createElement("div");
  msg.classList.add("message", role);
  msg.innerHTML = marked.parse(text);
  chatContainer.appendChild(msg);
  chatContainer.scrollTop = chatContainer.scrollHeight;

  // Add copy button after code highlight renders
  setTimeout(() => {
    msg.querySelectorAll("pre code").forEach(block => {
      hljs.highlightElement(block);
      const btn = document.createElement("button");
      btn.className = "copy-btn";
      btn.textContent = "Copy";
      btn.onclick = () => {
        navigator.clipboard.writeText(block.innerText);
        btn.textContent = "Copied!";
        setTimeout(() => (btn.textContent = "Copy"), 1500);
      };
      block.parentNode.appendChild(btn);
    });
  }, 50);
}

async function sendMessage() {
  const prompt = userInput.value.trim();
  if (!prompt || !checkQuota()) return;
  appendMessage("user", prompt);
  userInput.value = "";
  appendMessage("ai", "💭 CloudAI is thinking...");
  quota.used++;
  localStorage.setItem("userQuota", JSON.stringify(quota));
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, history }),
    });
    if (!res.ok) throw new Error("Network error");
    const data = await res.json();
    document.querySelector(".ai:last-child").remove();
    appendMessage("ai", data.reply || "⚠️ No response from CloudAI.");
    history.push({ role: "user", text: prompt }, { role: "model", text: data.reply });
    localStorage.setItem("chatHistory", JSON.stringify(history));
  } catch {
    document.querySelector(".ai:last-child").innerHTML = "⚠️ Connection failed. Try again.";
  }
}

sendBtn.addEventListener("click", sendMessage);
userInput.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
