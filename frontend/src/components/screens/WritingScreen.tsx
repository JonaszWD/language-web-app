"use client";

import WritingEntries from "@/components/WritingEntries";

/* ════════════════════════ WRITING ════════════════════════
   Free writing with the AI — mirrors the Speaking tab's chat picker, with
   "chats" replaced by "entries": pick a topic, then write freely about it in
   a single field while a goals panel tracks what to cover. */
export default function WritingScreen() {
  return <WritingEntries />;
}
