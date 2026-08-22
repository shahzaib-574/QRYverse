export function neutralizeSpreadsheetFormula(value: string): string {
  return /^[\t ]*[=+\-@]/.test(value) ? `'${value}` : value;
}

export function quoteCsvCell(value: unknown): string {
  const text = typeof value === 'number' && Number.isFinite(value)
    ? String(value)
    : neutralizeSpreadsheetFormula(String(value ?? ''));
  return `"${text.replace(/"/g, '""')}"`;
}
