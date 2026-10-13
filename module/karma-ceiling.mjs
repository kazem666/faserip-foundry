/**
 * Optional Karma ceiling. Off until the Judge turns the house rule on.
 * Current Karma cannot sit above Reason + Intuition + Psyche. The rest is lost.
 */

export function capKarma(value, lid, ruleOn) {
  const next = Number(value);
  const max = Number(lid);
  if (!ruleOn || !Number.isFinite(next) || !Number.isFinite(max) || max <= 0 || next <= max) {
    return { value: next, lost: 0 };
  }
  return { value: max, lost: next - max };
}

function ceilingOn() {
  try { return !!globalThis.game?.settings?.get("faserip", "houseKarmaCeiling"); }
  catch { return false; }
}

export function bindKarmaCeiling() {
  const Hooks = globalThis.Hooks;
  if (!Hooks || Hooks._faseripKarmaCeiling) return;
  Hooks._faseripKarmaCeiling = true;
  Hooks.on("preUpdateActor", (actor, changes) => {
    if (!ceilingOn()) return;
    const next = changes?.system?.karma?.value;
    if (next == null || next === "") return;
    const lid = Number(changes?.system?.karma?.max ?? actor?.system?.karma?.max) || 0;
    const capped = capKarma(next, lid, true);
    if (!capped.lost) return;
    changes.system.karma.value = capped.value;
    globalThis.ui?.notifications?.info(`${actor?.name || "This hero"} is at the Karma ceiling (${lid}). ${capped.lost} is lost.`);
  });
}
