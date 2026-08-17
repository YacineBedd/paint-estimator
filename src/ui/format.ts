export const formatMoney = (n: number): string =>
  n.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 2,
  });

export const formatHours = (n: number): string => n.toFixed(1);

export const formatArea = (n: number): string =>
  `${n.toLocaleString("en-CA", { maximumFractionDigits: 1 })} sq ft`;
