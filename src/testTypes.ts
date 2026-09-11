export interface TestOption {
  key: string; // e.g. "A", "B", "C", "D", "E"
  text: string;
}

export interface TestQuestion {
  id: string;
  questionNumber?: number;
  question: string;
  options: TestOption[];
  correctAnswer: string; // e.g. "B"
  explanation?: string;
}

export interface TestDeck {
  id: string;
  title: string;
  rawText: string;
  questions: TestQuestion[];
  createdAt: number;
  lastSolvedAt?: number;
  bestScore?: {
    correct: number;
    wrong: number;
    total: number;
    percentage: number;
  };
}

export interface UserAnswerRecord {
  selectedOptionKey: string;
  isCorrect: boolean;
  answeredAt: number;
}

export type UserAnswersMap = Record<string, UserAnswerRecord>;

export interface TestSession {
  deckId: string;
  currentQuestionIdx: number;
  lastAnsweredQuestionIndex?: number;
  userAnswers: UserAnswersMap;
  isRetryOnlyWrongMode?: boolean;
  activeQuestionIds?: string[];
  lastUpdated: number;
}

export type TestSessionsMap = Record<string, TestSession>;
