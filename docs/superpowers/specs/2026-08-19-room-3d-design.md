# Room 3D View — Design Spec

**Date:** 2026-08-19
**Status:** Approved for planning
**Author:** Yacine Beddiari (with Claude)
**Phase:** 2 — realises §11 of `2026-08-16-paint-estimator-design.md`

---

## 1. Context

v1 shipped: a local-first paint estimator whose engine reproduces the painter's real
Excel spreadsheet exactly (39.9145 hrs / 47 billed / $3,525.00 labor / gallons 5,4,1,2,3
/ $932.72 materials), with a phone-first room list and a per-room editor. Live at
`https://paint-estimator-three.vercel.app`.

This phase adds a 3D room view, referencing
[IKEA's PAX planner](https://www.ikea.com/addon-app/storageone/pax/web/latest/ca/en/#/planner)
as the interaction model.

**PAX is solving a different problem, and the difference shapes this design.** PAX is a
_product configurator_: you assemble something you will buy, starting from an idealised
empty room, and precise placement matters because a 50cm frame must physically fit beside
a 100cm one. This tool is _measurement capture_: it describes a room that already exists,
and a wrong number becomes a wrong bid.

**The consequence that shapes everything below:** for paint estimating, _where_ an opening
sits on a wall has no effect on the math. A 4′×3′ window subtracts 12 sq ft whether it is
centred, cornered, or at the ceiling. Only its size and count matter. So the drag-precision
that earns its keep in PAX buys nothing numerically here — it buys comprehension.

---

## 2. Goal

Let the painter verify a room's geometry by seeing it, and place doors and windows by
clicking walls rather than filling fields.

**Success criteria:**

1. He opens a room he already entered and can tell at a glance whether it is right.
2. He clicks a wall, a window appears, and the wall's net area visibly drops.
3. The engine is untouched: `git diff -- src/engine` shows only the two optional
   presentation fields in §5, and all golden assertions still pass.

**Explicit non-goal:** colour visualisation. See §3.

---

## 3. Scope

### In scope

- House Plan view: rooms grouped by floor, tap to open
- Single-room 3D: six planes, correct proportions, orbit
- Openings cut into walls, placed by clicking
- Trim rendered as baseboard bands and opening casing, following `room.scope.trim`
- Out-of-scope surfaces rendered hatched
- Live per-wall annotation showing gross area, deduction, and net
- Desktop/tablet split layout; phone degrades to inspect-only

### Explicitly out of scope

- **Paint colour.** Surfaces render in neutral whites. Colour visualisation is a separate
  product with its own data problem (maintained fan decks), and it serves selling rather
  than estimating. The client can use a manufacturer's own visualiser. **This tool is
  purely for the cost of the job.**
- Textures, lighting, shadows, furniture
- Walk-through or first-person camera
- Multi-room 3D, room adjacency, shared walls
- Spatial floorplan layout (see §4, decision 3)
- Placement editing on phones (see §7)

---

## 4. Decisions

| #   | Decision        | Choice                                        | Rationale                                                                                                                                                                     |
| --- | --------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Who and where   | Painter, tablet/laptop, after the walkthrough | Keeps the phone takeoff as the on-site capture tool; 3D is for verification and review                                                                                        |
| 2   | Authority       | Hybrid — typed dimensions, visual openings    | Typing `11.8` beats dragging to `11.8`; openings gain from being visual and lose nothing, since position does not affect area                                                 |
| 3   | House plan      | Grouped by floor, no spatial layout           | `Room.floor` already exists (it came from his spreadsheet's column B). Real adjacency would require rewriting geometry storage and raises a shared-wall double-count question |
| 4   | Scope on screen | One room at a time, nested in the house plan  | Maps onto the existing `Room` model; the 3D becomes a richer room editor rather than a new concept                                                                            |
| 5   | Fidelity        | Clean schematic, neutral whites               | Purely a cost tool (§3)                                                                                                                                                       |
| 6   | Rendering       | CSS 3D transforms                             | See §6                                                                                                                                                                        |

---

## 5. Data model changes

Two optional fields on the existing `Opening` interface in `src/engine/types.ts`:

```ts
export interface Opening {
  id: string;
  kind: OpeningKind;
  quantity: number;
  width: number;
  height: number;
  paintSlab: boolean;
  casedSides: 0 | 1 | 2;

  // ---- presentation only. The engine MUST NOT read these. ----
  /** Which wall this was placed on, for rendering. 0-3. */
  wallIndex?: 0 | 1 | 2 | 3;
  /** Horizontal position along that wall, 0..1. Rendering only. */
  offset?: number;
}
```

**These are decoration and must stay decoration.** A 4′×3′ window subtracts 12 sq ft
regardless of where it sits. §9 specifies the test that enforces this permanently.

No other engine type changes. Notably **no** `PaintProduct.colour` — dropped with the
colour goal.

---

## 6. Architecture

```
src/ui/
  HousePlanScreen.tsx      rooms grouped by floor → tap one
  room3d/
    Room3D.tsx             six planes, orbit state, selection
    WallPlane.tsx          one wall: shading, openings, trim, click-to-place
    OpeningMarker.tsx      a door or window on a wall
    projection.ts          PURE: room dims + camera angle → CSS transform strings
```

**Rendering: CSS 3D transforms.** Four walls, floor and ceiling are `<div>` elements
positioned with `transform`. Openings are child divs on wall planes. Orbit is
`rotateX/rotateY` on the container.

Chosen over Three.js and SVG isometric for three reasons:

1. **Zero dependencies.** The project has added none since scaffolding; the bundle is
   ~68KB gzipped. Three.js would add roughly 150KB gzipped — tripling it for someone
   loading this on patchy signal in a basement.
2. **Click handling is free.** Wall planes are real DOM, so placing an opening is an
   ordinary click handler. WebGL would require raycasting.
3. **It stays testable.** The suite is 159 Testing Library tests querying the DOM. A
   `<canvas>` is opaque to them; the 3D view would sit outside the safety net.

**Accepted limit:** CSS 3D handles simple convex boxes and nothing more. Our rooms are
simple boxes. If photoreal ever becomes the goal, this is discarded and Three.js is
written — an accepted bet, because this ships in weeks and tells us whether he uses it.

### Data flow

```
Room[] ──► computeGeometry ──► RoomGeometry[] ──► labor/materials ──► money
   │                                  │
   └──► Room3D renders ◄──────────────┘   (net wall area, trim ft — displayed live)
   ▲
   └──── click a wall → add Opening → same path re-runs
```

Clicking a wall and typing a quantity are **the same mutation** — both produce an
`Opening` on a `Room`. The phone list and the 3D view are two doors into one model, so
whichever he uses, the numbers agree.

`projection.ts` is pure: dimensions and camera angle in, transform strings out. It gets
unit tests with no DOM, like the engine.

---

## 7. Screens and interaction

### House Plan view

The Takeoff tab gains a **List / Plan** toggle. Not a fifth tab — the bottom bar is full
at four, and this is one job seen two ways.

```
GROUND FLOOR                          $2,400
  Salle de bains   11.8 × 11 · 8ft     7 h
  Kitchen/dining   14.1 × 39.4 · 8ft  19 h
SECOND FLOOR                          $1,050
  bedroom 1         9.8 × 11.3 · 8ft   6 h
```

Tapping a room opens it in 3D. This also answers "did I get every room?", which a flat
list cannot.

**Two paths now reach a room, and they must not become two editors.**

| Path            | Opens                     | Editing controls        |
| --------------- | ------------------------- | ----------------------- |
| List → tap room | Existing room editor (v1) | Existing controls       |
| Plan → tap room | 3D view + side panel      | **The same components** |

The 3D view's panel reuses the existing room-editor controls rather than reimplementing
them — same openings editor, same product selects, same scope checkboxes. Only emphasis
differs: the editor leads with the measurements, the 3D view leads with the room. Two
implementations of the same controls would drift, and that drift would surface as two
screens disagreeing about one room.

### Room 3D view

PAX's split at ≥900px: room on the left, panel on the right, running total top-right. The
panel holds openings, products and scope.

**Interactions, in order of frequency:**

1. **Click a wall → place an opening.** Door or window selected in the panel; it appears
   where clicked, the wall's net area drops, the total updates. This is the moment the
   feature earns itself — seeing the deduction happen.
2. **Click an opening → edit or delete.** Size and quantity in the panel, same defaults as
   the phone editor (3′×7′ door, 4′×3′ window).
3. **Drag to orbit.** Constrained: he may circle and tilt but never drop below the floor
   or invert the room.

**Per-wall annotation**, live: `11.8 × 8 = 94.4 sq ft − 12 = 82.4`. He can check our
arithmetic against his own head — the same trust-building the golden test does for the
spreadsheet.

### Rendering detail

- **Surfaces read by value, not hue.** Ceiling brightest, the two visible walls at
  slightly different values, floor darkest — standard architectural convention, free to
  implement.
- **Openings** are cut as darker recesses so they read as holes, not stickers.
- **Trim** is drawn only where it exists: baseboard along the wall-floor join, casing
  around each opening, following `room.scope.trim`. Turning trim off makes the bands
  disappear — a visible check on something currently invisible in the list.
- **Out-of-scope surfaces render hatched**, so "we are not painting this ceiling" is
  unmissable.
- **Product identity moves to the panel.** Without colour, the panel names the product per
  surface and the wall carries a small label.

### Phones

Below ~900px the split collapses. The 3D renders, orbits, and can be tapped to **inspect**
— but placement stays in the list editor. Dragging windows onto walls one-handed at 390px
would be worse than the two taps that exist today, and the phone flow was deliberately
optimised in the previous cycle. **On a phone the 3D is for showing, not building.**

Concretely: the List/Plan toggle is still present, Plan still groups rooms by floor, and
tapping a room shows the 3D with a clear **Edit this room** action handing off to the
existing editor. The 3D accepts orbit and tap-to-select, but not tap-to-place.

---

## 8. Error handling

- A room with zero or missing dimensions renders as a placeholder with a prompt to enter
  them, never as a collapsed or inside-out box.
- Openings whose total area meets or exceeds the wall render clamped, and the existing
  `OPENINGS_EXCEED_WALL` error surfaces on the panel as it does elsewhere.
- An `Opening` with no `wallIndex` (every opening created via the phone list) is assigned
  a deterministic default wall and evenly distributed offset at render time. Existing
  saved projects must open in 3D without migration.
- Orbit angles are clamped so the camera cannot pass through the floor.

---

## 9. Testing

Three layers, all inside the existing suite:

1. **`projection.ts` — pure unit tests.** Dimensions and camera angle in, transform
   strings out. No DOM.
2. **Component tests via Testing Library.** Four wall elements render; one opening element
   per opening; trim present when `scope.trim` is true and absent when false; out-of-scope
   surfaces carry the hatched treatment; per-wall annotation shows the correct gross,
   deduction and net.
3. **The coupling test that matters most.** Place an opening, move it to a different wall
   and offset, and assert `computeEstimate` returns byte-identical output. Placement is
   decoration; this test is what keeps it decoration forever.

**All 159 existing tests must continue to pass**, and the golden gate specifically:
39.9145 hrs / 42 billed / 5 days / 5 travel / 47 total / $3,525.00 / gallons 5,4,1,2,3 /
$932.72.

No canvas, no image snapshots, no visual-regression tooling.

---

## 10. Open questions

1. **Orbit on touch vs mouse** — one-finger drag to orbit conflicts with page scroll on a
   tablet. Likely needs a drag handle or a two-finger gesture; worth deciding against a
   real device.
2. **Non-rectangular rooms.** The `Room` model supports a 4-entry `walls` array with a
   documented `[a,b,a,b]` ordering constraint, currently unreachable from the UI (see v1
   spec §4.5 defect and the ledger's phase-2 flag). The 3D view is where irregular rooms
   would naturally arrive. **v1 of this feature renders rectangular rooms only**; anything
   else is deferred until the ordering question is resolved properly.
3. **Does he actually use it?** The honest risk is that a painter who quotes from a phone
   in a hallway never opens a tablet view. Worth instrumenting nothing and simply asking
   him after two weeks.

---

## 11. Decisions log

| Decision            | Choice                                   | Rationale                                                             |
| ------------------- | ---------------------------------------- | --------------------------------------------------------------------- |
| Reference model     | IKEA PAX planner                         | Split layout, live running total, category panel                      |
| Primary user/device | Painter, tablet/laptop, post-walkthrough | Phone takeoff remains the capture tool                                |
| Geometry authority  | Typed dimensions, visual openings        | Position does not affect area; typing beats dragging for exact values |
| House structure     | Grouped by floor                         | `Room.floor` already exists; no adjacency needed                      |
| Fidelity            | Schematic, neutral whites                | Purely a cost tool                                                    |
| Colour              | **Cut entirely**                         | Separate product; client can use a manufacturer's visualiser          |
| Renderer            | CSS 3D transforms                        | Zero deps, free hit-testing, stays testable                           |
| Engine impact       | Two optional presentation fields only    | Golden gate must keep passing                                         |
