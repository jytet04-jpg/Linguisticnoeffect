import { TestDeck, TestQuestion, TestOption, TestSession, TestSessionsMap } from '../testTypes';

export const SAMPLE_OPTION_A_DATA = `Soru: She ___ to school by bus every morning.
A) go
B) goes*
C) going
D) went

Soru: What is the past tense of the irregular verb "buy"?
A) buyed
B) buying
C) bought*
D) boat

Soru: If it rains tomorrow, we ___ at home.
A) will stay*
B) stayed
C) would stay
D) staying

Soru: They have lived in this city ___ 2018.
A) for
B) since*
C) during
D) while

Soru: Which word is the opposite (antonym) of "Generous"?
A) Kind
B) Greedy*
C) Polite
D) Honest

Soru: I am looking forward to ___ you at the conference.
A) see
B) seeing*
C) saw
D) seen

Soru: Neither John nor his friends ___ coming to the party tonight.
A) is
B) are*
C) was
D) be

Soru: Could you please tell me where ___?
A) is the library
B) the library is*
C) the library was
D) does the library be`;

/**
 * Parses raw text formatted using Option A (natural multiple-choice format).
 */
export function parseOptionAText(text: string): TestQuestion[] {
  if (!text || !text.trim()) return [];

  // Normalize line breaks
  const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Split into potential blocks by empty lines or question markers
  const rawLines = cleanText.split('\n');
  const blocks: string[][] = [];
  let currentBlock: string[] = [];

  const isQuestionStart = (line: string): boolean => {
    const trimmed = line.trim();
    // Check if line starts with "Soru", "Question", or numbering like "1.", "1)", "1 -", "Q1:"
    if (/^(soru\s*\d*[:.-]|question\s*\d*[:.-]|q\d+[:.-])/i.test(trimmed)) return true;
    if (/^\d+[\.\)]\s+/.test(trimmed)) return true;
    return false;
  };

  const isOptionLine = (line: string): boolean => {
    const trimmed = line.trim();
    // Starts with [A-E][).:\-] or ([A-E])
    return /^[A-Ea-e][\)\.\:\-]\s*|^\[[A-Ea-e]\]\s*|^\([A-Ea-e]\)\s*/i.test(trimmed);
  };

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      if (currentBlock.length > 0) {
        blocks.push(currentBlock);
        currentBlock = [];
      }
      continue;
    }

    // If we encounter a new question marker and the current block already has choices, flush block
    if (isQuestionStart(trimmed) && currentBlock.some(l => isOptionLine(l))) {
      blocks.push(currentBlock);
      currentBlock = [line];
    } else {
      currentBlock.push(line);
    }
  }

  if (currentBlock.length > 0) {
    blocks.push(currentBlock);
  }

  const questions: TestQuestion[] = [];

  blocks.forEach((block, index) => {
    let questionLines: string[] = [];
    const options: TestOption[] = [];
    let correctAnswer = '';
    let explanation = '';

    for (const rawLine of block) {
      const line = rawLine.trim();
      if (!line) continue;

      // Check for explicit answer line like "Cevap: B" or "Answer: B"
      const ansMatch = line.match(/^(?:cevap|dogru\s*cevap|doğru\s*cevap|answer|correct\s*answer)\s*[:=]\s*([A-Ea-e])/i);
      if (ansMatch) {
        correctAnswer = ansMatch[1].toUpperCase();
        continue;
      }

      // Check for explanation line like "Açıklama: ..."
      const expMatch = line.match(/^(?:açıklama|aciklama|explanation|not)\s*[:=]\s*(.*)$/i);
      if (expMatch) {
        explanation = expMatch[1].trim();
        continue;
      }

      // Check if it's an option line
      // Matches A) text*, A. text, *A) text, A)* text, A) text [x], A) text (doğru)
      const optMatch = line.match(/^(\*?)\s*(?:\[([A-Ea-e])\]|\(([A-Ea-e])\)|([A-Ea-e])[\)\.\:\-])(\*?)\s*(.*)$/);
      if (optMatch) {
        const starPrefix = optMatch[1] === '*';
        const optKey = (optMatch[2] || optMatch[3] || optMatch[4]).toUpperCase();
        const starMid = optMatch[5] === '*';
        let optText = (optMatch[6] || '').trim();

        let isCorrect = starPrefix || starMid;

        // Check if option text contains trailing *
        if (optText.endsWith('*')) {
          isCorrect = true;
          optText = optText.slice(0, -1).trim();
        }

        // Check if option text contains [x] or [X]
        if (/\[x\]$/i.test(optText)) {
          isCorrect = true;
          optText = optText.replace(/\[x\]$/i, '').trim();
        }

        // Check if option text contains (doğru) / (dogru) / (correct)
        if (/\((?:doğru|dogru|correct)\)$/i.test(optText)) {
          isCorrect = true;
          optText = optText.replace(/\((?:doğru|dogru|correct)\)$/i, '').trim();
        }

        options.push({
          key: optKey,
          text: optText
        });

        if (isCorrect) {
          correctAnswer = optKey;
        }
      } else {
        // It's part of the question text
        questionLines.push(rawLine);
      }
    }

    // Process question text: remove leading "Soru:", "1. Soru:", "1)", etc.
    let fullQuestion = questionLines.join('\n').trim();
    fullQuestion = fullQuestion.replace(/^(?:soru\s*\d*[:.-]|question\s*\d*[:.-]|q\d+[:.-]|\d+[\.\)]\s*)\s*/i, '').trim();

    // If options were found and question text is present
    if (fullQuestion && options.length >= 2) {
      // Default to first option if no correct answer was marked (or mark A)
      if (!correctAnswer && options.length > 0) {
        correctAnswer = options[0].key;
      }

      questions.push({
        id: `q-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
        questionNumber: index + 1,
        question: fullQuestion,
        options,
        correctAnswer,
        explanation: explanation || undefined
      });
    }
  });

  return questions;
}

const STORAGE_KEY = 'language-app-test-decks';

export function loadTestDecks(): TestDeck[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error loading test decks from localStorage', e);
  }

  // Initial sample test deck
  const initialQuestions = parseOptionAText(SAMPLE_OPTION_A_DATA);
  const sampleDeck: TestDeck = {
    id: 'sample-test-deck-1',
    title: 'Örnek İngilizce Gramer Testi',
    rawText: SAMPLE_OPTION_A_DATA,
    questions: initialQuestions,
    createdAt: Date.now()
  };

  return [sampleDeck];
}

export function saveTestDecks(decks: TestDeck[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
  } catch (e) {
    console.error('Error saving test decks to localStorage', e);
  }
}

const TEST_SESSIONS_KEY = 'language-app-test-sessions';
const LAST_ACTIVE_TEST_KEY = 'language-app-last-active-test-deck-id';

export function loadTestSessions(): TestSessionsMap {
  try {
    const saved = localStorage.getItem(TEST_SESSIONS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error loading test sessions from localStorage', e);
  }
  return {};
}

export function saveTestSessions(sessions: TestSessionsMap): void {
  try {
    localStorage.setItem(TEST_SESSIONS_KEY, JSON.stringify(sessions));
  } catch (e) {
    console.error('Error saving test sessions to localStorage', e);
  }
}

export function getSingleTestSession(deckId: string): TestSession | null {
  const sessions = loadTestSessions();
  return sessions[deckId] || null;
}

export function saveSingleTestSession(session: TestSession): void {
  const sessions = loadTestSessions();
  sessions[session.deckId] = session;
  saveTestSessions(sessions);
}

export function clearSingleTestSession(deckId: string): void {
  const sessions = loadTestSessions();
  if (sessions[deckId]) {
    delete sessions[deckId];
    saveTestSessions(sessions);
  }
}

export function saveLastActiveTestDeckId(deckId: string | null): void {
  try {
    if (deckId) {
      localStorage.setItem(LAST_ACTIVE_TEST_KEY, deckId);
    } else {
      localStorage.removeItem(LAST_ACTIVE_TEST_KEY);
    }
  } catch (e) {
    console.error('Error saving last active test deck id', e);
  }
}

export function loadLastActiveTestDeckId(): string | null {
  try {
    return localStorage.getItem(LAST_ACTIVE_TEST_KEY);
  } catch (e) {
    return null;
  }
}
