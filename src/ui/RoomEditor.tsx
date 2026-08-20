import { useEffect, useState } from "react";
import type {
  PaintProduct,
  Room,
  RoomGeometry,
  Warning,
} from "../engine/types";
import { OpeningsEditor } from "./OpeningsEditor";
import { Disclosure } from "./Disclosure";
import { WarningList } from "./warningGroups";
import { formatArea } from "./format";

interface Props {
  room: Room;
  geometry?: RoomGeometry;
  priceBook: PaintProduct[];
  /** Already filtered by the caller to this room, warnings deferred. */
  warnings: Warning[];
  onChange: (room: Room) => void;
  onRemove: () => void;
  onBack: () => void;
}

interface ProductSelectProps {
  label: string;
  productId: string;
  priceBook: PaintProduct[];
  onSelect: (productId: string) => void;
}

// Primer is applied to a room via `room.scope.primer` (none/spot/full), not
// by picking a per-room primer product, so primer-use products are excluded
// from these lists — every other use (wall/ceiling/trim/specialty) is a
// legitimate finish for any surface. Specialty products like Aura Bath & Spa
// are the whole point (F2): a bathroom needs to reach them for walls AND
// ceiling, not just the "wall"/"ceiling"-use products.
function ProductSelect({
  label,
  productId,
  priceBook,
  onSelect,
}: ProductSelectProps) {
  const options = priceBook.filter((p) => p.use !== "primer");
  return (
    <label>
      {label}
      <select value={productId} onChange={(e) => onSelect(e.target.value)}>
        {options.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}

interface GaugeProps {
  label: string;
  value: number;
  onCommit: (value: number) => void;
}

/**
 * The hero control: one of Wall 1 / Wall 2 / Height.
 *
 * Held as a STRING, not a number, for two independent reasons.
 *
 * 1. A brand-new room carries 0 for its wall lengths, and showing him a
 *    literal "0" he has to select and delete before typing is friction on
 *    the field's most common state. An empty string with a "ft" placeholder
 *    reads as "not measured yet" — which is the truth — and he types
 *    straight over it.
 * 2. The same controlled-input revert this codebase already works around in
 *    OpeningsEditor/SettingsScreen/CloseoutScreen: a purely prop-controlled
 *    input has its DOM value forced back to the last rendered prop after
 *    every native input event, so multi-character typing clobbers itself
 *    unless the component commits the keystroke to its own state
 *    synchronously. The effect below resyncs when the room's value changes
 *    for a reason other than this field's own edit (a different room opened,
 *    a project imported).
 */
function Gauge({ label, value, onCommit }: GaugeProps) {
  const asText = (n: number) => (n > 0 ? String(n) : "");
  const [text, setText] = useState(() => asText(value));

  useEffect(() => setText(asText(value)), [value]);

  return (
    <label className="gauge">
      <span className="gauge-label">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step="0.1"
        min={0}
        placeholder="—"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const next = Number(e.target.value);
          onCommit(Number.isFinite(next) && next > 0 ? next : 0);
        }}
      />
      <span aria-hidden="true" className="gauge-unit">
        ft
      </span>
    </label>
  );
}

