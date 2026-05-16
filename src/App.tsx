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
  ChevronRight
} from 'lucide-react';
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

export default function App() {
  const [mode, setMode] = useState<AppMode>('quiz');
  const [dataText, setDataText] = useState(DEFAULT_TEXT_DATA);
  const [quizItems, setQuizItems] = useState<QuizItem[]>([]);
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [shuffledOptions, setShuffledOptions] = useState<{id: string, word: string}[]>([]);
  const [score, setScore] = useState(0);
  const [errorWord, setErrorWord] = useState<string | null>(null);

  // Initialize data
  useEffect(() => {
    const text = loadData();
    setDataText(text);
    const parsed = parseTextData(text);
    if (parsed.length > 0) {
      setQuizItems(shuffleArray(parsed));
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

  const handleExport = () => {
    const blob = new Blob([dataText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'english_sentences.txt';
    a.click();
    URL.revokeObjectURL(url);
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

  const handleWordSelect = (word: string, id: string) => {
    if (!currentItem) return;
    
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
    <div className="min-h-screen bg-[#F0F4F8] text-[#1e293b] font-sans selection:bg-indigo-100 flex flex-col">
      {/* Header */}
      <header className="bg-white px-6 py-4 shadow-sm border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-100">
              <RefreshCw size={22} className={mode === 'quiz' ? 'animate-[spin_4s_linear_infinite]' : ''}/>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900">Offline English</h1>
          </div>
          
          <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-xl">
            <button 
              onClick={() => setMode('quiz')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${mode === 'quiz' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Play size={16} />
              <span className="hidden sm:inline">Quiz Modu</span>
            </button>
            <button 
              onClick={() => setMode('manage')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${mode === 'manage' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
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
              <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-700 font-bold">
                <Trophy size={18} />
                <span>Skor: {score}</span>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
                  disabled={currentQuestionIndex === 0}
                  className="px-3 py-2 bg-white rounded-xl shadow-sm border border-gray-100 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-gray-500 transition-colors"
                  aria-label="Önceki Soru"
                >
                  <ChevronLeft size={18} />
                </button>
                <div className="text-sm font-medium text-gray-500 bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100">
                  Soru {currentQuestionIndex + 1} / {quizItems.length}
                </div>
                <button 
                  onClick={() => setCurrentQuestionIndex(Math.min(quizItems.length - 1, currentQuestionIndex + 1))}
                  disabled={currentQuestionIndex >= quizItems.length - 1}
                  className="px-3 py-2 bg-white rounded-xl shadow-sm border border-gray-100 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-gray-500 transition-colors"
                  aria-label="Sonraki Soru"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            {quizItems.length === 0 ? (
              <div className="bg-white rounded-3xl p-10 text-center shadow-sm border border-gray-100 flex-1 flex flex-col items-center justify-center">
                <XCircle size={48} className="text-red-400 mb-4" />
                <h2 className="text-xl font-bold text-gray-800">Veri Bulunamadı</h2>
                <p className="text-gray-500 mt-2">Lütfen ayarlar kısmından veri ekleyin veya geçerli bir format kullanın.</p>
                <button 
                  onClick={() => setMode('manage')}
                  className="mt-6 px-6 py-2 bg-indigo-600 text-white rounded-xl font-semibold shadow-sm hover:bg-indigo-700 transition"
                >
                  Veri Yönetimine Git
                </button>
              </div>
            ) : currentItem ? (
              <div className="flex flex-col gap-5 flex-1">
                {/* Turkish Sentence Card */}
                <div className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-sm border border-gray-100 text-center relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                  <span className="text-xs font-bold uppercase tracking-widest text-indigo-500 mb-4 block">HEDEF CÜMLE</span>
                  <h2 className="text-2xl sm:text-3xl font-medium text-gray-800 leading-snug">
                    {currentItem.turkish}
                  </h2>
                </div>

                {/* Building Area */}
                <div className="min-h-[100px] border-2 border-dashed border-gray-300 rounded-2xl bg-gray-50 p-6 flex flex-wrap gap-3 items-center justify-center">
                  {selectedWords.length === 0 && shuffledOptions.length > 0 && (
                    <span className="text-gray-400 font-medium">Kelimeleri doğru sırayla seçin</span>
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
                    <div className="text-red-500 font-bold uppercase tracking-wider text-sm flex items-center gap-2 bg-red-50 px-4 py-2 rounded-lg border border-red-100">
                      <XCircle size={16} /> Wrong! "{errorWord}" değil.
                    </div>
                  )}
                </div>

                {/* Word Options */}
                <div className="flex flex-wrap gap-3 justify-center">
                  {shuffledOptions.length > 0 && shuffledOptions.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => handleWordSelect(opt.word, opt.id)}
                      disabled={selectedWords.length === currentItem.englishWords.length}
                      className={`px-6 py-3 bg-white border-2 border-gray-200 text-gray-700 text-lg font-medium rounded-xl shadow-sm hover:border-indigo-300 hover:text-indigo-600 transition-colors ${
                        errorWord === opt.word ? 'border-red-400 bg-red-50 text-red-600' : ''
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
                      className="text-gray-400 hover:text-gray-600 text-sm font-medium flex items-center gap-2"
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
          <div className="bg-white rounded-[2rem] p-6 sm:p-10 shadow-sm border border-gray-100 w-full max-w-3xl mx-auto flex flex-col h-full relative overflow-hidden">
             <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-gray-400 to-gray-600"></div>
             
             <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
               <div>
                 <h2 className="text-2xl font-bold text-gray-800">Veri Yönetimi</h2>
                 <p className="text-sm text-gray-500 mt-1">Türkçe = English formatında cümlelerinizi düzenleyin.</p>
               </div>
               
               <div className="flex gap-2">
                 <button 
                  onClick={handleExport}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl flex items-center gap-2 transition"
                >
                  <Download size={16} /> <span className="hidden sm:inline">İndir (.txt)</span>
                 </button>
                 <label className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl flex items-center gap-2 cursor-pointer transition">
                  <Upload size={16} /> <span className="hidden sm:inline">Yükle</span>
                  <input type="file" accept=".txt" className="hidden" onChange={handleImport} />
                 </label>
               </div>
             </div>

             <textarea 
               value={dataText}
               onChange={(e) => setDataText(e.target.value)}
               className="w-full flex-1 min-h-[300px] p-4 bg-gray-50 border-2 border-gray-200 rounded-2xl font-mono text-sm leading-relaxed text-gray-700 focus:outline-none focus:border-indigo-400 focus:bg-white transition-colors"
               placeholder="Example:&#10;Merhaba = Hello&#10;Nasılsın = How are you"
             />

             <div className="mt-6 flex items-center justify-between">
                <button 
                  onClick={resetToDefault}
                  className="text-gray-500 hover:text-gray-800 text-sm font-semibold flex items-center gap-2"
                >
                  <RefreshCw size={16} /> Varsayılan Veriye Dön
                </button>
                <button 
                  onClick={handleSaveData}
                  className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-200 transition"
                >
                  Kaydet ve Quiz'e Başla
                </button>
             </div>
          </div>
        )}
      </main>
    </div>
  );
}
