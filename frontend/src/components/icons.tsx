"use client";

import { useId } from "react";
import type { CSSProperties } from "react";

/* ════════════════════════ Icons ════════════════════════ */
function Icon({ name, size = 24, style }: { name: string; size?: number; style?: CSSProperties }) {
  const p = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "currentColor",
    style,
    xmlns: "http://www.w3.org/2000/svg",
  };
  switch (name) {
    case "podcast":
      return (
        <svg {...p}>
          <rect x="9" y="2" width="6" height="11" rx="3" />
          <path d="M6 11a6 6 0 0 0 12 0h-2a4 4 0 0 1-8 0H6Z" />
          <path d="M11 18.9V22h2v-3.1a7 7 0 0 0 0 0Z" />
          <rect x="8" y="21" width="8" height="2" rx="1" />
        </svg>
      );
    case "grammar":
      return (
        <svg {...p}>
          <path d="M11 5.5C9.5 4.4 7.6 4 5.5 4 4.4 4 3.3 4.2 2.5 4.5 2.2 4.6 2 4.9 2 5.2v12.3c0 .5.5.9 1 .7.7-.2 1.6-.4 2.5-.4 2.1 0 4 .5 5.5 1.6V5.5Z" />
          <path d="M13 5.5C14.5 4.4 16.4 4 18.5 4c1.1 0 2.2.2 3 .5.3.1.5.4.5.7v12.3c0 .5-.5.9-1 .7-.7-.2-1.6-.4-2.5-.4-2.1 0-4 .5-5.5 1.6V5.5Z" />
        </svg>
      );
    case "home":
      return (
        <svg {...p}>
          <path d="M11.3 2.7a1 1 0 0 1 1.4 0l8 7.4c.2.2.3.5.3.8V20a2 2 0 0 1-2 2h-3.5v-5.5a1 1 0 0 0-1-1h-3a1 1 0 0 0-1 1V22H6a2 2 0 0 1-2-2v-9.1c0-.3.1-.6.3-.8l7-6.4Z" />
        </svg>
      );
    case "vocabulary":
      return (
        <svg {...p}>
          <rect x="6" y="3" width="13" height="15" rx="3" opacity=".4" />
          <rect x="3" y="6" width="13" height="15" rx="3" />
        </svg>
      );
    case "writing":
      return (
        <svg {...p}>
          <path d="M14.8 4.2 19.8 9.2 9 20H4v-5L14.8 4.2Z" />
          <path d="M16.2 2.8a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8l-1 1-5-5 1-1Z" />
        </svg>
      );
    case "play":
      return <svg {...p}><path d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.7L8.5 3.6A1 1 0 0 0 7 4.5Z" /></svg>;
    case "pause":
      return <svg {...p}><rect x="6" y="4" width="4.5" height="16" rx="1.5" /><rect x="13.5" y="4" width="4.5" height="16" rx="1.5" /></svg>;
    case "back15":
      return <svg {...p} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9a8 8 0 1 1-1 4" /><path d="M4 4v5h5" /></svg>;
    case "fwd15":
      return <svg {...p} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 9a8 8 0 1 0 1 4" /><path d="M20 4v5h-5" /></svg>;
    case "bookmark":
      return <svg {...p}><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z" /></svg>;
    case "bookmark-o":
      return <svg {...p} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z" /></svg>;
    case "speaker":
      return <svg {...p}><path d="M4 9v6h4l5 4V5L8 9H4Z" /><path d="M16 8.5a4 4 0 0 1 0 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
    case "plus":
      return <svg {...p}><path d="M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7V4Z" /></svg>;
    case "search":
      return <svg {...p} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>;
    case "spark":
      return <svg {...p}><path d="M12 2c.5 3.8 1.7 5 5.5 5.5-3.8.5-5 1.7-5.5 5.5-.5-3.8-1.7-5-5.5-5.5C10.3 7 11.5 5.8 12 2Z" /><path d="M18.5 13c.3 2 .9 2.6 3 3-2.1.4-2.7 1-3 3-.3-2-.9-2.6-3-3 2.1-.4 2.7-1 3-3Z" /></svg>;
    case "bolt":
      return <svg {...p}><path d="M13 2 4 13h6l-1 9 9-12h-6l1-8Z" /></svg>;
    case "check":
      return <svg {...p} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 6" /></svg>;
    case "chevron":
      return <svg {...p} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>;
    case "filter":
      return <svg {...p}><path d="M3 5h18l-7 8v6l-4-2v-4L3 5Z" /></svg>;
    case "list":
      return <svg {...p} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></svg>;
    case "headphones":
      return <svg {...p}><path d="M4 13a8 8 0 0 1 16 0v5a2 2 0 0 1-2 2h-2v-7h2v-0a6 6 0 1 0-12 0v0h2v7H6a2 2 0 0 1-2-2v-5Z" /></svg>;
    case "apple":
      return <svg {...p}><path d="M16 2c.1 1.2-.4 2.3-1.1 3-.7.8-1.9 1.4-3 1.3-.1-1.1.4-2.3 1.1-3C13.7 2.5 15 1.9 16 2Zm3.5 16c-.5 1.2-.8 1.7-1.5 2.8-1 1.5-2.4 3.3-4 3.3-1.5 0-1.8-.9-3.8-.9s-2.4.9-3.8.9c-1.7 0-2.9-1.7-3.9-3.1C-.2 17.5-.6 12 1.6 9.2 2.7 7.8 4.4 7 6 7c1.6 0 2.7 1 3.8 1 1.1 0 1.9-1 3.9-1 1.4 0 3 .8 4 2.1-3.5 1.9-3 6.9.8 8.9Z" /></svg>;
    case "doc":
      return <svg {...p}><path d="M6 2h7l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" opacity=".9" /><path d="M13 2v5h5" fill="rgba(255,255,255,.45)" /></svg>;
    case "target":
      return <svg {...p} fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" fill="currentColor" /></svg>;
    case "moon":
      return <svg {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>;
    case "sun":
      return <svg {...p} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4.5" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
    case "coffee":
      return <svg {...p}><path d="M4 8h13v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z" /><path d="M17 9h1.5a2.5 2.5 0 0 1 0 5H17" fill="none" stroke="currentColor" strokeWidth="2" /><rect x="4" y="19" width="12" height="1.8" rx="0.9" /></svg>;
    case "plane":
      return <svg {...p}><path d="M21 14.5 13 12V5.5a1.5 1.5 0 0 0-3 0V12l-8 2.5v2l8-2v3.5l-2 1.3V21l3.5-1 3.5 1v-1.7l-2-1.3V14.5l8 2v-2Z" /></svg>;
    case "people":
      return <svg {...p}><circle cx="9" cy="8" r="3" /><circle cx="16.5" cy="9" r="2.4" /><path d="M3 19a6 6 0 0 1 12 0v1H3v-1Z" /><path d="M15 20v-1a7 7 0 0 0-1.2-3.9A4.5 4.5 0 0 1 21 19v1h-6Z" /></svg>;
    case "globe":
      return <svg {...p} fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></svg>;
    case "user":
      return <svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 20a8 8 0 0 1 16 0v1H4v-1Z" /></svg>;
    case "logout":
      return <svg {...p} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>;
    case "health":
      return <svg {...p}><path d="M10 3h4a1 1 0 0 1 1 1v5h5a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-5v5a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-5H4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h5V4a1 1 0 0 1 1-1Z" /></svg>;
    default:
      return <svg {...p}><circle cx="12" cy="12" r="9" /></svg>;
  }
}

