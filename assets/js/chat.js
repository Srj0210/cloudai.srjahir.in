const chatBox = document.getElementById("chat-box");
const input = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

/* -------------------------------
   UNIQUE CLIENT ID GENERATOR
--------------------------------*/
function getClientId() {
    let id = localStorage.getItem("cloudai_clientId");
    if (!id) {
        id = "client-" + Math.random().toString(36).substring(2, 12);
        localStorage.setItem("cloudai_clientId", id);
    }
    return id;
}

const clientId = getClientId();

/* -------------------------------
   ADD USER + AI MESSAGES
--------------------------------*/
function addUserMessage(text) {
    let div = document.createElement("div");
    div.className = "user-msg";
    div.innerText = text;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function addAIMessage(text) {
    let div = document.createElement("div");
    div.className = "ai-msg";
    div.innerText = text;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

/* -------------------------------
   SEND MESSAGE TO WORKER
--------------------------------*/
async function sendMessage() {
    let msg = input.value.trim();
    if (!msg) return;

    addUserMessage(msg);
    input.value = "";

    addAIMessage("Thinking...");

    try {
        let res = await fetch("https://dawn-smoke-b354.sleepyspider6166.workers.dev/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                prompt: msg,
                clientId: clientId,   // 🔥 FIXED → REQUIRED FOR QUOTA SYSTEM
                history: []           // optional but keeping for safety
            })
        });

        let data = await res.json();

        if (data.reply) {
            document.querySelector(".ai-msg:last-child").innerText = data.reply;
        } else if (data.error) {
            document.querySelector(".ai-msg:last-child").innerText = "⚠️ " + data.error;
        } else {
            document.querySelector(".ai-msg:last-child").innerText = "⚠️ Unexpected response";
        }

    } catch (e) {
        document.querySelector(".ai-msg:last-child").innerText = "⚠️ Network error";
    }
}

/* -------------------------------
   BUTTON + ENTER KEY EVENTS
--------------------------------*/
sendBtn.onclick = sendMessage;

input.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});