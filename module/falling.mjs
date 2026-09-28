import { elevationFeet } from "./elevation.mjs";
import { floorsFromFeet } from "./rules-battle.mjs";
import { workflowOn } from "./workflow.mjs";

const STATUS_ID = "falling";

function groundElevation() {
  const base = Number(globalThis.canvas?.level?.elevation?.base ?? 0);
  return Number.isFinite(base) ? base : 0;
}

export function heightFeet(tokenDoc) {
  if (!tokenDoc) return 0;
  const here = elevationFeet(tokenDoc);
  const ground = elevationFeet({ document: { elevation: groundElevation() } });
  return here - ground;
}

export function isFlying(tokenDoc) {
  return tokenDoc?.movementAction === "fly";
}

function hasFalling(actor) {
  return [...(actor?.effects ?? [])].some((effect) => effect.statuses?.has?.(STATUS_ID));
}

async function setFalling(actor, active) {
  if (!actor || typeof actor.toggleStatusEffect !== "function") return;
  if (hasFalling(actor) === active) return;
  try {
    await actor.toggleStatusEffect(STATUS_ID, { active, overlay: false });
  } catch (err) {
    console.warn("FASERIP | falling status", err);
  }
}

async function syncToken(tokenDoc) {
  if (!globalThis.game?.user?.isGM) return;
  const actor = tokenDoc?.actor;
  if (!actor) return;
  const suspended = workflowOn("autoFalling") && !isFlying(tokenDoc) && heightFeet(tokenDoc) >= 8;
  await setFalling(actor, suspended);
}

export async function dropToken(tokenDoc) {
  const actor = tokenDoc?.actor;
  if (!actor) return;
  const floors = floorsFromFeet(heightFeet(tokenDoc));
  if (floors > 0) {
    const { promptFall } = await import("./battle-results.mjs");
    const dropped = await promptFall(actor, { floors });
    if (!dropped) return;
  }
  await tokenDoc.update({ elevation: groundElevation() });
  await setFalling(actor, false);
}

export function registerFalling() {
  const effects = globalThis.CONFIG?.statusEffects;
  if (Array.isArray(effects) && !effects.some((effect) => effect.id === STATUS_ID)) {
    effects.push({ id: STATUS_ID, name: "Falling", img: "icons/svg/falling.svg" });
  }
  const Hooks = globalThis.Hooks;
  if (!Hooks || Hooks._faseripFalling) return;
  Hooks._faseripFalling = true;
  Hooks.on("updateToken", (doc, changes) => {
    if (!changes || !("elevation" in changes || "movementAction" in changes)) return;
    syncToken(doc).catch((err) => console.warn("FASERIP | falling", err));
  });
  Hooks.on("canvasReady", () => {
    for (const token of globalThis.canvas?.tokens?.placeables ?? []) {
      syncToken(token.document).catch(() => {});
    }
  });
}
