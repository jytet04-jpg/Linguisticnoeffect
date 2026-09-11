import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, 
  XCircle, 
  ChevronLeft, 
  ChevronRight, 
  RotateCcw, 
  Trophy, 
  Upload, 
  FileText, 
  Plus, 
  Trash2, 
  Edit3, 
  Download, 
  HelpCircle, 
  Play, 
  ArrowLeft,
  Check,
  X,
  Sparkles,
  Award,
  BookOpen,
  Filter,
  Copy,
  Info
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { TestDeck, TestQuestion, UserAnswersMap, TestSession, TestSessionsMap } from '../testTypes';
import { 
  parseOptionAText, 
  SAMPLE_OPTION_A_DATA, 
  saveTestDecks,
  loadTestSessions,
  saveTestSessions,
  getSingleTestSession,
  saveSingleTestSession,
  clearSingleTestSession,
  saveLastActiveTestDeckId,
  loadLastActiveTestDeckId
} from '../utils/testParser';

interface TestSolverTabProps {
  testDecks: TestDeck[];
  setTestDecks: React.Dispatch<React.SetStateAction<TestDeck[]>>;
  showToast: (msg: string) => void;
}

export const TestSolverTab: React.FC<TestSolverTabProps> = ({
  testDecks,
  setTestDecks,
  showToast
}) => {
  // Active test deck being solved
  const [activeDeck, setActiveDeck] = useState<TestDeck | null>(null);
  // Current active question list (either all questions or only wrong questions retry)
  const [activeQuestions, setActiveQuestions] = useState<TestQuestion[]>([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState<number>(0);
  const [userAnswers, setUserAnswers] = useState<UserAnswersMap>({});
  const [isTestFinished, setIsTestFinished] = useState<boolean>(false);
  const [showReviewList, setShowReviewList] = useState<boolean>(false);
  const [isRetryOnlyWrongMode, setIsRetryOnlyWrongMode] = useState<boolean>(false);

  // Saved in-progress sessions for each deck
  const [testSessions, setTestSessions] = useState<TestSessionsMap>(() => loadTestSessions());

  // Deck management states
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [createDeckTitle, setCreateDeckTitle] = useState<string>('');
  const [createDeckText, setCreateDeckText] = useState<string>('');
  const [editingDeck, setEditingDeck] = useState<TestDeck | null>(null);
  const [showFormatGuideModal, setShowFormatGuideModal] = useState<boolean>(false);
  const [deckToDelete, setDeckToDelete] = useState<TestDeck | null>(null);

  // Drag & drop state for file upload
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Parse preview when typing or pasting in create modal
  const previewQuestions = useMemo(() => {
    if (!createDeckText.trim()) return [];
    return parseOptionAText(createDeckText);
  }, [createDeckText]);

  // Current question during quiz
  const currentQuestion = activeQuestions[currentQuestionIdx] || null;
  const currentAnswer = currentQuestion ? userAnswers[currentQuestion.id] : undefined;

  // Check if all questions have been answered
  const allAnswered = useMemo(() => {
    if (activeQuestions.length === 0) return false;
    return activeQuestions.every(q => userAnswers[q.id] !== undefined);
  }, [activeQuestions, userAnswers]);

  // Auto-finish test or advance immediately to next question when an option is selected
  const handleSelectOption = (optionKey: string) => {
    if (!currentQuestion) return;
    // If already answered, do not allow changing answer (standard instant feedback test)
    if (userAnswers[currentQuestion.id]) return;

    const isCorrect = optionKey.toUpperCase() === currentQuestion.correctAnswer.toUpperCase();
    const updatedAnswers: UserAnswersMap = {
      ...userAnswers,
      [currentQuestion.id]: {
        selectedOptionKey: optionKey,
        isCorrect,
        answeredAt: Date.now()
      }
    };
    setUserAnswers(updatedAnswers);

    const totalAnswered = Object.keys(updatedAnswers).length;

    // If all questions are answered, finish the test after a short delay
    if (totalAnswered === activeQuestions.length) {
      saveDeckScore(updatedAnswers);
      setTimeout(() => {
        handleFinishTest();
      }, 400);
      return;
    }

    // Automatically advance to the next unanswered question (skipping any questions already answered)
    setTimeout(() => {
      // Find the next unanswered question starting from currentIdx + 1 forward
      let nextTargetIdx = -1;
      for (let i = currentQuestionIdx + 1; i < activeQuestions.length; i++) {
        if (!updatedAnswers[activeQuestions[i].id]) {
          nextTargetIdx = i;
          break;
        }
      }

      // If no unanswered questions forward, search backward from question 0 (smallest unanswered)
      if (nextTargetIdx === -1) {
        for (let i = 0; i < currentQuestionIdx; i++) {
          if (!updatedAnswers[activeQuestions[i].id]) {
            nextTargetIdx = i;
            break;
          }
        }
      }

      if (nextTargetIdx !== -1) {
        setCurrentQuestionIdx(nextTargetIdx);
      }
    }, 350);
  };

  // Calculate and save best score to deck
  const saveDeckScore = (answers: UserAnswersMap) => {
    if (!activeDeck || isRetryOnlyWrongMode) return;
    
    let correct = 0;
    let wrong = 0;
    activeDeck.questions.forEach(q => {
      const ans = answers[q.id];
      if (ans) {
        if (ans.isCorrect) correct++;
        else wrong++;
      }
    });

    const total = activeDeck.questions.length;
    const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;

    const updatedDecks = testDecks.map(d => {
      if (d.id === activeDeck.id) {
        const currentBest = d.bestScore?.percentage ?? 0;
        const newBestScore = percentage >= currentBest 
          ? { correct, wrong, total, percentage } 
          : d.bestScore || { correct, wrong, total, percentage };

        return {
          ...d,
          lastSolvedAt: Date.now(),
          bestScore: newBestScore
        };
      }
      return d;
    });

    setTestDecks(updatedDecks);
    saveTestDecks(updatedDecks);
  };

  // Helper to find the resume target question index based on user answers
  // Rule: Progress ALWAYS starts from the lowest question (1..N).
  // If 1..5 are answered, 6 is unanswered, and 7 was answered:
  // Resume begins from the lowest unanswered question (Question 6).
  // When advancing from question 6 (either after answering or pressing Sonraki Soru),
  // already-answered questions (like Question 7) are automatically skipped.
  const getResumeTargetQuestionIndex = (
    questions: TestQuestion[],
    answers: UserAnswersMap | undefined
  ): number => {
    if (!questions || questions.length === 0) return 0;
    if (!answers || Object.keys(answers).length === 0) return 0;

    // Find the first unanswered question from the beginning (index 0, 1, 2...)
    const firstUnansweredIdx = questions.findIndex(q => !answers[q.id]);
    if (firstUnansweredIdx >= 0) {
      return firstUnansweredIdx;
    }

    // If all questions are answered, point to the last question
    return questions.length - 1;
  };

  // Helper to get next question to visit, skipping already-answered questions if any
  const getNextUnansweredQuestionIndex = (
    currentIdx: number,
    questions: TestQuestion[],
    answers: UserAnswersMap
  ): number => {
    // Search forward from currentIdx + 1 for an unanswered question
    for (let i = currentIdx + 1; i < questions.length; i++) {
      if (!answers[questions[i].id]) {
        return i;
      }
    }
    // If no unanswered questions forward, search backward from index 0
    for (let i = 0; i < currentIdx; i++) {
      if (!answers[questions[i].id]) {
        return i;
      }
    }
    // If all are answered, simply stay at current or go to next index
    return Math.min(questions.length - 1, currentIdx + 1);
  };

  // Realtime persistence of session as user progresses or navigates
  useEffect(() => {
    if (activeDeck && !isTestFinished) {
      // Find the highest answered index
      let highestAnsweredIdx = -1;
      activeQuestions.forEach((q, idx) => {
        if (userAnswers[q.id] && idx > highestAnsweredIdx) {
          highestAnsweredIdx = idx;
        }
      });

      const session: TestSession = {
        deckId: activeDeck.id,
        currentQuestionIdx,
        lastAnsweredQuestionIndex: highestAnsweredIdx >= 0 ? highestAnsweredIdx : undefined,
        userAnswers,
        isRetryOnlyWrongMode,
        lastUpdated: Date.now()
      };
      saveSingleTestSession(session);
      saveLastActiveTestDeckId(activeDeck.id);
      setTestSessions(prev => ({ ...prev, [activeDeck.id]: session }));
    }
  }, [activeDeck, currentQuestionIdx, userAnswers, isTestFinished, isRetryOnlyWrongMode, activeQuestions]);

  // If user exits or closes app, auto-resume on mount if was active
  useEffect(() => {
    const lastActiveDeckId = loadLastActiveTestDeckId();
    if (lastActiveDeckId && !activeDeck) {
      const foundDeck = testDecks.find(d => d.id === lastActiveDeckId);
      if (foundDeck) {
        startSolvingDeck(foundDeck, false);
      }
    }
  }, [testDecks]);

  // Handle browser / Android hardware back button via popstate
  useEffect(() => {
    if (!activeDeck) return;

    window.history.pushState({ testSolverDeckId: activeDeck.id }, '');

    const handlePopState = () => {
      if (activeDeck) {
        saveLastActiveTestDeckId(null);
        setActiveDeck(null);
        showToast("İlerlemeniz kaydedildi.");
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [activeDeck]);

  // Start or resume solving a deck
  const startSolvingDeck = (deck: TestDeck, forceRestart: boolean = false) => {
    if (!deck.questions || deck.questions.length === 0) {
      showToast("Bu testte çözülecek soru bulunamadı. Lütfen formatı kontrol edin.");
      return;
    }

    const savedSession = forceRestart ? null : getSingleTestSession(deck.id);

    setActiveDeck(deck);
    setIsTestFinished(false);
    setShowReviewList(false);

    if (savedSession && !forceRestart) {
      const qList = savedSession.isRetryOnlyWrongMode
        ? deck.questions.filter(q => savedSession.userAnswers[q.id] && !savedSession.userAnswers[q.id].isCorrect)
        : deck.questions;
      
      const resolvedQuestions = qList.length > 0 ? qList : deck.questions;
      setActiveQuestions(resolvedQuestions);

      // Determine the exact resume question using the helper
      const targetIdx = getResumeTargetQuestionIndex(resolvedQuestions, savedSession.userAnswers);

      setCurrentQuestionIdx(targetIdx);
      setUserAnswers(savedSession.userAnswers || {});
      setIsRetryOnlyWrongMode(!!savedSession.isRetryOnlyWrongMode);

      const answeredCount = Object.keys(savedSession.userAnswers || {}).length;
      showToast(`Kaldığınız yerden devam ediliyor: Soru ${targetIdx + 1} (${answeredCount} cevaplandı)`);
    } else {
      setActiveQuestions(deck.questions);
      setCurrentQuestionIdx(0);
      setUserAnswers({});
      setIsRetryOnlyWrongMode(false);
      clearSingleTestSession(deck.id);
      setTestSessions(loadTestSessions());
    }

    saveLastActiveTestDeckId(deck.id);
  };

  // Exit active test cleanly and return to deck list with progress preserved
  const handleExitTest = () => {
    if (activeDeck) {
      const session: TestSession = {
        deckId: activeDeck.id,
        currentQuestionIdx,
        userAnswers,
        isRetryOnlyWrongMode,
        lastUpdated: Date.now()
      };
      saveSingleTestSession(session);
      saveLastActiveTestDeckId(null);
      setTestSessions(loadTestSessions());
    }
    setActiveDeck(null);
    showToast("İlerlemeniz kaydedildi. İstediğiniz zaman kaldığınız yerden devam edebilirsiniz.");
  };

  // Reset progress for a specific deck
  const handleResetDeckSession = (deckId: string) => {
    clearSingleTestSession(deckId);
    setTestSessions(loadTestSessions());
    showToast("Test ilerlemesi sıfırlandı.");
  };

  // Restart active test from scratch
  const handleRestartTest = () => {
    if (!activeDeck) return;
    setActiveQuestions(activeDeck.questions);
    setCurrentQuestionIdx(0);
    setUserAnswers({});
    setIsTestFinished(false);
    setShowReviewList(false);
    setIsRetryOnlyWrongMode(false);
    clearSingleTestSession(activeDeck.id);
    setTestSessions(loadTestSessions());
    saveLastActiveTestDeckId(activeDeck.id);
    showToast("Test baştan başlatıldı.");
  };

  // Retry only wrong questions
  const handleRetryOnlyWrong = () => {
    if (!activeDeck) return;
    const wrongQuestions = activeQuestions.filter(q => {
      const ans = userAnswers[q.id];
      return ans && !ans.isCorrect;
    });

    if (wrongQuestions.length === 0) {
      showToast("Tebrikler! Yanlış yaptığınız soru bulunmuyor.");
      return;
    }

    setActiveQuestions(wrongQuestions);
    setCurrentQuestionIdx(0);
    setUserAnswers({});
    setIsTestFinished(false);
    setShowReviewList(false);
    setIsRetryOnlyWrongMode(true);
    showToast(`Yanlış yapılan ${wrongQuestions.length} soru ile tekrar başladı.`);
  };

  // Finish test and show results
  const handleFinishTest = () => {
    saveDeckScore(userAnswers);
    setIsTestFinished(true);
    if (activeDeck) {
      clearSingleTestSession(activeDeck.id);
      saveLastActiveTestDeckId(null);
      setTestSessions(loadTestSessions());
    }
  };

  // Import TXT file
  const handleFileUpload = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        const questions = parseOptionAText(text);
        if (questions.length === 0) {
          showToast("Hata: Dosyada Seçenek A formatına uygun soru bulunamadı.");
          return;
        }

        const title = file.name.replace(/\.[^/.]+$/, '') || 'Yeni Test';
        const newDeck: TestDeck = {
          id: `test-deck-${Date.now()}`,
          title,
          rawText: text,
          questions,
          createdAt: Date.now()
        };

        const updated = [newDeck, ...testDecks];
        setTestDecks(updated);
        saveTestDecks(updated);
        showToast(`"${title}" başarıyla yüklendi (${questions.length} soru).`);
      }
    };
    reader.readAsText(file);
  };

  // Save or edit deck from modal
  const handleSaveDeckFromModal = () => {
    if (!createDeckTitle.trim()) {
      showToast("Lütfen bir test başlığı girin.");
      return;
    }
    const questions = parseOptionAText(createDeckText);
    if (questions.length === 0) {
      showToast("Lütfen en az bir geçerli soru ve şıkları ekleyin.");
      return;
    }

    if (editingDeck) {
      const updated = testDecks.map(d => {
        if (d.id === editingDeck.id) {
          return {
            ...d,
            title: createDeckTitle.trim(),
            rawText: createDeckText,
            questions
          };
        }
        return d;
      });
      setTestDecks(updated);
      saveTestDecks(updated);
      showToast("Test başarıyla güncellendi.");
    } else {
      const newDeck: TestDeck = {
        id: `test-deck-${Date.now()}`,
        title: createDeckTitle.trim(),
        rawText: createDeckText,
        questions,
        createdAt: Date.now()
      };
      const updated = [newDeck, ...testDecks];
      setTestDecks(updated);
      saveTestDecks(updated);
      showToast(`"${newDeck.title}" testi oluşturuldu (${questions.length} soru).`);
    }

    setShowCreateModal(false);
    setEditingDeck(null);
    setCreateDeckTitle('');
    setCreateDeckText('');
  };

  // Open edit modal
  const handleOpenEdit = (deck: TestDeck) => {
    setEditingDeck(deck);
    setCreateDeckTitle(deck.title);
    setCreateDeckText(deck.rawText);
    setShowCreateModal(true);
  };

  // Delete deck
  const handleDeleteDeck = (deckId: string) => {
    const updated = testDecks.filter(d => d.id !== deckId);
    setTestDecks(updated);
    saveTestDecks(updated);
    if (activeDeck?.id === deckId) {
      setActiveDeck(null);
    }
    setDeckToDelete(null);
    showToast("Test silindi.");
  };

  // Export single test as .txt
  const handleExportSingleDeck = async (deck: TestDeck) => {
    try {
      const fileName = `${deck.title.replace(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ_-]/g, '_')}_test.txt`;
      if (Capacitor.isNativePlatform()) {
        const result = await Filesystem.writeFile({
          path: fileName,
          data: deck.rawText,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });
        await Share.share({
          title: deck.title,
          text: `${deck.title} Test Dosyası`,
          url: result.uri,
          dialogTitle: 'Test Dosyasını Paylaş / Kaydet',
        });
      } else {
        const blob = new Blob([deck.rawText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }
      showToast("Test .txt dosyası olarak dışa aktarıldı.");
    } catch (e) {
      console.error(e);
      showToast("Dışa aktarma sırasında hata oluştu.");
    }
  };

  // Download Sample Option A Template
  const handleDownloadSampleTemplate = async () => {
    try {
      const fileName = 'ornek_secenek_a_test_formati.txt';
      const sampleContent = SAMPLE_OPTION_A_DATA;
      if (Capacitor.isNativePlatform()) {
        const result = await Filesystem.writeFile({
          path: fileName,
          data: sampleContent,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });
        await Share.share({
          title: 'Örnek Test Formatı (Seçenek A)',
          url: result.uri,
        });
      } else {
        const blob = new Blob([sampleContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }
      showToast("Örnek Seçenek A şablonu indirildi.");
    } catch (e) {
      console.error(e);
      showToast("Şablon indirme hatası.");
    }
  };

  // Results calculation
  const stats = useMemo(() => {
    let correct = 0;
    let wrong = 0;
    let empty = 0;

    activeQuestions.forEach(q => {
      const ans = userAnswers[q.id];
      if (!ans) {
        empty++;
      } else if (ans.isCorrect) {
        correct++;
      } else {
        wrong++;
      }
    });

    const total = activeQuestions.length;
    const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;

    return { correct, wrong, empty, total, percentage };
  }, [activeQuestions, userAnswers]);

  // ==========================================
  // VIEW: RESULTS SCREEN (Test Bittiğinde)
  // ==========================================
  if (activeDeck && isTestFinished) {
    return (
      <div className="w-full max-w-3xl mx-auto flex flex-col gap-6 py-4 animate-in fade-in duration-300">
        {/* Top Header Card */}
        <div className="bg-zinc-950 rounded-3xl p-6 sm:p-10 border border-zinc-900 shadow-xl relative overflow-hidden text-center">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500" />
          
          <div className="w-20 h-20 mx-auto rounded-3xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-5 shadow-lg shadow-indigo-500/10">
            <Trophy size={40} className={stats.percentage >= 70 ? 'text-amber-400' : 'text-indigo-400'} />
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {stats.percentage === 100 
              ? "Kusursuz Başarı! 🌟" 
              : stats.percentage >= 75 
              ? "Tebrikler! Harika Sonuç 🎉" 
              : stats.percentage >= 50 
              ? "İyi Bir Performans! 👍" 
              : "Tekrar Ederek Pekiştirebilirsin! 💪"}
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base mt-2 max-w-md mx-auto">
            {activeDeck.title} {isRetryOnlyWrongMode ? '(Yanlış Sorular Tekrarı)' : ''} testini tamamladınız.
          </p>

          {/* Big Score Percentage Display */}
          <div className="my-8 inline-flex flex-col items-center justify-center">
            <div className="relative">
              <div className="text-5xl sm:text-6xl font-extrabold tracking-tight text-white">
                %{stats.percentage}
              </div>
              <span className="text-xs uppercase font-semibold text-zinc-400 tracking-wider mt-1 block">
                Başarı Oranı
              </span>
            </div>
          </div>

          {/* Stats Badges Grid */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4 max-w-lg mx-auto">
            <div className="bg-emerald-950/40 border border-emerald-800/50 rounded-2xl p-3 sm:p-4 flex flex-col items-center">
              <span className="text-2xl sm:text-3xl font-bold text-emerald-400">{stats.correct}</span>
              <span className="text-xs font-semibold text-emerald-300 mt-1 flex items-center gap-1">
                <CheckCircle2 size={13} /> Doğru
              </span>
            </div>

            <div className="bg-rose-950/40 border border-rose-800/50 rounded-2xl p-3 sm:p-4 flex flex-col items-center">
              <span className="text-2xl sm:text-3xl font-bold text-rose-400">{stats.wrong}</span>
              <span className="text-xs font-semibold text-rose-300 mt-1 flex items-center gap-1">
                <XCircle size={13} /> Yanlış
              </span>
            </div>

            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-3 sm:p-4 flex flex-col items-center">
              <span className="text-2xl sm:text-3xl font-bold text-zinc-300">{stats.empty}</span>
              <span className="text-xs font-semibold text-zinc-400 mt-1 flex items-center gap-1">
                <HelpCircle size={13} /> Boş
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
            <button
              id="test-btn-restart"
              onClick={handleRestartTest}
              className="px-5 py-2.5 sm:px-6 sm:py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm transition flex items-center gap-2 shadow-lg shadow-indigo-900/30"
            >
              <RotateCcw size={16} /> Testi Baştan Çöz
            </button>

            {stats.wrong > 0 && (
              <button
                id="test-btn-retry-wrong"
                onClick={handleRetryOnlyWrong}
                className="px-5 py-2.5 sm:px-6 sm:py-3 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 font-semibold rounded-xl text-sm transition flex items-center gap-2"
              >
                <Filter size={16} /> Sadece Yanlışları Çöz ({stats.wrong})
              </button>
            )}

            <button
              id="test-btn-toggle-review"
              onClick={() => setShowReviewList(!showReviewList)}
              className="px-5 py-2.5 sm:px-6 sm:py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-semibold rounded-xl text-sm transition flex items-center gap-2"
            >
              <BookOpen size={16} /> {showReviewList ? "İncelemeyi Gizle" : "Soruları İncele"}
            </button>

            <button
              id="test-btn-back-to-decks"
              onClick={() => setActiveDeck(null)}
              className="px-5 py-2.5 sm:px-6 sm:py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white font-semibold rounded-xl text-sm transition flex items-center gap-2"
            >
              <ArrowLeft size={16} /> Test Listesine Dön
            </button>
          </div>
        </div>

        {/* Detailed Question Review List */}
        {showReviewList && (
          <div className="bg-zinc-950 rounded-3xl p-6 sm:p-8 border border-zinc-900 shadow-xl flex flex-col gap-6">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
              <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                <BookOpen size={18} className="text-indigo-400" /> Soru ve Cevap Detayları
              </h3>
              <span className="text-xs text-zinc-400">
                Toplam {activeQuestions.length} Soru
              </span>
            </div>

            <div className="flex flex-col gap-5">
              {activeQuestions.map((q, idx) => {
                const ans = userAnswers[q.id];
                const isCorrect = ans?.isCorrect;
                const selectedKey = ans?.selectedOptionKey;

                return (
                  <div 
                    key={q.id}
                    className={`p-5 rounded-2xl border ${
                      !ans 
                        ? 'bg-zinc-900/30 border-zinc-800' 
                        : isCorrect 
                        ? 'bg-emerald-950/20 border-emerald-800/40' 
                        : 'bg-rose-950/20 border-rose-800/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5">
                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                          !ans 
                            ? 'bg-zinc-800 text-zinc-400' 
                            : isCorrect 
                            ? 'bg-emerald-600 text-white' 
                            : 'bg-rose-600 text-white'
                        }`}>
                          {idx + 1}
                        </span>
                        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                          {isCorrect ? 'Doğru Cevaplandı' : ans ? 'Yanlış Cevaplandı' : 'Boş Bırakıldı'}
                        </span>
                      </div>
                      {isCorrect ? (
                        <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
                      ) : ans ? (
                        <XCircle size={20} className="text-rose-400 shrink-0" />
                      ) : (
                        <HelpCircle size={20} className="text-zinc-500 shrink-0" />
                      )}
                    </div>

                    <p className="text-zinc-100 font-medium text-sm sm:text-base whitespace-pre-wrap mb-4">
                      {q.question}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {q.options.map(opt => {
                        const isThisCorrect = opt.key.toUpperCase() === q.correctAnswer.toUpperCase();
                        const isThisSelected = selectedKey?.toUpperCase() === opt.key.toUpperCase();

                        let optClass = 'bg-zinc-900/50 border-zinc-800/80 text-zinc-400';
                        if (isThisCorrect) {
                          optClass = 'bg-emerald-900/30 border-emerald-600/60 text-emerald-200 font-semibold';
                        } else if (isThisSelected && !isCorrect) {
                          optClass = 'bg-rose-900/30 border-rose-600/60 text-rose-200 font-semibold';
                        }

                        return (
                          <div 
                            key={opt.key}
                            className={`px-3 py-2.5 rounded-xl border text-xs sm:text-sm flex items-center justify-between ${optClass}`}
                          >
                            <span className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-md bg-black/30 flex items-center justify-center font-bold text-xs shrink-0">
                                {opt.key}
                              </span>
                              <span>{opt.text}</span>
                            </span>
                            {isThisCorrect && (
                              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-semibold px-2 py-0.5 rounded-full shrink-0">
                                Doğru
                              </span>
                            )}
                            {isThisSelected && !isCorrect && (
                              <span className="text-[10px] bg-rose-500/20 text-rose-300 font-semibold px-2 py-0.5 rounded-full shrink-0">
                                Seçiminiz
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {q.explanation && (
                      <div className="mt-3 p-3 bg-zinc-900/60 rounded-xl border border-zinc-800 text-xs text-zinc-300 flex items-start gap-2">
                        <Info size={14} className="text-indigo-400 shrink-0 mt-0.5" />
                        <span><strong>Açıklama:</strong> {q.explanation}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // VIEW: ACTIVE QUIZ SOLVER (Anında Bildirim Modu)
  // ==========================================
  if (activeDeck && currentQuestion) {
    const isAnswered = currentAnswer !== undefined;

    return (
      <div className="w-full max-w-3xl mx-auto flex flex-col gap-4 py-2">
        {/* Top Control Bar: Back button, Deck Title, Progress, Finish Button */}
        <div className="bg-zinc-950 rounded-2xl p-4 border border-zinc-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <button
              id="test-btn-exit"
              onClick={handleExitTest}
              className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-xl transition flex items-center gap-1.5 text-xs font-semibold border border-zinc-800 shrink-0 shadow-sm"
              title="Testten Çık (İlerlemeniz Kaydedilir)"
            >
              <ArrowLeft size={16} />
              <span>Geri Dön</span>
            </button>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white truncate max-w-xs sm:max-w-md">
                {activeDeck.title}
              </h2>
              <span className="text-xs text-indigo-400 font-medium flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Anında Bildirim Modu
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3">
            <div className="text-xs font-semibold px-3 py-1.5 bg-zinc-900 rounded-lg text-zinc-300 border border-zinc-800">
              Soru {currentQuestionIdx + 1} / {activeQuestions.length}
            </div>

            {/* Complete Test Button */}
            <button
              id="test-btn-finish"
              onClick={handleFinishTest}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                allAnswered 
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-900/30 animate-pulse' 
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
              }`}
            >
              <Check size={14} /> Sonuçları Gör
            </button>
          </div>
        </div>

        {/* Question Selector Pills / Grid */}
        <div className="bg-zinc-950 rounded-2xl p-3 border border-zinc-900 overflow-x-auto scrollbar-thin">
          <div className="flex items-center gap-1.5 min-w-max">
            {activeQuestions.map((q, idx) => {
              const ans = userAnswers[q.id];
              const isCurrent = idx === currentQuestionIdx;
              
              let btnColor = 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800';
              if (ans) {
                if (ans.isCorrect) {
                  btnColor = 'bg-emerald-950/60 border-emerald-600 text-emerald-300';
                } else {
                  btnColor = 'bg-rose-950/60 border-rose-600 text-rose-300';
                }
              }
              if (isCurrent) {
                btnColor += ' ring-2 ring-indigo-500 font-bold';
              }

              return (
                <button
                  key={q.id}
                  id={`test-nav-q-${idx + 1}`}
                  onClick={() => setCurrentQuestionIdx(idx)}
                  className={`w-8 h-8 rounded-lg text-xs font-semibold border flex items-center justify-center transition-all ${btnColor}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Question Card */}
        <div className="bg-zinc-950 rounded-3xl p-6 sm:p-8 border border-zinc-900 shadow-xl relative overflow-hidden flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 bg-indigo-950/50 px-3 py-1 rounded-full border border-indigo-900/50">
              Soru #{currentQuestionIdx + 1}
            </span>

            {/* Answer Status Badge */}
            {isAnswered ? (
              currentAnswer.isCorrect ? (
                <span className="text-xs font-bold text-emerald-400 bg-emerald-950/50 px-3 py-1 rounded-full border border-emerald-800 flex items-center gap-1.5">
                  <CheckCircle2 size={14} /> Doğru Cevap!
                </span>
              ) : (
                <span className="text-xs font-bold text-rose-400 bg-rose-950/50 px-3 py-1 rounded-full border border-rose-800 flex items-center gap-1.5">
                  <XCircle size={14} /> Yanlış Cevap!
                </span>
              )
            ) : (
              <span className="text-xs text-zinc-400">
                Şıklardan birine tıklayın
              </span>
            )}
          </div>

          {/* Question Text */}
          <div className="text-base sm:text-xl font-semibold text-zinc-100 leading-relaxed whitespace-pre-wrap">
            {currentQuestion.question}
          </div>

          {/* Options (A, B, C, D...) */}
          <div className="flex flex-col gap-3">
            {currentQuestion.options.map(option => {
              const isSelected = currentAnswer?.selectedOptionKey.toUpperCase() === option.key.toUpperCase();
              const isCorrectOption = option.key.toUpperCase() === currentQuestion.correctAnswer.toUpperCase();

              // Styling logic for Instant Feedback:
              // - If NOT answered: normal clickable card
              // - If answered:
              //    - Correct option -> Green highlight + Check icon
              //    - Selected but wrong option -> Red highlight + X icon
              //    - Other options -> Muted
              let cardStyle = 'bg-zinc-900/60 border-zinc-800 text-zinc-200 hover:bg-zinc-800 hover:border-zinc-700 cursor-pointer';
              let badgeStyle = 'bg-zinc-800 text-zinc-400 border-zinc-700';

              if (isAnswered) {
                if (isCorrectOption) {
                  cardStyle = 'bg-emerald-950/40 border-emerald-500/80 text-emerald-200 font-semibold shadow-md shadow-emerald-950/40';
                  badgeStyle = 'bg-emerald-600 text-white border-emerald-500';
                } else if (isSelected && !currentAnswer.isCorrect) {
                  cardStyle = 'bg-rose-950/40 border-rose-500/80 text-rose-200 font-semibold shadow-md shadow-rose-950/40';
                  badgeStyle = 'bg-rose-600 text-white border-rose-500';
                } else {
                  cardStyle = 'bg-zinc-900/30 border-zinc-900 text-zinc-600 cursor-default opacity-60';
                  badgeStyle = 'bg-zinc-900 text-zinc-600 border-zinc-800';
                }
              }

              return (
                <button
                  key={option.key}
                  id={`test-option-${option.key}`}
                  disabled={isAnswered}
                  onClick={() => handleSelectOption(option.key)}
                  className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 ${cardStyle}`}
                >
                  <div className="flex items-center gap-3.5">
                    <span className={`w-8 h-8 rounded-xl border flex items-center justify-center font-bold text-sm shrink-0 transition-colors ${badgeStyle}`}>
                      {option.key}
                    </span>
                    <span className="text-sm sm:text-base leading-snug">
                      {option.text}
                    </span>
                  </div>

                  {/* Feedback indicator icon */}
                  {isAnswered && isCorrectOption && (
                    <div className="flex items-center gap-1 text-emerald-400 shrink-0 font-medium text-xs">
                      <span className="hidden sm:inline">Doğru Şık</span>
                      <CheckCircle2 size={20} />
                    </div>
                  )}
                  {isAnswered && isSelected && !currentAnswer.isCorrect && (
                    <div className="flex items-center gap-1 text-rose-400 shrink-0 font-medium text-xs">
                      <span className="hidden sm:inline">Seçiminiz</span>
                      <XCircle size={20} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Instant feedback explanation banner if answered */}
          {isAnswered && (
            <div className={`p-4 rounded-2xl border flex items-start gap-3 transition-all animate-in fade-in duration-200 ${
              currentAnswer.isCorrect 
                ? 'bg-emerald-950/20 border-emerald-800/50 text-emerald-300' 
                : 'bg-rose-950/20 border-rose-800/50 text-rose-300'
            }`}>
              {currentAnswer.isCorrect ? (
                <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-emerald-400" />
              ) : (
                <XCircle size={18} className="shrink-0 mt-0.5 text-rose-400" />
              )}
              <div className="text-xs sm:text-sm">
                <p className="font-semibold">
                  {currentAnswer.isCorrect 
                    ? `Tebrikler! Doğru cevap (${currentQuestion.correctAnswer}) seçildi.` 
                    : `Yanlış cevap! Bu sorunun doğru cevabı (${currentQuestion.correctAnswer}) şıkkıdır.`}
                </p>
                {currentQuestion.explanation && (
                  <p className="mt-1 text-zinc-300 text-xs">
                    <strong>Not:</strong> {currentQuestion.explanation}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Bottom Navigation: Önceki & Sonraki Soru ile Gezinme */}
          <div className="flex items-center justify-between border-t border-zinc-900 pt-4 mt-2">
            <button
              id="test-btn-prev"
              disabled={currentQuestionIdx === 0}
              onClick={() => setCurrentQuestionIdx(prev => Math.max(0, prev - 1))}
              className={`px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm flex items-center gap-1.5 transition ${
                currentQuestionIdx === 0 
                  ? 'bg-zinc-900/40 text-zinc-600 cursor-not-allowed' 
                  : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200'
              }`}
            >
              <ChevronLeft size={16} /> Önceki Soru
            </button>

            <div className="text-xs text-zinc-400 font-medium">
              Soru {currentQuestionIdx + 1} / {activeQuestions.length}
            </div>

            {currentQuestionIdx < activeQuestions.length - 1 ? (
              <button
                id="test-btn-next"
                onClick={() => {
                  // If advancing manually, find next unanswered or simply move to next question
                  const nextUnanswered = getNextUnansweredQuestionIndex(currentQuestionIdx, activeQuestions, userAnswers);
                  if (nextUnanswered > currentQuestionIdx) {
                    setCurrentQuestionIdx(nextUnanswered);
                  } else {
                    setCurrentQuestionIdx(prev => Math.min(activeQuestions.length - 1, prev + 1));
                  }
                }}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-xs sm:text-sm flex items-center gap-1.5 transition shadow-md shadow-indigo-900/30"
              >
                Sonraki Soru <ChevronRight size={16} />
              </button>
            ) : (
              <button
                id="test-btn-finish-last"
                onClick={handleFinishTest}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold text-xs sm:text-sm flex items-center gap-1.5 transition shadow-md shadow-emerald-900/30"
              >
                Testi Bitir <Check size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW: TEST DECKS LIST & MANAGEMENT
  // ==========================================
  return (
    <div className="w-full flex-1 flex flex-col gap-6">
      {/* Header Banner */}
      <div className="bg-zinc-950 rounded-3xl p-6 sm:p-8 border border-zinc-900 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-950 text-indigo-400 border border-indigo-800/60">
                Çoktan Seçmeli Testler
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                100% Çevrimdışı
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Test Çöz & Pratik Yap
            </h2>
            <p className="text-zinc-400 text-xs sm:text-sm mt-1 max-w-xl">
              Kendi hazırladığınız <strong className="text-zinc-300">.txt</strong> test dosyalarını yükleyin, şıklara tıklayarak anında geri bildirimle soruları çözün.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              id="test-btn-format-guide"
              onClick={() => setShowFormatGuideModal(true)}
              className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border border-zinc-800"
            >
              <HelpCircle size={15} className="text-indigo-400" /> Format Rehberi
            </button>

            <button
              id="test-btn-create-paste"
              onClick={() => {
                setEditingDeck(null);
                setCreateDeckTitle('');
                setCreateDeckText('');
                setShowCreateModal(true);
              }}
              className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border border-zinc-800"
            >
              <Plus size={15} /> Metin Yapıştır / Yaz
            </button>

            <label className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-indigo-900/30">
              <Upload size={15} /> .txt Dosyası Yükle
              <input 
                type="file" 
                accept=".txt" 
                className="hidden" 
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                  e.target.value = '';
                }} 
              />
            </label>
          </div>
        </div>
      </div>

      {/* Drag & Drop File Upload Zone */}
      <div 
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleFileUpload(file);
        }}
        className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
          isDragging 
            ? 'border-indigo-500 bg-indigo-950/20 scale-[0.99]' 
            : 'border-zinc-800/80 hover:border-zinc-700 bg-zinc-950/40'
        }`}
      >
        <div className="flex flex-col items-center justify-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-400">
            <Upload size={20} />
          </div>
          <p className="text-xs sm:text-sm text-zinc-300 font-medium">
            Test <span className="text-indigo-400 font-semibold">.txt</span> dosyanızı buraya sürükleyip bırakın veya seçin
          </p>
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={handleDownloadSampleTemplate}
              className="text-[11px] text-zinc-400 hover:text-indigo-400 underline flex items-center gap-1 transition"
            >
              <Download size={12} /> Örnek Seçenek A Şablonunu İndir (.txt)
            </button>
          </div>
        </div>
      </div>

      {/* Decks List */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm sm:text-base font-bold text-zinc-200 flex items-center gap-2">
            <BookOpen size={17} className="text-indigo-400" /> Kayıtlı Testler ({testDecks.length})
          </h3>
        </div>

        {testDecks.length === 0 ? (
          <div className="bg-zinc-950 rounded-2xl p-10 text-center border border-zinc-900 flex flex-col items-center justify-center">
            <FileText size={40} className="text-zinc-600 mb-3" />
            <p className="text-zinc-300 font-semibold text-sm">Henüz bir test eklenmemiş</p>
            <p className="text-zinc-500 text-xs mt-1">Yukarıdaki butonları kullanarak bir .txt dosyası yükleyebilir veya metin yapıştırabilirsiniz.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {testDecks.map(deck => {
              const questionCount = deck.questions?.length ?? 0;
              const bestScore = deck.bestScore;

              return (
                <div 
                  key={deck.id}
                  className="bg-zinc-950 rounded-2xl p-5 border border-zinc-900 hover:border-zinc-800 transition shadow-sm flex flex-col justify-between gap-4"
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-base font-bold text-white tracking-tight line-clamp-1">
                        {deck.title}
                      </h4>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleExportSingleDeck(deck)}
                          className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 rounded-lg transition"
                          title="Dışa Aktar (.txt)"
                        >
                          <Download size={15} />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(deck)}
                          className="p-1.5 text-zinc-400 hover:text-indigo-400 hover:bg-zinc-900 rounded-lg transition"
                          title="Düzenle"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          onClick={() => setDeckToDelete(deck)}
                          className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-zinc-900 rounded-lg transition"
                          title="Sil"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="text-xs px-2.5 py-0.5 rounded-md bg-zinc-900 text-zinc-400 border border-zinc-800">
                        {questionCount} Soru
                      </span>
                      {bestScore && (
                        <span className="text-xs px-2.5 py-0.5 rounded-md bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 flex items-center gap-1 font-medium">
                          <Trophy size={11} className="text-amber-400" /> En İyi: %{bestScore.percentage} ({bestScore.correct}/{bestScore.total})
                        </span>
                      )}
                      {(() => {
                        const session = testSessions[deck.id];
                        const answeredCount = Object.keys(session?.userAnswers || {}).length;
                        const hasProgress = session && answeredCount > 0;
                        if (!hasProgress) return null;

                        const nextIdx = getResumeTargetQuestionIndex(deck.questions, session.userAnswers);

                        return (
                          <span className="text-xs px-2.5 py-0.5 rounded-md bg-amber-950/60 text-amber-300 border border-amber-800/60 flex items-center gap-1 font-medium">
                            <RotateCcw size={11} className="text-amber-400" />
                            Kaldığın Yer: Soru {nextIdx + 1} / {questionCount} ({answeredCount} cevaplandı)
                          </span>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-zinc-900/80 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-zinc-500">
                      {new Date(deck.createdAt).toLocaleDateString('tr-TR')}
                    </span>

                    {(() => {
                      const session = testSessions[deck.id];
                      const answeredCount = Object.keys(session?.userAnswers || {}).length;
                      const hasProgress = session && answeredCount > 0;
                      
                      if (hasProgress) {
                        const nextIdx = getResumeTargetQuestionIndex(deck.questions, session.userAnswers);

                        return (
                          <div className="flex items-center gap-2">
                            <button
                              id={`test-reset-btn-${deck.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleResetDeckSession(deck.id);
                              }}
                              className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-amber-300 border border-zinc-800 rounded-xl text-xs font-semibold flex items-center gap-1 transition"
                              title="İlerlemeyi sıfırla ve baştan başla"
                            >
                              <RotateCcw size={13} />
                              <span className="hidden sm:inline">Sıfırla</span>
                            </button>

                            <button
                              id={`test-start-btn-${deck.id}`}
                              onClick={() => startSolvingDeck(deck, false)}
                              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-md shadow-amber-900/30"
                            >
                              <Play size={14} fill="currentColor" /> Devam Et (Soru {nextIdx + 1})
                            </button>
                          </div>
                        );
                      }

                      return (
                        <button
                          id={`test-start-btn-${deck.id}`}
                          onClick={() => startSolvingDeck(deck, false)}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-md shadow-indigo-900/30"
                        >
                          <Play size={14} fill="currentColor" /> Testi Çöz
                        </button>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: Format Guide (Seçenek A) */}
      <AnimatePresence>
        {showFormatGuideModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-950 rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-zinc-900 shadow-2xl flex flex-col gap-4 relative max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                    <HelpCircle size={18} />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    Seçenek A Format Rehberi
                  </h3>
                </div>
                <button 
                  onClick={() => setShowFormatGuideModal(false)}
                  className="p-1.5 text-zinc-400 hover:text-white rounded-lg transition"
                >
                  <X size={18} />
                </button>
              </div>

              <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                Test dosyalarınızda her soru ve şıklarını çok rahat bir şekilde yazabilirsiniz. Doğru şıkkı belirtmek için şıkkın sonuna veya içine bir yıldız (<strong className="text-amber-400">*</strong>) koymanız yeterlidir.
              </p>

              {/* Example Code Block */}
              <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 font-mono text-xs text-zinc-200 relative">
                <div className="absolute top-2 right-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(SAMPLE_OPTION_A_DATA);
                      showToast("Örnek format panoya kopyalandı!");
                    }}
                    className="p-1 text-zinc-400 hover:text-white rounded bg-zinc-800 hover:bg-zinc-700 transition"
                    title="Kopyala"
                  >
                    <Copy size={13} />
                  </button>
                </div>
                <pre className="overflow-x-auto whitespace-pre leading-5 text-[11px] sm:text-xs">
{`Soru: She ___ to school every day.
A) go
B) goes*
C) going
D) went

Soru: What is the past tense of "buy"?
A) buyed
B) buying
C) bought*
D) boat`}
                </pre>
              </div>

              <div className="flex flex-col gap-2 text-xs text-zinc-400 bg-zinc-900/40 p-3.5 rounded-xl border border-zinc-900">
                <div className="flex items-center gap-2">
                  <Check size={14} className="text-emerald-400" />
                  <span>Şıklar <strong>A)</strong>, <strong>B)</strong>, <strong>C)</strong>, <strong>D)</strong> veya <strong>A.</strong> şeklinde yazılabilir.</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check size={14} className="text-emerald-400" />
                  <span>Doğru cevap yıldızla (<strong>*</strong>), <strong>[x]</strong> veya <strong>(doğru)</strong> ile işaretlenebilir.</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check size={14} className="text-emerald-400" />
                  <span>İsteğe bağlı olarak sorunun sonuna <strong>Cevap: B</strong> satırı da yazılabilir.</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-900">
                <button
                  onClick={handleDownloadSampleTemplate}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <Download size={14} /> Örnek Dosyayı İndir
                </button>
                <button
                  onClick={() => setShowFormatGuideModal(false)}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition"
                >
                  Anladım
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: Create or Edit Deck */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-950 rounded-3xl p-6 sm:p-8 max-w-2xl w-full border border-zinc-900 shadow-2xl flex flex-col gap-4 relative max-h-[92vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                <h3 className="text-base sm:text-lg font-bold text-white">
                  {editingDeck ? "Testi Düzenle" : "Yeni Test Ekle (Metin Yapıştır)"}
                </h3>
                <button 
                  onClick={() => { setShowCreateModal(false); setEditingDeck(null); }}
                  className="p-1.5 text-zinc-400 hover:text-white rounded-lg transition"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Title input */}
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">
                  Test Başlığı
                </label>
                <input 
                  type="text"
                  placeholder="Örn: İngilizce Zamanlar Testi"
                  value={createDeckTitle}
                  onChange={(e) => setCreateDeckTitle(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              {/* Textarea */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-zinc-300">
                    Soru ve Şık Metni (Seçenek A Formatı)
                  </label>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    previewQuestions.length > 0 
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' 
                      : 'bg-zinc-900 text-zinc-500'
                  }`}>
                    {previewQuestions.length} Soru Algılandı
                  </span>
                </div>

                <textarea
                  rows={10}
                  placeholder={`Soru: She ___ to school every day.\nA) go\nB) goes*\nC) going\nD) went\n\nSoru: What is the past tense of "buy"?\nA) buyed\nB) buying\nC) bought*\nD) boat`}
                  value={createDeckText}
                  onChange={(e) => setCreateDeckText(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-xs font-mono text-zinc-100 focus:outline-none focus:border-indigo-500 transition resize-y leading-5"
                />
              </div>

              {/* Quick Template Fill Button */}
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <button
                  type="button"
                  onClick={() => {
                    setCreateDeckTitle('Örnek İngilizce Gramer Testi');
                    setCreateDeckText(SAMPLE_OPTION_A_DATA);
                  }}
                  className="text-indigo-400 hover:text-indigo-300 underline"
                >
                  Örnek Soruları Buraya Doldur
                </button>
                <span>Doğru şık için sonuna yıldız (*) koyun.</span>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-900">
                <button
                  onClick={() => { setShowCreateModal(false); setEditingDeck(null); }}
                  className="px-4 py-2 text-zinc-400 hover:text-white rounded-xl text-xs font-semibold transition"
                >
                  İptal
                </button>
                <button
                  id="test-btn-save-modal"
                  onClick={handleSaveDeckFromModal}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition shadow-md shadow-indigo-900/30"
                >
                  {editingDeck ? "Güncelle" : "Kaydet ve Oluştur"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CONFIRM DELETE MODAL */}
      <AnimatePresence>
        {deckToDelete && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-950 rounded-2xl p-6 max-w-sm w-full border border-zinc-900 shadow-2xl flex flex-col gap-4 text-center"
            >
              <div className="w-12 h-12 rounded-full bg-rose-950/40 text-rose-400 border border-rose-900/50 flex items-center justify-center mx-auto">
                <Trash2 size={24} />
              </div>
              <h3 className="text-base font-bold text-white">Testi Sil</h3>
              <p className="text-xs text-zinc-400">
                "{deckToDelete.title}" testini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
              </p>
              <div className="flex items-center justify-center gap-3 mt-2">
                <button
                  onClick={() => setDeckToDelete(null)}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold rounded-xl transition"
                >
                  Vazgeç
                </button>
                <button
                  id="test-btn-confirm-delete"
                  onClick={() => handleDeleteDeck(deckToDelete.id)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl transition shadow-md shadow-rose-900/30"
                >
                  Evet, Sil
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
