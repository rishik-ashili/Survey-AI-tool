
"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Bot, Send, Loader2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { SurveyQuestion } from "@/types";
import { Button } from "./ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Textarea } from "./ui/textarea";
import { handleValidateAnswer } from "@/app/actions";
import { ScrollArea } from "./ui/scroll-area";
import ChatbotAvatar from "./chatbot-avatar";

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
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1);
  const [visibleQuestions, setVisibleQuestions] = useState<ChatbotQuestion[]>([]);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  
   useEffect(() => {
    // This effect recalculates the list of visible questions whenever the answers change.
    // This is crucial for handling conditional questions that appear based on user input.
    const flatQuestions: ChatbotQuestion[] = [];
    const processQuestions = (qs: SurveyQuestion[]) => {
      for (const q of qs) {
        if (isQuestionVisible(q)) {
          const iterationCount = getIterationCount(q);
          if (q.is_iterative && iterationCount > 0) {
            for (let i = 0; i < iterationCount; i++) {
              flatQuestions.push({ ...q, originalId: q.id, text: `${q.text} (Entry ${i + 1})`, iterationIndex: i });
            }
          } else {
            flatQuestions.push({ ...q, originalId: q.id });
            if (q.sub_questions) {
              processQuestions(q.sub_questions);
            }
          }
        }
      }
    }
    processQuestions(questions);
    setVisibleQuestions(flatQuestions);
  }, [questions, currentAnswers, isQuestionVisible, getIterationCount]);


  const currentQuestion = useMemo(() => {
    return visibleQuestions[currentQuestionIndex];
  }, [visibleQuestions, currentQuestionIndex]);

  const addMessage = useCallback((sender: "user" | "bot", text: string) => {
    const newId = `${Date.now()}-${Math.random()}`;
    setMessages(prev => [...prev, { id: newId, sender, text }]);
  }, []);


  const askQuestion = useCallback((question?: ChatbotQuestion) => {
    setIsBotTyping(false);
    if (question) {
        let questionText = `Great, thanks! Next up: ${question.text}`;
        
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
      addMessage("bot", questionText);
    } else {
      addMessage("bot", "That's all the questions I have! You can now submit the survey using the button on the main page, or by typing 'submit'.");
    }
  }, [addMessage]);

  const startConversation = useCallback(() => {
    setMessages([]);
    setCurrentQuestionIndex(-1); // Will be incremented to 0
    setIsBotTyping(true);

    if (visibleQuestions.length === 0) {
        addMessage("bot", "This survey has no questions!");
        setIsBotTyping(false);
        return;
    }
    const firstQuestion = visibleQuestions[0];
    let questionText = `Welcome! I'm here to help you with the survey. Let's start with the first question.\n\n${firstQuestion.text}`;
    let options: string[] = [];
    if (firstQuestion.type === 'yes-no') {
        options = ['Yes', 'No'];
    } else if (firstQuestion.options) {
        options = firstQuestion.options.map(o => o.text);
    }
    
    if (options.length > 0) {
        const optionsList = options.map((opt, i) => `${i + 1}. ${opt}`).join("\n");
        questionText += `\n\nYour options are:\n${optionsList}`;
    }

    addMessage("bot", questionText);
    setCurrentQuestionIndex(0);
    setIsBotTyping(false);

  }, [addMessage, visibleQuestions]);

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

    const userAnswer = inputValue;
    addMessage("user", userAnswer);
    setInputValue("");
    setIsBotTyping(true);
    
    if (userAnswer.trim().toLowerCase() === 'submit') {
        const isLastQuestionAnswered = currentQuestionIndex >= visibleQuestions.length;
        if(isLastQuestionAnswered) {
             await onSubmit();
             addMessage("bot", "Your survey has been submitted successfully. Thank you for your time!");
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
    const numericAnswer = parseInt(userAnswer.trim(), 10);

    if (!isNaN(numericAnswer) && (currentQuestion.type.startsWith('multiple-choice') || currentQuestion.type === 'yes-no')) {
      const options = currentQuestion.type === 'yes-no'
        ? ['Yes', 'No']
        : currentQuestion.options?.map(o => o.text) || [];
      
      if (numericAnswer > 0 && numericAnswer <= options.length) {
        answerToSave = options[numericAnswer - 1];
      }
    }

    const validationResult = await handleValidateAnswer({
      question: currentQuestion.text,
      answer: answerToSave,
      expected_answers: currentQuestion.expected_answers
    });
    
    if(validationResult.isValid) {
      onAnswerChange(currentQuestion.originalId, answerToSave, currentQuestion.is_iterative, currentQuestion.iterationIndex);
      
      const nextIndex = currentQuestionIndex + 1;
      
      // We need to wait for the state to update and the visibleQuestions to be recalculated
      setTimeout(() => {
        // We need to access the latest state of visibleQuestions, so we do it via the setState callback
         setVisibleQuestions(currentVisibleQuestions => {
            setCurrentQuestionIndex(nextIndex);
            askQuestion(currentVisibleQuestions[nextIndex]);
            return currentVisibleQuestions;
        });
      }, 500); // A small delay to allow React to re-render and for sub-questions to appear.

    } else {
        addMessage("bot", `I'm sorry, that doesn't seem like a valid answer. ${validationResult.suggestion}\n\nPlease try again.`);
        setIsBotTyping(false);
    }
  };

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
                <CardTitle className="text-lg">Survey Assistant</CardTitle>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="flex-1 p-0 min-h-0">
               <ScrollArea className="h-full p-4" ref={scrollAreaRef}>
                 <div className="space-y-4">
                  {messages.map(msg => (
                    <div key={msg.id} className={`flex items-end gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.sender === 'bot' && <ChatbotAvatar className="h-8 w-8" />}
                      <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${msg.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                        {msg.text}
                      </div>
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
                  placeholder="Type your answer..."
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
                 <Button type="submit" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8" onClick={handleUserInput} disabled={isBotTyping || !inputValue.trim() || !currentQuestion}>
                    <Send className="h-4 w-4"/>
                    <span className="sr-only">Send</span>
                </Button>
              </div>
            </CardFooter>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
