const chatContainer = document.getElementById("chat-container");
const sendBtn = document.getElementById("send-btn");
const input = document.getElementById("user-input");

let controller; // for abort signal (stop button)
const memory = {};

// Add stop button dynamically
const stopBtn = document.createElement("button");
stopBtn.id = "stop-btn";
stopBtn.textContent = "⏹ Stop";
stopBtn.style.display = "none";
stopBtn.classList.add("stop-button");
document.querySelector("footer").appendChild(stopBtn);

// Append message box
function appendMessage(text, sender) {
  const msg = document.createElement("div");
  msg.classList.add("message", sender);
  msg.innerHTML = text.replace(/\n/g, "<br>");
  chatContainer.appendChild(msg);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  return msg;
}

// Typewriter effect (streaming)
async function typeEffect(element, text, speed = 20) {
  element.innerHTML = "";
  let i = 0;
  const interval = setInterval(() => {
    if (i < text.length) {
      element.innerHTML += text.charAt(i);
      chatContainer.scrollTop = chatContainer.scrollHeight;
      i++;
    } else {
      clearInterval(interval);
    }
  }, speed);
}

// Handle message
async function sendMessage() {
  const text = input.value.trim();
  if (!text) return;

  appendMessage(text, "user");
  input.value = "";

  const typing = appendMessage("💭 CloudAI is thinking...", "ai");
  sendBtn.disabled = true;
  input.disabled = true;
  stopBtn.style.display = "inline-block";

  controller = new AbortController();

  try {
    let lower = text.toLowerCase();

    // 🔹 CloudAI intro
    if (lower.includes("your name") || lower.includes("who are you")) {
      typing.textContent =
        "My name is CloudAI — your personal assistant by SRJahir Technologies.";
      resetInput();
      return;
    }

    // 🔹 Remember color
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

    // 🔹 Recall color
    if (
      lower.includes("which color is mine favorite") ||
      lower.includes("what is my favorite color")
    ) {
      if (memory.favoriteColor) {
        typing.textContent = `Your favorite color is ${memory.favoriteColor}.`;
      } else {
        typing.textContent =
          "I don't remember your favorite color yet. Please tell me!";
      }
      resetInput();
      return;
    }

    // 🔹 Fetch from backend
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
    typing.textContent = "";

    if (data.answer) {
      // Split into points if long
      let formatted = data.answer
        .replace(/\*\*/g, "")
        .replace(/\*/g, "")
        .split(/(?<=\.|\?|!)(\s+)/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .join("<br>• ");
      formatted = "• " + formatted;
      typeEffect(typing, formatted);
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

function resetInput() {
  sendBtn.disabled = false;
  input.disabled = false;
  stopBtn.style.display = "none";
  input.focus();
}

// Stop AI mid-reply
stopBtn.addEventListener("click", () => {
  if (controller) controller.abort();
  stopBtn.style.display = "none";
});

// Enter key send
sendBtn.addEventListener("click", sendMessage);
input.addEventListener("keypress", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
