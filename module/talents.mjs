import { shiftRank } from "./config.mjs";

/**
 * Talent bonuses. The shift applies only where that talent's gloss says it does.
 * A weapon talent does not add to unarmed Fighting, and Guns does not add to a bow.
 */

const CARE = new Set(["first aid", "medicine", "emergency medicine", "surgery"]);

export function talentKey(name) {
  return String(name || "")
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/[—–]/g, " ")
    .replace(/[/\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function hasTalent(actor, key) {
  const want = talentKey(key);
  return [...(actor?.items ?? [])].some((item) => item.type === "talent" && talentKey(item.name) === want);
}

function focusOf(item) {
  return item?.getFlag?.("faserip", "focus") || item?.flags?.faserip?.focus || "";
}

function weaponKind(item) {
  const name = String(item?.name || "");
  if (/bow|crossbow|longbow|shortbow/i.test(name)) return "bow";
  if (/gun|pistol|rifle|firearm|revolver|shotgun|carbine|\bsmg\b/i.test(name)) return "gun";
  if (/laser|blaster|stunner|energy weapon/i.test(name)) return "energy";
  if (/cannon|tripod|launcher|heavy weapon/i.test(name)) return "heavy";
  if (/shuriken|sai|nunchaku|tonfa|katana|wakizashi|kusarigama/i.test(name)) return "oriental";
  return "";
}

function isSelf(attack, talent) {
  return !!(attack && talent && attack.id && attack.id === talent.id);
}

export function namedTalentShift(talent, { effectsColumn = "", attack = null, sourceColumn = "" } = {}) {
  const key = talentKey(talent?.name);
  const column = effectsColumn || "";
  const kind = weaponKind(attack);
  const self = isSelf(attack, talent);
  const armed = attack?.type === "weapon";
  const power = attack?.type === "power";
  let cs = 0;
  if (key === "guns" || key === "law enforcement") {
    const rangedGun = column === "shooting" && kind !== "bow" && kind !== "energy" && kind !== "heavy";
    if (rangedGun && (self || !attack || kind === "gun" || armed)) cs = 1;
  } else if (key === "bows") {
    if (column === "shooting" && (self || kind === "bow")) cs = 1;
  } else if (key === "marksman") {
    if (column === "shooting") cs = 1;
  } else if (key === "heavy weapons") {
    if (column === "shooting" && (self || kind === "heavy")) cs = 1;
  } else if (key === "energy weapons") {
    if (column === "energy" && (self || kind === "energy")) cs = 1;
  } else if (key === "thrown weapons") {
    if (!power && (column === "throwEdged" || column === "throwBlunt")) cs = 1;
  } else if (key === "thrown objects") {
    if (!power && (column === "throwEdged" || column === "throwBlunt" || column === "catching")) cs = 1;
  } else if (key === "blunt weapons") {
    if (column === "blunt" && (self || armed)) cs = 1;
  } else if (key === "sharp weapons") {
    if (column === "edged" && !power && (self || armed || !attack)) cs = 1;
  } else if (key === "weapons master" || key === "ancient weapons") {
    if ((column === "blunt" || column === "edged") && (self || armed)) cs = 1;
  } else if (key === "oriental weapons") {
    if ((self || kind === "oriental") && (column === "edged" || column === "blunt" || column === "throwEdged" || column === "throwBlunt")) cs = 1;
  } else if (key === "weapons specialist") {
    const focus = focusOf(talent).trim().toLowerCase();
    const name = String(attack?.name || "").toLowerCase();
    if (focus && column && (self || name.includes(focus))) cs = 2;
  } else if (key === "martial arts b") {
    if (column === "blunt" && !armed) cs = 1;
  } else if (key === "martial arts c") {
    if (column === "grappling" || column === "escaping" || column === "dodging") cs = 1;
  } else if (key === "wrestling") {
    if (column === "grappling") cs = 2;
  } else if (key === "acrobatics") {
    if (column === "dodging" || column === "evading" || column === "escaping") cs = 1;
  } else if (key === "martial arts f") {
    if (column === "blocking" || column === "slamCheck" || column === "stunCheck") cs = 1;
  } else if (key === "martial arts l") {
    const slugfest = !sourceColumn || sourceColumn === "blunt";
    if (slugfest && (column === "slamCheck" || column === "stunCheck")) cs = 1;
  } else if (key === "martial arts m") {
    if (column === "evading") cs = 1;
  } else if (key === "martial arts h") {
    if (self && !column) cs = 2;
  } else if (HANDLED.has(key)) {
    return { handled: true, cs: 0, note: "" };
  } else {
    return { handled: false, cs: 0, note: "" };
  }
  if (!cs) return { handled: true, cs: 0, note: "" };
  const note = cs > 0 ? `${talent.name} +${cs} CS` : `${talent.name} ${cs} CS`;
  return { handled: true, cs, note };
}

export function namedInitiative(talent) {
  const key = talentKey(talent?.name);
  if (key === "martial arts e" || key === "quick striking" || key === "weapons specialist") {
    return { handled: true, cs: 1 };
  }
  if (HANDLED.has(key)) return { handled: true, cs: 0 };
  return { handled: false, cs: 0 };
}

const HANDLED = new Set([
  "guns", "law enforcement", "bows", "marksman", "heavy weapons", "energy weapons",
  "thrown weapons", "thrown objects", "blunt weapons", "sharp weapons", "fencing",
  "weapons master", "ancient weapons", "oriental weapons", "weapons specialist",
  "martial arts b", "martial arts c", "wrestling", "acrobatics", "martial arts f",
  "martial arts l",   "martial arts m", "evading", "martial arts n", "martial arts e",
  "martial arts h", "quick striking"
]);

export function talentIsHandled(name) {
  return HANDLED.has(talentKey(name));
}

export function resistTalentShift(actor) {
  return hasTalent(actor, "resist domination") ? 1 : 0;
}

export function shiftedResistRank(actor, rankId) {
  const extra = resistTalentShift(actor);
  return extra ? shiftRank(rankId, extra) : rankId;
}

async function choose(title, content, buttons) {
  const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) return buttons[0]?.action || "";
  const result = await DialogV2.wait({
    window: { title },
    content: `<p>${content}</p>`,
    buttons: buttons.map((button, index) => ({
      action: button.action,
      label: button.label,
      default: index === 0,
      callback: () => button.action
    })),
    rejectClose: false
  });
  if (!result || result === "cancel") return "";
  return result;
}

async function nameWeapon(item) {
  const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
  const current = focusOf(item);
  if (!DialogV2?.wait) return "done";
  const form = await DialogV2.wait({
    window: { title: item.name },
    content: `<label>Weapon name <input name="weapon" type="text" value="${String(current).replace(/"/g, "&quot;")}" /></label>`,
    buttons: [
      { action: "save", label: "Save", default: true, callback: (_event, button) => button.form },
      { action: "cancel", label: "Cancel" }
    ],
    rejectClose: false
  });
  if (!form || form === "cancel") return "done";
  const weapon = String(form.elements?.weapon?.value || form.querySelector?.('[name="weapon"]')?.value || "").trim();
  if (!weapon) return "done";
  try { await item.setFlag("faserip", "focus", weapon); } catch (err) {
    console.warn("FASERIP | talent", err);
    return "done";
  }
  globalThis.ui?.notifications?.info(`${item.name} is ${weapon}. Those attacks are +2 CS, and initiative is +1.`);
  return "done";
}

async function care(actor, item) {
  const { combatTarget } = await import("./play-rules.mjs");
  const { readBattle, aidDying } = await import("./battle-results.mjs");
  const aimed = combatTarget(actor?.id || "");
  const target = readBattle(aimed)?.state === "dying" ? aimed : (readBattle(actor)?.state === "dying" ? actor : null);
  if (!target) return "roll";
  const mode = await choose(item.name, `${target.name} is dying.`, [
    { action: "stabilize", label: "Stabilize" },
    { action: "roll", label: "Roll the skill" },
    { action: "cancel", label: "Cancel" }
  ]);
  if (mode === "stabilize") {
    await aidDying(target);
    return "done";
  }
  if (mode === "roll") return "roll";
  return "done";
}

export async function prepareTalent(actor, item) {
  const key = talentKey(item?.name);
  if (key === "weapons specialist") return nameWeapon(item);
  if (CARE.has(key)) return care(actor, item);
  return "roll";
}
