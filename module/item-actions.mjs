import { BATTLE_EFFECTS, rankLabel, rankValue } from "./config.mjs";
import { ATTACK_COLUMNS, DAMAGE_COLUMNS, abilityForColumn, combatTarget } from "./play-rules.mjs";
import { shiftPlan, workflowActive, workflowOn, offerDefenseReaction, clearUserTargets } from "./workflow.mjs";

function keyOf(name) {
  return String(name || "")
    .replace(/\s*\(counts as two[^)]*\)/gi, "")
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/[—–]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const COLUMN_ALIAS = {
  wrestling: "grappling",
  slugfest: "blunt",
  blasting: "energy"
};

function canonicalColumn(columnId) {
  const raw = String(columnId || "").trim();
  if (!raw) return "";
  if (BATTLE_EFFECTS[raw]) return raw;
  return COLUMN_ALIAS[raw] || COLUMN_ALIAS[raw.toLowerCase()] || "";
}

function action(partial) {
  const column = canonicalColumn(partial.column);
  const kind = partial.kind || (column && (ATTACK_COLUMNS.has(column) || DAMAGE_COLUMNS.has(column) || column === "dodging" || column === "evading" || column === "blocking") ? "attack" : "feat");
  const ability = partial.ability || abilityForColumn(column, "reason");
  let label = "FEAT";
  if (column === "dodging") label = "Dodge";
  else if (column === "evading") label = "Evade";
  else if (column === "blocking") label = "Block";
  else if (kind === "attack") label = "Attack";
  return {
    kind,
    column,
    ability,
    rankFrom: partial.rankFrom || "ability",
    label,
    title: label === "FEAT"
      ? "Roll a FEAT. Shift-click to set Karma or Intensity."
      : "Roll against the targeted token. Shift-click to set Karma or a column shift."
  };
}

function powerAction(name) {
  const key = keyOf(name);
  if (/force field|body armor|armor skin|body resistance|true invulnerability|resist|invulnerab|reflection|absorption power|energy sponge|regenerat|healing|life support|self-sustenance|waterbreath|water breath|immortal|recovery/.test(key)) {
    return action({ kind: "feat", rankFrom: "item", ability: featAbility(key) });
  }
  if (/image generation|weapons creation|animate image|illusion/.test(key)) {
    return action({ kind: "feat", rankFrom: "item", ability: featAbility(key) });
  }
  if (/\bdetect|detection|vision|senses|awareness|hearing|sight|sonar|radar|tracking|empathy/.test(key)) {
    return action({ kind: "feat", rankFrom: "item", ability: featAbility(key) });
  }
  const attacks = [
    [/ensnar|webcast|webbing/, "grappling"],
    [/nullifier/, ""],
    [/slashing/, "throwEdged"],
    [/mind blast|psionic attack|mind drain/, "force"],
    [/corrosive missile/, "energy"],
    [/stunning|paralyz|rotting touch|blinding touch|health-drain|corrosive touch|chemical touch/, "force"],
    [/projectile|missile creation/, "shooting"],
    [/claw|natural weaponry|unique weapon/, "edged"],
    [/berserker|martial supremacy/, "blunt"],
    [/vampirism|disruption/, "force"],
    [/telekinesis/, "force"],
    [/plant control|plant growth/, "grappling"],
    [/air control|earth control|fire control|water control|weather control|^weather$|electrical (manipulation|control)|sound manipulation|magnetic|darkforce|gravity|light (manipulation|control)|plasma control|coldshaping|thermal control|vibration control|kinetic control|shadowcasting|shadowshaping|geoforce|combustion|disintegration/, "energy"],
    [/generation|emission|\bbolt\b|\bblast\b|^heat$|hard radiation|sonic|^magnetism$|^vibration$|spray|energy touch/, "energy"]
  ];
  for (const [re, column] of attacks) {
    if (!re.test(key)) continue;
    if (!column) return action({ kind: "feat", rankFrom: "item", ability: featAbility(key) });
    return action({ kind: "attack", column, rankFrom: "item", ability: abilityForColumn(column, "agility") });
  }
  return action({ kind: "feat", rankFrom: "item", ability: featAbility(key) });
}

function featAbility(key) {
  if (/mental|psych|telepath|emotion|mind|psi|magic|hypno|spirit|astral/.test(key)) return "psyche";
  if (/detect|sense|vision|track|awareness|hear|sight|sonar|radar|empathy/.test(key)) return "intuition";
  if (/fight|martial|weapon|claw|strength/.test(key)) return "fighting";
  if (/speed|flight|leap|swim|climb|agility|pilot/.test(key)) return "agility";
  return "reason";
}

