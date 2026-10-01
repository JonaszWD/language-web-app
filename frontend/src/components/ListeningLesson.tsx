"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useBlockQueue } from "@/components/lessonQueue";
import { studyApi } from "@/lib/api";
import { generatedListening } from "@/content/generated";

/* ─────────────────────────────────────────────────────────────────────────
   Mission listening as a progressive compression of real speech into
   understanding tasks. Listening starts controlled, becomes meaningful, and
   ends as real communication — never "audio + quiz".

   Seven stages (see the card kinds):
     1 Anchored listening  — one clear sentence, slow, 2-3 options
     2 Chunk recognition   — common functional phrases
     3 Context binding     — audio inside a mini-situation
     4 Dialogue sequencing — a conversation with a missing line
     5 Natural speech      — full dialogue at natural speed, detail questions
     6 Transcript + shadow — unlock the text, repeat line by line
     7 Active challenge    — no options, type what you heard

   Design principles baked into the scripts:
     · one unknown per step (known vocab + one new phrase early on)
     · meaning extraction, not translation ("What is the waiter asking?")
     · questions always tie listening to purpose
     · speed scales up per stage (0.6 → natural); it never jumps to native
   Adaptive support: a wrong answer drops the playback speed and reveals the
   transcript as a hint — reduce speed / add hints rather than fail the learner.
   ──────────────────────────────────────────────────────────────────────── */

type Line = { who: string; es: string; en?: string };
type Choice = { question: string; options: string[]; answer: number };

export type ListeningCard =
  | { kind: "intro"; mission: string; goals: string[] }
  // Stages 1-2: hear one line, pick its meaning. `transcriptEn` shown after.
  | {
      kind: "recognition";
      stage: number;
      audio: string;
      speed: number;
      question: string;
      options: string[];
      answer: number;
      transcriptEn?: string;
    }
  // Stage 3: bind audio to a situation, then to its meaning.
  | {
      kind: "context";
      stage: number;
      audio: string;
      speed: number;
      situation: Choice;
      meaning: Choice;
      transcriptEn?: string;
    }
  // Stage 4: a dialogue with one line blanked — choose the missing turn.
  | {
      kind: "sequencing";
      stage: number;
      speed: number;
      instruction?: string;
      lines: Line[];
      gapIndex: number;
      options: string[];
      answer: number;
    }
  // Stage 5: full dialogue at natural speed, then comprehension questions.
  | {
      kind: "conversation";
      stage: number;
      speed: number;
      lines: Line[];
      questions: Choice[];
    }
  // Stage 6: reveal the transcript, replay line by line to shadow.
  | { kind: "shadow"; stage: number; speed: number; lines: Line[] }
  // Stage 7: no options — type what the speaker ordered / asked.
  | {
      kind: "challenge";
      stage: number;
      speed: number;
      lines: Line[];
      prompt: string;
      answer: string;
      accept?: string[];
      transcriptEn?: string;
    }
  // Predictive listening: set an expectation BEFORE hearing anything, then play
  // and confirm. Trains the prediction native speakers do constantly.
  | {
      kind: "predict";
      stage: number;
      label?: string;
      audio: string;
      speed: number;
      setup: string;      // the situation
      question: string;   // "What do you think you'll hear?"
      options: string[];
      answer: number;
      transcriptEn?: string;
    }
  // Tap the speaker who said the line (Ana vs Carlos).
  | {
      kind: "speaker";
      stage: number;
      label?: string;
      audio: string;
      speed: number;
      question: string;
      speakers: string[];
      answer: number;
      transcriptEn?: string;
    }
  // Reorder the shuffled dialogue lines back into the order you heard.
  | {
      kind: "order";
      stage: number;
      label?: string;
      speed: number;
      instruction?: string;
      lines: Line[]; // in correct order
    }
  // Hear a sentence, tap the one word you recognised.
  | {
      kind: "wordSpot";
      stage: number;
      label?: string;
      audio: string;
      speed: number;
      prompt: string;
      words: string[];
      answer: number;
      transcriptEn?: string;
    };

export interface ListeningLessonScript {
  title: string;
  cards: ListeningCard[];
}

// Short label per stage, shown on each card.
const STAGE_LABELS: Record<number, string> = {
  1: "Recognise",
  2: "Chunks",
  3: "Context",
  4: "Dialogue",
  5: "Natural speech",
  6: "Shadow",
  7: "Challenge",
};

