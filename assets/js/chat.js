/* === CloudAI Chat Engine v7.2 — SRJahir Production ===
   Full Markdown + Memory + Retry Support
*/

const WORKER_URL = "https://dawn-smoke-b354.sleepyspider6166.workers.dev"; // your Cloudflare Worker URL
const STORAGE_KEY = "cloudai_chat_history";
const MAX_TURNS = 8;

const chatContainer = document.getElementById("chat-container");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

let chatHistory = loadHistory();
renderHistory(chatHistory);

function renderMarkdown(text) {
  if (!window.marked) return text;
  const html = marked.parse(text || "");
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}

function loadHistory() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveHistory() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chatHistory.slice(-MAX_TURNS)));
}

function appendMessage(content, sender = "user") {
  const msg = document.createElement("div");
  msg.classList.add("message", sender === "user" ? "user" : "ai");
  msg.innerHTML = renderMarkdown(content);
  chatContainer.appendChild(msg);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  return msg;
}

function renderHistory(history) {
  chatContainer.innerHTML = "";
  history.forEach(msg => appendMessage(msg.text, msg.role));
}

async function fetchWithRetry(url, options, retries = 1) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (retries > 0) {
      await new Promise(res => setTimeout(res, 1500));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw err;
  }
}

async function sendMessage() {
  const prompt = userInput.value.trim();
  if (!prompt) return;

  appendMessage(prompt, "user");
  chatHistory.push({ role: "user", text: prompt });
  saveHistory();

  userInput.value = "";
  sendBtn.disabled = true;

  const aiMsg = appendMessage("⏳ Thinking...", "ai");

  try {
    const payload = { prompt, history: chatHistory.slice(-MAX_TURNS) };

    const response = await fetchWithRetry(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const reply = response?.reply || "⚠️ No response from CloudAI.";
    aiMsg.innerHTML = renderMarkdown(reply);

    chatHistory.push({ role: "model", text: reply });
    saveHistory();
  } catch (error) {
    aiMsg.innerHTML = `<span style="color:#ff6b6b;">❌ Request failed (${error.message})</span>`;
  } finally {
    sendBtn.disabled = false;
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
}

sendBtn.addEventListener("click", sendMessage);
userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
