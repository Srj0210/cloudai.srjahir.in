const chatBox = document.getElementById("chat-box");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const micBtn = document.getElementById("mic-btn");
const plusBtn = document.getElementById("plus-btn");
const logoBox = document.getElementById("logo-box");

/* TAP LOGO → LIVE PAGE */
logoBox.onclick = () => {
    window.location.href = "live.html";
};

/* SCROLL AUTO */
function scrollBottom() {
    setTimeout(() => {
        chatBox.scrollTop = chatBox.scrollHeight;
    }, 80);
}

/* SHOW USER MESSAGE */
function addUser(msg) {
    const div = document.createElement("div");
    div.className = "user-msg";
    div.textContent = msg;
    chatBox.appendChild(div);
    scrollBottom();
}

/* SHOW AI TEXT (NO BUBBLE) */
function addAI(msg) {
    const div = document.createElement("div");
    div.className = "ai-msg";
    div.textContent = msg;
    chatBox.appendChild(div);
    scrollBottom();
}

/* SEND MESSAGE */
sendBtn.onclick = () => sendMessage();
userInput.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

async function sendMessage() {
    let msg = userInput.value.trim();
    if (!msg) return;

    addUser(msg);
    userInput.value = "";

    addAI("⏳ Thinking...");

    try {
        const res = await fetch("https://dawn-smoke-b354.sleepyspider6166.workers.dev", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                prompt: msg,
                history: []
            })
        });

        const data = await res.json();
        document.querySelector(".ai-msg:last-child").remove();

        if (data.reply) addAI(data.reply);
        else addAI("⚠️ No response.");
        
    } catch (err) {
        document.querySelector(".ai-msg:last-child").remove();
        addAI("⚠️ Network error.");
    }
}