const chatContainer = document.getElementById("chat-container");
const sendBtn = document.getElementById("send-btn");
const input = document.getElementById("user-input");

// 🧠 In-memory storage (temporary)
const memory = {};

// Append messages
function appendMessage(text, sender) {
  const msg = document.createElement("div");
  msg.classList.add("message", sender);
  msg.textContent = text;
  chatContainer.appendChild(msg);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  return msg;
}

// Typing effect
function typeEffect(element, text, speed = 25) {
  let i = 0;
  const interval = setInterval(() => {
    if (i < text.length) {
      element.textContent += text.charAt(i);
      i++;
      chatContainer.scrollTop = chatContainer.scrollHeight;
    } else clearInterval(interval);
  }, speed);
}

// Main send function
async function sendMessage() {
  const text = input.value.trim();
  if (!text) return;

  appendMessage(text, "user");
  input.value = "";

  const typing = appendMessage("💭 CloudAI is thinking...", "ai");
  sendBtn.disabled = true;
  input.disabled = true;

  try {
    // 🧠 Simple local intelligence (before calling API)
    let lower = text.toLowerCase();

    // Case 1: If user asks CloudAI's name
    if (lower.includes("your name") || lower.includes("who are you")) {
      typing.textContent =
        "My name is CloudAI — your personal assistant by SRJahir Technologies.";
      resetInput();
      return;
    }

    // Case 2: Remember facts (e.g., favorite color)
    if (lower.includes("remember my favorite color is")) {
      const color = lower.split("remember my favorite color is")[1]?.trim();
      if (color) {
        memory.favoriteColor = color;
        typing.textContent = `Got it! Your favorite color is ${color}. I'll remember that for now.`;
      } else {
        typing.textContent = "Please tell me the color clearly!";
      }
      resetInput();
      return;
    }

    // Case 3: Recall favorite color
    if (lower.includes("which color is mine favorite") || lower.includes("what is my favorite color")) {
      if (memory.favoriteColor) {
        typing.textContent = `Your favorite color is ${memory.favoriteColor}.`;
      } else {
        typing.textContent = "I don't remember your favorite color yet. Please tell me!";
      }
      resetInput();
      return;
    }

    // Otherwise — call Cloudflare backend
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
  } finally {
    resetInput();
  }
}

function resetInput() {
  sendBtn.disabled = false;
  input.disabled = false;
  input.focus();
}

// Listeners
sendBtn.addEventListener("click", sendMessage);
input.addEventListener("keypress", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
