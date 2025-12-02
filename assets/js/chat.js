const chatBox = document.getElementById("chat-box");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

const clientId = crypto.randomUUID().slice(0, 12);

sendBtn.onclick = () => sendMsg();

userInput.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMsg();
    }
});

function addUser(text) {
    const div = document.createElement("div");
    div.className = "user-msg";
    div.textContent = text;
    chatBox.appendChild(div);
    scrollDown();
}

function addAI(text) {
    const div = document.createElement("div");
    div.className = "ai-msg";

    text = text.replace(/```(\w*)\n([\s\S]*?)```/g,
        (m, lang, code) =>
            `<pre><code class="language-${lang || 'javascript'}">${code.replace(/</g, "&lt;")}</code></pre>`
    );

    div.innerHTML = text;
    chatBox.appendChild(div);

    Prism.highlightAll();
    scrollDown();
}

function scrollDown() {
    setTimeout(() => {
        window.scrollTo(0, document.body.scrollHeight);
    }, 50);
}

async function sendMsg() {
    let text = userInput.value.trim();
    if (!text) return;

    addUser(text);
    userInput.value = "";

    try {
        const response = await fetch("https://cloudai.srjahir.workers.dev", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                prompt: text,
                clientId: clientId
            })
        });

        const data = await response.json();

        if (data.reply) addAI(data.reply);
        else addAI("⚠ No response");

    } catch (e) {
        addAI("⚠ Network error");
    }
}