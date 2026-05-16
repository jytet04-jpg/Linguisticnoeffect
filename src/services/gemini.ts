import { GoogleGenAI, Type, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const meaningCache: Record<string, string> = {};

async function withRetry<T>(fn: () => Promise<T>, retries = 2, delay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const errorStr = JSON.stringify(error).toLowerCase();
    const isQuotaError = 
      error?.message?.includes('429') || 
      error?.status === 'RESOURCE_EXHAUSTED' ||
      error?.code === 429 ||
      errorStr.includes('429') ||
      errorStr.includes('resource_exhausted') ||
      errorStr.includes('quota');

    if (isQuotaError && retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }

    if (isQuotaError) {
      throw new Error('QUOTA_EXCEEDED');
    }
    throw error;
  }
}

export interface SentenceSuggestion {
  corrected: string;
  explanation: string;
  alternatives: {
    context: string;
    text: string;
  }[];
  grammarPoints: string[];
}

export interface SentenceSuggestion {
  corrected: string;
  explanation: string;
  alternatives: {
    context: string;
    text: string;
  }[];
  grammarPoints: string[];
}

export interface QuizQuestion {
  sentence: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  translation: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export async function getSentenceHelp(input: string): Promise<SentenceSuggestion> {
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Help me construct or correct this English sentence: "${input}". 
      If it's in Turkish, translate it. If it's in English, correct it.
      Provide a clear explanation and alternatives.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            corrected: { type: Type.STRING },
            explanation: { type: Type.STRING },
            alternatives: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  context: { type: Type.STRING },
                  text: { type: Type.STRING }
                },
                required: ["context", "text"]
              }
            },
            grammarPoints: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["corrected", "explanation", "alternatives", "grammarPoints"]
        }
      }
    });

    return JSON.parse(response.text || "{}");
  });
}

const fallbackQuizQuestions: QuizQuestion[] = [
  {
    sentence: "I ____ to the cinema yesterday.",
    options: ["go", "went", "gone", "going"],
    correctAnswer: "went",
    explanation: "Geçmiş zaman (Past Simple) kullanıldığı için 'go' fiilinin ikinci hali olan 'went' kullanılmalıdır.",
    translation: "Dün sinemaya gittim.",
    difficulty: "easy"
  },
  {
    sentence: "She ____ English for five years.",
    options: ["is studying", "has been studying", "studies", "studied"],
    correctAnswer: "has been studying",
    explanation: "Eylem geçmişte başlamış ve hala devam ettiği için 'Present Perfect Continuous' zamanı kullanılmalıdır.",
    translation: "O, beş yıldır İngilizce çalışıyor.",
    difficulty: "medium"
  },
  {
    sentence: "If I ____ you, I would take that job.",
    options: ["am", "was", "were", "be"],
    correctAnswer: "were",
    explanation: "Gerçek dışı durumları (Type 2 Conditional) ifade ederken 'be' fiili tüm özneler için 'were' olarak kullanılır.",
    translation: "Senin yerinde olsaydım, o işi kabul ederdim.",
    difficulty: "hard"
  },
  {
    sentence: "They ____ their homework yet.",
    options: ["haven't finished", "didn't finish", "don't finish", "hasn't finished"],
    correctAnswer: "haven't finished",
    explanation: "'Yet' ifadesi genellikle 'Present Perfect' zamanı ile kullanılır ve eylemin henüz tamamlanmadığını belirtir.",
    translation: "Onlar henüz ödevlerini bitirmediler.",
    difficulty: "easy"
  },
  {
    sentence: "By the time we arrived, the train ____.",
    options: ["leaves", "has left", "had left", "was leaving"],
    correctAnswer: "had left",
    explanation: "Geçmişte bir olaydan önce gerçekleşen başka bir olayı anlatmak için 'Past Perfect' (had + V3) kullanılır.",
    translation: "Biz vardığımızda tren çoktan kalkmıştı.",
    difficulty: "medium"
  }
];

