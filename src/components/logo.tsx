import { PenSquare } from "lucide-react";

export default function Logo() {
  return (
    <div className="flex items-center gap-2 p-2">
      <div className="p-2 bg-primary rounded-lg text-primary-foreground">
        <PenSquare className="w-6 h-6" />
      </div>
      <h1 className="text-xl font-bold text-foreground">SurveySpark AI</h1>
    </div>
  );
}
