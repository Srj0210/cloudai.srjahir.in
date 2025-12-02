const chatBox = document.getElementById("chat-box");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

const clientId = crypto.randomUUID().slice(0, 20);

/* Send on click */
sendBtn.onclick = () => sendMessage();

/* Send on Enter */
userInput.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

/* Add user message */
function addUserMessage(text) {
    const div = document.createElement("div");
    div.className = "user-msg";
    div.textContent = text;
    chatBox.appendChild(div);
    scrollBottom();
}

/* Add AI message (no bubble) */
function addAiMessage(text) {
    const div = document.createElement("div");
    div.className = "ai-msg";

    // Convert code fences to PrismJS blocks
    if (text.includes("```")) {
        text = text.replace(/```(\w*)\n([\s\S]*?)```/g,
            (match, lang, code) => `
<pre><code class="language-${lang || 'javascript'}">${code.replace(/</g, "&lt;")}</code></pre>`
        );
    }

    div.innerHTML = text;
    chatBox.appendChild(div);
    Prism.highlightAll();
    scrollBottom();
}

function scrollBottom() {
    setTimeout(() => {
        window.scrollTo(0, document.body.scrollHeight);
    }, 50);
}

/* SEND MESSAGE */
async function sendMessage() {
    let text = userInput.value.trim();
    if (!text) return;

    addUserMessage(text);
    userInput.value = "";

    try {
        const res = await fetch("https://cloudai.srjahir.workers.dev", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                prompt: text,
                clientId: clientId,
                history: []
            })
        });

        const data = await res.json();

        if (data.reply) addAiMessage(data.reply);
        else addAiMessage("⚠ No response");

    } catch {
        addAiMessage("⚠ Network error");
    }
}