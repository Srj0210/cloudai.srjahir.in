const API_URL = "https://dawn-smoke-b354.sleepyspider6166.workers.dev/";

const chatBox = document.getElementById("chat-box");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const logo = document.getElementById("ai-logo");

let history = [];
let isProcessing = false;
let quotaExceeded = false;
const clientId = "web_" + Math.random().toString(36).substring(2, 9);

// 🔁 Reset chat on full reload
window.addEventListener("load", () => {
  localStorage.removeItem("chat_history");
});

// Input auto expand
userInput.addEventListener("input", () => {
  userInput.style.height = "auto";
  userInput.style.height = Math.min(userInput.scrollHeight, 120) + "px";
});

// Send events
sendBtn.addEventListener("click", sendMessage);
userInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

async function sendMessage() {
  const prompt = userInput.value.trim();
  if (!prompt || isProcessing || quotaExceeded) return;

  appendMessage(prompt, "user-message");
  userInput.value = "";
  userInput.style.height = "auto";
  isProcessing = true;
  logo.classList.add("thinking");

  appendMessage("⏳ Thinking...", "ai-message");
  const tempMsg = document.querySelector(".ai-message:last-child");

  try {
    const reply = await fetchAIResponseWithRetry(prompt, 2);

    tempMsg.remove();
    appendMessage(reply, "ai-message");

    history.push({ role: "user", text: prompt });
    history.push({ role: "model", text: reply });
  } catch {
    tempMsg.remove();
    appendMessage("⚠️ Network issue. Try again later.", "ai-message");
  } finally {
    isProcessing = false;
    logo.classList.remove("thinking");
  }
}

// ===================== ⚙️ SMART FETCH SYSTEM =====================
async function fetchAIResponseWithRetry(prompt, retries = 2) {
  const smartPrompt = applyLanguageLock(prompt);

  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          prompt: smartPrompt,
          history,
          tools: { web: true },
        }),
      });

      const data = await res.json();

      // 🧾 QUOTA CONTROL
      if (data.quotaStatus === "quota_exceeded") {
        showAlert("🚫 Daily quota reached. Try again after 24 hours.");
        disableInput();
        quotaExceeded = true;
        return "🚫 Daily quota reached. Try again tomorrow.";
      }
      if (data.quotaStatus === "quota_warning") showAlert("⚠️ 80% quota used.");

      // 🧠 VALIDATE RESPONSE
      if (data.reply && data.reply.trim() !== "") {
        let output = data.reply.trim();

        // 🔍 Detect incomplete or truncated response
        if (detectTruncatedResponse(output) && i < retries) {
          console.log("⏩ Detected incomplete answer, fetching continuation...");
          const cont = await fetchContinuation(prompt);
          output += "\n\n" + cont;
        }

        return output;
      } else {
        console.warn(`⚠️ Empty or invalid response — retrying (${i + 1}/${retries})...`);
      }
    } catch (err) {
      console.error("❌ Fetch error:", err);
    }
  }

  return "⚠️ No valid response received after multiple attempts. Please try again later.";
}

// 🔄 Fetch continuation if incomplete
async function fetchContinuation(previousPrompt) {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        prompt: previousPrompt + " (continue the same content, same language only)",
        history,
        tools: { web: false },
      }),
    });
    const data = await res.json();
    return data.reply ? data.reply.trim() : "";
  } catch {
    return "";
  }
}

// ===================== 🧩 LANGUAGE LOCK SYSTEM =====================
function applyLanguageLock(prompt) {
  const devanagariRegex = /[\u0900-\u097F]/; // Hindi/Sanskrit script
  const wantsTranslation = /\btranslate\b|अनुवाद|भाषांतर/i.test(prompt);

  if (quotaExceeded) return prompt; // Stop everything if quota done

  if (wantsTranslation) {
    return prompt; // Allow translation only if user asks
  } else if (devanagariRegex.test(prompt)) {
    return (
      "उत्तर केवल उसी भाषा (हिंदी/संस्कृत) में दो, जिसमें प्रश्न पूछा गया है। " +
      "किसी प्रकार का अनुवाद या व्याख्या मत दो।\n\n" +
      prompt
    );
  } else {
    return (
      "Answer strictly in the same language as the user's message. " +
      "Do not translate or explain in other languages unless explicitly asked.\n\n" +
      prompt
    );
  }
}

// ===================== 🧠 DETECT TRUNCATION =====================
function detectTruncatedResponse(text) {
  const incompletePatterns = /[\u0900-\u097F]+$|[a-zA-Z]+$/;
  const lastChar = text.trim().slice(-1);
  return ![".", "!", "?", "॥", "।"].includes(lastChar) && incompletePatterns.test(text);
}

// ===================== 🖋️ UI FUNCTIONS =====================
function appendMessage(text, className) {
  const msg = document.createElement("div");
  msg.className = `message ${className}`;
  msg.innerHTML = renderMarkdown(text);
  chatBox.appendChild(msg);

  msg.querySelectorAll("pre code").forEach((block) => {
    const copyBtn = document.createElement("button");
    copyBtn.className = "copy-btn";
    copyBtn.textContent = "Copy";
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(block.innerText);
      copyBtn.textContent = "Copied!";
      setTimeout(() => (copyBtn.textContent = "Copy"), 2000);
    };
    block.parentNode.appendChild(copyBtn);
    hljs.highlightElement(block);
  });

  chatBox.scrollTop = chatBox.scrollHeight;
}

function renderMarkdown(text) {
  const escapeHTML = (str) =>
    str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  text = text.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${escapeHTML(code)}</code></pre>`);
  text = text.replace(/`([^`]+)`/g, (_, code) => `<code>${escapeHTML(code)}</code>`);
  text = text.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
  text = text.replace(/\*(.*?)\*/g, "<i>$1</i>");
  return text.replace(/\n/g, "<br>");
}

function showAlert(msg) {
  const alertBox = document.createElement("div");
  alertBox.textContent = msg;
  Object.assign(alertBox.style, {
    position: "fixed",
    bottom: "80px",
    left: "50%",
    transform: "translateX(-50%)",
    background: "#00b7ff",
    color: "white",
    padding: "10px 20px",
    borderRadius: "8px",
    fontSize: "14px",
    zIndex: "1000",
  });
  document.body.appendChild(alertBox);
  setTimeout(() => alertBox.remove(), 4000);
}

function disableInput() {
  userInput.disabled = true;
  sendBtn.disabled = true;
  userInput.placeholder = "Daily limit reached. Try again tomorrow.";
}