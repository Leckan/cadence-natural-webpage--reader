import { useMemo, useState } from 'react';
import {
  Minus,
  Pause,
  Play,
  Plus,
  SkipBack,
  SkipForward,
  Square,
  Volume2,
  X,
} from 'lucide-react';
import { RankedVoice } from '../hooks/useSpeechReader';
import {
  HIGHLIGHT_THEMES,
  HighlightColorId,
  HighlightMode,
  PlaybackStatus,
  ReaderSettings,
} from '../types/reader';
import { CadenceLogo } from './CadenceLogo';

interface ExtensionPopupProps {
  settings: ReaderSettings;
  onUpdateSettings: (patch: Partial<ReaderSettings>) => void;
  onNudgeRate: (delta: number) => void;
  voices: RankedVoice[];
  hasSystemVoices: boolean;
  availableLanguages: { code: string; label: string }[];
  onRefreshVoices: () => void;
  onPreviewVoice: () => void;
  isPreviewingVoice: boolean;
  status: PlaybackStatus;
  activeSentenceIndex: number;
  totalSentences: number;
  estimatedWpm: number;
  remainingTimeFormatted: string;
  progressPercent: number;
  simulatedMode: boolean;
  selectionModeText: string | null;
  onTogglePlayPause: () => void;
  onStop: () => void;
  onPrev: () => void;
  onNext: () => void;
  onClose?: () => void;
}

const SPEED_PRESETS = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

const HIGHLIGHT_MODES: { value: HighlightMode; label: string }[] = [
  { value: 'both', label: 'Word + Sent.' },
  { value: 'sentence', label: 'Sentence' },
  { value: 'word', label: 'Word' },
  { value: 'off', label: 'Off' },
];

const COLOR_OPTIONS: HighlightColorId[] = ['amber', 'cobalt', 'sage', 'slate'];

