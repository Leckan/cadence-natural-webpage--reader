export interface ExtensionSourceFile {
  path: string;
  label: string;
  language: 'json' | 'javascript' | 'html' | 'css' | 'markdown';
  summary: string;
  content: string;
}

export const EXTENSION_FILES: ExtensionSourceFile[] = [
  {
    path: 'manifest.json',
    label: 'manifest.json',
    language: 'json',
    summary: 'Manifest V3 definition, minimal permissions, keyboard shortcut, and toolbar popup entry.',
    content: `{
  "manifest_version": 3,
  "name": "Cadence — Natural Webpage Reader",
  "version": "1.0.0",
  "description": "Read any webpage aloud with natural-sounding voices, adjustable playback speed, and real-time word and sentence highlighting.",
  "permissions": [
    "activeTab",
    "scripting",
    "storage",
    "contextMenus"
  ],
  "action": {
    "default_popup": "popup.html",
    "default_title": "Read page with Cadence",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["http://*/*", "https://*/*"],
      "js": ["content.js"],
      "css": ["content.css"],
      "run_at": "document_idle"
    }
  ],
  "commands": {
    "toggle-reading": {
      "suggested_key": {
        "default": "Alt+Shift+R",
        "mac": "Alt+Shift+R"
      },
      "description": "Play or pause reading the current webpage"
    }
  }
}
`,
  },
  {
    path: 'background.js',
    label: 'background.js',
    language: 'javascript',
    summary: 'MV3 service worker registering the right-click context menu and keyboard shortcuts.',
    content: `const CONTEXT_MENU_ID = 'cadence-read-selection';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: 'Read selection aloud with Cadence',
      contexts: ['selection'],
    });
  });
});

async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'CADENCE_PING' });
  } catch {
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ['content.css'],
    });
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    });
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID || !tab?.id || !info.selectionText) {
    return;
  }
  await ensureContentScript(tab.id);
  chrome.tabs.sendMessage(tab.id, {
    type: 'CADENCE_READ_SELECTION',
    text: info.selectionText,
  });
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-reading') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  await ensureContentScript(tab.id);
  chrome.tabs.sendMessage(tab.id, { type: 'CADENCE_TOGGLE_PLAY' });
});
`,
  },
  {
    path: 'content.js',
    label: 'content.js',
    language: 'javascript',
    summary: 'Extracts webpage article text, wraps sentences/words non-destructively, speaks via Web Speech API, highlights live words, and renders a Shadow DOM mini-player.',
    content: `(() => {
  if (window.__CADENCE_LOADED__) return;
  window.__CADENCE_LOADED__ = true;

  const DEFAULT_SETTINGS = {
    voiceURI: '',
    rate: 1.0,
    pitch: 1.0,
    highlightMode: 'both',
    highlightColor: 'amber',
    autoScroll: true,
  };

  let settings = { ...DEFAULT_SETTINGS };
  let sentences = []; // { el, text, wordSpans: [{ span, start, end }] }
  let originalNodes = []; // For clean DOM restoration on stop
  let activeSentenceIdx = -1;
  let activeSelectionText = null;
  let activeUtterance = null;
  let status = 'idle'; // 'idle' | 'playing' | 'paused'
  let runId = 0;
  let boundarySeen = false;
  let fallbackTimer = null;
  let watchdogTimer = null;
  let miniBarHost = null;
  let miniBarShadow = null;

  const NATURAL_KEYWORDS = [
    'natural', 'neural', 'google', 'enhanced', 'premium', 'siri',
    'ava', 'aria', 'jenny', 'guy', 'samantha', 'daniel'
  ];

  function scoreVoice(v) {
    const lower = (v.name + ' ' + v.voiceURI).toLowerCase();
    let score = 0;
    if (lower.includes('natural') || lower.includes('neural')) score += 100;
    if (lower.includes('google us english') || lower.includes('google uk english')) score += 90;
    if (lower.includes('enhanced') || lower.includes('premium')) score += 85;
    if (lower.includes('google')) score += 70;
    if (NATURAL_KEYWORDS.some((kw) => lower.includes(kw))) score += 40;
    if (v.lang.toLowerCase().startsWith('en-us')) score += 25;
    else if (v.lang.toLowerCase().startsWith('en')) score += 18;
    return score;
  }

  function pickVoice() {
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;
    if (settings.voiceURI) {
      const exact = voices.find((v) => v.voiceURI === settings.voiceURI);
      if (exact) return exact;
    }
    return [...voices].sort((a, b) => scoreVoice(b) - scoreVoice(a))[0];
  }

  function loadSettings() {
    return new Promise((resolve) => {
      if (!chrome?.storage?.sync) {
        resolve(settings);
        return;
      }
      chrome.storage.sync.get(DEFAULT_SETTINGS, (stored) => {
        settings = { ...DEFAULT_SETTINGS, ...stored };
        applyHighlightClasses();
        resolve(settings);
      });
    });
  }

  function applyHighlightClasses() {
    document.documentElement.setAttribute('data-cadence-mode', settings.highlightMode);
    document.documentElement.setAttribute('data-cadence-color', settings.highlightColor);
  }

  function splitSentences(text) {
    if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
      const seg = new Intl.Segmenter(document.documentElement.lang || 'en', {
        granularity: 'sentence',
      });
      return Array.from(seg.segment(text))
        .map((s) => s.segment)
        .filter((s) => /[\\p{L}\\p{N}]/u.test(s));
    }
    const matches = text.match(/[^.!?]+[.!?]+["'”’)\\]]*\\s*|[^.!?]+$/g);
    return matches ? matches.filter((s) => /[\\p{L}\\p{N}]/u.test(s)) : [text];
  }

  function findPrimaryRoot() {
    return (
      document.querySelector('article') ||
      document.querySelector('main') ||
      document.querySelector('[role="main"]') ||
      document.body
    );
  }

  function isVisibleElement(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
    const style = window.getComputedStyle(el);
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      parseFloat(style.opacity) > 0
    );
  }

  function prepareReadableDOM() {
    restoreDOM();
    const root = findPrimaryRoot();
    const skipTags = new Set([
      'SCRIPT', 'STYLE', 'NOSCRIPT', 'NAV', 'FOOTER', 'HEADER',
      'ASIDE', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'CODE', 'PRE', 'SVG'
    ]);

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (node.nodeValue.trim().length < 2) return NodeFilter.FILTER_REJECT;
        let parent = node.parentElement;
        while (parent && parent !== document.body) {
          if (skipTags.has(parent.tagName) || parent.closest('[aria-hidden="true"]')) {
            return NodeFilter.FILTER_REJECT;
          }
          parent = parent.parentElement;
        }
        return isVisibleElement(node.parentElement)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      },
    });

    const textNodes = [];
    while (walker.nextNode()) {
      textNodes.push(walker.currentNode);
    }

    textNodes.forEach((textNode) => {
      const parent = textNode.parentNode;
      if (!parent) return;

      const raw = textNode.nodeValue;
      const parts = splitSentences(raw);
      if (!parts.length) return;

      const wrapper = document.createElement('span');
      wrapper.className = 'cadence-node-group';

      parts.forEach((sentenceStr) => {
        const sentenceSpan = document.createElement('span');
        sentenceSpan.className = 'cadence-sentence';
        const idx = sentences.length;
        sentenceSpan.dataset.cadenceIdx = String(idx);

        const wordSpans = [];
        const tokenRegex = /(\\s+|[^\\s]+)/g;
        let match;
        while ((match = tokenRegex.exec(sentenceStr)) !== null) {
          const token = match[0];
          const isWord = /[\\p{L}\\p{N}]/u.test(token);
          if (isWord) {
            const wSpan = document.createElement('span');
            wSpan.className = 'cadence-word';
            wSpan.textContent = token;
            sentenceSpan.appendChild(wSpan);
            wordSpans.push({
              span: wSpan,
              start: match.index,
              end: match.index + token.length,
              text: token,
            });
          } else {
            sentenceSpan.appendChild(document.createTextNode(token));
          }
        }

        sentenceSpan.addEventListener('click', (e) => {
          if (status !== 'idle') {
            const sel = window.getSelection();
            if (sel && sel.toString().trim().length > 0) return;
            e.stopPropagation();
            speakSentence(idx);
          }
        });

        wrapper.appendChild(sentenceSpan);
        sentences.push({
          el: sentenceSpan,
          text: sentenceStr,
          wordSpans,
        });
      });

      originalNodes.push({ parent, wrapper, textNode });
      parent.replaceChild(wrapper, textNode);
    });
  }

  function restoreDOM() {
    clearActiveHighlights();
    originalNodes.forEach(({ parent, wrapper, textNode }) => {
      if (wrapper.parentNode === parent) {
        parent.replaceChild(textNode, wrapper);
      }
    });
    originalNodes = [];
    sentences = [];
  }

  function clearActiveHighlights() {
    document.querySelectorAll('.cadence-sentence-active').forEach((el) => {
      el.classList.remove('cadence-sentence-active');
    });
    document.querySelectorAll('.cadence-word-active').forEach((el) => {
      el.classList.remove('cadence-word-active');
    });
  }

  function clearTimers() {
    if (fallbackTimer) {
      clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }
    if (watchdogTimer) {
      clearInterval(watchdogTimer);
      watchdogTimer = null;
    }
  }

  function highlightWordByCharIndex(entry, charIndex) {
    entry.wordSpans.forEach((w) => w.span.classList.remove('cadence-word-active'));
    const match =
      entry.wordSpans.find((w) => charIndex >= w.start && charIndex < w.end) ||
      entry.wordSpans.find((w) => w.start >= charIndex);
    if (match) {
      match.span.classList.add('cadence-word-active');
    }
  }

  function startCalibratedFallback(entry, localRunId) {
    let cursor = 0;
    const step = () => {
      if (runId !== localRunId || boundarySeen) return;
      if (status === 'paused') {
        fallbackTimer = setTimeout(step, 120);
        return;
      }
      entry.wordSpans.forEach((w) => w.span.classList.remove('cadence-word-active'));
      const current = entry.wordSpans[cursor];
      if (!current) return;
      current.span.classList.add('cadence-word-active');

      const delay = Math.max(160, Math.min(600, (120 + current.text.length * 36) / settings.rate));
      cursor += 1;
      if (cursor < entry.wordSpans.length) {
        fallbackTimer = setTimeout(step, delay);
      }
    };
    step();
  }

  function speakSentence(index) {
    if (index < 0 || index >= sentences.length) {
      stopReading();
      return;
    }

    const localRunId = ++runId;
    clearTimers();
    clearActiveHighlights();
    window.speechSynthesis.cancel();

    activeSentenceIdx = index;
    status = 'playing';
    boundarySeen = false;

    const entry = sentences[index];
    entry.el.classList.add('cadence-sentence-active');
    if (entry.wordSpans[0]) {
      entry.wordSpans[0].span.classList.add('cadence-word-active');
    }

    if (settings.autoScroll) {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      entry.el.scrollIntoView({
        behavior: reduced ? 'auto' : 'smooth',
        block: 'center',
      });
    }

    const utterance = new SpeechSynthesisUtterance(entry.text);
    activeUtterance = utterance;
    activeSelectionText = null;
    utterance.rate = settings.rate;
    utterance.pitch = settings.pitch;
    const voice = pickVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }

    utterance.onstart = () => {
      if (runId !== localRunId) return;
      fallbackTimer = setTimeout(() => {
        if (runId === localRunId && !boundarySeen) {
          startCalibratedFallback(entry, localRunId);
        }
      }, 420);

      watchdogTimer = setInterval(() => {
        if (runId === localRunId && window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        }
      }, 12000);
    };

    utterance.onboundary = (event) => {
      if (runId !== localRunId) return;
      if (event.name === 'word' || typeof event.charIndex === 'number') {
        boundarySeen = true;
        if (fallbackTimer) {
          clearTimeout(fallbackTimer);
          fallbackTimer = null;
        }
        highlightWordByCharIndex(entry, event.charIndex);
      }
    };

    utterance.onend = () => {
      if (runId !== localRunId) return;
      clearTimers();
      if (index + 1 < sentences.length) {
        speakSentence(index + 1);
      } else {
        stopReading();
      }
    };

    utterance.onerror = (event) => {
      if (runId !== localRunId) return;
      if (event.error === 'interrupted' || event.error === 'canceled') return;
      stopReading();
    };

    renderMiniBar();
    broadcastState();
    window.speechSynthesis.speak(utterance);
  }

  function startReading() {
    applyHighlightClasses();
    if (!sentences.length) {
      prepareReadableDOM();
    }
    if (!sentences.length) return;
    speakSentence(activeSentenceIdx >= 0 ? activeSentenceIdx : 0);
  }

  function pauseReading() {
    if (status !== 'playing') return;
    window.speechSynthesis.pause();
    status = 'paused';
    renderMiniBar();
    broadcastState();
  }

  let settingsChangedWhilePaused = false;

  function resumeReading() {
    if (status !== 'paused') return;
    if (!settingsChangedWhilePaused && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      status = 'playing';
      renderMiniBar(activeSelectionText ? 'Reading selection' : undefined);
      broadcastState();
    } else {
      settingsChangedWhilePaused = false;
      if (activeSelectionText) {
        readSelectionText(activeSelectionText);
      } else {
        speakSentence(Math.max(0, activeSentenceIdx));
      }
    }
  }

  function stopReading() {
    runId += 1;
    clearTimers();
    settingsChangedWhilePaused = false;
    activeUtterance = null;
    activeSelectionText = null;
    window.speechSynthesis.cancel();
    status = 'idle';
    activeSentenceIdx = -1;
    restoreDOM();
    removeMiniBar();
    broadcastState();
  }

  function readSelectionText(text) {
    const cleaned = (text || '').trim();
    if (!cleaned) return;
    stopReading();
    const localRunId = ++runId;
    activeSelectionText = cleaned;
    status = 'playing';
    const utterance = new SpeechSynthesisUtterance(cleaned);
    activeUtterance = utterance;
    utterance.rate = settings.rate;
    utterance.pitch = settings.pitch;
    const voice = pickVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }
    utterance.onend = () => {
      if (runId !== localRunId) return;
      activeUtterance = null;
      activeSelectionText = null;
      status = 'idle';
      removeMiniBar();
      broadcastState();
    };
    renderMiniBar('Reading selection');
    broadcastState();
    window.speechSynthesis.speak(utterance);
  }

  function getStatePayload() {
    return {
      status,
      activeSentenceIdx,
      totalSentences: sentences.length,
      settings,
    };
  }

  function broadcastState() {
    chrome.runtime.sendMessage({
      type: 'CADENCE_STATE_UPDATE',
      state: getStatePayload(),
    }).catch(() => {});
  }

  function updateRateInPage(delta) {
    const nextRate = Math.round(Math.min(2.5, Math.max(0.5, settings.rate + delta)) * 100) / 100;
    if (nextRate === settings.rate) return;
    settings = { ...settings, rate: nextRate };
    chrome.storage?.sync?.set({ rate: nextRate });
    if (status === 'playing') {
      if (activeSelectionText) {
        readSelectionText(activeSelectionText);
      } else if (activeSentenceIdx >= 0) {
        speakSentence(activeSentenceIdx);
      }
    } else if (status === 'paused') {
      settingsChangedWhilePaused = true;
      renderMiniBar(activeSelectionText ? 'Reading selection' : undefined);
      broadcastState();
    }
  }

  // Shadow DOM isolated floating mini control bar so webpage CSS never interferes
  function renderMiniBar(customLabel) {
    if (!miniBarHost) {
      miniBarHost = document.createElement('div');
      miniBarHost.id = 'cadence-floating-bar-host';
      miniBarHost.style.cssText =
        'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:2147483647;';
      miniBarShadow = miniBarHost.attachShadow({ mode: 'open' });
      document.documentElement.appendChild(miniBarHost);
    }

    const label =
      customLabel ||
      (sentences.length > 0
        ? \`\${activeSentenceIdx + 1} / \${sentences.length}\`
        : 'Cadence');

    miniBarShadow.innerHTML = \`
      <style>
        .bar {
          display: flex; align-items: center; gap: 8px;
          background: #0f172a; color: #f8fafc;
          padding: 8px 12px; border-radius: 12px;
          box-shadow: 0 12px 28px rgba(15, 23, 42, 0.28);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: 13px; border: 1px solid rgba(255,255,255,0.12);
        }
        button {
          background: transparent; border: none; color: #f8fafc;
          cursor: pointer; padding: 5px 8px; border-radius: 6px;
          font-size: 12px; font-weight: 600;
        }
        button:hover { background: rgba(255,255,255,0.12); }
        .primary { background: #2563eb; padding: 6px 12px; }
        .primary:hover { background: #1d4ed8; }
        .divider { width: 1px; height: 16px; background: rgba(255,255,255,0.16); }
        .meta { color: #cbd5e1; font-variant-numeric: tabular-nums; padding: 0 2px; font-size: 12px; }
      </style>
      <div class="bar">
        <button id="prev" title="Previous sentence">&#9664;</button>
        <button id="toggle" class="primary">\${status === 'playing' ? 'Pause' : 'Resume'}</button>
        <button id="next" title="Next sentence">&#9654;</button>
        <span class="divider"></span>
        <button id="slower" title="Slower (-0.1x)">&minus;</button>
        <span class="meta">\${settings.rate.toFixed(1)}x</span>
        <button id="faster" title="Faster (+0.1x)">+</button>
        <span class="divider"></span>
        <span class="meta">\${label}</span>
        <button id="stop" title="Stop reading">Stop</button>
      </div>
    \`;

    miniBarShadow.getElementById('prev')?.addEventListener('click', () => {
      if (activeSentenceIdx > 0) speakSentence(activeSentenceIdx - 1);
    });
    miniBarShadow.getElementById('next')?.addEventListener('click', () => {
      if (activeSentenceIdx + 1 < sentences.length) speakSentence(activeSentenceIdx + 1);
    });
    miniBarShadow.getElementById('toggle')?.addEventListener('click', () => {
      if (status === 'playing') pauseReading();
      else resumeReading();
    });
    miniBarShadow.getElementById('slower')?.addEventListener('click', () => updateRateInPage(-0.1));
    miniBarShadow.getElementById('faster')?.addEventListener('click', () => updateRateInPage(0.1));
    miniBarShadow.getElementById('stop')?.addEventListener('click', stopReading);
  }

  function removeMiniBar() {
    if (miniBarHost) {
      miniBarHost.remove();
      miniBarHost = null;
      miniBarShadow = null;
    }
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'CADENCE_PING') {
      sendResponse({ ok: true });
      return true;
    }
    if (msg.type === 'CADENCE_GET_STATE') {
      sendResponse(getStatePayload());
      return true;
    }
    if (msg.type === 'CADENCE_PLAY') {
      if (status === 'paused') resumeReading();
      else startReading();
      sendResponse(getStatePayload());
      return true;
    }
    if (msg.type === 'CADENCE_PAUSE') {
      pauseReading();
      sendResponse(getStatePayload());
      return true;
    }
    if (msg.type === 'CADENCE_TOGGLE_PLAY') {
      if (status === 'playing') pauseReading();
      else if (status === 'paused') resumeReading();
      else startReading();
      sendResponse(getStatePayload());
      return true;
    }
    if (msg.type === 'CADENCE_STOP') {
      stopReading();
      sendResponse(getStatePayload());
      return true;
    }
    if (msg.type === 'CADENCE_NEXT') {
      if (activeSentenceIdx + 1 < sentences.length) speakSentence(activeSentenceIdx + 1);
      sendResponse(getStatePayload());
      return true;
    }
    if (msg.type === 'CADENCE_PREV') {
      if (activeSentenceIdx > 0) speakSentence(activeSentenceIdx - 1);
      sendResponse(getStatePayload());
      return true;
    }
    if (msg.type === 'CADENCE_READ_SELECTION') {
      readSelectionText(msg.text);
      sendResponse(getStatePayload());
      return true;
    }
    if (msg.type === 'CADENCE_UPDATE_SETTINGS') {
      const prevRate = settings.rate;
      const prevPitch = settings.pitch;
      const prevVoice = settings.voiceURI;
      settings = { ...settings, ...msg.settings };
      applyHighlightClasses();
      const audioChanged =
        prevRate !== settings.rate || prevPitch !== settings.pitch || prevVoice !== settings.voiceURI;
      if (audioChanged && status === 'playing') {
        if (activeSelectionText) {
          readSelectionText(activeSelectionText);
        } else if (activeSentenceIdx >= 0) {
          speakSentence(activeSentenceIdx);
        }
      } else if (audioChanged && status === 'paused') {
        settingsChangedWhilePaused = true;
        renderMiniBar(activeSelectionText ? 'Reading selection' : undefined);
      } else if (status !== 'idle') {
        renderMiniBar(activeSelectionText ? 'Reading selection' : undefined);
      }
      sendResponse(getStatePayload());
      return true;
    }
    return false;
  });

  loadSettings();
})();
`,
  },
  {
    path: 'content.css',
    label: 'content.css',
    language: 'css',
    summary: 'Non-intrusive webpage highlight styles for all 4 color themes and word/sentence tracking modes.',
    content: `/* Cadence webpage highlight styles */
.cadence-sentence {
  border-radius: 3px;
  transition: background-color 140ms ease;
}

.cadence-word {
  border-radius: 3px;
  padding: 0 1px;
  transition: background-color 90ms ease, color 90ms ease;
}

/* Color: Amber */
:root[data-cadence-color="amber"] .cadence-sentence-active {
  background-color: rgba(254, 243, 199, 0.85);
}
:root[data-cadence-color="amber"] .cadence-word-active {
  background-color: #fcd34d;
  color: #0f172a;
}

/* Color: Cobalt */
:root[data-cadence-color="cobalt"] .cadence-sentence-active {
  background-color: rgba(219, 234, 254, 0.85);
}
:root[data-cadence-color="cobalt"] .cadence-word-active {
  background-color: #93c5fd;
  color: #0f172a;
}

/* Color: Sage */
:root[data-cadence-color="sage"] .cadence-sentence-active {
  background-color: rgba(220, 252, 231, 0.85);
}
:root[data-cadence-color="sage"] .cadence-word-active {
  background-color: #86efac;
  color: #0f172a;
}

/* Color: Slate */
:root[data-cadence-color="slate"] .cadence-sentence-active {
  background-color: rgba(226, 232, 240, 0.85);
}
:root[data-cadence-color="slate"] .cadence-word-active {
  background-color: #1e293b;
  color: #ffffff;
}

/* Highlight Mode Overrides */
:root[data-cadence-mode="sentence"] .cadence-word-active {
  background-color: transparent !important;
  color: inherit !important;
}

:root[data-cadence-mode="word"] .cadence-sentence-active {
  background-color: transparent !important;
}

:root[data-cadence-mode="off"] .cadence-sentence-active,
:root[data-cadence-mode="off"] .cadence-word-active {
  background-color: transparent !important;
  color: inherit !important;
}

@media (prefers-reduced-motion: reduce) {
  .cadence-sentence,
  .cadence-word {
    transition: none;
  }
}
`,
  },
  {
    path: 'popup.html',
    label: 'popup.html',
    language: 'html',
    summary: 'Chrome toolbar extension popup UI with transport controls, language filter, voice selector & preview, speed controls, and highlight preferences.',
    content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Cadence Reader</title>
    <link rel="stylesheet" href="popup.css" />
  </head>
  <body>
    <div class="popup">
      <header class="header">
        <span class="brand">Cadence</span>
        <span id="progress-label" class="meta">Ready</span>
      </header>

      <div class="progress-track">
        <div id="progress-fill" class="progress-fill"></div>
      </div>

      <section class="transport">
        <button id="prev-btn" class="icon-btn" title="Previous sentence" aria-label="Previous sentence">&#9664;</button>
        <button id="play-btn" class="primary-btn">Read Page</button>
        <button id="next-btn" class="icon-btn" title="Next sentence" aria-label="Next sentence">&#9654;</button>
        <button id="stop-btn" class="icon-btn" title="Stop" aria-label="Stop reading">&#9632;</button>
      </section>

      <section class="control-group">
        <label class="label" for="voice-select">Voice Selection</label>
        <select id="lang-filter" class="select select-subtle" aria-label="Filter voices by language">
          <option value="all">All Languages</option>
        </select>
        <div class="row-inline">
          <select id="voice-select" class="select"></select>
          <button id="test-voice-btn" class="secondary-btn" title="Test selected voice">Test</button>
        </div>
      </section>

      <section class="control-group">
        <div class="label-row">
          <label class="label" for="rate-slider">Reading Speed</label>
          <span id="rate-value" class="mono">1.0x</span>
        </div>
        <div class="row-inline">
          <button id="rate-down-btn" class="step-btn" title="Slower (-0.1x)" aria-label="Decrease speed">&minus;</button>
          <input id="rate-slider" type="range" min="0.5" max="2.5" step="0.05" value="1.0" />
          <button id="rate-up-btn" class="step-btn" title="Faster (+0.1x)" aria-label="Increase speed">+</button>
        </div>
        <div class="presets">
          <button class="preset-btn" data-rate="0.75">0.75x</button>
          <button class="preset-btn" data-rate="1.0">1.0x</button>
          <button class="preset-btn" data-rate="1.25">1.25x</button>
          <button class="preset-btn" data-rate="1.5">1.5x</button>
          <button class="preset-btn" data-rate="1.75">1.75x</button>
          <button class="preset-btn" data-rate="2.0">2.0x</button>
        </div>
      </section>

      <section class="control-group">
        <div class="label-row">
          <label class="label" for="highlight-mode">Highlight Tracking</label>
        </div>
        <select id="highlight-mode" class="select">
          <option value="both">Word + Sentence</option>
          <option value="sentence">Sentence Only</option>
          <option value="word">Word Only</option>
          <option value="off">Off</option>
        </select>

        <div class="swatches" role="radiogroup" aria-label="Highlight color">
          <button class="swatch" data-color="amber" title="Warm Amber">Amber</button>
          <button class="swatch" data-color="cobalt" title="Clear Cobalt">Cobalt</button>
          <button class="swatch" data-color="sage" title="Soft Sage">Sage</button>
          <button class="swatch" data-color="slate" title="Paper Slate">Slate</button>
        </div>
      </section>

      <label class="toggle-row">
        <span>Auto-scroll to active text</span>
        <input id="autoscroll-toggle" type="checkbox" checked />
      </label>

      <p id="error-banner" class="error hidden"></p>
    </div>
    <script src="popup.js"></script>
  </body>
</html>
`,
  },
  {
    path: 'popup.css',
    label: 'popup.css',
    language: 'css',
    summary: 'Clean, accessible styling for the 356px Chrome Extension popup window.',
    content: `* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  width: 356px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: #ffffff;
  color: #0f172a;
  font-size: 13px;
}

.popup {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.brand {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.meta {
  font-size: 12px;
  color: #64748b;
  font-variant-numeric: tabular-nums;
}

.progress-track {
  height: 4px;
  background: #e2e8f0;
  border-radius: 99px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  width: 0%;
  background: #2563eb;
  transition: width 180ms ease;
}

.transport, .row-inline {
  display: flex;
  align-items: center;
  gap: 8px;
}

.primary-btn {
  flex: 1;
  background: #2563eb;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.primary-btn:hover { background: #1d4ed8; }

.icon-btn, .step-btn, .secondary-btn {
  background: #f8fafc;
  color: #0f172a;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
}

.icon-btn { width: 36px; height: 36px; }
.step-btn { width: 30px; height: 30px; flex-shrink: 0; }
.secondary-btn { height: 34px; padding: 0 12px; flex-shrink: 0; }

.icon-btn:hover, .step-btn:hover, .secondary-btn:hover { background: #f1f5f9; }

.control-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.label {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  font-weight: 600;
  color: #2563eb;
  font-variant-numeric: tabular-nums;
}

.select {
  width: 100%;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #ffffff;
  color: #0f172a;
  font-size: 13px;
}

.select-subtle {
  background: #f8fafc;
  font-size: 12px;
  padding: 6px 10px;
}

input[type="range"] {
  flex: 1;
  accent-color: #2563eb;
}

.presets, .swatches {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 4px;
}

.swatches {
  grid-template-columns: repeat(4, 1fr);
  margin-top: 4px;
}

.preset-btn, .swatch {
  padding: 5px 2px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  color: #334155;
  cursor: pointer;
}

.preset-btn.active, .swatch.active {
  background: #0f172a;
  color: #ffffff;
  border-color: #0f172a;
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 8px;
  border-top: 1px solid #e2e8f0;
  font-size: 12px;
  color: #334155;
  cursor: pointer;
}

.error {
  font-size: 12px;
  color: #b91c1c;
  background: #fef2f2;
  padding: 8px 10px;
  border-radius: 6px;
}

.hidden { display: none; }
`,
  },
  {
    path: 'popup.js',
    label: 'popup.js',
    language: 'javascript',
    summary: 'Connects popup UI to chrome.storage.sync with language filtering, voice sample testing, speed steppers, and live tab playback sync.',
    content: `const DEFAULT_SETTINGS = {
  voiceURI: '',
  rate: 1.0,
  pitch: 1.0,
  highlightMode: 'both',
  highlightColor: 'amber',
  autoScroll: true,
};

let settings = { ...DEFAULT_SETTINGS };
let playbackStatus = 'idle';
let allSortedVoices = [];

const playBtn = document.getElementById('play-btn');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const stopBtn = document.getElementById('stop-btn');
const langFilter = document.getElementById('lang-filter');
const voiceSelect = document.getElementById('voice-select');
const testVoiceBtn = document.getElementById('test-voice-btn');
const rateSlider = document.getElementById('rate-slider');
const rateDownBtn = document.getElementById('rate-down-btn');
const rateUpBtn = document.getElementById('rate-up-btn');
const rateValue = document.getElementById('rate-value');
const highlightMode = document.getElementById('highlight-mode');
const autoscrollToggle = document.getElementById('autoscroll-toggle');
const progressLabel = document.getElementById('progress-label');
const progressFill = document.getElementById('progress-fill');
const errorBanner = document.getElementById('error-banner');
const presetBtns = Array.from(document.querySelectorAll('.preset-btn'));
const swatchBtns = Array.from(document.querySelectorAll('.swatch'));

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendToTab(message) {
  const tab = await getActiveTab();
  if (!tab?.id || !tab.url || !/^https?:/.test(tab.url)) {
    showError('Open a standard webpage (http or https) to read aloud.');
    return null;
  }
  hideError();
  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch {
    await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['content.css'] });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    return await chrome.tabs.sendMessage(tab.id, message);
  }
}

function showError(msg) {
  errorBanner.textContent = msg;
  errorBanner.classList.remove('hidden');
}

function hideError() {
  errorBanner.classList.add('hidden');
}

function renderState(state) {
  if (!state) return;
  playbackStatus = state.status || 'idle';
  if (playbackStatus !== 'idle' && state.settings && typeof state.settings.rate === 'number') {
    settings = { ...settings, rate: state.settings.rate };
    syncUIWithSettings();
  }
  playBtn.textContent =
    playbackStatus === 'playing'
      ? 'Pause'
      : playbackStatus === 'paused'
      ? 'Resume'
      : 'Read Page';

  if (state.totalSentences > 0 && state.activeSentenceIdx >= 0) {
    const pct = Math.round(((state.activeSentenceIdx + 1) / state.totalSentences) * 100);
    progressLabel.textContent = \`\${state.activeSentenceIdx + 1} / \${state.totalSentences}\`;
    progressFill.style.width = \`\${pct}%\`;
  } else {
    progressLabel.textContent = playbackStatus === 'playing' ? 'Reading' : 'Ready';
    progressFill.style.width = '0%';
  }
}

function syncUIWithSettings() {
  rateSlider.value = String(settings.rate);
  rateValue.textContent = \`\${settings.rate.toFixed(2).replace(/0$/, '')}x\`;
  highlightMode.value = settings.highlightMode;
  autoscrollToggle.checked = Boolean(settings.autoScroll);

  presetBtns.forEach((btn) => {
    const val = parseFloat(btn.dataset.rate);
    btn.classList.toggle('active', Math.abs(val - settings.rate) < 0.03);
  });

  swatchBtns.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.color === settings.highlightColor);
  });

  if (settings.voiceURI && voiceSelect.options.length) {
    voiceSelect.value = settings.voiceURI;
  }
}

let pushTimer = null;

function saveAndPushSettings(patch, debounceMs = 0) {
  const nextRate =
    patch.rate !== undefined
      ? Math.round(Math.min(2.5, Math.max(0.5, patch.rate)) * 100) / 100
      : settings.rate;
  settings = { ...settings, ...patch, rate: nextRate };
  syncUIWithSettings();
  chrome.storage.sync.set(settings);
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  if (debounceMs > 0) {
    pushTimer = setTimeout(() => {
      pushTimer = null;
      sendToTab({ type: 'CADENCE_UPDATE_SETTINGS', settings });
    }, debounceMs);
  } else {
    sendToTab({ type: 'CADENCE_UPDATE_SETTINGS', settings });
  }
}

function renderVoiceOptions() {
  const selectedLang = langFilter.value;
  const visible =
    selectedLang === 'all'
      ? allSortedVoices
      : allSortedVoices.filter((v) => v.lang.toLowerCase().startsWith(selectedLang));

  voiceSelect.innerHTML = '';
  visible.forEach((voice) => {
    const opt = document.createElement('option');
    opt.value = voice.voiceURI;
    opt.textContent = \`\${voice.name} (\${voice.lang})\`;
    voiceSelect.appendChild(opt);
  });

  if (!visible.some((v) => v.voiceURI === settings.voiceURI) && visible[0]) {
    saveAndPushSettings({ voiceURI: visible[0].voiceURI });
  } else if (settings.voiceURI) {
    voiceSelect.value = settings.voiceURI;
  }
}

function populateVoices() {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return;
  const naturalPriority = (v) =>
    /natural|neural|google|enhanced|premium|siri/i.test(v.name) ? 1 : 0;

  allSortedVoices = [...voices].sort(
    (a, b) => naturalPriority(b) - naturalPriority(a) || a.name.localeCompare(b.name)
  );

  const langs = Array.from(new Set(allSortedVoices.map((v) => v.lang.split('-')[0].toLowerCase()))).sort();
  langFilter.innerHTML = \`<option value="all">All Languages (\${allSortedVoices.length})</option>\`;
  langs.forEach((code) => {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = code.toUpperCase();
    langFilter.appendChild(opt);
  });

  if (!settings.voiceURI && allSortedVoices[0]) {
    settings.voiceURI = allSortedVoices[0].voiceURI;
    chrome.storage.sync.set(settings);
  }
  renderVoiceOptions();
}

playBtn.addEventListener('click', async () => {
  const type = playbackStatus === 'playing' ? 'CADENCE_PAUSE' : 'CADENCE_PLAY';
  const state = await sendToTab({ type });
  renderState(state);
});

prevBtn.addEventListener('click', async () => {
  const state = await sendToTab({ type: 'CADENCE_PREV' });
  renderState(state);
});

nextBtn.addEventListener('click', async () => {
  const state = await sendToTab({ type: 'CADENCE_NEXT' });
  renderState(state);
});

stopBtn.addEventListener('click', async () => {
  const state = await sendToTab({ type: 'CADENCE_STOP' });
  renderState(state);
});

langFilter.addEventListener('change', renderVoiceOptions);

voiceSelect.addEventListener('change', () => {
  saveAndPushSettings({ voiceURI: voiceSelect.value });
});

testVoiceBtn.addEventListener('click', () => {
  window.speechSynthesis.cancel();
  const sample = new SpeechSynthesisUtterance(
    'Cadence reads your webpages aloud at your chosen voice and speed.'
  );
  sample.rate = settings.rate;
  sample.pitch = settings.pitch;
  const voice = allSortedVoices.find((v) => v.voiceURI === settings.voiceURI);
  if (voice) {
    sample.voice = voice;
    sample.lang = voice.lang;
  }
  window.speechSynthesis.speak(sample);
});

rateSlider.addEventListener('input', () => {
  saveAndPushSettings({ rate: parseFloat(rateSlider.value) }, 140);
});

rateDownBtn.addEventListener('click', () => {
  saveAndPushSettings({ rate: settings.rate - 0.1 });
});

rateUpBtn.addEventListener('click', () => {
  saveAndPushSettings({ rate: settings.rate + 0.1 });
});

presetBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    saveAndPushSettings({ rate: parseFloat(btn.dataset.rate) });
  });
});

highlightMode.addEventListener('change', () => {
  saveAndPushSettings({ highlightMode: highlightMode.value });
});

swatchBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    saveAndPushSettings({ highlightColor: btn.dataset.color });
  });
});

autoscrollToggle.addEventListener('change', () => {
  saveAndPushSettings({ autoScroll: autoscrollToggle.checked });
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'CADENCE_STATE_UPDATE') {
    renderState(msg.state);
  }
});

chrome.storage.sync.get(DEFAULT_SETTINGS, async (stored) => {
  settings = { ...DEFAULT_SETTINGS, ...stored };
  populateVoices();
  window.speechSynthesis.addEventListener('voiceschanged', populateVoices);
  syncUIWithSettings();
  const state = await sendToTab({ type: 'CADENCE_GET_STATE' });
  renderState(state);
});
`,
  },
  {
    path: 'README.md',
    label: 'README.md',
    language: 'markdown',
    summary: 'Quick-start instructions for loading Cadence unpacked in Google Chrome.',
    content: `# Cadence — Natural Webpage Reader for Chrome

A Manifest V3 Google Chrome extension that reads any webpage aloud with natural-sounding voices, adjustable playback speed (0.5x–2.5x), and synchronized word and sentence highlighting.

## Install in Google Chrome

1. Unzip \`cadence-chrome-extension.zip\` into a folder on your computer.
2. Open Chrome and navigate to \`chrome://extensions\`.
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select the unzipped folder.
5. Click the puzzle icon in Chrome's toolbar and pin **Cadence** for one-click access.

## Features

- **Natural Voice Ranking**: Automatically prioritizes Natural, Neural, Google, and Enhanced system voices.
- **Adjustable Speed**: Fine-grained slider from 0.5x to 2.5x plus quick speed presets.
- **Live Highlight Tracking**: Track both the active sentence and the active word in real time, with 4 readable color themes and auto-scroll.
- **Right-Click Selection**: Highlight any passage on a webpage and choose *Read selection aloud with Cadence*.
- **Keyboard Shortcut**: Press \`Alt + Shift + R\` to start or pause reading on any tab.
`,
  },
];
