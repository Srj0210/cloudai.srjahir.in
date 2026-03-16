// ===================================================
// CloudAI Live v18.0 — ElevenLabs + Better Recognition
// by SRJahir Technologies 🔥
// ===================================================

const API            = "https://dawn-smoke-b354.sleepyspider6166.workers.dev/";
const ELEVEN_API_KEY = "YOUR_ELEVENLABS_API_KEY";  // 🔑 Replace with your key
const ELEVEN_VOICE   = "SZfY4K69FwXus87eayHK";     // Rachel — natural female voice
// Other free voices: EXAVITQu4vr4xnSDxMaL (Bella), AZnzlk1XvdvUeBnXmlld (Domi)

const logo       = document.getElementById("live-logo");
const statusText = document.getElementById("status-text");
const speakBtn   = document.getElementById("speak-btn");
const stopBtn    = document.getElementById("stop-btn");

const clientId =
  localStorage.getItem("cloudai_client") ||
  (() => {
    const id = "live_" + Math.random().toString(36).slice(2, 9);
    localStorage.setItem("cloudai_client", id);
    return id;
  })();

let history      = [];
let isProcessing = false;
let currentAudio = null;

/* ── UI STATE ──────────────────────────────────── */
function setStatus(msg, state = "idle") {
  if (statusText) statusText.textContent = msg;
  const states = {
    idle:      { shadow: "0 0 20px #00c8ff",          scale: "1",    glow: "" },
    listening: { shadow: "0 0 40px #00ffcc, 0 0 80px #00c8ff", scale: "1.06", glow: "listening" },
    thinking:  { shadow: "0 0 30px #a78bfa, 0 0 60px #7c3aed", scale: "1.03", glow: "thinking"  },
    speaking:  { shadow: "0 0 40px #34d399, 0 0 70px #059669", scale: "1.08", glow: "speaking"  },
  };
  const s = states[state] || states.idle;
  logo.style.boxShadow = s.shadow;
  logo.style.transform = `scale(${s.scale})`;
  logo.className       = `logo ${s.glow}`;
}

