// ==== CloudAI v8.7 — Fluid Glow Edition ====

const API_URL = "https://dawn-smoke-b354.sleepyspider6166.workers.dev/";

const chatContainer = document.getElementById("chatContainer");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const typingIndicator = document.getElementById("typingIndicator");
const aiLogo = document.getElementById("aiLogo");
const thinkingText = document.getElementById("thinkingText");

function appendMessage(content, sender = "ai") {
  const div = document.createElement("div");
  if (content.includes("<pre")) {
    div.className = "code-block glow";
    div.innerHTML = content + `<button class="copy-btn">Copy</button>`;
  } else {
    div.className = `message ${sender} glow`;
    div.innerHTML = content;
  }
  chatContainer.appendChild(div);
  chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: "smooth" });

  const copyBtn = div.querySelector(".copy-btn");
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      const code = div.querySelector("code").innerText;
      navigator.clipboard.writeText(code);
      copyBtn.innerText = "Copied!";
      setTimeout(() => (copyBtn.innerText = "Copy"), 1500);
    });
  }
}

async function sendMessage() {
  const prompt = userInput.value.trim();
  if (!prompt) return;

  appendMessage(prompt, "user");
  userInput.value = "";

  typingIndicator.classList.remove("hidden");
  aiLogo.classList.add("logo-thinking");
  thinkingText.classList.remove("hidden");

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    typingIndicator.classList.add("hidden");
    aiLogo.classList.remove("logo-thinking");
    thinkingText.classList.add("hidden");

    if (!res.ok) {
      appendMessage("⚠️ Connection failed. Try again.");
      return;
    }

    const data = await res.json();
    let reply = data.reply.replace(/```(\w+)?([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre><code class="language-${lang || "markup"}">${Prism.highlight(
        code,
        Prism.languages[lang || "markup"],
        lang || "markup"
      )}</code></pre>`;
    });

    appendMessage(reply);
  } catch (err) {
    typingIndicator.classList.add("hidden");
    aiLogo.classList.remove("logo-thinking");
    thinkingText.classList.add("hidden");
    appendMessage("⚠️ Network error. Please try again.");
  }
}

sendBtn.addEventListener("click", sendMessage);
userInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});
