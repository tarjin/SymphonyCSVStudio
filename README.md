# SymphonyCSV Studio

**Make the demo. Hear the song. Share your music.**

SymphonyCSV Studio helps musicians turn written compositions into song demos in the browser, without requiring a full-fledged DAW.

## Repository layout

- `site/` — the deployable homepage, Studio LABS application, Help, CSV format specifications, and acknowledgments.
- `scripts/` — publishing checks and SoundFont assembly helpers.
- `.github/workflows/deploy-pages.yml` — GitHub Pages release workflow.

This repository publishes the **website and browser application**, not the entire local development worktree. The Rust source, project history, test suite, experiments, and other development-only materials remain protected locally until separately approved for open-source publication.

## Six bundled SoundFonts

SoundFont binaries are **not committed to ordinary Git files**. The deployment workflow expects six original assets named `track-01.sf2` through `track-06.sf2` on the `soundfonts-labs-rc1` GitHub Release. It checks their byte lengths and installs them at the precise URLs expected by Studio. If anything is missing, the workflow refuses to publish.

The public credits and license notices belong in `site/help/soundfonts/`.

## Publish process

1. Assemble the vetted static `site/` from the local RC1 staging site. Do not include temporary files, full source snapshots, or experiments.
2. Confirm browser-only dependency loading, including Tone.js and default SoundFonts, works on a normal web host rather than just localhost/Vite.
3. Upload the six curated SoundFonts as release assets, and verify licensing notices.
4. Review the release branch and merge it to `main` once the build is complete.
5. In Settings → Pages, use **GitHub Actions** and configure `SymphonyCSVStudio.com` with verified DNS and HTTPS.

A workflow failure is a **blocker**, never a reason to bypass a release check. No third-party application mentioned in the Help workflows is affiliated with SymphonyCSV Studio.

## Code and reuse

The website is publicly accessible, but no general open-source license has been granted for application source. Please do not assume public GitHub availability means unrestricted reuse.
