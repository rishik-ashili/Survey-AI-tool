import type { SurveyQuestion } from "@/types";

function escapeCsvField(field: string): string {
  // If the field contains a comma, double quote, or newline, enclose it in double quotes.
  if (/[",\n]/.test(field)) {
    // Within a double-quoted field, any double quote must be escaped by another double quote.
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

export function exportToCsv(questions: SurveyQuestion[], fileName: string) {
  if (!questions || questions.length === 0) {
    console.warn("No questions to export.");
    return;
  }

  const header = ['question_text'];
  const rows = questions.map(q => [escapeCsvField(q.text)]);

  let csvContent = [header.join(','), ...rows.map(r => r.join(','))].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${fileName.replace(/ /g, '_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
