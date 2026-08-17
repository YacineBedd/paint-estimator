export const formatMoney = (n: number): string =>
  n.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 2,
  });

export const formatHours = (n: number): string => n.toFixed(1);

export const formatArea = (n: number): string =>
  `${n.toLocaleString("en-CA", { maximumFractionDigits: 1 })} sq ft`;

/**
 * "1 crew-day" / "5 crew-days".
 *
 * Two bugs lived in the old inline copy: the unit was always pluralised
 * ("1 crew-days") and the separator rendered as an em-dash. A crew-day is a
 * compound noun, so it takes a hyphen, and the count governs the plural.
 * This lives here rather than at each call site so the two screens that
 * print it (Estimate and the square-footage starter) can't drift apart.
 */
export const formatCrewDays = (days: number): string =>
  `${days} ${days === 1 ? "crew-day" : "crew-days"}`;

/**
 * A room's size, the way he says it out loud: "12 × 10 · 8 ft".
 * Returns null when nothing has been measured yet, so the caller can show a
 * prompt instead of a row of zeroes.
 */
export const formatRoomSize = (
  walls: readonly number[],
  ceilingHeight: number,
): string | null => {
  const measured = walls.filter((w) => w > 0);
  if (measured.length === 0) return null;
  const trim = (n: number) => String(Number(n.toFixed(2)));
  return `${measured.map(trim).join(" × ")} · ${trim(ceilingHeight)} ft`;
};
