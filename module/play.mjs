import { BATTLE_EFFECTS } from "./config.mjs";
import { promptForm, formValue } from "./foundry-api.mjs";
import { actorFromRef, attackDamageNumber, checkForEffect, effectDealsDamage, pendingFromDefense, readPending, writePending } from "./play-rules.mjs";
import { powerDamage } from "./item-actions.mjs";
import { workflowActive, workflowOn } from "./workflow.mjs";
import { playComicHit } from "./comic-hit.mjs";
import { effectGetsThrough, soakAmount } from "./battle-results.mjs";

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

function chainClient(message) {
  const gm = game.users.find((user) => user.active && user.isGM);
  if (gm) return game.user.id === gm.id;
  return message.author?.id === game.user.id;
}

export async function openCombatChain(message) {
  if (!chainClient(message) || !workflowOn("workflowEnabled")) return;
  const targetId = message.getFlag?.("faserip", "targetId") ?? message.flags?.faserip?.targetId;
  const targetUuid = message.getFlag?.("faserip", "targetUuid") ?? message.flags?.faserip?.targetUuid;
  const damageAmount = message.getFlag?.("faserip", "damageAmount") ?? message.flags?.faserip?.damageAmount;
  const checkColumn = message.getFlag?.("faserip", "checkColumn") ?? message.flags?.faserip?.checkColumn;
  const alreadyApplied = !!(message.getFlag?.("faserip", "damageApplied") ?? message.flags?.faserip?.damageApplied);
  if ((!targetId && !targetUuid) || (damageAmount == null && !checkColumn)) return;
  const target = actorFromRef(targetUuid || targetId);
  if (!target) return;
  const energyDefault = !!(message.getFlag?.("faserip", "damageEnergy") ?? message.flags?.faserip?.damageEnergy);

  const blocked = !!(message.getFlag?.("faserip", "effectBlocked") ?? message.flags?.faserip?.effectBlocked);
  let through = !blocked;
  if (damageAmount != null && workflowActive("autoApplyDamage") && !alreadyApplied) {
    if (target.isOwner || game.user.isGM) {
      const useForceField = workflowActive("preferForceField") && Number(target.getForceField?.() || 0) > 0;
      const bonusArmor = Number(message.getFlag?.("faserip", "bonusArmor") ?? message.flags?.faserip?.bonusArmor ?? 0);
      const protection = soakAmount(target, { energy: energyDefault, useForceField, bonusArmor: useForceField ? 0 : bonusArmor });
      const taken = await target.applyDamage(Number(damageAmount) || 0, { energy: energyDefault, useForceField, protection });
      through = effectGetsThrough(Number(damageAmount) || 0, protection, taken);
      try {
        await message.setFlag("faserip", "damageApplied", true);
        if (!through) await message.setFlag("faserip", "effectBlocked", true);
      } catch {}
      ui.notifications.info(`${target.name} loses ${taken} Health.`);
      playComicHit({
        targetUuid: target.uuid,
        columnId: message.getFlag?.("faserip", "effectsColumn") ?? message.flags?.faserip?.effectsColumn,
        color: message.getFlag?.("faserip", "color") ?? message.flags?.faserip?.color,
        effect: message.getFlag?.("faserip", "effect") ?? message.flags?.faserip?.effect,
        taken
      });
      if (Number(target.system?.health?.value) === 0 && through && checkColumn !== "stunCheck" && checkColumn !== "killCheck") {
        const { collapseAtZero } = await import("./battle-results.mjs");
        await collapseAtZero(target);
      }
    } else {
      ui.notifications.warn(`Only the Judge can apply damage to ${target.name}. Use the button on the chat card.`);
    }
  }

  if (through && checkColumn && workflowActive("autoEnduranceCheck") && BATTLE_EFFECTS[checkColumn]) {
    const { rollFeat } = await import("./dice/universal-table.mjs");
    await rollFeat({
      actor: target,
      rankId: target.getAbilityRank("endurance"),
      label: BATTLE_EFFECTS[checkColumn].label,
      effectsColumn: checkColumn,
      holdPending: true,
      skipCondition: true,
      resultOf: {
        attackerId: message.getFlag?.("faserip", "attackerId") ?? message.flags?.faserip?.attackerId ?? "",
        strengthRank: message.getFlag?.("faserip", "strengthRank") ?? message.flags?.faserip?.strengthRank ?? "",
        sourceColumn: message.getFlag?.("faserip", "effectsColumn") ?? message.flags?.faserip?.effectsColumn ?? ""
      }
    });
  }
}