function talentColumn(key) {
  if (/wrestling/.test(key)) return "grappling";
  if (/martial arts f/.test(key)) return "blocking";
  if (/martial arts m|^evading$/.test(key)) return "evading";
  if (/acrobatic|^dodging$/.test(key)) return "dodging";
  if (/martial arts c/.test(key)) return "grappling";
  if (/energy weapon/.test(key)) return "energy";
  if (/gun|bows?|marksman|heavy weapon/.test(key)) return "shooting";
  if (/thrown object/.test(key)) return "throwBlunt";
  if (/thrown/.test(key)) return "throwEdged";
  if (/blunt weapon|martial arts [abdjkn]|quick-striking/.test(key)) return "blunt";
  if (/sharp|fencing|oriental|ancient weapon|paired weapon|weapons master|weapons specialist|unique weapon/.test(key)) return "edged";
  return "";
}

function talentAbility(key, column) {
  if (/gun|bow|marksman|thrown|energy weapon|heavy weapon|acrobatic|dodg/.test(key)) return "agility";
  if (/wrestling/.test(key)) return "strength";
  if (column) return abilityForColumn(column, "fighting");
  return "";
}

function abilityFromText(attribute, category, key) {
  const blob = `${attribute} ${category} ${key}`.toLowerCase();
  if (/piloting|pilot|vehicle|agility/.test(blob)) return "agility";
  if (/fighting|weapon|martial/.test(blob)) return "fighting";
  if (/strength/.test(blob)) return "strength";
  if (/endurance/.test(blob)) return "endurance";
  if (/psyche|mystic|occult|trance|hypno|mesmer/.test(blob)) return "psyche";
  if (/intuition|detective|espionage|crime|leadership/.test(blob)) return "intuition";
  return "reason";
}

function talentAction(item) {
  const key = keyOf(item?.name);
  if (/martial arts [hl]/.test(key)) return action({ kind: "feat", ability: "endurance", rankFrom: "ability" });
  const column = talentColumn(key);
  const ability = talentAbility(key, column) || abilityFromText(item?.system?.attribute, item?.system?.category, key);
  if (column) return action({ kind: "attack", column, ability, rankFrom: "ability" });
  return action({ kind: "feat", ability, rankFrom: "ability" });
}

function gearAction(item) {
  const stored = canonicalColumn(item?.system?.effectsColumn);
  const column = stored || talentColumn(keyOf(item?.name)) || "blunt";
  const ability = abilityForColumn(column, "fighting");
  return action({ kind: "attack", column, ability, rankFrom: "ability" });
}

export function describeItemAction(item) {
  if (!item) return action({ kind: "feat", ability: "reason" });
  if (item.type === "talent") return talentAction(item);
  if (item.type === "weapon") return gearAction(item);
  if (item.type === "power") {
    const stored = canonicalColumn(item.system?.effectsColumn);
    if (stored) {
      return action({
        kind: "attack",
        column: stored,
        rankFrom: "item",
        ability: abilityForColumn(stored, "agility")
      });
    }
    return powerAction(item.name);
  }
  if (item.type === "equipment") return action({ kind: "feat", ability: "reason", rankFrom: "item" });
  return action({ kind: "feat", ability: "reason" });
}

export function rankIdForAction(actor, item, spec) {
  if (spec.rankFrom === "item") return item?.system?.rank || "typical";
  if (typeof actor?.getAbilityRank === "function") return actor.getAbilityRank(spec.ability || "reason");
  return "typical";
}

export function powerDamage(item) {
  const numbered = Number(item?.system?.number || 0);
  if (numbered > 0) return numbered;
  return rankValue(item?.system?.rank || "typical");
}

const ABILITY_NAMES = {
  fighting: "Fighting",
  agility: "Agility",
  strength: "Strength",
  endurance: "Endurance",
  reason: "Reason",
  intuition: "Intuition",
  psyche: "Psyche"
};

function abilityName(key) {
  return ABILITY_NAMES[key] || "Reason";
}

export const STANDARD_ACTIONS = [
  { group: "strikes", id: "slugfest", label: "Slugfest", detail: "Unarmed · Fighting", column: "blunt", ability: "fighting" },
  { group: "strikes", id: "edged", label: "Edged Attack", detail: "Fighting", column: "edged", ability: "fighting" },
  { group: "strikes", id: "charging", label: "Charging", detail: "Endurance", column: "charging", ability: "endurance" },
  { group: "ranged", id: "shooting", label: "Shooting", detail: "Agility", column: "shooting", ability: "agility" },
  { group: "ranged", id: "throwEdged", label: "Thrown Weapon", detail: "Agility", column: "throwEdged", ability: "agility" },
  { group: "ranged", id: "throwBlunt", label: "Thrown Object", detail: "Agility", column: "throwBlunt", ability: "agility" },
  { group: "ranged", id: "energy", label: "Energy Attack", detail: "Agility", column: "energy", ability: "agility" },
  { group: "ranged", id: "force", label: "Force Attack", detail: "Agility", column: "force", ability: "agility" },
  { group: "holds", id: "grappling", label: "Grappling", detail: "Strength", column: "grappling", ability: "strength" },
  { group: "holds", id: "grabbing", label: "Grabbing", detail: "Strength", column: "grabbing", ability: "strength" },
  { group: "holds", id: "escaping", label: "Escaping", detail: "Strength", column: "escaping", ability: "strength" },
  { group: "defense", id: "dodging", label: "Dodging", detail: "Agility · column shift", column: "dodging", ability: "agility" },
  { group: "defense", id: "evading", label: "Evading", detail: "Fighting · column shift", column: "evading", ability: "fighting" },
  { group: "defense", id: "blocking", label: "Blocking", detail: "Strength · armor shift", column: "blocking", ability: "strength" },
  { group: "defense", id: "catching", label: "Catching", detail: "Agility", column: "catching", ability: "agility" }
];

