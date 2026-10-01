// Loose text normalisation shared across grammar/listening/mission-review
// answer checking — strips accents/punctuation so typed answers match even
// with minor accent/case/punctuation slips.
export const norm = (s: string) =>
  s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[.,!?¡¿]/g, "");

export function normSent(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}
