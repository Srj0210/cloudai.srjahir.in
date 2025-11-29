/* ELEMENTS */
const chatBox = document.getElementById("chat-box");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const micBtn  = document.getElementById("mic-btn");
const fileInput = document.getElementById("file-input");
const suggestionsBox = document.getElementById("suggestions");
const logo = document.getElementById("ai-logo");

/* WORKER API */
const WORKER_URL = "https://dawn-smoke-b354.sleepyspider6166.workers.dev/";

/* STATE */
let isProcessing = false;
let history = [];
const MAX_HISTORY = 15;
const clientId = "web_" + Math.random().toString(36).substring(2, 10);

/* RESET CHAT EVERY PAGE LOAD */
sessionStorage.removeItem("cloudai_chat");

/* LISTENERS */
sendBtn.onclick = sendMessage;
userInput.addEventListener("keydown", e=>{
  if(e.key==="Enter" && !e.shiftKey){
    e.preventDefault();
    sendMessage();
  }
});
micBtn.onclick = startVoiceInput;

/* FILE UPLOAD */
fileInput.onchange = function(){
  if(fileInput.files.length>0){
    const file = fileInput.files[0];
    addUserBubble("📁 Uploaded: " + file.name);
  }
};

/* SEND MESSAGE */
function sendMessage(){
  const text = userInput.value.trim();
  if(!text || isProcessing) return;

  addUserBubble(text);
  userInput.value = "";

  askAI(text);
}

/* ADD USER MESSAGE */
function addUserBubble(text){
  const wrap = document.createElement("div");
  wrap.className = "message user";

  const bubble = document.createElement("div");
  bubble.className = "bubble user-bubble";
  bubble.innerText = text;

  wrap.appendChild(bubble);
  chatBox.appendChild(wrap);
  scrollBottom();
}

/* ADD AI MESSAGE */
function addAiBubble(text){
  const wrap = document.createElement("div");
  wrap.className = "message ai";

  const bubble = document.createElement("div");
  bubble.className = "bubble ai-bubble";
  bubble.innerHTML = renderMarkdown(text);

  wrap.appendChild(bubble);
  chatBox.appendChild(wrap);

  highlightCode();
  scrollBottom();
}

/* HIGHLIGHT JS */
function highlightCode(){
  chatBox.querySelectorAll("pre code").forEach(block=>hljs.highlightElement(block));
}

/* SCROLL */
function scrollBottom(){
  setTimeout(()=>chatBox.scrollTop = chatBox.scrollHeight,50);
}

/* GLOW CONTROL */
function startGlow(){ logo.classList.add("thinking"); }
function stopGlow(){ logo.classList.remove("thinking"); }

/* ASK AI */
async function askAI(prompt){
  isProcessing = true;
  startGlow();

  const payload = { clientId, prompt, history };

  addThinking();

  try{
    const res = await fetch(WORKER_URL,{
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body:JSON.stringify(payload)
    });

    const data = await res.json();

    removeThinking();
    stopGlow();

    if(data.reply){
      addAiBubble(data.reply);
      pushHistory("model", data.reply);
      showSuggestions(data.reply);
    } else {
      addAiBubble("⚠️ No response.");
    }

  } catch(e){
    removeThinking();
    stopGlow();
    addAiBubble("⚠️ Network issue. Try again.");
  }

  isProcessing = false;
}

/* THINKING BUBBLE */
let thinkingBubble=null;
function addThinking(){
  thinkingBubble=document.createElement("div");
  thinkingBubble.className="message ai";
  thinkingBubble.innerHTML=`<div class="bubble ai-bubble">⏳ Thinking…</div>`;
  chatBox.appendChild(thinkingBubble);
  scrollBottom();
}
function removeThinking(){
  if(thinkingBubble){
    thinkingBubble.remove();
    thinkingBubble=null;
  }
}

/* HISTORY */
function pushHistory(role,text){
  history.push({role,text});
  if(history.length>MAX_HISTORY){
    history = history.slice(-MAX_HISTORY);
  }
}

/* MARKDOWN PARSER */
function renderMarkdown(text){
  return text.replace(/```([\s\S]*?)```/g, (_,code)=>`<pre><code>${code}</code></pre>`)
             .replace(/\*\*(.*?)\*\*/g,"<b>$1</b>")
             .replace(/\*(.*?)\*/g,"<i>$1</i>")
             .replace(/\n/g,"<br>");
}

/* VOICE INPUT */
function startVoiceInput(){
  if(!window.SpeechRecognition && !window.webkitSpeechRecognition){
    addAiBubble("🎤 Your browser doesn’t support speech input.");
    return;
  }
  const rec = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  rec.lang="en-US";
  rec.start();

  rec.onresult = e => {
    const text = e.results[0][0].transcript;
    addUserBubble("🎤 " + text);
    askAI(text);
  };
}

/* AI SUGGESTIONS */
function showSuggestions(reply){
  const sug = [
    "Explain more",
    "Give examples",
    "Make it shorter",
    "Rewrite professionally",
    "Summarize",
    "Continue"
  ];
  suggestionsBox.innerHTML="";
  sug.forEach(s=>{
    const btn = document.createElement("div");
    btn.className="suggestion-btn";
    btn.innerText=s;
    btn.onclick=()=>{ addUserBubble(s); askAI(s); };
    suggestionsBox.appendChild(btn);
  });
  suggestionsBox.classList.remove("hidden");
}