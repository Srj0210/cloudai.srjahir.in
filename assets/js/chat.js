const chatBox = document.getElementById("chat-box");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

const LOGO = document.getElementById("ai-logo");

/* RESET CHAT EVERY REFRESH — SUPER IMPORTANT */
sessionStorage.removeItem("cloudai_chat");

/* SEND MESSAGE */
sendBtn.onclick = () => handleSend();
userInput.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

function handleSend() {
  let text = userInput.value.trim();
  if (!text) return;

  addUserBubble(text);
  userInput.value = "";

  askCloudAI(text);
}

/* USER BUBBLE */
function addUserBubble(text) {
  const wrap = document.createElement("div");
  wrap.className = "message user";

  const bubble = document.createElement("div");
  bubble.className = "bubble user-bubble";
  bubble.innerText = text;

  wrap.appendChild(bubble);
  chatBox.appendChild(wrap);
  scrollToBottom();
}

/* AI BUBBLE */
function addAiBubble(text) {
  const wrap = document.createElement("div");
  wrap.className = "message ai";

  const bubble = document.createElement("div");
  bubble.className = "bubble ai-bubble";
  bubble.innerHTML = text;

  wrap.appendChild(bubble);
  chatBox.appendChild(wrap);

  hljs.highlightAll();
  scrollToBottom();
}

/* SCROLL */
function scrollToBottom() {
  setTimeout(() => {
    chatBox.scrollTop = chatBox.scrollHeight;
  }, 50);
}

/* GLOW WHILE THINKING */
function startGlow() {
  LOGO.style.filter = "drop-shadow(0 0 18px #0af)";
}
function stopGlow() {
  LOGO.style.filter = "drop-shadow(0 0 0 transparent)";
}

/* BACKEND CALL THROUGH CLOUDFLARE WORKER */
async function askCloudAI(prompt) {
  startGlow();

  try {
    const res = await fetch("https://cloudai.srjahir.workers.dev", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    });

    const data = await res.json();
    stopGlow();

    if (data.reply) addAiBubble(data.reply);
    else addAiBubble("⚠️ No valid response received.");

  } catch (e) {
    stopGlow();
    addAiBubble("⚠️ Network error. Try again.");
  }
}