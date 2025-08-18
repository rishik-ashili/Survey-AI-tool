
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
  const [currentQuestion, setCurrentQuestion] = useState<ChatbotQuestion | null>(null);
  
  const allQuestionsFlattened = useMemo(() => {
    const flatQuestions: ChatbotQuestion[] = [];
    const processQuestions = (qs: SurveyQuestion[]) => {
      for (const q of qs) {
        flatQuestions.push({ ...q, originalId: q.id });
         if (q.sub_questions) {
           processQuestions(q.sub_questions);
         }
      }
    }
    processQuestions(questions);
    return flatQuestions;
  }, [questions]);


  const scrollAreaRef = useRef<HTMLDivElement>(null);
  
  const addMessage = useCallback((sender: "user" | "bot", text: string) => {
    const newId = `${Date.now()}-${Math.random()}`;
    setMessages(prev => [...prev, { id: newId, sender, text }]);
  }, []);
  
  const findNextQuestion = useCallback(() => {
    const currentQuestionOriginalId = currentQuestion?.originalId;
    let baseIndex = -1;
    
    if (currentQuestionOriginalId) {
      baseIndex = allQuestionsFlattened.findIndex(q => q.id === currentQuestionOriginalId);
      
      // Handle iteration
      if (currentQuestion && currentQuestion.is_iterative) {
        const iterationCount = getIterationCount(currentQuestion);
        const currentIteration = currentQuestion.iterationIndex ?? -1;
        if (currentIteration < iterationCount - 1) {
          // Next iteration of the same question
          return { ...currentQuestion, text: `${currentQuestion.text.split(' (Entry')[0]} (Entry ${currentIteration + 2})`, iterationIndex: currentIteration + 1 };
        }
        // End of iterations, move to the next question in the flattened list
      }
    }

    // Find the next question that is actually visible
    for (let i = baseIndex + 1; i < allQuestionsFlattened.length; i++) {
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
  }, [currentQuestion, allQuestionsFlattened, isQuestionVisible, getIterationCount]);


  const askQuestion = useCallback((question: ChatbotQuestion | null) => {
    setIsBotTyping(true);
    setTimeout(() => {
        setIsBotTyping(false);
        if (question) {
            let questionText = messages.length > 0 
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
            addMessage("bot", questionText);
            setCurrentQuestion(question);
        } else {
            addMessage("bot", "That's all the questions I have! You can now submit the survey using the button on the main page, or by typing 'submit'.");
            setCurrentQuestion(null);
        }
    }, 500); // A small delay to feel more natural and allow UI to update
  }, [addMessage, messages.length]);


  const startConversation = useCallback(() => {
    setMessages([]);
    const firstQuestion = findNextQuestion();
    askQuestion(firstQuestion);
  }, [askQuestion, findNextQuestion]);
  

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
        if(!currentQuestion) {
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
      
      // Give React time to re-render with the new conditional question (if any)
      setTimeout(() => {
         const nextQuestion = findNextQuestion();
         askQuestion(nextQuestion);
      }, 500);

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
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className={`max-w-[75%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${msg.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                        {msg.text}
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
                 <Button type="submit" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8" onClick={handleUserInput} disabled={isBotTyping || !inputValue.trim()}>
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
