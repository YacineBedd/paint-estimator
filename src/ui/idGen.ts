// Opening ids persist to localStorage, and both OpeningsEditor and
// Room3DEditor match openings by id for update/remove -- so an id has to
// stay unique not just within one page load but across a reload. A
// module-scoped counter that starts at 0 on every load doesn't do that:
// place a window (id `place-1`), reload, place another window in the same
// room, and it's `place-1` again. From then on, editing or removing either
// window edits or removes both, silently.
//
// crypto.randomUUID() sidesteps the problem entirely -- vanishingly
// unlikely to repeat across reloads, mounts, or anything else. Where it
// isn't available (older Safari, and jsdom unless a test stubs it), fall
// back to a nonce generated once per module load (i.e. once per page load)
// combined with an incrementing counter. The nonce changes every reload, so
// even two id sequences that both start their counter at 1 can't collide
// with each other.
let fallbackNonce: string | null = null;
let fallbackCounter = 0;

function fallbackUnique(): string {
  if (fallbackNonce === null) {
    fallbackNonce =
      Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  fallbackCounter += 1;
  return `${fallbackNonce}-${fallbackCounter}`;
}

function hasRandomUUID(): boolean {
  return (
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
  );
}

/** A collision-resistant id, prefixed for readability in the DOM/devtools. */
export function nextId(prefix: string): string {
  const unique = hasRandomUUID() ? crypto.randomUUID() : fallbackUnique();
  return `${prefix}-${unique}`;
}
