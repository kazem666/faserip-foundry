import {
  ABILITIES, ORIGINS, ORIGIN_TABLE, SPECIAL_COUNT_TABLE, ABILITY_MODIFIER_TABLE,
  rankMin, shiftRank, lookupTable, rollOnColumn, originById
} from "./config.mjs";
import { deepClone } from "./foundry-api.mjs";
import { rollD100, promptedD100, promptNextRoll } from "./dice/percentile.mjs";
import { UPB_COUNT_TABLE } from "./data/upb.mjs";

function d100() { return Math.floor(Math.random() * 100) + 1; }

export function parseCountPair(value, fallback = [0, 4]) {
  if (Array.isArray(value) && value.length) {
    const initial = Math.max(0, Number(value[0]) || 0);
    const max = Math.max(initial, Number(value[1] ?? value[0]) || initial);
    return [initial, max];
  }
  const n = Math.max(0, Number(value) || 0);
  if (n) return [n, n];
  return [Math.max(0, Number(fallback[0]) || 0), Math.max(0, Number(fallback[1] ?? fallback[0]) || 0)];
}

export function clampCounts(counts = {}, useUpb = false) {
  const powers = parseCountPair(counts.powers, useUpb ? [2, 4] : [2, 4]);
  let talents = parseCountPair(counts.talents, useUpb ? [1, 4] : [2, 5]);
  const contacts = parseCountPair(counts.contacts, useUpb ? [1, 4] : [1, 4]);
  const talentInitialCap = useUpb ? 6 : 4;
  const talentMaxCap = useUpb ? 8 : 6;
  talents = [
    Math.min(talentInitialCap, talents[0]),
    Math.min(talentMaxCap, Math.max(talents[0], talents[1]))
  ];
  if (!useUpb) {
    powers[0] = Math.min(5, Math.max(2, powers[0]));
    powers[1] = Math.min(5, Math.max(powers[0], powers[1]));
    contacts[1] = Math.min(4, Math.max(contacts[0], contacts[1]));
  }
  return { powers, talents, contacts };
}

const ITEM_ICONS = {
  power: "icons/svg/aura.svg",
  talent: "icons/svg/upgrade.svg",
  contact: "icons/svg/mystery-man.svg",
  weapon: "icons/svg/sword.svg",
  equipment: "icons/svg/item-bag.svg"
};

export async function writeGeneratedItem(actor, type, name, extra = {}) {
  if (!actor || !type) return null;
  const clean = String(name || "").replace(/\s*\(counts as two[^)]*\)/gi, "").trim();
  if (!clean) return null;
  const already = actor.items.find((i) => i.type === type && i.name.toLowerCase() === clean.toLowerCase());
  if (already) return already;
  let data = {
    name: clean,
    type,
    img: ITEM_ICONS[type] || "icons/svg/item-bag.svg",
    system: { ...extra, rank: extra.rank || "typical", number: extra.number ?? 0 }
  };
  try {
    const { buildCatalogItemData } = await import("./data/descriptions.mjs");
    data = { ...buildCatalogItemData(type, clean, extra), type, name: clean };
    data.system = { ...(data.system || {}), ...Object.fromEntries(
      ["range", "area", "emanatesFrom", "areasPerRound", "effectsColumn", "powerType", "definition", "category", "slotsTaken", "rank", "number"]
        .filter((k) => extra[k] != null && extra[k] !== "")
        .map((k) => [k, extra[k]])
    ) };
  } catch (err) {
    console.warn("FASERIP | catalog blurb skipped for", type, clean, err);
  }
  data.type = type;
  data.name = clean;
  try {
    const created = await actor.createEmbeddedDocuments("Item", [data]);
    return created?.[0] ?? null;
  } catch (err) {
    console.error("FASERIP | createEmbeddedDocuments failed", type, clean, err);
    try {
      const created = await actor.createEmbeddedDocuments("Item", [{
        name: clean,
        type,
        img: ITEM_ICONS[type] || "icons/svg/item-bag.svg",
        system: {
          rank: extra.rank || "typical",
          number: extra.number ?? 0,
          category: extra.category || extra.occupation || "",
          definition: extra.definition || "",
          notes: extra.notes || ""
        }
      }]);
      return created?.[0] ?? null;
    } catch (err2) {
      ui.notifications?.error(`Could not add ${type} “${clean}”: ${err2.message}`);
      return null;
    }
  }
}

