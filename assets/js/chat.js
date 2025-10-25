// ==== CloudAI v8.5 (ChatGPT Layout + CloudAI Theme) ====

const chatContainer = document.getElementById("chatContainer");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const typingIndicator = document.getElementById("typingIndicator");

const API_URL = "https://dawn-smoke-b354.sleepyspider6166.workers.dev/";

let quota = JSON.parse(localStorage.getItem("cloudai_quota")) || { used: 0, reset: Date.now() + 24 * 60 * 60 * 1000 };
const DAILY_LIMIT = 50;

// Quota Reset Logic
if (Date.now() > quota.reset) {
  quota = { used: 0, reset: Date.now() + 24 * 60 * 60 * 1000 };
  localStorage.setItem("cloudai_quota", JSON.stringify(quota));
}

function appendMessage(content, sender = "ai") {
  const div = document.createElement("div");
  if (content.includes("<pre>")) {
    div.className = "code-block";
    div.innerHTML = content + `<button class="copy-btn">Copy</button>`;
  } else {
    div.className = `message ${sender}`;
    div.innerHTML = content;
  }
  chatContainer.appendChild(div);
  chatContainer.scrollTop = chatContainer.scrollHeight;

  const copyBtn = div.querySelector(".copy-btn");
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      const code = div.querySelector("pre").innerText;
      navigator.clipboard.writeText(code);
      copyBtn.innerText = "Copied!";
      setTimeout(() => (copyBtn.innerText = "Copy"), 1500);
    });
  }
}

async function sendMessage() {
  const prompt = userInput.value.trim();
  if (!prompt) return;

  if (quota.used >= DAILY_LIMIT) {
    appendMessage("⚠️ You used your 100% CloudAI quota for today.");
    return;
  }

  appendMessage(prompt, "user");
  userInput.value = "";

  typingIndicator.classList.remove("hidden");

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    typingIndicator.classList.add("hidden");

    if (!res.ok) {
      appendMessage("⚠️ Connection failed. Try again.");
      return;
    }

    const data = await res.json();
    quota.used++;
    localStorage.setItem("cloudai_quota", JSON.stringify(quota));

    appendMessage(data.reply);
  } catch (err) {
    typingIndicator.classList.add("hidden");
    appendMessage("⚠️ Network error. Please try again.");
  }
}

sendBtn.addEventListener("click", sendMessage);
userInput.addEventListener("keypress", e => {
  if (e.key === "Enter") sendMessage();
});
