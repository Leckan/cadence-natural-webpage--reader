import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PlaybackStatus, ReaderSettings, SentenceBlock } from '../types/reader';
import { findTokenIndexByCharOffset, formatRemainingTime } from '../utils/textTokenizer';

const STORAGE_KEY = 'cadence_reader_settings_v1';

const DEFAULT_SETTINGS: ReaderSettings = {
  voiceURI: '',
  rate: 1.0,
  pitch: 1.0,
  highlightMode: 'both',
  highlightColor: 'amber',
  autoScroll: true,
};

export interface RankedVoice {
  uri: string;
  voice: SpeechSynthesisVoice | null;
  isNatural: boolean;
  isFallbackProfile?: boolean;
  displayName: string;
  langCode: string;
  langLabel: string;
  defaultPitch?: number;
}

const FALLBACK_VOICE_PROFILES: RankedVoice[] = [
  {
    uri: 'cadence-profile-clara',
    voice: null,
    isNatural: true,
    isFallbackProfile: true,
    displayName: 'Clara — Warm Studio',
    langCode: 'en-US',
    langLabel: 'English (US)',
    defaultPitch: 1.02,
  },
  {
    uri: 'cadence-profile-daniel',
    voice: null,
    isNatural: true,
    isFallbackProfile: true,
    displayName: 'Daniel — Crisp Editorial',
    langCode: 'en-GB',
    langLabel: 'English (UK)',
    defaultPitch: 0.96,
  },
  {
    uri: 'cadence-profile-aria',
    voice: null,
    isNatural: true,
    isFallbackProfile: true,
    displayName: 'Aria — Conversational',
    langCode: 'en-US',
    langLabel: 'English (US)',
    defaultPitch: 1.05,
  },
  {
    uri: 'cadence-profile-marcus',
    voice: null,
    isNatural: true,
    isFallbackProfile: true,
    displayName: 'Marcus — Deep Documentary',
    langCode: 'en-US',
    langLabel: 'English (US)',
    defaultPitch: 0.9,
  },
];

const NATURAL_KEYWORDS = [
  'natural',
  'neural',
  'google',
  'enhanced',
  'premium',
  'siri',
  'ava',
  'aria',
  'jenny',
  'guy',
  'samantha',
  'daniel',
  'karen',
  'moira',
  'tessa',
  'serena',
  'oliver',
];

function scoreVoice(v: SpeechSynthesisVoice): number {
  const lower = `${v.name} ${v.voiceURI}`.toLowerCase();
  let score = 0;
  if (lower.includes('natural') || lower.includes('neural')) score += 100;
  if (lower.includes('google us english') || lower.includes('google uk english')) score += 90;
  if (lower.includes('enhanced') || lower.includes('premium')) score += 85;
  if (lower.includes('google')) score += 70;
  if (NATURAL_KEYWORDS.some((kw) => lower.includes(kw))) score += 40;
  if (v.lang.toLowerCase().startsWith('en-us')) score += 25;
  else if (v.lang.toLowerCase().startsWith('en')) score += 18;
  if (v.default) score += 5;
  return score;
}

function cleanVoiceName(name: string): string {
  return name
    .replace(/^Microsoft\s+/i, '')
    .replace(/\s+Online\s+\(Natural\)/i, ' (Natural)')
    .replace(/\s+-\s+English.*$/i, '')
    .trim();
}

function formatLanguageName(langCode: string): string {
  try {
    if (typeof Intl !== 'undefined' && 'DisplayNames' in Intl) {
      const display = new Intl.DisplayNames(['en'], { type: 'language' });
      const label = display.of(langCode);
      if (label) return label;
    }
  } catch {
    // Fallback to raw lang tag
  }
  return langCode;
}

function clampRate(rate: number): number {
  return Math.round(Math.min(2.5, Math.max(0.5, rate)) * 100) / 100;
}