const fallbackScrambleQuestions: ScrambleQuestion[] = [
  {
    turkishSentence: "Bugün hava çok güzel.",
    englishSentence: "The weather is very beautiful today.",
    shuffledWords: ["today", "beautiful", "The", "is", "weather", "very"],
    originalWords: ["The", "weather", "is", "very", "beautiful", "today."],
    explanation: "Basit bir isim cümlesi yapısı."
  },
  {
    turkishSentence: "Dün seni okulda görmedim.",
    englishSentence: "I didn't see you at school yesterday.",
    shuffledWords: ["yesterday", "school", "see", "didn't", "at", "you", "I"],
    originalWords: ["I", "didn't", "see", "you", "at", "school", "yesterday."],
    explanation: "Geçmiş zamanın olumsuz hali (Past Simple Negative)."
  },
  {
    turkishSentence: "Gelecekte doktor olmak istiyorum.",
    englishSentence: "I want to be a doctor in the future.",
    shuffledWords: ["future", "be", "doctor", "want", "in", "to", "I", "a", "the"],
    originalWords: ["I", "want", "to", "be", "a", "doctor", "in", "the", "future."],
    explanation: "İstek bildiren 'want to' yapısı."
  },
  {
    turkishSentence: "En sevdiğim renk mavidir.",
    englishSentence: "My favorite color is blue.",
    shuffledWords: ["blue.", "is", "color", "favorite", "My"],
    originalWords: ["My", "favorite", "color", "is", "blue."],
    explanation: "Temel bir iyelik sıfatı ve isim cümlesi."
  },
  {
    turkishSentence: "Kahve içmeyi çay içmeye tercih ederim.",
    englishSentence: "I prefer drinking coffee to drinking tea.",
    shuffledWords: ["tea.", "drinking", "to", "coffee", "drinking", "prefer", "I"],
    originalWords: ["I", "prefer", "drinking", "coffee", "to", "drinking", "tea."],
    explanation: "'Prefer X to Y' kalıbı tercihlerimizi belirtmek için kullanılır."
  }
];

export async function generateQuizQuestion(previousSentences: string[] = [], difficulty: 'easy' | 'medium' | 'hard' = 'medium'): Promise<QuizQuestion> {
  try {
    return await withRetry(async () => {
      const excludePrompt = previousSentences.length > 0 
        ? `\n\nDO NOT repeat any of these previously generated sentences: ${previousSentences.slice(-10).join(', ')}` 
        : '';

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate a ${difficulty} level multiple-choice English grammar or vocabulary quiz question. The sentence should have a '____' for the blank. Provide 4 options, the correct answer, a brief explanation in Turkish, and the full Turkish translation of the completed sentence.${excludePrompt}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              sentence: { type: Type.STRING },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              correctAnswer: { type: Type.STRING },
              explanation: { type: Type.STRING },
              translation: { type: Type.STRING },
              difficulty: { 
                type: Type.STRING,
                enum: ['easy', 'medium', 'hard']
              }
            },
            required: ["sentence", "options", "correctAnswer", "explanation", "translation", "difficulty"]
          }
        }
      });

      return JSON.parse(response.text || "{}");
    });
  } catch (error: any) {
    if (error.message === 'QUOTA_EXCEEDED') {
      const filtered = fallbackQuizQuestions.filter(q => q.difficulty === difficulty);
      const pool = filtered.length > 0 ? filtered : fallbackQuizQuestions;
      return pool[Math.floor(Math.random() * pool.length)];
    }
    throw error;
  }
}

export interface ScrambleQuestion {
  turkishSentence: string;
  englishSentence: string;
  shuffledWords: string[];
  originalWords: string[];
  explanation: string;
}

export async function generateScrambleQuestion(difficulty: 'easy' | 'medium' | 'hard' = 'medium'): Promise<ScrambleQuestion> {
  try {
    return await withRetry(async () => {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate a ${difficulty} level sentence translation exercise. 
        Provide a Turkish sentence and its correct English translation.
        The English sentence should be broken down into individual words.
        Return the data in JSON format.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              turkishSentence: { type: Type.STRING },
              englishSentence: { type: Type.STRING },
              shuffledWords: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "The individual words of the English sentence, in their correct order initially."
              },
              explanation: { type: Type.STRING, description: "A brief explanation of the grammar or vocabulary used." }
            },
            required: ["turkishSentence", "englishSentence", "shuffledWords", "explanation"]
          }
        }
      });

      const data = JSON.parse(response.text || "{}");
      const originalWords = [...data.shuffledWords];
      const shuffledWords = [...data.shuffledWords];
      for (let i = shuffledWords.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledWords[i], shuffledWords[j]] = [shuffledWords[j], shuffledWords[i]];
      }
      
      return {
        ...data,
        shuffledWords,
        originalWords
      };
    });
  } catch (error: any) {
    if (error.message === 'QUOTA_EXCEEDED') {
      return fallbackScrambleQuestions[Math.floor(Math.random() * fallbackScrambleQuestions.length)];
    }
    throw error;
  }
}

export async function getWordMeaning(word: string, context: string): Promise<string> {
  const cacheKey = `${word.toLowerCase()}:${context.toLowerCase()}`;
  if (meaningCache[cacheKey]) return meaningCache[cacheKey];

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `What is the Turkish meaning of the word "${word}" in the context of this English sentence: "${context}"? Provide only the Turkish meaning and a very brief usage note if necessary.`,
      config: {
        responseMimeType: "text/plain",
      }
    });

    const meaning = response.text || "Anlam bulunamadı.";
    meaningCache[cacheKey] = meaning;
    return meaning;
  });
}

export async function generateSpeech(text: string): Promise<string | null> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Say clearly: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio ? `data:audio/mp3;base64,${base64Audio}` : null;
  } catch (error) {
    console.error("TTS Error:", error);
    return null;
  }
}
