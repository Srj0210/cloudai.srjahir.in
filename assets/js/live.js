// ===================================================
// CloudAI Live v17.0 — Fixed Voice Chat
// by SRJahir Technologies 🔥
// ===================================================

const API = "https://dawn-smoke-b354.sleepyspider6166.workers.dev/";

const logo       = document.getElementById("live-logo");
const statusText = document.getElementById("status-text");
const speakBtn   = document.getElementById("speak-btn");
const stopBtn    = document.getElementById("stop-btn");
const wave       = document.getElementById("voice-wave");

/* ===============================
   SESSION
   =============================== */
const clientId =
  localStorage.getItem("cloudai_client") ||
  (() => {
    const id = "live_" + Math.random().toString(36).slice(2, 9);
    localStorage.setItem("cloudai_client", id);
    return id;
  })();

let history     = [];
let isProcessing = false;

/* ===============================
   TEXT TO SPEECH
   =============================== */
function speak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();

  // Strip markdown for clean speech
  const clean = text
    .replace(/```[\s\S]*?```/g, "code block omitted")
    .replace(/[*_`#>\[\]]/g, "")
    .replace(/https?:\/\/\S+/g, "link")
    .replace(/\n+/g, " ")
    .trim();

  const utt = new SpeechSynthesisUtterance(clean);
  utt.lang  = "en-IN";
  utt.rate  = 1.05;
  utt.pitch = 1;

  // Try to find a good Indian English voice
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v => v.lang === "en-IN") ||
                    voices.find(v => v.lang.startsWith("en")) ||
                    null;
  if (preferred) utt.voice = preferred;

  utt.onstart = () => { setStatus("Speaking...", true); };
  utt.onend   = () => { setStatus("Tap to Talk", false); };
  utt.onerror = () => { setStatus("Tap to Talk", false); };

  window.speechSynthesis.speak(utt);
}

/* ===============================
   UI STATE
   =============================== */
function setStatus(msg, active = false) {
  statusText.textContent = msg;
  if (active) {
    logo.style.boxShadow = "0 0 30px #00ffcc, 0 0 60px #00c8ff";
    wave && wave.classList.add("active");
  } else {
    logo.style.boxShadow = "0 0 20px #00c8ff";
    wave && wave.classList.remove("active");
  }
}

/* ===============================
   SEND TO API
   =============================== */
async function sendToAI(text) {
  if (isProcessing) return;
  isProcessing = true;
  setStatus("Thinking...", true);

  history.push({ role: "user", text });

  try {
    const res = await fetch(API, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ prompt: text, history, clientId }),
    });
    const data = await res.json();
    const reply = data.reply || "Sorry, I couldn't get a response.";
    history.push({ role: "model", text: reply });
    speak(reply);
  } catch {
    speak("Network error. Please try again.");
  } finally {
    isProcessing = false;
  }
}

/* ===============================
   SPEECH RECOGNITION (FIXED)
   =============================== */
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
  setStatus("Voice not supported");
  speakBtn.disabled = true;
  speakBtn.textContent = "Use Chrome for voice";
  speakBtn.style.opacity = "0.5";
} else {
  const rec = new SpeechRecognition();
  rec.lang             = "en-IN";
  rec.interimResults   = false;
  rec.maxAlternatives  = 1;
  rec.continuous       = false;

  let listening = false;

  function startListening() {
    if (isProcessing) return;
    window.speechSynthesis?.cancel(); // Stop any ongoing speech
    rec.start();
  }

  function stopListening() {
    if (listening) rec.stop();
  }

  speakBtn.onclick = startListening;
  stopBtn  && (stopBtn.onclick  = stopListening);

  rec.onstart = () => {
    listening = true;
    setStatus("Listening...", true);
    speakBtn.style.display = "none";
    if (stopBtn) stopBtn.style.display = "inline-block";
  };

  rec.onend = () => {
    listening = false;
    speakBtn.style.display = "inline-block";
    if (stopBtn) stopBtn.style.display = "none";
    if (!isProcessing) setStatus("Tap to Talk", false);
  };

  rec.onresult = e => {
    const transcript = e.results[0][0].transcript.trim();
    if (transcript) {
      setStatus(`You: "${transcript}"`, false);
      sendToAI(transcript);
    }
  };

  rec.onerror = e => {
    listening = false;
    speakBtn.style.display = "inline-block";
    if (stopBtn) stopBtn.style.display = "none";

    if (e.error === "not-allowed") {
      setStatus("❌ Mic blocked — allow in browser");
    } else if (e.error === "no-speech") {
      setStatus("No speech heard. Try again.");
      setTimeout(() => setStatus("Tap to Talk"), 2000);
    } else {
      setStatus("Tap to Talk");
    }
  };

  // Pre-load voices (required on some browsers)
  window.speechSynthesis?.getVoices();
  window.speechSynthesis?.addEventListener("voiceschanged", () => {});
}
