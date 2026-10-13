import { rankValue } from "./config.mjs";
import { combatOn } from "./combat-rules.mjs";
import { worldDay } from "./clock.mjs";
import { promptForm } from "./foundry-api.mjs";
import { actorFromRef, sceneActorChoices } from "./play-rules.mjs";

const REGIONS = ["torso", "arm", "leg", "head"];
const ARM = new Set(["blunt", "edged", "shooting", "throwEdged", "throwBlunt", "grabbing"]);
const LEG = new Set(["charging"]);
const TORSO = new Set(["grappling"]);
const TALENT = /first aid|medicine/i;

const PART = {
  torso: "torso",
  arm: "arm",
  leg: "leg",
  head: "head"
};

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

export function breakQualifies(damage, maxHealth) {
  const max = Number(maxHealth) || 0;
  const hit = Number(damage) || 0;
  if (!(max > 0) || !(hit > 0)) return false;
  return hit >= max / 2;
}

export function regionFromRoll(total) {
  const index = (Number(total) || 1) - 1;
  return REGIONS[index] || "torso";
}

export function cleanPart(value) {
  return String(value || "").replace(/[<>]/g, "").trim().slice(0, 40);
}

export function readBreak(actor) {
  if (!combatOn("combatBreak")) return null;
  const flag = actor?.getFlag?.("faserip", "break") || actor?.flags?.faserip?.break || null;
  if (!flag || !REGIONS.includes(flag.region)) return null;
  return flag;
}

export function hasBoneTalent(actor) {
  for (const item of actor?.items ?? []) {
    if (item?.type === "talent" && TALENT.test(String(item.name || ""))) return true;
  }
  return false;
}

export function setPlan(flag, enduranceNumber, health, day) {
  const number = Number(enduranceNumber) || 0;
  const base = {
    region: flag.region,
    part: flag.part || "",
    set: true,
    damage: Number(flag.damage) || 0,
    lastHealth: Number(health) || 0
  };
  if (number >= 50) {
    return { ...base, mode: "regain", need: base.damage, gained: 0, mendDay: 0 };
  }
  return { ...base, mode: "days", need: 0, gained: 0, mendDay: Number(day) + Math.max(0, 50 - number) };
}

export function applyHeal(flag, before, after) {
  if (!flag?.set || flag.mode !== "regain") return { flag, mended: false };
  const gained = (Number(flag.gained) || 0) + Math.max(0, Number(after) - Number(before));
  const next = { ...flag, gained, lastHealth: Number(after) || 0 };
  const need = Number(flag.need) || 0;
  return { flag: next, mended: need > 0 && gained >= need };
}

export function daysDue(flag, day) {
  return !!(flag?.set && flag.mode === "days" && Number(day) >= Number(flag.mendDay));
}

export function breakSentence(flag, day = 0) {
  if (!flag) return "";
  const part = flag.part || PART[flag.region] || "part";
  const easy = " Treat that part as easier to hurt again until it mends.";
  if (!flag.set) return `Broken ${part}. It stays useless until First Aid or Medicine sets it.${easy}`;
  if (flag.mode === "regain") {
    const got = Number(flag.gained) || 0;
    const need = Number(flag.need) || 0;
    return `Broken ${part}, set. ${got} of ${need} Health regained.${easy}`;
  }
  const left = Math.max(0, (Number(flag.mendDay) || 0) - Number(day));
  if (!left) return "";
  const unit = left === 1 ? "day" : "days";
  return `Broken ${part}, set. ${left} ${unit} left.${easy}`;
}

export function breakNote(actor) {
  return breakSentence(readBreak(actor), worldDay());
}

export function breakIsSet(actor) {
  return !!readBreak(actor)?.set;
}

export function boneDenial(actor, columnId = "", abilityId = "", isCheck = false) {
  if (isCheck) return "";
  const flag = readBreak(actor);
  if (!flag) return "";
  const name = actor?.name || "They";
  const part = flag.part || PART[flag.region] || "part";
  if (flag.region === "arm" && ARM.has(columnId)) return `${name}'s ${part} is broken. That attack waits until it mends.`;
  if (flag.region === "leg" && LEG.has(columnId)) return `${name}'s ${part} is broken. A charge waits until it mends.`;
  if (flag.region === "torso" && (abilityId === "strength" || TORSO.has(columnId))) {
    return `${name}'s ${part} is broken. Strength and grapples wait until it mends.`;
  }
  if (flag.region === "head" && abilityId === "intuition") return `${name}'s ${part} is broken. Intuition waits until it mends.`;
  return "";
}

export function breakPace(actor) {
  const flag = readBreak(actor);
  return flag?.region === "leg" ? 1 : null;
}

export async function clearIfMended(actor) {
  const flag = readBreak(actor);
  if (!daysDue(flag, worldDay())) return false;
  if (!actor?.unsetFlag) return false;
  await actor.unsetFlag("faserip", "break");
  ui.notifications?.info(`${actor.name}'s break has mended.`);
  return true;
}

function healerChoices(injured) {
  const list = [];
  const seen = new Set();
  const add = (actor, label) => {
    if (!actor || seen.has(actor.id) || !hasBoneTalent(actor)) return;
    seen.add(actor.id);
    list.push({ id: actor.uuid || actor.id, name: label || actor.name, actor });
  };
  add(injured, injured?.name);
  for (const choice of sceneActorChoices()) add(actorFromRef(choice.id), choice.name);
  return list;
}

async function rollD4() {
  try {
    const roll = new Roll("1d4");
    await roll.evaluate();
    return Number(roll.total) || 1;
  } catch {
    return 1 + Math.floor(Math.random() * 4);
  }
}