export async function applyDamageFromChat(message) {
  const targetId = message.getFlag?.("faserip", "targetId");
  const targetUuid = message.getFlag?.("faserip", "targetUuid");
  const target = actorFromRef(targetUuid || targetId);
  if (!target) return;
  if (!target.isOwner && !game.user.isGM) {
    ui.notifications.warn("Only the Judge can apply this damage.");
    return;
  }
  if (message.getFlag("faserip", "damageApplied")) {
    ui.notifications.info(`Damage was already applied to ${target.name}.`);
    return;
  }
  const amount = Number(message.getFlag("faserip", "damageAmount") || 0);
  const energy = !!message.getFlag("faserip", "damageEnergy");
  const bonusArmor = Number(message.getFlag("faserip", "bonusArmor") || 0);
  const protection = soakAmount(target, { energy, bonusArmor });
  const taken = await target.applyDamage(amount, { energy, protection });
  const through = effectGetsThrough(amount, protection, taken);
  try {
    await message.setFlag("faserip", "damageApplied", true);
    if (!through) await message.setFlag("faserip", "effectBlocked", true);
  } catch {}
  ui.notifications.info(`${target.name} loses ${taken} Health.`);
  playComicHit({
    targetUuid: target.uuid,
    columnId: message.getFlag?.("faserip", "effectsColumn"),
    color: message.getFlag?.("faserip", "color"),
    effect: message.getFlag?.("faserip", "effect"),
    taken
  });
  const checkColumn = message.getFlag("faserip", "checkColumn");
  if (through && Number(target.system?.health?.value) === 0 && checkColumn !== "stunCheck" && checkColumn !== "killCheck") {
    const { collapseAtZero } = await import("./battle-results.mjs");
    await collapseAtZero(target);
  }
}

export async function checkFromChat(message) {
  if (message.getFlag?.("faserip", "effectBlocked")) {
    ui.notifications?.info("The hit did not get through. No Slam, Stun, or Kill check.");
    return;
  }
  const target = actorFromRef(message.getFlag?.("faserip", "targetUuid") || message.getFlag?.("faserip", "targetId"));
  const checkColumn = message.getFlag?.("faserip", "checkColumn");
  if (!target || !BATTLE_EFFECTS[checkColumn]) return;
  const { promptFeatRoll } = await import("./dice/universal-table.mjs");
  return promptFeatRoll({
    actor: target,
    rankId: target.getAbilityRank("endurance"),
    label: BATTLE_EFFECTS[checkColumn].label,
    defaultColumn: checkColumn,
    holdPending: true,
    resultOf: {
      attackerId: message.getFlag?.("faserip", "attackerId") || "",
      strengthRank: message.getFlag?.("faserip", "strengthRank") || "",
      sourceColumn: message.getFlag?.("faserip", "effectsColumn") || ""
    }
  });
}

export function bindFeatChat(message, html) {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root?.querySelectorAll) return;
  root.querySelector("[data-faserip-apply]")?.addEventListener("click", (event) => {
    event.preventDefault();
    applyDamageFromChat(message);
  });
  root.querySelector("[data-faserip-check]")?.addEventListener("click", (event) => {
    event.preventDefault();
    checkFromChat(message);
  });
}

export function combatFlags({ actor, item, target, columnId, effect }) {
  const flags = {};
  if (target) {
    flags.targetId = target.id;
    flags.targetUuid = target.uuid || "";
    flags.targetName = target.name;
  }
  const checkColumn = checkForEffect(effect);
  if (checkColumn) flags.checkColumn = checkColumn;
  if (effectDealsDamage(columnId, effect)) {
    flags.damageAmount = item?.type === "power" ? powerDamage(item) : attackDamageNumber(actor, item, columnId);
    flags.damageEnergy = columnId === "energy";
  }
  return flags;
}

