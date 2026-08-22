const punctuation: Record<string, string> = {
  '–': '-', '—': '-', '‘': "'", '’': "'", '“': '"', '”': '"', '…': '...', '•': '-',
};

export function pdfSafeText(value: string): string {
  const normalized = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  return Array.from(normalized, (character) => {
    if (punctuation[character]) return punctuation[character];
    const code = character.charCodeAt(0);
    if (code >= 32 && code <= 126) return character;
    if (/\s/.test(character)) return ' ';
    return '?';
  }).join('');
}

export function assertPdfTextSupported(values: string[]): void {
  if (values.some(hasUnsupportedPdfCharacter)) {
    throw new Error('PDF export currently supports Latin-script text only. Use CSV or JSON export to preserve Arabic, Urdu, CJK, Cyrillic, and other scripts.');
  }
}

function hasUnsupportedPdfCharacter(value: string): boolean {
  const normalized = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  return Array.from(normalized).some((character) => {
    if (punctuation[character] || /\s/.test(character)) return false;
    const code = character.charCodeAt(0);
    return code < 32 || code > 126;
  });
}
