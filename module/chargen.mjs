import {
  ABILITIES, ORIGIN_TABLE, SPECIAL_COUNT_TABLE, ABILITY_MODIFIER_TABLE,
  POWER_CATEGORIES, TALENT_CATEGORIES, rankMin, shiftRank, lookupTable, rollOnColumn, originById
} from "./config.mjs";
import { deepClone } from "./foundry-api.mjs";

function d100() { return Math.floor(Math.random() * 100) + 1; }

export function generateHero({ originId = null, rollOrigin = false } = {}) {
  const originRoll = d100();
  const originKey = rollOrigin ? lookupTable(ORIGIN_TABLE, originRoll).id : (originById(originId || "altered").id);
  const origin = originById(originKey);
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
  const counts = {
    powers: lookupTable(SPECIAL_COUNT_TABLE, d100()).powers,
    talents: lookupTable(SPECIAL_COUNT_TABLE, d100()).talents,
    contacts: lookupTable(SPECIAL_COUNT_TABLE, d100()).contacts
  };
  if (origin.id === "mutant") counts.powers[0] = Math.min(5, counts.powers[0] + 1);
  if (origin.id === "alien") {
    counts.powers[0] = Math.max(2, counts.powers[0] - 1);
    counts.contacts[0] = Math.min(1, counts.contacts[0]);
    counts.contacts[1] = 1;
  }
  const powerCats = [];
  for (let i = 0; i < counts.powers[0]; i++) {
    const r = d100();
    powerCats.push({ roll: r, ...lookupTable(POWER_CATEGORIES, r) });
  }
  const talentCats = [];
  for (let i = 0; i < counts.talents[0]; i++) {
    const r = d100();
    talentCats.push({ roll: r, ...lookupTable(TALENT_CATEGORIES, r) });
  }
  const popularity = origin.id === "mutant" || origin.id === "robot" ? 0 : 10;
  return { origin, originRoll, abilities, numbers, abilityRolls, resources, resourceModRoll, resourceMod, counts, powerCats, talentCats, popularity };
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
  const update = {
    "system.identity.origin": result.origin.label,
    "system.identity.secretId": !!secretId,
    "system.resources.rank": result.resources,
    "system.resources.number": rankMin(result.resources),
    "system.popularity.value": popularity,
    "system.popularity.secret": popularity,
    "system.notes": weakness ? `<p><strong>Weakness:</strong> ${weakness}</p>${actor.system.notes ?? ""}` : (actor.system.notes ?? "")
  };
  for (const key of ABILITIES) {
    update[`system.abilities.${key}.rank`] = abilities[key];
    update[`system.abilities.${key}.number`] = numbers[key];
  }
  await actor.update(update);
  const phys = ["fighting", "agility", "strength", "endurance"].reduce((s, k) => s + numbers[k], 0);
  const ment = ["reason", "intuition", "psyche"].reduce((s, k) => s + numbers[k], 0);
  await actor.update({ "system.health.value": phys, "system.karma.value": ment });
  const items = [];
  for (const power of powers) {
    items.push({
      name: power.name, type: "power",
      system: {
        rank: power.rank ?? "typical",
        number: rankMin(power.rank ?? "typical"),
        category: power.category ?? "",
        bodyArmor: !!power.bodyArmor,
        forceField: !!power.forceField,
        notes: power.rankRoll ? `Generation roll ${power.rankRoll}` : ""
      }
    });
  }
  for (const talent of talents) {
    items.push({ name: talent.name, type: "talent", system: { category: talent.category ?? "", rank: "typical", number: 0 } });
  }
  for (const contact of contacts) {
    items.push({ name: contact.name, type: "contact", system: { category: contact.type ?? contact.category ?? "", rank: "typical", number: 0 } });
  }
  if (items.length) await actor.createEmbeddedDocuments("Item", items);
}

export async function promptGeneration(actor) {
  const { runFullGeneration } = await import("./wizard.mjs");
  return runFullGeneration(actor, {
    originId: actor.system.identity?.origin || "altered",
    rollOrigin: true,
    secretId: !!actor.system.identity?.secretId,
    publicId: actor.system.identity?.public,
    secretName: actor.system.identity?.secret
  });
}
