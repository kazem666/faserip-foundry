/**
 * One extra dice action from a speed power. Off until the Judge turns the house rule on.
 * The rank does not add more actions.
 */

const SPEED_RE = /lightning speed|hyper-speed|hyper-running|hyper speed|hyper running/i;

export function speedPowerName(actor) {
  for (const item of actor?.items ?? []) {
    if (item?.type !== "power") continue;
    const name = String(item.name || "").replace(/\s*\([^)]*\)/g, "").trim();
    if (SPEED_RE.test(name)) return name;
  }
  return "";
}

export function speedSheetLine(name, used) {
  if (!name) return "";
  return used ? `${name} extra action used` : `Extra action from ${name}`;
}

export function nextActionNote({ turn = false, speed = "", acted = false, speedUsed = false } = {}) {
  if (!turn && !speed) return { note: "", diceRound: false, speedRound: false };
  if (!acted) return { note: "", diceRound: true, speedRound: false };
  if (speed && !speedUsed) return { note: `Extra action from ${speed}.`, diceRound: false, speedRound: true };
  if (!turn) return { note: "", diceRound: false, speedRound: false };
  if (speed) return { note: "Dice action past the extra from speed.", diceRound: false, speedRound: false };
  return { note: "Second dice action this round.", diceRound: false, speedRound: false };
}