// Per-mission listening scripts, keyed by mission id. A mission with no script
// falls back to the vocabulary trainer for its Listening step.
const BASE_LISTENING_LESSONS: Record<string, ListeningLessonScript> = {
  "m001-coffee-shop": {
    title: "Understand a café conversation",
    cards: [
      {
        kind: "intro",
        mission: "Understand a real café conversation by ear.",
        goals: [
          "Recognise café greetings and phrases.",
          "Follow what the waiter and customer say.",
          "Understand a full order at natural speed.",
        ],
      },

      // ── Stage 1: predict, then anchored listening ──────────────────────
      {
        kind: "predict",
        stage: 1,
        label: "Predict",
        audio: "Buenos días.",
        speed: 0.6,
        setup: "You walk into a café. The waiter looks up.",
        question: "What do you think you'll hear first?",
        options: ["A greeting", "The price", "Goodbye"],
        answer: 0,
        transcriptEn: "Buenos días — Good morning.",
      },
      {
        kind: "recognition",
        stage: 1,
        audio: "Buenos días.",
        speed: 0.6,
        question: "The waiter says this as you walk in. What is it?",
        options: ["A greeting (good morning)", "Good night", "See you later"],
        answer: 0,
        transcriptEn: "Buenos días — Good morning.",
      },

      // ── Stage 2: chunk recognition + word spotting ─────────────────────
      {
        kind: "recognition",
        stage: 2,
        audio: "¿Algo más?",
        speed: 0.8,
        question: "What is the waiter asking?",
        options: ["Anything else?", "How much is it?", "Where is it?"],
        answer: 0,
        transcriptEn: "¿Algo más? — Anything else?",
      },
      {
        kind: "wordSpot",
        stage: 2,
        label: "Word spot",
        audio: "Quiero un café con leche.",
        speed: 0.8,
        prompt: "Tap the drink you heard.",
        words: ["café", "agua", "cuenta"],
        answer: 0,
        transcriptEn: "Quiero un café con leche — I want a coffee with milk.",
      },
      {
        kind: "recognition",
        stage: 2,
        audio: "¿Para llevar o para aquí?",
        speed: 0.8,
        question: "What is the waiter asking?",
        options: ["To go or for here?", "What would you like?", "Do you want coffee?"],
        answer: 0,
        transcriptEn: "¿Para llevar o para aquí? — To go or for here?",
      },

      // ── Stage 3: who said it, then context binding ─────────────────────
      {
        kind: "speaker",
        stage: 3,
        label: "Who said it",
        audio: "¿Qué desea?",
        speed: 0.9,
        question: "Who said this?",
        speakers: ["Camarero (waiter)", "Cliente (customer)"],
        answer: 0,
        transcriptEn: "¿Qué desea? — What would you like? (the waiter asks)",
      },
      {
        kind: "context",
        stage: 3,
        audio: "Buenos días. ¿Qué desea?",
        speed: 0.9,
        situation: {
          question: "What is happening?",
          options: [
            "Someone is about to order",
            "Someone is asking directions",
            "Someone is buying clothes",
          ],
          answer: 0,
        },
        meaning: {
          question: "What did the waiter say?",
          options: [
            "Good morning, what would you like?",
            "Good morning, the bill please",
            "Good night, see you tomorrow",
          ],
          answer: 0,
        },
        transcriptEn: "Buenos días. ¿Qué desea? — Good morning. What would you like?",
      },

      // ── Stage 4: reorder the dialogue, then fill the missing line ──────
      {
        kind: "order",
        stage: 4,
        label: "Reorder",
        speed: 1.0,
        instruction: "Put the café exchange in the order you hear.",
        lines: [
          { who: "Camarero", es: "Buenos días." },
          { who: "Camarero", es: "¿Qué desea?" },
          { who: "Cliente", es: "Quisiera un café." },
        ],
      },
      {
        kind: "sequencing",
        stage: 4,
        speed: 1.0,
        instruction: "One line is missing. Which line fits?",
        lines: [
          { who: "Camarero", es: "Buenos días." },
          { who: "Camarero", es: "" },
          { who: "Cliente", es: "Quisiera un café." },
        ],
        gapIndex: 1,
        options: ["¿Qué desea?", "La cuenta, por favor.", "Adiós."],
        answer: 0,
      },

      // ── Stage 5: predict the order, then hear it at natural speed ──────
      {
        kind: "predict",
        stage: 5,
        label: "Predict",
        audio: "Quisiera un café y una tostada.",
        speed: 1.0,
        setup: "The waiter just asked what you'd like. The customer answers.",
        question: "What will the customer most likely say?",
        options: ["An order (I'd like…)", "A goodbye", "A price"],
        answer: 0,
        transcriptEn: "Quisiera un café y una tostada — I'd like a coffee and toast.",
      },
      {
        kind: "conversation",
        stage: 5,
        speed: 1.05,
        lines: [
          { who: "Camarero", es: "Buenos días, ¿qué desea?" },
          { who: "Cliente", es: "Quisiera un café y una tostada." },
          { who: "Camarero", es: "¿Algo más?" },
          { who: "Cliente", es: "No, gracias." },
        ],
        questions: [
          {
            question: "What did the customer order?",
            options: ["Tea", "Coffee and toast", "Nothing"],
            answer: 1,
          },
          {
            question: "Did they want anything else?",
            options: ["Yes", "No"],
            answer: 1,
          },
        ],
      },

      // ── Stage 6: transcript reveal + shadowing ─────────────────────────
      {
        kind: "shadow",
        stage: 6,
        speed: 0.9,
        lines: [
          { who: "Camarero", es: "Buenos días, ¿qué desea?", en: "Good morning, what would you like?" },
          { who: "Cliente", es: "Quisiera un café y una tostada.", en: "I'd like a coffee and toast." },
          { who: "Camarero", es: "¿Algo más?", en: "Anything else?" },
          { who: "Cliente", es: "No, gracias.", en: "No, thank you." },
        ],
      },

      // ── Stage 7: active listening challenge (no options) ───────────────
      {
        kind: "challenge",
        stage: 7,
        speed: 1.0,
        lines: [
          { who: "Camarero", es: "Buenos días, ¿qué desea?" },
          { who: "Cliente", es: "Quisiera un café y una tostada." },
        ],
        prompt: "Type what the customer ordered (in Spanish).",
        answer: "un café y una tostada",
        accept: ["café y tostada", "un cafe y una tostada", "cafe y tostada"],
        transcriptEn: "Quisiera un café y una tostada — I'd like a coffee and toast.",
      },
    ],
  },

  "m002-airport": {
    title: "Understand airport announcements",
    cards: [
      {
        kind: "intro",
        mission: "Understand check-in and gate information by ear.",
        goals: [
          "Recognise what the agent asks for.",
          "Catch your gate and departure time.",
          "Follow a full check-in at natural speed.",
        ],
      },
      {
        kind: "predict",
        stage: 1,
        label: "Predict",
        audio: "Su billete, por favor.",
        speed: 0.6,
        setup: "You reach the check-in desk. The agent greets you.",
        question: "What will the agent probably ask for first?",
        options: ["Your ticket", "The weather", "Your lunch order"],
        answer: 0,
        transcriptEn: "Su billete, por favor — Your ticket, please.",
      },
      {
        kind: "recognition",
        stage: 1,
        audio: "Su billete, por favor.",
        speed: 0.6,
        question: "What does the agent want?",
        options: ["Your ticket", "Your suitcase", "Your name"],
        answer: 0,
        transcriptEn: "Su billete, por favor — Your ticket, please.",
      },
      {
        kind: "recognition",
        stage: 2,
        audio: "La puerta doce.",
        speed: 0.8,
        question: "What are they telling you?",
        options: ["Gate twelve", "Flight two", "Seat ten"],
        answer: 0,
        transcriptEn: "La puerta doce — Gate twelve.",
      },
      {
        kind: "wordSpot",
        stage: 2,
        label: "Word spot",
        audio: "El vuelo sale por la puerta doce.",
        speed: 0.8,
        prompt: "Tap the word for 'gate'.",
        words: ["vuelo", "puerta", "billete"],
        answer: 1,
        transcriptEn: "El vuelo sale por la puerta doce — The flight leaves from gate twelve.",
      },
      {
        kind: "recognition",
        stage: 2,
        audio: "¿A qué hora sale?",
        speed: 0.8,
        question: "What are they asking?",
        options: ["What time does it leave?", "Where is it?", "How much is it?"],
        answer: 0,
        transcriptEn: "¿A qué hora sale? — What time does it leave?",
      },
      {
        kind: "context",
        stage: 3,
        audio: "Su vuelo sale por la puerta doce.",
        speed: 0.9,
        situation: {
          question: "What is happening?",
          options: ["Boarding info at the airport", "Ordering food", "Booking a hotel"],
          answer: 0,
        },
        meaning: {
          question: "What did they say?",
          options: [
            "Your flight leaves from gate twelve",
            "Your flight is delayed two hours",
            "Your gate is closed",
          ],
          answer: 0,
        },
        transcriptEn: "Su vuelo sale por la puerta doce — Your flight leaves from gate twelve.",
      },
      {
        kind: "order",
        stage: 4,
        label: "Reorder",
        speed: 1.0,
        instruction: "Put the check-in exchange in the order you hear.",
        lines: [
          { who: "Agente", es: "Su billete, por favor." },
          { who: "Pasajero", es: "Aquí tiene." },
          { who: "Agente", es: "La puerta doce." },
        ],
      },
      {
        kind: "sequencing",
        stage: 4,
        speed: 1.0,
        instruction: "One line is missing. Which line fits?",
        lines: [
          { who: "Pasajero", es: "¿A qué hora sale el vuelo?" },
          { who: "Agente", es: "" },
          { who: "Pasajero", es: "Gracias." },
        ],
        gapIndex: 1,
        options: ["A las diez.", "Buenos días.", "La cuenta, por favor."],
        answer: 0,
      },
      {
        kind: "conversation",
        stage: 5,
        speed: 1.05,
        lines: [
          { who: "Agente", es: "Buenos días, su billete, por favor." },
          { who: "Pasajero", es: "Aquí tiene." },
          { who: "Agente", es: "Su vuelo sale por la puerta doce a las diez." },
          { who: "Pasajero", es: "Gracias." },
        ],
        questions: [
          {
            question: "Which gate is the flight?",
            options: ["Gate two", "Gate twelve", "Gate twenty"],
            answer: 1,
          },
          {
            question: "What time does it leave?",
            options: ["At ten", "At two", "At twelve"],
            answer: 0,
          },
        ],
      },
      {
        kind: "shadow",
        stage: 6,
        speed: 0.9,
        lines: [
          { who: "Agente", es: "Buenos días, su billete, por favor.", en: "Good morning, your ticket, please." },
          { who: "Pasajero", es: "Aquí tiene.", en: "Here you go." },
          { who: "Agente", es: "Su vuelo sale por la puerta doce.", en: "Your flight leaves from gate twelve." },
          { who: "Pasajero", es: "Gracias.", en: "Thank you." },
        ],
      },
      {
        kind: "challenge",
        stage: 7,
        speed: 1.0,
        lines: [{ who: "Agente", es: "Su vuelo sale por la puerta doce." }],
        prompt: "Type the gate you heard (in Spanish).",
        answer: "la puerta doce",
        accept: ["puerta doce", "doce"],
        transcriptEn: "la puerta doce — gate twelve.",
      },
    ],
  },

  "m003-meeting-someone": {
    title: "Understand an introduction",
    cards: [
      {
        kind: "intro",
        mission: "Understand someone introducing themselves by ear.",
        goals: [
          "Recognise greetings and 'how are you?'.",
          "Catch a name and where someone is from.",
          "Follow a full introduction at natural speed.",
        ],
      },
      {
        kind: "predict",
        stage: 1,
        label: "Predict",
        audio: "Hola, ¿cómo te llamas?",
        speed: 0.6,
        setup: "You're meeting someone for the first time.",
        question: "What do you think you'll hear?",
        options: ["What's your name?", "Where is the station?", "How much is it?"],
        answer: 0,
        transcriptEn: "Hola, ¿cómo te llamas? — Hi, what's your name?",
      },
      {
        kind: "recognition",
        stage: 1,
        audio: "¡Hola!",
        speed: 0.6,
        question: "What is the person doing?",
        options: ["Greeting you", "Leaving", "Thanking you"],
        answer: 0,
        transcriptEn: "¡Hola! — Hi!",
      },
      {
        kind: "recognition",
        stage: 2,
        audio: "¿Cómo estás?",
        speed: 0.8,
        question: "What are they asking?",
        options: ["How are you?", "What's your name?", "Where are you from?"],
        answer: 0,
        transcriptEn: "¿Cómo estás? — How are you?",
      },
      {
        kind: "speaker",
        stage: 3,
        label: "Who said it",
        audio: "Soy de México.",
        speed: 0.9,
        question: "Two people are talking. Who is speaking?",
        speakers: ["Carlos (from Mexico)", "Ana (from Spain)"],
        answer: 0,
        transcriptEn: "Soy de México — I'm from Mexico. (Carlos)",
      },
      {
        kind: "recognition",
        stage: 2,
        audio: "Mucho gusto.",
        speed: 0.8,
        question: "What are they saying?",
        options: ["Nice to meet you", "Goodbye", "Thank you"],
        answer: 0,
        transcriptEn: "Mucho gusto — Nice to meet you.",
      },
      {
        kind: "context",
        stage: 3,
        audio: "Hola, me llamo Ana. ¿Y tú?",
        speed: 0.9,
        situation: {
          question: "What is happening?",
          options: [
            "Two people introducing themselves",
            "Someone ordering food",
            "Someone asking directions",
          ],
          answer: 0,
        },
        meaning: {
          question: "What did she say?",
          options: [
            "Hi, my name is Ana. And you?",
            "Hi, where are you from?",
            "Hi, how old are you?",
          ],
          answer: 0,
        },
        transcriptEn: "Hola, me llamo Ana. ¿Y tú? — Hi, my name is Ana. And you?",
      },
      {
        kind: "sequencing",
        stage: 4,
        speed: 1.0,
        instruction: "One line is missing. Which line fits?",
        lines: [
          { who: "Ana", es: "¿Cómo te llamas?" },
          { who: "Tú", es: "" },
          { who: "Ana", es: "Mucho gusto." },
        ],
        gapIndex: 1,
        options: ["Me llamo Carlos.", "Adiós.", "La cuenta, por favor."],
        answer: 0,
      },
      {
        kind: "conversation",
        stage: 5,
        speed: 1.05,
        lines: [
          { who: "Ana", es: "¡Hola! ¿Cómo te llamas?" },
          { who: "Carlos", es: "Me llamo Carlos. ¿Y tú?" },
          { who: "Ana", es: "Me llamo Ana. ¿De dónde eres?" },
          { who: "Carlos", es: "Soy de México." },
        ],
        questions: [
          {
            question: "What is his name?",
            options: ["Ana", "Carlos", "María"],
            answer: 1,
          },
          {
            question: "Where is Carlos from?",
            options: ["Spain", "Mexico", "Colombia"],
            answer: 1,
          },
        ],
      },
      {
        kind: "shadow",
        stage: 6,
        speed: 0.9,
        lines: [
          { who: "Ana", es: "¡Hola! ¿Cómo te llamas?", en: "Hi! What's your name?" },
          { who: "Carlos", es: "Me llamo Carlos.", en: "My name is Carlos." },
          { who: "Ana", es: "¿De dónde eres?", en: "Where are you from?" },
          { who: "Carlos", es: "Soy de México.", en: "I'm from Mexico." },
        ],
      },
      {
        kind: "challenge",
        stage: 7,
        speed: 1.0,
        lines: [
          { who: "Ana", es: "¿De dónde eres?" },
          { who: "Carlos", es: "Soy de México." },
        ],
        prompt: "Type where Carlos is from (in Spanish).",
        answer: "soy de méxico",
        accept: ["soy de mexico", "de méxico", "de mexico", "méxico", "mexico"],
        transcriptEn: "Soy de México — I'm from Mexico.",
      },
    ],
  },
};

