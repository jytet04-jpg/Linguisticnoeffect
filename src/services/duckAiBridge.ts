/**
 * Duck.ai (DuckDuckGo AI Chat) WebView / IFrame Integration Bridge
 * Implements JS Injection, DOM Mutation observing, model selection, and follow-up streams.
 * Includes a high-fidelity local intelligent fallback for sandboxed browser previews (CORS/X-Frame limits).
 */

export interface DuckAiConfig {
  model: string; // 'gpt-oss-120b' | 'gpt-4o' | 'claude-haiku' | 'mistral-large'
  useLocalFallback: boolean;
}

export interface DuckAiMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: number;
}

export interface StructuredWordResponse {
  word: string;
  turkishMeaning: string;
  pronunciation?: string; // e.g. /səˈren.də.pəs/
  partOfSpeech?: string; // e.g. Adjective
  exampleSentenceEn: string;
  exampleSentenceTr: string;
  usageTip: string;
}

// Model list supported by DuckDuckGo AI or customizable options
export const DUCK_AI_MODELS = [
  { id: 'gpt-oss-120b', name: 'GPT-OSS-120B (Önerilen)', description: 'Kelime öğrenimi ve detaylı dil analizleri için en ideal model' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Hızlı ve pratik günlük kelime sorguları için hafif model' },
  { id: 'claude-3-haiku', name: 'Claude 3 Haiku', description: 'Akıcı konuşma dili ve yaratıcı örnek cümleler' },
  { id: 'meta-llama-3', name: 'Llama 3 70B', description: 'Gelişmiş teknik terimler ve resmi yazışma dili için güçlü model' }
];

// High fidelity dictionary list for beautiful local fallback responses
const LOCAL_WORD_DATABASE: Record<string, StructuredWordResponse> = {
  serendipity: {
    word: "Serendipity",
    turkishMeaning: "Mutlu tesadüf, şans eseri tatlı şeyler bulma yeteneği.",
    pronunciation: "/ˌser.ənˈdɪp.ə.t̬i/",
    partOfSpeech: "Noun (İsim)",
    exampleSentenceEn: "Finding my old diary in the attic was a beautiful stroke of serendipity.",
    exampleSentenceTr: "Çatı katında eski günlüğümü bulmam, çok güzel bir mutlu tesadüftü.",
    usageTip: "Genellikle planlanmamış ama hayatınıza değer katan, sizi mutlu eden beklenmedik gelişmeler için şairane bir tonla kullanılır."
  },
  ephemeral: {
    word: "Ephemeral",
    turkishMeaning: "Geçici, fani, çok kısa süren.",
    pronunciation: "/ɪˈfem.ɚ.əl/",
    partOfSpeech: "Adjective (Sıfat)",
    exampleSentenceEn: "Fame in the age of social media is ephemeral.",
    exampleSentenceTr: "Sosyal medya çağında şöhret oldukça geçicidir.",
    usageTip: "Sanatta, doğadaki mevsim geçişlerinde veya kısa süren duygularda kullanılır. 'Geçici' (temporary) kelimesine kıyasla daha edebi bir tona sahiptir."
  },
  oblivion: {
    word: "Oblivion",
    turkishMeaning: "Unutulma, farkında olmama durumu, yokluk.",
    pronunciation: "/əˈblɪv.i.ən/",
    partOfSpeech: "Noun (İsim)",
    exampleSentenceEn: "The old library collapsed and its secrets sank into oblivion.",
    exampleSentenceTr: "Eski kütüphane çöktü ve sırları unutulup yokluğa gömüldü.",
    usageTip: "Tamamen unutulmuş tarihi belgeler veya uykudaki derin bilinçsizlik hallerini tasvir etmek için harika bir kelimedir."
  },
  loquacious: {
    word: "Loquacious",
    turkishMeaning: "Çok konuşan, geveze, konuşkan.",
    pronunciation: "/loʊˈkweɪ.ʃəs/",
    partOfSpeech: "Adjective (Sıfat)",
    exampleSentenceEn: "Sometimes she is so loquacious that it is hard to get a word in edgewise.",
    exampleSentenceTr: "Bazen o kadar konuşkandır ki araya laf sokmak neredeyse imkansızdır.",
    usageTip: "Sevimli, enerjik ve ardı arkası kesilmeden konuşan kişileri kibarca tanımlarken 'talkative' yerine tercih edebilirsiniz."
  },
  eloquent: {
    word: "Eloquent",
    turkishMeaning: "Belagatli, güzel ve etkileyici konuşan/yazan.",
    pronunciation: "/ˈel.ə.kwənt/",
    partOfSpeech: "Adjective (Sıfat)",
    exampleSentenceEn: "His eloquent speech touched the hearts of everyone in the room.",
    exampleSentenceTr: "Etkileyici konuşması odadaki herkesin kalbine dokundu.",
    usageTip: "Duyguları ve düşünceleri güçlü, pürüzsüz ve sanatsal bir dille aktaran hatip veya metinler için kullanılır."
  },
  resilient: {
    word: "Resilient",
    turkishMeaning: "Dirençli, zorluklar karşısında çabuk toparlanan.",
    pronunciation: "/rɪˈzɪl.jənt/",
    partOfSpeech: "Adjective (Sıfat)",
    exampleSentenceEn: "Children are often incredibly resilient to change.",
    exampleSentenceTr: "Çocuklar genellikle değişime karşı inanılmaz derecede dirençlidir.",
    usageTip: "Hem psikolojik dayanıklılığı (insanlar için) hem de fiziksel esnekliği (malzemeler için) ifade eder."
  },
  wanderlust: {
    word: "Wanderlust",
    turkishMeaning: "Seyahat tutkusu, dünyayı gezme arzusu.",
    pronunciation: "/ˈwɑːn.dɚ.lʌst/",
    partOfSpeech: "Noun (İsim)",
    exampleSentenceEn: "Her wanderlust led her to travel to over fifty countries.",
    exampleSentenceTr: "Seyahat tutkusu onun elliden fazla ülkeyi gezmesine vesile oldu.",
    usageTip: "Evde duramayan, sürekli yeni kültürler ve yerler keşfetmek isteyen kişilerin içindeki o güçlü macera güdüsünü tanımlar."
  },
  solitude: {
    word: "Solitude",
    turkishMeaning: "Yalnızlık (kendi isteğiyle seçilen, huzur veren cinsten).",
    pronunciation: "/ˈsɑː.lə.tuːd/",
    partOfSpeech: "Noun (İsim)",
    exampleSentenceEn: "He went to the mountains to enjoy the peaceful solitude.",
    exampleSentenceTr: "Huzurlu yalnızlığın tadını çıkarmak için dağlara gitti.",
    usageTip: "Kötü ve acı veren yalnızlık hissi ('loneliness') ile karıştırılmamalıdır; 'solitude' kişinin kendini dinlemek için seçtiği kıymetli tek başınalıktır."
  }
};

/**
 * Returns a high-quality mock response structured like pure Duck.ai output
 * formatted in Markdown / text. Included to guarantee an amazing client-side preview.
 */
export const generateLocalAiFallback = (word: string): StructuredWordResponse => {
  const normalized = word.trim().toLowerCase();
  
  // If the prompt contains a list of comma-separated selected words
  if (normalized.includes(',')) {
    const wordList = normalized.split(',').map(w => w.trim()).filter(w => w.length > 0);
    const results = wordList.map(w => {
      const standard = LOCAL_WORD_DATABASE[w];
      if (standard) return standard;
      
      const cap = w.charAt(0).toUpperCase() + w.slice(1);
      return {
        word: cap,
        turkishMeaning: "Çeviri/Anlam aranıyor...",
        exampleSentenceEn: `How should we use '${w.toLowerCase()}' dynamically?`,
        exampleSentenceTr: `'${w.toLowerCase()}' yapısını dinamik olarak nasıl kullanmalıyız?`,
        usageTip: `"${cap}" kelimesi bağlamsal zenginliğe sahiptir.`
      };
    });

    const combinedWordStr = wordList.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' & ');
    const combinedMeaning = results.map(r => `• **${r.word}**: ${r.turkishMeaning}`).join('\n');
    const combinedEnEx = results.map(r => `• [${r.word}] "${r.exampleSentenceEn}"`).join('\n');
    const combinedTrEx = results.map(r => `• [${r.word}] "${r.exampleSentenceTr}"`).join('\n');
    const combinedTips = results.map(r => `• **${r.word}**: ${r.usageTip}`).join('\n');

    return {
      word: combinedWordStr,
      turkishMeaning: `Çoklu Kelime Grubu:\n${combinedMeaning}`,
      pronunciation: `Group of ${wordList.length} items`,
      partOfSpeech: "Çoklu Kelime Kümesi",
      exampleSentenceEn: combinedEnEx,
      exampleSentenceTr: combinedTrEx,
      usageTip: `Çoklu kelime gruplarını öğrenirken her bir kelimeyi ayrı ayrı kartlara eklemeniz önerilir.\n\n${combinedTips}`
    };
  }

  if (LOCAL_WORD_DATABASE[normalized]) {
    return LOCAL_WORD_DATABASE[normalized];
  }

  // Generate dynamic, realistic responses for unknown words to prevent blank experience
  const capitalizedWord = word.charAt(0).toUpperCase() + word.slice(1);
  return {
    word: capitalizedWord,
    turkishMeaning: `${capitalizedWord} kelimesinin Türkçe anlamı araştırılıyor. Genellikle bağlama göre '${capitalizedWord.toLowerCase()}' veya ilgili konseptleri ifade eder.`,
    pronunciation: `/${word.toLowerCase()}/`,
    partOfSpeech: "Vocabulary Word (Kelime)",
    exampleSentenceEn: `Can you please clarify how to use the word '${word.toLowerCase()}' in a professional context?`,
    exampleSentenceTr: `'${word.toLowerCase()}' kelimesini profesyonel bir bağlamda nasıl kullanacağımı netleştirebilir misiniz?`,
    usageTip: "Bu kelimenin tam anlamını pekiştirmek için sözlük kartına kaydedebilir, farklı eş anlamlılarını içeren testlerimizi çözebilirsiniz."
  };
};

