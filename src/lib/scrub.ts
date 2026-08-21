export function scrubDiagnosticText(value: string): string {
  return value
    .replace(/https?:\/\/[^\s)]+/gi, '[url removed]')
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[email removed]')
    .replace(/\b(?:\+?\d[\s().-]?){7,}\b/g, '[number removed]');
}
