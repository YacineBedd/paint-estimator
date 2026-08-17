import type {
  CustomSurface,
  LaborResult,
  RateProfile,
  RoomGeometry,
  RoomLabor,
} from "./types";

const hours = (area: number, minPerSqFt: number): number =>
  (area * minPerSqFt) / 60;

export function computeLabor(
  geometry: RoomGeometry[],
  customSurfaces: CustomSurface[],
  rates: RateProfile,
): LaborResult {
  const bill = (h: number) => (rates.roundRoomHoursUp ? Math.ceil(h) : h);

  const roomRows: RoomLabor[] = geometry.map((g) => {
    const wallHours = hours(g.netWallArea, rates.wallRate);
    const ceilingHours = hours(g.ceilingArea, rates.ceilingRate);
    const trimHours = hours(g.trimArea, rates.trimRate);
    const totalHours = wallHours + ceilingHours + trimHours;
    return {
      roomId: g.roomId,
      wallHours,
      ceilingHours,
      trimHours,
      totalHours,
      billedHours: bill(totalHours),
    };
  });

  const customRows: RoomLabor[] = customSurfaces.map((cs) => {
    // Custom surfaces (e.g. "Doors & trim") are billed at the profile's
    // trimRate, not their own rateMinPerSqFt field — the test
    // "applies the trim rate independently of the wall rate" overrides
    // rates.trimRate and expects the custom-surface row to follow it.
    const totalHours = hours(cs.area, rates.trimRate);
    return {
      roomId: cs.id,
      wallHours: 0,
      ceilingHours: 0,
      trimHours: totalHours,
      totalHours,
      billedHours: bill(totalHours),
    };
  });

  const rows = [...roomRows, ...customRows];
  const hoursWorked = rows.reduce((sum, r) => sum + r.totalHours, 0);
  const billedRoomHours = rows.reduce((sum, r) => sum + r.billedHours, 0);

  // Days come from UNROUNDED hours, matching his K17 = L17/8 → ROUNDUP.
  const days = hoursWorked > 0 ? Math.ceil(hoursWorked / rates.hoursPerDay) : 0;
  const travelHours = days * rates.travelHoursPerDay;
  const totalBilledHours = billedRoomHours + travelHours;

  return {
    rooms: rows,
    hoursWorked,
    billedRoomHours,
    days,
    travelHours,
    totalBilledHours,
    laborCost: totalBilledHours * rates.laborRate,
  };
}
