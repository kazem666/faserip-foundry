import {
  ABILITIES, ORIGINS, ORIGIN_TABLE, SPECIAL_COUNT_TABLE, ABILITY_MODIFIER_TABLE,
  rankMin, shiftRank, lookupTable, rollOnColumn, originById
} from "./config.mjs";
import { deepClone } from "./foundry-api.mjs";
import { rollD100, promptedD100, promptNextRoll } from "./dice/percentile.mjs";
import { UPB_COUNT_TABLE } from "./data/upb.mjs";

function d100() { return Math.floor(Math.random() * 100) + 1; }

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
  const counts = {
    powers: [...lookupTable(SPECIAL_COUNT_TABLE, d100()).powers],
    talents: [...lookupTable(SPECIAL_COUNT_TABLE, d100()).talents],
    contacts: [...lookupTable(SPECIAL_COUNT_TABLE, d100()).contacts]
  };
  if (origin.id === "mutant") counts.powers[0] = Math.min(5, counts.powers[0] + 1);
  if (origin.id === "alien") {
    counts.powers[0] = Math.max(2, counts.powers[0] - 1);
    counts.contacts[0] = Math.min(1, counts.contacts[0]);
    counts.contacts[1] = 1;
  }
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
  const originLabel = result.originOfPower?.label || result.origin?.label || originById(result.origin?.id)?.label || "";
  const update = {
    "system.identity.origin": originLabel,
    "system.identity.form": result.form?.label || actor.system.identity?.form || "",
    "system.identity.originOfPower": result.originOfPower?.label || actor.system.identity?.originOfPower || "",
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
  await actor.update({ "system.health.value": result.doubleHealth ? phys * 2 : phys, "system.karma.value": ment });
  const items = [];
  for (const power of powers) {
    items.push({
      name: power.name, type: "power",
      system: {
        rank: power.rank ?? "typical", number: rankMin(power.rank ?? "typical"),
        category: power.category ?? "", bodyArmor: !!power.bodyArmor, forceField: !!power.forceField,
        notes: power.rankRoll ? `Generation roll ${power.rankRoll}` : ""
      }
    });
  }
  for (const talent of talents) items.push({ name: talent.name, type: "talent", system: { category: talent.category ?? "", rank: "typical", number: 0 } });
  for (const contact of contacts) items.push({ name: contact.name, type: "contact", system: { category: contact.type ?? contact.category ?? "", rank: "typical", number: 0 } });
  if (items.length) await actor.createEmbeddedDocuments("Item", items);
}

export async function promptGeneration(actor) {
  const { isUpbEnabled } = await import("./data/upb.mjs");
  const upbOn = isUpbEnabled();
  const originOptions = ORIGINS.map((o) => `<option value="${o.id}">${o.label}</option>`).join("");
  const DialogV2 = foundry.applications.api.DialogV2;
  const form = await DialogV2.wait({
    window: { title: "Generate Hero", icon: "fa-solid fa-dice" },
    content: `
    <form class="faserip-feat-dialog">
      <div class="form-group"><label><input type="checkbox" name="useUpb" ${upbOn ? "checked" : ""} /> Use Ultimate Powers Book (MA3)</label></div>
      <div class="form-group"><label>Advanced Set origin (ignored if UPB is on)</label><select name="origin">${originOptions}</select></div>
      <div class="form-group"><label><input type="checkbox" name="rollOrigin" ${upbOn ? "" : "checked"} /> Roll Advanced Set origin</label></div>
      <div class="form-group"><label><input type="checkbox" name="secretId" /> Secret identity</label></div>
    </form>`,
    buttons: [
      { action: "generate", label: "Generate", icon: "fa-solid fa-dice", default: true, callback: (_e, b) => b.form },
      { action: "cancel", label: "Cancel" }
    ],
    rejectClose: false
  });
  if (!form || form === "cancel") return null;
  const { runFullGeneration } = await import("./wizard.mjs");
  await runFullGeneration(actor, {
    originId: form.querySelector('[name="origin"]')?.value,
    rollOrigin: !!form.querySelector('[name="rollOrigin"]')?.checked,
    secretId: !!form.querySelector('[name="secretId"]')?.checked,
    useUpb: !!form.querySelector('[name="useUpb"]')?.checked,
    publicId: actor.system.identity?.public,
    secretName: actor.system.identity?.secret
  });
  return true;
}