const ACTION_GROUPS = [
  { id: "strikes", label: "Strikes" },
  { id: "ranged", label: "Ranged" },
  { id: "holds", label: "Holds" },
  { id: "defense", label: "Defense" }
];

function actionCard(entry) {
  return {
    name: entry.label,
    detail: entry.detail,
    title: "Roll against the targeted token. Shift-click to set Karma or a column shift.",
    itemId: entry.itemId || "",
    standard: entry.standard || entry.id || ""
  };
}

export function sheetActionGroups(items = []) {
  const groups = ACTION_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    actions: STANDARD_ACTIONS.filter((entry) => entry.group === group.id).map((entry) => actionCard({ ...entry, standard: entry.id, itemId: "" }))
  }));
  const powers = [];
  const weapons = [];
  const talents = [];
  for (const item of items) {
    if (!item || (item.type !== "power" && item.type !== "weapon" && item.type !== "talent")) continue;
    const spec = describeItemAction(item);
    const rank = item.system?.rank ? rankLabel(item.system.rank) : "";
    const card = actionCard({
      label: item.name,
      detail: `${spec.label} · ${abilityName(spec.ability)}${rank ? ` · ${rank}` : ""}`,
      itemId: item.id,
      standard: ""
    });
    card.title = spec.title;
    if (item.type === "power") powers.push(card);
    else if (item.type === "weapon") weapons.push(card);
    else if (spec.column || /martial arts [hl]/i.test(item.name || "")) talents.push(card);
  }
  if (powers.length) groups.push({ id: "powers", label: "Powers", actions: powers });
  if (weapons.length) groups.push({ id: "weapons", label: "Weapons", actions: weapons });
  if (talents.length) groups.push({ id: "talents", label: "Talents", actions: talents });
  return groups;
}

export function defenseChoices(actor) {
  const seen = new Set();
  const choices = [];
  for (const item of actor?.items ?? []) {
    if (item.type !== "talent") continue;
    const spec = describeItemAction(item);
    if (!["dodging", "blocking", "evading"].includes(spec.column) || seen.has(spec.column)) continue;
    seen.add(spec.column);
    choices.push({ column: spec.column, ability: spec.ability, label: `${spec.label} (${item.name})` });
  }
  return choices;
}

export async function rollAction(actor, spec, { dialog = false, item = null, label = "" } = {}) {
  const name = label || item?.name || spec?.label || "FEAT";
  const { promptFeatRoll, rollFeat } = await import("./dice/universal-table.mjs");
  const fast = workflowActive("autoRollAttack") && (game.user?.isGM || workflowOn("playersFastForward"));
  if (dialog || !fast) {
    return promptFeatRoll({
      actor,
      item,
      ability: spec.ability,
      rankId: rankIdForAction(actor, item, spec),
      label: name,
      defaultColumn: spec.column
    });
  }
  const needsTarget = spec.kind === "attack" && ATTACK_COLUMNS.has(spec.column);
  const damaging = DAMAGE_COLUMNS.has(spec.column);
  const target = needsTarget ? combatTarget(actor?.id) : null;
  if (damaging && !target) {
    ui.notifications?.warn(`Target a token before ${name} so damage can land.`);
    if (workflowActive("requireTarget")) return null;
  }
  const reactionCs = target && damaging ? await offerDefenseReaction(target, name) : 0;
  const plan = shiftPlan(actor, { ability: spec.ability, effectsColumn: spec.column, target });
  const message = await rollFeat({
    actor,
    item,
    rankId: rankIdForAction(actor, item, spec),
    label: name,
    cs: plan.cs + reactionCs,
    effectsColumn: spec.column,
    targetId: target?.id || "",
    targetUuid: target?.uuid || "",
    shiftNotes: plan.note,
    consumeOutgoing: plan.consumeOutgoing,
    consumeIncoming: plan.consumeIncoming && !reactionCs
  });
  if (needsTarget) clearUserTargets();
  return message;
}

export function rollItemAction(actor, item, opts = {}) {
  if (!item) return null;
  return rollAction(actor, describeItemAction(item), { ...opts, item, label: item.name });
}

export function rollStandardAction(actor, id, opts = {}) {
  const entry = STANDARD_ACTIONS.find((action) => action.id === id);
  if (!entry || !actor) return null;
  const spec = action({ kind: "attack", column: entry.column, ability: entry.ability, rankFrom: "ability" });
  return rollAction(actor, spec, { ...opts, label: entry.label });
}
