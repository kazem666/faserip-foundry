import { combatTarget, writePending } from "./play-rules.mjs";
import { circleTemplateData } from "./zones.mjs";
import { squaresPerArea } from "./movement.mjs";

/**
 * A home-built power can say what a successful FEAT does.
 * Named powers keep their own use and never reach this.
 */

const waiters = new Map();

function requestId() {
  return globalThis.foundry?.utils?.randomID?.() || Math.random().toString(36).slice(2);
}

function colorOf(message) {
  return message?.getFlag?.("faserip", "color") || message?.flags?.faserip?.color || "";
}

function tokenCenter(actor) {
  const token = actor?.getActiveTokens?.(true)?.[0] || actor?.getActiveTokens?.()?.[0];
  if (!token) return null;
  const doc = token.document || token;
  return {
    scene: doc.parent || globalThis.canvas?.scene,
    x: token.center?.x ?? token.x,
    y: token.center?.y ?? token.y
  };
}

async function performActivity(data) {
  const actor = globalThis.game?.actors?.get?.(data.actorId) || globalThis.fromUuidSync?.(data.uuid);
  try {
    if (data.action === "pending" && actor) {
      await writePending(actor, data.patch || {});
      return true;
    }
    if (data.action === "heal" && actor?.heal) {
      await actor.heal(Number(data.amount) || 0);
      return true;
    }
    if (data.action === "harm" && actor?.applyDamage) {
      await actor.applyDamage(Math.abs(Number(data.amount) || 0), { energy: false });
      return true;
    }
    if (data.action === "condition" && actor?.toggleStatusEffect) {
      const id = data.statusId;
      if (!id) return false;
      await actor.toggleStatusEffect(id, { active: true, overlay: false });
      const effect = [...(actor.effects ?? [])].find((entry) => entry.statuses?.has?.(id) || entry.getFlag?.("core", "statusId") === id);
      const rounds = Number(data.rounds) || 0;
      if (effect && rounds > 0) {
        const combat = globalThis.game?.combat;
        await effect.update({
          duration: { rounds, startRound: combat?.round ?? null, combat: combat?.id || null }
        });
      }
      if (id === "fear") {
        await actor.setFlag("faserip", "emotion", "fear");
        if (effect) await effect.setFlag("faserip", "activityEmotion", "fear");
      }
      return true;
    }
    if (data.action === "template") {
      const scene = globalThis.game?.scenes?.get?.(data.sceneId) || globalThis.canvas?.scene;
      if (!scene?.createEmbeddedDocuments) return false;
      await scene.createEmbeddedDocuments("MeasuredTemplate", data.data || []);
      return true;
    }
  } catch (err) {
    console.warn("FASERIP | power activity", err);
  }
  return false;
}

function askActivity(action, payload) {
  if (globalThis.game?.user?.isGM) return performActivity({ action, ...payload });
  if (!globalThis.game?.socket) {
    globalThis.ui?.notifications?.warn("The Judge needs to be online for that.");
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    const id = requestId();
    const timer = setTimeout(() => {
      waiters.delete(id);
      globalThis.ui?.notifications?.warn("The Judge needs to be online for that.");
      resolve(false);
    }, 5000);
    waiters.set(id, (result) => {
      clearTimeout(timer);
      resolve(result);
    });
    globalThis.game.socket.emit("system.faserip", { system: "activity", action, requestId: id, ...payload });
  });
}

