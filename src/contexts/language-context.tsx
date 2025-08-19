"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

export type Language = 'en' | 'hi';

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Translation dictionary
const translations: Record<Language, Record<string, string>> = {
    en: {
        // Survey Form
        'survey.title': 'Survey',
        'survey.submit': 'Submit Survey',
        'survey.submitting': 'Submitting...',
        'survey.anonymous': 'Submit Anonymously',
        'survey.enterName': 'Enter your name',
        'survey.name': 'Your Name',
        'survey.required': 'This field is required',
        'survey.selectOption': 'Select an option',
        'survey.selectMultiple': 'Select all that apply',
        'survey.yes': 'Yes',
        'survey.no': 'No',
        'survey.pause': 'Pause',
        'survey.resume': 'Resume',
        'survey.paused': 'Survey Paused',

        // Chatbot
        'chatbot.title': 'Survey Assistant',
        'chatbot.placeholder': 'Type your answer here...',
        'chatbot.send': 'Send',
        'chatbot.voiceMode': 'Voice Mode',
        'chatbot.listening': 'Listening...',
        'chatbot.micPermission': 'Microphone permission required for voice input',
        'chatbot.networkError': 'Network error. Please check your connection.',
        'chatbot.offline': 'You appear to be offline',
        'chatbot.hello': 'Hello! I\'m here to help you with the survey. Let\'s get started!',
        'chatbot.nextQuestion': 'Great! Let\'s move to the next question.',
        'chatbot.invalidAnswer': 'Please provide a valid answer.',
        'chatbot.selectFromOptions': 'Please select from the available options:',
        'chatbot.thankYou': 'Thank you for completing the survey!',

        // Language Selector
        'language.english': 'English',
        'language.hindi': 'हिंदी',
        'language.select': 'Language',

        // Question Types
        'question.text': 'Text Answer',
        'question.number': 'Number',
        'question.multipleChoice': 'Multiple Choice',
        'question.yesNo': 'Yes/No',

        // Common
        'common.loading': 'Loading...',
        'common.error': 'Error',
        'common.success': 'Success',
        'common.cancel': 'Cancel',
        'common.save': 'Save',
        'common.edit': 'Edit',
        'common.delete': 'Delete',
    },
    hi: {
        // Survey Form
        'survey.title': 'सर्वेक्षण',
        'survey.submit': 'सर्वेक्षण जमा करें',
        'survey.submitting': 'जमा कर रहे हैं...',
        'survey.anonymous': 'गुमनाम रूप से जमा करें',
        'survey.enterName': 'अपना नाम दर्ज करें',
        'survey.name': 'आपका नाम',
        'survey.required': 'यह फील्ड आवश्यक है',
        'survey.selectOption': 'एक विकल्प चुनें',
        'survey.selectMultiple': 'सभी लागू विकल्प चुनें',
        'survey.yes': 'हां',
        'survey.no': 'नहीं',
        'survey.pause': 'रोकें',
        'survey.resume': 'जारी रखें',
        'survey.paused': 'सर्वेक्षण रोका गया',

        // Chatbot
        'chatbot.title': 'सर्वेक्षण सहायक',
        'chatbot.placeholder': 'यहाँ अपना उत्तर टाइप करें...',
        'chatbot.send': 'भेजें',
        'chatbot.voiceMode': 'आवाज़ मोड',
        'chatbot.listening': 'सुन रहे हैं...',
        'chatbot.micPermission': 'आवाज़ इनपुट के लिए माइक्रोफोन की अनुमति आवश्यक है',
        'chatbot.networkError': 'नेटवर्क त्रुटि। कृपया अपना कनेक्शन जांचें।',
        'chatbot.offline': 'आप ऑफ़लाइन प्रतीत होते हैं',
        'chatbot.hello': 'नमस्ते! मैं सर्वेक्षण में आपकी सहायता के लिए यहाँ हूँ। चलिए शुरू करते हैं!',
        'chatbot.nextQuestion': 'बहुत बढ़िया! आइए अगले प्रश्न पर चलते हैं।',
        'chatbot.invalidAnswer': 'कृपया एक वैध उत्तर प्रदान करें।',
        'chatbot.selectFromOptions': 'कृपया उपलब्ध विकल्पों में से चुनें:',
        'chatbot.thankYou': 'सर्वेक्षण पूरा करने के लिए धन्यवाद!',

        // Language Selector
        'language.english': 'English',
        'language.hindi': 'हिंदी',
        'language.select': 'भाषा',

        // Question Types
        'question.text': 'टेक्स्ट उत्तर',
        'question.number': 'संख्या',
        'question.multipleChoice': 'बहुविकल्पीय',
        'question.yesNo': 'हां/नहीं',

        // Common
        'common.loading': 'लोड हो रहा है...',
        'common.error': 'त्रुटि',
        'common.success': 'सफलता',
        'common.cancel': 'रद्द करें',
        'common.save': 'सहेजें',
        'common.edit': 'संपादित करें',
        'common.delete': 'हटाएं',
    }
};

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [language, setLanguage] = useState<Language>('en');

    const t = (key: string, fallback?: string): string => {
        return translations[language][key] || fallback || key;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
}