/* Hand-drawn flame — navy body + teal droplet + spark */
function Flame({ size = 40, style }: { size?: number; style?: CSSProperties }) {
  const uid = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 56 64" fill="none" style={style} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={"fo" + uid} x1="28" y1="5" x2="28" y2="57" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2E4A77" />
          <stop offset="1" stopColor="#162A4D" />
        </linearGradient>
        <linearGradient id={"fi" + uid} x1="28" y1="30" x2="28" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#73F0D9" />
          <stop offset="1" stopColor="#33C8B3" />
        </linearGradient>
      </defs>
      <ellipse cx="28" cy="59" rx="15" ry="3.4" fill="#4DDFC4" opacity=".35" />
      <circle cx="13.5" cy="9" r="2.6" fill="#4DDFC4" />
      <path d="M28 57 C 15 57, 7 49, 7 38 C 7 29, 13 24, 17 18 C 19 15, 20 11, 19 6 C 24 9, 28 13, 28 19 C 31 13, 35 11, 39 14 C 47 20, 49 29, 49 38 C 49 49, 41 57, 28 57 Z" fill={"url(#fo" + uid + ")"} />
      <path d="M28 30 C 30 36, 36 39, 36 45 C 36 51, 32 54, 28 54 C 24 54, 20 51, 20 45 C 20 39, 26 36, 28 30 Z" fill={"url(#fi" + uid + ")"} />
    </svg>
  );
}

export { Icon, Flame };