// Hand-authored scripts, with generated missions merged in.
export const LISTENING_LESSONS: Record<string, ListeningLessonScript> = {
  ...generatedListening,
  ...BASE_LISTENING_LESSONS,
};

// Accent/case/punctuation-insensitive compare, matching the grammar + vocab
// trainers so "soy de mexico" ≈ "Soy de México."
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[¿?¡!.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Hold a reference to every queued utterance until it finishes: Chrome/Safari
// garbage-collect utterances that go out of scope mid-speech, which silently
// drops the audio. Cleared as each one ends.
let _liveUtterances: SpeechSynthesisUtterance[] = [];

// Resolve to a Spanish voice, waiting for the async `voiceschanged` event if the
// list isn't populated yet (getVoices() is empty on the first call in Chrome).
function pickSpanishVoice(): Promise<SpeechSynthesisVoice | undefined> {
  const synth = window.speechSynthesis;
  const find = () => synth.getVoices().find((v) => v.lang.toLowerCase().startsWith("es"));
  const now = synth.getVoices();
  if (now.length) return Promise.resolve(find());
  return new Promise((resolve) => {
    const done = () => { synth.removeEventListener("voiceschanged", done); resolve(find()); };
    synth.addEventListener("voiceschanged", done);
    // Fallback: some browsers never fire the event — resolve after a beat anyway.
    setTimeout(done, 250);
  });
}

// Fallback: speak via the browser SpeechSynthesis API at a given rate (no
// backend). Used only when the backend TTS request fails. Queues each line so a
// dialogue plays turn by turn. Must be called from a user gesture.
function speakBrowser(lines: string[], rate: number, onDone?: () => void): void {
  if (typeof window === "undefined" || !window.speechSynthesis) { onDone?.(); return; }
  const texts = lines.filter((t) => t && t.trim());
  if (!texts.length) { onDone?.(); return; }
  const synth = window.speechSynthesis;
  // cancel() is async in Chrome — a speak() queued in the same tick gets eaten
  // and fires an "canceled" error (silent). Only cancel if something is actually
  // playing, then queue the new utterances a beat later so cancel has settled.
  const wasBusy = synth.speaking || synth.pending;
  if (wasBusy) synth.cancel();
  _liveUtterances = [];
  void pickSpanishVoice().then((voice) => {
    const queue = () => {
      texts.forEach((t, i) => {
        const u = new SpeechSynthesisUtterance(t);
        u.lang = "es-ES";
        u.rate = rate;
        if (voice) u.voice = voice;
        const drop = () => { _liveUtterances = _liveUtterances.filter((x) => x !== u); };
        u.onend = () => { drop(); if (i === texts.length - 1) onDone?.(); };
        u.onerror = () => { drop(); if (i === texts.length - 1) onDone?.(); };
        _liveUtterances.push(u);
        synth.speak(u);
      });
      // Chrome sometimes parks synthesis paused after a cancel; resume nudges it.
      synth.resume();
    };
    if (wasBusy) setTimeout(queue, 120);
    else queue();
  });
}

// Cache one <audio> element per phrase so replaying never re-hits the network.
const _audioCache = new Map<string, HTMLAudioElement>();
// The audio currently playing, so a new play stops the old one.
let _current: HTMLAudioElement | null = null;
// Bumped on every stop/new-play so a superseded sequence aborts cleanly.
let _playToken = 0;

function stopAudio(): void {
  _playToken++;
  if (_current) {
    _current.pause();
    _current = null;
  }
  if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
}

// Fetch (or reuse) the cached backend-synthesised audio for one phrase. Rejects
// if the request fails so the caller can fall back to the browser voice.
function getAudio(text: string): Promise<HTMLAudioElement> {
  const cached = _audioCache.get(text);
  if (cached) return Promise.resolve(cached);
  return fetch(`/api/tts/speak?text=${encodeURIComponent(text)}`)
    .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
    .then((blob) => {
      const audio = new Audio(URL.createObjectURL(blob));
      _audioCache.set(text, audio);
      return audio;
    });
}

// Speak Spanish via the backend TTS endpoint, one line at a time so a
// dialogue plays turn by turn with natural gaps (and every cache key is a single
// authored phrase — the same phrases prewarmed on mission open). `rate` maps to
// the audio element's playbackRate, so "Slower" works without re-synthesising.
// Any line that fails falls back to the browser voice, then the sequence
// continues. Must be called from a user gesture (playback is gesture-gated).
function speakLines(lines: string[], rate: number, onDone?: () => void): void {
  if (typeof window === "undefined") { onDone?.(); return; }
  const texts = lines.filter((t) => t && t.trim());
  if (!texts.length) { onDone?.(); return; }
  stopAudio();
  const token = _playToken;
  let idx = 0;

  const playNext = () => {
    if (token !== _playToken) return; // superseded by a newer play/stop
    if (idx >= texts.length) { onDone?.(); return; }
    const text = texts[idx++];
    const afterLine = () => { if (token === _playToken) playNext(); };
    getAudio(text)
      .then((audio) => {
        if (token !== _playToken) return;
        _current = audio;
        audio.currentTime = 0;
        audio.playbackRate = rate;
        audio.onended = afterLine;
        audio.play().catch(() => speakBrowser([text], rate, afterLine));
      })
      .catch(() => speakBrowser([text], rate, afterLine)); // synth down → browser voice
  };
  playNext();
}

// Every Spanish phrase a script will ever ask to speak, deduped — used to
// prewarm the backend TTS cache when the mission opens. Kept in lockstep with
// what speakLines is handed in each card so the prewarmed keys match exactly.
export function audioTextsForScript(script: ListeningLessonScript): string[] {
  const out: string[] = [];
  for (const c of script.cards) {
    if (c.kind === "recognition" || c.kind === "context" || c.kind === "predict" || c.kind === "speaker" || c.kind === "wordSpot") out.push(c.audio);
    else if (c.kind === "sequencing") {
      c.lines.forEach((l, n) => { if (n !== c.gapIndex && l.es) out.push(l.es); });
      out.push(c.options[c.answer]); // the correct line is spoken once solved
    } else if (c.kind === "conversation" || c.kind === "shadow" || c.kind === "challenge" || c.kind === "order") {
      c.lines.forEach((l) => { if (l.es) out.push(l.es); });
    }
  }
  return Array.from(new Set(out.map((t) => t.trim()).filter(Boolean)));
}

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

// The big round "play" affordance — the primary control on every listening
// card. `lines` are spoken in order at `rate`.
function AudioButton({ lines, rate, label = "Play" }: { lines: string[]; rate: number; label?: string }) {
  const [playing, setPlaying] = useState(false);
  const playCount = useRef(0);
  const play = () => {
    setPlaying(true);
    // First play is the intentional listen; every click after that is the
    // learner asking to hear it again — that's the "replay" signal. Speed is
    // reported on every play so "avg listening speed reached" reflects the
    // base rate too, not just replays.
    void studyApi.lessonProgress({ skill: "listening", replay: playCount.current > 0, speed: rate });
    playCount.current += 1;
    speakLines(lines, rate, () => setPlaying(false));
  };
  return (
    <div className="li-audio">
      <button type="button" className={"li-play" + (playing ? " on" : "")} onClick={play} aria-label={label} title={label}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M8 5v14l11-7z" />
        </svg>
      </button>
      <span className="li-play-label">{playing ? "Playing…" : label}</span>
    </div>
  );
}

export default function ListeningLesson({
  script,
  onExit,
  onDone,
  backLabel = "Mission",
  hideBack = false,
}: {
  script: ListeningLessonScript;
  onExit: () => void;
  onDone?: () => void;
  backLabel?: string;
  /** Set when a caller already renders its own persistent back button (e.g. the mission hub). */
  hideBack?: boolean;
}) {
  const cards = useMemo(() => script.cards.filter((c) => c.kind !== "intro"), [script]);
  const { cardIndex, pos, isLast, next, requeue } = useBlockQueue(cards.length, onDone ?? onExit);
  const card = cards[cardIndex];
  // A wrong answer requeues the card to just before the block's final card.
  const wrong = requeue;

  useEffect(() => {
    void studyApi.lessonProgress({ skill: "listening", stage: card.stage });
  }, [card.stage]);

  return (
    <div className="vt-wrap">
      {!hideBack && (
        <div className="vt-topbar" style={{ width: "100%" }}>
          <button className="vt-back" onClick={onExit}><ChevronIcon /> {backLabel}</button>
          <span className="vt-level">
            Listening · Stage {card.stage} · {(card as { label?: string }).label ?? STAGE_LABELS[card.stage]}
          </span>
        </div>
      )}

      <div className="vt-progress">
        <div className="vt-progress-fill" style={{ width: `${((pos + 1) / cards.length) * 100}%` }} />
      </div>

      {card.kind === "predict" && <PredictCard key={pos} card={card} onNext={next} />}
      {card.kind === "recognition" && <RecognitionCard key={pos} card={card} onNext={next} onWrong={wrong} />}
      {card.kind === "speaker" && <SpeakerCard key={pos} card={card} onNext={next} onWrong={wrong} />}
      {card.kind === "wordSpot" && <WordSpotCard key={pos} card={card} onNext={next} onWrong={wrong} />}
      {card.kind === "context" && <ContextCard key={pos} card={card} onNext={next} onWrong={wrong} />}
      {card.kind === "order" && <OrderCard key={pos} card={card} onNext={next} onWrong={wrong} />}
      {card.kind === "sequencing" && <SequencingCard key={pos} card={card} onNext={next} onWrong={wrong} />}
      {card.kind === "conversation" && <ConversationCard key={pos} card={card} onNext={next} onWrong={wrong} />}
      {card.kind === "shadow" && <ShadowCard key={pos} card={card} onNext={next} />}
      {card.kind === "challenge" && <ChallengeCard key={pos} card={card} onNext={next} lastLabel={isLast ? "Finish" : "Continue"} />}
    </div>
  );
}

// Shared: single-attempt multiple-choice question. Reports the outcome once —
// there's no in-place "Try again"; a wrong card is requeued by the parent so the
// learner meets it again later in the block.
function ChoiceBlock({
  question,
  options,
  answer,
  onResult,
}: {
  question: string;
  options: string[];
  answer: number;
  onResult: (correct: boolean) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div>
      <p className="vt-prompt">{question}</p>
      <div className="gl-options">
        {options.map((opt, i) => {
          const state = picked === null ? "" : i === answer ? " ok" : i === picked ? " bad" : "";
          return (
            <button
              key={i}
              type="button"
              className={"gl-option" + state}
              disabled={picked !== null}
              onClick={() => { if (picked !== null) return; setPicked(i); onResult(i === answer); }}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Shared reveal shown after a graded card. Correct → "Continue" (advance). Wrong
// → tells the learner and routes "Continue" to requeue (they'll see it again).
function AfterAnswer({ correct, transcript, onNext, onWrong, nextLabel = "Continue" }: {
  correct: boolean; transcript?: string; onNext: () => void; onWrong: () => void; nextLabel?: string;
}) {
  // Mounts exactly once per graded outcome (parent renders it conditionally
  // once the result is known) — the single choke point for every listening
  // card kind, so the skills dashboard sees every comprehension check.
  useEffect(() => { studyApi.listeningResult(correct).catch(() => {}); }, [correct]);
  useEffect(() => {
    if (transcript) void studyApi.lessonProgress({ skill: "listening", transcript_reveal: true });
    // Only report once per mount, regardless of transcript identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="vt-stack">
      <p className="sp-h2">{correct ? "¡Correcto!" : "Not quite"}</p>
      {transcript && <div className="li-transcript">{transcript}</div>}
      <button className="sp-btn sp-btn-primary" onClick={correct ? onNext : onWrong}>{correct ? nextLabel : "Continue"}</button>
    </div>
  );
}

// ── Stages 1-2: hear one line → pick its meaning. ──
function RecognitionCard({ card, onNext, onWrong }: { card: Extract<ListeningCard, { kind: "recognition" }>; onNext: () => void; onWrong: () => void }) {
  const [rate, setRate] = useState(card.speed);
  const [outcome, setOutcome] = useState<boolean | null>(null);
  return (
    <div className="sp-card vt-card">
      <AudioButton lines={[card.audio]} rate={rate} label="Listen" />
      <AudioControls rate={rate} base={card.speed} onSlower={() => setRate(slower(rate))} />
      <ChoiceBlock
        question={card.question}
        options={card.options}
        answer={card.answer}
        onResult={(ok) => { setOutcome(ok); if (!ok) setRate(slower(rate)); }}
      />
      {outcome !== null && <AfterAnswer correct={outcome} transcript={card.transcriptEn} onNext={onNext} onWrong={onWrong} />}
    </div>
  );
}

// ── Predictive listening: predict BEFORE hearing, then play and confirm. ──
function PredictCard({ card, onNext }: { card: Extract<ListeningCard, { kind: "predict" }>; onNext: () => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const rightGuess = picked === card.answer;
  return (
    <div className="sp-card vt-card">
      <p className="wr-scenario" style={{ textAlign: "center" }}>{card.setup}</p>
      {!revealed ? (
        <>
          <p className="vt-prompt">{card.question}</p>
          <div className="gl-options">
            {card.options.map((opt, i) => (
              <button key={i} type="button" className={"gl-option" + (picked === i ? " ok" : "")} onClick={() => setPicked(i)}>{opt}</button>
            ))}
          </div>
          <button className="sp-btn sp-btn-primary" style={{ marginTop: 14 }} disabled={picked === null} onClick={() => setRevealed(true)}>
            Listen and check
          </button>
        </>
      ) : (
        <>
          <AudioButton lines={[card.audio]} rate={card.speed} label="Listen" />
          <p className="sp-h2" style={{ margin: "8px 0 6px" }}>{rightGuess ? "You predicted it!" : "Good guess"}</p>
          <p className="sp-sub" style={{ marginBottom: 10 }}>
            You expected: <b style={{ color: "var(--ink)" }}>{card.options[picked ?? 0]}</b>
            {!rightGuess && <> — you actually heard <b style={{ color: "var(--ink)" }}>{card.options[card.answer]}</b>.</>}
          </p>
          {card.transcriptEn && <div className="li-transcript" style={{ marginBottom: 12 }}>{card.transcriptEn}</div>}
          <button className="sp-btn sp-btn-primary" onClick={onNext}>Continue</button>
        </>
      )}
    </div>
  );
}

// ── Tap the speaker who said the line. ──
function SpeakerCard({ card, onNext, onWrong }: { card: Extract<ListeningCard, { kind: "speaker" }>; onNext: () => void; onWrong: () => void }) {
  const [rate, setRate] = useState(card.speed);
  const [picked, setPicked] = useState<number | null>(null);
  const outcome = picked === null ? null : picked === card.answer;
  return (
    <div className="sp-card vt-card">
      <AudioButton lines={[card.audio]} rate={rate} label="Listen" />
      <AudioControls rate={rate} base={card.speed} onSlower={() => setRate(slower(rate))} />
      <p className="vt-prompt">{card.question}</p>
      <div className="li-speakers">
        {card.speakers.map((s, i) => {
          const state = picked === null ? "" : i === card.answer ? " ok" : i === picked ? " bad" : "";
          return (
            <button key={i} type="button" className={"li-speaker" + state} disabled={picked !== null}
              onClick={() => { if (picked !== null) return; setPicked(i); if (i !== card.answer) setRate(slower(rate)); }}>
              <span className="li-speaker-ico">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
                </svg>
              </span>
              {s}
            </button>
          );
        })}
      </div>
      {outcome !== null && <AfterAnswer correct={outcome} transcript={card.transcriptEn} onNext={onNext} onWrong={onWrong} />}
    </div>
  );
}

// ── Hear a sentence, tap the one word you recognised. ──
function WordSpotCard({ card, onNext, onWrong }: { card: Extract<ListeningCard, { kind: "wordSpot" }>; onNext: () => void; onWrong: () => void }) {
  const [rate, setRate] = useState(card.speed);
  const [picked, setPicked] = useState<number | null>(null);
  const outcome = picked === null ? null : picked === card.answer;
  return (
    <div className="sp-card vt-card">
      <AudioButton lines={[card.audio]} rate={rate} label="Listen" />
      <AudioControls rate={rate} base={card.speed} onSlower={() => setRate(slower(rate))} />
      <p className="vt-prompt">{card.prompt}</p>
      <div className="li-words">
        {card.words.map((w, i) => {
          const state = picked === null ? "" : i === card.answer ? " ok" : i === picked ? " bad" : "";
          return (
            <button key={i} type="button" className={"li-word" + state} disabled={picked !== null}
              onClick={() => { if (picked !== null) return; setPicked(i); if (i !== card.answer) setRate(slower(rate)); }}>{w}</button>
          );
        })}
      </div>
      {outcome !== null && <AfterAnswer correct={outcome} transcript={card.transcriptEn} onNext={onNext} onWrong={onWrong} />}
    </div>
  );
}

// ── Reorder the shuffled dialogue lines back into the order you heard. ──
function OrderCard({ card, onNext, onWrong }: { card: Extract<ListeningCard, { kind: "order" }>; onNext: () => void; onWrong: () => void }) {
  // Shuffle once; guarantee it isn't already in the right order.
  const [shuffled] = useState<number[]>(() => shuffleIndices(card.lines.length));
  const [seq, setSeq] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);
  const correct = checked && seq.every((v, i) => v === i);
  const remaining = shuffled.filter((i) => !seq.includes(i));
  const reset = () => { setSeq([]); setChecked(false); };
  const correctOrder = card.lines.map((l) => `${l.who}: ${l.es}`).join(" · ");
  return (
    <div className="sp-card vt-card">
      <p className="sp-eyebrow" style={{ marginBottom: 8 }}>{card.instruction ?? "Put the lines in the order you hear."}</p>
      <AudioButton lines={card.lines.map((l) => l.es)} rate={card.speed} label="Play dialogue" />
      <div className="gl-dialogue" style={{ marginTop: 6, minHeight: 40 }}>
        {seq.map((idx, n) => (
          <div key={n} className="gl-line">
            <span className="gl-who">{n + 1}</span>
            <span className="gl-bubble">{card.lines[idx].who}: {card.lines[idx].es}</span>
          </div>
        ))}
        {seq.length === 0 && <p className="li-hint" style={{ textAlign: "center" }}>Tap the lines below in order…</p>}
      </div>
      {!checked && (
        <div className="li-words">
          {remaining.map((idx) => (
            <button key={idx} type="button" className="li-word" onClick={() => setSeq((s) => [...s, idx])}>
              {card.lines[idx].who}: {card.lines[idx].es}
            </button>
          ))}
        </div>
      )}
      {!checked && (
        <div className="vt-rates" style={{ marginTop: 12 }}>
          {seq.length > 0 && <button className="sp-btn sp-btn-soft" onClick={reset}>Clear</button>}
          {seq.length === card.lines.length && (
            <button className="sp-btn sp-btn-primary" onClick={() => setChecked(true)}>Check</button>
          )}
        </div>
      )}
      {checked && (
        <AfterAnswer correct={correct} transcript={correct ? undefined : `Correct order — ${correctOrder}`} onNext={onNext} onWrong={onWrong} />
      )}
    </div>
  );
}

// A shuffled 0..n-1 that is never the identity order (so there's always work).
function shuffleIndices(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let attempt = 0; attempt < 8; attempt++) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    if (a.some((v, i) => v !== i)) break;
  }
  return a;
}

// ── Stage 3: bind audio to a situation, then to its meaning. ──
function ContextCard({ card, onNext, onWrong }: { card: Extract<ListeningCard, { kind: "context" }>; onNext: () => void; onWrong: () => void }) {
  const [rate, setRate] = useState(card.speed);
  const [step, setStep] = useState(0); // 0 situation, 1 meaning, 2 done
  const [wrongAny, setWrongAny] = useState(false); // wrong on either sub-question → requeue whole card
  return (
    <div className="sp-card vt-card">
      <AudioButton lines={[card.audio]} rate={rate} label="Listen" />
      <AudioControls rate={rate} base={card.speed} onSlower={() => setRate(slower(rate))} />
      {step === 0 && (
        <ChoiceBlock
          question={card.situation.question}
          options={card.situation.options}
          answer={card.situation.answer}
          onResult={(ok) => { if (!ok) { setWrongAny(true); setRate(slower(rate)); } setStep(1); }}
        />
      )}
      {step === 1 && (
        <ChoiceBlock
          question={card.meaning.question}
          options={card.meaning.options}
          answer={card.meaning.answer}
          onResult={(ok) => { if (!ok) { setWrongAny(true); setRate(slower(rate)); } setStep(2); }}
        />
      )}
      {step === 2 && <AfterAnswer correct={!wrongAny} transcript={card.transcriptEn} onNext={onNext} onWrong={onWrong} />}
    </div>
  );
}

// ── Stage 4: a dialogue with one line blanked — choose the missing turn. ──
function SequencingCard({ card, onNext, onWrong }: { card: Extract<ListeningCard, { kind: "sequencing" }>; onNext: () => void; onWrong: () => void }) {
  const [rate, setRate] = useState(card.speed);
  const [picked, setPicked] = useState<number | null>(null);
  const answered = picked !== null;
  const outcome = picked === null ? null : picked === card.answer;
  // Once answered, the gap reveals the correct line (right or wrong) so replay
  // plays the true dialogue.
  const spoken = card.lines.map((l, n) => (n === card.gapIndex ? (answered ? card.options[card.answer] : "") : l.es));
  return (
    <div className="sp-card vt-card">
      {card.instruction && <p className="sp-eyebrow" style={{ marginBottom: 10 }}>{card.instruction}</p>}
      <AudioButton lines={spoken} rate={rate} label="Play dialogue" />
      <AudioControls rate={rate} base={card.speed} onSlower={() => setRate(slower(rate))} />
      <div className="gl-dialogue" style={{ marginTop: 6 }}>
        {card.lines.map((l, n) => (
          <div key={n} className="gl-line">
            <span className="gl-who">{l.who}</span>
            <span className="gl-bubble">
              {n === card.gapIndex ? (answered ? card.options[card.answer] : "______") : l.es}
            </span>
          </div>
        ))}
      </div>
      <div className="gl-options" style={{ marginTop: 12 }}>
        {card.options.map((opt, i) => {
          const state = picked === null ? "" : i === card.answer ? " ok" : i === picked ? " bad" : "";
          return (
            <button key={i} type="button" className={"gl-option" + state} disabled={picked !== null}
              onClick={() => { if (picked !== null) return; setPicked(i); if (i !== card.answer) setRate(slower(rate)); }}>
              {opt}
            </button>
          );
        })}
      </div>
      {outcome !== null && <AfterAnswer correct={outcome} onNext={onNext} onWrong={onWrong} />}
    </div>
  );
}

// ── Stage 5: full dialogue at natural speed, then comprehension questions.
// No transcript shown — meaning is extracted from the audio alone. ──
function ConversationCard({ card, onNext, onWrong }: { card: Extract<ListeningCard, { kind: "conversation" }>; onNext: () => void; onWrong: () => void }) {
  const [rate, setRate] = useState(card.speed);
  const [qi, setQi] = useState(0); // current question
  const [wrongAny, setWrongAny] = useState(false); // any wrong answer → requeue the card
  const done = qi >= card.questions.length;
  const q = card.questions[Math.min(qi, card.questions.length - 1)];
  return (
    <div className="sp-card vt-card">
      <AudioButton lines={card.lines.map((l) => l.es)} rate={rate} label="Play conversation" />
      <AudioControls rate={rate} base={card.speed} onSlower={() => setRate(slower(rate))} />
      {!done ? (
        <>
          <p className="sp-sub" style={{ margin: "4px 0 10px" }}>Question {qi + 1} of {card.questions.length}</p>
          <ChoiceBlock
            key={qi}
            question={q.question}
            options={q.options}
            answer={q.answer}
            onResult={(ok) => { if (!ok) { setWrongAny(true); setRate(slower(rate)); } setQi((n) => n + 1); }}
          />
        </>
      ) : (
        <AfterAnswer correct={!wrongAny} onNext={onNext} onWrong={onWrong} />
      )}
    </div>
  );
}

// ── Stage 6: transcript revealed, replay each line to shadow it. ──
function ShadowCard({ card, onNext }: { card: Extract<ListeningCard, { kind: "shadow" }>; onNext: () => void }) {
  return (
    <div className="sp-card vt-card">
      <p className="sp-sub" style={{ marginBottom: 14 }}>Play a line, then repeat it out loud.</p>
      <div className="gl-dialogue">
        {card.lines.map((l, n) => (
          <div key={n} className="gl-line">
            <span className="gl-who">{l.who}</span>
            <span className="gl-bubble" style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-start" }}>
              <span>{l.es}</span>
              {l.en && <span className="gl-example-en">{l.en}</span>}
              <button type="button" className="vt-speak" onClick={() => speakLines([l.es], card.speed)}>Play · repeat</button>
            </span>
          </div>
        ))}
      </div>
      <button className="sp-btn sp-btn-primary" style={{ marginTop: 14 }} onClick={onNext}>I&apos;ve shadowed it</button>
    </div>
  );
}

// ── Stage 7: no options — type what you heard. ──
function ChallengeCard({ card, onNext, lastLabel }: {
  card: Extract<ListeningCard, { kind: "challenge" }>; onNext: () => void; lastLabel: string;
}) {
  const [rate, setRate] = useState(card.speed);
  const [value, setValue] = useState("");
  const [checked, setChecked] = useState(false);
  const accepted = [card.answer, ...(card.accept ?? [])].map(norm);
  const correct = accepted.includes(norm(value));
  return (
    <form className="sp-card vt-card" onSubmit={(e) => { e.preventDefault(); if (value.trim()) setChecked(true); }}>
      <AudioButton lines={card.lines.map((l) => l.es)} rate={rate} label="Play audio" />
      <AudioControls rate={rate} base={card.speed} onSlower={() => setRate(slower(rate))} />
      <p className="vt-prompt">{card.prompt}</p>
      {!checked ? (
        <>
          <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder="Type it in Spanish…"
            className="gr-input" style={{ textAlign: "center" }} />
          <button type="submit" className="sp-btn sp-btn-primary" disabled={!value.trim()}>Check</button>
        </>
      ) : (
        <div className="vt-stack">
          <p className="sp-h2">{correct ? "¡Perfecto!" : "Almost"}</p>
          <p className="sp-sub">
            {correct ? "That's it." : <>The answer is <b style={{ color: "var(--ink)" }}>{card.answer}</b>.</>}
          </p>
          {card.transcriptEn && <div className="li-transcript">{card.transcriptEn}</div>}
          <div className="vt-rates">
            {!correct && <button type="button" className="sp-btn sp-btn-soft" onClick={() => { setChecked(false); setValue(""); }}>Try again</button>}
            <button type="button" className="sp-btn sp-btn-primary" onClick={onNext}>{correct ? lastLabel : "Continue"}</button>
          </div>
        </div>
      )}
    </form>
  );
}

// Drop playback rate a notch, floored so it never becomes unintelligible.
function slower(rate: number): number {
  return Math.max(0.5, Math.round((rate - 0.15) * 100) / 100);
}

// "Slower" control — only shown once the rate has room to drop or has dropped.
function AudioControls({ rate, base, onSlower }: { rate: number; base: number; onSlower: () => void }) {
  return (
    <div className="li-controls">
      <button type="button" className="li-slower" onClick={onSlower} disabled={rate <= 0.5}>
        Slower
      </button>
      <span className="li-rate">{rate < base ? `${rate.toFixed(2)}× (slowed)` : `${rate.toFixed(2)}×`}</span>
    </div>
  );
}
