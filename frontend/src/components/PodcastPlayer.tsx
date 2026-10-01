"use client";
/* eslint-disable @next/next/no-img-element -- remote YouTube thumbnails, not worth an image loader */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { podcastsApi, vocabApi } from "@/lib/api";
import { Icon } from "@/components/icons";
import type { PodcastEpisode, PodcastFeed, TranscriptSegment } from "@/types";

/* ════════════════════════ PODCAST ════════════════════════
   Real-audio listening on top of the backend podcast pipeline
   (services/podcast.py): import a YouTube playlist, episodes download in the
   background, transcribe on demand with faster-whisper, then play along with
   a timestamped transcript. Tapping a word glosses it (GET /vocab/translate)
   and can save it straight into the vocabulary deck (POST /vocab/save). */

const POLL_MS = 4000;

function errMsg(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

function fmtClock(secs: number): string {
  const s = Math.max(0, Math.floor(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function isBusy(ep: PodcastEpisode): boolean {
  return ep.download_status === "pending" || ep.transcript_status === "pending";
}

function episodeStatus(ep: PodcastEpisode): string {
  if (ep.download_status === "pending") return "Downloading…";
  if (ep.download_status === "failed") return "Download failed";
  if (ep.download_status !== "ready") return "Not downloaded";
  if (ep.transcript_status === "pending") return `Transcribing ${ep.transcript_progress}%`;
  if (ep.transcript_status === "ready") return "Transcript ready";
  if (ep.transcript_status === "failed") return "Transcription failed";
  return "Audio ready";
}

type Gloss = { key: string; word: string; context: string; english: string | null; saved: boolean; error: string };

function ImportForm({ onAdded }: { onAdded: (f: PodcastFeed) => void }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setBusy(true);
    setError("");
    try {
      onAdded(await podcastsApi.addFeed(url.trim()));
      setUrl("");
    } catch (err) {
      setError(errMsg(err, "Could not import that playlist."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="sp-card pc-import" onSubmit={submit}>
      <p className="sp-sub">
        Paste a YouTube playlist link from a Spanish podcast. The latest episodes download in the background,
        then you can transcribe one and listen along.
      </p>
      <div className="pc-import-row">
        <input
          className="pc-input"
          type="url"
          placeholder="https://www.youtube.com/playlist?list=…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={busy}
        />
        <button className="sp-btn sp-btn-primary" type="submit" disabled={busy || !url.trim()}>
          {busy ? "Importing…" : <><Icon name="plus" size={16} /> Import</>}
        </button>
      </div>
      {error && <p className="pc-error">{error}</p>}
    </form>
  );
}

function Transcript({ segments, current, onSeek, onWord }: {
  segments: TranscriptSegment[];
  current: number;
  onSeek: (t: number) => void;
  onWord: (key: string, word: string, context: string) => void;
}) {
  const activeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [current]);

  return (
    <div className="pc-transcript">
      {segments.map((seg, si) => (
        <div
          key={si}
          ref={si === current ? activeRef : undefined}
          className={"pc-seg" + (si === current ? " is-active" : "")}
        >
          <button type="button" className="pc-seg-time" onClick={() => onSeek(seg.start)} title="Play from here">
            {fmtClock(seg.start)}
          </button>
          <p className="pc-seg-text">
            {seg.text.split(/(\s+)/).map((tok, ti) => {
              const clean = tok.replace(/[.,;:¿?¡!"'«»()…—-]/g, "");
              if (!clean) return tok;
              const key = `${si}-${ti}`;
              return (
                <span key={key} className="pc-word" onClick={() => onWord(key, clean.toLowerCase(), seg.text)}>
                  {tok}
                </span>
              );
            })}
          </p>
        </div>
      ))}
    </div>
  );
}

function EpisodeView({ ep, onUpdate }: { ep: PodcastEpisode; onUpdate: (ep: PodcastEpisode) => void }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [time, setTime] = useState(0);
  const [actionError, setActionError] = useState("");
  const [gloss, setGloss] = useState<Gloss | null>(null);

  const segments = useMemo(() => ep.segments ?? [], [ep.segments]);
  const current = useMemo(() => {
    for (let i = segments.length - 1; i >= 0; i--) if (time >= segments[i].start) return i;
    return -1;
  }, [segments, time]);

  const run = async (fn: () => Promise<PodcastEpisode>, fallback: string) => {
    setActionError("");
    try { onUpdate(await fn()); } catch (e) { setActionError(errMsg(e, fallback)); }
  };

  const seek = (t: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = t;
    void a.play();
  };

  const openWord = async (key: string, word: string, context: string) => {
    setGloss({ key, word, context, english: null, saved: false, error: "" });
    try {
      const r = await vocabApi.translate(word, context);
      setGloss((g) => (g && g.key === key ? { ...g, english: r.english } : g));
    } catch (e) {
      setGloss((g) => (g && g.key === key ? { ...g, error: errMsg(e, "Translation unavailable.") } : g));
    }
  };

  const saveWord = async () => {
    if (!gloss) return;
    try {
      await vocabApi.save(gloss.word, gloss.context);
      setGloss((g) => (g ? { ...g, saved: true } : g));
    } catch (e) {
      setGloss((g) => (g ? { ...g, error: errMsg(e, "Could not save the word.") } : g));
    }
  };

  const downloaded = ep.download_status === "ready";
  const canTranscribe = downloaded && (ep.transcript_status === "none" || ep.transcript_status === "failed");

  return (
    <div className="pc-episode">
      <div className="pc-ep-head">
        {ep.image_url && <img className="pc-ep-cover" src={ep.image_url} alt="" />}
        <div>
          <h2 className="pc-ep-title">{ep.title}</h2>
          <p className="sp-sub">{[ep.duration, episodeStatus(ep)].filter(Boolean).join(" · ")}</p>
        </div>
      </div>

      {downloaded ? (
        <audio
          ref={audioRef}
          className="pc-audio"
          controls
          preload="metadata"
          src={`/api/podcasts/audio/${ep.id}`}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        />
      ) : ep.download_status === "pending" ? (
        <p className="sp-sub">The audio is downloading in the background — this page updates by itself.</p>
      ) : (
        <button className="sp-btn sp-btn-primary" onClick={() => run(() => podcastsApi.redownload(ep.id), "Could not start the download.")}>
          Download audio
        </button>
      )}

      {ep.transcript_status === "pending" && (
        <div className="pc-progress">
          <div className="sp-progress"><i style={{ width: `${ep.transcript_progress}%` }} /></div>
          <p className="sp-sub">Transcribing… {ep.transcript_progress}%</p>
        </div>
      )}
      {canTranscribe && (
        <button className="sp-btn sp-btn-ghost" onClick={() => run(() => podcastsApi.transcribe(ep.id), "Could not start transcription.")}>
          <Icon name="doc" size={16} /> {ep.transcript_status === "failed" ? "Retry transcription" : "Transcribe episode"}
        </button>
      )}
      {actionError && <p className="pc-error">{actionError}</p>}

      {gloss && (
        <div className="sp-card pc-gloss">
          <div>
            <div className="pc-gloss-es">{gloss.word}</div>
            <div className="sp-sub">{gloss.error || gloss.english || "Translating…"}</div>
          </div>
          <div className="pc-gloss-actions">
            <button className="sp-btn sp-btn-primary" onClick={saveWord} disabled={gloss.saved || !gloss.english}>
              {gloss.saved ? <><Icon name="check" size={16} /> Saved</> : <><Icon name="bookmark-o" size={16} /> Save</>}
            </button>
            <button className="sp-btn sp-btn-soft" onClick={() => setGloss(null)}>Close</button>
          </div>
        </div>
      )}

      {ep.transcript_status === "ready" && segments.length > 0 && (
        <>
          <p className="pc-hint">Tap a timestamp to jump there, or tap any word to translate and save it.</p>
          <Transcript segments={segments} current={current} onSeek={seek} onWord={openWord} />
        </>
      )}
      {ep.transcript_status === "ready" && segments.length === 0 && (
        <p className="pc-transcript-plain">{ep.transcript}</p>
      )}
    </div>
  );
}

export default function PodcastPlayer({ onExit }: { onExit: () => void }) {
  const [feeds, setFeeds] = useState<PodcastFeed[] | null>(null);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [autoTranscribe, setAutoTranscribe] = useState<boolean | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setFeeds(await podcastsApi.feeds());
      setError("");
    } catch (e) {
      setError(errMsg(e, "Could not load podcasts."));
    }
  }, []);

  useEffect(() => {
    podcastsApi.feeds().then(setFeeds).catch((e) => setError(errMsg(e, "Could not load podcasts.")));
    podcastsApi.getSettings().then((s) => setAutoTranscribe(s.auto_transcribe)).catch(() => {});
  }, []);

  // Poll while anything is downloading or transcribing.
  const busy = !!feeds?.some((f) => f.episodes.some(isBusy));
  useEffect(() => {
    if (!busy) return;
    const iv = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(iv);
  }, [busy, load]);

  const episodes = feeds?.flatMap((f) => f.episodes) ?? [];
  const selected = episodes.find((e) => e.id === selectedId) ?? null;

  const updateEpisode = (ep: PodcastEpisode) =>
    setFeeds((fs) => fs?.map((f) => ({ ...f, episodes: f.episodes.map((e) => (e.id === ep.id ? ep : e)) })) ?? fs);

  const refresh = async () => {
    setRefreshing(true);
    try { setFeeds(await podcastsApi.refresh()); } catch (e) { setError(errMsg(e, "Refresh failed.")); }
    finally { setRefreshing(false); }
  };

  const removeFeed = async (id: string) => {
    if (!window.confirm("Remove this podcast and its downloaded episodes?")) return;
    try {
      await podcastsApi.removeFeed(id);
      setSelectedId(null);
      await load();
    } catch (e) {
      setError(errMsg(e, "Could not remove the podcast."));
    }
  };

  const toggleAuto = async () => {
    if (autoTranscribe === null) return;
    try { setAutoTranscribe((await podcastsApi.setSettings(!autoTranscribe)).auto_transcribe); } catch { /* keep current */ }
  };

  return (
    <div className="ls-padded">
      <div className="sp-pagehead" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="button"
          className="sp-btn"
          onClick={selected ? () => setSelectedId(null) : onExit}
          aria-label={selected ? "Back to episodes" : "Back to stories"}
        >
          <Icon name="chevron" size={16} /> Back
        </button>
        <div>
          <p className="sp-eyebrow" style={{ marginBottom: 6 }}>Listening</p>
          <h1 className="sp-h1">Podcast</h1>
        </div>
      </div>

      {error && <p className="pc-error">{error}</p>}
      {feeds === null && !error && <p className="sp-sub">Loading podcasts…</p>}

      {selected ? (
        <EpisodeView ep={selected} onUpdate={updateEpisode} />
      ) : feeds && (
        <>
          {feeds.length === 0 && <ImportForm onAdded={(f) => setFeeds([f])} />}
          {feeds.map((feed) => (
            <section key={feed.id} className="sp-mode-section">
              <div className="pc-feed-head">
                {feed.image_url && <img className="pc-feed-cover" src={feed.image_url} alt="" />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="q-name">{feed.title}</div>
                  {feed.author && <div className="q-sub">{feed.author}</div>}
                </div>
                <button className="sp-btn sp-btn-soft" onClick={refresh} disabled={refreshing}>
                  {refreshing ? "Checking…" : "Check for new"}
                </button>
                <button className="sp-btn sp-btn-soft" onClick={() => removeFeed(feed.id)}>Remove</button>
              </div>
              <div className="pc-episodes">
                {feed.episodes.map((ep) => (
                  <button key={ep.id} className="sp-card pc-ep-row" onClick={() => setSelectedId(ep.id)}>
                    {ep.image_url && <img className="pc-ep-thumb" src={ep.image_url} alt="" />}
                    <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                      <div className="q-name pc-ep-row-title">{ep.title}</div>
                      <div className="q-sub">{[ep.duration, episodeStatus(ep)].filter(Boolean).join(" · ")}</div>
                    </div>
                    <span className="sp-tag"><Icon name="chevron" size={14} /></span>
                  </button>
                ))}
              </div>
            </section>
          ))}
          {feeds.length > 0 && autoTranscribe !== null && (
            <label className="pc-toggle">
              <input type="checkbox" checked={autoTranscribe} onChange={toggleAuto} />
              Transcribe new episodes automatically after download
            </label>
          )}
        </>
      )}
    </div>
  );
}
