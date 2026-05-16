export const DEFAULT_TEXT_DATA = `Merhaba dünya = Hello world
Bugün hava çok güzel = The weather is very nice today
Benim adım Ahmet = My name is Ahmet
Nasılsın? = How are you?
Bu bir test cümlesidir = This is a test sentence
Kitap okumayı seviyorum = I like reading books
Kediler çok tatlı hayvanlardır = Cats are very cute animals
Yarın sinemaya gideceğiz = We will go to the cinema tomorrow
Ankara Türkiye'nin başkentidir = Ankara is the capital of Turkey
İngilizce öğrenmek çok eğlenceli = Learning English is very fun`;

export type QuizItem = {
  turkish: string;
  english: string;
  englishWords: string[];
};

export const parseTextData = (text: string): QuizItem[] => {
  const lines = text.split('\n');
  const items: QuizItem[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    
    // Split by '=' and handle potential multiple '=' by only splitting on the first one, or just assume format is standard
    const parts = line.split('=');
    if (parts.length >= 2) {
      const turkish = parts[0].trim();
      // Join the rest in case there are multiple '=' in the english text (rare but possible)
      const english = parts.slice(1).join('=').trim();
      
      const englishWords = english.split(/\s+/).filter(w => w.length > 0);
      
      if (turkish && englishWords.length > 0) {
        items.push({ turkish, english, englishWords });
      }
    }
  }

  return items;
};

export const loadData = (): string => {
  try {
    const saved = localStorage.getItem('english_app_data');
    if (saved) return saved;
  } catch (e) {
    console.error("Local storage access denied", e);
  }
  return DEFAULT_TEXT_DATA;
};

export const saveData = (text: string) => {
  try {
    localStorage.setItem('english_app_data', text);
  } catch (e) {
    console.error("Local storage access denied", e);
  }
};