/* ── ELEVENLABS TTS ────────────────────────────── */
async function speakElevenLabs(text) {
  // Clean text for speech
  const clean = text
    .replace(/```[\s\S]*?```/g, "code block.")
    .replace(/#{1,6} /g, "").replace(/[*_`>\[\]]/g, "")
    .replace(/https?:\/\/\S+/g, "link")
    .replace(/\n+/g, " ").replace(/\s{2,}/g, " ").trim();

  setStatus("Speaking...", "speaking");

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE}`,
      {
        method:  "POST",
        headers: {
          "xi-api-key":   ELEVEN_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2",        // fastest free model
          voice_settings: {
            stability:        0.45,           // natural variation
            similarity_boost: 0.82,
            style:            0.35,           // slight expressiveness
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!res.ok) {
      console.warn("ElevenLabs error:", res.status);
      speakFallback(clean); // fallback to browser TTS
      return;
    }

    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);

    if (currentAudio) { currentAudio.pause(); URL.revokeObjectURL(currentAudio.src); }
    currentAudio     = new Audio(url);
    currentAudio.onended  = () => { setStatus("Tap to Talk", "idle"); URL.revokeObjectURL(url); };
    currentAudio.onerror  = () => { setStatus("Tap to Talk", "idle"); };
    currentAudio.play();

  } catch (err) {
    console.error("ElevenLabs fetch failed:", err);
    speakFallback(clean);
  }
}

/* ── BROWSER TTS FALLBACK ──────────────────────── */
let voices = [];
window.speechSynthesis?.getVoices();
window.speechSynthesis?.addEventListener("voiceschanged", () => {
  voices = window.speechSynthesis.getVoices();
});

function speakFallback(text) {
  if (!window.speechSynthesis) { setStatus("Tap to Talk", "idle"); return; }
  window.speechSynthesis.cancel();

  const preferred = ["Google UK English Female","Google US English","Samantha","Karen"];
  let best = null;
  if (voices.length) {
    for (const name of preferred) {
      best = voices.find(v => v.name === name);
      if (best) break;
    }
    if (!best) best = voices.find(v => v.lang.startsWith("en")) || voices[0];
  }

  const utt    = new SpeechSynthesisUtterance(text);
  if (best) utt.voice = best;
  utt.lang  = best?.lang || "en-US";
  utt.rate  = 0.92;
  utt.pitch = 1.05;
  utt.onend = utt.onerror = () => setStatus("Tap to Talk", "idle");
  window.speechSynthesis.speak(utt);
}

function stopSpeaking() {
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  window.speechSynthesis?.cancel();
  setStatus("Tap to Talk", "idle");
}

/* ── SEND TO AI ────────────────────────────────── */
async function sendToAI(text) {
  if (isProcessing) return;
  isProcessing = true;
  setStatus("Thinking...", "thinking");

  // Show thinking dots
  showThinkingDots(true);

  history.push({ role: "user", text });
  if (history.length > 20) history = history.slice(-20);

  try {
    const res = await fetch(API, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ prompt: text, history, clientId, voiceMode: true }),
    });
    const data  = await res.json();
    const reply = data.reply || "Sorry, no response.";
    history.push({ role: "model", text: reply });

    showThinkingDots(false);
    speakElevenLabs(reply);
  } catch {
    showThinkingDots(false);
    speakFallback("Network error. Please check your connection.");
  } finally {
    isProcessing = false;
  }
}

function showThinkingDots(show) {
  let el = document.getElementById("thinking-dots");
  if (show && !el) {
    el = document.createElement("div");
    el.id        = "thinking-dots";
    el.className = "thinking-dots";
    el.innerHTML = "<span></span><span></span><span></span>";
    document.querySelector(".live-container")?.appendChild(el);
  } else if (!show && el) {
    el.remove();
  }
}

/* ── SPEECH RECOGNITION ────────────────────────── */
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
  setStatus("Voice not supported — use Chrome");
  if (speakBtn) { speakBtn.disabled = true; speakBtn.textContent = "Use Chrome"; speakBtn.style.opacity = "0.4"; }
} else {
  const rec = new SpeechRecognition();
  rec.lang            = "en-US";
  rec.interimResults  = true;
  rec.continuous      = false;
  rec.maxAlternatives = 3;

  let listening       = false;
  let silenceTimer    = null;
  let finalTranscript = "";
  let interimEl       = null;

  function startListening() {
    if (isProcessing) return;
    stopSpeaking();
    finalTranscript = "";
    try { rec.start(); } catch {}
  }

  if (speakBtn) speakBtn.onclick = startListening;
  if (stopBtn)  stopBtn.onclick  = () => { if (listening) rec.stop(); };

  rec.onstart = () => {
    listening = true;
    setStatus("Listening...", "listening");
    if (speakBtn) speakBtn.style.display = "none";
    if (stopBtn)  stopBtn.style.display  = "inline-flex";

    // Interim text display
    interimEl = document.getElementById("interim-text");
    if (!interimEl) {
      interimEl = document.createElement("div");
      interimEl.id        = "interim-text";
      interimEl.className = "interim-text";
      document.querySelector(".live-container")?.appendChild(interimEl);
    }
    interimEl.textContent = "";
  };

  rec.onresult = e => {
    clearTimeout(silenceTimer);
    let interim = "";

    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) {
        // Pick best confidence
        let best = e.results[i][0];
        for (let j = 1; j < e.results[i].length; j++) {
          if (e.results[i][j].confidence > best.confidence) best = e.results[i][j];
        }
        finalTranscript += best.transcript + " ";
      } else {
        interim += e.results[i][0].transcript;
      }
    }

    const display = (finalTranscript + interim).trim();
    if (interimEl && display) interimEl.textContent = `"${display}"`;

    if (finalTranscript.trim()) {
      silenceTimer = setTimeout(() => rec.stop(), 1400);
    }
  };

  rec.onend = () => {
    listening = false;
    clearTimeout(silenceTimer);
    if (speakBtn) speakBtn.style.display = "inline-flex";
    if (stopBtn)  stopBtn.style.display  = "none";

    const heard = finalTranscript.trim();
    if (interimEl) interimEl.textContent = "";

    if (heard) {
      setStatus(`You: "${heard}"`, "idle");
      sendToAI(heard);
    } else {
      setStatus("Tap to Talk", "idle");
    }
  };

  rec.onerror = e => {
    listening = false;
    clearTimeout(silenceTimer);
    if (speakBtn) speakBtn.style.display = "inline-flex";
    if (stopBtn)  stopBtn.style.display  = "none";
    if (interimEl) interimEl.textContent = "";

    const msgs = {
      "not-allowed": "❌ Mic blocked — allow in settings",
      "no-speech":   "Didn't catch that. Try again.",
      "network":     "Network error.",
    };
    setStatus(msgs[e.error] || "Tap to Talk", "idle");
    if (e.error !== "aborted") setTimeout(() => setStatus("Tap to Talk", "idle"), 2500);
  };
}
