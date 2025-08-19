"use client";

import { memo } from 'react';
import { useLiveTranslation } from '@/hooks/use-live-translation';

interface TranslatableTextProps {
    children: any;
    className?: string;
    as?: keyof JSX.IntrinsicElements;
}

const TranslatableText = memo(function TranslatableText({
    children,
    className = '',
    as: Component = 'span'
}: TranslatableTextProps) {
    const translatedText = useLiveTranslation(children);

    return <Component className={className}>{translatedText}</Component>;
});

export default TranslatableText;

// Specialized components for common use cases
export const TranslatableLabel = memo(function TranslatableLabel({
    children,
    className = '',
    ...props
}: {
    children: any;
    className?: string;
    [key: string]: any
}) {
    const translatedText = useLiveTranslation(children);
    return <label className={className} {...props}>{translatedText}</label>;
});

export const TranslatableButton = memo(function TranslatableButton({
    children,
    className = '',
    ...props
}: {
    children: any;
    className?: string;
    [key: string]: any
}) {
    const translatedText = useLiveTranslation(children);
    return <button className={className} {...props}>{translatedText}</button>;
});

export function TranslatablePlaceholder({ text }: { text: any }) {
    return useLiveTranslation(text);
}
