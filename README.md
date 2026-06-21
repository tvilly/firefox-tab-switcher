# Firefox Tab Switcher

A Firefox desktop extension for switching tabs in most-recently-used order with an Alt-Tab-like overlay.

## Features

- `Alt+Q` opens the switcher and highlights the second-most-recent tab.
- Keep holding `Alt` and press `Q` repeatedly to move through the list.
- Release `Alt` to activate the highlighted tab.
- Press `Alt+S` while the switcher is open to search tabs by title and URL.
- Mouse wheel moves the highlight without activating tabs.
- Optional text-field capture lets `Alt+Q` work even when focus is inside a page text box.

## Development

```bash
npm install
npm run dev
```

`npm run dev` opens Firefox with the extension loaded in a temporary profile.

To load it in an existing Firefox profile, open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select `src/manifest.json`.

## Build

```bash
npm test
npm run lint:webext
npm run build
```

The packaged extension is written to `web-ext-artifacts/`.

## Install Note

Firefox Stable requires extensions to be signed by Mozilla for permanent installation. Release assets from this repository are packaged add-ons suitable for temporary loading or developer builds unless signed through AMO.
