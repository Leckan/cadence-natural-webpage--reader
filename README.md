# Cadence — Natural Voice Webpage Reader for Chrome

**Cadence** is a Manifest V3 Google Chrome extension and interactive browser preview that reads webpage text aloud using natural-sounding voices, with adjustable speed and pitch controls plus real-time sentence and word highlighting.

## Features

- **Natural Voice Selection**: Automatically prioritizes Natural, Neural, Google, Enhanced, and Siri system voices, with a language filter and a one-click **Test** sample button.
- **Adjustable Speed & Pitch**: Fine-tune playback speed from `0.5x` to `2.5x` using the slider, `−`/`+` steppers (`±0.1x`), or six quick presets (`0.75x`, `1.0x`, `1.25x`, `1.5x`, `1.75x`, `2.0x`), plus voice pitch (`0.80`–`1.20`). Changes apply seamlessly mid-playback or on resume.
- **Real-Time Highlight Tracking**: Tracks both the active sentence and the currently spoken word using Web Speech `onboundary` events, with a calibrated cadence fallback for voices that omit word-boundary callbacks.
- **Highlight Customization**: Switch between `Word + Sentence`, `Sentence`, `Word`, or `Off`, choose from four readable color themes (`Amber`, `Cobalt`, `Sage`, `Slate`), and toggle smooth auto-scroll.
- **Flexible Reading Controls**: Click any sentence to jump straight there, highlight text to read only the selected passage, or control playback and speed from the floating in-page mini bar when the popup is closed.
- **One-Click Extension Export**: Package and download a complete, unpacked-ready `cadence-chrome-extension.zip` (including auto-generated 16px, 48px, and 128px PNG icons) directly from the app.

## Install the Chrome Extension

1. Open the app and click **Download Extension** in the top bar to save `cadence-chrome-extension.zip`.
2. Unzip the archive to a permanent folder on your computer.
3. Open Google Chrome and go to `chrome://extensions`.
4. Turn on **Developer mode** in the upper-right corner.
5. Click **Load unpacked** and select the extracted folder containing `manifest.json`.
6. Click the Extensions puzzle icon in Chrome's toolbar and pin **Cadence**.

## Keyboard Shortcuts

| Trigger | Action |
| --- | --- |
| `Alt + Shift + R` | Play or pause reading on the active Chrome tab |
| Right-click selected text | Choose **Read selection aloud with Cadence** |
| Click any sentence | Jump directly to that sentence |
| `Space` *(Live Preview)* | Play or pause |
| `Left` / `Right` *(Live Preview)* | Previous / next sentence |
| `Up` / `Down` *(Live Preview)* | Increase / decrease reading speed by `0.1x` |

## Extension Structure & Permissions

The exported Manifest V3 package contains:

- `manifest.json` — Extension metadata, minimal permissions, and shortcut definitions
- `background.js` — Service worker for the right-click context menu and keyboard command
- `content.js` & `content.css` — Non-destructive DOM sentence/word highlighter, speech engine, and Shadow DOM floating mini bar
- `popup.html`, `popup.css`, `popup.js` — Toolbar popup UI synced with `chrome.storage.sync`
- `icons/icon16.png`, `icon48.png`, `icon128.png` — Extension icons

All speech synthesis runs locally using Chrome's built-in Speech Synthesis API with minimal permissions (`activeTab`, `scripting`, `storage`, `contextMenus`) and no external server calls.

## Local Development

```bash
npm install
npm run dev
```

Additional scripts:

- `npm run build` — Build the production web bundle
- `npm run lint` — Run TypeScript type-checking (`tsc --noEmit`)