export async function settleShifts({ actor, target, columnId, effect, consumeOutgoing, consumeIncoming }) {
  const defense = pendingFromDefense(columnId, effect);
  const same = actor && target && actor.id === target.id;
  if (target && consumeIncoming && !same) {
    const pending = readPending(target);
    await writePending(target, { ...pending, incomingCs: 0, incomingNote: "" });
  }
  if (!actor) return;
  const pending = readPending(actor);
  const next = { ...pending };
  let changed = false;
  if (consumeOutgoing) {
    next.nextCs = 0;
    next.nextNote = "";
    changed = true;
  }
  if (same && consumeIncoming) {
    next.incomingCs = 0;
    next.incomingNote = "";
    changed = true;
  }
  if (defense) {
    Object.assign(next, defense);
    changed = true;
  }
  if (changed) await writePending(actor, next);
}

function selectedActorIds() {
  const ids = new Set();
  for (const token of canvas?.tokens?.controlled ?? []) {
    if (token.actor) ids.add(token.actor.id);
  }
  return ids;
}

export async function promptJudgeAward(preselect = []) {
  if (!game.user.isGM) {
    ui.notifications.warn("Only the Judge can award Karma and Popularity.");
    return null;
  }
  const preferred = new Set([...preselect, ...selectedActorIds()]);
  const actors = game.actors.filter((actor) => actor.type === "hero" || actor.type === "npc");
  if (!actors.length) {
    ui.notifications.warn("No heroes or NPCs to award.");
    return null;
  }
  const checks = actors.map((actor) => `
    <label class="check"><input type="checkbox" name="actor" value="${actor.id}" ${preferred.has(actor.id) ? "checked" : ""}/> ${esc(actor.name)}</label>
  `).join("");
  const form = await promptForm({
    title: "Judge award",
    okLabel: "Award",
    width: 420,
    content: `
      <p class="hint">Selected tokens start checked. Use a negative number to reduce Karma or Popularity.</p>
      <div class="form-group"><label>Karma<input type="number" name="karma" value="0" step="1" /></label></div>
      <div class="form-group"><label>Hero Popularity<input type="number" name="popularity" value="0" step="1" /></label></div>
      <div class="form-group"><label>Secret Popularity<input type="number" name="secret" value="0" step="1" /></label></div>
      <div class="award-list">${checks}</div>
    `
  });
  if (!form) return null;
  const karma = Number(formValue(form, "karma") || 0);
  const popularity = Number(formValue(form, "popularity") || 0);
  const secret = Number(formValue(form, "secret") || 0);
  const ids = [...form.querySelectorAll('[name="actor"]:checked')].map((el) => el.value);
  if (!ids.length) {
    ui.notifications.warn("Choose at least one character.");
    return null;
  }
  const names = [];
  for (const id of ids) {
    const actor = game.actors.get(id);
    if (!actor) continue;
    const update = {};
    if (karma) update["system.karma.value"] = Math.max(0, Number(actor.system.karma?.value || 0) + karma);
    if (popularity) update["system.popularity.value"] = Number(actor.system.popularity?.value || 0) + popularity;
    if (secret) update["system.popularity.secret"] = Number(actor.system.popularity?.secret || 0) + secret;
    if (Object.keys(update).length) await actor.update(update);
    names.push(actor.name);
  }
  const parts = [];
  if (karma) parts.push(`${karma > 0 ? "+" : ""}${karma} Karma`);
  if (popularity) parts.push(`${popularity > 0 ? "+" : ""}${popularity} Hero Popularity`);
  if (secret) parts.push(`${secret > 0 ? "+" : ""}${secret} Secret Popularity`);
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker(),
    content: `<div class="faserip-chat"><header><span class="feat-label">Judge award</span></header><p>${esc(parts.join(", ") || "No change")} — ${esc(names.join(", "))}</p></div>`
  });
  ui.notifications.info(`Awarded ${names.length} character${names.length === 1 ? "" : "s"}.`);
  return names;
}
