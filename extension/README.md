# Patchbook Capture extension

This is the first browser-capture bridge for Patchbook.

## Install locally

1. Open Chrome and visit `chrome://extensions`.
2. Enable Developer mode.
3. Choose **Load unpacked**.
4. Select this `extension/` directory.
5. Open the extension on any webpage.
6. Click **Select element**.
7. Click the UI element you want to review.
8. A new Patchbook tab opens with the capture imported.

The extension currently captures:
- visible-tab PNG
- page URL and route
- viewport dimensions
- tag, id, classes, role and ARIA label
- a stable-ish CSS selector
- `data-component` / `data-slot` when the app exposes them
- visible text snippet

The extension is intentionally local-first. No capture is uploaded to a Patchbook server by the extension.

## Target

The deployment URL is currently hardcoded to the public Patchbook deployment. Change `PATCHBOOK_URL` in `background.js` when testing another deployment or local instance.