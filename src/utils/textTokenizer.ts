import { ArticleParagraph, SentenceBlock, WordToken } from '../types/reader';

/**
 * Tokenizes a sentence string into word and whitespace/punctuation tokens
 * while preserving exact character start/end offsets for SpeechSynthesis onboundary matching.
 */
export function tokenizeSentence(sentence: string): {
  tokens: WordToken[];
  wordCount: number;
} {
  const tokens: WordToken[] = [];
  const regex = /(\s+|[^\s]+)/g;
  let match: RegExpExecArray | null;
  let wordIndex = 0;

  while ((match = regex.exec(sentence)) !== null) {
    const text = match[0];
    const start = match.index;
    const end = start + text.length;
    const isWord = /[\p{L}\p{N}]/u.test(text);

    tokens.push({
      text,
      start,
      end,
      isWord,
      wordIndex: isWord ? wordIndex++ : -1,
    });
  }

  return { tokens, wordCount: wordIndex };
}

/**
 * Splits a paragraph into natural sentences while avoiding splits on common abbreviations
 * like Dr., Mr., Ms., Prof., U.S., etc.
 */
export function splitIntoSentences(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // Use Intl.Segmenter when available for accurate locale-aware sentence boundaries
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
    const result: string[] = [];
    for (const seg of segmenter.segment(trimmed)) {
      const s = seg.segment.trim();
      if (s.length > 0) {
        result.push(s);
      }
    }
    if (result.length > 0) return result;
  }

  // Fallback regex sentence splitter
  const parts = trimmed.match(/[^.!?]+[.!?]+["'”’)\]]*|[^.!?]+$/g);
  return parts ? parts.map((s) => s.trim()).filter(Boolean) : [trimmed];
}

/**
 * Converts structured paragraphs into flat, indexed SentenceBlocks for reading and highlighting.
 */
export function buildSentenceBlocks(paragraphs: ArticleParagraph[]): SentenceBlock[] {
  const blocks: SentenceBlock[] = [];
  let globalIdx = 0;

  paragraphs.forEach((paragraph, pIdx) => {
    const sentences = splitIntoSentences(paragraph.text);
    sentences.forEach((sentenceText, sIdx) => {
      const { tokens, wordCount } = tokenizeSentence(sentenceText);
      blocks.push({
        id: `p${pIdx}-s${sIdx}`,
        paragraphIndex: pIdx,
        sentenceIndex: globalIdx,
        text: sentenceText,
        tokens,
        wordCount,
      });
      globalIdx += 1;
    });
  });

  return blocks;
}

/**
 * Finds the token index corresponding to a SpeechSynthesisUtterance boundary charIndex.
 */
export function findTokenIndexByCharOffset(tokens: WordToken[], charIndex: number): number {
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.isWord && charIndex >= token.start && charIndex < token.end) {
      return i;
    }
  }
  // If charIndex lands on leading punctuation or whitespace, find the nearest upcoming word token
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.isWord && token.start >= charIndex) {
      return i;
    }
  }
  return -1;
}

/**
 * Formats estimated remaining reading time in m:ss format based on remaining words and speech rate.
 * Average natural TTS rate at 1.0x is roughly 165 words per minute.
 */
export function formatRemainingTime(wordsRemaining: number, rate: number): string {
  const effectiveWpm = Math.max(60, 165 * rate);
  const totalSeconds = Math.max(0, Math.round((wordsRemaining / effectiveWpm) * 60));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
