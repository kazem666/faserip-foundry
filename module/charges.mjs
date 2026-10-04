import { isSpareAmmo, spareRounds, tracksAmmo } from "./ammo.mjs";

function keyOf(item) {
  return String(item?.name || "").toLowerCase();
}

export function expendableKind(item) {
  if (!item) return "";
  const key = keyOf(item);
  if (item.type === "weapon" && /grenade/.test(key) && !/launcher/.test(key)) return "grenade";
  if (item.type !== "equipment") return "";
  if (/medkit refill/.test(key)) return "refill";
  if (/first aid|\bmedkit\b/.test(key)) return "medkit";
  if (/fire extinguisher/.test(key)) return "extinguisher";
  if (/mace spray/.test(key)) return "spray";
  if (/water-breathing|water breathing|\btablet/.test(key)) return "tablets";
  if (/parachute/.test(key)) return "parachute";
  return "";
}

export function defaultCharges(item) {
  const kind = expendableKind(item);
  if (kind === "parachute") return 1;
  if (kind === "grenade") return 3;
  if (kind === "medkit") return 4;
  if (kind === "refill") return 2;
  if (kind === "extinguisher") return 8;
  if (kind === "spray") return 5;
  if (kind === "tablets") return 6;
  if (isSpareAmmo(item)) return spareRounds(item);
  return 3;
}

export function tracksCharges(item) {
  if (!item || (item.type !== "weapon" && item.type !== "equipment")) return false;
  if (item.system?.chargeOff) return false;
  if (isSpareAmmo(item) || tracksAmmo(item)) return false;
  if (item.system?.expendable) return true;
  return expendableKind(item) !== "";
}

function storedCharges(item) {
  const raw = item?.type === "weapon" ? Number(item.system?.charges) : Number(item.system?.rounds);
  return Number.isFinite(raw) ? raw : -1;
}

export function chargeStatus(item) {
  if (!tracksCharges(item)) return null;
  const full = defaultCharges(item);
  const raw = storedCharges(item);
  const left = raw < 0 ? full : Math.max(0, raw);
  return { left, full, empty: left <= 0, field: item.type === "weapon" ? "system.charges" : "system.rounds" };
}

export function chargeBlock(item) {
  const status = chargeStatus(item);
  if (!status || !status.empty) return "";
  return `${item.name} is used up.`;
}

export async function spendCharge(item, { quiet = false } = {}) {
  const status = chargeStatus(item);
  if (!status || !item?.update) return false;
  const left = Math.max(0, status.left - 1);
  await item.update({ [status.field]: left });
  if (!quiet) {
    const note = left > 0 ? `${item.name}: ${left} left.` : `${item.name} is used up.`;
    globalThis.ui?.notifications?.info(note);
  }
  return true;
}

export async function spendSupply(item) {
  if (!isSpareAmmo(item) || !item?.update) return false;
  const have = spareRounds(item);
  if (have <= 0) {
    globalThis.ui?.notifications?.warn(`${item.name} is used up.`);
    return false;
  }
  const left = have - 1;
  await item.update({ "system.rounds": left });
  globalThis.ui?.notifications?.info(left > 0 ? `${item.name}: ${left} left.` : `${item.name} is used up.`);
  return true;
}

export async function refillCharges(actor, item) {
  const status = chargeStatus(item);
  if (!status || expendableKind(item) !== "medkit") {
    globalThis.ui?.notifications?.warn("That item is not refilled from a medkit.");
    return false;
  }
  if (status.left >= status.full) {
    globalThis.ui?.notifications?.info(`${item.name} is already full.`);
    return false;
  }
  const spare = [...(actor?.items ?? [])].find((entry) => expendableKind(entry) === "refill" && (chargeStatus(entry)?.left || 0) > 0);
  if (!spare) {
    globalThis.ui?.notifications?.warn(`${item.name} needs a medkit refill on the sheet.`);
    return false;
  }
  await spendCharge(spare, { quiet: true });
  await item.update({ "system.rounds": status.full });
  const left = chargeStatus(spare)?.left ?? 0;
  globalThis.ui?.notifications?.info(`${item.name} is refilled to ${status.full}. ${spare.name} has ${left} left.`);
  return true;
}
