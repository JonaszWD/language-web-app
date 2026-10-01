// Browser TTS for Spanish text — shared by Grammar, Vocabulary, Listening and
// Mission screens (notice sentences, review items, mission dialogue, etc).
export function speakEs(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "es-ES";
  u.rate = 0.9;
  window.speechSynthesis.speak(u);
}