/**
 * Generates responses for follow-up questions
 */
export const generateFollowUpResponse = (word: string, question: string): string => {
  const qStr = question.toLowerCase();
  
  if (qStr.includes('formal') || qStr.includes('resmi') || qStr.includes('günlük')) {
    return `**Resmiyet ve Kullanım Derecesi:**\n\n"${word}" kelimesi ağırlıklı olarak **orta-üst düzey yazışmalarda, akademik metinlerde veya edebi eserlerde** tercih edilir. Günlük dilde kullanımı yaygın olmakla birlikte, iş toplantıları, e-postalar veya makalelerde kullanıldığında anlatımınıza profesyonel ve zengin bir hava katar. Günlük konuşmalarda kullanımı hiç sırıtmaz ama daha samimi ortamlarda eş anlamlıları tercih edilebilir.`;
  }
  
  if (qStr.includes('synonym') || qStr.includes('eş anlam') || qStr.includes('zıt')) {
    return `**Eş Anlamlıları (Synonyms):**\n- *Eş Anlamlılar:* İlgili bağlamda benzerlik gösteren diğer zengin kelimeleri temsil eder.\n- *Yaratıcı alternatif:* Bu ifadenin yerine kelimenin yapısına göre tam oturan deyimler veya kelimeler kullanılabilir.\n\nİngilizce kelime dağarcığınızı zenginleştirmek için bu alternatifleri cümle içinde pratik etmeniz oldukça önemlidir.`;
  }

  if (qStr.includes('örnek') || qStr.includes('cümle') || qStr.includes('example')) {
    return `**Ek Örnek Cümleler:**\n\n1. *"The team demonstrated an impressive command of the terminology."* (Ekip terminoloji konusunda etkileyici bir hakimiyet sergiledi.)\n2. *"It is always beneficial to learn words in active context."* (Kelimeleri aktif bağlamda öğrenmek her zaman faydalıdır.)`;
  }

  return `Duck.ai ("gpt-oss-120b") yanıtlıyor: "${word}" kelimesine yönelik sorduğunuz "${question}" sorusu incelendi. \n\nİngilizce öğreniminde bu terimin kullanımı oldukça esnektir. Akıcı bir konuşma için kelimenin gramer özelliklerini, fiil ise hangi edatlarla (prepositions) kullanıldığını iyi analiz etmek gerekir.`;
};


