/* ELEMENTS */
const chatBox = document.getElementById("chat-box");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const micBtn = document.getElementById("mic-btn");
const stopBtn = document.getElementById("stop-btn");
const plusBtn = document.getElementById("plus-btn");
const LOGO = document.getElementById("ai-logo");

let isProcessing = false;
let speaking = false;
let recognition;
let synth = window.speechSynthesis;
const clientId = "web_" + Math.random().toString(36).substring(2, 9);

/* USER BUBBLE */
function addUserBubble(text) {
  const wrap = document.createElement("div");
  wrap.className = "user-message";

  const b = document.createElement("div");
  b.className = "user-bubble";
  b.innerText = text;

  wrap.appendChild(b);
  chatBox.appendChild(wrap);
  scrollBottom();
}

/* AI BUBBLE */
function addAiBubble(text) {
  const wrap = document.createElement("div");
  wrap.className = "ai-message";

  const b = document.createElement("div");
  b.className = "ai-bubble";
  b.innerHTML = renderMarkdown(text);

  wrap.appendChild(b);
  chatBox.appendChild(wrap);

  scrollBottom();
}

/* SCROLL */
function scrollBottom() {
  setTimeout(() => {
    chatBox.scrollTop = chatBox.scrollHeight;
  }, 80);
}

/* MARKDOWN PARSER */
function renderMarkdown(text) {
  text = text.replace(/```([\s\S]*?)```/g, (_, c) => `<pre><code>${c}</code></pre>`);
  text = text.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
  text = text.replace(/\*(.*?)\*/g, "<i>$1</i>");
  return text.replace(/\n/g, "<br>");
}

/* SEND MESSAGE */
sendBtn.onclick = async () => {
  const msg = userInput.value.trim();
  if (!msg) return;
  userInput.value = "";

  addUserBubble(msg);

  await askCloudAI(msg);
};

/* BACKEND CALL */
async function askCloudAI(prompt) {
  if (isProcessing) return;
  isProcessing = true;

  startGlow();
  addAiBubble("⏳ Thinking...");

  try {
    const res = await fetch("https://dawn-smoke-b354.sleepyspider6166.workers.dev/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, prompt })
    });

    const data = await res.json();
    stopGlow();

    chatBox.lastChild.remove(); // remove "thinking"
    addAiBubble(data.reply || "⚠️ No response");

    speakOut(data.reply);

  } catch (e) {
    stopGlow();
    chatBox.lastChild.remove();
    addAiBubble("⚠️ Network error.");
  }

  isProcessing = false;
}

/* TEXT TO SPEECH */
function speakOut(text) {
  stopBtn.classList.remove("hidden");
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "en-IN";

  utter.onend = () => {
    stopBtn.classList.add("hidden");
  };

  synth.speak(utter);
}

/* STOP SPEAKING */
stopBtn.onclick = () => {
  synth.cancel();
  stopBtn.classList.add("hidden");
};

/* LOGO GLOW */
function startGlow() { LOGO.style.filter = "drop-shadow(0 0 18px #00d8ff)"; }
function stopGlow() { LOGO.style.filter = ""; }

/* MIC BUTTON */
micBtn.onclick = () => {
  startSpeechToText();
};

/* SPEECH-TO-TEXT */
function startSpeechToText() {
  recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  recognition.lang = "en-IN";

  recognition.onresult = async (e) => {
    const text = e.results[0][0].transcript;
    userInput.value = text;
    userInput.style.height = "auto";
  };

  recognition.start();
}