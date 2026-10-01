"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icons";

type NavItem = { href: string; label: string };

const MAIN_TABS: NavItem[] = [
  { href: "/home", label: "Home" },
  { href: "/missions", label: "Mission" },
];
const STUDY_TABS: NavItem[] = [
  { href: "/listening", label: "Listening" },
  { href: "/speaking", label: "Speaking" },
  { href: "/grammar", label: "Grammar" },
  { href: "/vocabulary", label: "Vocabulary" },
  { href: "/writing", label: "Writing" },
];

const STUDY_TOGGLE = "__study_toggle__";

// One "slot" per top-level pill: the main tabs plus a single "Studying"
// dropdown toggle. Corner rounding of each slot depends on whether its
// neighbour is the active one — this is what produces the capsule
// "morphing" between pills. All pills share one measured width (longest
// label + padding), matching the imported Navbar.dc.html design.
//
// Active state is derived from the real URL (usePathname), not local state —
// /missions and /missions/[missionId] both highlight the Mission pill.
export default function TopDock() {
  const pathname = usePathname();
  const isActiveHref = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const inStudy = STUDY_TABS.some((t) => isActiveHref(t.href));
  const [open, setOpen] = useState(inStudy);
  const current = STUDY_TABS.find((t) => isActiveHref(t.href));
  const toggleLabel = inStudy && current ? current.label : "Studying";

  const slots = [...MAIN_TABS.map((t) => t.href), STUDY_TOGGLE];
  const isActiveSlot = (id: string) => (id === STUDY_TOGGLE ? inStudy : isActiveHref(id));

  const textRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [pillWidth, setPillWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    const widths = textRefs.current.map((el) => (el ? el.scrollWidth : 0));
    const max = Math.ceil(Math.max(...widths, 0));
    if (max) setPillWidth(max + 48);
  }, [toggleLabel]);

  return (
    <nav className="dock-nav">
      {slots.map((id, index) => {
        const isActive = isActiveSlot(id);
        const isFirst = index === 0;
        const isLast = index === slots.length - 1;
        const prev = index > 0 ? slots[index - 1] : null;
        const next = index < slots.length - 1 ? slots[index + 1] : null;
        const cls = ["dock-item"];
        if (isActive) {
          cls.push("is-active");
        } else {
          if ((prev !== null && isActiveSlot(prev)) || isFirst) cls.push("round-l");
          if ((next !== null && isActiveSlot(next)) || isLast) cls.push("round-r");
        }
        const clsStr = cls.join(" ");
        const style: CSSProperties = { width: pillWidth ? `${pillWidth}px` : "auto", textDecoration: "none" };
        const setRef = (el: HTMLSpanElement | null) => { textRefs.current[index] = el; };

        if (id === STUDY_TOGGLE) {
          return (
            <div className="dock-group" key={id} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
              <button className={clsStr + " dock-group-btn"} style={style} onClick={() => setOpen((o) => !o)}>
                <span ref={setRef}>{toggleLabel}</span>
                <span className={"dock-caret" + (open ? " up" : "")}><Icon name="chevron" size={13} /></span>
              </button>
              {open && (
                <div className="dock-submenu">
                  {STUDY_TABS.map((tb) => (
                    <Link key={tb.href} href={tb.href} className={"dock-subitem" + (isActiveHref(tb.href) ? " is-active" : "")} onClick={() => setOpen(false)} style={{ textDecoration: "none" }}>
                      {tb.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        }
        const tb = MAIN_TABS.find((t) => t.href === id)!;
        return (
          <Link key={id} href={tb.href} className={clsStr} style={style} onClick={() => setOpen(false)}>
            <span ref={setRef}>{tb.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
