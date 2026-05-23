import React, { useState, useEffect, useMemo, useDeferredValue } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Settings, 
  Play, 
  XCircle, 
  CheckCircle2, 
  Upload, 
  Download, 
  RefreshCw,
  Trophy,
  ChevronLeft,
  ChevronRight,
  BookmarkPlus,
  Library,
  Trash2,
  Search,
  Plus,
  Layers,
  MoreVertical,
  Edit2,
  FlipHorizontal,
  ArrowRight,
  Database,
  Copy,
  Type,
  ClipboardList,
  FileText,
  GitMerge,
  X
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { loadQuizDecks, saveQuizDecks, parseTextData, QuizItem, QuizDeck, DEFAULT_TEXT_DATA } from './dataStore';

type AppMode = 'quiz' | 'manage' | 'flashcards' | 'notes';

interface NoteSet {
  id: string;
  title: string;
  content: string;
  date: number;
}

// Utility to shuffle an array
const shuffleArray = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

interface SavedWord {
  id: string;
  word: string;
  meaning: string;
  date: number;
}

interface FlashcardDeck {
  id: string;
  title: string;
  words: SavedWord[];
  date: number;
  knownWords?: string[];
  lockedUntil?: number;
  lastRescueDateString?: string;
}

export default function App() {
  const [mode, setMode] = useState<AppMode>('quiz');

  const changeMode = (newMode: AppMode) => {
    setMode(newMode);
    setEditingQuizItemId(null);
    setEditingVocabItemId(null);
    setEditingDeckWordId(null);
    setDeleteConfirmId(null);
  };
  const [quizDecks, setQuizDecks] = useState<QuizDeck[]>(() => {
    return loadQuizDecks();
  });
  const [activeQuizDeck, setActiveQuizDeck] = useState<QuizDeck | null>(null);
  const [editingQuizDeck, setEditingQuizDeck] = useState<QuizDeck | null>(null);
  const [activeQuizDropdown, setActiveQuizDropdown] = useState<string | null>(null);
  const [editingQuizDeckTitle, setEditingQuizDeckTitle] = useState("");
  const [editingQuizDeckId, setEditingQuizDeckId] = useState<string | null>(null);
  
  const [quizItems, setQuizItems] = useState<QuizItem[]>([]);
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [shuffledOptions, setShuffledOptions] = useState<{id: string, word: string}[]>([]);
  const [score, setScore] = useState(0);
  const [errorWord, setErrorWord] = useState<string | null>(null);
  const [isSaveWordMode, setIsSaveWordMode] = useState(false);
  const [isCopyWordMode, setIsCopyWordMode] = useState(false);
  const [copyFormat, setCopyFormat] = useState<'word' | 'sentence'>('word');
  const [showCopyFormatPicker, setShowCopyFormatPicker] = useState(false);
  const [copySelectedWords, setCopySelectedWords] = useState<string[]>([]);
  const [wordToSave, setWordToSave] = useState<string | null>(null);
  const [meaningInput, setMeaningInput] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showCopyModal, setShowCopyModal] = useState(false);
  
  // Notes taking feature states
  const [isNoteMode, setIsNoteMode] = useState(false);
  const [noteFormat, setNoteFormat] = useState<'word' | 'sentence'>('word');
  const [noteSelectedWords, setNoteSelectedWords] = useState<string[]>([]);
  const [tempNoteText, setTempNoteText] = useState<string>('');
  const [showNoteSaveModal, setShowNoteSaveModal] = useState<boolean>(false);
  const [noteTitleInput, setNoteTitleInput] = useState<string>('');
  const [activeNoteSetId, setActiveNoteSetId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteTitle, setEditingNoteTitle] = useState<string>('');
  const [openNoteDropdownId, setOpenNoteDropdownId] = useState<string | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<NoteSet | null>(null);
  const [isMergingNotes, setIsMergingNotes] = useState<boolean>(false);
  const [selectedNoteSetIds, setSelectedNoteSetIds] = useState<string[]>([]);
  const [showMergeConfirmModal, setShowMergeConfirmModal] = useState<boolean>(false);
  const [mergedNoteTitle, setMergedNoteTitle] = useState<string>('');
  const [notesSearchQuery, setNotesSearchQuery] = useState<string>('');
  const [noteSaveTarget, setNoteSaveTarget] = useState<'new' | 'existing'>('new');
  const [selectedSaveNoteIds, setSelectedSaveNoteIds] = useState<string[]>([]);

  useEffect(() => {
    const handleOutsideClick = () => {
      setOpenNoteDropdownId(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => {
      window.removeEventListener('click', handleOutsideClick);
    };
  }, []);
  const [noteSets, setNoteSets] = useState<NoteSet[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('language-app-note-sets');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {
          console.error("Failed to parse note sets", e);
        }
      }
    }
    return [];
  });

  const filteredNoteSets = useMemo(() => {
    if (!notesSearchQuery.trim()) return noteSets;
    const query = notesSearchQuery.toLowerCase().trim();
    return noteSets.filter(
      set => set.title.toLowerCase().includes(query) || set.content.toLowerCase().includes(query)
    );
  }, [noteSets, notesSearchQuery]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('language-app-note-sets', JSON.stringify(noteSets));
    }
  }, [noteSets]);



  const handleExportNotes = async () => {
    try {
      const dataStr = noteSets.map(n => `=== TITLE: ${n.title} ===\n${n.content}`).join('\n\n');
      if (Capacitor.isNativePlatform()) {
        const fileName = 'notlar_yedek.txt';
        const result = await Filesystem.writeFile({
          path: fileName,
          data: dataStr,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });
        await Share.share({
          title: 'Notlar Yedeği',
          text: 'Notlarım.',
          url: result.uri,
          dialogTitle: 'Notları Paylaş / Kaydet',
        });
      } else {
        const blob = new Blob([dataStr], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'notlar_yedek.txt';
        a.click();
        URL.revokeObjectURL(url);
      }
      setToastMessage("Notlar başarıyla dışa aktarıldı!");
      setTimeout(() => setToastMessage(null), 3000);
    } catch (e) {
      console.error("Export notes failed", e);
      setToastMessage("Hata: Not dışa aktarımı başarısız oldu.");
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleImportNotes = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parts = text.split(/=== TITLE:\s*/i);
        const importedNotes: NoteSet[] = [];
        
        for (const part of parts) {
          const trimmed = part.trim();
          if (!trimmed) continue;
          
          const lineBreakIndex = trimmed.search(/\r?\n/);
          if (lineBreakIndex === -1) {
            if (trimmed) {
              let titleLine = trimmed;
              if (titleLine.endsWith('===')) {
                titleLine = titleLine.slice(0, -3).trim();
              }
              importedNotes.push({
                id: Date.now().toString() + Math.random().toString(36).substring(7),
                title: titleLine || `Not #${Date.now()}`,
                content: '',
                date: Date.now()
              });
            }
            continue;
          }
          
          let titleLine = trimmed.substring(0, lineBreakIndex).trim();
          if (titleLine.endsWith('===')) {
            titleLine = titleLine.slice(0, -3).trim();
          }
          
          const content = trimmed.substring(lineBreakIndex).trim();
          
          if (titleLine) {
            importedNotes.push({
              id: Date.now().toString() + Math.random().toString(36).substring(7),
              title: titleLine,
              content: content,
              date: Date.now()
            });
          }
        }

        if (importedNotes.length === 0 && text.trim()) {
          const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
          importedNotes.push({
            id: Date.now().toString() + Math.random().toString(36).substring(7),
            title: fileNameWithoutExt,
            content: text.trim(),
            date: Date.now()
          });
        }

        if (importedNotes.length > 0) {
          const updatedNotes = [...noteSets, ...importedNotes];
          setNoteSets(updatedNotes);
          localStorage.setItem('language-app-note-sets', JSON.stringify(updatedNotes));
          setToastMessage(`${importedNotes.length} not başarıyla içe aktarıldı!`);
          setTimeout(() => setToastMessage(null), 3000);
        } else {
          setToastMessage("Hata: Dosya içeriği boş veya geçersiz.");
          setTimeout(() => setToastMessage(null), 3000);
        }
      } catch (err) {
        console.error("Import notes failed", err);
        setToastMessage("Hata: Not yedek belgesi okunamadı.");
        setTimeout(() => setToastMessage(null), 3000);
      }
    };
    reader.readAsText(file);
  };

  const handleSaveNoteSet = () => {
    if (noteSaveTarget === 'existing') {
      if (selectedSaveNoteIds.length === 0) {
        setToastMessage("Lütfen eklemek istediğiniz en az bir set seçin.");
        setTimeout(() => setToastMessage(null), 3000);
        return;
      }
      
      const updatedNoteSets = noteSets.map(set => {
        if (selectedSaveNoteIds.includes(set.id)) {
          let updatedContent = set.content.trim();
          const appendText = tempNoteText.trim();
          if (updatedContent) {
            if (noteFormat === 'word') {
              if (updatedContent.endsWith(',')) {
                updatedContent = `${updatedContent} ${appendText}`;
              } else {
                updatedContent = `${updatedContent}, ${appendText}`;
              }
            } else {
              updatedContent = `${updatedContent} ${appendText}`;
            }
          } else {
            updatedContent = appendText;
          }
          return {
            ...set,
            content: updatedContent,
            date: Date.now()
          };
        }
        return set;
      });
      
      setNoteSets(updatedNoteSets);
      
      const selectedSets = noteSets.filter(s => selectedSaveNoteIds.includes(s.id));
      const titles = selectedSets.map(s => s.title).join(', ');
      setToastMessage(`Not başarıyla seçilen setlere (${titles}) eklendi!`);
    } else {
      const title = noteTitleInput.trim() || `Not Seti #${noteSets.length + 1}`;
      const newNote: NoteSet = {
        id: Math.random().toString(36).substring(2, 9),
        title: title,
        content: tempNoteText,
        date: Date.now()
      };
      
      setNoteSets([newNote, ...noteSets]);
      setToastMessage(`"${title}" başarıyla Notlar sekmesine kaydedildi!`);
    }

    setNoteTitleInput('');
    setTempNoteText('');
    setShowNoteSaveModal(false);
    setIsNoteMode(false);
    setNoteSelectedWords([]);
    setSelectedSaveNoteIds([]);
    setTimeout(() => setToastMessage(null), 3000);
  };
  
  const [savedVocab, setSavedVocab] = useState<SavedWord[]>(() => {
    if (typeof window !== 'undefined') {
      const storedVocab = localStorage.getItem('language-app-saved-vocab');
      if (storedVocab) {
        try {
          return JSON.parse(storedVocab);
        } catch (e) {
          console.error("Failed to parse vocab", e);
        }
      }
    }
    return [];
  });
  const [showVocabModal, setShowVocabModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [visibleCount, setVisibleCount] = useState(50);
  const [isAddingNewWord, setIsAddingNewWord] = useState(false);
  const [newManualWord, setNewManualWord] = useState({ word: '', meaning: '' });
  const [showClearVocabConfirm, setShowClearVocabConfirm] = useState(false);
  const [showClearQuizDataConfirm, setShowClearQuizDataConfirm] = useState(false);


  const [decks, setDecks] = useState<FlashcardDeck[]>(() => {
    if (typeof window !== 'undefined') {
      const storedDecks = localStorage.getItem('language-app-decks');
      if (storedDecks) {
        try {
          return JSON.parse(storedDecks);
        } catch (e) {
          console.error("Failed to parse decks", e);
        }
      }
    }
    return [];
  });



  const [activeDeck, setActiveDeck] = useState<FlashcardDeck | null>(null);
  const [activeDeckTab, setActiveDeckTab] = useState<'test' | 'words'>('test');
  const [deckWordsSearch, setDeckWordsSearch] = useState("");
  const [wordStatusFilter, setWordStatusFilter] = useState<'unknown' | 'known'>('unknown');
  const [sessionWords, setSessionWords] = useState<SavedWord[]>([]);
  const [sessionTotalCount, setSessionTotalCount] = useState<number>(0);
  const [sessionHistory, setSessionHistory] = useState<{word: SavedWord, action: 'left' | 'right' | 'next'}[]>([]);
  const [viewingPastIndex, setViewingPastIndex] = useState(0);

  // Gamification tracking states

  const [wordCorrectCount, setWordCorrectCount] = useState<Record<string, number>>(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('language-app-word-correct-counts');
        return stored ? JSON.parse(stored) : {};
      }
    } catch (e) {
      console.error("Failed to load wordCorrectCount from localStorage", e);
    }
    return {};
  });


  const isNavigating = React.useRef(false);
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [editingDeckId, setEditingDeckId] = useState<string | null>(null);
  const [editingDeckTitle, setEditingDeckTitle] = useState("");
  const [editingFlashcardDeck, setEditingFlashcardDeck] = useState<FlashcardDeck | null>(null);
  const [deckEditorSearch, setDeckEditorSearch] = useState("");
  const [deckEditorNewWord, setDeckEditorNewWord] = useState({ word: "", meaning: "" });
  
  const [quizEditorSearch, setQuizEditorSearch] = useState("");
  const [quizEditorNewWord, setQuizEditorNewWord] = useState({ word: "", meaning: "" });
  const [showClearDeckConfirm, setShowClearDeckConfirm] = useState(false);
  
  const [editingQuizItemId, setEditingQuizItemId] = useState<string | null>(null);
  const [quizItemEditLeft, setQuizItemEditLeft] = useState("");
  const [quizItemEditRight, setQuizItemEditRight] = useState("");

  const [editingVocabItemId, setEditingVocabItemId] = useState<string | null>(null);
  const [vocabItemEditLeft, setVocabItemEditLeft] = useState("");
  const [vocabItemEditRight, setVocabItemEditRight] = useState("");

  const [editingDeckWordId, setEditingDeckWordId] = useState<string | null>(null);
  const [deckWordEditLeft, setDeckWordEditLeft] = useState("");
  const [deckWordEditRight, setDeckWordEditRight] = useState("");

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);


  // Initialize data is now handled synchronously in useState initializer to prevent initial blank flash

  // Persist wordCorrectCount to localStorage whenever it changes
  useEffect(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('language-app-word-correct-counts', JSON.stringify(wordCorrectCount));
      }
    } catch (e) {
      console.error("Failed to save wordCorrectCount to localStorage", e);
    }
  }, [wordCorrectCount]);

  // Persist current active session whenever its states change, or clear if completed
  useEffect(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        if (activeDeck) {
          if (sessionWords.length === 0) {
            // Section finished, clear saved session so next click starts next chunk
            localStorage.removeItem(`language-app-session-${activeDeck.id}`);
          } else {
            const dataToSave = {
              sessionWords,
              sessionTotalCount,
              sessionHistory,
            };
            localStorage.setItem(`language-app-session-${activeDeck.id}`, JSON.stringify(dataToSave));
          }
        }
      }
    } catch (e) {
      console.error("Failed to handle session persistence", e);
    }
  }, [activeDeck, sessionWords, sessionTotalCount, sessionHistory]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: Event) => {
      const target = event.target as HTMLElement;
      
      if (activeQuizDropdown) {
        const closestContainer = target.closest('.quiz-dropdown-container');
        if (!closestContainer) {
          setActiveQuizDropdown(null);
        }
      }
      
      if (activeDropdown) {
        const closestContainer = target.closest('.flashcard-dropdown-container');
        if (!closestContainer) {
          setActiveDropdown(null);
        }
      }
    };

    document.addEventListener('pointerdown', handleClickOutside, true);
    document.addEventListener('touchstart', handleClickOutside, true);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside, true);
      document.removeEventListener('touchstart', handleClickOutside, true);
    };
  }, [activeQuizDropdown, activeDropdown]);

  useEffect(() => {
    if (activeQuizDeck) {
      const parsed = parseTextData(activeQuizDeck.dataText);
      if (parsed.length > 0) {
        setQuizItems(shuffleArray(parsed));
      } else {
        setQuizItems([]);
      }
      setCurrentQuestionIndex(0);
      setScore(0);
    } else {
      setQuizItems([]);
    }
  }, [activeQuizDeck]);

  useEffect(() => {
    setVisibleCount(50);
  }, [deferredSearchQuery]);

  const filteredVocab = useMemo(() => {
    if (!deferredSearchQuery.trim()) return savedVocab;
    const lowerQ = deferredSearchQuery.toLowerCase();
    return savedVocab.filter(item => 
      item.word.toLowerCase().includes(lowerQ) || 
      item.meaning.toLowerCase().includes(lowerQ)
    );
  }, [savedVocab, deferredSearchQuery]);

  const currentItem = quizItems[currentQuestionIndex];

  // Set up question when currentItem changes
  useEffect(() => {
    if (currentItem) {
      setShuffledOptions(
        shuffleArray(currentItem.englishWords).map((word, index) => ({ id: `${index}-${word}`, word }))
      );
      setSelectedWords([]);
      setErrorWord(null);
    }
  }, [currentItem]);

  const handleClearQuizData = () => {
    if (!editingQuizDeck) return;
    const updated = { ...editingQuizDeck, dataText: "" };
    const updatedDecks = quizDecks.map(d => d.id === updated.id ? updated : d);
    setQuizDecks(updatedDecks);
    saveQuizDecks(updatedDecks);
    setEditingQuizDeck(updated);
    setShowClearQuizDataConfirm(false);
  };

  const handleExportQuizDeck = async (deck: QuizDeck) => {
    try {
      if (Capacitor.isNativePlatform()) {
        const fileName = `${deck.title.replace(/[\s/\\?%*:|"<>\.]/g, '_')}_quiz_data.txt`;
        
        // Write file to device cache
        const result = await Filesystem.writeFile({
          path: fileName,
          data: deck.dataText,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });

        // Share the file (which allows saving to files, sending via apps, etc.)
        await Share.share({
          title: 'Offline English Quiz Data',
          text: `Here is your quiz sentence data for ${deck.title}.`,
          url: result.uri,
          dialogTitle: 'Veriyi Paylaş / Kaydet',
        });
      } else {
        const blob = new Blob([deck.dataText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${deck.title.replace(/[\s/\\?%*:|"<>\.]/g, '_')}_quiz_data.txt`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error("Export failed", e);
      setToastMessage("Hata: Dışa aktarım başarısız oldu.");
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleFullAppExport = async () => {
    try {
      const dbExport = {
        "language-app-quiz-decks": typeof localStorage !== 'undefined' ? (localStorage.getItem("language-app-quiz-decks") || "[]") : "[]",
        "language-app-saved-vocab": typeof localStorage !== 'undefined' ? (localStorage.getItem("language-app-saved-vocab") || "[]") : "[]",
        "language-app-decks": typeof localStorage !== 'undefined' ? (localStorage.getItem("language-app-decks") || "[]") : "[]",
        "language-app-note-sets": typeof localStorage !== 'undefined' ? (localStorage.getItem("language-app-note-sets") || "[]") : "[]"
      };

      const jsonStr = JSON.stringify(dbExport, null, 2);

      if (Capacitor.isNativePlatform()) {
        const fileName = 'offline_english_backup.json';
        const result = await Filesystem.writeFile({
          path: fileName,
          data: jsonStr,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });
        await Share.share({
          title: 'Tüm Uygulama Yedeği',
          text: 'Tüm ayarlar, sözlükler ve kelimeler.',
          url: result.uri,
          dialogTitle: 'Yedeği Paylaş / Kaydet',
        });
      } else {
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'offline_english_backup.json';
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error("Full app export failed", e);
      setToastMessage("Hata: Yedekleme dışa aktarımı başarısız oldu.");
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleImportQuizDeck = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const deckTitle = file.name.replace(/\.txt$/, '') || "Yeni Quiz Seti";
        const newDeck: QuizDeck = {
          id: Date.now().toString(),
          title: deckTitle,
          dataText: content,
          date: Date.now()
        };
        const updatedDecks = [newDeck, ...quizDecks];
        setQuizDecks(updatedDecks);
        saveQuizDecks(updatedDecks);
        setToastMessage(`"${deckTitle}" başarıyla içe aktarıldı!`);
        setTimeout(() => setToastMessage(null), 3000);
      }
    };
    reader.readAsText(file);
  };

  const handleFullAppImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const jsonStr = event.target?.result as string;
        const data = JSON.parse(jsonStr);

        if (data["language-app-quiz-decks"] !== undefined) {
          localStorage.setItem("language-app-quiz-decks", data["language-app-quiz-decks"]);
          setQuizDecks(JSON.parse(data["language-app-quiz-decks"]));
        } else if (data["english_app_data"] !== undefined) {
          const legacyDecks = [{ id: 'legacy-app-data', title: 'Yedeklenen Quiz Seti', dataText: data["english_app_data"], date: Date.now() }];
          localStorage.setItem("language-app-quiz-decks", JSON.stringify(legacyDecks));
          setQuizDecks(legacyDecks);
        }

        if (data["language-app-saved-vocab"] !== undefined) {
          localStorage.setItem("language-app-saved-vocab", data["language-app-saved-vocab"]);
          setSavedVocab(JSON.parse(data["language-app-saved-vocab"]));
        }

        if (data["language-app-decks"] !== undefined) {
          localStorage.setItem("language-app-decks", data["language-app-decks"]);
          setDecks(JSON.parse(data["language-app-decks"]));
        }

        if (data["language-app-note-sets"] !== undefined) {
          localStorage.setItem("language-app-note-sets", data["language-app-note-sets"]);
          setNoteSets(JSON.parse(data["language-app-note-sets"]));
        }

        setToastMessage("Yedek başarıyla yüklendi!");
        setTimeout(() => setToastMessage(null), 3000);
      } catch (err) {
        console.error("Full app import failed", err);
        setToastMessage("Hata: Geçersiz yedek dosyası.");
        setTimeout(() => setToastMessage(null), 3000);
      }
    };
    reader.readAsText(file);
  };

  const handleImportDeck = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/);
        const importedData: SavedWord[] = [];
        
        for (const line of lines) {
           const trimmedLine = line.trim();
           if (!trimmedLine) continue;
           
           const separatorMatch = trimmedLine.match(/(=|-|:)/);
           if (!separatorMatch) continue;
           
           const sepIndex = trimmedLine.indexOf(separatorMatch[0]);
           const word = trimmedLine.substring(0, sepIndex).trim();
           const meaning = trimmedLine.substring(sepIndex + 1).trim();
           
           if (word && meaning) {
             importedData.push({
               id: Date.now().toString() + Math.random().toString(36).substring(7),
               word,
               meaning,
               date: Date.now()
             });
           }
        }

        if (importedData.length > 0) {
           const defaultTitle = file.name.replace('.txt', '').replace(/_/g, ' ');
           const newDeck: FlashcardDeck = {
             id: Date.now().toString(),
             title: defaultTitle,
             words: importedData,
             date: Date.now()
           };
           const updatedDecks = [newDeck, ...decks];
           setDecks(updatedDecks);
           localStorage.setItem('language-app-decks', JSON.stringify(updatedDecks));
           setToastMessage(`Sözlük (${importedData.length} kelime) flashcard'lara eklendi!`);
           setTimeout(() => setToastMessage(null), 3000);
        } else {
           setToastMessage("Hata: Geçerli kelime bulunamadı ('Kelime = Anlamı').");
           setTimeout(() => setToastMessage(null), 3000);
        }
      } catch (err) {
        console.error("Import error", err);
        setToastMessage("Hata: Geçersiz format veya bozuk veri!");
        setTimeout(() => setToastMessage(null), 3000);
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleCreateDeckFromMain = () => {
    if (savedVocab.length === 0) {
      setToastMessage("Hata: Ana sözlüğünüz boş!");
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }
    const deckTitle = "Ana Sözlüğüm" + (decks.length > 0 ? ` ${decks.length + 1}` : "");
    const newDeck: FlashcardDeck = {
      id: Date.now().toString(),
      title: deckTitle,
      words: [...savedVocab],
      date: Date.now()
    };
    const updatedDecks = [newDeck, ...decks];
    setDecks(updatedDecks);
    localStorage.setItem('language-app-decks', JSON.stringify(updatedDecks));
    setToastMessage("Ana sözlük flashcard'lara eklendi!");
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleExportDeck = async (deck: FlashcardDeck) => {
    try {
      const dataStr = deck.words.map(v => `${v.word} = ${v.meaning}`).join('\n');
      if (Capacitor.isNativePlatform()) {
        const fileName = `${deck.title.replace(/\s+/g, '_')}.txt`;
        const result = await Filesystem.writeFile({
          path: fileName,
          data: dataStr,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });
        await Share.share({
          title: 'Sözlük Yedeği',
          text: `${deck.title} sözlük yedeği.`,
          url: result.uri,
          dialogTitle: 'Sözlüğü Paylaş / Kaydet',
        });
      } else {
        const blob = new Blob([dataStr], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${deck.title.replace(/\s+/g, '_')}.txt`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error("Export deck failed", e);
      setToastMessage("Hata: Sözlük dışa aktarımı başarısız oldu.");
      setTimeout(() => setToastMessage(null), 3000);
    }
    setActiveDropdown(null);
  };

  const handleEditDeckTitle = (deckId: string) => {
    const deck = decks.find(d => d.id === deckId);
    if (!deck) return;
    setEditingDeckId(deckId);
    setEditingDeckTitle(deck.title);
    setActiveDropdown(null);
  };

  const saveDeckTitle = (deckId: string) => {
    if (editingDeckTitle.trim() !== "") {
      const updatedDecks = decks.map(d => d.id === deckId ? { ...d, title: editingDeckTitle.trim() } : d);
      setDecks(updatedDecks);
      localStorage.setItem('language-app-decks', JSON.stringify(updatedDecks));
    }
    setEditingDeckId(null);
  };

   const parsedQuizData = useMemo(() => {
    if (!editingQuizDeck) return [];
    const allLines = editingQuizDeck.dataText.split(/\r?\n/);
    const results = [];
    for (let i = 0; i < allLines.length; i++) {
      const line = allLines[i];
      if (line.trim().length === 0) continue;
      const match = line.match(/(=|-|:)/);
      if (!match) {
        results.push({
          id: `q-${i}`,
          originalIndex: i,
          line,
          valid: false,
          left: line,
          right: ''
        });
      } else {
        const sepIndex = line.indexOf(match[0]);
        results.push({
          id: `q-${i}`,
          originalIndex: i,
          line,
          valid: true,
          left: line.substring(0, sepIndex).trim(),
          right: line.substring(sepIndex + 1).trim()
        });
      }
    }
    return results;
  }, [editingQuizDeck]);

  const handleDeleteQuizItem = (originalIndex: number) => {
    if (!editingQuizDeck) return;
    const lines = editingQuizDeck.dataText.split(/\r?\n/);
    lines.splice(originalIndex, 1);
    const updated = { ...editingQuizDeck, dataText: lines.join('\n') };
    const updatedDecks = quizDecks.map(d => d.id === updated.id ? updated : d);
    setQuizDecks(updatedDecks);
    saveQuizDecks(updatedDecks);
    setEditingQuizDeck(updated);
    if (editingQuizItemId === `q-${originalIndex}`) {
      setEditingQuizItemId(null);
    }
  };

  const handleStartQuizItemEdit = (item: { id: string, originalIndex: number, left: string, right: string }) => {
    setEditingQuizItemId(item.id);
    setQuizItemEditLeft(item.left);
    setQuizItemEditRight(item.right);
  };

  const handleSaveQuizItem = (originalIndex: number) => {
    if (!editingQuizDeck) return;
    const leftText = quizItemEditLeft.trim();
    const rightText = quizItemEditRight.trim();
    if (!leftText || !rightText) return;

    const lines = editingQuizDeck.dataText.split(/\r?\n/);
    const originalLine = lines[originalIndex] || "";
    const match = originalLine.match(/(=|-|:)/);
    const separator = match ? match[0] : "=";

    lines[originalIndex] = `${leftText} ${separator} ${rightText}`;

    const updated = { ...editingQuizDeck, dataText: lines.join('\n') };
    const updatedDecks = quizDecks.map(d => d.id === updated.id ? updated : d);
    setQuizDecks(updatedDecks);
    saveQuizDecks(updatedDecks);
    setEditingQuizDeck(updated);
    setEditingQuizItemId(null);
  };

  const handleStartVocabEdit = (item: SavedWord) => {
    setEditingVocabItemId(item.id);
    setVocabItemEditLeft(item.word);
    setVocabItemEditRight(item.meaning);
  };

  const handleSaveVocabWord = (wordId: string) => {
    const leftText = vocabItemEditLeft.trim();
    const rightText = vocabItemEditRight.trim();
    if (!leftText || !rightText) return;

    const updatedVocab = savedVocab.map(v => 
      v.id === wordId ? { ...v, word: leftText, meaning: rightText } : v
    );
    setSavedVocab(updatedVocab);
    localStorage.setItem('language-app-saved-vocab', JSON.stringify(updatedVocab));
    setEditingVocabItemId(null);
  };

  const handleStartDeckWordEdit = (item: SavedWord) => {
    setEditingDeckWordId(item.id);
    setDeckWordEditLeft(item.word);
    setDeckWordEditRight(item.meaning);
  };

  const handleSaveDeckWordEdit = (wordId: string) => {
    if (!editingFlashcardDeck) return;
    const leftText = deckWordEditLeft.trim();
    const rightText = deckWordEditRight.trim();
    if (!leftText || !rightText) return;

    const updatedWords = editingFlashcardDeck.words.map(w => 
      w.id === wordId ? { ...w, word: leftText, meaning: rightText } : w
    );
    const updatedDeck = {
      ...editingFlashcardDeck,
      words: updatedWords
    };
    const updatedDecks = decks.map(d => d.id === updatedDeck.id ? updatedDeck : d);
    setDecks(updatedDecks);
    setEditingFlashcardDeck(updatedDeck);
    localStorage.setItem('language-app-decks', JSON.stringify(updatedDecks));
    setEditingDeckWordId(null);
  };

  const handleAddQuizItem = () => {
    if (!editingQuizDeck) return;
    if (!quizEditorNewWord.word.trim() || !quizEditorNewWord.meaning.trim()) return;
    const newLine = `${quizEditorNewWord.word.trim()} = ${quizEditorNewWord.meaning.trim()}`;
    const newText = editingQuizDeck.dataText.trim().length > 0 ? `${editingQuizDeck.dataText}\n${newLine}` : newLine;
    const updated = { ...editingQuizDeck, dataText: newText };
    const updatedDecks = quizDecks.map(d => d.id === updated.id ? updated : d);
    setQuizDecks(updatedDecks);
    saveQuizDecks(updatedDecks);
    setEditingQuizDeck(updated);
    setQuizEditorNewWord({ word: '', meaning: '' });
  };
  const handleDeleteDeck = (deckId: string) => {
    const updatedDecks = decks.filter(d => d.id !== deckId);
    setDecks(updatedDecks);
    localStorage.setItem('language-app-decks', JSON.stringify(updatedDecks));
    setToastMessage("Sözlük silindi.");
    setTimeout(() => setToastMessage(null), 3000);
    setActiveDropdown(null);
  };

  const handleEditQuizDeckTitle = (deckId: string) => {
    const d = quizDecks.find(d => d.id === deckId);
    if (d) {
      setEditingQuizDeckId(deckId);
      setEditingQuizDeckTitle(d.title);
      setActiveQuizDropdown(null);
    }
  };

  const saveQuizDeckTitle = (deckId: string) => {
    if (!editingQuizDeckTitle.trim()) {
      setEditingQuizDeckId(null);
      return;
    }
    const updatedDecks = quizDecks.map(d => 
      d.id === deckId ? { ...d, title: editingQuizDeckTitle.trim() } : d
    );
    setQuizDecks(updatedDecks);
    saveQuizDecks(updatedDecks);
    setEditingQuizDeckId(null);
  };

  const handleDeleteQuizDeck = (deckId: string) => {
    const updatedDecks = quizDecks.filter(d => d.id !== deckId);
    setQuizDecks(updatedDecks);
    saveQuizDecks(updatedDecks);
    setToastMessage("Quiz seti silindi.");
    setTimeout(() => setToastMessage(null), 3000);
    setActiveQuizDropdown(null);
  };

  const handleSaveDeckWord = () => {
    if (!editingFlashcardDeck || !deckEditorNewWord.word.trim() || !deckEditorNewWord.meaning.trim()) return;
    const newWord: SavedWord = {
      id: Date.now().toString(),
      word: deckEditorNewWord.word.trim(),
      meaning: deckEditorNewWord.meaning.trim(),
      date: Date.now()
    };
    
    const updatedDeck = {
      ...editingFlashcardDeck,
      words: [newWord, ...editingFlashcardDeck.words]
    };
    
    const updatedDecks = decks.map(d => d.id === updatedDeck.id ? updatedDeck : d);
    setDecks(updatedDecks);
    setEditingFlashcardDeck(updatedDeck);
    localStorage.setItem('language-app-decks', JSON.stringify(updatedDecks));
    setDeckEditorNewWord({ word: '', meaning: '' });
  };
  
  const handleDeleteDeckWord = (wordId: string) => {
    if (!editingFlashcardDeck) return;
    const updatedDeck = {
      ...editingFlashcardDeck,
      words: editingFlashcardDeck.words.filter(w => w.id !== wordId)
    };
    const updatedDecks = decks.map(d => d.id === updatedDeck.id ? updatedDeck : d);
    setDecks(updatedDecks);
    setEditingFlashcardDeck(updatedDeck);
    localStorage.setItem('language-app-decks', JSON.stringify(updatedDecks));
  };
  
  const handleClearDeckWords = () => {
    if (!editingFlashcardDeck) return;
    const updatedDeck = { ...editingFlashcardDeck, words: [] };
    const updatedDecks = decks.map(d => d.id === updatedDeck.id ? updatedDeck : d);
    setDecks(updatedDecks);
    setEditingFlashcardDeck(updatedDeck);
    localStorage.setItem('language-app-decks', JSON.stringify(updatedDecks));
    setShowClearDeckConfirm(false);
  };

  const startFlashcardSession = (deck: FlashcardDeck, forceReset = false) => {
    const freshDeck = decks.find(d => d.id === deck.id) || deck;
    if (freshDeck.words.length === 0) {
      setToastMessage("Uyarı: Bu sözlükte kelime yok!");
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    // Attempt to load and resume an existing saved session
    const savedSessionStr = localStorage.getItem(`language-app-session-${freshDeck.id}`);
    if (!forceReset && savedSessionStr) {
      try {
        const savedSession = JSON.parse(savedSessionStr);
        if (savedSession && savedSession.sessionWords && savedSession.sessionWords.length > 0) {
          // Double check to ensure the words still exist in the current deck to avoid inconsistencies
          const validSessionWords = savedSession.sessionWords.filter((sw: any) => 
            freshDeck.words.some((w: any) => w.id === sw.id)
          );
          if (validSessionWords.length > 0) {
            setSessionWords(validSessionWords);
            setSessionTotalCount(savedSession.sessionTotalCount || validSessionWords.length);
            setSessionHistory(savedSession.sessionHistory || []);
            setViewingPastIndex(0);
            setFlashcardFlipped(false);
            setActiveDropdown(null);
            setActiveDeckTab('test');
            setDeckWordsSearch("");
            setWordStatusFilter('unknown');
            setActiveDeck(freshDeck);

            // Load saved correct counts
            const savedCounts = localStorage.getItem('language-app-word-correct-counts');
            if (savedCounts) {
              setWordCorrectCount(JSON.parse(savedCounts));
            }
            
            setToastMessage("Önceki oturumunuz kaldığı yerden yüklendi!");
            setTimeout(() => setToastMessage(null), 3000);
            return;
          }
        }
      } catch (err) {
        console.error("Failed to parse saved session", err);
      }
    }

    let wordsToLearn = freshDeck.words;
    if (!forceReset && freshDeck.knownWords && freshDeck.knownWords.length > 0) {
      wordsToLearn = freshDeck.words.filter(w => !freshDeck.knownWords?.includes(w.id));
    }

    if (wordsToLearn.length === 0 || forceReset) {
      setToastMessage(forceReset ? "Sözlük sıfırlandı ve baştan başlıyor!" : "Harika! Tüm kelimeleri öğrenmişsiniz. Baştan başlıyor!");
      setTimeout(() => setToastMessage(null), 3000);
      wordsToLearn = freshDeck.words;
      // Reset progress
      const updatedDecks = decks.map(d => d.id === freshDeck.id ? { ...d, knownWords: [] } : d);
      setDecks(updatedDecks);
      localStorage.setItem('language-app-decks', JSON.stringify(updatedDecks));
      // Reset knownWords reference for active status
      freshDeck.knownWords = [];

      // Clear the saved session for this deck
      localStorage.removeItem(`language-app-session-${freshDeck.id}`);

      // Reset word progress scores in wordCorrectCount for this deck's words
      setWordCorrectCount(prev => {
        const updated = { ...prev };
        freshDeck.words.forEach(w => {
          updated[w.id] = 0;
        });
        localStorage.setItem('language-app-word-correct-counts', JSON.stringify(updated));
        return updated;
      });
    }

    const totalAvailableToLearn = wordsToLearn.length;
    const isChunked = totalAvailableToLearn > 35;
    const chunkWords = isChunked ? wordsToLearn.slice(0, 35) : wordsToLearn;

    // Initialize progress stats safely for new words in this session (don't overwrite existing scores)
    setWordCorrectCount(prev => {
      const updated = { ...prev };
      chunkWords.forEach(w => {
        if (updated[w.id] === undefined) {
          updated[w.id] = 0;
        }
      });
      localStorage.setItem('language-app-word-correct-counts', JSON.stringify(updated));
      return updated;
    });

    if (isChunked && !forceReset) {
      setToastMessage(`Büyük set modu: Sıradaki 35 kelimelik parça yüklendi! (Kalan: ${totalAvailableToLearn - 35} kelime)`);
      setTimeout(() => setToastMessage(null), 4000);
    }

    setActiveDeck(freshDeck);
    setSessionWords(shuffleArray([...chunkWords]));
    setSessionTotalCount(chunkWords.length);
    setSessionHistory([]);
    setViewingPastIndex(0);
    setFlashcardFlipped(false);
    setActiveDropdown(null);
    setActiveDeckTab('test');
    setDeckWordsSearch("");
    setWordStatusFilter('unknown');
  };

  const toggleWordKnownStatus = (deckId: string, wordId: string, makeKnown: boolean) => {
    setDecks(currentDecks => {
      const updated = currentDecks.map(d => {
        if (d.id === deckId) {
          let newKnown = d.knownWords || [];
          if (makeKnown) {
            newKnown = Array.from(new Set([...newKnown, wordId]));
          } else {
            newKnown = newKnown.filter(id => id !== wordId);
          }
          return { ...d, knownWords: newKnown };
        }
        return d;
      });
      localStorage.setItem('language-app-decks', JSON.stringify(updated));
      return updated;
    });

    if (makeKnown) {
      setSessionWords(prev => prev.filter(w => w.id !== wordId));
    } else {
      const targetDeck = decks.find(d => d.id === deckId);
      const wordObj = targetDeck?.words.find(w => w.id === wordId);
      if (wordObj) {
        setSessionWords(prev => {
          if (prev.some(w => w.id === wordId)) return prev;
          return [wordObj, ...prev];
        });
      }
    }
  };

  const handleStartQuizSession = (deck: QuizDeck) => {
    const parsed = parseTextData(deck.dataText);
    setQuizItems(shuffleArray(parsed));
    setCurrentQuestionIndex(0);
    setScore(0);
    setActiveQuizDeck(deck);
  };

  const handlePrevCard = () => {
    if (isNavigating.current) return;
    if (viewingPastIndex >= sessionHistory.length) {
      setToastMessage("Önceki kelime bulunamadı.");
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }
    
    setViewingPastIndex(prev => prev + 1);
    setFlashcardFlipped(false);
  };

  const handleNextCard = () => {
    if (isNavigating.current) return;
    
    if (viewingPastIndex > 0) {
      setViewingPastIndex(prev => prev - 1);
      setFlashcardFlipped(false);
      return;
    }

    if (sessionWords.length <= 1) return;
    isNavigating.current = true;
    
    const currentWord = sessionWords[0];
    setSessionHistory(h => [...h, { word: currentWord, action: 'next' }]);

    setFlashcardFlipped(false);
    setTimeout(() => {
      setSessionWords(prev => {
        const rest = prev.filter(w => w.id !== currentWord.id);
        return [...rest, currentWord];
      });
      isNavigating.current = false;
    }, 150);
  };

  const handleSwipeLeft = () => {
    if (viewingPastIndex > 0) return;
    if (isNavigating.current || sessionWords.length === 0) return;
    isNavigating.current = true;
    
    const currentWord = sessionWords[0];
    setSessionHistory(h => [...h, { word: currentWord, action: 'left' }]);
    
    // Calculate new stats
    const currentCorrect = (wordCorrectCount[currentWord.id] ?? 0) + 1;
    
    setWordCorrectCount(prev => ({ ...prev, [currentWord.id]: currentCorrect }));

    // If correct count reaches 3, add to knownWords
    if (currentCorrect >= 3) {
      if (activeDeck) {
        setDecks(currentDecks => {
          const updated = currentDecks.map(d => {
            if (d.id === activeDeck.id) {
              const newKnown = Array.from(new Set([...(d.knownWords || []), currentWord.id]));
              return { ...d, knownWords: newKnown };
            }
            return d;
          });
          localStorage.setItem('language-app-decks', JSON.stringify(updated));
          return updated;
        });
      }
    }

    setFlashcardFlipped(false);
    setTimeout(() => {
      if (currentCorrect >= 3) {
        // Remove permanently from session (learned)
        setSessionWords(prev => prev.filter(w => w.id !== currentWord.id));
      } else {
        // Move to the end of the list to be repeated
        setSessionWords(prev => {
          const rest = prev.filter(w => w.id !== currentWord.id);
          return [...rest, currentWord];
        });
      }
      isNavigating.current = false;
    }, 150);
  };

  const handleSwipeRight = () => {
    if (viewingPastIndex > 0) return;
    if (isNavigating.current || sessionWords.length === 0) return;
    isNavigating.current = true;
    
    const currentWord = sessionWords[0];
    setSessionHistory(h => [...h, { word: currentWord, action: 'right' }]);

    // Calculate new stats
    const currentCorrect = 0; // reset correct progress to 0 on mistake

    setWordCorrectCount(prev => ({ ...prev, [currentWord.id]: currentCorrect }));

    setFlashcardFlipped(false);
    setTimeout(() => {
      // Keep in session and move to the end of the list to be repeated
      setSessionWords(prev => {
        const rest = prev.filter(w => w.id !== currentWord.id);
        return [...rest, currentWord];
      });
      isNavigating.current = false;
    }, 150);
  };





  const handleSaveCustomWord = () => {
    if (!wordToSave || !meaningInput.trim()) return;

    const newVocabItem: SavedWord = {
      id: Date.now().toString(),
      word: wordToSave,
      meaning: meaningInput.trim(),
      date: Date.now()
    };
    
    const updatedVocab = [newVocabItem, ...savedVocab];
    setSavedVocab(updatedVocab);
    localStorage.setItem('language-app-saved-vocab', JSON.stringify(updatedVocab));
    
    setWordToSave(null);
    setMeaningInput('');
    setToastMessage(`"${wordToSave}" sözlüğünüze eklendi!`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleClearVocab = () => {
    setSavedVocab([]);
    localStorage.removeItem('language-app-saved-vocab');
    setShowClearVocabConfirm(false);
    setToastMessage("Sözlükteki tüm kelimeler silindi.");
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSaveManualWord = () => {
    if (!newManualWord.word.trim() || !newManualWord.meaning.trim()) return;

    const newVocabItem: SavedWord = {
      id: Date.now().toString(),
      word: newManualWord.word.trim(),
      meaning: newManualWord.meaning.trim(),
      date: Date.now()
    };
    
    // Check if word already exists
    const exists = savedVocab.find(v => v.word.toLowerCase() === newVocabItem.word.toLowerCase());
    if (exists) {
      setToastMessage("Uyarı: Bu kelime zaten sözlüğünüzde var!");
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }
    
    const updatedVocab = [newVocabItem, ...savedVocab];
    setSavedVocab(updatedVocab);
    localStorage.setItem('language-app-saved-vocab', JSON.stringify(updatedVocab));
    
    setNewManualWord({ word: '', meaning: '' });
    setIsAddingNewWord(false);
    setToastMessage(`"${newVocabItem.word}" sözlüğünüze eklendi!`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleDeleteVocab = (id: string) => {
    const updatedVocab = savedVocab.filter(v => v.id !== id);
    setSavedVocab(updatedVocab);
    localStorage.setItem('language-app-saved-vocab', JSON.stringify(updatedVocab));
  };

  const handleExportVocab = async () => {
    try {
      const dataStr = savedVocab.map(v => `${v.word} = ${v.meaning}`).join('\n');
      if (Capacitor.isNativePlatform()) {
        const fileName = 'sozluk_yedek.txt';
        const result = await Filesystem.writeFile({
          path: fileName,
          data: dataStr,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });
        await Share.share({
          title: 'Sözlük Yedeği',
          text: 'Kelime sözlüğüm.',
          url: result.uri,
          dialogTitle: 'Sözlüğü Paylaş / Kaydet',
        });
      } else {
        const blob = new Blob([dataStr], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sozluk_yedek.txt';
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error("Export vocab failed", e);
      setToastMessage("Hata: Sözlük dışa aktarımı başarısız oldu.");
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleImportVocab = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        // Handle different line endings
        const lines = text.split(/\r?\n/);
        const importedData: SavedWord[] = [];
        
        for (const line of lines) {
           const trimmedLine = line.trim();
           if (!trimmedLine) continue;
           
           // Accept '=', '-', or ':' as separators
           const separatorMatch = trimmedLine.match(/(=|-|:)/);
           if (!separatorMatch) continue;
           
           const sepIndex = trimmedLine.indexOf(separatorMatch[0]);
           const word = trimmedLine.substring(0, sepIndex).trim();
           const meaning = trimmedLine.substring(sepIndex + 1).trim();
           
           if (word && meaning) {
             importedData.push({
               id: Date.now().toString() + Math.random().toString(36).substring(7),
               word,
               meaning,
               date: Date.now()
             });
           }
        }

        if (importedData.length > 0) {
           // Merge and deduplicate by word (case-insensitive) to prevent duplicates
           const combined = [...importedData, ...savedVocab];
           const uniqueMap = new Map();
           for (const item of combined) {
             if (item && item.word && typeof item.word === 'string') {
               const key = item.word.toLowerCase();
               if (!uniqueMap.has(key)) {
                 uniqueMap.set(key, item);
               }
             }
           }
           const unique = Array.from(uniqueMap.values());
           setSavedVocab(unique);
           localStorage.setItem('language-app-saved-vocab', JSON.stringify(unique));
           
           setToastMessage(`${importedData.length} kelime başarıyla içe aktarıldı!`);
           setTimeout(() => setToastMessage(null), 3000);
        } else {
           alert("TXT dosyasında geçerli kelime bulunamadı. Beklenen format: 'Kelime = Anlamı'");
        }
      } catch (err) {
        console.error("Import error", err);
        alert("Geçersiz dosya formatı veya bozuk veri!");
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleWordSelect = (word: string, id: string) => {
    if (!currentItem) return;
    
    if (isSaveWordMode) {
      setWordToSave(word);
      setIsSaveWordMode(false);
      setMeaningInput('');
      return;
    }

    if (isNoteMode) {
      if (noteSelectedWords.includes(word)) {
        setNoteSelectedWords(noteSelectedWords.filter(w => w !== word));
      } else {
        setNoteSelectedWords([...noteSelectedWords, word]);
      }
      return;
    }

    // Determine the next expected word
    const nextExpectedWord = currentItem.englishWords[selectedWords.length];

    if (word === nextExpectedWord) {
      const newSelected = [...selectedWords, word];
      setSelectedWords(newSelected);
      setErrorWord(null);

      // Remove from shuffled options correctly
      const newShuffled = shuffledOptions.filter(opt => opt.id !== id);
      setShuffledOptions(newShuffled);

      // Check if finished
      if (newSelected.length === currentItem.englishWords.length) {
        setScore(s => s + 10);
        setTimeout(() => {
          if (currentQuestionIndex + 1 < quizItems.length) {
            setCurrentQuestionIndex(i => i + 1);
          } else {
            // Loop back or show finished state
            setToastMessage("Harika! Tüm soruları tamamladın!");
            setTimeout(() => setToastMessage(null), 3000);
            setQuizItems(shuffleArray(quizItems));
            setCurrentQuestionIndex(0);
          }
        }, 800);
      }
    } else {
      // Wrong word clicked
      setErrorWord(word);
      setTimeout(() => setErrorWord(null), 1000);
    }
  };

  const resetCurrentQuestion = () => {
    if (currentItem) {
      setShuffledOptions(
        shuffleArray(currentItem.englishWords).map((word, index) => ({ id: `${index}-${word}`, word }))
      );
      setSelectedWords([]);
      setErrorWord(null);
    }
  };

  const handleCopyQuestion = (type: 'english' | 'turkish' | 'both') => {
    if (!currentItem) return;

    let textToCopy = '';
    if (type === 'english') {
      textToCopy = currentItem.english;
    } else if (type === 'turkish') {
      textToCopy = currentItem.turkish;
    } else if (type === 'both') {
      textToCopy = `${currentItem.english} = ${currentItem.turkish}`;
    }

    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        setToastMessage("Kopyalandı!");
        setTimeout(() => setToastMessage(null), 2500);
      })
      .catch((err) => {
        console.error("Copy failed", err);
        setToastMessage("Hata: Kopyalanamadı.");
        setTimeout(() => setToastMessage(null), 2500);
      });

    setShowCopyModal(false);
  };

  return (
    <div className="min-h-screen bg-black text-zinc-200 font-sans selection:bg-indigo-900 flex flex-col">
      {/* Header */}
      <header className="bg-zinc-950 px-4 py-3 sm:px-6 sm:py-4 shadow-md border-b border-zinc-900 sticky top-0 z-[35]">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-900/50">
              <RefreshCw size={20} className={mode === 'quiz' ? 'animate-[spin_4s_linear_infinite]' : ''}/>
            </div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">Offline English</h1>
          </div>
          
          <div className="flex items-center gap-1 sm:gap-2 bg-zinc-900 p-1 rounded-xl max-w-full overflow-x-auto shrink-0 scrollbar-none">
            <button 
              onClick={() => setShowVocabModal(true)}
              className="px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 sm:gap-2 text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 shrink-0"
            >
              <Library size={15} />
              <span className="hidden sm:inline">Sözlüğüm</span>
            </button>
            <div className="w-px h-5 bg-zinc-800 mx-0.5 hidden sm:block shrink-0"></div>
            <button 
              onClick={() => changeMode('quiz')}
              className={`px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 sm:gap-2 shrink-0 ${mode === 'quiz' ? 'bg-zinc-800 shadow-sm text-indigo-400' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              <Play size={15} />
              <span className="hidden sm:inline">Quiz Modu</span>
            </button>
            <button 
              onClick={() => changeMode('flashcards')}
              className={`px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 sm:gap-2 shrink-0 ${mode === 'flashcards' ? 'bg-zinc-800 shadow-sm text-amber-400' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              <Layers size={15} />
              <span className="hidden sm:inline">Flashcards</span>
            </button>
            <button 
              onClick={() => changeMode('notes')}
              className={`px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 sm:gap-2 shrink-0 ${mode === 'notes' ? 'bg-zinc-800 shadow-sm text-emerald-400' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              <FileText size={15} />
              <span className="hidden sm:inline">Notlar</span>
            </button>
            <button 
              onClick={() => changeMode('manage')}
              className={`px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 sm:gap-2 shrink-0 ${mode === 'manage' ? 'bg-zinc-800 shadow-sm text-indigo-400' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              <Settings size={15} />
              <span className="hidden sm:inline">Ayarlar</span>
            </button>
          </div>
        </div>
      </header>
      
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col">
        {mode === 'quiz' ? (
          <div className="w-full flex-1 flex flex-col">
            {!activeQuizDeck ? (
              <div className="flex-1 flex flex-col">
                {quizDecks.length === 0 ? (
                  <div className="bg-zinc-950 rounded-3xl p-10 text-center shadow-sm border border-zinc-900 flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full">
                    <XCircle size={48} className="text-red-400 mb-4" />
                    <h2 className="text-xl font-bold text-zinc-100">Veri Bulunamadı</h2>
                    <p className="text-zinc-400 mt-2">Lütfen ayarlar kısmından bir quiz seti oluşturun.</p>
                    <button 
                      onClick={() => { changeMode('manage'); setEditingQuizDeck(null); }}
                      className="mt-6 px-6 py-2 bg-indigo-600 text-white rounded-xl font-semibold shadow-sm hover:bg-indigo-500 transition"
                    >
                      Ayarlara Git
                    </button>
                  </div>
                ) : (
                  <div className="w-full max-w-4xl mx-auto">
                    <div className="flex justify-between items-end mb-8">
                      <div>
                        <h2 className="text-2xl font-bold text-zinc-100">Testi Seç</h2>
                        <p className="text-zinc-400 mt-1">Pratik yapmak istediğiniz seti seçin.</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      {quizDecks.map(deck => (
                        <div key={deck.id} onClick={() => handleStartQuizSession(deck)} className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 hover:border-zinc-700 transition cursor-pointer flex flex-col items-start shadow-sm group">
                          <h3 className="text-lg font-bold text-zinc-100 mb-2 truncate w-full">{deck.title}</h3>
                          <div className="flex items-center gap-2 text-zinc-500 text-sm mb-6 mt-auto font-medium">
                            <Library size={16} className="text-indigo-400" /> 
                            <span><strong className="text-zinc-300">{deck.dataText ? deck.dataText.split(/\r?\n/).filter(line => line.trim().length > 0).length : 0}</strong> Soru</span>
                          </div>
                          <button className="w-full py-3 bg-indigo-500/10 group-hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 group-hover:border-indigo-500/40 font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm">
                            <Play size={18} fill="currentColor" /> Başla
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full max-w-2xl mx-auto flex-1 flex flex-col pt-4">
                <div className="mb-6">
                  <button onClick={() => setActiveQuizDeck(null)} className="text-zinc-400 hover:text-zinc-200 text-sm font-semibold flex items-center gap-2 transition">
                    <ChevronLeft size={16} /> Testlere Dön
                  </button>
                </div>
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-2 px-4 py-2 bg-indigo-900/50 border border-indigo-800 rounded-xl text-indigo-300 font-bold">
                    <Trophy size={18} />
                    <span>Skor: {score}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
                      disabled={currentQuestionIndex === 0}
                      className="px-3 py-2 bg-zinc-900 rounded-xl shadow-sm border border-zinc-800 text-zinc-400 hover:text-indigo-400 hover:bg-indigo-900/30 disabled:opacity-30 disabled:hover:bg-zinc-900 disabled:hover:text-zinc-400 transition-colors"
                      aria-label="Önceki Soru"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <div className="text-sm font-medium text-zinc-300 bg-zinc-900 px-4 py-2 rounded-xl shadow-sm border border-zinc-800">
                      Soru {currentQuestionIndex + 1} / {quizItems.length}
                    </div>
                    <button 
                      onClick={() => setCurrentQuestionIndex(Math.min(quizItems.length - 1, currentQuestionIndex + 1))}
                      disabled={currentQuestionIndex >= quizItems.length - 1}
                      className="px-3 py-2 bg-zinc-900 rounded-xl shadow-sm border border-zinc-800 text-zinc-400 hover:text-indigo-400 hover:bg-indigo-900/30 disabled:opacity-30 disabled:hover:bg-zinc-900 disabled:hover:text-zinc-400 transition-colors"
                      aria-label="Sonraki Soru"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>

                {quizItems.length === 0 ? (
                  <div className="bg-zinc-950 rounded-3xl p-10 text-center shadow-sm border border-zinc-900 flex-1 flex flex-col items-center justify-center pb-20 mt-4">
                    <XCircle size={48} className="text-red-400 mb-4" />
                    <h2 className="text-xl font-bold text-zinc-100">Soru Bulunamadı</h2>
                    <p className="text-zinc-400 mt-2 mb-6">Bu sette uygun formatta soru bulunmuyor.</p>
                  </div>
            ) : currentItem ? (
              <div className="flex flex-col gap-5 flex-1">
                {/* Turkish Sentence Card */}
                <div className="bg-zinc-950 rounded-[2rem] p-6 sm:p-8 shadow-sm border border-zinc-900 text-center relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                  <div className="absolute top-4 right-4 z-10">
                    <button 
                      onClick={() => setShowCopyModal(true)}
                      className="p-2 sm:p-2.5 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-indigo-400 hover:border-indigo-500/30 rounded-xl transition-all shadow-sm flex items-center justify-center cursor-pointer"
                      title="Soruyu Kopyala"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-4 block">HEDEF CÜMLE</span>
                  <h2 className="text-2xl sm:text-3xl font-medium text-zinc-100 leading-snug">
                    {currentItem.turkish}
                  </h2>
                </div>

                {/* Building Area */}
                <div className="min-h-[100px] border-2 border-dashed border-zinc-800 rounded-2xl bg-zinc-900/50 p-6 flex flex-wrap gap-3 items-center justify-center">
                  {selectedWords.length === 0 && shuffledOptions.length > 0 && (
                    <span className="text-zinc-500 font-medium">Kelimeleri doğru sırayla seçin</span>
                  )}
                  {selectedWords.map((word, i) => (
                    <button
                      key={`sel-${i}`}
                      onClick={() => {
                        if (isSaveWordMode) {
                          setWordToSave(word);
                          setIsSaveWordMode(false);
                          setMeaningInput('');
                        } else if (isNoteMode) {
                          if (noteSelectedWords.includes(word)) {
                            setNoteSelectedWords(noteSelectedWords.filter(w => w !== word));
                          } else {
                            setNoteSelectedWords([...noteSelectedWords, word]);
                          }
                        }
                      }}
                      disabled={!isSaveWordMode && !isNoteMode}
                      className={`px-5 py-3 text-lg font-medium rounded-xl shadow-sm transition-all duration-200 ${
                        isSaveWordMode 
                          ? 'bg-amber-500/10 text-amber-400 border-2 border-dashed border-amber-500 hover:bg-amber-500/20 cursor-pointer animate-pulse'
                          : isNoteMode
                          ? noteSelectedWords.includes(word)
                            ? 'bg-emerald-600 text-white border-2 border-emerald-400 font-bold scale-[1.02] shadow-emerald-500/20 shadow-md ring-2 ring-emerald-500 cursor-pointer'
                            : 'bg-emerald-500/10 text-emerald-400 border-2 border-dashed border-emerald-500 hover:bg-emerald-500/20 cursor-pointer font-medium'
                          : 'bg-indigo-600 text-white'
                      }`}
                      title={
                        isSaveWordMode 
                          ? `${word} kelimesini kaydet` 
                          : isNoteMode
                          ? `${word} kelimesini not al`
                          : undefined
                      }
                    >
                      {word}
                    </button>
                  ))}
                  {selectedWords.length === currentItem.englishWords.length && (
                    <div className="ml-2 text-emerald-500">
                      <CheckCircle2 size={32} />
                    </div>
                  )}
                </div>

                {/* Feedback Toast */}
                <div className="h-8 flex items-center justify-center">
                  {errorWord && (
                    <div className="text-red-400 font-bold uppercase tracking-wider text-sm flex items-center gap-2 bg-red-950/50 px-4 py-2 rounded-lg border border-red-900">
                      <XCircle size={16} /> Wrong! "{errorWord}" değil.
                    </div>
                  )}
                </div>

                {/* Word Options */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 px-2">
                  <span className="text-sm font-medium text-zinc-400">Seçenekler:</span>
                  <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => {
                        setIsSaveWordMode(!isSaveWordMode);
                        setIsNoteMode(false);
                        setNoteSelectedWords([]);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer ${
                        isSaveWordMode 
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50 animate-pulse' 
                          : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-amber-400 hover:bg-zinc-800'
                      }`}
                    >
                      <BookmarkPlus size={16} />
                      {isSaveWordMode ? 'Kaydedilecek Kelimeyi Seçin...' : 'Kelime Kaydet'}
                    </button>
                    <button
                      onClick={() => {
                        if (isNoteMode) {
                          setIsNoteMode(false);
                          setNoteSelectedWords([]);
                        } else {
                          setIsSaveWordMode(false);
                          setShowCopyFormatPicker(true);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer ${
                        isNoteMode
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 animate-pulse'
                          : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800'
                      }`}
                    >
                      <FileText size={16} />
                      {isNoteMode 
                        ? 'Not Alınacak Kelimeyi Seçin...' 
                        : 'Not Al'}
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 justify-center">
                  {shuffledOptions.length > 0 && shuffledOptions.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => handleWordSelect(opt.word, opt.id)}
                      disabled={(selectedWords.length === currentItem.englishWords.length) && !isSaveWordMode && !isNoteMode}
                      className={`px-6 py-3 bg-zinc-900 border-2 border-zinc-800 text-zinc-200 text-lg font-medium rounded-xl shadow-sm transition-colors ${
                        isSaveWordMode 
                          ? 'hover:border-amber-500 hover:bg-amber-900/30 ring-2 ring-transparent hover:ring-amber-500 cursor-pointer border-dashed'
                          : isNoteMode
                          ? noteSelectedWords.includes(opt.word)
                            ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300 ring-2 ring-emerald-500 scale-[1.02] shadow-lg shadow-emerald-500/15 cursor-pointer border-solid font-bold'
                            : 'hover:border-emerald-500 hover:bg-emerald-900/10 ring-2 ring-transparent hover:ring-emerald-500 cursor-pointer border-dashed'
                          : 'hover:border-indigo-500 hover:text-indigo-300'
                      } ${
                        errorWord === opt.word && !isSaveWordMode && !isNoteMode ? 'border-red-500 bg-red-950/50 text-red-400' : ''
                      }`}
                    >
                      {opt.word}
                    </button>
                  ))}
                </div>

                {/* Retry button */}
                {selectedWords.length > 0 && selectedWords.length < currentItem.englishWords.length && (
                  <div className="flex justify-center mt-4">
                    <button 
                      onClick={resetCurrentQuestion}
                      className="text-zinc-400 hover:text-zinc-200 text-sm font-medium flex items-center gap-2"
                    >
                      <RefreshCw size={16} />
                      Sıfırla
                    </button>
                  </div>
                )}
              </div>
            ) : null}
            </div>
            )}
          </div>
        ) : mode === 'manage' ? (
          <div className="flex flex-col gap-6 w-full max-w-3xl mx-auto h-full">
            {/* Full Application Backup Section */}
            <div className="bg-zinc-950 rounded-[2rem] p-6 shadow-sm border border-zinc-900 relative overflow-hidden flex-shrink-0">
               <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-600 to-teal-800"></div>
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                 <div className="flex items-center gap-3">
                   <div className="w-12 h-12 bg-emerald-900/30 border border-emerald-800/50 rounded-xl flex items-center justify-center text-emerald-400">
                     <Database size={24} />
                   </div>
                   <div>
                     <h2 className="text-xl font-bold text-zinc-100">Uygulama Yedeği</h2>
                     <p className="text-sm text-zinc-400 mt-1">Tüm ayarları, kelimeleri ve sözlükleri yedekleyin.</p>
                   </div>
                 </div>
                 
                 <div className="flex gap-2">
                   <button 
                    onClick={handleFullAppExport}
                    className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-sm font-semibold rounded-xl flex items-center gap-2 transition"
                  >
                    <Download size={16} /> <span className="hidden sm:inline">Dışa Aktar</span>
                   </button>
                   <label className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl flex items-center gap-2 cursor-pointer transition shadow-md shadow-emerald-900/20">
                    <Upload size={16} /> <span className="hidden sm:inline">İçe Aktar</span>
                    <input type="file" accept=".json" className="hidden" onChange={handleFullAppImport} />
                   </label>
                 </div>
               </div>
            </div>

            {/* Quiz Data Management Section */}
            <div className="bg-zinc-950 rounded-[2rem] p-6 sm:p-10 shadow-sm border border-zinc-900 flex-1 flex flex-col relative overflow-hidden min-h-[500px]">
               <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-zinc-600 to-zinc-800"></div>
               
               {editingQuizDeck ? (
                 <div className="flex-1 flex flex-col max-w-3xl w-full mx-auto relative px-4 pb-20">
                   <button 
                     onClick={() => setEditingQuizDeck(null)}
                     className="mb-6 px-4 py-2 text-zinc-400 hover:text-zinc-200 font-medium flex items-center gap-2 transition self-start"
                   >
                     <ChevronLeft size={18} /> Test Kümelerine Dön
                   </button>
                   <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
                     <h2 className="text-2xl font-bold text-zinc-100">{editingQuizDeck.title} <span className="text-zinc-500 font-medium text-sm ml-2">Düzenleme</span></h2>
                     <div className="flex items-center gap-2">
                       {showClearQuizDataConfirm ? (
                         <div className="flex items-center gap-2 bg-red-950/20 px-3 py-1.5 rounded-lg border border-red-900/50">
                           <span className="text-sm text-red-400 font-medium whitespace-nowrap">Silmek istediğinize emin misiniz?</span>
                           <button onClick={handleClearQuizData} className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded">Evet</button>
                           <button onClick={() => setShowClearQuizDataConfirm(false)} className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded">Hayır</button>
                         </div>
                       ) : (
                         <button 
                           onClick={() => setShowClearQuizDataConfirm(true)} 
                           className="px-4 py-2 bg-red-950/20 hover:bg-red-950/40 border border-red-900/50 text-red-400 font-semibold rounded-xl text-sm transition flex items-center gap-2"
                         >
                           <Trash2 size={16} /> Tümünü Sil
                         </button>
                       )}
                     </div>
                   </div>

                   <div className="bg-zinc-950 rounded-2xl p-4 sm:p-6 mb-8 border border-zinc-800 shadow-sm">
                     <h3 className="text-sm font-semibold text-zinc-300 mb-4">Yeni Cümle Ekle</h3>
                     <div className="flex flex-col sm:flex-row gap-3">
                       <input type="text" placeholder="Türkçe (Örn: Merhaba)" value={quizEditorNewWord.word} onChange={(e) => setQuizEditorNewWord(prev => ({ ...prev, word: e.target.value }))} className="flex-1 bg-black border border-zinc-700 rounded-xl px-4 py-2 text-sm text-zinc-200 focus:border-indigo-500 outline-none" />
                       <input type="text" placeholder="İngilizce (Örn: Hello)" value={quizEditorNewWord.meaning} onChange={(e) => setQuizEditorNewWord(prev => ({ ...prev, meaning: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && handleAddQuizItem()} className="flex-1 bg-black border border-zinc-700 rounded-xl px-4 py-2 text-sm text-zinc-200 focus:border-indigo-500 outline-none" />
                       <button onClick={handleAddQuizItem} disabled={!quizEditorNewWord.word.trim() || !quizEditorNewWord.meaning.trim()} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white font-bold rounded-xl transition">Ekle</button>
                     </div>
                   </div>

                   <div className="mb-4 relative">
                     <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                     <input type="text" placeholder="Ara..." value={quizEditorSearch} onChange={(e) => setQuizEditorSearch(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm text-zinc-300 focus:border-indigo-500 outline-none" />
                   </div>

                   <div className="space-y-3 pb-8">
                     {parsedQuizData.filter(d => d.line.toLowerCase().includes(quizEditorSearch.toLowerCase())).map((item) => {
                         const isEditingThis = editingQuizItemId === item.id;
                         const isPendingDelete = deleteConfirmId === item.id;
                         return (
                           <div key={item.id} className={`relative flex flex-col bg-zinc-900 border ${isEditingThis ? 'border-indigo-500/50 ring-1 ring-indigo-500/30' : 'border-zinc-800'} p-5 rounded-2xl transition-all duration-200`}>
                             {isEditingThis ? (
                               <div className="w-full flex flex-col gap-4">
                                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                   <div>
                                     <label className="text-xs text-zinc-400 font-medium mb-1.5 block">Türkçe Cümle Kısımı</label>
                                     <input 
                                       type="text" 
                                       value={quizItemEditLeft} 
                                       onChange={(e) => setQuizItemEditLeft(e.target.value)}
                                       className="w-full bg-black border border-zinc-700 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-zinc-200 outline-none"
                                     />
                                   </div>
                                   <div>
                                     <label className="text-xs text-zinc-400 font-medium mb-1.5 block">İngilizce Cümle Kısımı</label>
                                     <input 
                                       type="text" 
                                       value={quizItemEditRight} 
                                       onChange={(e) => setQuizItemEditRight(e.target.value)}
                                       className="w-full bg-black border border-zinc-700 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-zinc-200 outline-none"
                                     />
                                   </div>
                                 </div>
                                 <div className="flex gap-2 justify-end pt-2 border-t border-zinc-800/60 mt-2">
                                   <button 
                                     onClick={() => setEditingQuizItemId(null)}
                                     className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold rounded-xl text-xs transition"
                                   >
                                     Kaydetme
                                   </button>
                                   <button 
                                     onClick={() => handleSaveQuizItem(item.originalIndex)}
                                     disabled={!quizItemEditLeft.trim() || !quizItemEditRight.trim()}
                                     className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-xl text-xs transition"
                                   >
                                     Kaydet
                                   </button>
                                 </div>
                               </div>
                             ) : (
                               <div className="flex justify-between items-center w-full gap-4">
                                 <div className="min-w-0 flex-1">
                                   {item.valid ? (
                                     <>
                                       <p className="font-bold text-zinc-200 break-words leading-relaxed">{item.left}</p>
                                       <p className="text-sm text-zinc-400 mt-1 break-words font-medium">{item.right}</p>
                                     </>
                                   ) : (
                                     <p className="text-red-400 text-sm font-medium break-all">Hatalı Format: {item.line}</p>
                                   )}
                                 </div>
                                 
                                 {isPendingDelete ? (
                                   <div className="absolute inset-0 bg-zinc-900 flex items-center p-5 rounded-2xl border border-red-500/50 z-10 gap-3 animate-fade-in">
                                     <span className="text-sm text-red-100 font-semibold flex-1 text-left whitespace-normal">Bu soruyu silmek istediğinize emin misiniz?</span>
                                     <button 
                                       onClick={() => { handleDeleteQuizItem(item.originalIndex); setDeleteConfirmId(null); }} 
                                       className="px-3.5 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition shrink-0"
                                     >
                                       Evet
                                     </button>
                                     <button 
                                       onClick={() => setDeleteConfirmId(null)} 
                                       className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-xl transition shrink-0"
                                     >
                                       Hayır
                                     </button>
                                   </div>
                                 ) : (
                                   <div className="flex items-center gap-2 shrink-0">
                                     <button 
                                       onClick={() => handleStartQuizItemEdit(item)}
                                       className="p-2 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition"
                                       title="Düzenle"
                                     >
                                       <Edit2 size={16} />
                                     </button>
                                     <button 
                                       onClick={() => setDeleteConfirmId(item.id)} 
                                       className="text-red-400 hover:text-red-300 p-2 hover:bg-red-500/10 rounded-lg transition"
                                       title="Sil"
                                     >
                                       <Trash2 size={16} />
                                     </button>
                                   </div>
                                 )}
                               </div>
                             )}
                           </div>
                         );
                       })}
                      {false && [].map((item, index) => (
                       <div key={item.id} className="flex justify-between items-center bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
                         {item.valid ? (
                           <div><p className="font-bold text-zinc-200">{item.left}</p><p className="text-sm text-zinc-400 mt-1">{item.right}</p></div>
                         ) : (
                           <div><p className="text-red-400 text-sm font-medium">Hatalı Format: {item.line}</p></div>
                         )}
                         <button onClick={() => handleDeleteQuizItem(index)} className="text-red-400 hover:text-red-300 p-2 hover:bg-red-500/10 rounded-lg transition"><Trash2 size={18} /></button>
                       </div>
                     ))}
                     {parsedQuizData.length === 0 && <p className="text-center text-zinc-500 py-8">Veri bulunamadı.</p>}
                   </div>
                 </div>
               ) : (
                 <div className="w-full flex-1 flex flex-col">
                   <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
                     <div>
                       <h2 className="text-2xl font-bold text-zinc-100">Quiz Test Kümeleri</h2>
                       <p className="text-sm text-zinc-400 mt-1">Sözlüklerinizi yönetin ve yeni test kümeleri oluşturun.</p>
                     </div>
                     <div className="flex gap-3 flex-wrap">
                       <label className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl flex items-center gap-2 cursor-pointer transition shadow-lg shadow-indigo-900/20">
                         <Plus size={16} /> <span className="hidden sm:inline">İçe Aktar (.txt)</span>
                         <input type="file" accept=".txt,text/plain" onClick={(e) => { (e.target as HTMLInputElement).value = '' }} className="hidden" onChange={handleImportQuizDeck} />
                       </label>
                     </div>
                   </div>
                   
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     {quizDecks.map(deck => (
                       <div key={deck.id} className="bg-black border border-zinc-800 rounded-2xl p-5 flex flex-col hover:border-zinc-700 transition relative">
                         <div className="flex justify-between items-start mb-4">
                           <div className="flex-1 overflow-hidden flex items-center">
                             {editingQuizDeckId === deck.id ? (
                               <input autoFocus value={editingQuizDeckTitle} onChange={(e) => setEditingQuizDeckTitle(e.target.value)} onBlur={() => saveQuizDeckTitle(deck.id)} onKeyDown={(e) => e.key === 'Enter' && saveQuizDeckTitle(deck.id)} className="bg-zinc-900 border border-indigo-500 rounded px-2 py-1 flex-1 mr-4 focus:outline-none text-zinc-100 font-bold" />
                             ) : (
                               <h3 className="text-lg font-bold text-zinc-100 truncate pr-8" title={deck.title}>{deck.title}</h3>
                             )}
                           </div>
                           <div className="relative quiz-dropdown-container">
                             <button onClick={() => setActiveQuizDropdown(activeQuizDropdown === deck.id ? null : deck.id)} className="p-1.5 text-zinc-500 hover:text-white rounded-lg hover:bg-zinc-800 transition"><MoreVertical size={18} /></button>
                             {activeQuizDropdown === deck.id && (
                               <div className="absolute right-0 top-full mt-2 w-48 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl z-20 py-2 overflow-hidden">
                                 <button onClick={(e) => { e.stopPropagation(); handleEditQuizDeckTitle(deck.id); }} className="w-full text-left px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-700 hover:text-white flex items-center gap-2"><Edit2 size={16}/> İsmi Değiştir</button>
                                 <button onClick={(e) => { e.stopPropagation(); setActiveQuizDropdown(null); handleExportQuizDeck(deck); }} className="w-full text-left px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-700 hover:text-white flex items-center gap-2"><Download size={16}/> Dışa Aktar</button>
                                 <div className="h-px bg-zinc-700 my-1"></div>
                                 <button onClick={(e) => { e.stopPropagation(); handleDeleteQuizDeck(deck.id); }} className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/20 hover:text-red-300 flex items-center gap-2"><Trash2 size={16}/> Sil</button>
                               </div>
                             )}
                           </div>
                         </div>
                         <div className="flex items-center gap-2 text-zinc-500 text-sm mb-6 mt-auto">
                           <Library size={16} className="text-indigo-400" /> 
                           <span><strong className="text-zinc-300">{deck.dataText ? deck.dataText.split(/\r?\n/).filter(line => line.trim().length > 0).length : 0}</strong> Cümle</span>
                         </div>
                         <div className="flex gap-2">
                           <button onClick={(e) => { e.stopPropagation(); setEditingQuizDeck(deck); }} className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-xl flex items-center justify-center gap-2 transition shadow-sm border border-zinc-700">Düzenle</button>
                         </div>
                       </div>
                     ))}
                     {quizDecks.length === 0 && (
                       <div className="col-span-full py-10 flex flex-col items-center">
                         <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center text-zinc-600 mb-4"><Layers size={32} /></div>
                         <p className="text-zinc-500 text-center font-medium">Henüz bir quiz sözlüğü oluşturmadınız.</p>
                       </div>
                     )}
                   </div>
                 </div>
               )}
            </div>
          </div>
        ) : mode === 'flashcards' ? (
          <div className="w-full flex-1 flex flex-col">
            {editingFlashcardDeck ? (
              <div className="flex-1 flex flex-col max-w-3xl w-full mx-auto relative px-4 pb-20">
                <button 
                  onClick={() => {
                    setEditingFlashcardDeck(null);
                    setEditingDeckWordId(null);
                    setDeleteConfirmId(null);
                  }}
                  className="mb-6 px-4 py-2 text-zinc-400 hover:text-zinc-200 font-medium flex items-center gap-2 transition self-start"
                >
                  <ChevronLeft size={18} /> Sözlüklere Dön
                </button>
                <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
                  <h2 className="text-2xl font-bold text-zinc-100">{editingFlashcardDeck.title} <span className="text-zinc-500 font-medium text-sm ml-2">Düzenleme</span></h2>
                  <div className="flex items-center gap-2">
                    {showClearDeckConfirm ? (
                      <div className="flex items-center gap-2 bg-red-950/20 px-3 py-1.5 rounded-lg border border-red-900/50">
                        <span className="text-sm text-red-400 font-medium whitespace-nowrap">Tüm kelimeleri silmek istediğinize emin misiniz?</span>
                        <button onClick={handleClearDeckWords} className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded">Evet</button>
                        <button onClick={() => setShowClearDeckConfirm(false)} className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded">Hayır</button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setShowClearDeckConfirm(true)} 
                        className="px-4 py-2 bg-red-950/20 hover:bg-red-950/40 border border-red-900/50 text-red-400 font-semibold rounded-xl text-sm transition"
                      >
                        Tümünü Sil
                      </button>
                    )}
                  </div>
                </div>

                <div className="bg-zinc-950 rounded-2xl p-4 sm:p-6 mb-8 border border-zinc-800 shadow-sm">
                  <h3 className="text-sm font-semibold text-zinc-300 mb-4">Yeni Kelime Ekle</h3>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input 
                      type="text" 
                      placeholder="Kelime (Örn: Apple)" 
                      value={deckEditorNewWord.word}
                      onChange={(e) => setDeckEditorNewWord(prev => ({ ...prev, word: e.target.value }))}
                      className="flex-1 bg-black border border-zinc-700 rounded-xl px-4 py-2 text-sm text-zinc-200 focus:border-amber-500 outline-none"
                    />
                    <input 
                      type="text" 
                      placeholder="Anlamı (Örn: Elma)" 
                      value={deckEditorNewWord.meaning}
                      onChange={(e) => setDeckEditorNewWord(prev => ({ ...prev, meaning: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveDeckWord()}
                      className="flex-1 bg-black border border-zinc-700 rounded-xl px-4 py-2 text-sm text-zinc-200 focus:border-amber-500 outline-none"
                    />
                    <button 
                      onClick={handleSaveDeckWord}
                      disabled={!deckEditorNewWord.word.trim() || !deckEditorNewWord.meaning.trim()}
                      className="px-6 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:hover:bg-amber-600 text-white font-bold rounded-xl transition"
                    >
                      Ekle
                    </button>
                  </div>
                </div>

                <div className="mb-4 relative">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input 
                    type="text" 
                    placeholder="Sözlükte ara..." 
                    value={deckEditorSearch}
                    onChange={(e) => setDeckEditorSearch(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm text-zinc-300 focus:border-amber-500 outline-none"
                  />
                </div>

                <div className="space-y-3">
                  {editingFlashcardDeck.words.filter(w => w.word.toLowerCase().includes(deckEditorSearch.toLowerCase()) || w.meaning.toLowerCase().includes(deckEditorSearch.toLowerCase())).map(word => {
                    const isEditingThis = editingDeckWordId === word.id;
                    const isPendingDelete = deleteConfirmId === word.id;
                    return (
                      <div key={word.id} className={`relative flex flex-col bg-zinc-900 border ${isEditingThis ? 'border-amber-500/50 ring-1 ring-amber-500/30' : 'border-zinc-800'} p-5 rounded-2xl transition-all duration-200`}>
                        {isEditingThis ? (
                          <div className="w-full flex flex-col gap-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs text-zinc-400 font-medium mb-1.5 block">İngilizce Kelime</label>
                                <input 
                                  type="text" 
                                  value={deckWordEditLeft} 
                                  onChange={(e) => setDeckWordEditLeft(e.target.value)}
                                  className="w-full bg-black border border-zinc-700 focus:border-amber-500 rounded-xl px-4 py-2.5 text-sm text-zinc-200 outline-none"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-zinc-400 font-medium mb-1.5 block">Türkçe Anlamı</label>
                                <input 
                                  type="text" 
                                  value={deckWordEditRight} 
                                  onChange={(e) => setDeckWordEditRight(e.target.value)}
                                  className="w-full bg-black border border-zinc-700 focus:border-amber-500 rounded-xl px-4 py-2.5 text-sm text-zinc-200 outline-none"
                                />
                              </div>
                            </div>
                            <div className="flex gap-2 justify-end pt-2 border-t border-zinc-800/60 mt-2">
                              <button 
                                onClick={() => setEditingDeckWordId(null)}
                                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold rounded-xl text-xs transition"
                              >
                                Kaydetme
                              </button>
                              <button 
                                onClick={() => handleSaveDeckWordEdit(word.id)}
                                disabled={!deckWordEditLeft.trim() || !deckWordEditRight.trim()}
                                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold rounded-xl text-xs transition"
                              >
                                Kaydet
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-between items-center w-full gap-4">
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-zinc-200 break-words leading-relaxed">{word.word}</p>
                              <p className="text-sm text-zinc-400 mt-1 break-words font-medium">{word.meaning}</p>
                            </div>
                            
                            {isPendingDelete ? (
                              <div className="absolute inset-0 bg-zinc-900 flex items-center p-5 rounded-2xl border border-red-500/50 z-10 gap-3 animate-fade-in">
                                <span className="text-sm text-red-100 font-semibold flex-1 text-left whitespace-normal">Bu kelimeyi silmek istediğinize emin misiniz?</span>
                                <button 
                                  onClick={() => { handleDeleteDeckWord(word.id); setDeleteConfirmId(null); }} 
                                  className="px-3.5 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition shrink-0"
                                >
                                  Evet
                                </button>
                                <button 
                                  onClick={() => setDeleteConfirmId(null)} 
                                  className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-xl transition shrink-0"
                                >
                                  Hayır
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 shrink-0">
                                <button 
                                  onClick={() => handleStartDeckWordEdit(word)}
                                  className="p-2 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition"
                                  title="Düzenle"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button 
                                  onClick={() => setDeleteConfirmId(word.id)} 
                                  className="text-red-400 hover:text-red-300 p-2 hover:bg-red-500/10 rounded-lg transition"
                                  title="Sil"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {editingFlashcardDeck.words.length === 0 && (
                    <p className="text-center text-zinc-500 py-8">Bu sözlükte henüz kelime yok.</p>
                  )}
                </div>
              </div>
            ) : activeDeck ? (
              <div className="flex-1 flex flex-col items-center justify-start max-w-2xl w-full mx-auto relative px-4 text-center pb-8 pt-0 animate-fade-in">
                 {/* Top Navigation Bar with Compact Inline Layout */}
                 <div className="w-full flex items-center justify-between mb-3 px-2 mt-0">
                   <button 
                     onClick={() => setActiveDeck(null)}
                     className="px-3.5 py-2 -ml-3 bg-zinc-900/65 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 font-semibold rounded-xl flex items-center gap-1.5 transition text-xs border border-zinc-805 shadow-sm"
                   >
                     <ChevronLeft size={16} /> Geri
                   </button>
                   
                   <div className="text-right flex flex-col items-end">
                      <h2 className="text-base font-extrabold text-zinc-100 max-w-[180px] truncate" title={activeDeck.title}>{activeDeck.title}</h2>
                      <div className="flex flex-col items-end gap-1 mt-1">
                        <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                          Bu Oturum: {sessionWords.length} / {sessionTotalCount}
                        </span>
                        {activeDeck.words.length > 35 && (
                          <span className="text-[9px] font-mono font-semibold text-zinc-400 bg-zinc-900/40 px-2 py-0.5 rounded-full border border-zinc-850/40">
                            Sözlük Geneli: {activeDeck.knownWords?.length || 0} / {activeDeck.words.length} (%{activeDeck.words.length > 0 ? Math.round(((activeDeck.knownWords?.length || 0) / activeDeck.words.length) * 100) : 0})
                          </span>
                        )}
                      </div>
                    </div>
                 </div>

                 <div className="flex bg-zinc-950 p-1 rounded-2xl mb-4 w-full border border-zinc-850/80">
                   <button
                     type="button"
                     onClick={() => setActiveDeckTab('test')}
                     className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                       activeDeckTab === 'test'
                         ? 'bg-zinc-800/85 text-amber-400 border border-zinc-750/40 shadow-sm'
                         : 'text-zinc-500 hover:text-zinc-300'
                     }`}
                   >
                     <Layers size={14} className="text-amber-500" />
                     Kart Testi
                   </button>
                   <button
                     type="button"
                     onClick={() => setActiveDeckTab('words')}
                     className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                       activeDeckTab === 'words'
                         ? 'bg-zinc-800/85 text-amber-400 border border-zinc-750/40 shadow-sm'
                         : 'text-zinc-500 hover:text-zinc-300'
                     }`}
                   >
                     <CheckCircle2 size={14} className="text-emerald-500" />
                     Bildiğim / Bilmediğim
                   </button>
                 </div>

                 {activeDeckTab === 'words' ? (
                   (() => {
                     const currentDeckData = decks.find(d => d.id === activeDeck.id) || activeDeck;
                     const knownWordIds = currentDeckData.knownWords || [];
                     const knownWordsList = currentDeckData.words.filter(w => knownWordIds.includes(w.id));
                     const unknownWordsList = currentDeckData.words.filter(w => !knownWordIds.includes(w.id));

                     return (
                       <div className="w-full flex flex-col mt-2">
                         <div className="w-full flex bg-zinc-950 p-1 rounded-xl mb-4 border border-zinc-850">
                           <button
                             type="button"
                             onClick={() => setWordStatusFilter('unknown')}
                             className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                               wordStatusFilter === 'unknown'
                                 ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                 : 'text-zinc-500 hover:text-zinc-300'
                             }`}
                           >
                             🤔 Çalışılacak ({unknownWordsList.length})
                           </button>
                           <button
                             type="button"
                             onClick={() => setWordStatusFilter('known')}
                             className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                               wordStatusFilter === 'known'
                                 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                 : 'text-zinc-500 hover:text-zinc-300'
                             }`}
                           >
                             ✅ Öğrenilen ({knownWordsList.length})
                           </button>
                         </div>

                         <div className="w-full relative mb-4">
                           <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                             <Search size={14} />
                           </div>
                           <input
                             type="text"
                             placeholder="Kelime veya anlam ara..."
                             value={deckWordsSearch}
                             onChange={(e) => setDeckWordsSearch(e.target.value)}
                             className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/50"
                           />
                         </div>

                         <div className="w-full flex flex-col gap-2 max-h-[350px] overflow-y-auto pr-1">
                           {(() => {
                             const activeList = wordStatusFilter === 'unknown' ? unknownWordsList : knownWordsList;
                             const filteredList = activeList.filter(w => 
                               w.word.toLowerCase().includes(deckWordsSearch.toLowerCase()) || 
                               w.meaning.toLowerCase().includes(deckWordsSearch.toLowerCase())
                             );

                             if (filteredList.length === 0) {
                               return (
                                 <div className="py-12 bg-zinc-900/20 rounded-2xl border border-zinc-800/60 border-dashed text-zinc-500 text-xs text-center flex flex-col items-center justify-center">
                                   <Search size={22} className="opacity-40 mb-2" />
                                   {deckWordsSearch ? "Aramanızla eşleşen kelime bulunamadı." : "Bu kategoride henüz kelime bulunmuyor."}
                                 </div>
                               );
                             }

                             return filteredList.map(word => (
                               <div 
                                 key={word.id} 
                                 className="flex items-center justify-between p-3.5 bg-zinc-900/40 hover:bg-zinc-900/80 rounded-2xl border border-zinc-800/60 hover:border-zinc-700/40 transition-all text-left"
                               >
                                 <div className="flex flex-col pr-3 truncate">
                                   <span className="font-semibold text-zinc-100 text-sm">{word.word}</span>
                                   <span className="text-xs text-zinc-400 mt-0.5 truncate">{word.meaning}</span>
                                 </div>
                                 
                                 <div>
                                   {wordStatusFilter === 'unknown' ? (
                                     <button
                                       type="button"
                                       onClick={() => toggleWordKnownStatus(currentDeckData.id, word.id, true)}
                                       className="p-2 px-3 bg-emerald-950/20 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 hover:border-emerald-500/40 rounded-xl transition duration-200 cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                                       title="Biliyorum olarak işaretle"
                                     >
                                       <CheckCircle2 size={14} className="text-emerald-500" />
                                       <span>Biliyorum</span>
                                     </button>
                                   ) : (
                                     <button
                                       type="button"
                                       onClick={() => toggleWordKnownStatus(currentDeckData.id, word.id, false)}
                                       className="p-2 px-3 bg-zinc-800/40 hover:bg-amber-500/15 text-zinc-400 hover:text-amber-500 border border-zinc-750 hover:border-amber-500/30 rounded-xl transition duration-200 cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                                       title="Bilmiyorum olarak işaretle & Tekrar çalış"
                                     >
                                       <RefreshCw size={12} className="text-amber-500 animate-hover:spin" />
                                       <span>Yeniden Çalış</span>
                                     </button>
                                   )}
                                 </div>
                               </div>
                             ));
                           })()}
                         </div>
                       </div>
                     );
                   })()
                 ) : (
                   sessionWords.length === 0 && viewingPastIndex === 0 ? (
                     (() => {
                       const currentDeckData = decks.find(d => d.id === activeDeck?.id) || activeDeck;
                       if (!currentDeckData) return null;
                       const knownWordIds = currentDeckData.knownWords || [];
                       const remainingWordsCount = currentDeckData.words.filter(w => !knownWordIds.includes(w.id)).length;

                       if (remainingWordsCount > 0) {
                         return (
                           <div className="flex flex-col items-center justify-center p-12 bg-zinc-900/50 rounded-3xl border border-zinc-800 w-full mt-4 text-center animate-fade-in">
                             <CheckCircle2 size={64} className="text-emerald-400 mb-6 animate-bounce" />
                             <h3 className="text-2xl font-black text-zinc-100 mb-2 font-sans tracking-tight">Oturum Tamamlandı! 🎉</h3>
                             <p className="text-zinc-400 text-sm max-w-sm mb-6 leading-relaxed">
                               Bu 35 kelimelik parçayı başarıyla tamamladınız! Sözlükte çalışılacak daha <span className="text-amber-400 font-extrabold">{remainingWordsCount}</span> kelime var.
                             </p>
                             <button 
                               onClick={() => startFlashcardSession(activeDeck, false)}
                               className="px-6 py-4 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-2 shadow-md shadow-amber-600/15"
                             >
                               ⚡ Sıradaki Parçaya Geç ({Math.min(35, remainingWordsCount)} Kelime)
                             </button>
                           </div>
                         );
                       }

                       return (
                         <div className="flex flex-col items-center justify-center p-12 bg-zinc-900/50 rounded-3xl border border-zinc-800 w-full mt-4 text-center animate-fade-in">
                           <CheckCircle2 size={64} className="text-emerald-400 mb-6 animate-bounce" />
                           <h3 className="text-2xl font-black text-zinc-100 mb-2 font-sans tracking-tight">Tebrikler! Sözlüğü Bitirdiniz! 🏆</h3>
                           <p className="text-zinc-400 text-sm max-w-sm mb-6 leading-relaxed">
                             Sözlükteki tüm <span className="text-emerald-400 font-extrabold">{currentDeckData.words.length}</span> kelimeyi başarıyla tamamladınız ve öğrendiniz!
                           </p>
                           <button 
                             onClick={() => startFlashcardSession(activeDeck, true)}
                             className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-2"
                           >
                             🔄 Sözlüğü Baştan Sıfırla & Tekrar Çalış
                           </button>
                         </div>
                       );
                     })()
                   ) : (
                     (() => {
                       const currentDisplayWord = viewingPastIndex > 0 ? sessionHistory[sessionHistory.length - viewingPastIndex]?.word : sessionWords[0];
                       if (!currentDisplayWord) return null;
                       return (
                       <>
                         <div className="w-full relative aspect-[4/3] sm:aspect-[1.58] perspective-1000 mt-1 h-full min-h-[280px] sm:min-h-[350px]">
                           <AnimatePresence mode="popLayout">
                             <motion.div 
                               key={currentDisplayWord.id}
                               drag="x"
                               dragConstraints={{ left: 0, right: 0 }}
                               dragElastic={0.95}
                               onDragEnd={(_e, info) => {
                                 const swipeThreshold = 40;
                                 const velocityThreshold = 150;
                                 if (info.offset.x < -swipeThreshold || info.velocity.x < -velocityThreshold) handleSwipeLeft();
                                 else if (info.offset.x > swipeThreshold || info.velocity.x > velocityThreshold) handleSwipeRight();
                               }}
                               initial={{ scale: 0.9, opacity: 0 }}
                               animate={{ scale: 1, opacity: 1 }}
                               exit={{ scale: 0.9, opacity: 0, x: flashcardFlipped ? -200 : 200 }}
                               transition={{ duration: 0.2 }}
                               onClick={() => setFlashcardFlipped(!flashcardFlipped)}
                               className="w-full h-full absolute inset-0 cursor-grab active:cursor-grabbing"
                             >
                               <div className={`w-full h-full relative transition-transform duration-500 transform-style-3d ${flashcardFlipped ? 'rotate-y-180' : ''} pointer-events-none`}>
                                 {/* Front */}
                                 <div className="absolute inset-0 bg-zinc-900 border-2 border-zinc-800 rounded-3xl flex flex-col items-center justify-center p-8 backface-hidden shadow-xl shadow-black/50">
                                   <span className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-4 absolute top-6 flex items-center gap-2"><FlipHorizontal size={14}/> İNGİLİZCE</span>

                                   <h3 className="text-3xl sm:text-5xl lg:text-6xl font-black text-zinc-100 text-center leading-tight tracking-tight">
                                     {currentDisplayWord.word}
                                   </h3>
                                   <span className="text-zinc-650 text-xs absolute bottom-4 font-medium animate-pulse">
                                     {viewingPastIndex > 0 ? "Geçmiş Kelime" : "Çevirmek için tıkla / Kaydır"}
                                   </span>
                                   {/* Progress dots */}
                                   <div className="absolute bottom-11 flex flex-col items-center gap-1">
                                     <div className="flex items-center gap-1.5">
                                       {Array.from({ length: 3 }).map((_, idx) => {
                                         const progress = wordCorrectCount[currentDisplayWord.id] ?? 0;
                                         const isKnown = idx < progress;
                                         return (
                                           <div 
                                             key={idx} 
                                             className={`w-2.5 h-2.5 rounded-full border transition-all duration-300 ${
                                               isKnown 
                                                 ? 'bg-emerald-500 border-emerald-400 scale-110 shadow-lg shadow-emerald-500/50' 
                                                 : 'bg-zinc-800 border-zinc-750'
                                             }`} 
                                           />
                                         );
                                       })}
                                     </div>
                                     <span className="text-[9px] uppercase font-bold tracking-widest text-zinc-500">
                                       Puan: {wordCorrectCount[currentDisplayWord.id] ?? 0}/3
                                     </span>
                                   </div>
                                 </div>
                                 {/* Back */}
                                 <div className="absolute inset-0 bg-amber-600 rounded-3xl flex flex-col items-center justify-center p-8 backface-hidden rotate-y-180 shadow-xl shadow-black/50">
                                   <span className="text-xs font-bold uppercase tracking-widest text-amber-200 mb-4 absolute top-6 flex items-center gap-2"><FlipHorizontal size={14}/> TÜRKÇE</span>

                                   <h3 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white text-center leading-tight tracking-tight">
                                     {currentDisplayWord.meaning}
                                   </h3>
                                   {/* Progress dots */}
                                   <div className="absolute bottom-11 flex flex-col items-center gap-1">
                                     <div className="flex items-center gap-1.5">
                                       {Array.from({ length: 3 }).map((_, idx) => {
                                         const progress = wordCorrectCount[currentDisplayWord.id] ?? 0;
                                         const isKnown = idx < progress;
                                         return (
                                           <div 
                                             key={idx} 
                                             className={`w-2.5 h-2.5 rounded-full border transition-all duration-300 ${
                                               isKnown 
                                                 ? 'bg-emerald-400 border-emerald-300 scale-110 shadow-lg' 
                                                 : 'bg-amber-800/40 border-amber-700'
                                             }`} 
                                           />
                                         );
                                       })}
                                     </div>
                                     <span className="text-[9px] uppercase font-bold tracking-widest text-amber-100">
                                       Puan: {wordCorrectCount[currentDisplayWord.id] ?? 0}/3
                                     </span>
                                   </div>
                                   <span className="text-amber-200/80 text-xs absolute bottom-4 font-medium">
                                     {viewingPastIndex > 0 ? "Geçmiş Kelime" : "Dokunarak İngilizceye Dön"}
                                   </span>
                                 </div>
                               </div>
                             </motion.div>
                           </AnimatePresence>
                         </div>
                         
                         <div className={`flex items-center gap-3 sm:gap-4 mt-5 w-full justify-center ${viewingPastIndex > 0 ? 'opacity-50 pointer-events-none' : ''}`}>
                           <button 
                             onClick={handlePrevCard}
                             className="w-14 h-14 bg-zinc-900 hover:bg-zinc-800 rounded-2xl flex items-center justify-center text-zinc-400 hover:text-zinc-200 transition shadow-sm border border-zinc-800 shrink-0 pointer-events-auto"
                             title="Önceki Kelime"
                           >
                             <ChevronLeft size={24} />
                           </button>
    
                           <button 
                             onClick={handleSwipeLeft}
                             className="flex-1 max-w-[140px] py-3 bg-zinc-900 hover:bg-green-500/20 text-zinc-300 hover:text-green-400 border border-zinc-800 hover:border-green-500/50 rounded-2xl flex flex-col items-center justify-center font-bold transition group"
                           >
                             <span className="text-xs tracking-wider mb-1 opacity-60 font-medium">Sola Kaydır</span>
                             Biliyorum
                           </button>
    
                           <button 
                             onClick={handleSwipeRight}
                             className="flex-1 max-w-[140px] py-3 bg-zinc-900 hover:bg-red-500/20 text-zinc-300 hover:text-red-400 border border-zinc-800 hover:border-red-500/50 rounded-2xl flex flex-col items-center justify-center font-bold transition group"
                           >
                             <span className="text-xs tracking-wider mb-1 opacity-60 font-medium">Sağa Kaydır</span>
                             Bilmiyorum
                           </button>
                           
                           <button 
                             onClick={handleNextCard}
                             className="w-14 h-14 bg-zinc-900 hover:bg-zinc-800 rounded-2xl flex items-center justify-center text-zinc-400 hover:text-zinc-200 transition shadow-sm border border-zinc-800 shrink-0 pointer-events-auto"
                             title="Sonraki Kelime"
                           >
                             <ChevronRight size={24} />
                           </button>
                         </div>
                       </>
                       );
                     })()
                   )
                 )}
              </div>
            ) : (
              <div className="flex-1 max-w-5xl w-full mx-auto flex flex-col px-4 sm:px-6">
                 <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4 mt-4">
                   <div>
                     <h2 className="text-2xl font-bold text-zinc-100">Flashcard Sözlükleri</h2>
                     <p className="text-sm text-zinc-400 mt-1">Sözlüklerinizi ekleyin ve çalışmaya başlayın.</p>
                   </div>
                   
                   <div className="flex gap-3 flex-wrap">
                     <button 
                      onClick={handleCreateDeckFromMain}
                      className="px-4 py-2.5 bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-zinc-300 text-sm font-semibold rounded-xl flex items-center gap-2 transition"
                     >
                      <Library size={16} /> <span className="hidden sm:inline">Ana Sözlüğümü Ekle</span>
                     </button>
                     <label className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold rounded-xl flex items-center gap-2 cursor-pointer transition shadow-lg shadow-amber-900/20">
                      <Plus size={16} /> <span className="hidden sm:inline">İçe Aktar (.txt)</span>
                      <input type="file" accept=".txt,text/plain" onClick={(e) => { (e.target as HTMLInputElement).value = '' }} className="hidden" onChange={handleImportDeck} />
                     </label>
                   </div>
                 </div>
                 
                 {decks.length === 0 ? (
                   <div className="bg-zinc-950 rounded-3xl p-12 text-center border border-zinc-900 mt-8 flex flex-col items-center justify-center">
                     <Layers size={56} className="text-zinc-700 mb-6" />
                     <h3 className="text-xl font-bold text-zinc-200">Henüz Sözlük Yok</h3>
                     <p className="text-zinc-400 mt-3 max-w-md text-sm leading-relaxed mx-auto">Kendi sözlük dosyalarınızı (txt) içe aktarabilir veya "Sözlüğüm" bölümünden bir flashcard destesi oluşturabilirsiniz.</p>
                   </div>
                 ) : (
                   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                     {decks.map(deck => (
                       <div key={deck.id} className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 hover:border-zinc-700 transition relative flex flex-col h-full shadow-sm">
                          <div className="flex justify-between items-start mb-6">
                            {editingDeckId === deck.id ? (
                              <input 
                                autoFocus
                                value={editingDeckTitle}
                                onChange={(e) => setEditingDeckTitle(e.target.value)}
                                onBlur={() => saveDeckTitle(deck.id)}
                                onKeyDown={(e) => e.key === 'Enter' && saveDeckTitle(deck.id)}
                                className="bg-black border border-amber-500 rounded px-2 py-1 flex-1 mr-4 focus:outline-none text-zinc-100 font-bold"
                              />
                            ) : (
                              <div className="flex flex-col gap-1 truncate pr-8">
                                <h3 className="text-lg font-bold text-zinc-100 truncate leading-snug" title={deck.title}>{deck.title}</h3>
                                {deck.words.length > 35 && (
                                  <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider w-fit">
                                    ⚡ 35'lik Oturumlar
                                  </span>
                                )}
                              </div>
                            )}
                            <div className="relative flashcard-dropdown-container">
                              <button 
                                onClick={() => setActiveDropdown(activeDropdown === deck.id ? null : deck.id)}
                                className="p-1.5 text-zinc-500 hover:text-zinc-300 bg-zinc-900 hover:bg-zinc-800 rounded-lg transition"
                                aria-label="Seçenekler"
                              >
                                <MoreVertical size={18} />
                              </button>
                              {activeDropdown === deck.id && (
                                <div className="absolute right-0 top-full mt-2 w-48 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl z-20 py-2 overflow-hidden">
                                  <button onClick={(e) => { e.stopPropagation(); handleEditDeckTitle(deck.id); }} className="w-full text-left px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-700 hover:text-white flex items-center gap-2 transition-colors"><Edit2 size={16}/> İsmi Değiştir</button>
                                  <button onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); handleExportDeck(deck); }} className="w-full text-left px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-700 hover:text-white flex items-center gap-2 transition-colors"><Download size={16}/> Dışa Aktar</button>
                                  <div className="h-px bg-zinc-700 my-1"></div>
                                  <button onClick={(e) => { e.stopPropagation(); handleDeleteDeck(deck.id); }} className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/20 hover:text-red-300 flex items-center gap-2 transition-colors"><Trash2 size={16}/> Sil</button>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {(() => {
                            const knownCount = deck.knownWords?.length || 0;
                            const totalCount = deck.words.length;
                            const pct = totalCount > 0 ? Math.round((knownCount / totalCount) * 100) : 0;
                            return (
                              <div className="flex flex-col gap-2.5 mb-6 mt-auto">
                                <div className="flex items-center justify-between text-zinc-500 text-xs font-semibold">
                                  <div className="flex items-center gap-1.5">
                                    <Library size={14} className="text-amber-500/70" /> 
                                    <span><strong className="text-zinc-300">{totalCount}</strong> Kelime</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-emerald-400">
                                    <CheckCircle2 size={13} />
                                    <span>Öğrenilen: <strong className="text-zinc-300">{knownCount}</strong> (%{pct})</span>
                                  </div>
                                </div>
                                
                                {/* Progress Bar visual */}
                                <div className="w-full bg-zinc-900 border border-zinc-800/80 h-2 rounded-full overflow-hidden flex">
                                  <div 
                                    style={{ width: `${pct}%` }} 
                                    className="bg-gradient-to-r from-amber-500 to-emerald-500 h-full rounded-full transition-all duration-300"
                                  />
                                 </div>
                               </div>
                             );
                           })()}
                          
                          <div className="flex gap-2">
                            <button 
                                onClick={() => startFlashcardSession(deck)}
                                className="flex-1 py-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 hover:border-amber-500/40 font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm text-sm cursor-pointer"
                              >
                                <Play size={18} fill="currentColor" /> Başla
                              </button>
                            <button 
                              onClick={() => setEditingFlashcardDeck(deck)}
                              className="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 hover:border-zinc-600 font-bold rounded-xl flex items-center justify-center transition-all shadow-sm"
                              title="Sözlüğü Düzenle"
                            >
                              <Edit2 size={18} />
                            </button>
                          </div>
                       </div>
                     ))}
                   </div>
                 )}
              </div>
            )}
          </div>
        ) : mode === 'notes' ? (
          <div className="w-full flex-1 flex flex-col md:flex-row gap-6 animate-[fadeIn_0.2s_ease-out]">
            {/* Note Sets Column / List */}
            <div className={`flex-1 md:w-80 md:flex-none flex flex-col gap-4 ${activeNoteSetId ? 'hidden md:flex' : 'flex'}`}>
              {isMergingNotes ? (
                <div className="flex items-center justify-between bg-zinc-950 border border-emerald-500/30 p-3 sm:p-4 rounded-2xl w-full">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <GitMerge size={12} className="animate-pulse" />
                      Not Birleştirme
                    </span>
                    <span className="text-[10px] text-zinc-400 font-mono mt-0.5">{selectedNoteSetIds.length} not seçildi</span>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => {
                        if (selectedNoteSetIds.length < 2) {
                          setToastMessage("Lütfen birleştirmek için en az 2 not seçin.");
                          setTimeout(() => setToastMessage(null), 2500);
                          return;
                        }
                        const defaultTitle = `Birleştirilmiş Not - ${new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}`;
                        setMergedNoteTitle(defaultTitle);
                        setShowMergeConfirmModal(true);
                      }}
                      disabled={selectedNoteSetIds.length < 2}
                      className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:pointer-events-none text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      Birleştir
                    </button>
                    <button
                      onClick={() => {
                        setIsMergingNotes(false);
                        setSelectedNoteSetIds([]);
                      }}
                      className="px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-xl text-xs font-semibold transition cursor-pointer"
                    >
                      İptal
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                      <ClipboardList className="text-emerald-400" size={20} />
                      Notlarım
                    </h2>
                    <p className="text-xs text-zinc-400 mt-0.5">Toplam {noteSets.length} not seti</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button 
                      onClick={() => {
                        setIsMergingNotes(true);
                        setSelectedNoteSetIds([]);
                      }}
                      disabled={noteSets.length < 2}
                      className="p-1.5 bg-zinc-900 border border-zinc-805 text-zinc-400 hover:text-white disabled:opacity-40 disabled:pointer-events-none rounded-xl transition cursor-pointer"
                      title="Not Setlerini Birleştir"
                    >
                      <GitMerge size={15} />
                    </button>
                    <button 
                      onClick={handleExportNotes}
                      disabled={noteSets.length === 0}
                      className="p-1.5 bg-zinc-900 border border-zinc-805 text-zinc-400 hover:text-white disabled:opacity-40 disabled:pointer-events-none rounded-xl transition cursor-pointer"
                      title="Notları TXT Olarak Dışa Aktar"
                    >
                      <Download size={15} />
                    </button>
                    <label 
                      className="p-1.5 bg-zinc-900 border border-zinc-805 text-zinc-400 hover:text-white rounded-xl cursor-pointer transition flex items-center justify-center m-0"
                      title="TXT Dosyası İçe Aktar"
                    >
                      <Upload size={15} />
                      <input 
                        type="file" 
                        accept=".txt,text/plain" 
                        onClick={(e) => { (e.target as HTMLInputElement).value = '' }} 
                        className="hidden" 
                        onChange={handleImportNotes} 
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Not Arama Çubuğu */}
              {noteSets.length > 0 && (
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Not ara (başlık veya içerik)..."
                    value={notesSearchQuery}
                    onChange={(e) => setNotesSearchQuery(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-900 rounded-xl pl-9 pr-8 py-2 text-xs text-zinc-300 placeholder-zinc-500 focus:border-emerald-500/50 outline-none transition"
                  />
                  {notesSearchQuery && (
                    <button
                      onClick={() => setNotesSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              )}

              {noteSets.length === 0 ? (
                <div className="bg-zinc-950 border border-zinc-900 rounded-[2rem] p-8 text-center flex-1 flex flex-col items-center justify-center min-h-[350px]">
                  <div className="w-14 h-14 bg-emerald-950/40 border border-emerald-800/30 text-emerald-400 rounded-full flex items-center justify-center mb-4">
                    <FileText size={26} />
                  </div>
                  <h3 className="text-sm font-bold text-zinc-300">Henüz Not Yok</h3>
                  <p className="text-xs text-zinc-500 mt-2 max-w-xs leading-relaxed mb-5">
                    Quiz yaparken sağ alttaki <strong className="text-blue-400 font-medium">"Kelime Kopyala"</strong> butonuna basın, kopyalama formatı kısmından <strong className="text-emerald-400 font-medium">"Not Al"</strong> seçeneğini seçip dilediğiniz kelimeleri buraya set olarak kaydedin!
                  </p>
                  <label className="px-4 py-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 hover:border-zinc-700 text-zinc-300 text-xs font-semibold rounded-xl cursor-pointer transition flex items-center gap-2">
                    <Upload size={14} className="text-emerald-400" />
                    TXT Dosyası İçe Aktar
                    <input 
                      type="file" 
                      accept=".txt,text/plain" 
                      onClick={(e) => { (e.target as HTMLInputElement).value = '' }} 
                      className="hidden" 
                      onChange={handleImportNotes} 
                    />
                  </label>
                </div>
              ) : filteredNoteSets.length === 0 ? (
                <div className="bg-zinc-950 border border-zinc-900 rounded-[2rem] p-8 text-center flex-1 flex flex-col items-center justify-center min-h-[350px]">
                  <div className="w-14 h-14 bg-zinc-900 border border-zinc-900 text-zinc-500 rounded-full flex items-center justify-center mb-4">
                    <Search size={24} />
                  </div>
                  <h3 className="text-sm font-bold text-zinc-300">Sonuç Bulunamadı</h3>
                  <p className="text-xs text-zinc-500 mt-2 max-w-xs leading-relaxed">
                    Aramanıza uygun not başlığı veya içeriği bulunamadı. Lütfen farklı bir arama yapın.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5 max-h-[70vh] overflow-y-auto pr-1">
                  {filteredNoteSets.map((set) => {
                    const isSelected = isMergingNotes 
                      ? selectedNoteSetIds.includes(set.id) 
                      : activeNoteSetId === set.id;
                    return (
                      <div
                        key={set.id}
                        onClick={() => {
                          if (isMergingNotes) {
                            if (selectedNoteSetIds.includes(set.id)) {
                              setSelectedNoteSetIds(selectedNoteSetIds.filter(id => id !== set.id));
                            } else {
                              setSelectedNoteSetIds([...selectedNoteSetIds, set.id]);
                            }
                          } else {
                            setActiveNoteSetId(set.id);
                          }
                        }}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer relative group text-left ${
                          isSelected 
                            ? 'bg-emerald-950/20 border-emerald-500/50 shadow-md shadow-emerald-950/20' 
                            : 'bg-zinc-950 border-zinc-900 hover:border-zinc-805 hover:bg-zinc-900/50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          {editingNoteId === set.id ? (
                            <input
                              type="text"
                              value={editingNoteTitle}
                              onChange={(e) => setEditingNoteTitle(e.target.value)}
                              onBlur={() => {
                                if (editingNoteTitle.trim()) {
                                  setNoteSets(noteSets.map(n => n.id === set.id ? { ...n, title: editingNoteTitle.trim() } : n));
                                }
                                setEditingNoteId(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  if (editingNoteTitle.trim()) {
                                    setNoteSets(noteSets.map(n => n.id === set.id ? { ...n, title: editingNoteTitle.trim() } : n));
                                  }
                                  setEditingNoteId(null);
                                }
                              }}
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                              className="bg-black border border-emerald-500 rounded px-1.5 py-0.5 text-xs text-zinc-200 font-medium w-full focus:outline-none"
                            />
                          ) : (
                            <span className="font-semibold text-zinc-200 group-hover:text-emerald-400 block transition-colors text-sm truncate pr-8" title={set.title}>
                              {set.title}
                            </span>
                          )}

                          {isMergingNotes ? (
                            <div className="absolute right-3 top-3.5 z-20" onClick={(e) => e.stopPropagation()}>
                              <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                                selectedNoteSetIds.includes(set.id) 
                                  ? 'bg-emerald-500 border-emerald-500 text-black shadow-md' 
                                  : 'border-zinc-700 bg-zinc-950'
                              }`}>
                                {selectedNoteSetIds.includes(set.id) && (
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3 h-3">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                  </svg>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="absolute right-2 top-2.5 z-20" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenNoteDropdownId(openNoteDropdownId === set.id ? null : set.id);
                                }}
                                className="p-1 text-zinc-500 hover:text-white hover:bg-zinc-900 rounded-lg transition"
                                title="Seçenekler"
                              >
                                <MoreVertical size={16} />
                              </button>

                              {openNoteDropdownId === set.id && (
                                <div className="absolute right-0 mt-1 w-32 bg-zinc-950 border border-zinc-800 rounded-xl shadow-xl z-30 overflow-hidden py-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenNoteDropdownId(null);
                                      setEditingNoteId(set.id);
                                      setEditingNoteTitle(set.title);
                                    }}
                                    className="w-full px-3 py-2 text-left text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-900 transition-colors flex items-center gap-2"
                                  >
                                    <Edit2 size={12} className="text-blue-400" />
                                    İsim Değiştir
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenNoteDropdownId(null);
                                      setNoteToDelete(set);
                                    }}
                                    className="w-full px-3 py-2 text-left text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-950/20 transition-colors flex items-center gap-2"
                                  >
                                    <Trash2 size={12} className="text-red-400" />
                                    Sil
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <p className="text-xs text-zinc-400 font-mono truncate mt-1.5 pr-2">
                          {set.content}
                        </p>
                        
                        <span className="text-[10px] text-zinc-600 font-medium mt-1.5 block">
                          {new Date(set.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Note Detail / Notepad Canvas */}
            <div className={`flex-1 flex flex-col bg-zinc-950 border border-zinc-900 rounded-[2rem] overflow-hidden ${!activeNoteSetId ? 'hidden md:flex items-center justify-center p-8' : 'flex'}`}>
              {activeNoteSetId ? (
                (() => {
                  const activeNote = noteSets.find(n => n.id === activeNoteSetId);
                  if (!activeNote) return null;
                  return (
                    <div className="flex-1 flex flex-col w-full h-full">
                      {/* Notepad Header */}
                      <div className="p-5 border-b border-zinc-900 flex items-center justify-between bg-zinc-950/80 backdrop-blur-sm">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setActiveNoteSetId(null)}
                            className="md:hidden p-1.5 text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-850 rounded-xl transition cursor-pointer"
                          >
                            <ChevronLeft size={16} />
                          </button>
                          <div>
                            <h3 className="font-bold text-zinc-100 text-sm md:text-base">{activeNote.title}</h3>
                            <span className="text-[10px] text-zinc-500">
                              {new Date(activeNote.date).toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} tarihinde oluşturuldu
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(activeNote.content)
                                .then(() => {
                                  setToastMessage("Not kopyalandı!");
                                  setTimeout(() => setToastMessage(null), 2000);
                                });
                            }}
                            className="p-2 text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-850 rounded-xl transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer border border-zinc-850"
                            title="Notu Panoya Kopyala"
                          >
                            <Copy size={14} />
                            <span>Kopyala</span>
                          </button>
                        </div>
                      </div>

                      {/* Notepad Reading / Writing Canvas */}
                      <div className="flex-1 p-6 relative flex flex-col min-h-[300px]">
                        {/* Notepad Paper grid layout decoration */}
                        <div className="absolute inset-x-0 top-0 bottom-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(16,185,129,0.3)_1px,transparent_1px)] bg-[size:100%_28px]"></div>
                        
                        <textarea
                          value={activeNote.content}
                          onChange={(e) => {
                            setNoteSets(noteSets.map(n => n.id === activeNote.id ? { ...n, content: e.target.value } : n));
                          }}
                          className="w-full flex-1 bg-transparent text-zinc-300 font-mono text-sm leading-[28px] resize-none focus:outline-none focus:ring-0 select-text z-10 pt-1"
                          placeholder="Not içeriğini yazın..."
                          style={{
                            backgroundImage: 'linear-gradient(rgba(228,228,231,0.04) 1px, transparent 1px)',
                            backgroundSize: '100% 28px',
                          }}
                        />
                      </div>
                      
                      <div className="p-3 bg-zinc-900/10 border-t border-zinc-900 flex justify-between items-center px-6">
                        <span className="text-[10px] text-zinc-500 font-mono font-medium">Satırlar otomatik güncellenir</span>
                        <span className="text-[10px] text-zinc-400 font-semibold">{activeNote.content.split(/\s+/).filter(Boolean).length} kelime / {activeNote.content.length} karakter</span>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="text-center p-8 max-w-sm">
                  <div className="w-16 h-16 bg-zinc-900 border border-zinc-850 text-zinc-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ClipboardList size={30} />
                  </div>
                  <h3 className="text-sm font-bold text-zinc-400">Not Detayları</h3>
                  <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                    İçeriğini görüntülemek, düzenlemek veya kopyalamak için soldaki listeden bir not seti seçin.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </main>

      {/* Save Word Custom Modal */}
      {wordToSave && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 w-full max-w-sm shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500"></div>
            <h3 className="text-xl font-bold text-white mb-2">Kelimeyi Kaydet</h3>
            <p className="text-zinc-400 mb-6 text-sm">
              "<span className="text-amber-400 font-semibold text-base">{wordToSave}</span>" kelimesinin Türkçe anlamını girin.
            </p>
            <input
              type="text"
              value={meaningInput}
              onChange={(e) => setMeaningInput(e.target.value)}
              className="w-full bg-black border-2 border-zinc-700 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:border-amber-500 mb-6 font-medium"
              placeholder="Örn: Elma"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveCustomWord();
              }}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setWordToSave(null);
                  setMeaningInput('');
                }}
                className="px-5 py-2.5 text-zinc-400 hover:text-zinc-200 font-semibold transition"
              >
                İptal
              </button>
              <button
                onClick={handleSaveCustomWord}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-semibold transition shadow-sm"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Çoklu Kopyalama Türü Seçim Modalı */}
      {showCopyFormatPicker && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[80] backdrop-blur-sm">
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-md flex flex-col shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
            
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <FileText size={20} className="text-emerald-400" />
                Not Alma Türü Seçimi
              </h3>
              <button 
                onClick={() => setShowCopyFormatPicker(false)}
                className="text-zinc-500 hover:text-white transition-colors p-1 cursor-pointer"
                aria-label="Kapat"
              >
                <XCircle size={22} />
              </button>
            </div>
            
            <div className="p-6 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block mb-2 font-mono">NOT METNİ OLUŞTURMA BİÇİMİ</span>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    onClick={() => {
                      setNoteFormat('word');
                      setIsNoteMode(true);
                      setNoteSelectedWords([]);
                      setIsCopyWordMode(false);
                      setCopySelectedWords([]);
                      setShowCopyFormatPicker(false);
                    }}
                    className="w-full flex items-start gap-3 p-3 bg-zinc-900 hover:bg-zinc-850 border border-zinc-850 hover:border-emerald-500/40 rounded-xl transition-all group text-left cursor-pointer"
                  >
                    <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg mt-0.5 group-hover:bg-emerald-500/20 transition-colors">
                      <BookmarkPlus size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-white group-hover:text-emerald-400 block transition-colors text-xs">Kelime Olarak Not Al</span>
                      <span className="text-[10px] text-zinc-400 mt-0.5 block">Kelimeler notunuza virgülle ayrılmış bir liste olarak kaydedilir.</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setNoteFormat('sentence');
                      setIsNoteMode(true);
                      setNoteSelectedWords([]);
                      setIsCopyWordMode(false);
                      setCopySelectedWords([]);
                      setShowCopyFormatPicker(false);
                    }}
                    className="w-full flex items-start gap-3 p-3 bg-zinc-900 hover:bg-zinc-850 border border-zinc-850 hover:border-emerald-500/40 rounded-xl transition-all group text-left cursor-pointer"
                  >
                    <div className="p-1.5 bg-teal-500/10 text-teal-400 rounded-lg mt-0.5 group-hover:bg-teal-500/20 transition-colors">
                      <Type size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-white group-hover:text-teal-400 block transition-colors text-xs">Cümle Olarak Not Al</span>
                      <span className="text-[10px] text-zinc-400 mt-0.5 block">Kelimeler notunuza düz cümle yapısında, boşluklarla kaydedilir.</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 bg-zinc-900/20 border-t border-zinc-800/40 flex justify-end gap-2.5">
              <button
                onClick={() => setShowCopyFormatPicker(false)}
                className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl font-semibold transition text-sm cursor-pointer"
              >
                Vazgeç
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Soru Kopyalama Modalı */}
      {showCopyModal && currentItem && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[70] backdrop-blur-sm">
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-md flex flex-col shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
            
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Copy size={20} className="text-indigo-400" />
                Soruyu Kopyala
              </h3>
              <button 
                onClick={() => setShowCopyModal(false)}
                className="text-zinc-500 hover:text-white transition-colors p-1 cursor-pointer"
                aria-label="Kapat"
              >
                <XCircle size={22} />
              </button>
            </div>
            
            <div className="p-6 flex flex-col gap-4">
              <p className="text-sm text-zinc-400">
                Soruyu kopyalamak istediğiniz formatı seçin:
              </p>
              
              <div className="p-4 bg-zinc-900/40 rounded-2xl border border-zinc-850 space-y-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 block">TÜRKÇE KARŞILIĞI</span>
                  <p className="text-sm text-zinc-300 font-medium line-clamp-2 mt-0.5">{currentItem.turkish}</p>
                </div>
                <div className="pt-2 border-t border-zinc-800/40">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 block">İNGİLİZCE KARŞILIĞI</span>
                  <p className="text-sm text-zinc-300 font-medium line-clamp-2 mt-0.5">{currentItem.english}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2.5 mt-2">
                <button
                  onClick={() => handleCopyQuestion('english')}
                  className="w-full flex items-center justify-between p-4 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-indigo-500/40 rounded-2xl transition-all group text-left cursor-pointer"
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <span className="font-semibold text-white group-hover:text-indigo-400 block transition-colors text-sm">İngilizce</span>
                    <span className="text-xs text-zinc-400 mt-0.5 block truncate">{currentItem.english}</span>
                  </div>
                  <ChevronRight size={18} className="text-zinc-500 group-hover:text-indigo-400 transition-colors shrink-0" />
                </button>

                <button
                  onClick={() => handleCopyQuestion('turkish')}
                  className="w-full flex items-center justify-between p-4 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-indigo-500/40 rounded-2xl transition-all group text-left cursor-pointer"
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <span className="font-semibold text-white group-hover:text-indigo-400 block transition-colors text-sm">Türkçe</span>
                    <span className="text-xs text-zinc-400 mt-0.5 block truncate">{currentItem.turkish}</span>
                  </div>
                  <ChevronRight size={18} className="text-zinc-500 group-hover:text-indigo-400 transition-colors shrink-0" />
                </button>

                <button
                  onClick={() => handleCopyQuestion('both')}
                  className="w-full flex items-center justify-between p-4 bg-indigo-950/10 hover:bg-indigo-950/30 border border-indigo-900/30 hover:border-indigo-500/50 rounded-2xl transition-all group text-left cursor-pointer"
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <span className="font-semibold text-indigo-300 group-hover:text-indigo-200 block transition-colors text-sm">Hem İngilizce hem Türkçe</span>
                    <span className="text-xs text-indigo-200/40 mt-0.5 block truncate">{currentItem.english} = {currentItem.turkish}</span>
                  </div>
                  <ChevronRight size={18} className="text-indigo-400 group-hover:text-indigo-300 transition-colors shrink-0" />
                </button>
              </div>
            </div>

            <div className="p-4 bg-zinc-900/20 border-t border-zinc-800/40 flex justify-end">
              <button
                onClick={() => setShowCopyModal(false)}
                className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl font-semibold transition text-sm cursor-pointer"
              >
                Geri Dön
              </button>
            </div>
          </div>
        </div>
      )}



      {/* Multi-Word Note Helper Bar */}
      {isNoteMode && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 w-[92%] max-w-md bg-zinc-950/95 border border-emerald-500/30 rounded-2xl shadow-2xl z-40 backdrop-blur-md p-3.5 flex flex-col gap-2.5 animate-[fadeIn_0.2s_ease-out]">
          <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
            <span className="text-white text-xs font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
              Not Al: Çoklu {noteFormat === 'word' ? 'Kelime' : 'Cümle'} Seçimi ({noteSelectedWords.length} Seçildi)
            </span>
            <button 
              onClick={() => {
                setIsNoteMode(false);
                setNoteSelectedWords([]);
              }}
              className="text-zinc-500 hover:text-white transition-colors text-[10px] font-semibold px-2 py-0.5 bg-zinc-905 hover:bg-zinc-800 rounded-md cursor-pointer border border-zinc-800"
            >
              Kapat
            </button>
          </div>
          
            <div className="flex gap-2 items-center">
            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 shrink-0">NOT METNİ:</span>
            <div className="flex-1 px-2.5 py-1 bg-zinc-900 border border-zinc-850 rounded-xl max-h-[44px] overflow-y-auto text-zinc-300 text-xs font-mono truncate">
              {noteSelectedWords.length > 0 ? (
                noteFormat === 'word' 
                  ? noteSelectedWords.map(w => w.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").trim()).join(', ') 
                  : noteSelectedWords.join(' ')
              ) : (
                <span className="text-zinc-500 italic text-[11px]">Kelimelere tıklayarak ekleyin...</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-0.5">
            <button
               onClick={() => {
                 setIsNoteMode(false);
                 setNoteSelectedWords([]);
               }}
               className="w-full py-2 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white border border-zinc-805 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              Vazgeç (Kaydetme)
            </button>
            <button
              onClick={() => {
                if (noteSelectedWords.length === 0) {
                  setToastMessage("Not kaydetmek için en az bir kelime seçin.");
                  setTimeout(() => setToastMessage(null), 2500);
                  return;
                }
                const textToSave = noteFormat === 'word' 
                  ? noteSelectedWords.map(w => w.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").trim()).join(', ') 
                  : noteSelectedWords.join(' ');
                setTempNoteText(textToSave);
                setNoteTitleInput(`Not Seti #${noteSets.length + 1}`);
                setNoteSaveTarget('new');
                setSelectedSaveNoteIds(activeNoteSetId ? [activeNoteSetId] : []);
                setShowNoteSaveModal(true);
              }}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-md shadow-emerald-900/40"
            >
              Kaydet (Not Al)
            </button>
          </div>
        </div>
      )}

      {/* Note Set Save Modal */}
      {showNoteSaveModal && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-[90] backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 w-full max-w-sm shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <ClipboardList size={22} className="text-emerald-400" />
              Notu Kaydet
            </h3>
            <p className="text-zinc-400 mb-4 text-xs">
              {noteSaveTarget === 'new' 
                ? "Bu kelime grubunu yeni bir set olarak notlarınıza kaydedin. Sete bir isim verin:"
                : "Bu kelime grubunu mevcut not setlerinizin içerisine ekleyin. İstediğiniz setleri seçin:"}
            </p>

            {noteSets.length > 0 && (
              <div className="flex bg-black p-1 rounded-xl mb-4 border border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => setNoteSaveTarget('new')}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    noteSaveTarget === 'new'
                      ? 'bg-zinc-800 text-emerald-400 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Yeni Set Oluştur
                </button>
                <button
                  type="button"
                  onClick={() => setNoteSaveTarget('existing')}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    noteSaveTarget === 'existing'
                      ? 'bg-zinc-800 text-emerald-400 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Mevcut Sete Ekle
                </button>
              </div>
            )}
            
            <div className="space-y-4 mb-6">
              {noteSaveTarget === 'new' || noteSets.length === 0 ? (
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">NOT BAŞLIĞI</label>
                  <input
                    type="text"
                    value={noteTitleInput}
                    onChange={(e) => setNoteTitleInput(e.target.value)}
                    className="w-full bg-black border-2 border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:border-emerald-500 font-medium text-sm"
                    placeholder="Örn: Meyveler Listesi"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveNoteSet();
                    }}
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">YÜKLENECEK SETLERİ SEÇİN</label>
                  <div className="flex flex-col gap-1.5 max-h-[140px] overflow-y-auto bg-black p-2 rounded-xl border border-zinc-800">
                    {noteSets.map((set) => {
                      const isChecked = selectedSaveNoteIds.includes(set.id);
                      return (
                        <label
                          key={set.id}
                          className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition select-none ${
                            isChecked
                              ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-400'
                              : 'bg-zinc-900/60 border-zinc-850 text-zinc-300 hover:bg-zinc-850'
                          }`}
                        >
                          <span className="font-medium truncate pr-2">{set.title}</span>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setSelectedSaveNoteIds(selectedSaveNoteIds.filter(id => id !== set.id));
                              } else {
                                setSelectedSaveNoteIds([...selectedSaveNoteIds, set.id]);
                              }
                            }}
                            className="rounded border-zinc-800 bg-black text-emerald-500 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">NOT İÇERİĞİ (ÖNİZLEME)</label>
                <div className="w-full bg-zinc-950 border border-zinc-850 text-zinc-300 font-mono text-xs p-3 rounded-xl max-h-20 overflow-y-auto break-all">
                  {tempNoteText}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowNoteSaveModal(false);
                }}
                className="px-5 py-2.5 text-zinc-400 hover:text-zinc-200 font-semibold transition text-sm cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleSaveNoteSet}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition shadow-md shadow-emerald-950 text-sm cursor-pointer"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Note Merge Confirmation Modal */}
      {showMergeConfirmModal && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-[95] backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]">
          <div className="bg-zinc-900 border border-zinc-805 rounded-3xl p-6 sm:p-8 w-full max-w-sm shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-600"></div>
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <GitMerge size={20} className="text-emerald-400" />
              Not Setlerini Birleştir
            </h3>
            <p className="text-zinc-400 text-xs mb-4 leading-relaxed">
              Seçilen <strong className="text-emerald-400 font-bold">{selectedNoteSetIds.length}</strong> not setini birleştirmek için yeni setin başlığını girin. Seçilen orijinal notlar silinecektir.
            </p>

            <div className="mb-6">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Yeni Not Seti Başlığı</label>
              <input
                type="text"
                value={mergedNoteTitle}
                onChange={(e) => setMergedNoteTitle(e.target.value)}
                placeholder="Örn: Hafta 1 Kelimeleri"
                className="w-full bg-black border border-zinc-850 hover:border-emerald-500/50 focus:border-emerald-500 transition-colors rounded-xl px-3 py-2.5 text-xs text-zinc-200 focus:outline-none font-semibold"
                autoFocus
              />
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowMergeConfirmModal(false)}
                className="px-4 py-2 hover:bg-zinc-850 rounded-xl text-zinc-400 hover:text-zinc-100 font-semibold transition text-sm cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                onClick={() => {
                  const title = mergedNoteTitle.trim() || `Birleştirilmiş Not Seti`;
                  
                  // Collect the sets to merge
                  const setsToMerge = noteSets.filter(n => selectedNoteSetIds.includes(n.id));
                  
                  // Sort them by original date order or original list order
                  const mergedContent = setsToMerge
                    .map(set => {
                      let text = set.content.trim();
                      if (text.endsWith(',')) {
                        text = text.substring(0, text.length - 1).trim();
                      }
                      return text;
                    })
                    .filter(Boolean)
                    .join(', ');
                  
                  const newMergedSet: NoteSet = {
                    id: Date.now().toString() + Math.random().toString(36).substring(7),
                    title: title,
                    content: mergedContent,
                    date: Date.now()
                  };

                  // Filter out merged ones and insert the new merged one
                  const filteredSets = noteSets.filter(n => !selectedNoteSetIds.includes(n.id));
                  const updatedSets = [newMergedSet, ...filteredSets];
                  
                  setNoteSets(updatedSets);
                  setActiveNoteSetId(newMergedSet.id);
                  setIsMergingNotes(false);
                  setSelectedNoteSetIds([]);
                  setShowMergeConfirmModal(false);
                  
                  setToastMessage(`"${title}" başarıyla birleştirildi.`);
                  setTimeout(() => setToastMessage(null), 2500);
                }}
                disabled={!mergedNoteTitle.trim()}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:pointer-events-none text-white rounded-xl font-bold transition shadow-md shadow-emerald-950/40 text-sm cursor-pointer"
              >
                Birleştir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Note Delete Confirmation Modal */}
      {noteToDelete && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-[95] backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-805 rounded-3xl p-6 sm:p-8 w-full max-w-sm shadow-2xl relative overflow-hidden animate-[fadeIn_0.15s_ease-out]">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 to-rose-600"></div>
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2 animate-[shake_0.5s_ease-in-out]">
              <Trash2 size={20} className="text-red-400 animate-pulse" />
              Not Setini Sil?
            </h3>
            <p className="text-zinc-400 text-xs mb-6 leading-relaxed">
              <span className="text-zinc-200 font-bold block mb-1.5 truncate">"{noteToDelete.title}"</span>
              isimli not setini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
            </p>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setNoteToDelete(null)}
                className="px-4 py-2 hover:bg-zinc-850 rounded-xl text-zinc-400 hover:text-zinc-100 font-semibold transition text-sm cursor-pointer"
              >
                Hayır, Vazgeç
              </button>
              <button
                onClick={() => {
                  setNoteSets(noteSets.filter(n => n.id !== noteToDelete.id));
                  if (activeNoteSetId === noteToDelete.id) {
                    setActiveNoteSetId(null);
                  }
                  setToastMessage(`"${noteToDelete.title}" başarıyla silindi.`);
                  setTimeout(() => setToastMessage(null), 2500);
                  setNoteToDelete(null);
                }}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition shadow-md shadow-red-950/40 text-sm cursor-pointer"
              >
                Evet, Sil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Toast Message */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-emerald-900/90 border border-emerald-500 text-emerald-100 px-6 py-3 rounded-2xl shadow-lg flex items-center gap-3 z-50 animate-[bounce_0.3s_ease-out]">
          <CheckCircle2 size={20} className="text-emerald-400" />
          <span className="font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Vocab Dictionary Modal */}
      {showVocabModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[60] backdrop-blur-sm">
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500"></div>
            
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/20 text-amber-500 rounded-xl">
                  <Library size={24} />
                </div>
                <h2 className="text-xl font-bold text-white">Kelime Sözlüğüm</h2>
              </div>
              <button 
                onClick={() => {
                  setShowVocabModal(false);
                  setEditingVocabItemId(null);
                  setDeleteConfirmId(null);
                }}
                className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-xl transition"
              >
                <XCircle size={24} />
              </button>
            </div>
            
            <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-900/30 flex flex-col sm:flex-row gap-4 items-center justify-between">
               <div className="relative w-full sm:w-auto flex-1 max-w-sm">
                 <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                 <input 
                   type="text" 
                   placeholder="Kelime veya anlam ara..." 
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   className="w-full bg-black border border-zinc-700 rounded-xl pl-10 pr-4 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-500 transition"
                 />
               </div>
               <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-between sm:justify-end items-center">
                 <span className="text-sm font-medium text-zinc-400 self-center hidden lg:block mr-2">
                   <strong>{savedVocab.length}</strong> kelime
                 </span>
                 
                 {savedVocab.length > 0 && (
                   showClearVocabConfirm ? (
                     <div className="flex items-center gap-1 bg-red-950/20 px-2 py-1 rounded-lg border border-red-900/50">
                       <span className="text-xs text-red-400 font-medium hidden sm:inline mr-1">Emin misiniz?</span>
                       <button onClick={handleClearVocab} className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded">Evet</button>
                       <button onClick={() => setShowClearVocabConfirm(false)} className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded">İptal</button>
                     </div>
                   ) : (
                     <button 
                      onClick={() => setShowClearVocabConfirm(true)}
                      className="px-3 py-1.5 bg-zinc-900 border border-red-900/30 hover:border-red-900/80 hover:bg-red-950/20 text-red-400 text-sm font-medium rounded-lg flex items-center gap-2 transition"
                      title="Sözlüğü Temizle"
                     >
                      <Trash2 size={16} /> <span className="hidden sm:inline">Sil</span>
                     </button>
                   )
                 )}

                 <button 
                  onClick={() => setIsAddingNewWord(true)}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition"
                 >
                  <Plus size={16} /> <span className="hidden sm:inline">Ekle</span>
                 </button>
                 <button 
                  onClick={handleExportVocab}
                  className="px-3 py-1.5 bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-zinc-300 text-sm font-medium rounded-lg flex items-center gap-2 transition"
                 >
                  <Download size={16} /> <span className="hidden xl:inline">Dışa Aktar</span>
                 </button>
                 <label className="px-3 py-1.5 bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-zinc-300 text-sm font-medium rounded-lg flex items-center gap-2 cursor-pointer transition">
                  <Upload size={16} /> <span className="hidden xl:inline">İçe Aktar</span>
                  <input type="file" accept=".txt,text/plain" onClick={(e) => { (e.target as HTMLInputElement).value = '' }} className="hidden" onChange={handleImportVocab} />
                 </label>
               </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {isAddingNewWord && (
                <div className="bg-zinc-900 border border-amber-500/50 p-4 rounded-2xl mb-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                  <input
                    type="text"
                    placeholder="İngilizce kelime..."
                    className="flex-1 w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:border-amber-500 focus:outline-none"
                    value={newManualWord.word}
                    onChange={(e) => setNewManualWord({...newManualWord, word: e.target.value})}
                    autoFocus
                  />
                  <input
                    type="text"
                    placeholder="Anlamı..."
                    className="flex-1 w-full bg-black border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:border-amber-500 focus:outline-none"
                    value={newManualWord.meaning}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveManualWord()}
                    onChange={(e) => setNewManualWord({...newManualWord, meaning: e.target.value})}
                  />
                  <div className="flex gap-2 w-full sm:w-auto justify-end">
                    <button onClick={() => setIsAddingNewWord(false)} className="px-3 py-2 text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition">
                       İptal
                    </button>
                    <button onClick={handleSaveManualWord} className="px-3 py-2 text-white bg-amber-600 hover:bg-amber-500 rounded-lg flex items-center gap-1 text-sm font-medium transition">
                       Kaydet
                    </button>
                  </div>
                </div>
              )}
              {savedVocab.length === 0 ? (
                <div className="text-center py-12">
                  <BookmarkPlus size={48} className="mx-auto text-zinc-700 mb-4" />
                  <p className="text-lg font-medium text-zinc-400">Henüz kaydedilmiş bir kelime yok.</p>
                  <p className="text-sm text-zinc-500 mt-2">Quiz ekranında bilmediğiniz kelimeleri kaydedebilirsiniz.</p>
                </div>
              ) : filteredVocab.length === 0 ? (
                <div className="text-center py-12">
                  <Search size={48} className="mx-auto text-zinc-700 mb-4" />
                  <p className="text-lg font-medium text-zinc-400">Sonuç bulunamadı.</p>
                </div>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {filteredVocab.slice(0, visibleCount).map((item) => {
                      const isEditingThis = editingVocabItemId === item.id;
                      const isPendingDelete = deleteConfirmId === item.id;
                      return (
                        <div key={item.id} className={`relative bg-zinc-900 border ${isEditingThis ? 'border-amber-500/50 ring-1 ring-amber-500/30' : 'border-zinc-800'} p-5 rounded-2xl flex flex-col transition-all duration-200`}>
                          {isEditingThis ? (
                            <div className="w-full flex flex-col gap-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <label className="text-xs text-zinc-400 font-medium mb-1.5 block">İngilizce Kelime</label>
                                  <input 
                                    type="text" 
                                    value={vocabItemEditLeft} 
                                    onChange={(e) => setVocabItemEditLeft(e.target.value)}
                                    className="w-full bg-black border border-zinc-700 focus:border-amber-500 rounded-xl px-4 py-2.5 text-sm text-zinc-200 outline-none"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-zinc-400 font-medium mb-1.5 block">Türkçe Anlamı</label>
                                  <input 
                                    type="text" 
                                    value={vocabItemEditRight} 
                                    onChange={(e) => setVocabItemEditRight(e.target.value)}
                                    className="w-full bg-black border border-zinc-700 focus:border-amber-500 rounded-xl px-4 py-2.5 text-sm text-zinc-200 outline-none"
                                  />
                                </div>
                              </div>
                              <div className="flex gap-2 justify-end pt-2 border-t border-zinc-800/60 mt-2">
                                <button 
                                  onClick={() => setEditingVocabItemId(null)}
                                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold rounded-xl text-xs transition"
                                >
                                  Kaydetme
                                </button>
                                <button 
                                  onClick={() => handleSaveVocabWord(item.id)}
                                  disabled={!vocabItemEditLeft.trim() || !vocabItemEditRight.trim()}
                                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold rounded-xl text-xs transition"
                                >
                                  Kaydet
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex justify-between items-start w-full gap-4">
                              <div className="min-w-0 flex-1">
                                <h4 className="text-lg font-bold text-amber-400 mb-1 break-words leading-tight">{item.word}</h4>
                                <p className="text-zinc-300 font-medium break-words leading-relaxed">{item.meaning}</p>
                                <span className="text-xs text-zinc-600 mt-2 block font-mono">
                                  {new Date(item.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </span>
                              </div>
                              
                              {isPendingDelete ? (
                                <div className="absolute inset-0 bg-zinc-900 flex items-center p-5 rounded-2xl border border-red-500/50 z-10 gap-3 animate-fade-in select-none">
                                  <span className="text-sm text-red-100 font-semibold flex-1 text-left whitespace-normal">Bu kelimeyi silmek istediğinize emin misiniz?</span>
                                  <div className="flex gap-2 justify-end">
                                    <button 
                                      onClick={() => { handleDeleteVocab(item.id); setDeleteConfirmId(null); }} 
                                      className="px-3.5 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition shrink-0"
                                    >
                                      Evet
                                    </button>
                                    <button 
                                      onClick={() => setDeleteConfirmId(null)} 
                                      className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-xl transition shrink-0"
                                    >
                                      Hayır
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 shrink-0">
                                  <button 
                                    onClick={() => handleStartVocabEdit(item)}
                                    className="p-2 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition"
                                    title="Düzenle"
                                  >
                                    <Edit2 size={16} />
                                  </button>
                                  <button 
                                    onClick={() => setDeleteConfirmId(item.id)} 
                                    className="p-2 text-white hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                                    title="Sil"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {visibleCount < filteredVocab.length && (
                    <div className="mt-6 flex justify-center">
                      <button 
                        onClick={() => setVisibleCount(c => c + 50)}
                        className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium rounded-xl transition"
                      >
                        Daha Fazla Göster ({filteredVocab.length - visibleCount} kaldı)
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
