
"use client";

import { useState, useEffect, useRef } from "react";
import { Bot, Send, Loader2, X, CornerDownLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { SurveyQuestion } from "@/types";
import { Button } from "./ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Textarea } from "./ui/textarea";
import { handleRespondToSurveyAnswer, handleValidateAnswer } from "@/app/actions";
import { ScrollArea } from "./ui/scroll-area";
import ChatbotAvatar from "./chatbot-avatar";
import { useToast } from "@/hooks/use-toast";

type Message = {
  id: string;
  text: string;
  sender: "user" | "bot";
};

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
  const [currentIteration, setCurrentIteration] = useState(0);

  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const visibleQuestions = questions.flatMap(q => {
    if (!isQuestionVisible(q)) return [];
    if (q.is_iterative) {
      const count = getIterationCount(q);
      return Array.from({ length: count }, (_, i) => ({ ...q, originalId: q.id, iterationIndex: i, text: `${q.text} (Entry ${i + 1})`}));
    }
    return [{ ...q, originalId: q.id }];
  });

  const currentQuestion = visibleQuestions[currentQuestionIndex];

  useEffect(() => {
    if (isOpen && messages.length === 0) {
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


  const startConversation = () => {
    setIsBotTyping(true);
    setMessages([]);
    setCurrentQuestionIndex(-1);
    setTimeout(() => {
      addMessage("bot", "Hello! I'm here to help you with this survey. Let's start with the first question.");
      setCurrentQuestionIndex(0);
      askQuestion(0);
      setIsBotTyping(false);
    }, 1000);
  };

  const askQuestion = (index: number) => {
    const questionToAsk = visibleQuestions[index];
    if (questionToAsk) {
      addMessage("bot", questionToAsk.text);
    } else {
      addMessage("bot", "That's all the questions I have! You can now submit the survey using the button on the main page, or by typing 'submit'.");
    }
  };

  const addMessage = (sender: "user" | "bot", text: string) => {
    setMessages(prev => [...prev, { id: Date.now().toString(), sender, text }]);
  };

  const handleUserInput = async () => {
    if (!inputValue.trim() || !currentQuestion) return;

    const userAnswer = inputValue;
    addMessage("user", userAnswer);
    setInputValue("");
    setIsBotTyping(true);
    
    if (currentQuestion.type === 'yes-no' || currentQuestion.type === 'multiple-choice') {
        const options = (currentQuestion.type === 'yes-no' ? ['Yes', 'No'] : currentQuestion.options?.map(o => o.text)) || [];
        const matchedOption = options.find(opt => opt.toLowerCase() === userAnswer.toLowerCase().trim());
        if (!matchedOption) {
            const suggestion = `Please choose one of the following: ${options.join(', ')}.`;
            const botResponse = await handleRespondToSurveyAnswer({
                question: currentQuestion.text,
                answer: userAnswer,
                isAnswerValid: false,
                validationSuggestion: suggestion,
                isLastQuestion: false,
            });
            addMessage("bot", botResponse.response);
            setIsBotTyping(false);
            return;
        }
    }


    const validationResult = await handleValidateAnswer({
      question: currentQuestion.text,
      answer: userAnswer,
      expected_answers: currentQuestion.expected_answers
    });

    onAnswerChange(currentQuestion.originalId, userAnswer, currentQuestion.is_iterative, currentQuestion.iterationIndex);

    const isLastQuestion = currentQuestionIndex >= visibleQuestions.length - 1;

    const botResponse = await handleRespondToSurveyAnswer({
      question: currentQuestion.text,
      answer: userAnswer,
      isAnswerValid: validationResult.isValid,
      validationSuggestion: validationResult.suggestion,
      isLastQuestion,
    });
    
    addMessage("bot", botResponse.response);

    if (validationResult.isValid && !isLastQuestion) {
      const nextIndex = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIndex);
      askQuestion(nextIndex);
    }
    
    if (userAnswer.toLowerCase() === 'submit' && isLastQuestion) {
        await onSubmit();
        addMessage("bot", "Your survey has been submitted. Thank you!");
    }


    setIsBotTyping(false);
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
            <CardContent className="flex-1 p-0">
               <ScrollArea className="h-full p-4" ref={scrollAreaRef}>
                 <div className="space-y-4">
                  {messages.map(msg => (
                    <div key={msg.id} className={`flex items-end gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.sender === 'bot' && <ChatbotAvatar className="h-8 w-8" />}
                      <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${msg.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
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
