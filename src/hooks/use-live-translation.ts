"use client";

import { useState, useEffect } from 'react';
import { translateText, isEnglishText, cleanTextForTranslation } from '@/lib/translation';
import { useLanguage } from '@/contexts/language-context';

export function useLiveTranslation(originalText: any): string {
    const { language } = useLanguage();

    // Ensure we always work with a string, handle null/undefined safely
    const safeText = originalText == null ? '' : (typeof originalText === 'string' ? originalText : String(originalText));

    const [translatedText, setTranslatedText] = useState(safeText);
    const [lastTranslatedText, setLastTranslatedText] = useState('');
    const [lastLanguage, setLastLanguage] = useState(language);

    useEffect(() => {
        // Prevent unnecessary re-renders
        if (lastTranslatedText === safeText && lastLanguage === language) {
            return;
        }

        // If language is English, return original text
        if (language === 'en') {
            setTranslatedText(safeText);
            setLastTranslatedText(safeText);
            setLastLanguage(language);
            return;
        }

        // If text is empty or not English, return as is
        if (!safeText || !isEnglishText(safeText)) {
            setTranslatedText(safeText);
            setLastTranslatedText(safeText);
            setLastLanguage(language);
            return;
        }

        // Debounce translation to prevent too many API calls
        const timeoutId = setTimeout(async () => {
            try {
                const cleanedText = cleanTextForTranslation(safeText);
                const translated = await translateText(cleanedText, language);
                setTranslatedText(translated);
                setLastTranslatedText(safeText);
                setLastLanguage(language);
            } catch (error) {
                console.error('Translation failed:', error);
                setTranslatedText(safeText);
                setLastTranslatedText(safeText);
                setLastLanguage(language);
            }
        }, 100); // 100ms debounce

        return () => clearTimeout(timeoutId);
    }, [safeText, language, lastTranslatedText, lastLanguage]);

    return translatedText;
}

// Hook for translating arrays of text
export function useLiveTranslationArray(originalTexts: string[]): string[] {
    const { language } = useLanguage();
    const [translatedTexts, setTranslatedTexts] = useState(originalTexts);

    useEffect(() => {
        if (language === 'en') {
            setTranslatedTexts(originalTexts);
            return;
        }

        const translateAsync = async () => {
            try {
                const promises = originalTexts.map(async (text) => {
                    if (!text || !isEnglishText(text)) return text;
                    const cleanedText = cleanTextForTranslation(text);
                    return await translateText(cleanedText, language);
                });

                const translated = await Promise.all(promises);
                setTranslatedTexts(translated);
            } catch (error) {
                console.error('Batch translation failed:', error);
                setTranslatedTexts(originalTexts);
            }
        };

        translateAsync();
    }, [originalTexts, language]);

    return translatedTexts;
}