export function RoomEditor({
  room,
  geometry,
  priceBook,
  warnings,
  onChange,
  onRemove,
  onBack,
}: Props) {
  // Removing a room used to sit top-right, directly opposite the back
  // button — both inside a phone's one-handed thumb arc, one of them
  // destructive and immediate. A mis-tap reaching for "back" while standing
  // in a client's hallway could erase a room he'd just spent five minutes
  // measuring, with no way back. It now lives at the bottom of the editor,
  // away from the back button, and needs a second, explicit tap to confirm.
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const productName = (id: string) =>
    priceBook.find((p) => p.id === id)?.name ?? id;

  const setWall = (index: number, value: number) => {
    const walls = [...room.walls];
    while (walls.length <= index) walls.push(0);
    walls[index] = value;
    onChange({ ...room, walls });
  };

  const scopeSummary = (["walls", "ceiling", "trim"] as const)
    .filter((k) => room.scope[k])
    .join(" · ");

  return (
    <div className="room-editor">
      <div className="editor-bar">
        <button
          type="button"
          className="back-button"
          onClick={onBack}
          aria-label="back to rooms list"
        >
          <span aria-hidden="true" className="back-chevron" />
          Rooms
        </button>
      </div>

      <input
        className="room-name"
        aria-label="room name"
        value={room.name}
        onChange={(e) => onChange({ ...room, name: e.target.value })}
      />

      <WarningList warnings={warnings} />

      <div className="gauges">
        <Gauge
          label="Wall 1"
          value={room.walls[0] ?? 0}
          onCommit={(v) => setWall(0, v)}
        />
        <Gauge
          label="Wall 2"
          value={room.walls[1] ?? 0}
          onCommit={(v) => setWall(1, v)}
        />
        <Gauge
          label="Height"
          value={room.ceilingHeight}
          onCommit={(v) => onChange({ ...room, ceilingHeight: v })}
        />
      </div>

      {/* Captions in the text face, areas in tabular mono — the same split
          the Estimate screen's readouts use. */}
      {geometry && geometry.grossWallArea + geometry.ceilingArea > 0 && (
        <div className="room-geometry">
          <span>
            Net wall <b className="num">{formatArea(geometry.netWallArea)}</b>
          </span>
          {geometry.openingArea > 0 && (
            <span>
              {" "}
              (−<b className="num">{formatArea(geometry.openingArea)}</b>{" "}
              openings)
            </span>
          )}
          <span>
            {" "}
            · Ceiling <b className="num">{formatArea(geometry.ceilingArea)}</b>
          </span>
        </div>
      )}

      <OpeningsEditor
        openings={room.openings}
        onChange={(openings) => onChange({ ...room, openings })}
      />

      {/* Set once per room and then never touched again — three permanent
          select rows per room were the single biggest contributor to a
          10,000px takeoff. Openings stay above, outside the disclosure,
          because counting doors and windows IS the task. */}
      <Disclosure
        className="room-more"
        label="More"
        hint={productName(room.wallProductId)}
      >
        <fieldset className="scope">
          <legend>Paint</legend>
          {(["walls", "ceiling", "trim"] as const).map((key) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={room.scope[key]}
                onChange={(e) =>
                  onChange({
                    ...room,
                    scope: { ...room.scope, [key]: e.target.checked },
                  })
                }
              />
              {key}
            </label>
          ))}
        </fieldset>

        <fieldset className="products">
          <legend>Products</legend>
          <ProductSelect
            label="Wall product"
            productId={room.wallProductId}
            priceBook={priceBook}
            onSelect={(wallProductId) => onChange({ ...room, wallProductId })}
          />
          <ProductSelect
            label="Ceiling product"
            productId={room.ceilingProductId}
            priceBook={priceBook}
            onSelect={(ceilingProductId) =>
              onChange({ ...room, ceilingProductId })
            }
          />
          <ProductSelect
            label="Trim product"
            productId={room.trimProductId}
            priceBook={priceBook}
            onSelect={(trimProductId) => onChange({ ...room, trimProductId })}
          />
        </fieldset>

        <p className="note">
          Painting {scopeSummary || "nothing"} in this room.
        </p>
      </Disclosure>

      <div className="editor-danger">
        {confirmingRemove ? (
          <div className="remove-confirm">
            <p>Remove this room? This can&rsquo;t be undone.</p>
            <div className="remove-confirm-actions">
              <button
                type="button"
                className="cancel-remove"
                onClick={() => setConfirmingRemove(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="confirm-remove"
                aria-label="confirm remove room"
                onClick={onRemove}
              >
                Yes, remove room
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="remove-room"
            aria-label="remove room"
            onClick={() => setConfirmingRemove(true)}
          >
            Remove room
          </button>
        )}
      </div>
    </div>
  );
}
