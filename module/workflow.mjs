import { combinedShift, readPending, writePending } from "./play-rules.mjs";

export const WORKFLOW_SETTINGS = [
  {
    key: "workflowEnabled",
    name: "Workflow: Enable combat automation",
    hint: "Master switch for click-to-roll, automatic Health, Endurance checks, column shifts, and defense reactions. Chat cards still work when this is off.",
    default: true
  },
  {
    key: "autoRollAttack",
    name: "Workflow: Roll attacks and FEATs on click",
    hint: "A click rolls immediately. Shift-click always opens the FEAT dialog for Karma, Intensity, and column changes.",
    default: true
  },
  {
    key: "playersFastForward",
    name: "Workflow: Players also roll on click",
    hint: "When off, only the Judge rolls on click. Players get the FEAT dialog so they can set Karma before the roll.",
    default: true
  },
  {
    key: "requireTarget",
    name: "Workflow: Attacking requires a target",
    hint: "An attack that can deal Health will not roll until a token is targeted or selected.",
    default: false
  },
  {
    key: "autoColumnShifts",
    name: "Workflow: Apply talent and defense shifts",
    hint: "Talents and a saved Dodge, Block, or Evade fill the column shift. Turn off to type every shift by hand.",
    default: true
  },
  {
    key: "autoDefenseReaction",
    name: "Workflow: Offer Dodge, Block, or Evade",
    hint: "Before an attack roll, a defender with one of those talents can use it. The Judge is prompted if a player makes the attack.",
    default: false
  },
  {
    key: "autoApplyDamage",
    name: "Workflow: Apply Health on a hit",
    hint: "A damaging hit reduces the target's Health after Body Armor. The chat card can still apply it when this is off.",
    default: true
  },
  {
    key: "preferForceField",
    name: "Workflow: Use a Force Field when the target has one",
    hint: "Automatic Health uses the Force Field instead of Body Armor when the target has a field. Energy attacks still use the energy rule.",
    default: false
  },
  {
    key: "autoEnduranceCheck",
    name: "Workflow: Roll Slam, Stun, and Kill checks",
    hint: "After a Slam, Stun, or Kill result, the target rolls the matching Endurance check.",
    default: true
  },
  {
    key: "autoBattleResults",
    name: "Workflow: Apply Slam, Stun, and Kill results",
    hint: "A Slam check moves the target. A Stun check sets stunned or unconscious rounds. A Kill check starts Endurance loss. These run when the hit gets through, or when it lands exactly on the protection.",
    default: true
  },
  {
    key: "autoDyingClock",
    name: "Workflow: Count stun, unconsciousness, and dying each round",
    hint: "When the combat round advances, stunned and unconscious heroes count down. A dying hero loses one Endurance rank unless they spent Karma to hold on.",
    default: true
  },
  {
    key: "autoKarmaOnKill",
    name: "Workflow: A kill clears the attacker's current Karma",
    hint: "When Endurance reaches Shift 0 from a Kill result, the attacker's current Karma drops to 0. Banked advancement Karma stays. A hero in the group pool also wipes that pool.",
    default: true
  },
  {
    key: "showWorkflowButtons",
    name: "Workflow: Keep Apply and Check on the chat card",
    hint: "Shows the manual buttons even when Health and Endurance checks run on their own. They stay visible if automation is off.",
    default: true
  },
  {
    key: "showUniversalTable",
    name: "Workflow: Open the Universal Table on a roll",
    hint: "A FEAT opens the table and highlights the cell. The chat card keeps its color either way.",
    default: true
  },
  {
    key: "clearTargets",
    name: "Workflow: Clear targets after an attack",
    hint: "After an attack roll, the tokens you had targeted are cleared.",
    default: false
  },
  {
    key: "comicHits",
    name: "Workflow: Comic hit bursts",
    hint: "A hit pops a POW-style burst on the target. The word follows the attack, and green, yellow, red, Slam, Stun, and Kill change the size. The Health lost floats beside it.",
    default: true
  },
  {
    key: "strictInitiative",
    name: "Workflow: A natural 1 on initiative stays 1",
    hint: "The d10 is not modified when it rolls 1. Turn off to always add the Intuition modifier.",
    default: true
  }
];

const DEFAULTS = Object.fromEntries(WORKFLOW_SETTINGS.map((setting) => [setting.key, setting.default]));
const reactionWaiters = new Map();

export function registerWorkflowSettings() {
  for (const setting of WORKFLOW_SETTINGS) {
    game.settings.register("faserip", setting.key, {
      name: setting.name,
      hint: setting.hint,
      scope: "world",
      config: true,
      type: Boolean,
      default: setting.default,
      restricted: true
    });
  }
  game.settings.register("faserip", "groupKarma", {
    name: "Group Karma pool",
    hint: "Shared Karma for a team. A member who reduces someone to Shift 0 Endurance drops this pool to 0 along with their own current Karma.",
    scope: "world",
    config: true,
    type: Number,
    default: 0,
    restricted: true
  });
}

