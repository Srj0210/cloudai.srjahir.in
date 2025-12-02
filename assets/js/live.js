/* ======================================================
   CloudAI LIVE VOICE ENGINE — SRJahir Technologies
   Version: v5 (Stable)
====================================================== */

const API_URL = "https://dawn-smoke-b354.sleepyspider6166.workers.dev/";

const logo = document.getElementById("live-logo");
const statusText = document.getElementById("status-text");
const wave = document.getElementById("wave");
const btnSpeak = document.getElementById("btn-speak");
const btnStop = document.getElementById("btn-stop");

let recognition;
let isListening = false;
let isSpeaking = false;

/* --------------------------------------------------------
   1. INITIALIZE MICROPHONE LISTENER
-------------------------------------------------------- */
window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (!window.SpeechRecognition) {
  alert("Your browser does not support live voice mode.");
}

function initRecognition() {
  recognition = new window.SpeechRecognition();
  recognition.lang = "en-IN"; // best for Indian + English mixed
  recognition.interimResults = false;
  recognition.continuous = false;

  recognition.onstart = () => {
    isListening = true;
    statusText.textContent = "Listening…";
    logo.className = "logo listening";
  };

  recognition.onresult = (e) => {
    const text = e.results[0][0].transcript;
    sendToAI(text);
  };

  recognition.onerror = () => {
    stopListening();
    statusText.textContent = "Mic error – tap to try again";
  };

  recognition.onend = () => {
    if (!isSpeaking) {
      stopListening();
    }
  };
}

/* --------------------------------------------------------
   2. START + STOP LISTENING
-------------------------------------------------------- */
function startListening() {
  if (isSpeaking) return;
  if (!recognition) initRecognition();
  recognition.start();
}

function stopListening() {
  isListening = false;
  if (recognition) recognition.stop();
  logo.className = "logo";
  statusText.textContent = "Tap to speak";
}

/* --------------------------------------------------------
   3. SEND TEXT TO CLOUDAI WORKER
-------------------------------------------------------- */
async function sendToAI(text) {
  stopListening();
  statusText.textContent = "Thinking…";
  logo.className = "logo thinking";
  wave.classList.remove("active");

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: "voice_" + Math.random().toString(36).substring(2, 10),
        prompt: text,
        history: [],
      }),
    });

    const data = await res.json();
    const reply = data.reply || "I couldn't understand that.";

    speakAI(reply);
  } catch (e) {
    statusText.textContent = "Network error";
    logo.className = "logo";
  }
}

/* --------------------------------------------------------
   4. AI SPEAKING SYSTEM
-------------------------------------------------------- */
function speakAI(text) {
  isSpeaking = true;
  statusText.textContent = "Speaking…";
  logo.className = "logo speaking";
  wave.classList.add("active");

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "en-IN";
  utter.rate = 1.03;
  utter.pitch = 1.0;

  utter.onend = () => {
    isSpeaking = false;
    wave.classList.remove("active");
    statusText.textContent = "Listening…";
    startListening(); // AUTO LOOP
  };

  speechSynthesis.speak(utter);
}

/* --------------------------------------------------------
   5. STOP EVERYTHING
-------------------------------------------------------- */
function stopAll() {
  speechSynthesis.cancel();
  stopListening();
  isSpeaking = false;
  wave.classList.remove("active");
  statusText.textContent = "Tap to speak";
}

/* --------------------------------------------------------
   6. BUTTON EVENTS
-------------------------------------------------------- */
btnSpeak.onclick = () => {
  if (!isListening && !isSpeaking) {
    startListening();
  }
};

btnStop.onclick = () => {
  stopAll();
};

/* Init */
initRecognition();