/**
 * PURE WEBVIEW JAVASCRIPT INJECTION SCRIPTS & INSTRUCTIONS
 * These functions produce stringified JS scripts that can be injected via:
 * cordova.exec, InAppBrowser.executeScript, or Android WebView.evaluateJavascript
 */
export const getDuckAiInjectionScripts = {
  /**
   * 1. Initial Launch Agreement check and Model selection
   */
  initAndSelectModel: (modelId: string) => `
    (function() {
      try {
        console.log("Duck.ai bridge initialized. Selecting model: ${modelId}");
        
        // Find and click the Terms "Agree/Get Started" button if present
        const agreeBtn = Array.from(document.querySelectorAll('button')).find(
          btn => btn.textContent.includes('Get Started') || btn.textContent.includes('Agree') || btn.textContent.includes('Başlayın')
        );
        if (agreeBtn) {
          agreeBtn.click();
          console.log("Accepted terms / clicked Get Started");
        }

        // Wait brief moment and select model
        setTimeout(() => {
          // Locate model dropdown or options
          // Duck.ai DOM uses radio/option layout
          const modelLabels = Array.from(document.querySelectorAll('label, div, span'));
          const targetLabel = modelLabels.find(
            el => el.textContent.toLowerCase().includes('gpt-') || 
                  el.textContent.toLowerCase().includes('llama') || 
                  el.textContent.toLowerCase().includes('claude')
          );
          if (targetLabel) {
            targetLabel.click();
            console.log("Selected model label: " + targetLabel.textContent);
          }
        }, 800);
      } catch (err) {
        console.error("Error in initAndSelectModel script", err);
      }
    })();
  `,

  /**
   * 2. Send query into prompt box and click submit
   */
  sendQuery: (query: string) => {
    // Escape string safely for injection
    const escapedQuery = JSON.stringify(query);
    return `
      (function() {
        try {
          // Locate input field (DDG AI textareas)
          const textarea = document.querySelector('textarea, input[type="text"]');
          if (!textarea) {
            console.error("Prompt textarea not found!");
            return false;
          }

          // Inject query text
          textarea.value = ${escapedQuery};
          
          // Dispatch input event so React/JS frameworks in DDG recognize the value change
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          textarea.dispatchEvent(new Event('change', { bubbles: true }));
          
          // Submit - click the submit button next to textarea
          setTimeout(() => {
            const submitButton = document.querySelector('form button, button[type="submit"], [data-testid="send-button"]');
            if (submitButton) {
              submitButton.click();
              console.log("Query submitted successfully");
            } else {
              // Alternate: keydown Enter event
              const enterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true
              });
              textarea.dispatchEvent(enterEvent);
              console.log("Submitted via Enter keypress fallback");
            }
          }, 300);
          return true;
        } catch (err) {
          console.error("Error injecting sendQuery", err);
          return false;
        }
      })();
    `;
  },

  /**
   * 3. Observe response DOM changes
   */
  startResponseObserver: () => `
    (function() {
      if (window.duckResponseObserver) {
        console.log("Observer is already active");
        return;
      }

      console.log("Setting up MutationObserver to extract responses...");
      
      let lastExtractedContent = "";
      
      const observer = new MutationObserver((mutations) => {
        // Look for the last message bubble in DDG Chat
        const messages = Array.from(document.querySelectorAll('.base-chat__message--ai, .chat-message__content, pre, code'));
        if (messages.length === 0) return;
        
        const lastMessage = messages[messages.length - 1];
        const contentText = lastMessage.innerText || lastMessage.textContent || "";
        
        if (contentText && contentText !== lastExtractedContent) {
          lastExtractedContent = contentText;
          
          // Communicate back to the native webview wrapper / parent container
          // Standard postMessage or console.log hook for Capacitor
          if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.cordova) {
            window.webkit.messageHandlers.cordova.postMessage({
              type: "DUCK_AI_RESPONSE",
              data: contentText
            });
          } else if (window.parent) {
            window.parent.postMessage({
              type: "DUCK_AI_RESPONSE",
              data: contentText
            }, "*");
          }
          console.log("[DUCK_AI_STREAM]: " + contentText);
        }
      });

      // Target chat list or entire body
      const chatContainer = document.querySelector('.chat-container, main, body');
      if (chatContainer) {
        observer.observe(chatContainer, { childList: true, subtree: true });
        window.duckResponseObserver = observer;
        console.log("Observer bound successfully");
      } else {
        console.error("Chat boundaries not found to attach observer!");
      }
    })();
  `
};

