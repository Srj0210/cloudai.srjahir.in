# 🚀 CloudAI Upgrade Guide
## How to make CloudAI smarter & better

---

## 🧠 Option 1 — Better AI Model (Easy, Free → Paid)

Currently you use: `gemini-2.5-flash` (fast, cheap)

| Model | Quality | Cost | How |
|---|---|---|---|
| `gemini-2.5-flash` | Good | Free tier | Current |
| `gemini-2.5-pro` | **Best** | ~$3.50/1M tokens | Change model name in worker.js |
| `gemini-2.0-flash` | Better speed | Free tier | Change model name |

**To upgrade model:** In `worker.js`, change:
```js
// Line ~190
models/gemini-2.5-flash   →   models/gemini-2.5-pro
```

---

## 🔎 Option 2 — Better Search (Tavily → Upgrade)

Currently: Tavily free tier (1000 searches/month)

**Upgrade options:**
- Tavily Basic: $20/mo → 10,000 searches
- Or switch to **Bing Search API** (5000 free/month via Azure)

---

## 💾 Option 3 — Persistent Memory (Big Upgrade!)

**Problem now:** Every new session = AI forgets you.

**Fix:** Store conversation history in Cloudflare KV per user.

```js
// In worker.js — save history per clientId
await env.QUOTA_KV.put(
  `history_${clientId}`,
  JSON.stringify(history),
  { expirationTtl: 7 * 24 * 60 * 60 } // 7 days
);
```

---

## 🎙️ Option 4 — Real Human Voice (Best Upgrade!)

Current voice = browser's built-in TTS (robotic).

**Replace with ElevenLabs API** (most natural voices):
- Free: 10,000 chars/month
- $5/mo: 30,000 chars

```js
// In live.js, replace speak() function:
async function speak(text) {
  const res = await fetch("https://api.elevenlabs.io/v1/text-to-speech/VOICE_ID", {
    method: "POST",
    headers: {
      "xi-api-key": "YOUR_ELEVENLABS_KEY",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ text, model_id: "eleven_turbo_v2" })
  });
  const blob = await res.blob();
  const audio = new Audio(URL.createObjectURL(blob));
  audio.play();
}
```
Get free key: https://elevenlabs.io

---

## 📱 Option 5 — PWA Improvements

- Add push notifications (Cloudflare Workers + Web Push API)
- Add install prompt for home screen
- Add offline fallback page

---

## 🔐 Option 6 — User Accounts

Add Google Sign-In so each user has their own quota + history:
```html
<script src="https://accounts.google.com/gsi/client"></script>
```

---

## Priority Recommendation

1. ✅ **ElevenLabs voice** — biggest WOW factor, cheapest ROI
2. ✅ **gemini-2.5-pro** — smarter answers instantly  
3. ✅ **Persistent memory** — users will love "it remembers me!"
