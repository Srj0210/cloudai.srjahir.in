const chatBox = document.getElementById("chat-box");
const input = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

document.getElementById("logo-box").onclick = () => {
    window.location.href = "live.html";
};

sendBtn.onclick = sendMessage;

function sendMessage() {
    let text = input.value.trim();
    if (!text) return;

    addUserMsg(text);
    input.value = "";

    askAI(text);
}

function addUserMsg(t) {
    let div = document.createElement("div");
    div.className = "user-msg";
    div.innerText = t;
    chatBox.appendChild(div);
    scroll();
}

function addAI(t) {
    let div = document.createElement("div");
    div.className = "ai-msg";
    div.innerText = t;
    chatBox.appendChild(div);
    scroll();
}

function scroll() {
    setTimeout(() => {
        window.scrollTo(0, document.body.scrollHeight);
    }, 30);
}

async function askAI(prompt) {
    try {
        const res = await fetch("https://cloudai.srjahir.workers.dev", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                prompt,
                history: [],
                clientId: crypto.randomUUID()
            })
        });

        const data = await res.json();
        addAI(data.reply || "Error.");
    } catch {
        addAI("⚠️ Network error.");
    }
}