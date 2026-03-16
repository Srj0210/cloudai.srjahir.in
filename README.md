# CloudAI — Smart AI Assistant

A production-ready, PWA-enabled AI chat assistant deployed via GitHub Pages with a custom domain, service worker caching, and full SEO indexing across multiple search engines.

[![Live Demo](https://img.shields.io/badge/Live-cloudai.srjahir.in-blue?style=flat-square&logo=google-chrome)](https://cloudai.srjahir.in)
[![GitHub Pages](https://img.shields.io/badge/Deployed-GitHub%20Pages-222?style=flat-square&logo=github)](https://github.com/Srj0210/cloudai.srjahir.in)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-5A0FC8?style=flat-square&logo=pwa)](https://cloudai.srjahir.in/manifest.json)
[![Commits](https://img.shields.io/github/commit-activity/t/Srj0210/cloudai.srjahir.in?style=flat-square&label=Commits)](https://github.com/Srj0210/cloudai.srjahir.in/commits/main)

---

## Live Site

[https://cloudai.srjahir.in](https://cloudai.srjahir.in)

---

## About the Project

CloudAI is a browser-based AI assistant that supports real-time chat, voice input, and file or image attachments. It is built with vanilla HTML, CSS, and JavaScript and deployed as a Progressive Web App on GitHub Pages with a custom domain.

The project covers the full lifecycle of a web product — from writing the code to deploying it, setting up caching for offline use, and making it discoverable across Google, Bing, and Yandex. It is maintained with 278+ commits and follows a clean, iterative delivery approach.

---

## Features

| Feature | Description |
|---|---|
| Chat Interface | Responsive AI chat UI with message history |
| Voice Input | Browser microphone integration for speech-to-text |
| File Attachments | Support for images, photos, and documents |
| PWA Support | Installable on mobile and desktop as a native-like app |
| Service Worker | Offline caching so the app loads even without a connection |
| SEO Infrastructure | Sitemap, robots.txt, and verified across multiple search engines |
| Custom Domain | Served at cloudai.srjahir.in via a GitHub Pages CNAME setup |

---

## Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **PWA**: Web App Manifest + Service Worker (Cache API)
- **Hosting**: GitHub Pages
- **CI/CD**: GitHub Actions — auto-deploys on every push to main
- **Domain**: Custom domain managed via CNAME
- **SEO**: sitemap.xml, robots.txt, Bing Webmaster, Yandex verification, IndexNow

---

## Deployment Architecture

```
Developer pushes to main branch
        |
        v
  GitHub Repository
        |
   GitHub Actions triggers build and deploy
        |
        v
  GitHub Pages (static hosting)
        |
   CNAME routes traffic to cloudai.srjahir.in
        |
        v
  Live production site
```

### DevOps Practices Applied

- Continuous deployment — every push to main goes live automatically via GitHub Actions
- Custom domain setup — CNAME file handles DNS routing to GitHub Pages
- PWA caching — service worker pre-caches critical assets for fast, offline-capable loads
- SEO indexing pipeline — sitemap.xml combined with IndexNow for instant crawl notifications
- Multi-engine verification — Bing and Yandex both verified for full indexing coverage
- Web App Manifest — enables install prompts and defines app metadata for PWA compliance
- Version control discipline — 278+ commits with consistent, incremental delivery

---

## Project Structure

```
cloudai.srjahir.in/
├── index.html              # Main chat interface
├── live.html               # Alternate live view
├── service-worker.js       # PWA offline caching logic
├── manifest.json           # PWA app metadata and icons
├── CNAME                   # Custom domain config for GitHub Pages
├── sitemap.xml             # Sitemap for search engine crawlers
├── robots.txt              # Crawler permissions
├── BingSiteAuth.xml        # Bing Webmaster Tools verification
├── yandex_*.html           # Yandex Search Console verification
├── indexnow-key.txt        # IndexNow key for instant URL indexing
├── favicon.svg / .png      # App icons
├── assets/                 # Styles, scripts, and static assets

```

---

## Running Locally

```bash
# Clone the repository
git clone https://github.com/Srj0210/cloudai.srjahir.in.git

cd cloudai.srjahir.in

# No build step needed — open directly or serve locally
open index.html

# Or use a simple local server
npx serve .
```

## Deploying Your Own Instance

1. Fork this repository
2. Go to Settings, then Pages
3. Set the source to the main branch, root directory
4. Add your custom domain under Custom Domain if needed
5. Update the CNAME file with your domain
6. Push to main — GitHub Actions deploys automatically

---

## SEO and Indexing

Search engine coverage is handled through a combination of static files and active verification:

- **Google** — covered via sitemap.xml submission in Search Console
- **Bing** — verified via BingSiteAuth.xml and using IndexNow for real-time URL push
- **Yandex** — verified via the yandex HTML file in the root directory
- **IndexNow** — key-based protocol that notifies search engines immediately when content changes

---

## Contributing

Pull requests are welcome. For larger changes, open an issue first to discuss what you want to change.

```bash
git checkout -b feature/your-feature
git commit -m "feat: describe your change"
git push origin feature/your-feature
# Then open a Pull Request
```

---

## Author

**Srj Jahir**
- Site: [cloudai.srjahir.in](https://cloudai.srjahir.in)
- GitHub: [github.com/Srj0210](https://github.com/Srj0210)

---

## License

This project is open source. See the repository for details.