export function ExtensionPopup({
  settings,
  onUpdateSettings,
  onNudgeRate,
  voices,
  hasSystemVoices,
  availableLanguages,
  onRefreshVoices,
  onPreviewVoice,
  isPreviewingVoice,
  status,
  activeSentenceIndex,
  totalSentences,
  estimatedWpm,
  remainingTimeFormatted,
  progressPercent,
  simulatedMode,
  selectionModeText,
  onTogglePlayPause,
  onStop,
  onPrev,
  onNext,
  onClose,
}: ExtensionPopupProps) {
  const [langFilter, setLangFilter] = useState<string>('all');

  const filteredVoices = useMemo(() => {
    if (langFilter === 'all') return voices;
    return voices.filter((v) => v.langCode.toLowerCase().startsWith(langFilter));
  }, [voices, langFilter]);

  const naturalVoices = filteredVoices.filter((v) => v.isNatural);
  const standardVoices = filteredVoices.filter((v) => !v.isNatural);

  const handleLanguageChange = (nextLang: string) => {
    setLangFilter(nextLang);
    if (nextLang !== 'all') {
      const matches = voices.filter((v) => v.langCode.toLowerCase().startsWith(nextLang));
      if (matches.length > 0 && !matches.some((m) => m.uri === settings.voiceURI)) {
        onUpdateSettings({ voiceURI: matches[0].uri });
      }
    }
  };

  const statusText = selectionModeText
    ? 'Reading selection'
    : activeSentenceIndex >= 0
    ? `${activeSentenceIndex + 1} / ${totalSentences} · ${remainingTimeFormatted} left`
    : `${totalSentences} sentences · ${remainingTimeFormatted}`;

  return (
    <aside
      aria-label="Cadence Chrome Extension Popup"
      className="w-full lg:w-[356px] shrink-0 bg-white border border-slate-200 rounded-xl shadow-[0_12px_32px_rgba(15,23,42,0.08)] overflow-hidden"
    >
      {/* Popup Top Bar */}
      <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <CadenceLogo size={22} className="shrink-0" />
          <span className="text-sm font-semibold tracking-tight text-slate-900 whitespace-nowrap">
            Cadence
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-mono tabular-nums whitespace-nowrap">
            {statusText}
          </span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close extension popup"
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Progress Track */}
      <div className="h-1 bg-slate-100 w-full overflow-hidden">
        <div
          className="h-full bg-blue-600 transition-all duration-150"
          style={{ width: `${selectionModeText ? 100 : progressPercent}%` }}
        />
      </div>

      <div className="p-4 space-y-5">
        {/* Transport Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrev}
            disabled={activeSentenceIndex <= 0 && status === 'idle'}
            title="Previous sentence (Left Arrow)"
            aria-label="Previous sentence"
            className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onTogglePlayPause}
            disabled={totalSentences === 0}
            className="flex-1 h-10 px-4 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors whitespace-nowrap disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            {status === 'playing' ? (
              <>
                <Pause className="w-4 h-4 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>{status === 'paused' ? 'Resume' : 'Read Page'}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onNext}
            disabled={activeSentenceIndex >= totalSentences - 1 && status !== 'idle'}
            title="Next sentence (Right Arrow)"
            aria-label="Next sentence"
            className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onStop}
            disabled={status === 'idle'}
            title="Stop reading"
            aria-label="Stop reading"
            className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </button>
        </div>

        {/* Voice Selection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="cadence-voice-select"
              className="text-xs font-medium text-slate-700"
            >
              Voice Selection
            </label>
            <span className="text-xs text-slate-500 tabular-nums">
              {hasSystemVoices ? `${filteredVoices.length} available` : 'Preview profiles'}
            </span>
          </div>

          {availableLanguages.length > 1 && (
            <select
              aria-label="Filter voices by language"
              value={langFilter}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="w-full h-9 px-3 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
            >
              <option value="all">All Languages ({voices.length})</option>
              {availableLanguages.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-2">
            <select
              id="cadence-voice-select"
              value={settings.voiceURI}
              onFocus={onRefreshVoices}
              onChange={(e) => {
                const selected = voices.find((v) => v.uri === e.target.value);
                onUpdateSettings({
                  voiceURI: e.target.value,
                  ...(selected?.defaultPitch ? { pitch: selected.defaultPitch } : {}),
                });
              }}
              className="flex-1 min-w-0 h-10 pl-3 pr-8 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 truncate"
            >
              {naturalVoices.length > 0 && (
                <optgroup label={hasSystemVoices ? 'Recommended Natural Voices' : 'Cadence Voice Profiles'}>
                  {naturalVoices.map((rv) => (
                    <option key={rv.uri} value={rv.uri}>
                      {rv.displayName} ({rv.langCode})
                    </option>
                  ))}
                </optgroup>
              )}
              {standardVoices.length > 0 && (
                <optgroup label="System Voices">
                  {standardVoices.map((rv) => (
                    <option key={rv.uri} value={rv.uri}>
                      {rv.displayName} ({rv.langCode})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>

            <button
              type="button"
              onClick={onPreviewVoice}
              title="Listen to a short voice sample at the current speed"
              className={`h-10 px-3 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                isPreviewingVoice
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>{isPreviewingVoice ? 'Playing' : 'Test'}</span>
            </button>
          </div>

          {!hasSystemVoices && (
            <p className="text-[11px] text-slate-500 leading-relaxed">
              No OS voices detected in this sandbox session. Selecting a profile adjusts highlight pacing; Google Chrome desktop loads full Google &amp; OS natural voices.
            </p>
          )}

          {simulatedMode && hasSystemVoices && (
            <p className="text-xs text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded-md">
              Audio output was unavailable in this session—showing calibrated highlight preview.
            </p>
          )}
        </div>

        {/* Reading Speed */}
        <div className="space-y-2.5 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="cadence-rate-slider"
              className="text-xs font-medium text-slate-700"
            >
              Reading Speed
            </label>
            <div className="flex items-center gap-2 text-xs font-mono tabular-nums">
              <span className="text-slate-400">{estimatedWpm} wpm</span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span className="font-semibold text-blue-600">
                {settings.rate.toFixed(2).replace(/0$/, '')}x
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNudgeRate(-0.1)}
              disabled={settings.rate <= 0.5}
              aria-label="Decrease speed by 0.1x"
              title="Slower (-0.1x)"
              className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>

            <input
              id="cadence-rate-slider"
              type="range"
              min={0.5}
              max={2.5}
              step={0.05}
              value={settings.rate}
              onChange={(e) => onUpdateSettings({ rate: parseFloat(e.target.value) })}
              className="flex-1 cadence-slider"
            />

            <button
              type="button"
              onClick={() => onNudgeRate(0.1)}
              disabled={settings.rate >= 2.5}
              aria-label="Increase speed by 0.1x"
              title="Faster (+0.1x)"
              className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-6 gap-1">
            {SPEED_PRESETS.map((preset) => {
              const isActive = Math.abs(settings.rate - preset) < 0.03;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onUpdateSettings({ rate: preset })}
                  className={`h-8 rounded-md text-[11px] font-mono tabular-nums transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                    isActive
                      ? 'bg-slate-900 text-white font-medium'
                      : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {preset}x
                </button>
              );
            })}
          </div>

          {/* Pitch Fine-Tune */}
          <div className="pt-1">
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="cadence-pitch-slider"
                className="text-xs font-medium text-slate-600"
              >
                Voice Pitch
              </label>
              <span className="text-xs font-mono tabular-nums text-slate-500">
                {settings.pitch.toFixed(2)}
              </span>
            </div>
            <input
              id="cadence-pitch-slider"
              type="range"
              min={0.8}
              max={1.2}
              step={0.05}
              value={settings.pitch}
              onChange={(e) => onUpdateSettings({ pitch: parseFloat(e.target.value) })}
              className="w-full cadence-slider"
            />
          </div>
        </div>

        {/* Highlight Tracking Controls */}
        <div className="space-y-3 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-700">
              Highlight Tracking
            </span>
          </div>

          <div
            role="radiogroup"
            aria-label="Highlight tracking mode"
            className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-lg"
          >
            {HIGHLIGHT_MODES.map((mode) => {
              const isSelected = settings.highlightMode === mode.value;
              return (
                <button
                  key={mode.value}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => onUpdateSettings({ highlightMode: mode.value })}
                  className={`py-1.5 px-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                    isSelected
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>

          {/* Color Swatches with Labels (No hue-only state) */}
          <div
            role="radiogroup"
            aria-label="Highlight color"
            className="grid grid-cols-4 gap-1.5"
          >
            {COLOR_OPTIONS.map((colorId) => {
              const theme = HIGHLIGHT_THEMES[colorId];
              const isSelected = settings.highlightColor === colorId;
              return (
                <button
                  key={colorId}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  disabled={settings.highlightMode === 'off'}
                  onClick={() => onUpdateSettings({ highlightColor: colorId })}
                  className={`h-8 px-2 rounded-md border text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                    isSelected
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0 border border-black/10"
                    style={{ backgroundColor: theme.swatchHex }}
                    aria-hidden="true"
                  />
                  <span className="capitalize">{colorId}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Auto-Scroll Toggle */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-slate-800">
              Auto-scroll with active text
            </p>
            <p className="text-[11px] text-slate-500">
              Keep spoken sentence centered in view
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.autoScroll}
            onClick={() => onUpdateSettings({ autoScroll: !settings.autoScroll })}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
              settings.autoScroll ? 'bg-blue-600' : 'bg-slate-200'
            }`}
          >
            <span className="sr-only">Toggle auto-scroll</span>
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white shadow-xs transition-transform ${
                settings.autoScroll ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>
    </aside>
  );
}
