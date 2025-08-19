
"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Bot, Send, Loader2, X, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { SurveyQuestion } from "@/types";
import { Button } from "./ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Textarea } from "./ui/textarea";
import { handleValidateAnswer } from "@/app/actions";
import { ScrollArea } from "./ui/scroll-area";
import ChatbotAvatar from "./chatbot-avatar";
import { useLanguage } from '@/contexts/language-context';
import TranslatableText from './translatable-text';
import { useLiveTranslation } from '@/hooks/use-live-translation';

type Message = {
  id: string;
  text: string;
  sender: "user" | "bot";
};

type ChatbotQuestion = SurveyQuestion & {
  originalId: string;
  iterationIndex?: number;
}

type SurveyChatbotProps = {
  questions: SurveyQuestion[];
  onAnswerChange: (questionId: string, value: any, isIterative?: boolean, iterationIndex?: number) => void;
  onSubmit: () => Promise<void>;
  currentAnswers: Record<string, any>;
  isQuestionVisible: (question: SurveyQuestion) => boolean;
  getIterationCount: (question: SurveyQuestion) => number;
};

export default function SurveyChatbot({
  questions,
  onAnswerChange,
  onSubmit,
  currentAnswers,
  isQuestionVisible,
  getIterationCount
}: SurveyChatbotProps) {
  const { t, language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<ChatbotQuestion | null>(null);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // Check online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    setIsOnline(navigator.onLine);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const allQuestionsFlattened = useMemo(() => {
    const flatQuestions: ChatbotQuestion[] = [];

    const processQuestions = (qs: SurveyQuestion[]) => {
      for (const q of qs) {
        // Add the main question
        flatQuestions.push({
          ...q,
          originalId: q.id
        });

        // Process sub-questions recursively
        if (q.sub_questions) {
          processQuestions(q.sub_questions);
        }
      }
    };

    processQuestions(questions);
    return flatQuestions;
  }, [questions]);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthesisRef = useRef<SpeechSynthesisUtterance | null>(null);

  const addMessage = useCallback((sender: "user" | "bot", text: string) => {
    const newId = `${Date.now()}-${Math.random()}`;
    // Store original text - translation will be handled by the UI component
    setMessages(prev => [...prev, { id: newId, sender, text }]);
  }, []);

  // Text-to-Speech functionality
  const speakQuestion = useCallback((questionText: string) => {
    if (!isVoiceMode || !window.speechSynthesis) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(questionText);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 0.8;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      setIsSpeaking(false);
    };

    synthesisRef.current = utterance;

    // Add a small delay to ensure speech synthesis is ready
    setTimeout(() => {
      try {
        window.speechSynthesis.speak(utterance);
      } catch (error) {
        console.error('Failed to speak:', error);
        setIsSpeaking(false);
      }
    }, 50);
  }, [isVoiceMode]);

  // Speech-to-Text functionality
  const startListening = useCallback(() => {
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      console.log('Speech recognition started');
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      console.log('Speech recognized:', transcript);
      setInputValue(transcript);
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);

      // Provide user feedback for common errors
      if (event.error === 'no-speech') {
        alert('No speech detected. Please try speaking again.');
      } else if (event.error === 'audio-capture') {
        alert('Microphone access denied. Please allow microphone access and try again.');
      } else if (event.error === 'not-allowed') {
        alert('Microphone access denied. Please allow microphone access and try again.');
      } else if (event.error === 'network') {
        alert('Network error occurred. Please check your internet connection and try again. Speech recognition requires an internet connection.');
      } else if (event.error === 'service-not-allowed') {
        alert('Speech recognition service is not available. Please try again later or use text input instead.');
      } else {
        alert(`Speech recognition error: ${event.error}. Please try again or use text input instead.`);
      }
    };

    recognition.onend = () => {
      console.log('Speech recognition ended');
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      setIsListening(false);
      alert('Failed to start speech recognition. Please try again or use text input instead.');
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.error('Error stopping speech recognition:', error);
      }
      setIsListening(false);
    }
  }, []);

  // Cleanup speech synthesis on unmount
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (error) {
          console.error('Error stopping recognition during cleanup:', error);
        }
      }
    };
  }, []);

  const findNextQuestion = useCallback(() => {
    if (!currentQuestion) {
      // First question - find the first visible question
      for (const q of allQuestionsFlattened) {
        if (isQuestionVisible(q)) {
          return q;
        }
      }
      return null;
    }

    // Handle iteration for current question
    if (currentQuestion.is_iterative) {
      const iterationCount = getIterationCount(currentQuestion);
      const currentIteration = currentQuestion.iterationIndex ?? -1;
      if (currentIteration < iterationCount - 1) {
        // Next iteration of the same question
        return {
          ...currentQuestion,
          text: `${currentQuestion.text.split(' (Entry')[0]} (Entry ${currentIteration + 2})`,
          iterationIndex: currentIteration + 1
        };
      }
    }

    // Check for conditional questions that should appear based on the current question's answer
    const findQuestionInHierarchy = (qs: SurveyQuestion[], targetId: string): SurveyQuestion | null => {
      for (const q of qs) {
        if (q.id === targetId) {
          return q;
        }
        if (q.sub_questions) {
          const found = findQuestionInHierarchy(q.sub_questions, targetId);
          if (found) return found;
        }
      }
      return null;
    };

    // Find the current question in the original hierarchy to check for sub-questions
    const currentQuestionData = findQuestionInHierarchy(questions, currentQuestion.originalId);

    if (currentQuestionData && currentQuestionData.sub_questions) {
      // Check each sub-question to see if it should be visible now
      for (const subQ of currentQuestionData.sub_questions) {
        // Strategy 1: Use the isQuestionVisible function
        if (isQuestionVisible(subQ)) {
          return { ...subQ, originalId: subQ.id };
        }

        // Strategy 2: Direct check of trigger condition
        const parentAnswerRaw = currentAnswers[currentQuestionData.id];
        const parentAnswer = typeof parentAnswerRaw === 'object' ? (parentAnswerRaw?.value ?? parentAnswerRaw?.values) : parentAnswerRaw;

        if (parentAnswer !== undefined && parentAnswer !== null) {
          const triggerValue = String(subQ.trigger_condition_value || '').toLowerCase();

          if (Array.isArray(parentAnswer)) {
            // Multiple choice answer - check if any value matches
            const hasMatch = parentAnswer.some(ans => String(ans).toLowerCase() === triggerValue);
            if (hasMatch) {
              return { ...subQ, originalId: subQ.id };
            }
          } else {
            // Single answer check
            const answerValue = String(parentAnswer).toLowerCase();
            if (answerValue === triggerValue) {
              return { ...subQ, originalId: subQ.id };
            }
          }
        }
      }
    }

    // If no conditional questions found, find the next main question that is visible
    const currentIndex = allQuestionsFlattened.findIndex(q => q.id === currentQuestion.originalId);
    for (let i = currentIndex + 1; i < allQuestionsFlattened.length; i++) {
      const nextQ = allQuestionsFlattened[i];
      if (isQuestionVisible(nextQ)) {
        const iterationCount = getIterationCount(nextQ);
        if (nextQ.is_iterative && iterationCount > 0) {
          return { ...nextQ, text: `${nextQ.text} (Entry 1)`, iterationIndex: 0 };
        }
        return nextQ;
      }
    }

    return null; // No more questions
  }, [currentQuestion, allQuestionsFlattened, questions, isQuestionVisible, getIterationCount, currentAnswers]);

  const toggleVoiceMode = useCallback(() => {
    setIsVoiceMode(prev => {
      const newVoiceMode = !prev;

      // If enabling voice mode and there's a current question, speak it immediately
      if (newVoiceMode && currentQuestion && window.speechSynthesis) {
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        // Speak the current question with a longer delay to ensure synthesis is ready
        setTimeout(() => {
          speakQuestion(currentQuestion.text);
        }, 200);
      } else if (!newVoiceMode && window.speechSynthesis) {
        // If disabling voice mode, stop any ongoing speech
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
      }

      return newVoiceMode;
    });
  }, [currentQuestion, speakQuestion]);

  const askQuestion = useCallback((question: ChatbotQuestion | null) => {
    setIsBotTyping(true);
    setTimeout(() => {
      setIsBotTyping(false);
      if (question) {
        let questionText = messages.length > 1  // After user's first answer
          ? `Great, thanks! Next up: ${question.text}`
          : `Welcome! I'm here to help you with the survey. Let's start with the first question.\n\n${question.text}`;

        let options: string[] = [];
        if (question.type === 'yes-no') {
          options = ['Yes', 'No'];
        } else if (question.options) {
          options = question.options.map(o => o.text);
        }

        if (options.length > 0) {
          const optionsList = options.map((opt, i) => `${i + 1}. ${opt}`).join("\n");
          questionText += `\n\nYour options are:\n${optionsList}`;
        }
        addMessage("bot", question.text);
        setCurrentQuestion(question);

        // Speak the question if voice mode is enabled
        if (isVoiceMode) {
          // Add a longer delay to ensure the question is set and synthesis is ready
          setTimeout(() => {
            speakQuestion(question.text);
          }, 300);
        }
      } else {
        addMessage("bot", t('chatbot.thankYou'));
        setCurrentQuestion(null);
      }
    }, 500);
  }, [addMessage, messages.length, isVoiceMode, speakQuestion]);

  const startConversation = useCallback(() => {
    setMessages([]);

    // Add welcome message
    addMessage("bot", t('chatbot.hello'));

    // Start the survey after a short delay
    setTimeout(() => {
      const firstQuestion = findNextQuestion();
      askQuestion(firstQuestion);
    }, 1000);
  }, [askQuestion, findNextQuestion, addMessage, t]);

  useEffect(() => {
    if (isOpen) {
      startConversation();
    }
  }, [isOpen]);

  useEffect(() => {
    // Auto scroll to bottom when new messages are added
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        setTimeout(() => viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' }), 100);
      }
    }
  }, [messages]);

  const handleUserInput = async () => {
    if (!inputValue.trim() || !currentQuestion) return;

    const userAnswer = inputValue.trim();
    addMessage("user", userAnswer);
    setInputValue("");
    setIsBotTyping(true);

    if (userAnswer.toLowerCase() === 'submit') {
      if (!currentQuestion) {
        await onSubmit();
        addMessage("bot", t('chatbot.thankYou'));
        setIsBotTyping(false);
        setTimeout(() => setIsOpen(false), 2000);
        return;
      } else {
        addMessage("bot", "Please answer all the questions before submitting.");
        setIsBotTyping(false);
        return;
      }
    }

    let answerToSave = userAnswer;

    // Handle MCQ and yes-no questions with both numeric and text input
    if (currentQuestion.type.startsWith('multiple-choice') || currentQuestion.type === 'yes-no') {
      const options = currentQuestion.type === 'yes-no'
        ? ['Yes', 'No']
        : currentQuestion.options?.map(o => o.text) || [];

      // First try to parse as number
      const numericAnswer = parseInt(userAnswer, 10);
      if (!isNaN(numericAnswer) && numericAnswer > 0 && numericAnswer <= options.length) {
        answerToSave = options[numericAnswer - 1];
      } else {
        // If not a valid number, try to match the text input with options
        const normalizedInput = userAnswer.toLowerCase().trim();
        const matchedOption = options.find(option =>
          option.toLowerCase().trim() === normalizedInput ||
          option.toLowerCase().includes(normalizedInput) ||
          normalizedInput.includes(option.toLowerCase())
        );

        if (matchedOption) {
          answerToSave = matchedOption;
        } else {
          // If no exact match, try partial matching for longer options
          const partialMatch = options.find(option => {
            const optionWords = option.toLowerCase().split(/\s+/);
            const inputWords = normalizedInput.split(/\s+/);
            return inputWords.some(inputWord =>
              optionWords.some(optionWord =>
                optionWord.includes(inputWord) || inputWord.includes(optionWord)
              )
            );
          });

          if (partialMatch) {
            answerToSave = partialMatch;
          }
        }
      }
    }

    const validationInput: any = {
      question: currentQuestion.text,
      answer: answerToSave,
    };

    // Only add expected_answers if it has a value
    if (currentQuestion.expected_answers) {
      validationInput.expected_answers = currentQuestion.expected_answers;
    }

    const validationResult = await handleValidateAnswer(validationInput);

    if (validationResult.isValid) {
      onAnswerChange(currentQuestion.originalId, answerToSave, currentQuestion.is_iterative, currentQuestion.iterationIndex);

      // IMMEDIATE CHECK: Look for conditional questions that should appear right now
      const findQuestionInHierarchy = (qs: SurveyQuestion[], targetId: string): SurveyQuestion | null => {
        for (const q of qs) {
          if (q.id === targetId) {
            return q;
          }
          if (q.sub_questions) {
            const found = findQuestionInHierarchy(q.sub_questions, targetId);
            if (found) return found;
          }
        }
        return null;
      };

      const currentQuestionData = findQuestionInHierarchy(questions, currentQuestion.originalId);
      if (currentQuestionData && currentQuestionData.sub_questions) {
        // Check if any sub-questions should be visible now
        for (const subQ of currentQuestionData.sub_questions) {
          // Check if this sub-question should be visible based on the answer we just gave
          const parentAnswer = answerToSave; // Use the answer we just gave
          const triggerValue = String(subQ.trigger_condition_value || '').toLowerCase();

          if (Array.isArray(parentAnswer)) {
            // Multiple choice answer - check if any value matches
            const hasMatch = parentAnswer.some(ans => String(ans).toLowerCase() === triggerValue);
            if (hasMatch) {
              const conditionalQuestion = { ...subQ, originalId: subQ.id };
              askQuestion(conditionalQuestion);
              return; // Exit early, don't start polling
            }
          } else {
            // Single answer check
            const answerValue = String(parentAnswer).toLowerCase();
            if (answerValue === triggerValue) {
              // Ask this conditional question immediately
              const conditionalQuestion = { ...subQ, originalId: subQ.id };
              askQuestion(conditionalQuestion);
              return; // Exit early, don't start polling
            }
          }
        }
      }

      // If no conditional questions found, use the polling mechanism to find the next question
      let attempts = 0;
      const maxAttempts = 10;

      const findNextQuestionWithPolling = () => {
        attempts++;

        // Try the normal findNextQuestion first
        let nextQuestion = findNextQuestion();

        if (nextQuestion) {
          askQuestion(nextQuestion);
          return;
        }

        // If no question found and we haven't exceeded max attempts, try again after a short delay
        if (attempts < maxAttempts) {
          setTimeout(findNextQuestionWithPolling, 200);
        } else {
          // If we still can't find a question, assume we're done
          addMessage("bot", t('chatbot.thankYou'));
          setCurrentQuestion(null);
          setIsBotTyping(false);
        }
      };

      // Start the polling mechanism
      setTimeout(findNextQuestionWithPolling, 100);

    } else {
      addMessage("bot", t('chatbot.invalidAnswer'));
      setIsBotTyping(false);
    }
  };

  const handleVoiceInput = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      // Check if we're online first
      if (!isOnline) {
        alert('You appear to be offline. Speech recognition requires an internet connection. Please check your connection and try again.');
        return;
      }

      // Check if microphone permission is available
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ audio: true })
          .then(() => {
            // Microphone access granted, start listening
            startListening();
          })
          .catch((error) => {
            console.error('Microphone access denied:', error);
            if (error.name === 'NotAllowedError') {
              alert('Microphone access denied. Please allow microphone access in your browser settings and try again.\n\nTo enable microphone access:\n1. Click the microphone icon in your browser\'s address bar\n2. Select "Allow"\n3. Refresh the page and try again');
            } else if (error.name === 'NotFoundError') {
              alert('No microphone found. Please connect a microphone and try again.');
            } else {
              alert('Microphone access error: ' + error.message + '\n\nPlease check your microphone settings and try again.');
            }
          });
      } else {
        // Fallback for browsers without getUserMedia
        console.warn('getUserMedia not supported, trying speech recognition directly');
        startListening();
      }
    }
  }, [isListening, startListening, stopListening, isOnline]);

  if (!isOpen) {
    return (
      <Button
        className="fixed bottom-8 right-8 rounded-full h-16 w-16 shadow-lg z-50"
        onClick={() => setIsOpen(true)}
      >
        <Bot className="h-8 w-8" />
        <span className="sr-only">Open Survey Chatbot</span>
      </Button>
    );
  }

  return (
    <div className="fixed bottom-8 right-8 z-50">
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.5 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.5 }}
          className="w-[400px] h-[600px] shadow-2xl rounded-lg overflow-hidden"
        >
          <Card className="h-full w-full flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between p-4 border-b">
              <div className="flex items-center gap-3">
                <ChatbotAvatar />
                <CardTitle className="text-lg"><TranslatableText>Survey Assistant</TranslatableText></CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleVoiceMode}
                  className={`h-8 w-8 ${isVoiceMode ? 'text-blue-500' : 'text-gray-500'} ${isSpeaking ? 'animate-pulse' : ''}`}
                  title={
                    isSpeaking
                      ? t('chatbot.listening')
                      : isVoiceMode
                        ? t('chatbot.voiceMode')
                        : t('chatbot.voiceMode')
                  }
                >
                  {isVoiceMode ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-0 min-h-0">
              <ScrollArea className="h-full p-4" ref={scrollAreaRef}>
                <div className="space-y-4">
                  {messages.map(msg => (
                    <div key={msg.id} className={`flex items-end gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.sender === 'bot' && <ChatbotAvatar className="h-8 w-8" />}
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className={`max-w-[75%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${msg.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                        <TranslatableText>{msg.text}</TranslatableText>
                      </motion.div>
                    </div>
                  ))}
                  {isBotTyping && (
                    <div className="flex items-end gap-2 justify-start">
                      <ChatbotAvatar className="h-8 w-8" />
                      <div className="max-w-[75%] rounded-lg px-3 py-2 bg-muted flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.3s]" />
                        <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.15s]" />
                        <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce" />
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
            <CardFooter className="p-4 border-t">
              <div className="relative w-full">
                <Textarea
                  placeholder={useLiveTranslation('Type your answer here...')}
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleUserInput();
                    }
                  }}
                  className="pr-20 min-h-0 h-12"
                  rows={1}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <Button
                    type="button"
                    size="icon"
                    onClick={handleVoiceInput}
                    className={`h-8 w-8 ${isListening
                      ? 'text-red-500 animate-pulse'
                      : !isOnline
                        ? 'text-gray-400 cursor-not-allowed'
                        : 'text-gray-500 hover:text-gray-700'
                      }`}
                    title={
                      !isOnline
                        ? t('chatbot.offline')
                        : isListening
                          ? t('chatbot.listening')
                          : t('chatbot.voiceMode')
                    }
                    disabled={!isOnline}
                  >
                    {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </Button>
                  <Button
                    type="submit"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleUserInput}
                    disabled={isBotTyping || !inputValue.trim()}
                  >
                    <Send className="h-4 w-4" />
                    <span className="sr-only">{t('chatbot.send')}</span>
                  </Button>
                </div>
              </div>
            </CardFooter>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
