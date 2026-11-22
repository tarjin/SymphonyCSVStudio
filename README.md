# SymphonyCSV Studio

**Make the demo. Hear the song. Share your music.**

SymphonyCSV Studio is a browser-based environment for musicians to arrange and audition compositions and export song demos without needing a full DAW.

## Repository layout

- `site/`: the deployable website and application, including `/app/`, `/help/`, and the official CSV format documentation
- `studio-src/`: an independently preserved snapshot of the application source and tests at the release checkpoint
- `scripts/`: release checks and SoundFont asset assembly
- `.github/workflows/deploy-pages.yml`: GitHub Pages deployment

## SoundFonts

The six bundled SoundFonts are **not stored as normal Git files**. They are uploaded as six assets named `track-01.sf2` through `track-06.sf2` on GitHub Release `soundfonts-labs-rc1`. The Pages workflow checks their byte lengths and installs them at the exact URLs used by Studio before deployment.

Read `site/help/soundfonts/` for creator acknowledgments and licenses. Third-party SoundFonts loaded by users remain subject to their own license terms.

## Publishing

1. Prepare and test the static `site/` files separately from the protected local RC1 development worktree.
2. Upload the six release assets under `soundfonts-labs-rc1`.
3. Confirm the standalone static site works (not only the Vite development server), especially SoundFont loading and effects.
4. Review and merge this release branch into `main`.
5. In repository Settings → Pages, select **GitHub Actions**; configure `SymphonyCSVStudio.com` as the custom domain and verify HTTPS/DNS.

The GitHub Pages workflow intentionally fails if a bundled SoundFont asset is absent or has an unexpected size. It will never publish a partial set of instruments.

This repository is public to make the website accessible. Unless an explicit license is added, publication does not itself grant a general right to reuse the source code.
