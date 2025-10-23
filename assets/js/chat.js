const chatContainer = document.getElementById("chat-container");
const sendBtn = document.getElementById("send-btn");
const input = document.getElementById("user-input");

let controller;
const memory = {};

const stopBtn = document.createElement("button");
stopBtn.id = "stop-btn";
stopBtn.textContent = "⏹ Stop";
stopBtn.classList.add("stop-button");
stopBtn.style.display = "none";
document.querySelector("footer").appendChild(stopBtn);

function appendMessage(text, sender) {
  const msgBox = document.createElement("div");
  msgBox.classList.add("message", sender);
  const msgText = document.createElement("div");
  msgText.classList.add("msg-text");

  // Format code blocks beautifully
  if (text.includes("```")) {
    const parts = text.split(/```/);
    msgText.innerHTML = parts
      .map((part, i) =>
        i % 2 === 1
          ? `<pre class="code-block"><code>${part.trim()}</code></pre>`
          : part.replace(/\n/g, "<br>")
      )
      .join("");
  } else {
    msgText.innerHTML = text
      .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
      .replace(/\n/g, "<br>");
  }

  msgBox.appendChild(msgText);

  // Copy button for AI messages
  if (sender === "ai") {
    const copyBtn = document.createElement("button");
    copyBtn.textContent = "📋 Copy";
    copyBtn.classList.add("copy-btn");
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(msgText.innerText);
      copyBtn.textContent = "✅ Copied!";
      setTimeout(() => (copyBtn.textContent = "📋 Copy"), 1500);
    };
    msgBox.appendChild(copyBtn);
  }

  chatContainer.appendChild(msgBox);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  return msgText;
}

function resetInput() {
  sendBtn.disabled = false;
  input.disabled = false;
  stopBtn.style.display = "none";
  input.focus();
}

async function sendMessage() {
  const text = input.value.trim();
  if (!text) return;

  appendMessage(text, "user");
  input.value = "";

  const typing = appendMessage("💭 Thinking...", "ai");
  sendBtn.disabled = true;
  input.disabled = true;
  stopBtn.style.display = "inline-block";

  controller = new AbortController();

  try {
    const lower = text.toLowerCase();

    // === Local memory & logic ===
    if (lower.includes("your name")) {
      typing.innerHTML =
        "My name is <b>CloudAI</b> — your personal assistant by SRJahir Technologies.";
      resetInput();
      return;
    }

    if (lower.includes("remember my favorite color is")) {
      const color = lower.split("remember my favorite color is")[1]?.trim();
      if (color) {
        memory.favoriteColor = color;
        typing.textContent = `Got it! I'll remember your favorite color is ${color}.`;
      }
      resetInput();
      return;
    }

    if (lower.includes("which color is mine favorite")) {
      typing.textContent = memory.favoriteColor
        ? `Your favorite color is ${memory.favoriteColor}.`
        : "I don't remember your favorite color yet.";
      resetInput();
      return;
    }

    // === Gemini backend call ===
    const response = await fetch(
      "https://dawn-smoke-b354.sleepyspider6166.workers.dev/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
        signal: controller.signal,
      }
    );

    const data = await response.json();
    typing.innerHTML = "";

    if (data.answer) {
      let formatted = data.answer
        .replace(/```(\w+)?/g, "```") // cleanup code tags
        .replace(/\*\*/g, "")
        .trim();
      appendMessage(formatted, "ai");
    } else {
      typing.textContent = "⚠️ No valid response from CloudAI.";
    }
  } catch (err) {
    if (err.name === "AbortError") {
      appendMessage("🛑 Response stopped by user.", "ai");
    } else {
      appendMessage("❌ Error connecting to CloudAI backend.", "ai");
    }
  } finally {
    resetInput();
  }
}

stopBtn.addEventListener("click", () => {
  if (controller) controller.abort();
  stopBtn.style.display = "none";
});

sendBtn.addEventListener("click", sendMessage);
input.addEventListener("keypress", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
