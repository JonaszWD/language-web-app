"use client";

import { useEffect, useState } from "react";
import { studyApi } from "@/lib/api";
import { Icon } from "@/components/icons";
import { speakEs } from "@/lib/speak";
import { normSent } from "@/lib/textNorm";
import { getSR } from "@/lib/speechRecognition";
import type { WeakReviewItem } from "@/types";

/* ════════════════════════ REVIEW ════════════════════════
   Daily mixed retrieval — every skill interleaved, not separated.
   Translate → Listening → Grammar → Speaking → Vocabulary → Writing… */
const SKILL_TONE: Record<WeakReviewItem["skill"], string> = {
  Translate: "pink", Listening: "aqua", Grammar: "pink", Speaking: "aqua", Vocabulary: "pink",
};

function ReviewScreen() {
  // null = still loading; [] = loaded, nothing weak enough to target yet.
  const [items, setItems] = useState<WeakReviewItem[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [idx, setIdx] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [done, setDone] = useState(false);

  const load = () => {
    setItems(null);
    setLoadError(false);
    setIdx(0);
    setCorrect(0);
    setDone(false);
    void studyApi.weakReview()
      .then((r) => setItems(r.items))
      .catch(() => setLoadError(true));
  };
  useEffect(() => {
    let alive = true;
    studyApi.weakReview()
      .then((r) => { if (alive) setItems(r.items); })
      .catch(() => { if (alive) setLoadError(true); });
    return () => { alive = false; };
  }, []);

  const onResult = (ok: boolean) => {
    if (ok) setCorrect((c) => c + 1);
    if (!items) return;
    if (idx + 1 >= items.length) setDone(true); else setIdx(idx + 1);
  };

  if (loadError) {
    return (
      <div>
        <div className="sp-pagehead">
          <p className="sp-eyebrow" style={{ marginBottom: 6 }}>Review</p>
          <h1 className="sp-h1">Couldn&apos;t load your weak spots</h1>
        </div>
        <div className="sp-card rv-intro">
          <button className="sp-btn sp-btn-primary" onClick={load}>Try again</button>
        </div>
      </div>
    );
  }

  if (!items) {
    return (
      <div>
        <div className="sp-pagehead">
          <p className="sp-eyebrow" style={{ marginBottom: 6 }}>Review</p>
          <h1 className="sp-h1">Finding your weakest spots…</h1>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div>
        <div className="sp-pagehead">
          <p className="sp-eyebrow" style={{ marginBottom: 6 }}>Review · Your weak spots</p>
          <h1 className="sp-h1">Nothing to target yet</h1>
        </div>
        <div className="sp-card rv-intro">
          <p className="sp-sub">
            Practise a bit more in Missions or Vocabulary first, then check back here.
          </p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div>
        <div className="sp-pagehead">
          <p className="sp-eyebrow" style={{ marginBottom: 6 }}>Review · Complete</p>
          <h1 className="sp-h1">¡Bien hecho!</h1>
        </div>
        <div className="sp-card rv-intro" style={{ textAlign: "center" }}>
          <div className="gr-done-ico" style={{ margin: "0 auto 14px" }}><Icon name="check" size={26} /></div>
          <div className="gr-score ok" style={{ fontSize: 44 }}>{correct}<small>/{items.length}</small></div>
          <p className="sp-sub" style={{ margin: "8px 0 20px" }}>Your weak spots just got a little less weak. Come back tomorrow for the next batch.</p>
          <button className="sp-btn sp-btn-primary" onClick={load}>Again <Icon name="chevron" size={16} /></button>
        </div>
      </div>
    );
  }

  const item = items[idx];
  return (
    <div>
      <div className="sp-pagehead">
        <p className="sp-eyebrow" style={{ marginBottom: 6 }}>Review · Your weak spots</p>
        <h1 className="sp-h1">Question {idx + 1} of {items.length}</h1>
      </div>
      <div className="rv-prog">
        <div className="sp-progress"><i style={{ width: `${(idx / items.length) * 100}%` }} /></div>
      </div>
      <div className="ls-stage">
        <RvItemView key={idx} item={item} onResult={onResult} />
      </div>
    </div>
  );
}

function rvScore(target: string, said: string): boolean {
  const tgt = normSent(target).split(" ");
  const got = normSent(said).split(" ").filter(Boolean);
  const matched = tgt.filter((w) => got.includes(w)).length;
  return matched / tgt.length >= 0.6;
}

// Splits a "cloze_template" (a literal ______ marks the blank, see
// services/grammar_pattern.py) into the text before/after it.
function splitCloze(template: string): [string, string] {
  const i = template.indexOf("______");
  return i === -1 ? [template, ""] : [template.slice(0, i), template.slice(i + 6)];
}

function RvItemView({ item, onResult }: { item: WeakReviewItem; onResult: (ok: boolean) => void }) {
  const [val, setVal] = useState("");
  const [checked, setChecked] = useState(false);
  const [checkedOk, setCheckedOk] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [spokeOk, setSpokeOk] = useState<boolean | null>(null);

  useEffect(() => {
    if (item.skill === "Listening") speakEs(item.es);
  }, [item]);

  // Every skill here quizzes a real UserCard (or, for Grammar, a
  // UserGrammarCard) — persist the result through the same endpoints the
  // dedicated trainers use, so a Review answer reschedules the card via FSRS
  // and counts toward the skill-stats rollup exactly like any other attempt.
  const persist = (ok: boolean) => {
    if (item.card_id) void studyApi.review(item.card_id, ok ? 3 : 1).catch(() => {});
  };

  const record = () => {
    if (item.skill !== "Speaking") return;
    const sr = getSR();
    if (!sr) { setSpokeOk(false); return; }
    sr.lang = "es-ES"; sr.interimResults = false; sr.maxAlternatives = 1; sr.continuous = false;
    setListening(true); setHeard("");
    sr.onresult = (e) => {
      const said = e.results[0][0].transcript || "";
      const ok = rvScore(item.es, said);
      setHeard(said); setSpokeOk(ok); persist(ok);
    };
    sr.onend = () => setListening(false);
    sr.onerror = () => { setListening(false); setSpokeOk(false); };
    sr.start();
  };

  const checkGrammar = () => {
    if (!item.pattern_id || !val.trim()) return;
    void studyApi.reviewGrammar(item.pattern_id, val).then((r) => {
      setCheckedOk(r.correct);
      setChecked(true);
    }).catch(() => { setCheckedOk(false); setChecked(true); });
  };

  const tone = SKILL_TONE[item.skill];

  return (
    <div className="sp-card gr-stage-card">
      <span className={"sp-tag " + tone + " gr-kind"}>{item.skill}</span>

      {item.skill === "Translate" && (
        <>
          <div className="gr-prompt">{item.en}<span className="en">Translate into Spanish.</span></div>
          <input className="gr-input" value={val} placeholder="Tu traducción…" disabled={revealed}
            onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && val.trim()) setRevealed(true); }} />
          {revealed && <p className="gr-fix">Model: <b>{item.es}</b></p>}
          <SelfNext show={revealed} reveal={() => setRevealed(true)} canReveal={!!val.trim()}
            onResult={(ok) => { persist(ok); onResult(ok); }} />
        </>
      )}

      {item.skill === "Listening" && (
        <>
          <p className="gr-stage-hint">Listen and type what you heard.</p>
          <button className="ls-bigplay" onClick={() => speakEs(item.es)}><Icon name="speaker" size={24} /> Play</button>
          <input className="gr-input" value={val} placeholder="Type the sentence…" disabled={checked}
            onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && val.trim()) { setCheckedOk(normSent(val) === normSent(item.es)); setChecked(true); } }} />
          {checked && <p className="gr-fix">{checkedOk ? "Correct." : <>Answer: <b>{item.es}</b></>} · {item.en}</p>}
          <AutoNext show={checked} doCheck={() => { setCheckedOk(normSent(val) === normSent(item.es)); setChecked(true); }} canCheck={!!val.trim()}
            ok={checkedOk} onResult={(ok) => { persist(ok); onResult(ok); }} />
        </>
      )}

      {item.skill === "Grammar" && item.cloze_template && (() => {
        const [before, after] = splitCloze(item.cloze_template);
        return (
          <>
            <div className="gr-prompt">{before}<span className="blank">{checked ? item.es : (val || "_____")}</span>{after}<span className="en">{item.en}</span></div>
            <input className="gr-input" value={val} placeholder="Escribe la palabra…" disabled={checked}
              onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && val.trim()) checkGrammar(); }} />
            {checked && !checkedOk && <p className="gr-fix">Answer: <b>{item.es}</b></p>}
            <AutoNext show={checked} doCheck={checkGrammar} canCheck={!!val.trim()}
              ok={checkedOk} onResult={onResult} />
          </>
        );
      })()}

      {item.skill === "Speaking" && (
        <>
          <p className="gr-stage-hint">Say this aloud.</p>
          <div className="wr-copy-target">{item.es}<button className="vo-speak" onClick={() => speakEs(item.es)} title="Listen"><Icon name="speaker" size={18} /></button></div>
          <div className="wr-prompt-en" style={{ marginBottom: 12 }}>{item.en}</div>
          {!getSR() ? (
            <>
              <p className="gr-fix" style={{ color: "var(--negative)" }}>Speech recognition needs Chrome/Edge.</p>
              <div className="gr-foot"><span /><button className="sp-btn sp-btn-primary" style={{ minHeight: 44 }} onClick={() => onResult(true)}>Skip <Icon name="chevron" size={16} /></button></div>
            </>
          ) : (
            <>
              <button className={"sp-btn sp-btn-primary ls-rec" + (listening ? " is-rec" : "")} style={{ minHeight: 46 }} disabled={listening} onClick={record}>
                <Icon name="podcast" size={16} /> {listening ? "Listening…" : "Record"}
              </button>
              {heard && <p className="gr-fix">Heard: <span style={{ fontStyle: "italic" }}>{heard}</span></p>}
              {spokeOk !== null && (
                <div className="gr-foot">
                  <span className={"gr-verdict " + (spokeOk ? "ok" : "no")}>{spokeOk ? "Good match" : "Close — keep going"}</span>
                  <button className="sp-btn sp-btn-primary" style={{ minHeight: 44 }} onClick={() => onResult(spokeOk)}>Next <Icon name="chevron" size={16} /></button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {item.skill === "Vocabulary" && (
        <>
          <div className="gr-prompt" style={{ textAlign: "center", fontSize: 26, fontWeight: 700 }}>
            {item.es}<button className="vo-speak" onClick={() => speakEs(item.es)} title="Listen" style={{ marginLeft: 8 }}><Icon name="speaker" size={18} /></button>
          </div>
          {revealed && <p className="gr-fix" style={{ textAlign: "center", fontSize: 18 }}>{item.en}</p>}
          <SelfNext show={revealed} reveal={() => setRevealed(true)} canReveal revealLabel="Show meaning"
            onResult={(ok) => { persist(ok); onResult(ok); }} />
        </>
      )}
    </div>
  );
}

// Auto-graded item footer (listening/grammar): reveal verdict, then Next.
function AutoNext({ show, doCheck, canCheck, ok, onResult }: { show: boolean; doCheck: () => void; canCheck: boolean; ok: boolean; onResult: (ok: boolean) => void }) {
  if (!show) return canCheck ? (
    <div className="gr-foot"><span /><button className="sp-btn sp-btn-soft" style={{ minHeight: 44 }} onClick={doCheck}>Check</button></div>
  ) : <></>;
  return (
    <div className="gr-foot">
      <span className={"gr-verdict " + (ok ? "ok" : "no")}>{ok ? "Correct" : "Not quite"}</span>
      <button className="sp-btn sp-btn-primary" style={{ minHeight: 44 }} onClick={() => onResult(ok)}>Next <Icon name="chevron" size={16} /></button>
    </div>
  );
}

// Self-graded item footer (translate/vocab/writing): reveal answer, rate yourself.
function SelfNext({ show, reveal, canReveal, revealLabel = "Reveal", onResult }: { show: boolean; reveal: () => void; canReveal: boolean; revealLabel?: string; onResult: (ok: boolean) => void }) {
  if (!show) return (
    <div className="gr-foot"><span /><button className="sp-btn sp-btn-soft" style={{ minHeight: 44 }} disabled={!canReveal} onClick={reveal}>{revealLabel}</button></div>
  );
  return (
    <div className="gr-foot">
      <span className="gr-verdict">How did you do?</span>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="sp-btn sp-btn-soft" style={{ minHeight: 44 }} onClick={() => onResult(false)}>Missed it</button>
        <button className="sp-btn sp-btn-primary" style={{ minHeight: 44 }} onClick={() => onResult(true)}>Got it <Icon name="check" size={15} /></button>
      </div>
    </div>
  );
}


export default ReviewScreen;
