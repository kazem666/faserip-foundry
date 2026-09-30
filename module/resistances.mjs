import { rankIndex, rankLabel } from "./config.mjs";

/**
 * Resistances. A higher rank cancels the matching harm.
 * An equal rank halves damage. This is a play comparison, not a book chart.
 * Invulnerability covers one chosen form. True invulnerability covers
 * physical harm, energy, poison, and disease.
 */

const PHYSICAL = new Set([
  "blunt", "edged", "shooting", "throwEdged", "throwBlunt", "charging", "grappling", "grabbing", "force"
]);

const TRUE_COVERS = new Set([
  "physical", "energy", "fire", "cold", "electric", "radiation", "toxin", "acid", "disease"
]);

const WARDS = [
  ["physical", "Physical"],
  ["energy", "Energy"],
  ["fire", "Fire and heat"],
  ["cold", "Cold"],
  ["electric", "Electricity"],
  ["radiation", "Radiation"],
  ["toxin", "Toxins"],
  ["acid", "Corrosives"],
  ["emotion", "Emotion"],
  ["mental", "Mental"],
  ["magic", "Magic"],
  ["disease", "Disease"]
];

function powerKey(name) {
  return String(name || "")
    .replace(/\s*\(counts as two[^)]*\)/gi, "")
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/[—–]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function resistKind(name) {
  const key = powerKey(name);
  if (key === "resistance to fire and heat") return "fire";
  if (key === "resistance to cold") return "cold";
  if (key === "resistance to electricity") return "electric";
  if (key === "resistance to radiation") return "radiation";
  if (key === "resistance to toxins") return "toxin";
  if (key === "resistance to corrosives") return "acid";
  if (key === "resistance to emotion attacks" || key === "resist: emotion") return "emotion";
  if (key === "resistance to mental attacks" || key === "resist: mental") return "mental";
  if (key === "resistance to magical attacks" || key === "resist: magic") return "magic";
  if (key === "resistance to disease") return "disease";
  if (key === "resistance to energy attacks" || key === "resistance to energy" || key === "resist: energy") return "energy";
  if (key === "resistance to physical attacks" || key === "resistance to physical" || key === "resist: physical") return "physical";
  if (key === "resist: power manipulation") return "power";
  if (key === "resist: vampirism") return "vampire";
  if (key === "invulnerability") return "invuln";
  if (key === "true invulnerability") return "true";
  return "";
}

export function resistUseTitle(name) {
  const kind = resistKind(name);
  const compare = "A higher rank cancels that harm. An equal rank halves the damage.";
  const titles = {
    fire: `Fire and heat are compared to this rank. ${compare}`,
    cold: `Cold and ice are compared to this rank. ${compare}`,
    electric: `Electricity is compared to this rank. ${compare}`,
    radiation: `Radiation is compared to this rank. ${compare}`,
    toxin: `Poison and toxins are compared to this rank. ${compare}`,
    acid: `Acid and corrosives are compared to this rank. ${compare}`,
    emotion: `Emotion powers are compared to this rank. ${compare} A higher rank also stops the mood from landing.`,
    mental: `Mental powers are compared to this rank. A higher rank stops the effect. Otherwise they still resist with Psyche.`,
    magic: `Magic aimed at you is compared to this rank. A higher rank stops it. ${compare}`,
    disease: `Disease is compared to this rank. A higher rank keeps it from taking. ${compare}`,
    energy: `Energy attacks are compared to this rank. ${compare}`,
    physical: `Physical attacks are compared to this rank. ${compare}`,
    power: `Powers that copy, drain, or suppress your powers are compared to this rank. A higher rank stops them.`,
    vampire: `Health-draining and life-draining attacks are compared to this rank. ${compare}`,
    invuln: "Choose the attack form this covers. A lower rank does not land. An equal rank halves damage.",
    true: `Physical harm, energy, poison, and disease are compared to this rank. ${compare}`
  };
  return titles[kind] || "";
}

function wardOf(item) {
  const flagged = item?.getFlag?.("faserip", "ward");
  if (flagged) return flagged;
  return item?.flags?.faserip?.ward || "";
}

