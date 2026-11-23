/* Public configuration: populate only after the Cloudflare Worker passes end-to-end tests.
   Never put a secret or API key in this file. */
window.SYMPHONYCSV_FEEDBACK_CONFIG = Object.freeze({
  apiUrl: "https://symphonycsv-feedback-api.tarjin.workers.dev/v1/feedback",
  turnstileSiteKey: "0x4AAAAAAGPbN8LjgJKsYkOy"
});
