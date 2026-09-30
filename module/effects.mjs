import { readPending } from "./play-rules.mjs";

const SHIFT_KEYS = [
  ["next", "nextCs", "nextNote"],
  ["incoming", "incomingCs", "incomingNote"],
  ["armor", "armorCs", "armorNote"]
];

function shiftEffect(actor, key) {
  return [...(actor?.effects ?? [])].find((effect) => effect.getFlag?.("faserip", "shift") === key) || null;
}

function hasStatus(actor, id) {
  return [...(actor?.effects ?? [])].some((effect) => effect.statuses?.has?.(id) || effect.getFlag?.("core", "statusId") === id);
}

export async function syncShiftEffects(actor, pending = readPending(actor)) {
  if (!actor?.createEmbeddedDocuments || actor._faseripShiftSync) return;
  actor._faseripShiftSync = true;
  try {
    for (const [key, csKey, noteKey] of SHIFT_KEYS) {
      const cs = Number(pending?.[csKey] || 0);
      const existing = shiftEffect(actor, key);
      if (!cs) {
        if (existing) await existing.delete();
        continue;
      }
      const combat = globalThis.game?.combat;
      const data = {
        name: pending[noteKey] || `${cs > 0 ? "+" : ""}${cs} CS`,
        img: cs < 0 ? "icons/svg/downgrade.svg" : "icons/svg/upgrade.svg",
        disabled: false,
        duration: {
          rounds: 1,
          startRound: combat?.round ?? null,
          combat: combat?.id || null
        },
        flags: { faserip: { shift: key, cs } }
      };
      if (existing) await existing.update(data);
      else await actor.createEmbeddedDocuments("ActiveEffect", [data]);
    }
  } catch (err) {
    console.warn("FASERIP | column shift effect", err);
  } finally {
    actor._faseripShiftSync = false;
  }
}

async function syncHeld(actor) {
  if (!actor || typeof actor.toggleStatusEffect !== "function") return;
  const stuck = !!actor.getFlag?.("faserip", "stuck");
  if (hasStatus(actor, "held") === stuck) return;
  try {
    await actor.toggleStatusEffect("held", { active: stuck, overlay: false });
  } catch (err) {
    console.warn("FASERIP | held", err);
  }
}

export function registerEffects() {
  const effects = globalThis.CONFIG?.statusEffects;
  if (Array.isArray(effects) && !effects.some((effect) => effect.id === "held")) {
    effects.push({ id: "held", name: "Held", img: "icons/svg/net.svg" });
  }
  const Hooks = globalThis.Hooks;
  if (!Hooks || Hooks._faseripEffects) return;
  Hooks._faseripEffects = true;
  Hooks.on("deleteActiveEffect", (effect, _options, userId) => {
    if (globalThis.game?.user?.id !== userId) return;
    const key = effect.getFlag?.("faserip", "shift");
    const actor = effect.parent;
    if (!key || !actor?.setFlag || actor._faseripShiftSync) return;
    const pending = readPending(actor);
    if (!pending[`${key}Cs`]) return;
    actor._faseripShiftSync = true;
    actor.setFlag("faserip", "pending", { ...pending, [`${key}Cs`]: 0, [`${key}Note`]: "" })
      .catch((err) => console.warn("FASERIP | clear shift", err))
      .finally(() => { actor._faseripShiftSync = false; });
  });
  Hooks.on("updateActor", (actor, changes) => {
    if (!globalThis.game?.user?.isGM) return;
    const flags = changes?.flags?.faserip;
    if (!flags) return;
    if ("stuck" in flags || "-=stuck" in flags) {
      syncHeld(actor).catch((err) => console.warn("FASERIP | held", err));
    }
  });
}
