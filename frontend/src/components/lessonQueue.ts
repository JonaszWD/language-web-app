import { useCallback, useState } from "react";

/* Block progression with wrong-answer requeue.
   A lesson is a "block" of cards. Normally you advance one card at a time. When
   a card is answered wrong, the learner is told, then that card is moved to just
   before the block's final (culminating) card and shown again later — so they
   repeat it without breaking the finale.

   The card order is a mutable array of indices into the static script; length is
   invariant (we only reorder). `pos` points at the current slot. */
export function useBlockQueue(count: number, onFinish: () => void) {
  const [order, setOrder] = useState<number[]>(() => Array.from({ length: count }, (_, i) => i));
  const [pos, setPos] = useState(0);

  const isLast = pos >= count - 1;

  const next = useCallback(() => {
    setPos((p) => {
      if (p >= count - 1) { onFinish(); return p; }
      return p + 1;
    });
  }, [count, onFinish]);

  // Move the current card to one slot before the final card, then reveal the
  // next card. If there's no room before the final card (already at/after that
  // slot), just advance normally.
  const requeue = useCallback(() => {
    if (pos >= count - 2) { next(); return; }
    setOrder((prev) => {
      const arr = [...prev];
      const [cur] = arr.splice(pos, 1);
      arr.splice(arr.length - 1, 0, cur); // insert before the (still-last) final card
      return arr;
    });
    // pos stays put: after the splice the following card now occupies `pos`.
  }, [pos, count, next]);

  return { cardIndex: order[pos], pos, total: count, isLast, next, requeue };
}
