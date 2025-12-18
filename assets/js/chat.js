const API = "https://dawn-smoke-b354.sleepyspider6166.workers.dev/";

const box = document.getElementById("chat-box");
const sendBtn = document.getElementById("send-btn");
const micBtn = document.getElementById("mic-btn");
const input = document.getElementById("user-input");
const pinBtn = document.getElementById("pin-btn");

const attachMenu = document.getElementById("attachMenu");
const cameraInput = document.getElementById("cameraInput");
const imageInput  = document.getElementById("imageInput");
const fileInput   = document.getElementById("fileInput");

/* ===============================
   SESSION / HISTORY (REQUIRED)
   =============================== */
const clientId =
  localStorage.getItem("cloudai_client") ||
  (() => {
    const id = crypto.randomUUID();
    localStorage.setItem("cloudai_client", id);
    return id;
  })();

let history = [];

/* ===============================
   UI HELPERS
   =============================== */
function addUser(text) {
  const div = document.createElement("div");
  div.className = "user-msg";
  div.textContent = text;
  box.appendChild(div);
}

function addAI(text) {
  const div = document.createElement("div");
  div.className = "ai-msg";
  div.innerHTML = text;
  box.appendChild(div);
  Prism.highlightAll();
}

/* ===============================
   SEND MESSAGE (🔥 MAIN FIX)
   =============================== */
async function sendMessage() {
  const msg = input.value.trim();
  if (!msg) return;

  addUser(msg);
  input.value = "";

  history.push({ role: "user", content: msg });

  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: msg,
        history: history,
        clientId: clientId
      })
    });

    const data = await res.json();

    if (!data || !data.response) {
      addAI("⚠️ AI response not available");
      return;
    }

    history.push({ role: "assistant", content: data.response });
    addAI(data.response);

  } catch (err) {
    addAI("⚠️ Network / Worker error");
  }

  box.scrollTop = box.scrollHeight;
}

sendBtn.onclick = sendMessage;

/* ENTER KEY */
input.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

/* ===============================
   📌 ATTACH MENU
   =============================== */
pinBtn.onclick = () => {
  attachMenu.style.display =
    attachMenu.style.display === "flex" ? "none" : "flex";
};

attachMenu.onclick = e => {
  const type = e.target.dataset.type;
  if (!type) return;
  attachMenu.style.display = "none";

  if (type === "camera") cameraInput.click();
  if (type === "image") imageInput.click();
  if (type === "file")  fileInput.click();
};

function handleFile(file) {
  if (!file) return;
  addUser(`📎 ${file.name}`);
}

cameraInput.onchange = () => handleFile(cameraInput.files[0]);
imageInput.onchange  = () => handleFile(imageInput.files[0]);
fileInput.onchange   = () => handleFile(fileInput.files[0]);

/* ===============================
   🎙️ VOICE INPUT (UNCHANGED)
   =============================== */
let recognition;
if ("webkitSpeechRecognition" in window) {
  recognition = new webkitSpeechRecognition();
  recognition.lang = "en-IN";
  recognition.continuous = false;

  micBtn.onclick = () => recognition.start();

  recognition.onresult = e => {
    input.value = e.results[0][0].transcript;
    sendMessage();
  };
}