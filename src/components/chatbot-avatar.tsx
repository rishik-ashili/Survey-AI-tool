import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

export default function ChatbotAvatar({ className }: { className?: string }) {
    return (
        <div className={cn(
            "flex items-center justify-center h-10 w-10 rounded-full bg-primary text-primary-foreground flex-shrink-0",
            className
        )}>
            <Sparkles className="h-6 w-6" />
        </div>
    )
}
