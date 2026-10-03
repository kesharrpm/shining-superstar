export const PACKS = Object.freeze({
  "regular-5-rp": { packType: "regular", count: 5, cost: 50000, currency: "rp" },
  "regular-10-rp": { packType: "regular", count: 10, cost: 100000, currency: "rp" },
  "regular-30-rp": { packType: "regular", count: 30, cost: 300000, currency: "rp" },
  "premium-5-diamond": { packType: "premium", count: 5, cost: 50, currency: "diamonds" },
  "premium-10-diamond": { packType: "premium", count: 10, cost: 90, currency: "diamonds" },
  "premium-30-diamond": { packType: "premium", count: 30, cost: 200, currency: "diamonds" }
});

export const MATERIALS = Object.freeze({
  "mat-10": { chance: 0.10, cost: 5000, currency: "rp" },
  "mat-30": { chance: 0.30, cost: 15000, currency: "rp" },
  "mat-50": { chance: 0.50, cost: 25000, currency: "rp" },
  "mat-100": { chance: 1.00, cost: 100, currency: "diamonds" }
});

export const SHOP_ITEMS = Object.freeze({
  VIP_PASS: { currency: "mileage", cost: 100 },
  S_TICKET: { currency: "rp", cost: 50000 }
});

export const CARD_GRADE_VALUES = Object.freeze({ C:1, B:2, A:3, S:4, R:5, MAT:0 });
export const BASE_COSTS = Object.freeze({ C:500, B:1000, A:2500, S:6000, R:12000, MAT:1000 });
export const COST_MULTIPLIERS = Object.freeze({ C:1, B:1.25, A:1.5, S:2, R:3 });

export function maxInventorySlots(player) {
  let base = 300;
  if (Number(player.level || 1) >= 30) base = 1000;
  else if (Number(player.level || 1) >= 20) base = 700;
  else if (Number(player.level || 1) >= 10) base = 450;
  return base + Number(player.boughtSlots || 0);
}

export function usedInventorySlots(player) {
  return (player.inventory || []).filter(c => c?.type !== "material").length;
}
