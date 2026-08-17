# Paint Estimator — Design Spec

**Date:** 2026-08-16
**Status:** Approved for planning
**Author:** Yacine Beddiari (with Claude)

---

## 1. Context

A working residential painting contractor (interior + exterior repaint, Quebec/Canada,
Benjamin Moore supplier account) currently estimates jobs with an Excel spreadsheet
(`Estimator.xlsx`). He asked for a web tool that improves on it.

His request, verbatim from email:

> I would need a place to add windows and doors so I may have a estimate of the
> moldings/trim and doors to paint plus removing the square footage of the doors and
> windows it will give me a more accurate number for the wall square foot.

He cited the [Benjamin Moore](https://www.benjaminmoore.com/en-ca/paint-calculator) and
Sherwin-Williams paint calculators as good references.

**Key observation about those references:** both are _material_ calculators. BM accepts
Length/Width/Height plus a count of doors and windows, assumes 2 coats, excludes the
ceiling, and outputs gallons only — explicitly labelled "not intended to give more than a
rough estimate." Neither reference outputs a dollar, an hour, or a foot of trim.

**That gap is the product.**

---

## 2. Goal

Ship the painter's own spreadsheet as a web app — with its latent defects fixed, the
door/window handling he asked for added, and his manual calibration loop automated.

**Success criteria:**

1. With default settings, the engine reproduces `Estimator.xlsx` to the penny.
2. He can enter doors and windows, and they correctly deduct from wall area and generate
   trim linear footage.
3. He uses it to bid a real job instead of opening Excel.

---

## 3. Users

**v1 targets exactly one known painter.** Not a SaaS product. His real rates are the
ground truth; industry averages are not used anywhere.

Multi-user support is explicitly out of scope until a second user exists.

---

## 4. Source analysis — `Estimator.xlsx`

The existing spreadsheet was fully decoded. This section is the authoritative record of
his model, since the app must reproduce it.

### 4.1 His constants

| Constant                  | Value                              | Cell               |
| ------------------------- | ---------------------------------- | ------------------ |
| Labor rate                | $75/hr                             | `M2`, `O2`         |
| Production rate, walls    | 0.75 min/sq ft                     | `I2`               |
| Production rate, ceilings | 0.75 min/sq ft                     | `K2`               |
| Production rate, trim     | 0.75 min/sq ft (same row formula)  | `I12`              |
| Coverage, walls & primer  | 500 sq ft/gal                      | `H2`               |
| Coverage, ceilings        | 550 sq ft/gal                      | `J2`               |
| Work day                  | 8 hours                            | `K17`              |
| Travel                    | +1 billed hour per day, rounded up | rows 17–18         |
| Coats — walls             | 1                                  | `F23`,`F24`        |
| Coats — trim              | 1                                  | `F26`,`F27`        |
| Coats — ceilings          | 2                                  | `I26`,`I27`        |
| Coats — bathroom (Aura)   | 2                                  | `I23`,`I24`        |
| Supplier discount         | ~25% off BM list                   | `G` vs `I` columns |

### 4.2 His per-room formulas

```
Wall area    H = (wall1 + wall2 + wall3 + wall4) × ceilingHeight
Wall time    I = (H × 0.75) / 60
Ceiling area J = wall1 × wall2
Ceiling time K = (J × 0.75) / 60
Total time   L = I + K
Time cost    M = L × 75
Billed hours N = ROUNDUP(L, 0)          ← per room, not per job
Billed cost  O = N × 75
```

Rooms are assumed rectangular: `wall3 = wall1`, `wall4 = wall2`.

### 4.3 Reference job outcome (the golden test)

**Labor is fully derived from geometry — the engine must reproduce it exactly:**

| Figure                      | Value          |
| --------------------------- | -------------- |
| Total painted surface       | 5,433.16 sq ft |
| Hours worked                | 39.9145        |
| Hours billed (room roundup) | 42             |
| Travel hours                | 5              |
| **Total billed hours**      | **47**         |
| **Labor**                   | **$3,525.00**  |

**Materials are two different things in his sheet, and they must not be conflated:**

| Figure                                    | Value         | Source                                    |
| ----------------------------------------- | ------------- | ----------------------------------------- |
| Gallons _calculated_ from area            | 14            | `D` column (`ROUNDUP` of area ÷ coverage) |
| Gallons _actually purchased_              | 12            | `E` column, hand-entered after the job    |
| `H38` — 14 calculated gal at _list_ price | $1,014.91     | `D × G`                                   |
| `J38` — 12 purchased gal at _his_ price   | $995.22       | `E × I`                                   |
| **Job total** (`O37` = `O19` + `J38`)     | **$4,520.22** | labor + purchased materials               |

The $4,520.22 total therefore uses **actual purchases**, not the sheet's own calculated
gallons. The engine cannot derive $995.22 from geometry — that figure is a
_calibration input_, not an expected output. See §12 for how the golden test splits.

Note also that `H38` and `J38` are not comparable: 14 gallons at list versus 12 at cost
differ in both quantity and price, so the sheet's list-vs-cost comparison does not
actually measure his supplier discount.

His effective rate: **$0.94/sq ft of painted surface** (0.75 min × $75/hr).
All-in realized: **$0.83/sq ft**.

### 4.4 His products

| Code | Product              | List    | His price |
| ---- | -------------------- | ------- | --------- |
| K380 | Fresh Start primer   | $35.00  | ~$35.00   |
| 549  | Regal Select — walls | $94.99  | $71.25    |
| 550  | Regal — trim (Pearl) | $94.99  | $80.74    |
| K532 | Aura Bath & Spa      | $112.99 | $84.74    |
| K508 | Waterborne Ceiling   | $83.99  | $62.50    |

### 4.5 Defects found

These are the reason the app is worth building. Each maps to a structural fix in §6.

1. **Stairwell primed but never painted.** `H22` (wall paint area) sums `H5:H7`+`H13:H16`,
   skipping rows 8–11 (the four stairs rows). `K25` (ceilings) has the identical gap.
   Blank in the sample job, so it has never fired. The first job with stairs data
   under-orders paint and under-bills labor. Bathrooms are correctly excluded (they take
   Aura); stairs are simply missing from the range.

2. **The primer row uses a different unit, unmarked.** Every finish product's `I/G` ratio
   sits between 0.74 and 0.85 — his supplier discount. Primer's is exactly **6.00**, so
   `I31 = $210` is not a per-gallon price in the same unit as the rest. It is a 5-gallon
   pail, which means `E31 = 1` records **one pail (5 gal)**, not one gallon. Reading it as
   5 gal @ $42/gal reproduces `J38 = $995.22` exactly.

   Consequence: primer is _not_ over-ordered — calculated 5 gal, purchased 5 gal. An
   earlier reading of this spec claimed a 5× over-order; that was wrong and is retracted.
   The real defect is that gallons and pails share one column with nothing distinguishing
   them, which is a live mis-ordering hazard. The engine prices strictly per gallon and
   makes pack size an explicit product property (§7). Whether he actually spot-primes
   remains an open question for the call (§14 Q3), not something to infer from this sheet.

3. **Finish paint under-ordered by 22%.** Excluding primer, the sheet calculates 9 gallons
   of finish paint; he actually bought **11** — short on both ceilings (3 calc / 4 actual)
   and Aura (1 calc / 2 actual). Unlike the primer row, every finish product uses
   consistent per-gallon units and a consistent discount ratio, so this comparison is
   sound. Operationally, a 22% shortfall is a mid-job trip back to the store.

4. **`C39` does not measure what it appears to.** It computes `C38 / D38` = 5,433.16 ÷ 14
   = 388 sq ft/gal — total area over _calculated_ gallons, not the 12 actually purchased.
   That quantity measures his own `ROUNDUP` waste, not yield. **His real coverage is
   ~410 sq ft/gal** (4,511.12 sq ft of coated area ÷ 11 finish gallons) against the 500 /
   550 he assumes. He is hand-running a calibration loop, but against the wrong
   denominator, and with no mechanism to act on the result.

5. **No door or window deduction.** Wall area = perimeter × height, full stop. This is
   exactly what his email asks for.

6. **Doors and trim are a single opaque fudge.** `H12 = ((3+7)×7)×4 = 280 sq ft`, i.e.
   70 sq ft per door. Cannot answer "what if 14 doors" or "no crown moulding," and trim
   cannot be separated from doors.

7. **Room rounding is a hidden ~5% uplift.** 39.9 hrs of work bills as 42. Real margin,
   currently invisible to him.

8. **No sundries, overhead, or explicit profit line.** Tape, plastic, caulk, brushes,
   patching all buried inside the $75/hr.

9. **Column `B` is overloaded** — floor number on room rows, quantity on the doors row
   (`B12 = 4`).

10. **Nine blank template rows are silently summed**, with no indication they are empty.

### 4.6 Validating his fudge factor

Decomposing a standard 3′×7′ door properly:

```
slab, both faces      3 × 7 × 2          = 42.0 sq ft
casing, both sides    (2×7 + 3) × 2 lf, ~0.5 ft girth ≈ 17.0 sq ft
jamb                  17 lf × ~0.5 ft     ≈  8.5 sq ft
                                    total ≈ 67.5 sq ft
```

His gut number of 70 sq ft/door is accurate within 4%. The engine is not correcting him —
it gives his instinct a formula so it flexes correctly for double doors, uncased
openings, or a house with 14 doors instead of 4.

---

## 5. Scope

### In scope (v1)

- Pure estimating engine, unit-tested against the golden job
- Quick Estimate mode (whole-house ballpark from MLS-style sq ft)
- Detailed Takeoff mode (room-by-room, with openings)
- Doors and windows as first-class objects: area deduction + trim derivation
- Editable rate profile, seeded from his constants
- Editable price book, seeded with his five BM products at his real prices
- Results breakdown with visible margin levers
- Job close-out calibration loop
- Local-first storage, JSON export/import

### Deferred (phase 2+)

- Floorplan sketcher → 3D (phase 2) — see §11
- Customer-facing PDF proposal (phase 3)
- Exterior-specific rate model (phase 2)
- Metric units toggle
- Accounts, sync, multi-user
- Live retail price scraping

### Explicitly rejected

- **GitHub OAuth as end-user login.** Painters do not have GitHub accounts. GitHub is
  where source lives; Vercel is where it deploys; neither is a sign-in method.
- **Live paint price aggregation.** No public price API exists for SW, BM, PPG, Home
  Depot, or Lowe's. Scraping is fragile and against terms — but the decisive argument is
  accuracy: he pays ~25% below list, so scraped retail prices would inflate every single
  estimate. His own price book is strictly more accurate than any external source.
- **MLS sq ft driving a 3D model.** Floor area does not determine geometry. A model
  generated from one number would be fiction, and fiction cannot inform an estimate.

---

## 6. Architecture

**Stack:** React + TypeScript + Vite. Source on GitHub, static deploy to Vercel. No
backend, no database, no auth. Currency CAD. Imperial units (his sheet is entirely feet).

**Governing rule:** the engine is pure TypeScript with zero framework dependencies and
zero I/O. Geometry and rates in, estimate breakdown out. It never imports React, touches
storage, or reads the DOM.

```
src/
  engine/                 pure, dependency-free, fully unit tested
    geometry.ts           rooms + openings → net wall area, ceiling area, trim lin ft
    labor.ts              areas → hours → rounding → travel → billed hours
    materials.ts          areas + coats + coverage → gallons per product
    pricing.ts            gallons × price book + hours × rate + sundries → totals
    estimate.ts           orchestrator; returns the full itemized breakdown
  data/                   price book, rate profile, defaults, localStorage persistence
  ui/                     quick mode, room table, results, settings, close-out
```

`geometry.ts` is the only module the phase-2 sketcher touches. The sketcher becomes a
second producer of the same `Room[]` the table produces; nothing downstream knows which
one drew it. This is what keeps phase 2 from being a rewrite.

**Storage:** estimates as JSON in `localStorage`. Rate profile and price book live under
separate keys so they persist across jobs. Explicit export/import to file.

---

## 7. Data model

```ts
type Project = {
  name: string;
  rooms: Room[];
  customSurfaces: CustomSurface[]; // see note below
  rateProfile: RateProfile;
  priceBook: PaintProduct[];
  actuals?: JobActuals; // filled at close-out, §10
};

// Escape hatch for anything that is not a room: his `Doors & trim` row 12,
// a garage door, an exterior elevation. Required for the golden test (§12),
// since row 12 is an explicit 280 sq ft area, not a derived one.
type CustomSurface = {
  name: string; // 'Doors & trim'
  area: number; // 280
  rateMinPerSqFt: number; // 0.75
  productId: string; // '550'
  coats: number;
};

type Room = {
  name: string; // 'Salle de bains'
  floor: number; // his column B — now only ever means floor
  quantity: number; // replaces the overloaded B12 = 4
  walls: number[]; // [11.8, 11] rectangular, or all four
  ceilingHeight: number;
  scope: {
    walls: boolean;
    ceiling: boolean;
    trim: boolean;
    primer: "none" | "spot" | "full";
  };
  wallProductId: string; // bathrooms → Aura, no hand-edited sum ranges
  openings: Opening[];
};

type Opening = {
  kind: "door" | "window" | "passage";
  quantity: number;
  width: number;
  height: number;
  paintSlab: boolean; // doors: both faces
  casedSides: 0 | 1 | 2;
};

type RateProfile = {
  laborRate: 75;
  wallRate: 0.75; // min/sq ft
  ceilingRate: 0.75;
  trimRate: 0.75; // own field; see §8.3
  hoursPerDay: 8;
  travelHoursPerDay: 1;
  roundRoomHoursUp: true;
  wallCoverage: 500; // sq ft/gal
  ceilingCoverage: 550;
  spotPrimeFraction: number; // available, NOT defaulted — see §8.3 and §14 Q3
  trimGirthFt: 0.5; // lin ft → area for baseboard and casing; see §4.6
  coats: { walls: 1; trim: 1; ceilings: 2; specialty: 2 };
};

// Recorded at close-out; drives calibration (§10). Never an engine output.
type JobActuals = {
  hoursWorked: number;
  gallonsPurchased: Record<string, number>; // productId → gallons
  notes?: string;
};

type PaintProduct = {
  id: string; // 'K532'
  name: string; // 'Aura Bath & Spa'
  use: "primer" | "wall" | "ceiling" | "trim" | "specialty";
  listPrice: number; // per gallon, always
  actualPrice: number; // per gallon, always — what he pays; estimates use this
  packSizeGal: number; // 1 or 5; display/ordering only, never pricing (defect 2)
  coverageOverride?: number; // K532 Aura → 550
  priceUpdatedAt: string;
};
```

**Structural fixes encoded in the model:**

- Rooms are a list, not fixed template rows — nothing can be silently omitted from a sum
  the way the stairwell was (defect 1).
- `scope` makes coverage a property of the room, so the stairwell bug is unrepresentable.
- `wallProductId` replaces hand-maintained sum ranges for product assignment.
- `openings` deducts from wall area _and_ generates trim from one source (defects 5, 6).
- `floor` and `quantity` are separate fields (defect 9).
- `actuals` makes the calibration input a first-class field rather than a column he
  overwrites by hand (defects 3, 4).

---

## 8. Engine math

### 8.1 Geometry

| Output                | Formula                                      |
| --------------------- | -------------------------------------------- |
| Gross wall area       | `perimeter × ceilingHeight` (his `H` column) |
| **Net wall area**     | gross − Σ(opening `width × height`)          |
| Ceiling area          | `wall1 × wall2`                              |
| Baseboard lin. ft     | `perimeter − Σ(door widths)`                 |
| Door casing lin. ft   | `(2h + w) × casedSides` per door             |
| Window casing lin. ft | `2(w + h)` per window                        |
| Door slab area        | `w × h × 2` when `paintSlab`                 |

### 8.2 Labor

```
roomHours   = (wallArea × wallRate + ceilingArea × ceilingRate
               + trimArea × trimRate) / 60
billedHours = roundRoomHoursUp ? ceil(roomHours) : roomHours     // per room
days        = ceil(Σ roomHours / hoursPerDay)
travelHours = days × travelHoursPerDay
totalBilled = Σ billedHours + travelHours
laborCost   = totalBilled × laborRate
```

### 8.3 Two defaults that stay as-is but become visible

- **`trimRate` defaults to 0.75** to match his sheet exactly. Trim realistically runs 2–3×
  slower per sq ft than rolling walls. On the reference job trim was only 280 of 5,433
  sq ft, so the error is immaterial — but on a heavy-trim house it is the difference
  between profit and loss. It is now its own editable field so **he** can raise it once
  he can see it broken out. The app does not change it for him.

- **`primer` defaults to `'full'`, matching his sheet.** `'spot'` is implemented and
  selectable per room, but ships with no default fraction. An earlier draft defaulted to
  `'spot'` at 0.22, derived from a misreading of the primer row's units (defect 2) — his
  calculated and purchased primer actually agree at 5 gallons, so there is no evidence in
  this sheet that he spot-primes at all. Setting `spotPrimeFraction` is a call question
  (§14 Q3), not an inference.

**Net effect: v1 ships with no deliberate numerical departures from his spreadsheet.** The
sole computational divergence is `ROUNDUP` on the Aura line where he used `ROUNDDOWN`
(§8.4), and it is asserted explicitly in §12. Everything else in §4.5 is fixed
structurally — made impossible to represent, or surfaced as a warning — rather than by
silently changing a number.

### 8.4 Materials & pricing

```
gallons(product) = ROUNDUP((assignedArea × coats) / coverage)
materialCost     = Σ gallons × product.actualPrice
total            = laborCost + materialCost
```

`ROUNDUP` applies to every product. His sheet is inconsistent here — `D34` uses
`ROUNDDOWN` for the Aura line while every other product rounds up, which is part of why he
came up a gallon short on bathrooms (defect 3). The engine always rounds up; you cannot
buy a partial gallon.

---

## 9. UI

**1 · Quick Estimate** — MLS sq ft, ceiling height, door count, window count, scope
toggles. Ballpark in ~30 seconds for phone quoting.

Floor area does not yield wall area directly, so this mode needs a multiplier. Starting
default derives from his own sheet: his four entered rooms total 953.16 sq ft of floor
against 1,960 sq ft of wall — a **2.06× ratio**. This default is refined by calibration
(§10) rather than left as a guess.

**2 · Detailed Takeoff** — his spreadsheet, alive. Add/remove room rows freely, openings
nested per room, live totals in a sticky footer.

**3 · Results** — labor hours → billed hours → crew-days; materials itemized by product
with gallons; totals. Surfaces the margin levers his sheet hides:

> 39.9 hrs worked · 42 billed (rounding +$157) · 5 travel (+$375) · **47 total**

**4 · Settings** — rate profile and price book, every constant editable with its source
shown.

**5 · Job Close-out** — actual gallons and actual hours in; drift report out (§10).

---

## 10. Calibration loop

He already does this by hand — he tracks calculated vs. "Actual" gallons per product, and
`C39` attempts a coverage figure. He has the feedback signal, the wrong denominator, and no
mechanism to act on the result (defect 4).

**The correct measurement**, which the app computes automatically:

```
realCoverage(product) = (assignedArea × coats) / actualGallonsPurchased
```

Coated area, not raw area; gallons purchased, not gallons calculated. On the reference job
that is 4,511.12 sq ft ÷ 11 finish gallons = **410 sq ft/gal**, against the 500 / 550 he
assumes — not the 388 his sheet reports, which is really a measure of his own `ROUNDUP`
waste.

Primer is calibrated separately and never blended into the finish-coat figure. Averaging
them is exactly what let a 4-gallon primer surplus hide a 22% finish-paint shortfall.

At close-out the app reports drift per product:

> Ceilings ran 410 sq ft/gal, not 550. You bought 4 gal, the estimate said 3.
> Update coverage default for K508?

Three values calibrate off real outcomes:

| Value                            | Calibrates from                              |
| -------------------------------- | -------------------------------------------- |
| Coverage per product             | coated area ÷ gallons purchased, per product |
| Production rate                  | actual hours vs. area painted                |
| Quick-mode floor→wall multiplier | every completed detailed takeoff             |

**This loop is the entire differentiator.** The BM and SW calculators are static formulas
that disclaim themselves as rough. This one gets measurably more accurate with every job
he closes, converging on his crew and his housing stock.

---

## 11. Phase 2 — floorplan sketcher (not in v1)

Recorded here because it shaped the v1 architecture.

The valuable form of "3D" is **input, not output**: he drags room rectangles and drops in
doors and windows, it extrudes to 3D, and that geometry _is_ the estimate — perimeters
give baseboard, wall faces give area, placed openings auto-deduct. The model is true by
construction rather than fictional.

It lands as a second producer of `Room[]` against the already-proven engine (§6).

---

## 12. Testing

The golden test splits in three, because his sheet's total mixes a derived figure with a
hand-entered one (§4.3). Conflating them would let a broken materials calculation pass.

**G1 — Labor, exact. Gates all releases.**
The `Estimator.xlsx` job entered with default settings, no openings, and `Doors & trim` as
a `CustomSurface` of 280 sq ft, must produce **39.9145 hrs worked / 42 billed / 5 travel /
47 total / $3,525.00**. Every figure is derivable from geometry. If this fails, nothing
ships.

**G2 — Calculated gallons, exact.**
Per-product calculated gallons must equal his `D` column: primer **5**, walls **4**,
trim **1**, ceilings **3** — and Aura **2**, where his sheet says 1 because it uses
`ROUNDDOWN` there (§8.4). That single divergence is asserted explicitly so it can never be
mistaken for a regression.

**G3 — The $995.22 is an input, not an output.**
That figure is 12 gallons _actually purchased_ at his prices. The engine must never be
asserted to produce it. It is fed in as `JobActuals` and the test verifies the calibration
loop derives **~410 sq ft/gal** finish coverage and flags the 22% finish-paint shortfall
(defect 3).

**No departure test is needed**, because v1 ships no deliberate numerical departures
(§8.3). G2's Aura assertion is the only divergence in the suite.

Rationale for the whole approach: if his first estimate disagrees with his spreadsheet and
he cannot see exactly why, he stops trusting the tool that day. Every fix in §4.5 is opt-in
and visible, never a silent difference.

Additionally:

- Unit tests per engine module
- Opening-deduction cases: zero openings, openings exceeding wall area, uncased passages
- Trim derivation against the §4.6 hand-decomposition (~67.5 sq ft for a 3′×7′ door)
- Property tests: net wall area never negative; gallons never round to zero on nonzero
  area; billed hours never less than worked hours
- Regression test per defect in §4.5 — notably a stairwell room that must appear in both
  primer and finish-paint totals

## 13. Error handling

Aimed at the sample sheet's actual failure modes:

- Openings exceeding their wall area → hard validation error, never a negative area
- Blank rooms excluded from sums but **visibly flagged** ("3 rooms have no dimensions") —
  his sheet silently summed nine empty rows
- Price entries older than 6 months → stale-price warning on the Results screen
- Export reminder, since `localStorage` is the only copy of his data

---

## 14. Open questions for the painter call

To confirm directly with him:

1. **Exterior work** — v1 models interior only. What is his exterior production rate, and
   does he price by elevation area, by siding type, or per sq ft of floor?
2. **Trim rate** — does trim genuinely run at the same 0.75 min/sq ft as rolling walls, or
   has that been absorbed into the roundup margin?
3. **Spot priming** — does he spot-prime on repaints, or full-prime? His sheet full-primes
   and his purchase matches it, so there is no evidence either way. If he spot-primes, what
   fraction of wall area? This sets `spotPrimeFraction`, which currently has no default.
4. **Primer units** — confirm `K380` at $210 is a 5-gallon pail (≈$42/gal) and not
   something else. The whole materials total reconciles on that reading, but it is an
   inference, and the sheet records it as quantity "1" in the same column as gallons.
5. **Sundries** — what does he spend per job on tape, plastic, caulk, brushes, patching,
   and is it currently buried in the $75/hr?
6. **The roundup** — is billing 42 hrs for 39.9 hrs worked deliberate margin or an
   artifact? Does he want it kept?
7. **Ceiling height** — always 8 ft, or does he hit cathedral/vaulted, and how does he
   price those?
8. **Occupied vs. empty homes** — is there a furniture-moving/masking premium?
9. **Coverage** — his real yield is ~410 sq ft/gal, not the 500 / 550 he assumes. Does he
   want the app to default to his measured number or keep the manufacturer's figure? Worth
   asking what he does today when he runs short mid-job.
10. **The bathroom and ceiling shortfall** — he bought 2 gal of Aura against 1 calculated,
    and 4 gal of ceiling against 3. Is that consistent across jobs, a dark-to-light colour
    change, or specific to this house?
11. **Multiple crew** — does the 8-hour day mean one painter or a crew, and does crew size
    vary by job?
12. **Currency and taxes** — CAD confirmed? Are GST/QST shown on estimates?

---

## 15. Decisions log

| Decision          | Choice                                 | Rationale                                            |
| ----------------- | -------------------------------------- | ---------------------------------------------------- |
| Target user       | One specific real painter              | His numbers are ground truth; no invented averages   |
| Job types         | Interior + exterior residential        | Interior first; exterior needs its own rate model    |
| Input granularity | Whole-house quick, drill down to rooms | Matches both phone quoting and kitchen-table bidding |
| Output            | Internal number first, proposal later  | Math must be trusted before it is printed            |
| Paint pricing     | His own price book                     | Only source reflecting his ~25% supplier discount    |
| Auth              | None — local-first                     | One user; no backend, no cost, works offline on site |
| 3D                | Sketch-to-estimate, phase 2            | Only version where the geometry informs the estimate |
| Sequencing        | Engine + tables first                  | His email asked for openings, not 3D                 |
