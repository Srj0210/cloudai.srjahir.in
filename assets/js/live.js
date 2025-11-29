// LIVE MODE — Ultra HD Voice Talk

const logo = document.getElementById("liveLogo");

logo.onclick = startVoiceTalk;

function speak(text){
  const s = new SpeechSynthesisUtterance(text);
  s.lang="en-US";
  s.rate=1;
  s.pitch=1;
  window.speechSynthesis.speak(s);
}

function startVoiceTalk(){
  if(!window.SpeechRecognition && !window.webkitSpeechRecognition){
    speak("Your browser does not support live mode.");
    return;
  }
  const rec = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  rec.lang="en-US";
  rec.start();

  logo.style.boxShadow="0 0 40px #00ffea";

  rec.onresult = async e =>{
    const text = e.results[0][0].transcript;
    const reply = await ask(text);
    speak(reply);
  };

  rec.onend = ()=>{ logo.style.boxShadow="0 0 25px #00bfff"; };
}

async function ask(prompt){
  const res = await fetch("https://dawn-smoke-b354.sleepyspider6166.workers.dev/",{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body:JSON.stringify({ clientId:"live", prompt })
  });
  const data = await res.json();
  return data.reply || "I didn't understand.";
}