function covers(item, tags) {
  const kind = resistKind(item?.name);
  if (!kind || !tags?.size) return false;
  if (kind === "true") return [...tags].some((tag) => TRUE_COVERS.has(tag));
  if (kind === "invuln") {
    const ward = wardOf(item);
    return !!(ward && tags.has(ward));
  }
  return tags.has(kind);
}

export function threatTags({ name = "", columnId = "", energy = false } = {}) {
  const key = powerKey(name);
  const tags = new Set();
  if (/fire|heat|flame|plasma|thermal/.test(key)) tags.add("fire");
  if (/\bcold\b|ice|frost/.test(key)) tags.add("cold");
  if (/electric|lightning/.test(key)) tags.add("electric");
  if (/radiation/.test(key)) tags.add("radiation");
  if (/toxin|poison|venom/.test(key)) tags.add("toxin");
  if (/corros|acid/.test(key)) tags.add("acid");
  if (/emotion|pheromone/.test(key)) tags.add("emotion");
  if (/magic|spell|mystic/.test(key)) tags.add("magic");
  if (/disease|plague|infect/.test(key)) tags.add("disease");
  if (/nullif|power absorption|power vampir|power transfer|domination|transferral/.test(key)) tags.add("power");
  if (/health-drain|vampir|life absorption|bio-vampir/.test(key)) tags.add("vampire");
  if (/mental|telepath|mind control|mind blast|psionic|possession|mental probe|hypno|image generation|mind drain|mind transfer/.test(key)) tags.add("mental");
  if (energy || columnId === "energy") tags.add("energy");
  if (PHYSICAL.has(columnId)) tags.add("physical");
  return tags;
}

function bestCover(actor, tags, attackRank) {
  let best = null;
  for (const item of actor?.items ?? []) {
    if (item?.type !== "power" || !covers(item, tags)) continue;
    const rank = item.system?.rank || "typical";
    const cmp = rankIndex(rank) - rankIndex(attackRank || "feeble");
    if (!best || cmp > best.cmp) best = { cmp, rank, name: item.name };
  }
  return best;
}

export function resistHarm(actor, spec = {}) {
  const tags = threatTags(spec);
  for (const tag of spec.tags || []) tags.add(tag);
  const cover = bestCover(actor, tags, spec.rankId || "feeble");
  const amount = Number(spec.amount);
  if (!cover || cover.cmp < 0) return { result: "", amount: spec.amount, note: "", name: "" };
  const what = spec.name || "that";
  if (cover.cmp > 0) {
    return { result: "cancel", amount: 0, note: `${cover.name} shrugs off ${what}.`, name: cover.name };
  }
  if (Number.isFinite(amount)) {
    return {
      result: "half",
      amount: Math.floor(amount / 2),
      note: `${cover.name} halves that damage.`,
      name: cover.name
    };
  }
  return { result: "even", amount: spec.amount, note: `${cover.name} matches that rank.`, name: cover.name };
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

async function pickWard(item) {
  const current = wardOf(item);
  const buttons = WARDS.map(([action, label]) => ({ action, label: action === current ? `${label} (on)` : label }));
  buttons.push({ action: "cancel", label: "Cancel" });
  const picked = await choose(item.name, "Which attack form does this cover?", buttons);
  if (!picked) return null;
  try {
    await item.setFlag?.("faserip", "ward", picked);
  } catch (err) {
    console.warn("FASERIP | resistance", err);
    return null;
  }
  const label = WARDS.find(([id]) => id === picked)?.[1] || picked;
  globalThis.ui?.notifications?.info(`${item.name} covers ${label} at ${rankLabel(item.system?.rank || "typical")}.`);
  return true;
}

export async function useResistPower(actor, item) {
  const kind = resistKind(item?.name);
  if (!actor || !kind) return null;
  if (kind === "invuln") return pickWard(item);
  const rank = rankLabel(item?.system?.rank || "typical");
  const line = kind === "true"
    ? `${item.name} is ${rank}. It covers physical harm, energy, poison, and disease.`
    : `${item.name} is ${rank}. A higher rank cancels the matching harm. An equal rank halves damage.`;
  globalThis.ui?.notifications?.info(line);
  return true;
}