export function workflowOn(key) {
  const fallback = DEFAULTS[key] === true;
  try {
    if (globalThis.game?.settings) return !!game.settings.get("faserip", key);
  } catch {
    return fallback;
  }
  return fallback;
}

export function workflowActive(key) {
  if (!workflowOn("workflowEnabled")) return false;
  return workflowOn(key);
}

export function shiftPlan(actor, options) {
  if (!workflowActive("autoColumnShifts")) {
    return { cs: 0, note: "", consumeOutgoing: false, consumeIncoming: false };
  }
  return combinedShift(actor, options);
}

export function showCombatButtons() {
  if (!workflowOn("workflowEnabled") || !workflowOn("autoApplyDamage") || !workflowOn("autoEnduranceCheck")) return true;
  return workflowOn("showWorkflowButtons");
}

export function registerWorkflowSocket() {
  if (!game.socket || game.faserip?._workflowSocket) return;
  game.faserip = game.faserip || {};
  game.faserip._workflowSocket = true;
  game.socket.on("system.faserip", async (data) => {
    if (data?.system !== "workflow") return;
    if (data.action === "reaction-ask" && game.user.isGM) {
      const result = await resolveReaction(data);
      game.socket.emit("system.faserip", {
        system: "workflow",
        action: "reaction-answer",
        requestId: data.requestId,
        cs: result
      });
    }
    if (data.action === "reaction-answer") {
      const waiter = reactionWaiters.get(data.requestId);
      if (!waiter) return;
      reactionWaiters.delete(data.requestId);
      waiter(Number(data.cs) || 0);
    }
  });
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

async function askReaction({ targetName, attackLabel, choices }) {
  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (!DialogV2) return "";
  const buttons = choices.map((choice) => ({
    action: choice.column,
    label: choice.label,
    callback: () => choice.column
  }));
  buttons.push({ action: "none", label: "No defense", default: true, callback: () => "" });
  const result = await DialogV2.wait({
    classes: ["faserip-dialog"],
    window: { title: `${targetName} defense`, icon: "fa-solid fa-shield", resizable: true },
    content: `<div class="faserip-dialog-scroll"><p><strong>${esc(attackLabel)}</strong> is aimed at ${esc(targetName)}. Choose a defense, or continue.</p></div>`,
    buttons,
    rejectClose: false
  });
  return typeof result === "string" ? result : "";
}

async function rollDefense(target, choice) {
  const { rollFeat } = await import("./dice/universal-table.mjs");
  await rollFeat({
    actor: target,
    rankId: target.getAbilityRank(choice.ability),
    label: choice.label,
    effectsColumn: choice.column
  });
  const shift = readPending(target).incomingCs || readPending(target).armorCs || 0;
  return shift;
}

async function resolveReaction(data) {
  const target = game.actors.get(data.targetId);
  const choices = data.choices || [];
  if (!target || !choices.length) return 0;
  const column = await askReaction(data);
  const choice = choices.find((entry) => entry.column === column);
  if (!choice) return 0;
  await rollDefense(target, choice);
  const attackCs = readPending(target).incomingCs || 0;
  if (data.clearAfter && attackCs) {
    await writePending(target, { incomingCs: 0, incomingNote: "" });
  }
  return attackCs;
}

export async function offerDefenseReaction(target, attackLabel) {
  if (!workflowActive("autoDefenseReaction") || !target) return 0;
  const { defenseChoices } = await import("./item-actions.mjs");
  const choices = defenseChoices(target);
  if (!choices.length) return 0;
  const pending = readPending(target);
  if (pending.incomingCs || pending.armorCs) return 0;
  if (game.user.isGM || target.isOwner) {
    const column = await askReaction({ targetName: target.name, attackLabel, choices });
    const choice = choices.find((entry) => entry.column === column);
    if (!choice) return 0;
    await rollDefense(target, choice);
    return 0;
  }
  const gm = game.users.find((user) => user.active && user.isGM);
  if (!gm || !game.socket) return 0;
  return new Promise((resolve) => {
    const requestId = foundry.utils.randomID?.() || String(Date.now());
    const timer = setTimeout(() => {
      reactionWaiters.delete(requestId);
      resolve(0);
    }, 12000);
    reactionWaiters.set(requestId, (cs) => {
      clearTimeout(timer);
      resolve(cs);
    });
    game.socket.emit("system.faserip", {
      system: "workflow",
      action: "reaction-ask",
      requestId,
      targetId: target.id,
      targetName: target.name,
      attackLabel,
      choices,
      clearAfter: true
    });
  });
}

export function clearUserTargets() {
  if (!workflowActive("clearTargets")) return;
  try { game.user?.updateTokenTargets?.([]); } catch {}
}