async function askRegion() {
  const form = await promptForm({
    title: "Where did it break?",
    okLabel: "Break it",
    content: `
      <label>Part <input name="part" type="text" placeholder="Leave blank to use the region" /></label>
      <label>Region
        <select name="region">
          <option value="arm">Arm</option>
          <option value="leg">Leg</option>
          <option value="torso">Torso</option>
          <option value="head">Head</option>
          <option value="random">Random</option>
        </select>
      </label>`
  });
  if (!form) return null;
  const data = new FormData(form);
  let region = String(data.get("region") || "arm");
  let part = cleanPart(data.get("part"));
  if (region === "random") {
    region = regionFromRoll(await rollD4());
    part = "";
  }
  if (!REGIONS.includes(region)) region = "torso";
  return { region, part };
}

export async function promptBoneBreak(message) {
  if (!combatOn("combatBreak")) return;
  if (message.getFlag?.("faserip", "boneChecked") || message.flags?.faserip?.boneChecked) {
    ui.notifications?.info("This hit was already checked for a break.");
    return;
  }
  const flags = message.getFlag?.("faserip") || message.flags?.faserip || {};
  const target = actorFromRef(flags.targetUuid || flags.targetId);
  if (!target) {
    ui.notifications?.warn("That hit has no target.");
    return;
  }
  const damage = Number(flags.damageAmount) || 0;
  const max = Number(target.system?.health?.max) || 0;
  if (!breakQualifies(damage, max)) {
    ui.notifications?.warn("That hit is under half of their full Health.");
    return;
  }
  const { rollFeat } = await import("./dice/universal-table.mjs");
  const card = await rollFeat({
    actor: target,
    rankId: target.getAbilityRank?.("endurance") || "typical",
    label: "Endurance",
    abilityId: "endurance",
    boneCheck: true,
    fearCheck: true,
    skipCondition: true
  });
  if (!card) return;
  const color = card.getFlag?.("faserip", "color") || card.flags?.faserip?.color || "";
  try { await message.setFlag("faserip", "boneChecked", true); } catch { /* the card still records the roll */ }
  if (color !== "white") {
    ui.notifications?.info(`${target.name} is sore. Nothing broke.`);
    return;
  }
  const picked = await askRegion();
  const rolled = picked || { region: regionFromRoll(await rollD4()), part: "" };
  const flag = {
    region: rolled.region,
    part: rolled.part,
    set: false,
    mode: "",
    damage,
    need: 0,
    gained: 0,
    mendDay: 0,
    lastHealth: Number(target.system?.health?.value) || 0
  };
  await target.setFlag("faserip", "break", flag);
  const sentence = breakSentence(flag, worldDay());
  await ChatMessage.create({ content: `<p><strong>${esc(target.name)}</strong>. ${esc(sentence)}</p>` });
  ui.notifications?.warn(sentence);
}

export async function promptSetBone(actor) {
  if (!combatOn("combatBreak")) return;
  const flag = readBreak(actor);
  if (!flag) {
    ui.notifications?.warn(`${actor?.name || "They"} has no break to set.`);
    return;
  }
  if (flag.set) {
    ui.notifications?.info("The break is already set.");
    return;
  }
  const healers = healerChoices(actor);
  let healerName = "";
  if (!healers.length) {
    if (!globalThis.game?.user?.isGM) {
      ui.notifications?.warn("A First Aid or Medicine talent has to set this.");
      return;
    }
    healerName = "The Judge";
  } else if (healers.length === 1) {
    healerName = healers[0].name;
  } else {
    const form = await promptForm({
      title: "Set the bone",
      okLabel: "Set it",
      content: `<label>Who sets it
        <select name="healer">${healers.map((row) => `<option value="${esc(row.id)}">${esc(row.name)}</option>`).join("")}</select>
      </label>`
    });
    if (!form) return;
    const id = String(new FormData(form).get("healer") || "");
    const picked = healers.find((row) => row.id === id);
    if (!picked) return;
    healerName = picked.name;
  }
  const next = setPlan(flag, rankValue(actor.getAbilityRank?.("endurance")), actor.system?.health?.value, worldDay());
  await actor.setFlag("faserip", "break", next);
  const sentence = breakSentence(next, worldDay());
  ui.notifications?.info(`${healerName} sets the break. ${sentence}`);
}

async function onHealth(actor, changes, _options, userId) {
  if (globalThis.game?.user?.id !== userId) return;
  const after = changes?.system?.health?.value;
  if (after == null) return;
  const flag = readBreak(actor);
  if (!flag?.set || flag.mode !== "regain") return;
  const result = applyHeal(flag, flag.lastHealth, after);
  if (result.mended) {
    await actor.unsetFlag("faserip", "break");
    ui.notifications?.info(`${actor.name}'s break has mended.`);
    return;
  }
  if ((Number(result.flag.gained) || 0) !== (Number(flag.gained) || 0) || Number(result.flag.lastHealth) !== Number(flag.lastHealth)) {
    await actor.setFlag("faserip", "break", result.flag);
  }
}

async function onDay() {
  if (!globalThis.game?.user?.isGM || !combatOn("combatBreak")) return;
  for (const actor of globalThis.game.actors ?? []) {
    try { await clearIfMended(actor); }
    catch (err) { console.warn("FASERIP | bone break", err); }
  }
}

export function registerBoneBreak() {
  const Hooks = globalThis.Hooks;
  if (!Hooks || Hooks._faseripBone) return;
  Hooks._faseripBone = true;
  Hooks.on("updateActor", (actor, changes, options, userId) => {
    onHealth(actor, changes, options, userId).catch((err) => console.warn("FASERIP | bone break", err));
  });
  Hooks.on("updateWorldTime", () => {
    onDay().catch((err) => console.warn("FASERIP | bone break", err));
  });
}
