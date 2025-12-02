const API_URL = "https://cloudai.srjahir.workers.dev/";

const chatBox = document.getElementById("chat-box");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const LOGO = document.getElementById("ai-logo");

let history = [];
const MAX_HISTORY = 15;
let processing = false;

/* SEND HANDLERS */
sendBtn.onclick = sendMessage;
userInput.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

/* SEND FUNCTION */
function sendMessage() {
  let text = userInput.value.trim();
  if (!text || processing) return;

  addUserBubble(text);
  userInput.value = "";

  talkToAI(text);
}

/* USER BUBBLE */
function addUserBubble(text) {
  const d = document.createElement("div");
  d.className = "user-bubble";
  d.innerText = text;
  chatBox.appendChild(d);
  scrollDown();
}

/* AI PANEL */
function addAiPanel(html) {
  const wrap = document.createElement("div");
  wrap.className = "ai-panel";

  const content = document.createElement("div");
  content.className = "message-content";
  content.innerHTML = html;

  wrap.appendChild(content);
  chatBox.appendChild(wrap);

  hljs.highlightAll();
  scrollDown();
}

/* SCROLL */
function scrollDown() {
  setTimeout(() => {
    chatBox.scrollTop = chatBox.scrollHeight;
  }, 50);
}

/* TALK TO WORKER */
async function talkToAI(prompt) {
  processing = true;
  LOGO.style.animation = "glow 1s infinite";

  const thinking = addThinking();

  try {
    const res = await fetch(API_URL, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ clientId:"web", prompt, history })
    });

    const data = await res.json();
    
    thinking.remove();
    LOGO.style.animation = "glow 2s infinite";

    let out = data.reply || "⚠ No reply from server";

    addAiPanel(out);

    history.push({ role:"user", text:prompt });
    history.push({ role:"model", text:out });
    history = history.slice(-MAX_HISTORY);

  } catch (e) {
    thinking.remove();
    addAiPanel("⚠ Network error.");
  }

  processing = false;
}

/* Thinking panel */
function addThinking() {
  const box = document.createElement("div");
  box.className = "ai-panel";
  box.innerHTML = "<div class='message-content'>⏳ Thinking...</div>";
  chatBox.appendChild(box);
  scrollDown();
  return box;
}