export async function rollHeroDice(actor, {
  originId = "altered", rollOrigin = false, useUpb = false, column = null, originLabel = null, skipOriginMods = false
} = {}) {
  let originRoll = null;
  let id = originId || "altered";
  if (rollOrigin && !useUpb) {
    const go = await promptNextRoll("Origin", "Roll 1d100: 01-30 Altered Human, 31-60 Mutant, 61-90 Hi-Tech, 91-95 Robot, 96-00 Alien.");
    if (!go) return null;
    originRoll = await rollD100({ flavor: actor.name + " — Origin table", actor });
    id = lookupTable(ORIGIN_TABLE, originRoll).id;
  }
  const origin = originById(id);
  try {
    await actor.update({ "system.identity.origin": originLabel || origin.label });
    ui.notifications.info("Origin: " + (originLabel || origin.label) + (originRoll ? " (d100 " + originRoll + ")" : ""));
  } catch (err) {
    console.warn("FASERIP | could not write origin yet", err);
  }
  const col = Number(column || origin.column);
  const colLabel = originLabel || origin.label;
  const abilityRolls = {};
  const abilities = {};
  const order = ["fighting", "agility", "strength", "endurance", "reason", "intuition", "psyche"];
  let step = 1;
  for (const key of order) {
    const label = key.charAt(0).toUpperCase() + key.slice(1);
    const go = await promptNextRoll("FASERIP " + step + " of 7 — " + label, actor.name + " rolls <strong>" + label + "</strong> on column " + col + " (" + colLabel + ").");
    if (!go) return null;
    const total = await rollD100({ flavor: actor.name + " — " + label + " (column " + col + ")", actor });
    abilityRolls[key] = total;
    abilities[key] = rollOnColumn(col, total);
    step += 1;
  }
  if (!skipOriginMods && !useUpb) {
    if (origin.id === "mutant") abilities.endurance = shiftRank(abilities.endurance, 1);
    if (origin.id === "hitech") abilities.reason = shiftRank(abilities.reason, 2);
  }
  const numbers = {};
  for (const key of ABILITIES) numbers[key] = rankMin(abilities[key]);
  const resourceModRoll = await promptedD100({
    title: "Resources",
    body: "Roll 1d100 on the Ability Modifier table.",
    flavor: actor.name + " - Resource modifier",
    actor
  });
  if (resourceModRoll == null) return null;
  const resourceMod = lookupTable(ABILITY_MODIFIER_TABLE, resourceModRoll);
  let resources = (!useUpb && origin.id === "hitech") ? "good" : (!useUpb && origin.id === "alien") ? "poor" : "typical";
  resources = shiftRank(resources, resourceMod.cs);
  if (!useUpb && origin.id === "mutant") resources = shiftRank(resources, -1);
  const powerRoll = await promptedD100({
    title: "Number of Powers",
    body: useUpb ? "UPB count table." : "Advanced Set Powers / Talents / Contacts table.",
    flavor: actor.name + " - Number of Powers",
    actor
  });
  if (powerRoll == null) return null;
  const talentRoll = await promptedD100({ title: "Number of Talents", body: "Same table for Talents.", flavor: actor.name + " - Number of Talents", actor });
  if (talentRoll == null) return null;
  const contactRoll = await promptedD100({ title: "Number of Contacts", body: "Same table for Contacts.", flavor: actor.name + " - Number of Contacts", actor });
  if (contactRoll == null) return null;
  const countSrc = useUpb ? UPB_COUNT_TABLE : SPECIAL_COUNT_TABLE;
  const counts = {
    powers: [...lookupTable(countSrc, powerRoll).powers],
    talents: [...lookupTable(countSrc, talentRoll).talents],
    contacts: [...lookupTable(countSrc, contactRoll).contacts]
  };
  if (!useUpb && origin.id === "mutant") counts.powers[0] = Math.min(5, counts.powers[0] + 1);
  if (!useUpb && origin.id === "alien") {
    counts.powers[0] = Math.max(2, counts.powers[0] - 1);
    counts.contacts[0] = Math.min(1, counts.contacts[0]);
    counts.contacts[1] = 1;
  }
  return {
    origin, originRoll, abilities, numbers, abilityRolls, resources, resourceModRoll, resourceMod,
    counts, powerCats: [], talentCats: [],
    popularity: (!useUpb && (origin.id === "mutant" || origin.id === "robot")) ? 0 : 10,
    useUpb, column: col
  };
}
