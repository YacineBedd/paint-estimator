import { describe, it, expect, afterEach, vi } from "vitest";

describe("nextId", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("gives unique ids within a single page load", async () => {
    const { nextId } = await import("../idGen");
    const ids = new Set([nextId("place"), nextId("place"), nextId("place")]);
    expect(ids.size).toBe(3);
  });

  // F2: Room3DEditor's placementCounter (and OpeningsEditor's identical
  // openingIdSeq) were module-scoped counters that reset to 0 on every page
  // load, while the openings they name persist to localStorage. Place a
  // window (id `place-1`), reload, place another window in the same room:
  // `place-1` again -- and because OpeningsEditor matches by id for both
  // update and remove, deleting or editing one now silently affects both.
  //
  // A fresh module instance (via resetModules + re-import) stands in for a
  // page reload: the counter would restart at 0 in the old code. This test
  // fails against that code because the id from "after reload" collides
  // with the id from "before reload".
  it("does not collide across a simulated page reload", async () => {
    const before = await import("../idGen");
    const idBefore = before.nextId("place");

    vi.resetModules();
    const after = await import("../idGen");
    const idAfter = after.nextId("place");

    expect(idAfter).not.toBe(idBefore);
  });

  // The harder case: without crypto.randomUUID (older Safari, and jsdom
  // unless stubbed), nextId falls back to a mount-time nonce + counter.
  // That fallback is the one actually responsible for surviving a reload,
  // since a bare counter alone would restart at 1 every time. Force the
  // fallback path on both "loads" and prove it still doesn't collide.
  it("does not collide across a reload even without crypto.randomUUID", async () => {
    vi.stubGlobal("crypto", {});
    const before = await import("../idGen");
    const idBefore = before.nextId("place");
    expect(idBefore).not.toContain("undefined");

    vi.resetModules();
    vi.stubGlobal("crypto", {});
    const after = await import("../idGen");
    const idAfter = after.nextId("place");

    expect(idAfter).not.toBe(idBefore);
  });

  // Two openings created in separate component mounts -- the concrete
  // scenario the finding names: place a window, unmount that editor (as
  // navigating away and back, or a reload, would do), mount it again, place
  // another window. They must not collide.
  it("gives two openings created in separate component mounts different ids", async () => {
    const { render, cleanup } = await import("@testing-library/react");
    const React = await import("react");
    const { useEffect } = React;
    const { newOpening } = await import("../OpeningsEditor");
    const { nextId } = await import("../idGen");

    function Placer({ onPlace }: { onPlace: (id: string) => void }) {
      useEffect(() => {
        onPlace(newOpening("window", nextId("place")).id);
      }, [onPlace]);
      return null;
    }

    const ids: string[] = [];
    const record = (id: string) => ids.push(id);

    const first = render(React.createElement(Placer, { onPlace: record }));
    first.unmount();
    cleanup();

    const second = render(React.createElement(Placer, { onPlace: record }));
    second.unmount();
    cleanup();

    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
  });
});
