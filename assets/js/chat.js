const API_URL = "https://dawn-smoke-b354.sleepyspider6166.workers.dev/";
const chatBox = document.getElementById("chat-box");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

function appendMessage(text, sender) {
  const msgDiv = document.createElement("div");
  msgDiv.classList.add("message", sender === "user" ? "user-message" : "ai-message");

  if (text.includes("```")) {
    const parts = text.split("```");
    msgDiv.innerHTML = parts
      .map((part, i) =>
        i % 2 === 1
          ? `<pre><button class='copy-btn' onclick='copyCode(this)'>Copy</button><code>${part.trim()}</code></pre>`
          : `<p>${part}</p>`
      )
      .join("");
  } else {
    msgDiv.innerHTML = text.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>").replace(/\*(.*?)\*/g, "<i>$1</i>");
  }

  chatBox.appendChild(msgDiv);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function copyCode(btn) {
  const codeText = btn.nextElementSibling.innerText;
  navigator.clipboard.writeText(codeText);
  btn.textContent = "Copied!";
  setTimeout(() => (btn.textContent = "Copy"), 2000);
}

async function sendMessage() {
  const prompt = userInput.value.trim();
  if (!prompt) return;

  appendMessage(prompt, "user");
  userInput.value = "";

  const thinkingDiv = document.createElement("div");
  thinkingDiv.classList.add("message", "ai-message");
  thinkingDiv.innerHTML = "Thinking...";
  chatBox.appendChild(thinkingDiv);
  chatBox.scrollTop = chatBox.scrollHeight;

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        clientId: localStorage.getItem("cloudai_id") || crypto.randomUUID(),
      }),
    });

    const data = await res.json();
    chatBox.removeChild(thinkingDiv);

    if (data.error === "quota_exceeded") {
      appendMessage("🚫 You've used 100% of your CloudAI quota for today.", "ai");
      userInput.disabled = true;
      sendBtn.disabled = true;
      return;
    }

    if (data.quotaStatus === "quota_warning") {
      alert("⚠️ You've used 80% of your daily CloudAI quota.");
    }

    appendMessage(data.reply || "⚠️ No response from AI.", "ai");
  } catch (err) {
    chatBox.removeChild(thinkingDiv);
    appendMessage("⚠️ Network error or API not responding.", "ai");
  }
}

sendBtn.addEventListener("click", sendMessage);
userInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
