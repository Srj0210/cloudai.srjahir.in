// live.js — live voice chat (SpeechRecognition + SpeechSynthesis TTS)
const startBtn = document.getElementById("start-btn");
const stopBtn = document.getElementById("stop-btn");
const transcriptEl = document.getElementById("transcript");
const statusEl = document.getElementById("status");
const liveLogo = document.getElementById("live-logo");

const API_URL = "https://dawn-smoke-b354.sleepyspider6166.workers.dev/"; // your worker

// Web Speech API setup
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;
const hasRecognition = !!SpeechRecognition;
let recognizer = null;
let listening = false;

// TTS voice selection: choose male-like voice if available
function selectVoice() {
  const voices = window.speechSynthesis.getVoices() || [];
  // Heuristic: prefer male/assistant voices by inspecting voice.name or voice.lang
  const prefer = voices.find(v => /male|Daniel|Alex|John|en-US|en_GB/i.test(v.name || "") );
  return prefer || voices.find(v => v.lang && v.lang.startsWith("en")) || voices[0] || null;
}

// speak text using selected voice and apply "speaking" logo style while speaking
function speakText(text) {
  if (!("speechSynthesis" in window)) return;
  const utter = new SpeechSynthesisUtterance(text);
  const voice = selectVoice();
  if (voice) utter.voice = voice;
  utter.rate = 1;
  utter.pitch = 1;
  liveLogo.classList.add("speaking");
  utter.onend = () => liveLogo.classList.remove("speaking");
  window.speechSynthesis.speak(utter);
}

// send a transcript to worker and play response
async function handleTranscript(t) {
  statusEl.textContent = "Sending to CloudAI...";
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: "live_" + Math.random().toString(36).slice(2,9), prompt: t, history: [] })
    });
    const data = await res.json().catch(()=>null);
    const reply = data?.reply || "No response.";
    transcriptEl.innerText = `Assistant: ${reply}`;
    speakText(reply);
    statusEl.textContent = "Playing reply";
  } catch (e) {
    statusEl.textContent = "Network error sending voice.";
  }
}

// start recognition
function startRecognition(){
  if (!hasRecognition) { statusEl.textContent = "Speech recognition not supported in this browser."; return; }
  recognizer = new SpeechRecognition();
  recognizer.interimResults = false;
  recognizer.lang = "en-US"; // you can adapt language selection later
  recognizer.maxAlternatives = 1;
  recognizer.onstart = () => {
    listening = true;
    statusEl.textContent = "Listening...";
    startBtn.disabled = true;
    stopBtn.disabled = false;
    liveLogo.classList.add("speaking"); // small glow while capturing
  };
  recognizer.onerror = (e) => {
    statusEl.textContent = "Recognition error: " + (e.error || "unknown");
    stopRecognition();
  };
  recognizer.onend = () => {
    listening = false;
    liveLogo.classList.remove("speaking");
    startBtn.disabled = false;
    stopBtn.disabled = true;
    statusEl.textContent = "Ready";
  };
  recognizer.onresult = (ev) => {
    const text = Array.from(ev.results).map(r=>r[0].transcript).join("");
    transcriptEl.innerText = `You: ${text}`;
    statusEl.textContent = "Processing...";
    handleTranscript(text);
  };
  recognizer.start();
}

function stopRecognition(){
  if (recognizer) try { recognizer.stop(); } catch(e){}
  listening = false;
  startBtn.disabled = false;
  stopBtn.disabled = true;
  liveLogo.classList.remove("speaking");
  statusEl.textContent = "Stopped";
}

// bind UI
startBtn.addEventListener("click", () => {
  // ensure voices loaded
  window.speechSynthesis.getVoices(); // trigger voice load
  startRecognition();
});
stopBtn.addEventListener("click", stopRecognition);

// improve voice loading for some browsers
if (typeof speechSynthesis !== "undefined") {
  speechSynthesis.onvoiceschanged = () => { /* voices available */ };
}