export function defaultPlayer(handle, uid) {
  return {
    authUid: uid, authVersion: 3, handle, handleKey: String(handle || "").normalize("NFKC").trim().toLowerCase(),
    rp: 50000, hp: 50, exp: 0, level: 1, mileage: 5, diamonds: 500,
    inventory: [], deck: {}, profile: {}, wallpapers: ["H2H_01"], unlockedPFPs: [], boughtSlots: 0,
    missions: { plays: 0, playsClaimed: false, pulls: 0, pullsClaimed: false },
    missionProgress: {}, missionClaimed: {}, claimedCoupons: [], eventClaims: {10:false,50:false,100:false},
    cardBookClaims: {}, purchaseLimits: {}, eventPoints: {}, stepUpState: {},
    starPass: { level: 1, exp: 0, isPremium: false, claimedFree: [], claimedPremium: [] },
    inbox: [], isVIP: false,
    joinDate: new Date().toISOString(), lastLogin: new Date(0).toISOString(), serverRevision: 1
  };
}

export function charge(player, currency, amount) {
  const field = currency === "diamond" ? "diamonds" : currency;
  const bal = Number(player[field] || 0);
  const cost = Math.max(0, Number(amount || 0));
  if (bal < cost) throw Object.assign(new Error(`Not enough ${field}`), { status: 409, code: "INSUFFICIENT_FUNDS" });
  return { field, next: bal - cost };
}

export function maxInventorySlots(player) {
  let base = 300;
  if (Number(player.level || 1) >= 30) base = 1000;
  else if (Number(player.level || 1) >= 20) base = 700;
  else if (Number(player.level || 1) >= 10) base = 450;
  return base + Number(player.boughtSlots || 0);
}
