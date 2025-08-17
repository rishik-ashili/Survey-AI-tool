"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

type AddMoreQuestionsDialogProps = {
  isOpen: boolean; // This prop might not be needed if we solely rely on DialogTrigger
  originalPrompt: string;
  onAddMore: (updatedPrompt: string) => void;
  isLoading: boolean;
};

export default function AddMoreQuestionsDialog({
  originalPrompt,
  onAddMore,
  isLoading,
}: AddMoreQuestionsDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState(originalPrompt);

  useEffect(() => {
    setPrompt(originalPrompt);
  }, [originalPrompt]);

  const handleSubmit = () => {
    onAddMore(prompt);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button id="add-more-dialog-trigger" className="hidden" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add More Questions</DialogTitle>
          <DialogDescription>
            You can refine the prompt below to guide the generation of the next set of questions.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="prompt" className="text-right">
              Prompt
            </Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="col-span-3 min-h-[100px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" onClick={handleSubmit} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generate 5 More
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
