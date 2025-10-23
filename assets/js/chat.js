const chatContainer = document.getElementById("chat-container");
const sendBtn = document.getElementById("send-btn");
const input = document.getElementById("user-input");

let controller; // Abort controller for stopping
const memory = {};

// Create Stop Button
const stopBtn = document.createElement("button");
stopBtn.id = "stop-btn";
stopBtn.textContent = "⏹ Stop";
stopBtn.classList.add("stop-button");
stopBtn.style.display = "none";
document.querySelector("footer").appendChild(stopBtn);

// Append message with copy button if AI
function appendMessage(text, sender) {
  const msgBox = document.createElement("div");
  msgBox.classList.add("message", sender);

  const msgText = document.createElement("div");
  msgText.classList.add("msg-text");
  msgText.innerHTML = text.trim();

  msgBox.appendChild(msgText);

  // Add copy button for AI messages
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

// Reset UI state
function resetInput() {
  sendBtn.disabled = false;
  input.disabled = false;
  stopBtn.style.display = "none";
  input.focus();
}

// Send message to backend
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

    // Local smart rules (instant replies)
    if (lower.includes("your name") || lower.includes("who are you")) {
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
      } else typing.textContent = "Please tell me the color clearly!";
      resetInput();
      return;
    }

    if (
      lower.includes("which color is mine favorite") ||
      lower.includes("what is my favorite color")
    ) {
      typing.textContent = memory.favoriteColor
        ? `Your favorite color is ${memory.favoriteColor}.`
        : "I don't remember your favorite color yet. Please tell me!";
      resetInput();
      return;
    }

    // Call Cloudflare backend (Gemini)
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
        .replace(/\*\*/g, "")
        .replace(/\*/g, "")
        .replace(/\n/g, "<br>")
        .replace(/(\d+)\./g, "<br><b>$1.</b>")
        .replace(/•/g, "<br>•");

      typing.innerHTML = formatted;
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

// Stop AI mid-reply
stopBtn.addEventListener("click", () => {
  if (controller) controller.abort();
  stopBtn.style.display = "none";
});

// Send on Enter
sendBtn.addEventListener("click", sendMessage);
input.addEventListener("keypress", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
