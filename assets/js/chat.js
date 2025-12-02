const API_URL = "https://dawn-smoke-b354.sleepyspider6166.workers.dev/";

const sendBtn = document.getElementById("send-btn");
const userInput = document.getElementById("user-input");
const chatBox = document.getElementById("chat-box");

sendBtn.onclick = sendMessage;
userInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

function appendUser(msg) {
    const div = document.createElement("div");
    div.className = "user-msg";
    div.innerText = msg;
    chatBox.appendChild(div);
}

function appendAI(msg) {
    const div = document.createElement("div");
    div.className = "ai-msg";
    div.innerHTML = msg.replace(/\n/g, "<br>");
    chatBox.appendChild(div);
}

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    appendUser(text);
    userInput.value = "";

    try {
        const res = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                prompt: text,
                clientId: "SRJ-" + navigator.userAgent
            })
        });

        const data = await res.json();

        if (data.error === "quota_exceeded") {
            appendAI("⚠ Your daily quota is finished.");
            return;
        }

        appendAI(data.reply);
    } 
    catch (err) {
        appendAI("⚠ Network error. Try again.");
    }

    chatBox.scrollTop = chatBox.scrollHeight;
}