export function buildRolledStatsStamp(result = {}, extras = {}) {
  return {
    abilities: result.abilities || {},
    numbers: result.numbers || {},
    resources: result.resources || "",
    popularity: result.popularity ?? null,
    originLabel: extras.originLabel || result.origin?.label || "",
    form: result.form?.label || "",
    originOfPower: result.originOfPower?.label || ""
  };
}

export async function persistGenerationStats(actor, result = {}, extras = {}) {
  if (!actor || !result) return;
  const stamp = buildRolledStatsStamp(result, extras);
  try { await actor.setFlag("faserip", "generating", true); } catch {}
  try { await actor.setFlag("faserip", "rolledStats", stamp); } catch {}
  if (!extras.quiet) {
    try { await actor.sheet?.close(); } catch {}
    try {
      for (const app of Object.values(actor.apps || {})) {
        if (app?.close) await app.close();
      }
    } catch {}
  }
  const abilities = result.abilities || {};
  const numbers = result.numbers || {};
  const update = { "flags.faserip.rolledStats": stamp };
  if (!extras.quiet) update["flags.faserip.generating"] = true;
  for (const key of ABILITIES) {
    if (abilities[key]) update[`system.abilities.${key}.rank`] = abilities[key];
    if (numbers[key] != null) update[`system.abilities.${key}.number`] = Number(numbers[key]);
  }
  if (result.resources) {
    update["system.resources.rank"] = result.resources;
    update["system.resources.number"] = rankMin(result.resources);
  }
  const phys = ["fighting", "agility", "strength", "endurance"].reduce((s, k) => s + Number(numbers[k] || 0), 0);
  const ment = ["reason", "intuition", "psyche"].reduce((s, k) => s + Number(numbers[k] || 0), 0);
  if (phys) {
    update["system.health.value"] = result.doubleHealth ? phys * 2 : phys;
    update["system.health.max"] = result.doubleHealth ? phys * 2 : phys;
  }
  if (ment) {
    update["system.karma.value"] = ment;
    update["system.karma.max"] = ment;
  }
  if (result.origin?.label) update["system.identity.origin"] = extras.originLabel || result.originOfPower?.label || result.origin.label;
  if (result.form?.label) update["system.identity.form"] = result.form.label;
  if (result.originOfPower?.label) update["system.identity.originOfPower"] = result.originOfPower.label;
  if (result.popularity != null) {
    update["system.popularity.value"] = result.popularity;
    update["system.popularity.secret"] = result.popularity;
  }
  const opts = { diff: false, render: false, faseripApplyRolls: true };
  try {
    if (Object.keys(update).length) {
      await actor.update(update, opts);
      console.log("FASERIP | persistGenerationStats", actor.name, abilities, numbers, { health: phys, karma: ment });
    }
  } catch (err) {
    console.warn("FASERIP | persistGenerationStats", err);
    try {
      if (Object.keys(update).length) await actor.update(update, { faseripApplyRolls: true });
    } catch (err2) {
      console.warn("FASERIP | persistGenerationStats retry", err2);
    }
  }
}

export async function reapplyRolledStats(actor) {
  if (!actor) return false;
  const stamped = actor.getFlag("faserip", "rolledStats");
  const abilities = stamped?.abilities || {};
  if (!Object.keys(abilities).length) return false;
  const current = actor.system?.abilities || {};
  const stale = ABILITIES.some((key) => abilities[key] && current[key]?.rank !== abilities[key]);
  if (!stale) return false;
  await persistGenerationStats(actor, {
    abilities,
    numbers: stamped.numbers || {},
    resources: stamped.resources,
    popularity: stamped.popularity,
    origin: { label: stamped.originLabel },
    form: stamped.form ? { label: stamped.form } : null,
    originOfPower: stamped.originOfPower ? { label: stamped.originOfPower } : null
  }, { originLabel: stamped.originLabel, quiet: true });
  return true;
}