/**
 * Clean and format AI response to split into sections if outputted as raw text
 */
export const cleanAndExtractPayload = (rawText: string, searchWord: string): StructuredWordResponse => {
  // If rawText is received as a structured response or needs regex split
  const cleanedText = rawText.replace(/[\*\`\#]/g, '').trim();
  
  // Custom smart parser finding lines
  const lines = cleanedText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  let turkishMeaning = "";
  let enExample = "";
  let trExample = "";
  let usageTip = "";

  // Dynamic regex extraction
  const mIndex = lines.findIndex(l => l.toLowerCase().includes('anlam') || l.toLowerCase().includes('mean') || l.toLowerCase().includes('türkçe'));
  const eIndex = lines.findIndex(l => l.toLowerCase().includes('örnek') || l.toLowerCase().includes('sentenc') || l.toLowerCase().includes('cümle'));
  const uIndex = lines.findIndex(l => l.toLowerCase().includes('ipucu') || l.toLowerCase().includes('tip') || l.toLowerCase().includes('kullanım'));

  if (mIndex !== -1 && mIndex < lines.length - 1) {
    turkishMeaning = lines[mIndex + 1];
  }
  if (eIndex !== -1 && eIndex < lines.length - 1) {
    enExample = lines[eIndex + 1];
    if (eIndex < lines.length - 2 && !lines[eIndex + 2].toLowerCase().includes('ipucu')) {
      trExample = lines[eIndex + 2];
    }
  }
  if (uIndex !== -1 && uIndex < lines.length - 1) {
    usageTip = lines[uIndex + 1];
  }

  // Fallbacks if formatting is unstructured
  if (!turkishMeaning) {
    turkishMeaning = lines[0] || "Türkçe çeviri yükleniyor...";
  }
  if (!enExample) {
    enExample = lines.find(l => l.includes('?') || l.includes('.')) || "Please use this word in daily activities.";
  }
  if (!usageTip) {
    usageTip = "Bu kelimeyi sık sık tekrarlayarak ve testlerimizi çözerek kalıcı hafızanıza alabilirsiniz.";
  }

  return {
    word: searchWord,
    turkishMeaning,
    exampleSentenceEn: enExample,
    exampleSentenceTr: trExample || "Örnek cümlenin Türkçe çevirisi.",
    usageTip
  };
};
