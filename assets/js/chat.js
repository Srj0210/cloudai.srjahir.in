const chatBox = document.getElementById("chat-box");
const input = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

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
            body: JSON.stringify({ prompt: msg })
        });

        let data = await res.text();

        document.querySelector(".ai-msg:last-child").innerText = data;

    } catch {
        document.querySelector(".ai-msg:last-child").innerText = "⚠️ No response";
    }
}

sendBtn.onclick = sendMessage;

input.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});