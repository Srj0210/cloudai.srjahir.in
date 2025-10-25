// ==============================
// CloudAI Chat Script (Fixed)
// by SRJahir Technologies
// ==============================

// ✅ Cloudflare Worker endpoint
const apiUrl = "https://dawn-smoke-b354.sleepyspider6166.workers.dev/";

// Select DOM elements
const chatContainer = document.getElementById("chat-container");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

// Typing effect for AI messages
async function typeEffect(element, text, speed = 4) {
  for (let i = 0; i < text.length; i++) {
    element.innerHTML += text.charAt(i);
    await new Promise((resolve) => setTimeout(resolve, speed));
  }
}

// Function to append messages
function appendMessage(content, sender = "user") {
  const msg = document.createElement("div");
  msg.classList.add("message", sender);
  msg.innerHTML = content;
  chatContainer.appendChild(msg);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  return msg;
}

// Handle send button click
sendBtn.addEventListener("click", async () => {
  const prompt = userInput.value.trim();
  if (!prompt) return;

  // User message
  appendMessage(prompt, "user");
  userInput.value = "";

  // AI message placeholder
  const aiMsg = appendMessage("<span class='loading'>⏳ Thinking...</span>", "ai");

  try {
    // Call Cloudflare Worker
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({ prompt }),
      signal: AbortSignal.timeout(15000), // cancel if too slow
    });

    if (!response.ok) throw new Error("Worker response error");

    const data = await response.json();

    aiMsg.innerHTML = "";
    await typeEffect(aiMsg, data.reply || "⚠️ No response from CloudAI.");
  } catch (error) {
    aiMsg.innerHTML = "❌ Request cancelled or failed.";
    console.error("Error:", error);
  }
});

// Allow pressing Enter to send
userInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendBtn.click();
});
