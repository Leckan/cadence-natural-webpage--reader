import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Edit3,
  Eye,
  Lock,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  SkipBack,
  SkipForward,
  Square,
  Volume2,
} from 'lucide-react';
import { DEFAULT_CUSTOM_TEXT, SAMPLE_ARTICLES } from '../data/sampleArticles';
import { useSpeechReader } from '../hooks/useSpeechReader';
import { ArticleParagraph, HIGHLIGHT_THEMES } from '../types/reader';
import { buildSentenceBlocks } from '../utils/textTokenizer';
import { CadenceLogo } from './CadenceLogo';
import { ExtensionPopup } from './ExtensionPopup';

type TabId = 'architecture' | 'ocean' | 'custom';

export function BrowserSimulator() {
  const [activeTab, setActiveTab] = useState<TabId>('architecture');
  const [customText, setCustomText] = useState<string>(DEFAULT_CUSTOM_TEXT);
  const [isEditingCustom, setIsEditingCustom] = useState<boolean>(false);
  const [popupOpen, setPopupOpen] = useState<boolean>(true);
  const [selectedPageText, setSelectedPageText] = useState<string>('');
  const [imageErrorMap, setImageErrorMap] = useState<Record<string, boolean>>({});

  const articleContainerRef = useRef<HTMLDivElement | null>(null);
  const sentenceElMapRef = useRef<Map<number, HTMLSpanElement>>(new Map());

  const currentArticle = useMemo(
    () => SAMPLE_ARTICLES.find((a) => a.id === activeTab) ?? null,
    [activeTab]
  );

  const paragraphs = useMemo<ArticleParagraph[]>(() => {
    if (activeTab === 'custom') {
      return customText
        .split(/\n{2,}/)
        .map((block) => block.trim())
        .filter(Boolean)
        .map((text) => ({ type: 'body' as const, text }));
    }
    return currentArticle ? currentArticle.paragraphs : [];
  }, [activeTab, currentArticle, customText]);

  const sentenceBlocks = useMemo(() => buildSentenceBlocks(paragraphs), [paragraphs]);

  // Group sentence blocks by paragraphIndex for clean semantic rendering
  const blocksByParagraph = useMemo(() => {
    const map = new Map<number, typeof sentenceBlocks>();
    sentenceBlocks.forEach((block) => {
      const existing = map.get(block.paragraphIndex) ?? [];
      existing.push(block);
      map.set(block.paragraphIndex, existing);
    });
    return map;
  }, [sentenceBlocks]);

  const reader = useSpeechReader(sentenceBlocks);

  // Stop speech cleanly when switching browser tabs
  const handleSwitchTab = (tab: TabId) => {
    if (tab === activeTab) return;
    reader.stop();
    setSelectedPageText('');
    setActiveTab(tab);
    if (tab !== 'custom') {
      setIsEditingCustom(false);
    }
  };

  // Auto-scroll active sentence into center of the reading viewport
  useEffect(() => {
    if (!reader.settings.autoScroll || reader.activeSentenceIndex < 0) return;
    const el = sentenceElMapRef.current.get(reader.activeSentenceIndex);
    if (!el) return;
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({
      behavior: prefersReduced ? 'auto' : 'smooth',
      block: 'center',
    });
  }, [reader.activeSentenceIndex, reader.settings.autoScroll]);

  // Keyboard shortcuts while on Live Preview (ignored when typing inside textarea/inputs)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'TEXTAREA' ||
          target.tagName === 'INPUT' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        reader.togglePlayPause();
      } else if (e.code === 'ArrowRight' && reader.status !== 'idle') {
        e.preventDefault();
        reader.nextSentence();
      } else if (e.code === 'ArrowLeft' && reader.status !== 'idle') {
        e.preventDefault();
        reader.prevSentence();
      } else if (e.code === 'ArrowUp' && reader.status !== 'idle') {
        e.preventDefault();
        reader.nudgeRate(0.1);
      } else if (e.code === 'ArrowDown' && reader.status !== 'idle') {
        e.preventDefault();
        reader.nudgeRate(-0.1);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [reader]);

  // Capture text selection inside the webpage to offer "Read selection"
  const handleArticleMouseUp = () => {
    const selection = window.getSelection();
    const text = selection ? selection.toString().trim() : '';
    if (text.length >= 4 && articleContainerRef.current?.contains(selection?.anchorNode ?? null)) {
      setSelectedPageText(text);
    } else {
      setSelectedPageText('');
    }
  };

  const activeTheme = HIGHLIGHT_THEMES[reader.settings.highlightColor];
  const currentUrl =
    activeTab === 'custom'
      ? 'https://local.document/custom-reader-test'
      : currentArticle?.url ?? '';

  return (
    <div className="w-full max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Realistic Chrome Browser Window Frame */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
        {/* Chrome Tab Strip */}
        <div className="bg-slate-100 border-b border-slate-200 px-3 pt-2.5 flex items-end justify-between gap-4 overflow-x-auto">
          <div className="flex items-end gap-1 min-w-0">
            {/* Window traffic controls (subtle neutral dots) */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 pb-2.5 mr-1 shrink-0" aria-hidden="true">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
            </div>

            {SAMPLE_ARTICLES.map((article) => {
              const isSelected = activeTab === article.id;
              return (
                <button
                  key={article.id}
                  type="button"
                  onClick={() => handleSwitchTab(article.id as TabId)}
                  className={`px-3.5 py-2 text-xs font-medium rounded-t-lg transition-colors whitespace-nowrap shrink-0 max-w-[210px] truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                    isSelected
                      ? 'bg-white text-slate-900 border-t border-x border-slate-200 -mb-px'
                      : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                  }`}
                >
                  {article.tabTitle}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => handleSwitchTab('custom')}
              className={`px-3.5 py-2 text-xs font-medium rounded-t-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                activeTab === 'custom'
                  ? 'bg-white text-slate-900 border-t border-x border-slate-200 -mb-px'
                  : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
              }`}
            >
              Custom Webpage Text
            </button>
          </div>
        </div>

        {/* Chrome Omnibox & Pinned Extension Toolbar */}
        <div className="bg-white border-b border-slate-200 px-3 sm:px-4 py-2 flex items-center gap-3">
          {/* Address Bar */}
          <div className="flex-1 min-w-0 h-9 bg-slate-100 rounded-lg px-3 flex items-center gap-2 text-xs text-slate-600">
            <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
            <span className="truncate font-mono text-[12px] text-slate-600">
              {currentUrl}
            </span>
          </div>

          {/* Selection Action Trigger (when user highlights text on the page) */}
          {selectedPageText && (
            <button
              type="button"
              onClick={() => {
                reader.readSelection(selectedPageText);
                setSelectedPageText('');
              }}
              className="h-9 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Read selection</span>
            </button>
          )}

          {/* Pinned Cadence Extension Button */}
          <div className="pl-2 border-l border-slate-200 flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setPopupOpen((prev) => !prev)}
              aria-expanded={popupOpen}
              aria-label="Toggle Cadence extension popup"
              title="Cadence Extension Popup"
              className={`h-9 px-2.5 rounded-lg inline-flex items-center gap-2 text-xs font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                popupOpen
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <CadenceLogo size={18} />
              <span className="hidden sm:inline">
                {popupOpen ? 'Hide Popup' : 'Open Extension'}
              </span>
            </button>
          </div>
        </div>

        {/* Browser Viewport Area: Webpage Canvas + Docked Extension Popup */}
        <div className="relative bg-white flex flex-col lg:flex-row items-start">
          {/* Simulated Webpage Scrollable Viewport */}
          <div
            ref={articleContainerRef}
            onMouseUp={handleArticleMouseUp}
            className="flex-1 min-w-0 w-full h-[calc(100vh-225px)] min-h-[560px] overflow-y-auto px-6 sm:px-10 lg:px-14 py-8 lg:py-10"
          >
            {activeTab === 'custom' ? (
              <div className="max-w-[68ch] mx-auto space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
                  <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                      Custom Webpage Text
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                      Paste any article or document below, then click Read Page or click any sentence to listen.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        reader.stop();
                        setIsEditingCustom((v) => !v);
                      }}
                      className="h-9 px-3.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      {isEditingCustom ? (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          <span>Reading View</span>
                        </>
                      ) : (
                        <>
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit Text</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        reader.stop();
                        setCustomText(DEFAULT_CUSTOM_TEXT);
                      }}
                      title="Reset sample text"
                      className="h-9 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset</span>
                    </button>
                  </div>
                </div>

                {isEditingCustom ? (
                  <div className="space-y-3">
                    <textarea
                      value={customText}
                      onChange={(e) => setCustomText(e.target.value)}
                      rows={12}
                      placeholder="Paste webpage text here..."
                      className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50/50 text-base leading-relaxed font-serif text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setIsEditingCustom(false)}
                        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
                      >
                        Done Editing
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5 font-serif text-[18px] leading-[1.78] text-slate-800">
                    {paragraphs.length === 0 ? (
                      <div className="py-12 text-center space-y-3 border border-dashed border-slate-200 rounded-xl">
                        <p className="text-sm font-sans text-slate-500">
                          No text to read yet. Add or paste content to test the reader.
                        </p>
                        <button
                          type="button"
                          onClick={() => setIsEditingCustom(true)}
                          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-sans font-medium"
                        >
                          Add Text
                        </button>
                      </div>
                    ) : (
                      paragraphs.map((_, pIdx) => {
                        const pSentences = blocksByParagraph.get(pIdx) ?? [];
                        return (
                          <p key={pIdx}>
                            {pSentences.map((block) => renderSentenceSpan(block))}
                          </p>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            ) : currentArticle ? (
              <article className="max-w-[68ch] mx-auto">
                {/* Clean unboxed editorial metadata (Zero-Pill Discipline) */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-3">
                  <span className="font-medium text-slate-700">
                    {currentArticle.publication}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{currentArticle.category}</span>
                  <span aria-hidden="true">·</span>
                  <span>{currentArticle.date}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {reader.totalWords} words
                  </span>
                </div>

                <h1 className="font-serif text-3xl sm:text-[34px] font-semibold tracking-tight leading-[1.2] text-slate-950 [text-wrap:balance]">
                  {currentArticle.title}
                </h1>

                <p className="mt-3 text-base sm:text-[17px] leading-relaxed text-slate-600">
                  {currentArticle.subtitle}
                </p>

                <div className="mt-4 pb-6 border-b border-slate-200 flex items-center justify-between gap-4 text-xs text-slate-500">
                  <span>By {currentArticle.author}</span>
                  <span>Click any sentence to start reading from that point</span>
                </div>

                {/* Editorial Lead Photograph with Zero-Broken-Image Fallback */}
                {currentArticle.imageUrl && (
                  <figure className="my-7">
                    <div className="aspect-video w-full overflow-hidden rounded-lg bg-slate-100 border border-slate-200/80">
                      {!imageErrorMap[currentArticle.id] ? (
                        <img
                          src={currentArticle.imageUrl}
                          alt={currentArticle.imageAlt ?? currentArticle.title}
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setImageErrorMap((prev) => ({
                              ...prev,
                              [currentArticle.id]: true,
                            }))
                          }
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-500 p-6 text-center">
                          <Volume2 className="w-7 h-7 mb-2 text-slate-400" />
                          <span className="text-sm font-medium text-slate-700">
                            {currentArticle.title}
                          </span>
                        </div>
                      )}
                    </div>
                    {currentArticle.imageCaption && (
                      <figcaption className="mt-2.5 text-xs text-slate-500 leading-relaxed">
                        {currentArticle.imageCaption}
                      </figcaption>
                    )}
                  </figure>
                )}

                {/* Tokenized Readable Body with Live Sentence & Word Highlighting */}
                <div className="space-y-5 font-serif text-[18px] leading-[1.8] text-slate-800 pb-20">
                  {currentArticle.paragraphs.map((paragraph, pIdx) => {
                    const pSentences = blocksByParagraph.get(pIdx) ?? [];

                    if (paragraph.type === 'heading') {
                      return (
                        <h2
                          key={pIdx}
                          className="pt-4 font-sans text-xl font-semibold tracking-tight text-slate-900"
                        >
                          {pSentences.map((block) => renderSentenceSpan(block))}
                        </h2>
                      );
                    }

                    if (paragraph.type === 'quote') {
                      return (
                        <blockquote
                          key={pIdx}
                          className="my-6 px-6 py-5 rounded-lg bg-slate-50 border border-slate-200/80 italic text-slate-700 text-[19px] leading-[1.7]"
                        >
                          {pSentences.map((block) => renderSentenceSpan(block))}
                        </blockquote>
                      );
                    }

                    return (
                      <p key={pIdx}>
                        {pSentences.map((block) => renderSentenceSpan(block))}
                      </p>
                    );
                  })}
                </div>
              </article>
            ) : null}

            {/* Floating In-Page Mini Reading Bar (visible when playing/paused & popup closed) */}
            {!popupOpen && reader.status !== 'idle' && (
              <div className="sticky bottom-4 mx-auto w-fit max-w-full z-20 flex flex-wrap items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 text-white shadow-lg border border-white/10">
                <button
                  type="button"
                  onClick={reader.prevSentence}
                  aria-label="Previous sentence"
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <SkipBack className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={reader.togglePlayPause}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  {reader.status === 'playing' ? (
                    <>
                      <Pause className="w-3.5 h-3.5 fill-current" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Resume</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={reader.nextSentence}
                  aria-label="Next sentence"
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                </button>

                <div className="h-4 w-px bg-white/15 mx-0.5" aria-hidden="true" />

                {/* Quick Speed Controls in Mini Bar */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => reader.nudgeRate(-0.1)}
                    disabled={reader.settings.rate <= 0.5}
                    aria-label="Decrease reading speed"
                    title="Slower (-0.1x)"
                    className="p-1.5 rounded-md hover:bg-white/10 disabled:opacity-40 transition-colors"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="min-w-[38px] text-center text-xs font-mono tabular-nums text-slate-100 whitespace-nowrap">
                    {reader.settings.rate.toFixed(1)}x
                  </span>
                  <button
                    type="button"
                    onClick={() => reader.nudgeRate(0.1)}
                    disabled={reader.settings.rate >= 2.5}
                    aria-label="Increase reading speed"
                    title="Faster (+0.1x)"
                    className="p-1.5 rounded-md hover:bg-white/10 disabled:opacity-40 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                {/* Quick Voice Picker in Mini Bar */}
                <select
                  aria-label="Select voice"
                  value={reader.settings.voiceURI}
                  onFocus={reader.refreshVoices}
                  onChange={(e) => reader.updateSettings({ voiceURI: e.target.value })}
                  className="max-w-[140px] h-7 px-2 rounded-md bg-slate-800 border border-white/15 text-xs text-slate-100 truncate focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {reader.rankedVoices.map((rv) => (
                    <option key={rv.uri} value={rv.uri}>
                      {rv.displayName}
                    </option>
                  ))}
                </select>

                <span className="px-1.5 text-xs font-mono tabular-nums text-slate-400 whitespace-nowrap">
                  {reader.activeSentenceIndex >= 0
                    ? `${reader.activeSentenceIndex + 1}/${reader.totalSentences}`
                    : 'Selection'}
                </span>

                <button
                  type="button"
                  onClick={reader.stop}
                  aria-label="Stop reading"
                  className="p-2 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                </button>
              </div>
            )}
          </div>

          {/* Docked Chrome Extension Popup Surface */}
          {popupOpen && (
            <div className="w-full lg:w-auto p-4 lg:p-5 bg-slate-50/70 lg:border-l border-t lg:border-t-0 border-slate-200 lg:h-[calc(100vh-225px)] lg:min-h-[560px] lg:overflow-y-auto shrink-0">
              <ExtensionPopup
                settings={reader.settings}
                onUpdateSettings={reader.updateSettings}
                onNudgeRate={reader.nudgeRate}
                voices={reader.rankedVoices}
                hasSystemVoices={reader.hasSystemVoices}
                availableLanguages={reader.availableLanguages}
                onRefreshVoices={reader.refreshVoices}
                onPreviewVoice={reader.previewVoice}
                isPreviewingVoice={reader.isPreviewingVoice}
                status={reader.status}
                activeSentenceIndex={reader.activeSentenceIndex}
                totalSentences={reader.totalSentences}
                estimatedWpm={reader.estimatedWpm}
                remainingTimeFormatted={reader.remainingTimeFormatted}
                progressPercent={reader.progressPercent}
                simulatedMode={reader.simulatedMode}
                selectionModeText={reader.selectionModeText}
                onTogglePlayPause={reader.togglePlayPause}
                onStop={reader.stop}
                onPrev={reader.prevSentence}
                onNext={reader.nextSentence}
                onClose={() => setPopupOpen(false)}
              />

              {/* Concise keyboard shortcut hint below popup */}
              <div className="mt-4 px-1 flex items-center justify-between text-[11px] text-slate-500">
                <span>Space: Play / Pause</span>
                <span>Up / Down: Speed · Left / Right: Skip</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  function renderSentenceSpan(block: (typeof sentenceBlocks)[number]) {
    const isSentenceActive = reader.activeSentenceIndex === block.sentenceIndex;
    const mode = reader.settings.highlightMode;
    const showSentenceBg =
      isSentenceActive && (mode === 'both' || mode === 'sentence');
    const showWordBg = isSentenceActive && (mode === 'both' || mode === 'word');

    return (
      <span
        key={block.id}
        ref={(el) => {
          if (el) sentenceElMapRef.current.set(block.sentenceIndex, el);
          else sentenceElMapRef.current.delete(block.sentenceIndex);
        }}
        onClick={() => {
          const sel = window.getSelection();
          if (sel && sel.toString().trim().length > 0) return;
          reader.speakSentenceAt(block.sentenceIndex);
        }}
        title="Click to read from this sentence"
        className={`cursor-pointer rounded-[4px] transition-colors duration-150 ${
          showSentenceBg
            ? `${activeTheme.sentenceBg} py-0.5`
            : 'hover:bg-slate-100/80'
        }`}
      >
        {block.tokens.map((token, tIdx) => {
          const isWordActive = showWordBg && reader.activeTokenIndex === tIdx;
          if (!token.isWord) {
            return <span key={tIdx}>{token.text}</span>;
          }
          return (
            <span
              key={tIdx}
              className={`rounded-[3px] transition-colors duration-75 ${
                isWordActive
                  ? `${activeTheme.wordBg} ${activeTheme.wordText} px-0.5`
                  : ''
              }`}
            >
              {token.text}
            </span>
          );
        })}{' '}
      </span>
    );
  }
}
