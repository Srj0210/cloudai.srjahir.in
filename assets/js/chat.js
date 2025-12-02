const API = "https://dawn-smoke-b354.sleepyspider6166.workers.dev/";

const box = document.getElementById("chat-box");
const sendBtn = document.getElementById("send-btn");
const micBtn = document.getElementById("mic-btn");
const input = document.getElementById("user-input");

/* ADD USER MESSAGE */
function addUser(text) {
    const div = document.createElement("div");
    div.className = "user-msg";
    div.textContent = text;
    box.appendChild(div);
}

/* ADD AI MESSAGE (BLOCK LIKE CHATGPT) */
function addAI(text) {
    const div = document.createElement("div");
    div.className = "ai-msg";
    div.innerHTML = text;
    box.appendChild(div);

    Prism.highlightAll();
}

/* SEND MESSAGE TO WORKER */
async function sendMessage() {
    const msg = input.value.trim();
    if (!msg) return;

    addUser(msg);
    input.value = "";

    try {
        const res = await fetch(API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: msg })
        });

        const data = await res.json();

        if (!data.response) {
            addAI(`⚠️ No response`);
            return;
        }

        addAI(data.response);

    } catch {
        addAI("⚠️ Network error");
    }

    box.scrollTop = box.scrollHeight;
}

sendBtn.onclick = sendMessage;

/* VOICE INPUT */
let recognition;
if ("webkitSpeechRecognition" in window) {
    recognition = new webkitSpeechRecognition();
    recognition.lang = "en-IN";
    recognition.continuous = false;

    micBtn.onclick = () => {
        recognition.start();
    };

    recognition.onresult = (e) => {
        input.value = e.results[0][0].transcript;
        sendMessage();
    };
}