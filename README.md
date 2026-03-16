# CloudAI — Smart AI Assistant

A production-ready, PWA-enabled AI chat assistant with a Cloudflare Worker backend. Supports text and image understanding, voice input, and file attachments. Deployed on GitHub Pages with a custom domain and full SEO infrastructure.

[![Live Demo](https://img.shields.io/badge/Live-cloudai.srjahir.in-blue?style=flat-square&logo=google-chrome)](https://cloudai.srjahir.in)
[![GitHub Pages](https://img.shields.io/badge/Deployed-GitHub%20Pages-222?style=flat-square&logo=github)](https://github.com/Srj0210/cloudai.srjahir.in)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-5A0FC8?style=flat-square&logo=pwa)](https://cloudai.srjahir.in/manifest.json)
[![Cloudflare Workers](https://img.shields.io/badge/Backend-Cloudflare%20Workers-F38020?style=flat-square&logo=cloudflare)](https://workers.cloudflare.com)
[![Commits](https://img.shields.io/github/commit-activity/t/Srj0210/cloudai.srjahir.in?style=flat-square&label=Commits)](https://github.com/Srj0210/cloudai.srjahir.in/commits/main)

---

## Live Site

[https://cloudai.srjahir.in](https://cloudai.srjahir.in)

---

## About the Project

CloudAI is a browser-based AI assistant built with vanilla HTML, CSS, and JavaScript on the frontend and a Cloudflare Worker on the backend. The worker handles all AI inference using Groq as the primary provider with Gemini as a fallback, keeping API keys secure in environment variables — no keys are hardcoded anywhere in the codebase.

The project covers the full lifecycle of a production web app: writing the frontend, deploying a serverless backend, securing credentials, setting up a PWA for offline use, and making the site discoverable across search engines.

---

## Architecture

```
User (Browser)
      |
      | HTTPS request
      v
  GitHub Pages
  (Frontend — HTML/CSS/JS)
      |
      | POST /api
      v
  Cloudflare Worker (worker.js)
      |
      |-- Text query --> Groq Llama 3.3 70B (primary)
      |                        |
      |                  fallback if unavailable
      |                        v
      |                  Gemini 2.5 Flash
      |
      |-- Image query --> Groq Llama 4 Scout Vision (primary)
                               |
                         fallback if unavailable
                               v
                         Gemini 2.5 Flash
```

---

## Backend — Cloudflare Worker

The backend is a single `worker.js` file deployed on Cloudflare Workers. It accepts POST requests only and handles CORS for browser clients.

**Worker version:** v19.1  
**Text model:** Groq — Llama 3.3 70B (primary), Gemini 2.5 Flash (fallback)  
**Vision model:** Groq — Llama 4 Scout Vision (primary), Gemini 2.5 Flash (fallback)  
**Memory:** Session-only — no KV storage used, keeping the worker lightweight  
**API keys:** Stored as Cloudflare environment variables, never in source code

### Why Cloudflare Workers

- Runs at the edge — low latency globally
- No server to manage or scale
- Free tier is generous for personal and side projects
- Environment variables keep credentials out of the repo entirely

---

## Features

| Feature | Description |
|---|---|
| Chat Interface | Responsive AI chat UI with message history |
| Vision Support | Send images and ask questions about them |
| Voice Input | Browser microphone integration for speech-to-text |
| File Attachments | Support for images, photos, and documents |
| Dual AI Fallback | Groq primary, Gemini 2.5 Flash as automatic fallback |
| PWA Support | Installable on mobile and desktop |
| Service Worker | Offline caching for fast repeat loads |
| SEO Infrastructure | Sitemap, robots.txt, Bing and Yandex verified |
| Custom Domain | Served at cloudai.srjahir.in via GitHub Pages CNAME |

---

## Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Backend**: Cloudflare Workers (worker.js)
- **AI — Text**: Groq Llama 3.3 70B / Gemini 2.5 Flash fallback
- **AI — Vision**: Groq Llama 4 Scout Vision / Gemini 2.5 Flash fallback
- **PWA**: Web App Manifest + Service Worker (Cache API)
- **Hosting**: GitHub Pages
- **CI/CD**: GitHub Actions — auto-deploys on push to main
- **Domain**: Custom domain via CNAME
- **SEO**: sitemap.xml, robots.txt, Bing Webmaster, Yandex, IndexNow

---

## If You Want to Build Your Own

You are welcome to use this code as a reference or starting point. A few things to keep in mind:

1. **Rename the project** — "CloudAI" is the name of this specific product by SRJahir Technologies. You cannot use this name for your own version.
2. **Set up your own API keys** — the worker uses environment variables. You will need to add your own Groq and Gemini API keys in your Cloudflare Worker settings under "Variables and Secrets". Do not hardcode them.
3. **Deploy your own worker** — create a new Cloudflare Worker and paste the `worker.js` code. Update the worker URL in the frontend to point to your own worker endpoint.
4. **Set up your own domain** — update the CNAME file and GitHub Pages settings to use your domain.

### Steps to get the backend running

1. Create a free account at [cloudflare.com](https://cloudflare.com)
2. Go to Workers and Pages, create a new Worker
3. Paste the contents of `worker.js`
4. Under Settings, add these environment variables:
   - `GROQ_API_KEY` — your Groq API key from [console.groq.com](https://console.groq.com)
   - `GEMINI_API_KEY` — your Gemini API key from [aistudio.google.com](https://aistudio.google.com)
5. Deploy the worker and copy your worker URL
6. Update the frontend to call your worker URL

---

## Project Structure

```
cloudai.srjahir.in/
├── index.html              # Main chat interface
├── live.html               # Alternate live view
├── worker.js               # Cloudflare Worker — AI backend
├── service-worker.js       # PWA offline caching logic
├── manifest.json           # PWA app metadata and icons
├── CNAME                   # Custom domain config for GitHub Pages
├── sitemap.xml             # Sitemap for search engine crawlers
├── robots.txt              # Crawler permissions
├── BingSiteAuth.xml        # Bing Webmaster Tools verification
├── yandex_*.html           # Yandex Search Console verification
├── indexnow-key.txt        # IndexNow key for instant URL indexing
├── favicon.svg / .png      # App icons
└──assets/                 # Styles, scripts, and static assets

```

---

## Running the Frontend Locally

```bash
git clone https://github.com/Srj0210/cloudai.srjahir.in.git
cd cloudai.srjahir.in

# No build step — open directly or serve locally
open index.html

# Or use a local server
npx serve .
```

---

## DevOps Practices Applied

- Continuous deployment — every push to main deploys automatically via GitHub Actions
- Serverless backend — Cloudflare Worker handles AI routing with zero infrastructure overhead
- Secret management — API keys stored as environment variables, never in source code
- PWA caching — service worker pre-caches assets for offline-capable loads
- Custom domain — CNAME maps to GitHub Pages with HTTPS via Cloudflare
- SEO pipeline — sitemap + IndexNow for instant search engine notifications
- Multi-engine verification — Bing and Yandex verified for full indexing coverage
- 278+ commits with iterative, incremental delivery

---

## Author

Built by **SRJahir Technologies**

- Site: [cloudai.srjahir.in](https://cloudai.srjahir.in)
- GitHub: [github.com/Srj0210](https://github.com/Srj0210)

---

## License

This project is open source. You may use the code as a reference for your own projects. The name "CloudAI" and branding are not included in this license — please use your own name and identity for any derivative projects.
