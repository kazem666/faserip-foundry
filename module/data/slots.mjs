/** Two-slot powers spend two generation slots (Advanced Set * / UPB **). */

const TWO_RE = /counts as two|\*\*|two slots|costs two/i;

export function isTwoSlotPower(name = "", extra = {}) {
  if (extra.countsAsTwo || extra.twoSlot || Number(extra.slotsTaken) === 2) return true;
  return TWO_RE.test(String(name || ""));
}

export function cleanPowerName(name = "") {
  return String(name || "")
    .replace(/\s*\(counts as two(?: powers?)?\)\s*$/i, "")
    .replace(/\s*\*+\s*$/g, "")
    .trim();
}

export function slotCost(name = "", extra = {}, remaining = 99) {
  const two = isTwoSlotPower(name, extra);
  if (two && remaining < 2) return 0;
  return two ? 2 : 1;
}

export function slotsUsed(list = []) {
  return list.reduce((sum, row) => sum + Math.max(0, Number(row.cost ?? row.slotsTaken ?? 1) || 0), 0);
}