export function generateHero({ originId = null, rollOrigin = false } = {}) {
  const originRoll = d100();
  const origin = originById(rollOrigin ? lookupTable(ORIGIN_TABLE, originRoll).id : (originId || "altered"));
  const abilities = {};
  const abilityRolls = {};
  for (const key of ABILITIES) {
    const roll = d100();
    abilityRolls[key] = roll;
    abilities[key] = rollOnColumn(origin.column, roll);
  }
  if (origin.id === "mutant") abilities.endurance = shiftRank(abilities.endurance, 1);
  if (origin.id === "hitech") abilities.reason = shiftRank(abilities.reason, 2);
  const numbers = {};
  for (const key of ABILITIES) numbers[key] = rankMin(abilities[key]);
  const resourceModRoll = d100();
  const resourceMod = lookupTable(ABILITY_MODIFIER_TABLE, resourceModRoll);
  let resources = origin.id === "hitech" ? "good" : origin.id === "alien" ? "poor" : "typical";
  resources = shiftRank(resources, resourceMod.cs);
  if (origin.id === "mutant") resources = shiftRank(resources, -1);
  let counts = clampCounts({
    powers: lookupTable(SPECIAL_COUNT_TABLE, d100()).powers,
    talents: lookupTable(SPECIAL_COUNT_TABLE, d100()).talents,
    contacts: lookupTable(SPECIAL_COUNT_TABLE, d100()).contacts
  }, false);
  if (origin.id === "mutant") counts.powers[0] = Math.min(5, counts.powers[0] + 1);
  if (origin.id === "alien") {
    counts.powers[0] = Math.max(2, counts.powers[0] - 1);
    counts.contacts[0] = Math.min(1, counts.contacts[0]);
    counts.contacts[1] = 1;
  }
  counts = clampCounts(counts, false);
  return {
    origin, originRoll, abilities, numbers, abilityRolls, resources, resourceModRoll, resourceMod,
    counts, powerCats: [], talentCats: [], popularity: origin.id === "mutant" || origin.id === "robot" ? 0 : 10
  };
}

export async function applyGeneration(actor, result, {
  raiseAbility = null, secretId = false, powers = [], talents = [], contacts = [], weakness = ""
} = {}) {
  const abilities = deepClone(result.abilities);
  const numbers = deepClone(result.numbers);
  if (raiseAbility && abilities[raiseAbility]) {
    abilities[raiseAbility] = shiftRank(abilities[raiseAbility], 1);
    numbers[raiseAbility] = rankMin(abilities[raiseAbility]);
  }
  let popularity = result.popularity;
  if (!secretId && popularity === 10) popularity = 20;
  if (secretId) popularity = Math.max(-5, popularity - 5);
  result.abilities = abilities;
  result.numbers = numbers;
  result.popularity = popularity;
  await persistGenerationStats(actor, result);
  await actor.update({
    "system.identity.secretId": !!secretId,
    "system.notes": weakness ? `<p><strong>Weakness:</strong> ${weakness}</p>${actor.system.notes ?? ""}` : (actor.system.notes ?? ""),
    "system.story.weaknesses": weakness || actor.system.story?.weaknesses || ""
  });
  let created = 0;
  for (const power of powers) {
    const doc = await writeGeneratedItem(actor, "power", power.name, {
      rank: power.rank ?? "typical",
      number: rankMin(power.rank ?? "typical"),
      category: power.category ?? "",
      bodyArmor: !!power.bodyArmor,
      forceField: !!power.forceField,
      slotsTaken: Number(power.slotsTaken ?? power.cost ?? 1) || 1,
      notes: power.rankRoll ? `Generation roll ${power.rankRoll}` : ""
    });
    if (doc) created += 1;
  }
  for (const talent of talents) {
    const doc = await writeGeneratedItem(actor, "talent", talent.name, {
      category: talent.category ?? "",
      rank: "typical",
      number: 0
    });
    if (doc) created += 1;
  }
  for (const contact of contacts) {
    const doc = await writeGeneratedItem(actor, "contact", contact.name, {
      category: contact.type ?? contact.category ?? "",
      occupation: contact.type ?? contact.category ?? contact.name ?? "",
      rank: "typical",
      number: 0
    });
    if (doc) created += 1;
  }
  const onSheet = actor.items.filter((i) => ["power", "talent", "contact"].includes(i.type)).length;
  ui.notifications.info(`${actor.name}: ${created} new item(s) written. Sheet now has ${onSheet} Power/Talent/Contact item(s).`);
}

export { promptGeneration, rollHeroDice } from "./hero-dice.mjs";