function loadSavedSettings(): ReaderSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<ReaderSettings>;
    return {
      voiceURI: typeof parsed.voiceURI === 'string' ? parsed.voiceURI : '',
      rate: typeof parsed.rate === 'number' ? clampRate(parsed.rate) : 1.0,
      pitch: typeof parsed.pitch === 'number' ? Math.min(1.2, Math.max(0.8, parsed.pitch)) : 1.0,
      highlightMode:
        parsed.highlightMode && ['both', 'sentence', 'word', 'off'].includes(parsed.highlightMode)
          ? parsed.highlightMode
          : 'both',
      highlightColor:
        parsed.highlightColor && ['amber', 'cobalt', 'sage', 'slate'].includes(parsed.highlightColor)
          ? parsed.highlightColor
          : 'amber',
      autoScroll: typeof parsed.autoScroll === 'boolean' ? parsed.autoScroll : true,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function useSpeechReader(sentences: SentenceBlock[]) {
  const [settings, setSettings] = useState<ReaderSettings>(loadSavedSettings);
  const [rawVoices, setRawVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [status, setStatus] = useState<PlaybackStatus>('idle');
  const [activeSentenceIndex, setActiveSentenceIndex] = useState<number>(-1);
  const [activeTokenIndex, setActiveTokenIndex] = useState<number>(-1);
  const [selectionModeText, setSelectionModeText] = useState<string | null>(null);
  const [simulatedMode, setSimulatedMode] = useState<boolean>(false);
  const [isPreviewingVoice, setIsPreviewingVoice] = useState<boolean>(false);

  const isSpeechSupported =
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined';

  // Refs for synchronous access inside utterance callbacks and to prevent Chromium GC on utterances
  const settingsRef = useRef<ReaderSettings>(settings);
  const sentencesRef = useRef<SentenceBlock[]>(sentences);
  const activeSentenceRef = useRef<number>(activeSentenceIndex);
  const selectionModeTextRef = useRef<string | null>(selectionModeText);
  const statusRef = useRef<PlaybackStatus>(status);
  const isPreviewingRef = useRef<boolean>(isPreviewingVoice);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const playbackRunIdRef = useRef<number>(0);
  const boundarySeenRef = useRef<boolean>(false);
  const settingsChangedWhilePausedRef = useRef<boolean>(false);
  const fallbackTimerRef = useRef<number | null>(null);
  const chromeWatchdogRef = useRef<number | null>(null);
  const restartDebounceRef = useRef<number | null>(null);

  useEffect(() => {
    settingsRef.current = settings;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignore storage quota issues
    }
  }, [settings]);

  useEffect(() => {
    sentencesRef.current = sentences;
  }, [sentences]);

  useEffect(() => {
    activeSentenceRef.current = activeSentenceIndex;
  }, [activeSentenceIndex]);

  useEffect(() => {
    selectionModeTextRef.current = selectionModeText;
  }, [selectionModeText]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    isPreviewingRef.current = isPreviewingVoice;
  }, [isPreviewingVoice]);

  const safeCancelSpeech = useCallback(() => {
    if (!isSpeechSupported) return;
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending || window.speechSynthesis.paused) {
      window.speechSynthesis.cancel();
    }
    activeUtteranceRef.current = null;
  }, [isSpeechSupported]);

  const refreshVoices = useCallback(() => {
    if (!isSpeechSupported) return;
    const list = window.speechSynthesis.getVoices();
    if (list.length > 0) {
      setRawVoices(list);
    }
  }, [isSpeechSupported]);

  // Load and rank browser voices
  useEffect(() => {
    if (!isSpeechSupported) return;

    refreshVoices();
    window.speechSynthesis.addEventListener('voiceschanged', refreshVoices);
    const t1 = window.setTimeout(refreshVoices, 250);
    const t2 = window.setTimeout(refreshVoices, 1000);

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', refreshVoices);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [isSpeechSupported, refreshVoices]);

  const hasSystemVoices = rawVoices.length > 0;

  const rankedVoices = useMemo<RankedVoice[]>(() => {
    if (rawVoices.length === 0) {
      return FALLBACK_VOICE_PROFILES;
    }
    const sorted = [...rawVoices].sort((a, b) => scoreVoice(b) - scoreVoice(a));
    return sorted.map((voice) => ({
      uri: voice.voiceURI,
      voice,
      isNatural: scoreVoice(voice) >= 60,
      displayName: cleanVoiceName(voice.name),
      langCode: voice.lang,
      langLabel: formatLanguageName(voice.lang),
    }));
  }, [rawVoices]);

  const availableLanguages = useMemo(() => {
    const map = new Map<string, string>();
    rankedVoices.forEach((rv) => {
      const base = rv.langCode.split('-')[0].toLowerCase();
      if (!map.has(base)) {
        map.set(base, formatLanguageName(base));
      }
    });
    return Array.from(map.entries())
      .map(([code, label]) => ({ code, label }))
      .sort((a, b) => (a.code === 'en' ? -1 : b.code === 'en' ? 1 : a.label.localeCompare(b.label)));
  }, [rankedVoices]);

  // Select best default natural voice once voices arrive
  useEffect(() => {
    if (rankedVoices.length === 0) return;
    const exists = rankedVoices.some((rv) => rv.uri === settings.voiceURI);
    if (!exists) {
      setSettings((prev) => ({ ...prev, voiceURI: rankedVoices[0].uri }));
    }
  }, [rankedVoices, settings.voiceURI]);

  const clearTimers = useCallback(() => {
    if (fallbackTimerRef.current !== null) {
      window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    if (chromeWatchdogRef.current !== null) {
      window.clearInterval(chromeWatchdogRef.current);
      chromeWatchdogRef.current = null;
    }
    if (restartDebounceRef.current !== null) {
      window.clearTimeout(restartDebounceRef.current);
      restartDebounceRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    playbackRunIdRef.current += 1;
    clearTimers();
    settingsChangedWhilePausedRef.current = false;
    safeCancelSpeech();
    setStatus('idle');
    statusRef.current = 'idle';
    setActiveSentenceIndex(-1);
    activeSentenceRef.current = -1;
    setActiveTokenIndex(-1);
    setSelectionModeText(null);
    selectionModeTextRef.current = null;
    setSimulatedMode(false);
    setIsPreviewingVoice(false);
    isPreviewingRef.current = false;
  }, [clearTimers, safeCancelSpeech]);

  // Cancel any active speech cleanly on unmount
  useEffect(() => {
    return () => {
      playbackRunIdRef.current += 1;
      clearTimers();
      safeCancelSpeech();
    };
  }, [clearTimers, safeCancelSpeech]);

  /**
   * Calibrated word-by-word highlight stepper used either when a voice does not emit
   * `onboundary` events (common with remote Chrome Google voices) or in visual preview mode.
   */
  const runCalibratedWordHighlighter = useCallback(
    (
      block: SentenceBlock,
      runId: number,
      onCompleteSimulated?: () => void
    ) => {
      const wordTokenIndices = block.tokens
        .map((t, idx) => (t.isWord ? idx : -1))
        .filter((idx) => idx !== -1);

      if (wordTokenIndices.length === 0) {
        if (onCompleteSimulated) {
          fallbackTimerRef.current = window.setTimeout(onCompleteSimulated, 350);
        }
        return;
      }

      let cursor = 0;

      const step = () => {
        if (playbackRunIdRef.current !== runId) return;
        if (statusRef.current === 'paused') {
          fallbackTimerRef.current = window.setTimeout(step, 120);
          return;
        }
        if (boundarySeenRef.current && !onCompleteSimulated) return;

        const tokenIdx = wordTokenIndices[cursor];
        setActiveTokenIndex(tokenIdx);

        const tokenText = block.tokens[tokenIdx]?.text ?? '';
        const liveRate = settingsRef.current.rate;
        const baseMs = Math.max(150, Math.min(620, (125 + tokenText.length * 36) / liveRate));
        const pauseBonus = /[,;:—]$/.test(tokenText)
          ? 140 / liveRate
          : /[.!?]$/.test(tokenText)
          ? 240 / liveRate
          : 0;

        cursor += 1;
        if (cursor < wordTokenIndices.length) {
          fallbackTimerRef.current = window.setTimeout(step, baseMs + pauseBonus);
        } else if (onCompleteSimulated) {
          fallbackTimerRef.current = window.setTimeout(onCompleteSimulated, baseMs + 220);
        }
      };

      step();
    },
    []
  );

  const speakSentenceAt = useCallback(
    (index: number) => {
      const list = sentencesRef.current;
      if (index < 0 || index >= list.length) {
        stop();
        return;
      }

      const runId = ++playbackRunIdRef.current;
      clearTimers();
      settingsChangedWhilePausedRef.current = false;
      setIsPreviewingVoice(false);
      isPreviewingRef.current = false;
      setSelectionModeText(null);
      selectionModeTextRef.current = null;
      setActiveSentenceIndex(index);
      activeSentenceRef.current = index;
      setStatus('playing');
      statusRef.current = 'playing';

      const block = list[index];
      const firstWordIdx = block.tokens.findIndex((t) => t.isWord);
      setActiveTokenIndex(firstWordIdx);
      boundarySeenRef.current = false;

      const currentSettings = settingsRef.current;

      const availableVoices = isSpeechSupported ? window.speechSynthesis.getVoices() : [];
      if (!isSpeechSupported || availableVoices.length === 0) {
        setSimulatedMode(true);
        runCalibratedWordHighlighter(block, runId, () => {
          if (playbackRunIdRef.current !== runId) return;
          if (index + 1 < sentencesRef.current.length) {
            speakSentenceAt(index + 1);
          } else {
            stop();
          }
        });
        return;
      }

      setSimulatedMode(false);
      safeCancelSpeech();

      const utterance = new SpeechSynthesisUtterance(block.text);
      activeUtteranceRef.current = utterance;
      utterance.rate = currentSettings.rate;
      utterance.pitch = currentSettings.pitch;

      const matchedVoice = availableVoices.find(
        (v) => v.voiceURI === currentSettings.voiceURI
      );
      if (matchedVoice) {
        utterance.voice = matchedVoice;
        utterance.lang = matchedVoice.lang;
      }

      utterance.onstart = () => {
        if (playbackRunIdRef.current !== runId) return;
        fallbackTimerRef.current = window.setTimeout(() => {
          if (playbackRunIdRef.current === runId && !boundarySeenRef.current) {
            runCalibratedWordHighlighter(block, runId);
          }
        }, 420);

        chromeWatchdogRef.current = window.setInterval(() => {
          if (
            playbackRunIdRef.current === runId &&
            window.speechSynthesis.speaking &&
            !window.speechSynthesis.paused
          ) {
            window.speechSynthesis.pause();
            window.speechSynthesis.resume();
          }
        }, 12000);
      };

      utterance.onboundary = (event: SpeechSynthesisEvent) => {
        if (playbackRunIdRef.current !== runId) return;
        if (event.name === 'word' || typeof event.charIndex === 'number') {
          boundarySeenRef.current = true;
          if (fallbackTimerRef.current !== null) {
            window.clearTimeout(fallbackTimerRef.current);
            fallbackTimerRef.current = null;
          }
          const matchedTokenIdx = findTokenIndexByCharOffset(block.tokens, event.charIndex);
          if (matchedTokenIdx !== -1) {
            setActiveTokenIndex(matchedTokenIdx);
          }
        }
      };

      utterance.onend = () => {
        if (playbackRunIdRef.current !== runId) return;
        clearTimers();
        activeUtteranceRef.current = null;
        if (index + 1 < sentencesRef.current.length) {
          speakSentenceAt(index + 1);
        } else {
          setStatus('idle');
          statusRef.current = 'idle';
          setActiveSentenceIndex(-1);
          activeSentenceRef.current = -1;
          setActiveTokenIndex(-1);
        }
      };

      utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
        if (playbackRunIdRef.current !== runId) return;
        if (event.error === 'interrupted' || event.error === 'canceled') return;
        clearTimers();
        activeUtteranceRef.current = null;
        setSimulatedMode(true);
        runCalibratedWordHighlighter(block, runId, () => {
          if (playbackRunIdRef.current !== runId) return;
          if (index + 1 < sentencesRef.current.length) {
            speakSentenceAt(index + 1);
          } else {
            stop();
          }
        });
      };

      window.speechSynthesis.speak(utterance);
    },
    [clearTimers, isSpeechSupported, runCalibratedWordHighlighter, safeCancelSpeech, stop]
  );

  const readSelection = useCallback(
    (selectedText: string) => {
      const cleaned = selectedText.trim();
      if (!cleaned) return;

      const runId = ++playbackRunIdRef.current;
      clearTimers();
      settingsChangedWhilePausedRef.current = false;
      setIsPreviewingVoice(false);
      isPreviewingRef.current = false;
      setActiveSentenceIndex(-1);
      activeSentenceRef.current = -1;
      setActiveTokenIndex(-1);
      setSelectionModeText(cleaned);
      selectionModeTextRef.current = cleaned;
      setStatus('playing');
      statusRef.current = 'playing';

      const currentSettings = settingsRef.current;
      const availableVoices = isSpeechSupported ? window.speechSynthesis.getVoices() : [];

      if (!isSpeechSupported || availableVoices.length === 0) {
        setSimulatedMode(true);
        const words = cleaned.split(/\s+/).length;
        const durationMs = Math.max(1200, (words / (165 * currentSettings.rate)) * 60000);
        fallbackTimerRef.current = window.setTimeout(() => {
          if (playbackRunIdRef.current === runId) {
            stop();
          }
        }, durationMs);
        return;
      }

      setSimulatedMode(false);
      safeCancelSpeech();

      const utterance = new SpeechSynthesisUtterance(cleaned);
      activeUtteranceRef.current = utterance;
      utterance.rate = currentSettings.rate;
      utterance.pitch = currentSettings.pitch;
      const matchedVoice = availableVoices.find((v) => v.voiceURI === currentSettings.voiceURI);
      if (matchedVoice) {
        utterance.voice = matchedVoice;
        utterance.lang = matchedVoice.lang;
      }

      utterance.onend = () => {
        if (playbackRunIdRef.current !== runId) return;
        activeUtteranceRef.current = null;
        setStatus('idle');
        statusRef.current = 'idle';
        setSelectionModeText(null);
        selectionModeTextRef.current = null;
      };
      utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
        if (playbackRunIdRef.current !== runId) return;
        if (event.error === 'interrupted' || event.error === 'canceled') return;
        activeUtteranceRef.current = null;
        setStatus('idle');
        statusRef.current = 'idle';
        setSelectionModeText(null);
        selectionModeTextRef.current = null;
      };

      window.speechSynthesis.speak(utterance);
    },
    [clearTimers, isSpeechSupported, safeCancelSpeech, stop]
  );

  const previewVoice = useCallback(() => {
    refreshVoices();

    // Clicking Test while already previewing cleanly cancels the sample
    if (isPreviewingRef.current) {
      stop();
      return;
    }

    const runId = ++playbackRunIdRef.current;
    clearTimers();
    safeCancelSpeech();
    setStatus('idle');
    statusRef.current = 'idle';
    setActiveSentenceIndex(-1);
    activeSentenceRef.current = -1;
    setActiveTokenIndex(-1);
    setSelectionModeText(null);
    selectionModeTextRef.current = null;

    const currentSettings = settingsRef.current;
    const availableVoices = isSpeechSupported ? window.speechSynthesis.getVoices() : [];

    if (!isSpeechSupported || availableVoices.length === 0) {
      setIsPreviewingVoice(true);
      isPreviewingRef.current = true;
      fallbackTimerRef.current = window.setTimeout(() => {
        if (playbackRunIdRef.current === runId) {
          setIsPreviewingVoice(false);
          isPreviewingRef.current = false;
        }
      }, 1400);
      return;
    }

    const sample = new SpeechSynthesisUtterance(
      'Cadence reads your webpages aloud at your preferred voice and pace.'
    );
    activeUtteranceRef.current = sample;
    sample.rate = currentSettings.rate;
    sample.pitch = currentSettings.pitch;
    const matchedVoice = availableVoices.find((v) => v.voiceURI === currentSettings.voiceURI);
    if (matchedVoice) {
      sample.voice = matchedVoice;
      sample.lang = matchedVoice.lang;
    }
    setIsPreviewingVoice(true);
    isPreviewingRef.current = true;
    sample.onend = () => {
      if (playbackRunIdRef.current === runId) {
        activeUtteranceRef.current = null;
        setIsPreviewingVoice(false);
        isPreviewingRef.current = false;
      }
    };
    sample.onerror = () => {
      if (playbackRunIdRef.current === runId) {
        activeUtteranceRef.current = null;
        setIsPreviewingVoice(false);
        isPreviewingRef.current = false;
      }
    };
    window.speechSynthesis.speak(sample);
  }, [clearTimers, isSpeechSupported, refreshVoices, safeCancelSpeech, stop]);

  const playOrResume = useCallback(() => {
    if (sentencesRef.current.length === 0) return;

    if (statusRef.current === 'paused') {
      if (
        !settingsChangedWhilePausedRef.current &&
        isSpeechSupported &&
        !simulatedMode &&
        window.speechSynthesis.paused
      ) {
        window.speechSynthesis.resume();
        setStatus('playing');
        statusRef.current = 'playing';
      } else if (selectionModeTextRef.current) {
        readSelection(selectionModeTextRef.current);
      } else {
        const resumeIdx = activeSentenceRef.current >= 0 ? activeSentenceRef.current : 0;
        speakSentenceAt(resumeIdx);
      }
      return;
    }

    const startIdx = activeSentenceRef.current >= 0 ? activeSentenceRef.current : 0;
    speakSentenceAt(startIdx);
  }, [isSpeechSupported, readSelection, simulatedMode, speakSentenceAt]);

  const pause = useCallback(() => {
    if (statusRef.current !== 'playing') return;
    if (isSpeechSupported && !simulatedMode && window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
    }
    setStatus('paused');
    statusRef.current = 'paused';
  }, [isSpeechSupported, simulatedMode]);

  const togglePlayPause = useCallback(() => {
    if (statusRef.current === 'playing') {
      pause();
    } else {
      playOrResume();
    }
  }, [pause, playOrResume]);

  const nextSentence = useCallback(() => {
    const nextIdx = activeSentenceRef.current < 0 ? 0 : activeSentenceRef.current + 1;
    if (nextIdx < sentencesRef.current.length) {
      speakSentenceAt(nextIdx);
    }
  }, [speakSentenceAt]);

  const prevSentence = useCallback(() => {
    const prevIdx = Math.max(0, activeSentenceRef.current - 1);
    speakSentenceAt(prevIdx);
  }, [speakSentenceAt]);

  // Update settings; debounces rapid slider drags so SpeechSynthesis never stutters mid-playback
  const updateSettings = useCallback(
    (patch: Partial<ReaderSettings>) => {
      const normalizedPatch: Partial<ReaderSettings> = {
        ...patch,
        ...(patch.rate !== undefined ? { rate: clampRate(patch.rate) } : {}),
      };

      const audioParamChanged =
        (normalizedPatch.rate !== undefined && normalizedPatch.rate !== settingsRef.current.rate) ||
        (normalizedPatch.pitch !== undefined && normalizedPatch.pitch !== settingsRef.current.pitch) ||
        (normalizedPatch.voiceURI !== undefined &&
          normalizedPatch.voiceURI !== settingsRef.current.voiceURI);

      const next = { ...settingsRef.current, ...normalizedPatch };
      settingsRef.current = next;
      setSettings(next);

      if (!audioParamChanged) return;

      if (statusRef.current === 'paused') {
        settingsChangedWhilePausedRef.current = true;
      } else if (statusRef.current === 'playing') {
        if (restartDebounceRef.current !== null) {
          window.clearTimeout(restartDebounceRef.current);
        }
        restartDebounceRef.current = window.setTimeout(() => {
          restartDebounceRef.current = null;
          if (statusRef.current !== 'playing') return;
          if (selectionModeTextRef.current) {
            readSelection(selectionModeTextRef.current);
          } else if (activeSentenceRef.current >= 0) {
            speakSentenceAt(activeSentenceRef.current);
          }
        }, 150);
      }
    },
    [readSelection, speakSentenceAt]
  );

  const nudgeRate = useCallback(
    (delta: number) => {
      updateSettings({ rate: clampRate(settingsRef.current.rate + delta) });
    },
    [updateSettings]
  );

  const totalWords = useMemo(
    () => sentences.reduce((sum, s) => sum + s.wordCount, 0),
    [sentences]
  );

  const remainingWords = useMemo(() => {
    if (activeSentenceIndex < 0) return totalWords;
    return sentences
      .slice(activeSentenceIndex)
      .reduce((sum, s) => sum + s.wordCount, 0);
  }, [sentences, activeSentenceIndex, totalWords]);

  const remainingTimeFormatted = useMemo(
    () => formatRemainingTime(remainingWords, settings.rate),
    [remainingWords, settings.rate]
  );

  const estimatedWpm = useMemo(() => Math.round(165 * settings.rate), [settings.rate]);

  const progressPercent = useMemo(() => {
    if (sentences.length === 0 || activeSentenceIndex < 0) return 0;
    return Math.round(((activeSentenceIndex + 1) / sentences.length) * 100);
  }, [sentences.length, activeSentenceIndex]);

  return {
    settings,
    updateSettings,
    nudgeRate,
    rankedVoices,
    hasSystemVoices,
    availableLanguages,
    refreshVoices,
    previewVoice,
    isPreviewingVoice,
    status,
    activeSentenceIndex,
    activeTokenIndex,
    selectionModeText,
    simulatedMode,
    isSpeechSupported,
    totalSentences: sentences.length,
    totalWords,
    estimatedWpm,
    remainingTimeFormatted,
    progressPercent,
    playOrResume,
    pause,
    togglePlayPause,
    stop,
    nextSentence,
    prevSentence,
    speakSentenceAt,
    readSelection,
  };
}