export function registerActivity() {
  const Hooks = globalThis.Hooks;
  if (Hooks && !Hooks._faseripActivityFear) {
    Hooks._faseripActivityFear = true;
    Hooks.on("deleteActiveEffect", (effect) => {
      if (effect?.getFlag?.("faserip", "activityEmotion") !== "fear") return;
      const actor = effect.parent;
      if (actor?.getFlag?.("faserip", "emotion") === "fear") {
        actor.unsetFlag("faserip", "emotion").catch(() => {});
      }
    });
  }
  if (!globalThis.game?.socket) {
    globalThis.Hooks?.once?.("ready", registerActivity);
    return;
  }
  if (globalThis.game.faserip?._activitySocket) return;
  globalThis.game.faserip = globalThis.game.faserip || {};
  globalThis.game.faserip._activitySocket = true;
  globalThis.game.socket.on("system.faserip", async (data) => {
    if (data?.system !== "activity") return;
    if (data.action === "reply") {
      const waiter = waiters.get(data.requestId);
      if (!waiter) return;
      waiters.delete(data.requestId);
      waiter(data.result);
      return;
    }
    if (!globalThis.game.user?.isGM) return;
    const result = await performActivity(data);
    globalThis.game.socket.emit("system.faserip", {
      system: "activity",
      action: "reply",
      requestId: data.requestId,
      result
    });
  });
}

async function touch(actor, action, payload) {
  if (!actor) return false;
  if (globalThis.game?.user?.isGM || actor.isOwner) return performActivity({ action, actorId: actor.id, uuid: actor.uuid, ...payload });
  return askActivity(action, { actorId: actor.id, uuid: actor.uuid, ...payload });
}

export async function applyPowerActivity(actor, item, message) {
  const activity = item?.system?.activity;
  if (!actor || !activity?.on) return;
  const color = colorOf(message);
  if (!color || color === "white") return;
  const target = combatTarget(actor.id || "");
  const foe = activity.shiftWho === "foe";
  const who = foe ? target : actor;
  const notes = [];
  const shift = Number(activity.shift) || 0;
  if (shift && who) {
    const patch = foe
      ? { incomingCs: shift, incomingNote: `${item.name} ${shift > 0 ? "+" : ""}${shift} CS` }
      : { nextCs: shift, nextNote: `${item.name} ${shift > 0 ? "+" : ""}${shift} CS` };
    if (await touch(who, "pending", { patch })) notes.push(foe ? `${who.name} is ${shift > 0 ? "+" : ""}${shift} column on the next attack.` : `${who.name} is ${shift > 0 ? "+" : ""}${shift} column on the next roll.`);
  } else if (shift && foe) {
    notes.push("Target a token for the column shift.");
  }
  const health = Number(activity.health) || 0;
  const patient = target || actor;
  if (health > 0 && patient) {
    if (await touch(patient, "heal", { amount: health })) notes.push(`${patient.name} regains ${health} Health.`);
  } else if (health < 0 && patient) {
    if (await touch(patient, "harm", { amount: health })) notes.push(`${patient.name} takes ${Math.abs(health)} Health.`);
  }
  if (activity.condition) {
    const marked = foe ? target : actor;
    if (!marked) notes.push("Target a token for the condition.");
    else if (await touch(marked, "condition", { statusId: activity.condition, rounds: Number(activity.rounds) || 0 })) {
      const label = { held: "held", fear: "afraid", stun: "stunned", blind: "blinded", deaf: "deafened" }[activity.condition] || activity.condition;
      notes.push(`${marked.name} is ${label}${activity.rounds ? ` for ${activity.rounds} round${Number(activity.rounds) === 1 ? "" : "s"}` : ""}.`);
    }
  }
  if (activity.template === "circle") {
    const where = tokenCenter(target || actor);
    if (where?.scene) {
      const grid = Number(globalThis.canvas?.grid?.size) || 100;
      const span = Math.max(1, Number(activity.areas) || 1) * squaresPerArea();
      const radius = (span * grid) / 2;
      const { feetPerArea } = await import("./movement.mjs");
      const feet = Math.max(1, Number(activity.areas) || 1) * feetPerArea();
      const data = circleTemplateData({ x: where.x, y: where.y }, radius, "#c4a574", item.name);
      if (await askActivity("template", { sceneId: where.scene.id, data: [data] })) {
        notes.push(`A circle ${feet} feet across is on the scene.`);
      }
    }
  }
  if (notes.length) globalThis.ui?.notifications?.info(notes.join(" "));
}
