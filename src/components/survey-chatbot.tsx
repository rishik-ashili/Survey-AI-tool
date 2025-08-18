
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
  // Debug: Log what questions data the chatbot receives
  console.log('=== DEBUG: Chatbot Received Questions ===', questions);
  console.log('=== DEBUG: First question in chatbot ===', questions[0]);
  console.log('=== DEBUG: First question sub_questions in chatbot ===', questions[0]?.sub_questions);

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<ChatbotQuestion | null>(null);

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

  const addMessage = useCallback((sender: "user" | "bot", text: string) => {
    const newId = `${Date.now()}-${Math.random()}`;
    setMessages(prev => [...prev, { id: newId, sender, text }]);
  }, []);

  // ROBUST APPROACH: Create a function that directly scans the DOM to find all visible questions
  // and their hierarchical relationships, bypassing any data structure issues
  const scanVisibleQuestionsFromDOM = useCallback(() => {
    try {
      // Look for all question elements in the main survey form
      const questionElements = document.querySelectorAll('[data-question-id]');
      const visibleQuestions: Array<{
        id: string;
        text: string;
        type: string;
        options?: string[];
        isSubQuestion: boolean;
        parentQuestionId?: string;
        level: number;
      }> = [];

      questionElements.forEach((element) => {
        const questionId = element.getAttribute('data-question-id');
        if (questionId && element.offsetParent !== null) { // Check if element is visible
          // Get the question text
          const questionTextElement = element.querySelector('label, .question-text, h3, h4, h5, h6');
          const questionText = questionTextElement?.textContent?.trim() || 'Question';

          // Determine if this is a sub-question by checking its position and styling
          const isSubQuestion = element.closest('.sub-question, .conditional-question, [style*="margin-left"], [style*="padding-left"]') !== null;

          // Estimate the level based on indentation or parent containers
          let level = 0;
          let parent = element.parentElement;
          while (parent && parent !== document.body) {
            if (parent.classList.contains('sub-question') || parent.classList.contains('conditional-question')) {
              level++;
            }
            parent = parent.parentElement;
          }

          // Get question type and options
          let questionType = 'text';
          let options: string[] = [];

          // Check for radio buttons, checkboxes, etc.
          const radioButtons = element.querySelectorAll('input[type="radio"]');
          const checkboxes = element.querySelectorAll('input[type="checkbox"]');
          const textInputs = element.querySelectorAll('input[type="text"], textarea');

          if (radioButtons.length > 0) {
            questionType = radioButtons.length === 2 ? 'yes-no' : 'multiple-choice';
            options = Array.from(radioButtons).map(radio => {
              const label = radio.nextElementSibling?.textContent?.trim() || radio.value;
              return label;
            });
          } else if (checkboxes.length > 0) {
            questionType = 'multiple-choice-multi';
            options = Array.from(checkboxes).map(checkbox => {
              const label = checkbox.nextElementSibling?.textContent?.trim() || checkbox.value;
              return label;
            });
          } else if (textInputs.length > 0) {
            questionType = 'text';
          }

          visibleQuestions.push({
            id: questionId,
            text: questionText,
            type: questionType,
            options: options.length > 0 ? options : undefined,
            isSubQuestion,
            level
          });
        }
      });

      console.log('Visible questions scanned from DOM:', visibleQuestions);
      return visibleQuestions;
    } catch (error) {
      console.warn('Could not scan DOM for visible questions:', error);
      return [];
    }
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

    // CRITICAL FIX: Check for conditional questions that should appear based on the current question's answer
    // This needs to happen BEFORE looking for the next main question
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
      console.log('Checking for conditional questions after:', currentQuestionData.text);
      console.log('Available sub-questions:', currentQuestionData.sub_questions);

      // Check each sub-question to see if it should be visible now
      for (const subQ of currentQuestionData.sub_questions) {
        console.log('Checking sub-question:', subQ.text, 'with trigger:', subQ.trigger_condition_value);

        // Strategy 1: Use the isQuestionVisible function
        if (isQuestionVisible(subQ)) {
          console.log('Found visible conditional question via isQuestionVisible:', subQ);
          return { ...subQ, originalId: subQ.id };
        }

        // Strategy 2: Direct check of trigger condition
        const parentAnswer = currentAnswers[currentQuestionData.id];
        if (parentAnswer !== undefined && parentAnswer !== null) {
          const triggerValue = String(subQ.trigger_condition_value || '').toLowerCase();
          const answerValue = String(parentAnswer).toLowerCase();

          console.log('Direct check - Parent answer:', parentAnswer, 'vs trigger:', triggerValue);

          if (answerValue === triggerValue) {
            console.log('Found conditional question via direct answer check:', subQ);
            return { ...subQ, originalId: subQ.id };
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
      if (!currentQuestion) {
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
      console.log('=== IMMEDIATE CHECK: Looking for conditional questions ===');
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
        console.log('Found question with sub-questions:', currentQuestionData.text);
        console.log('Sub-questions:', currentQuestionData.sub_questions);

        // Check if any sub-questions should be visible now
        for (const subQ of currentQuestionData.sub_questions) {
          console.log('Checking sub-question:', subQ.text);

          // Check if this sub-question should be visible based on the answer we just gave
          const parentAnswer = answerToSave; // Use the answer we just gave
          const triggerValue = String(subQ.trigger_condition_value || '').toLowerCase();
          const answerValue = String(parentAnswer).toLowerCase();

          console.log('Trigger check:', answerValue, 'vs', triggerValue);

          if (answerValue === triggerValue) {
            console.log('FOUND CONDITIONAL QUESTION TO ASK:', subQ);
            // Ask this conditional question immediately
            const conditionalQuestion = { ...subQ, originalId: subQ.id };
            askQuestion(conditionalQuestion);
            return; // Exit early, don't start polling
          }
        }
      }

      // If no conditional questions found, use the polling mechanism to find the next question
      console.log('No conditional questions found, using polling mechanism...');

      // ROBUST APPROACH: Use a polling mechanism to detect when conditional questions become visible
      // This ensures we don't miss any questions that should appear
      let attempts = 0;
      const maxAttempts = 10; // Maximum attempts to find the next question

      const findNextQuestionWithPolling = () => {
        attempts++;
        console.log(`Attempt ${attempts} to find next question...`);

        // Strategy 1: Try the normal findNextQuestion first
        let nextQuestion = findNextQuestion();

        // Strategy 2: If no question found, use the DOM-based approach as a fallback
        if (!nextQuestion) {
          console.log('No question found via normal method, trying DOM-based approach...');
          const visibleQuestions = scanVisibleQuestionsFromDOM();

          // Find the first question that's visible in DOM but not yet asked
          for (const question of visibleQuestions) {
            const questionData = allQuestionsFlattened.find(q => q.id === question.id);
            if (questionData && questionData.id !== currentQuestion?.originalId) {
              nextQuestion = questionData;
              console.log('Found question via DOM approach:', nextQuestion);
              break;
            }
          }
        }

        // Strategy 3: If still no question found, try to find conditional questions by scanning the DOM
        // and looking for questions that appear after the current question
        if (!nextQuestion) {
          console.log('Trying to find conditional questions via DOM scanning...');
          const visibleQuestions = scanVisibleQuestionsFromDOM();

          // Find questions that appear after the current question in the DOM order
          const currentQuestionIndex = visibleQuestions.findIndex(q => q.id === currentQuestion?.originalId);
          if (currentQuestionIndex !== -1) {
            // Look for the next question after the current one
            for (let i = currentQuestionIndex + 1; i < visibleQuestions.length; i++) {
              const question = visibleQuestions[i];
              const questionData = allQuestionsFlattened.find(q => q.id === question.id);
              if (questionData && questionData.id !== currentQuestion?.originalId) {
                nextQuestion = questionData;
                console.log('Found next question via DOM order:', nextQuestion);
                break;
              }
            }
          }
        }

        if (nextQuestion) {
          console.log('Next question found:', nextQuestion);
          askQuestion(nextQuestion);
          return;
        }

        // If no question found and we haven't exceeded max attempts, try again after a short delay
        if (attempts < maxAttempts) {
          setTimeout(findNextQuestionWithPolling, 200); // Poll every 200ms
        } else {
          console.log('Max attempts reached, no more questions found');
          // If we still can't find a question, assume we're done
          addMessage("bot", "That's all the questions I have! You can now submit the survey using the button on the main page, or by typing 'submit'.");
          setCurrentQuestion(null);
          setIsBotTyping(false);
        }
      };

      // Start the polling mechanism
      setTimeout(findNextQuestionWithPolling, 100);

    } else {
      addMessage("bot", `I'm sorry, that doesn't seem like a valid answer. ${validationResult.suggestion}\n\nPlease try again.`);
      setIsBotTyping(false);
    }
  };

  // Debug function to help understand the current state
  const debugCurrentState = useCallback(() => {
    console.log('=== DEBUG: Current Chatbot State ===');
    console.log('Current question:', currentQuestion);
    console.log('Current answers:', currentAnswers);
    console.log('All questions:', questions);
    console.log('All questions flattened:', allQuestionsFlattened);

    if (currentQuestion) {
      const currentQuestionData = questions.find(q => q.id === currentQuestion.originalId) ||
        questions.flatMap(q => q.sub_questions || []).find(sq => sq.id === currentQuestion.originalId);

      if (currentQuestionData) {
        console.log('Current question data:', currentQuestionData);
        if (currentQuestionData.sub_questions) {
          console.log('Sub-questions:', currentQuestionData.sub_questions);
          currentQuestionData.sub_questions.forEach((subQ, index) => {
            console.log(`Sub-question ${index}:`, {
              id: subQ.id,
              text: subQ.text,
              parent_question_id: subQ.parent_question_id,
              trigger_condition_value: subQ.trigger_condition_value,
              isVisible: isQuestionVisible(subQ)
            });
          });
        }
      }
    }

    console.log('=== END DEBUG ===');
  }, [currentQuestion, currentAnswers, questions, allQuestionsFlattened, isQuestionVisible]);

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
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={debugCurrentState}
                  className="h-8 w-8 text-xs"
                  title="Debug State"
                >
                  🐛
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
                  <Send className="h-4 w-4" />
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
