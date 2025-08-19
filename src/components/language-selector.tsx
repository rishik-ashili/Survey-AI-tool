"use client";

import { useLanguage, Language } from '@/contexts/language-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Globe } from 'lucide-react';

export default function LanguageSelector() {
    const { language, setLanguage, t } = useLanguage();

    const handleLanguageChange = (value: Language) => {
        setLanguage(value);
    };

    return (
        <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <Select value={language} onValueChange={handleLanguageChange}>
                <SelectTrigger className="w-32">
                    <SelectValue placeholder={t('language.select')} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="en">{t('language.english')}</SelectItem>
                    <SelectItem value="hi">{t('language.hindi')}</SelectItem>
                </SelectContent>
            </Select>
        </div>
    );
}
