# Patchbook Capture extension

This is the browser-capture bridge for Patchbook.

## Install locally

1. Open Chrome and visit `chrome://extensions`.
2. Enable Developer mode.
3. Choose **Load unpacked**.
4. Select this `extension/` directory.
5. Open the extension on a normal webpage.
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
- opportunistic React component name when React exposes a client fiber
- opportunistic React source file / line / column in development builds when debug source metadata is available

React metadata is deliberately best-effort. Patchbook does not depend on React internals being present.

## Transport

Captures are stored temporarily in `chrome.storage.local` under a generated capture key. Patchbook is opened with that key in the URL, and the Patchbook bridge reads the stored packet locally.

This avoids pushing the screenshot through the browser's tab-to-tab message path.

The bridge removes a consumed capture from extension storage after importing it.

## Privacy

The extension is local-first. The capture packet is stored in the browser extension's local storage and passed into the Patchbook page. Patchbook itself persists the imported review locally.

No capture API or Patchbook backend is required.

## Target

The deployment URL is currently hardcoded to the public Patchbook deployment. Change `PATCHBOOK_URL` in `background.js` when testing another deployment or local instance.

The capture packet remains versioned as `patchbook-browser-capture/v1`.
