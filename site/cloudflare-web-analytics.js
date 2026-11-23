/* Cloudflare Web Analytics on a GitHub Pages-hosted site.
   Disabled or missing config makes no network requests. No cookies/UUIDs created here.
   The app's custom Studio usage events use a separate nonidentifying receiver. */
(() => {
  const config = window.SymphonyCSVWebAnalyticsConfig;
  if (!config || config.enabled !== true) return;
  if (navigator.globalPrivacyControl === true || navigator.doNotTrack === "1") return;
  const token = config.siteToken;
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{12,80}$/.test(token)) return;
  const script = document.createElement("script");
  script.type = "module";
  script.defer = true;
  script.src = "https://static.cloudflareinsights.com/beacon.min.js";
  script.setAttribute("data-cf-beacon", JSON.stringify({ token }));
  script.referrerPolicy = "strict-origin-when-cross-origin";
  document.head.appendChild(script);
})();
