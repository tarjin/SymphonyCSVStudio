import { characterCount, isUuidV4, validateAnswers } from "./validation.mjs";

const config = window.SYMPHONYCSV_FEEDBACK_CONFIG || {};
const form = document.getElementById("feedback-form");
const button = document.getElementById("submit-button");
const message = document.getElementById("service-message");
const explanation = document.getElementById("explanation");
const counter = document.getElementById("explanation-counter");
const scoreError = document.getElementById("score-error");
const explanationError = document.getElementById("explanation-error");
const idDisplay = document.getElementById("browser-id-display");
const success = document.getElementById("success");
const STORAGE_KEY = "symphonycsv_feedback_browser_id_v1";

let browserId = null;
let turnstileToken = null;
let turnstileWidgetId = null;
let pending = null;
let attempted = false;
let submitting = false;
let serviceReady = false;

function status(text) { message.textContent = text; }
function selectedScore() {
  const selected = form.querySelector('input[name="score"]:checked');
  return selected ? Number(selected.value) : null;
}
function showCount() {
  const n = characterCount(explanation.value.trim());
  counter.textContent = n.toLocaleString("en-CA") + " / 2,000 characters";
  counter.style.color = n > 2000 ? "var(--error)" : "";
}
function showErrors() {
  const checked = validateAnswers(selectedScore(), explanation.value);
  scoreError.textContent = checked.errors.score || "";
  explanationError.textContent = checked.errors.explanation || "";
  explanation.setAttribute("aria-invalid", String(Boolean(checked.errors.explanation)));
  return checked;
}
function getOrCreateBrowserId() {
  try {
    let value = localStorage.getItem(STORAGE_KEY);
    if (!isUuidV4(value)) {
      value = crypto.randomUUID();
      localStorage.setItem(STORAGE_KEY, value);
    }
    return value;
  } catch (_error) {
    return null;
  }
}
function canConfigure() {
  try {
    const endpoint = new URL(config.apiUrl);
    return endpoint.protocol === "https:" && Boolean(endpoint.hostname) &&
      Boolean(config.turnstileSiteKey);
  } catch (_error) {
    return false;
  }
}
function loadTurnstile() {
  const script = document.createElement("script");
  script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  script.async = true;
  script.onload = () => {
    if (!window.turnstile) {
      status("Spam protection could not load. Please try again later.");
      button.disabled = true;
      return;
    }
    try {
      turnstileWidgetId = window.turnstile.render("#turnstile-container", {
        sitekey: config.turnstileSiteKey,
        callback: token => { turnstileToken = token; status(""); },
        "expired-callback": () => { turnstileToken = null; status("Verification expired. Please verify again."); },
        "error-callback": () => { turnstileToken = null; status("Verification was unavailable. Please retry."); }
      });
      serviceReady = true;
      button.disabled = false;
      status("");
    } catch (_error) {
      status("Feedback verification is unavailable right now.");
      button.disabled = true;
    }
  };
  script.onerror = () => { status("Feedback verification could not load. Please check your connection."); button.disabled = true; };
  document.head.appendChild(script);
}
function resetTurnstile() {
  turnstileToken = null;
  if (window.turnstile && turnstileWidgetId !== null) {
    window.turnstile.reset(turnstileWidgetId);
  }
}

browserId = getOrCreateBrowserId();
idDisplay.textContent = browserId || "Unavailable — browser storage is blocked";
showCount();
if (!browserId) {
  status("This browser is blocking storage needed for a repeat-feedback identifier. Enable site storage to submit feedback.");
} else if (!canConfigure()) {
  status("Feedback submissions are not enabled yet. Please check back soon.");
} else {
  status("Loading secure verification…");
  loadTurnstile();
}

document.getElementById("reset-id").addEventListener("click", () => {
  if (!window.confirm("Generate a new feedback identifier in this browser? Previously submitted feedback will remain stored on the server. Your music projects will not be changed.")) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    browserId = getOrCreateBrowserId();
    idDisplay.textContent = browserId || "Unavailable";
    pending = null;
    if (!browserId) { status("Browser storage is unavailable."); button.disabled = true; }
    else if (serviceReady) { button.disabled = false; }
  } catch (_error) {
    status("Browser storage could not be reset.");
  }
});
form.addEventListener("change", event => {
  if (event.target.name === "score") {
    pending = null;
    if (attempted) showErrors();
  }
});
explanation.addEventListener("input", () => {
  pending = null;
  showCount();
  if (attempted) showErrors();
});

form.addEventListener("submit", async event => {
  event.preventDefault();
  if (submitting || !serviceReady || !browserId) return;

  attempted = true;
  const checked = showErrors();
  if (!checked.valid) {
    if (checked.errors.score) form.querySelector('input[name="score"]').focus();
    else explanation.focus();
    return;
  }
  if (!turnstileToken) {
    status("Please complete the spam-protection verification before submitting.");
    return;
  }

  const score = selectedScore();
  if (!pending || pending.score !== score || pending.explanation !== checked.explanation) {
    pending = { submission_id: crypto.randomUUID(), score, explanation: checked.explanation };
  }
  submitting = true;
  button.disabled = true;
  status("Submitting your feedback…");
  try {
    const response = await fetch(config.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        browser_id: browserId,
        submission_id: pending.submission_id,
        score: pending.score,
        explanation: pending.explanation,
        turnstile_token: turnstileToken
      }),
      cache: "no-store"
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      if (response.status === 429) {
        throw new Error("Please allow a short interval between submissions and try again.");
      }
      throw new Error(result.message || "Feedback could not be saved. Please try again.");
    }
    form.classList.add("hidden");
    success.classList.remove("hidden");
    success.focus();
  } catch (error) {
    status(error.message || "A network error interrupted the submission. Please retry.");
    resetTurnstile();
  } finally {
    submitting = false;
    if (!form.classList.contains("hidden")) button.disabled = !serviceReady || !browserId;
  }
});
