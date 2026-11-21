export type HighlightMode = 'both' | 'sentence' | 'word' | 'off';

export type HighlightColorId = 'amber' | 'cobalt' | 'sage' | 'slate';

export interface HighlightTheme {
  id: HighlightColorId;
  label: string;
  swatchHex: string;
  sentenceBg: string;
  wordBg: string;
  wordText: string;
}

export const HIGHLIGHT_THEMES: Record<HighlightColorId, HighlightTheme> = {
  amber: {
    id: 'amber',
    label: 'Warm Amber',
    swatchHex: '#F59E0B',
    sentenceBg: 'bg-amber-100/80',
    wordBg: 'bg-amber-300',
    wordText: 'text-slate-950',
  },
  cobalt: {
    id: 'cobalt',
    label: 'Clear Cobalt',
    swatchHex: '#3B82F6',
    sentenceBg: 'bg-blue-100/80',
    wordBg: 'bg-blue-300',
    wordText: 'text-slate-950',
  },
  sage: {
    id: 'sage',
    label: 'Soft Sage',
    swatchHex: '#10B981',
    sentenceBg: 'bg-emerald-100/80',
    wordBg: 'bg-emerald-300',
    wordText: 'text-slate-950',
  },
  slate: {
    id: 'slate',
    label: 'Paper Slate',
    swatchHex: '#64748B',
    sentenceBg: 'bg-slate-200/80',
    wordBg: 'bg-slate-800',
    wordText: 'text-white',
  },
};

export interface WordToken {
  text: string;
  start: number; // character offset inside sentence
  end: number;
  isWord: boolean; // false for whitespace / pure punctuation gaps
  wordIndex: number; // 0-based index among speakable words, -1 for non-words
}

export interface SentenceBlock {
  id: string;
  paragraphIndex: number;
  sentenceIndex: number; // global 0-based sentence index
  text: string;
  tokens: WordToken[];
  wordCount: number;
}

export interface ArticleParagraph {
  type: 'heading' | 'body' | 'quote';
  text: string;
}

export interface SampleArticle {
  id: string;
  tabTitle: string;
  url: string;
  publication: string;
  category: string;
  title: string;
  subtitle: string;
  author: string;
  date: string;
  imageUrl?: string;
  imageAlt?: string;
  imageCaption?: string;
  paragraphs: ArticleParagraph[];
}

export interface ReaderSettings {
  voiceURI: string;
  rate: number; // 0.5 - 2.5
  pitch: number; // 0.8 - 1.2
  highlightMode: HighlightMode;
  highlightColor: HighlightColorId;
  autoScroll: boolean;
}

export type PlaybackStatus = 'idle' | 'playing' | 'paused';
