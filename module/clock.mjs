const DAY = 86400;

export function worldDay(now = globalThis.game?.time?.worldTime) {
  return Math.floor(Number(now || 0) / DAY);
}

export function worldWeek(now = globalThis.game?.time?.worldTime) {
  return Math.floor(worldDay(now) / 7);
}

export function recoveryUsed(actor) {
  if (!actor?.system?.condition?.recoveredToday) return false;
  const stamped = actor.getFlag?.("faserip", "recoveredDay");
  if (stamped == null || stamped === "") return true;
  return Number(stamped) === worldDay();
}

export async function stampRecovery(actor) {
  if (!actor?.setFlag) return;
  await actor.setFlag("faserip", "recoveredDay", worldDay());
}

export function resourcesUsed(actor) {
  const stamped = actor?.system?.resources?.usedThisWeek;
  if (stamped == null || stamped === "") return false;
  return String(stamped) === String(worldWeek());
}

export async function stampResources(actor) {
  if (!actor?.update) return false;
  if (resourcesUsed(actor)) return false;
  await actor.update({ "system.resources.usedThisWeek": String(worldWeek()) });
  return true;
}

async function clearStaleRecovery() {
  if (!globalThis.game?.user?.isGM) return;
  const today = worldDay();
  for (const actor of globalThis.game.actors ?? []) {
    if (!actor.system?.condition?.recoveredToday) continue;
    const stamped = actor.getFlag?.("faserip", "recoveredDay");
    if (stamped != null && Number(stamped) === today) continue;
    try {
      await actor.update({ "system.condition.recoveredToday": false });
    } catch (err) {
      console.warn("FASERIP | recovery clock", err);
    }
  }
}

export function registerClock() {
  const Hooks = globalThis.Hooks;
  if (!Hooks || Hooks._faseripClock) return;
  Hooks._faseripClock = true;
  Hooks.on("updateWorldTime", () => {
    clearStaleRecovery().catch((err) => console.warn("FASERIP | world clock", err));
  });
}
