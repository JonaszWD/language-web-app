import type { VocabTips } from "@/types";
import SpeakButton from "@/components/SpeakButton";

// Surfaces chunks, collocations, synonyms, gender etc. on every screen —
// teaching words in context ("poner la mesa"), not in isolation ("mesa = table").
export default function VocabTipStrip({ tips }: { tips: VocabTips }) {
  if (!tips || Object.keys(tips).length === 0) return null;

  return (
    <div className="sp-card vt-tips">
      <div className="vt-tags">
        {tips.gender && <span className="sp-tag aqua">{tips.gender}</span>}
        {tips.frequency && <span className="sp-tag ghost">{tips.frequency}</span>}
        {tips.pronunciation && <span className="sp-tag ghost">/{tips.pronunciation}/</span>}
      </div>

      {tips.chunks && tips.chunks.length > 0 && (
        <Section title="Chunks">
          <ul className="vt-list">
            {tips.chunks.map((c, i) => (
              <li key={i} className="vt-chunk">
                <SpeakButton text={c.es} label="▶" />
                <span>
                  <b>{c.es}</b>
                  <span className="vt-dim"> — {c.en}</span>
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {tips.collocations && tips.collocations.length > 0 && (
        <Section title="Collocations">
          <p>{tips.collocations.join(" · ")}</p>
        </Section>
      )}

      <div className="vt-two">
        {tips.synonyms && tips.synonyms.length > 0 && (
          <Section title="Synonyms"><p>{tips.synonyms.join(", ")}</p></Section>
        )}
        {tips.antonyms && tips.antonyms.length > 0 && (
          <Section title="Antonyms"><p>{tips.antonyms.join(", ")}</p></Section>
        )}
      </div>

      {tips.common_mistakes && tips.common_mistakes.length > 0 && (
        <Section title="Watch out">
          <ul className="vt-bullets">
            {tips.common_mistakes.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        </Section>
      )}

      {tips.example_sentences && tips.example_sentences.length > 0 && (
        <Section title="Examples">
          <ul className="vt-list">
            {tips.example_sentences.map((s, i) => (
              <li key={i}><i>{s.es}</i><span className="vt-dim"> — {s.en}</span></li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="vt-section">
      <p className="vt-section-title">{title}</p>
      {children}
    </div>
  );
}
