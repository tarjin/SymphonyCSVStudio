/* Single source of truth for the website's visible release designation.
   Change only RELEASE_LABEL when LABS becomes BETA, V1.0, etc.
   This does not change the actual release status of Studio binaries. */
(() => {
  const RELEASE_LABEL = "LABS";
  const elements = document.querySelectorAll("[data-scv-release]");
  for (const element of elements) {
    element.textContent = RELEASE_LABEL;
    element.setAttribute("aria-label", "Current release: " + RELEASE_LABEL);
  }
})();
