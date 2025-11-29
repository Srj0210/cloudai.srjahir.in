const logo = document.getElementById("live-logo");
const statusText = document.getElementById("status-text");
const stopBtn = document.getElementById("stopBtn");

let listening = false;
let speaking = false;
let stopped = false;

const WORKER_URL = "https://dawn-smoke-b354.sleepyspider6166.workers.dev/";

logo.onclick = startLiveTalk;
stopBtn.onclick = stopLive;

function stopLive(){
  stopped = true;
  window.speechSynthesis.cancel();
  statusText.textContent = "Live Talk Stopped";
  stopBtn.style.display = "none";
}

function startLiveTalk(){
  stopped = false;
  stopBtn.style.display = "block";
  loopListen();
}

function loopListen(){
  if(stopped) return;

  animateListening();
  statusText.textContent = "Listening…";

  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!Rec){
    statusText.textContent = "Speech recognizer not supported.";
    return;
  }

  const rec = new Rec();
  rec.lang = "en-US";
  rec.start();

  rec.onresult = async e => {
    const text = e.results[0][0].transcript;
    statusText.textContent = "Thinking…";
    animateThinking();

    const reply = await askAI(text);
    speak(reply);
  };

  rec.onend = () => {
    if(!stopped) loopListen();
  };
}

function speak(text){
  animateSpeaking();
  statusText.textContent = "Speaking…";

  const s = new SpeechSynthesisUtterance(text);
  s.lang="en-US";
  s.rate=1;
  s.pitch=1;

  s.onend = ()=>{
    if(!stopped){
      loopListen();
    }
  };

  window.speechSynthesis.speak(s);
}

async function askAI(prompt){
  const res = await fetch(WORKER_URL,{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body:JSON.stringify({ clientId:"live", prompt })
  });
  const data = await res.json();
  return data.reply || "Sorry, I couldn't answer.";
}

/* Animated States */
function animateSpeaking(){
  logo.style.boxShadow="0 0 45px #00f0ff";
  addWaveEffect();
}

function animateListening(){
  logo.style.boxShadow="0 0 30px #00cfff";
  removeAllWaves();
}

function animateThinking(){
  logo.style.boxShadow="0 0 20px #bbb";
  removeAllWaves();
}

function addWaveEffect(){
  removeAllWaves();
  const w = document.createElement("div");
  w.className="wave";
  logo.appendChild(w);
}

function removeAllWaves(){
  document.querySelectorAll(".wave").forEach(x=>x.remove());
}