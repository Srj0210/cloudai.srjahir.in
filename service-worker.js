self.addEventListener("install", event => {
  console.log("📦 CloudAI service worker installed.");
});

self.addEventListener("fetch", event => {
  // Optional: you can add caching logic here later
});