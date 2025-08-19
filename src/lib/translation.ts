"use client";

// Simple cache for translations to avoid repeated API calls
const translationCache = new Map<string, string>();

// Google Translate API function (using free endpoint)
export async function translateText(text: any, targetLanguage: string = 'hi'): Promise<string> {
    // Return original text if target is English or text is empty
    if (targetLanguage === 'en' || !text || typeof text !== 'string' || text.trim().length === 0) {
        return typeof text === 'string' ? text : '';
    }

    // Check cache first
    const cacheKey = `${text}_${targetLanguage}`;
    if (translationCache.has(cacheKey)) {
        return translationCache.get(cacheKey)!;
    }

    try {
        // Using MyMemory Translation API (free, no API key required)
        const response = await fetch(
            `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${targetLanguage}`
        );

        if (!response.ok) {
            throw new Error('Translation API error');
        }

        const data = await response.json();
        const translatedText = data.responseData?.translatedText || text;

        // Cache the translation
        translationCache.set(cacheKey, translatedText);

        return translatedText;
    } catch (error) {
        console.error('Translation error:', error);
        // Return original text if translation fails
        return text;
    }
}

// Batch translation for multiple texts
export async function translateTexts(texts: string[], targetLanguage: string = 'hi'): Promise<string[]> {
    if (targetLanguage === 'en') {
        return texts;
    }

    const promises = texts.map(text => translateText(text, targetLanguage));
    return Promise.all(promises);
}

// Detect if text contains English characters (simple heuristic)
export function isEnglishText(text: any): boolean {
    if (!text || typeof text !== 'string') return false;
    // Check if text contains primarily Latin characters
    const englishRegex = /^[a-zA-Z0-9\s.,!?;:()\-"']+$/;
    return englishRegex.test(text.trim());
}

// Clean text for translation (remove extra spaces, special chars)
export function cleanTextForTranslation(text: any): string {
    if (!text || typeof text !== 'string') return '';
    return text
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .replace(/[^\w\s.,!?;:()\-"']/g, '') // Remove special characters except common punctuation
        .trim();
}
