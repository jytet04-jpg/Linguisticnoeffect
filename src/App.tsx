import React, { useState, useEffect, useMemo } from 'react';
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
  Plus
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { loadData, saveData, parseTextData, QuizItem, DEFAULT_TEXT_DATA } from './dataStore';

type AppMode = 'quiz' | 'manage';

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

export default function App() {
  const [mode, setMode] = useState<AppMode>('quiz');
  const [dataText, setDataText] = useState(DEFAULT_TEXT_DATA);
  const [quizItems, setQuizItems] = useState<QuizItem[]>([]);
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [shuffledOptions, setShuffledOptions] = useState<{id: string, word: string}[]>([]);
  const [score, setScore] = useState(0);
  const [errorWord, setErrorWord] = useState<string | null>(null);
  const [isSaveWordMode, setIsSaveWordMode] = useState(false);
  const [wordToSave, setWordToSave] = useState<string | null>(null);
  const [meaningInput, setMeaningInput] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  const [savedVocab, setSavedVocab] = useState<SavedWord[]>([]);
  const [showVocabModal, setShowVocabModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingNewWord, setIsAddingNewWord] = useState(false);
  const [newManualWord, setNewManualWord] = useState({ word: '', meaning: '' });

  // Initialize data
  useEffect(() => {
    const text = loadData();
    setDataText(text);
    const parsed = parseTextData(text);
    if (parsed.length > 0) {
      setQuizItems(shuffleArray(parsed));
    }

    const storedVocab = localStorage.getItem('language-app-saved-vocab');
    if (storedVocab) {
      try {
        setSavedVocab(JSON.parse(storedVocab));
      } catch (e) {
        console.error("Failed to parse vocab", e);
      }
    }
  }, []);

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

  const handleSaveData = () => {
    saveData(dataText);
    const parsed = parseTextData(dataText);
    setQuizItems(shuffleArray(parsed));
    setCurrentQuestionIndex(0);
    setScore(0);
    setMode('quiz');
  };

  const resetToDefault = () => {
    setDataText(DEFAULT_TEXT_DATA);
    saveData(DEFAULT_TEXT_DATA);
    const parsed = parseTextData(DEFAULT_TEXT_DATA);
    setQuizItems(shuffleArray(parsed));
    setCurrentQuestionIndex(0);
    setScore(0);
  };

  const handleExport = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const fileName = 'english_sentences.txt';
        
        // Write file to device cache
        const result = await Filesystem.writeFile({
          path: fileName,
          data: dataText,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });

        // Share the file (which allows saving to files, sending via apps, etc.)
        await Share.share({
          title: 'Offline English Data',
          text: 'Here is your english sentence data.',
          url: result.uri,
          dialogTitle: 'Veriyi Paylaş / Kaydet',
        });
      } else {
        const blob = new Blob([dataText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'english_sentences.txt';
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error("Export failed", e);
      alert("Dışa aktarım başarısız oldu.");
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setDataText(content);
        // Do not auto save yet, let user preview and hit save
      }
    };
    reader.readAsText(file);
    // Reset standard value
    e.target.value = '';
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
      alert("Bu kelime zaten sözlüğünüzde var!");
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
      alert("Sözlük dışa aktarımı başarısız oldu.");
    }
  };

  const handleImportVocab = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const lines = (event.target?.result as string).split('\n');
        const importedData: SavedWord[] = [];
        
        for (const line of lines) {
           if (!line.trim() || !line.includes('=')) continue;
           const [word, meaning] = line.split('=').map(s => s.trim());
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
             // Ensure it's a valid object with 'word'
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
           
           setToastMessage("Sözlük başarıyla içe aktarıldı!");
           setTimeout(() => setToastMessage(null), 3000);
        } else {
           alert("TXT dosyasında geçerli kelime bulunamadı. Beklenen format: 'Kelime = Anlamı'");
        }
      } catch (err) {
        alert("Geçersiz dosya formatı veya bozuk veri!");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleWordSelect = (word: string, id: string) => {
    if (!currentItem) return;
    
    if (isSaveWordMode) {
      setWordToSave(word);
      setIsSaveWordMode(false);
      setMeaningInput('');
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
            alert("Harika! Tüm soruları tamamladın!");
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

  return (
    <div className="min-h-screen bg-black text-zinc-200 font-sans selection:bg-indigo-900 flex flex-col">
      {/* Header */}
      <header className="bg-zinc-950 px-6 py-4 shadow-md border-b border-zinc-900 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-900/50">
              <RefreshCw size={22} className={mode === 'quiz' ? 'animate-[spin_4s_linear_infinite]' : ''}/>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">Offline English</h1>
          </div>
          
          <div className="flex items-center gap-2 bg-zinc-900 p-1 rounded-xl">
            <button 
              onClick={() => setShowVocabModal(true)}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 text-zinc-400 hover:text-amber-400 hover:bg-zinc-800"
            >
              <Library size={16} />
              <span className="hidden sm:inline">Sözlüğüm</span>
            </button>
            <div className="w-px h-6 bg-zinc-800 mx-1 hidden sm:block"></div>
            <button 
              onClick={() => setMode('quiz')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${mode === 'quiz' ? 'bg-zinc-800 shadow-sm text-indigo-400' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              <Play size={16} />
              <span className="hidden sm:inline">Quiz Modu</span>
            </button>
            <button 
              onClick={() => setMode('manage')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${mode === 'manage' ? 'bg-zinc-800 shadow-sm text-indigo-400' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              <Settings size={16} />
              <span className="hidden sm:inline">Veri Yönetimi</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col">
        {mode === 'quiz' ? (
          <div className="w-full max-w-2xl mx-auto flex-1 flex flex-col">
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
              <div className="bg-zinc-950 rounded-3xl p-10 text-center shadow-sm border border-zinc-900 flex-1 flex flex-col items-center justify-center">
                <XCircle size={48} className="text-red-400 mb-4" />
                <h2 className="text-xl font-bold text-zinc-100">Veri Bulunamadı</h2>
                <p className="text-zinc-400 mt-2">Lütfen ayarlar kısmından veri ekleyin veya geçerli bir format kullanın.</p>
                <button 
                  onClick={() => setMode('manage')}
                  className="mt-6 px-6 py-2 bg-indigo-600 text-white rounded-xl font-semibold shadow-sm hover:bg-indigo-500 transition"
                >
                  Veri Yönetimine Git
                </button>
              </div>
            ) : currentItem ? (
              <div className="flex flex-col gap-5 flex-1">
                {/* Turkish Sentence Card */}
                <div className="bg-zinc-950 rounded-[2rem] p-6 sm:p-8 shadow-sm border border-zinc-900 text-center relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
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
                    <div
                      key={`sel-${i}`}
                      className="px-5 py-3 bg-indigo-600 text-white text-lg font-medium rounded-xl shadow-sm"
                    >
                      {word}
                    </div>
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
                <div className="flex justify-between items-center px-2">
                  <span className="text-sm font-medium text-zinc-400">Seçenekler:</span>
                  <button
                    onClick={() => setIsSaveWordMode(!isSaveWordMode)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors shadow-sm ${
                      isSaveWordMode 
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50 animate-pulse' 
                        : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-amber-400 hover:bg-zinc-800'
                    }`}
                  >
                    <BookmarkPlus size={16} />
                    {isSaveWordMode ? 'Seçeceğiniz Kelimeyi Kaydedin...' : 'Kelime Kaydet'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-3 justify-center">
                  {shuffledOptions.length > 0 && shuffledOptions.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => handleWordSelect(opt.word, opt.id)}
                      disabled={selectedWords.length === currentItem.englishWords.length && !isSaveWordMode}
                      className={`px-6 py-3 bg-zinc-900 border-2 border-zinc-800 text-zinc-200 text-lg font-medium rounded-xl shadow-sm transition-colors ${
                        isSaveWordMode 
                          ? 'hover:border-amber-500 hover:bg-amber-900/30 ring-2 ring-transparent hover:ring-amber-500 cursor-pointer border-dashed'
                          : 'hover:border-indigo-500 hover:text-indigo-300'
                      } ${
                        errorWord === opt.word && !isSaveWordMode ? 'border-red-500 bg-red-950/50 text-red-400' : ''
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
        ) : (
          <div className="bg-zinc-950 rounded-[2rem] p-6 sm:p-10 shadow-sm border border-zinc-900 w-full max-w-3xl mx-auto flex flex-col h-full relative overflow-hidden">
             <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-zinc-600 to-zinc-800"></div>
             
             <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
               <div>
                 <h2 className="text-2xl font-bold text-zinc-100">Veri Yönetimi</h2>
                 <p className="text-sm text-zinc-400 mt-1">Türkçe = English formatında cümlelerinizi düzenleyin.</p>
               </div>
               
               <div className="flex gap-2">
                 <button 
                  onClick={handleExport}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-sm font-semibold rounded-xl flex items-center gap-2 transition"
                >
                  <Download size={16} /> <span className="hidden sm:inline">İndir (.txt)</span>
                 </button>
                 <label className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-sm font-semibold rounded-xl flex items-center gap-2 cursor-pointer transition">
                  <Upload size={16} /> <span className="hidden sm:inline">Yükle</span>
                  <input type="file" accept=".txt" className="hidden" onChange={handleImport} />
                 </label>
               </div>
             </div>

             <textarea 
               value={dataText}
               onChange={(e) => setDataText(e.target.value)}
               className="w-full flex-1 min-h-[300px] p-4 bg-black border-2 border-zinc-900 rounded-2xl font-mono text-sm leading-relaxed text-zinc-300 focus:outline-none focus:border-indigo-500 focus:bg-zinc-950 transition-colors"
               placeholder="Example:&#10;Merhaba = Hello&#10;Nasılsın = How are you"
             />

             <div className="mt-6 flex items-center justify-between">
                <button 
                  onClick={resetToDefault}
                  className="text-zinc-400 hover:text-zinc-200 text-sm font-semibold flex items-center gap-2"
                >
                  <RefreshCw size={16} /> Varsayılan Veriye Dön
                </button>
                <button 
                  onClick={handleSaveData}
                  className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-md shadow-indigo-900/20 transition"
                >
                  Kaydet ve Quiz'e Başla
                </button>
             </div>
          </div>
        )}
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
                onClick={() => setShowVocabModal(false)}
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
               <div className="flex gap-2 w-full sm:w-auto justify-between sm:justify-end">
                 <span className="text-sm font-medium text-zinc-400 self-center hidden sm:block mr-2">
                   <strong>{savedVocab.length}</strong> kelime
                 </span>
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
                  <Download size={16} /> <span className="hidden sm:inline">Dışa Aktar</span>
                 </button>
                 <label className="px-3 py-1.5 bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-zinc-300 text-sm font-medium rounded-lg flex items-center gap-2 cursor-pointer transition">
                  <Upload size={16} /> <span className="hidden sm:inline">İçe Aktar</span>
                  <input type="file" accept=".txt" className="hidden" onChange={handleImportVocab} />
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
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {savedVocab
                    .filter(item => 
                      item.word.toLowerCase().includes(searchQuery.toLowerCase()) || 
                      item.meaning.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((item) => (
                    <div key={item.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex items-start justify-between group hover:border-zinc-700 transition">
                      <div>
                        <h4 className="text-lg font-bold text-amber-400 mb-1">{item.word}</h4>
                        <p className="text-zinc-300 font-medium">{item.meaning}</p>
                        <span className="text-xs text-zinc-600 mt-2 block">
                          {new Date(item.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                      </div>
                      <button 
                        onClick={() => handleDeleteVocab(item.id)}
                        className="p-2 text-white hover:text-red-400 hover:bg-red-500/10 rounded-xl transition sm:opacity-50 group-hover:opacity-100"
                        title="Sil"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
