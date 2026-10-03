import {
  isRomEnabled, wantRom, lookupBand, schoolById, startingMastery,
  ROM_CHARACTER_TYPE, ROM_ENERGY, ROM_SPELL_COUNT, ROM_SPELL_RANK,
  ROM_WIELDER_TALENT_COUNT, ROM_WIELDER_TALENTS, ROM_ITEM_COUNT, ROM_ITEM_CATEGORY, ROM_ITEM_TYPES,
  ROM_SCHOOLS, ROM_SCHOOL_TABLE,
  ROM_RESOURCE_RANK, ROM_RESOURCE_CACHE, ROM_ENHANCEMENT,
  ROM_ENHANCEMENT_CONDITION, ROM_ITEM_CONDITION
} from "./data/rom.mjs";
import { dialog, collect, options } from "./wizard-picks.mjs";
import { writeGeneratedItem, persistGenerationStats } from "./chargen.mjs";
import { promptedD100 } from "./dice/percentile.mjs";
import { ABILITIES, rankIndex, rankLabel, rankMin, shiftRank } from "./config.mjs";

export { isRomEnabled, wantRom };

const PERSONAL = ["Absorption", "Armor", "Alteration - Appearance", "Healing", "Invisibility", "Levitation"];
const UNIVERSAL = ["Eldritch Beam", "Matter Animation", "Shield", "Teleport", "Illusion", "Bind"];
const DIMENSIONAL = ["Dimensional Aperture", "Entreaty", "Banishment", "Dimensional Gate"];
const LISTS = { personal: PERSONAL, universal: UNIVERSAL, dimensional: DIMENSIONAL };
const SCIENCE_TALENTS = ["Engineering", "Biology", "Genetics", "Physics", "Chemistry"];
export const ROM_CONTACTS = ["Master of the School", "Fellow Disciple", "Relic Dealer", "Occult Librarian", "Temple Keeper"];

function capAmazing(rankId, cs) {
  const amazing = rankIndex("amazing");
  const next = shiftRank(rankId, cs);
  if (rankIndex(next) > amazing) return rankIndex(rankId) >= amazing ? rankId : "amazing";
  return next;
}

function raiseAbility(result, key, cs) {
  const before = result?.abilities?.[key];
  if (!before || !cs) return false;
  const next = capAmazing(before, cs);
  if (next === before) return false;
  result.abilities[key] = next;
  result.numbers[key] = rankMin(next);
  return true;
}

async function chooseAbility(title, exclude = []) {
  const list = ABILITIES.filter((key) => !exclude.includes(key)).map((key) => ({ id: key, label: key }));
  const pick = await dialog(
    title,
    "<div class='form-group'><label>Ability</label><select name='ability'>" + options(list) + "</select></div>",
    [{ action: "ok", label: "Use This", default: true, callback: (_e, b, d) => ({ action: "ok", ...collect(b, d) }) }]
  );
  return pick?.ability || list[0]?.id || "strength";
}

async function rollDie(formula) {
  const roll = await new Roll(formula).evaluate();
  return Number(roll.total) || 1;
}

export async function pickRomPrelude(actor, result = null) {
  const typeRoll = await promptedD100({
    title: "Magical character type",
    body: "01-10 Enhanced, 11-35 Magical Item(s), 36-00 Magic Wielder.",
    flavor: (actor?.name || "Hero") + " - ROM type",
    actor
  });
  if (typeRoll == null) return null;
  const type = lookupBand(ROM_CHARACTER_TYPE, typeRoll);
  const schoolChoice = await dialog(
    "School of Magic",
    "<p>Pick a school. Random roll is optional.</p><div class='form-group'><label>School</label><select name='school'>" +
    options(ROM_SCHOOLS.map((s) => ({ id: s.id, label: s.label }))) + "</select></div>",
    [
      { action: "pick", label: "Use This School", default: true, callback: (_e, b, d) => ({ action: "pick", ...collect(b, d) }) },
      { action: "roll", label: "Roll School" },
      { action: "skip", label: "Skip Magic Path" }
    ]
  );
  if (!schoolChoice || schoolChoice === "skip" || schoolChoice === "cancel") return null;
  let school = schoolById(schoolChoice.school);
  if (schoolChoice === "roll") {
    const sRoll = await promptedD100({ title: "School table", body: "01-10 Chaos through 91-00 Eclectic.", flavor: (actor?.name || "Hero") + " - school", actor });
    if (sRoll == null) return null;
    school = schoolById(lookupBand(ROM_SCHOOL_TABLE, sRoll).id);
  }
  let energy = ROM_ENERGY[2];
  let spellCount = 0;
  let itemCount = 0;
  let abilityCs = 0;
  if (type.id === "wielder") {
    const eRoll = await promptedD100({ title: "Energy sources", body: "01-15 Personal only, 16-50 Personal + Universal, 51-00 All three.", flavor: (actor?.name || "Hero") + " - energy", actor });
    if (eRoll == null) return null;
    energy = lookupBand(ROM_ENERGY, eRoll);
    const cRoll = await promptedD100({ title: "Number of starting spells", body: "01-05 two, 06-50 three, 51-85 four, 86-97 five, 98-00 six.", flavor: (actor?.name || "Hero") + " - spell count", actor });
    if (cRoll == null) return null;
    spellCount = lookupBand(ROM_SPELL_COUNT, cRoll).count;
  } else if (type.id === "items") {
    const iRoll = await promptedD100({ title: "Number of magical items", body: "01-10 one (+2 CS), 11-50 two (+1 CS), 51-90 three, 91-00 four.", flavor: (actor?.name || "Hero") + " - item count", actor });
    if (iRoll == null) return null;
    const row = lookupBand(ROM_ITEM_COUNT, iRoll);
    itemCount = row.count;
    energy = ROM_ENERGY[1];
    spellCount = itemCount;
    abilityCs = row.abilityCs;
  }
  const bonusLists = school.id === "scientific" && type.id === "wielder"
    ? ["personal", "personal", "universal"]
    : [];
  const mastery = startingMastery(type.id === "wielder" ? spellCount + bonusLists.length : 0);
  if (type.id === "wielder" && result?.abilities && rankIndex(result.abilities.psyche) < rankIndex("good")) {
    result.abilities.psyche = "good";
    result.numbers.psyche = rankMin("good");
    try { await persistGenerationStats(actor, result); } catch { /* the sheet still shows the floor */ }
    ui.notifications.info("A magic wielder needs Psyche of at least Good. Psyche is now Good.");
  }
  ui.notifications.info(type.label + " / " + school.label + " / " + energy.label);
  try {
    await actor.update({
      "system.identity.origin": "Magical - " + school.label,
      "system.notes": "<p><strong>School:</strong> " + school.label + " — " + school.notes + "</p><p><strong>Mastery:</strong> " + mastery.label + "</p>" + (actor.system.notes || "")
    });
  } catch {}
  return { type, school, energy, spellCount, itemCount, abilityCs, mastery, bonusLists };
}

export async function applyRomAbilityBonus(prelude, actor, result) {
  const cs = Number(prelude?.abilityCs || 0);
  if (!cs || !result?.abilities) return result;
  const key = await chooseAbility(`Raise one ability +${cs} CS (Amazing is the ceiling)`);
  const before = result.abilities[key];
  if (!raiseAbility(result, key, cs)) {
    ui.notifications.info(`${key} stays ${rankLabel(before)}. The raise stops at Amazing.`);
    return result;
  }
  try { await persistGenerationStats(actor, result); } catch { /* the next save still has the raise */ }
  ui.notifications.info(`${key} is now ${rankLabel(result.abilities[key])}.`);
  return result;
}

function spellSequence(prelude) {
  const lists = prelude?.energy?.lists || ["personal"];
  const count = prelude?.type?.id === "items" ? 0 : Number(prelude?.spellCount || 0);
  const sequence = [];
  const required = lists.includes("dimensional") && count < lists.length
    ? lists.filter((id) => id !== "dimensional")
    : lists.slice();
  for (const id of required) {
    if (sequence.length >= count) break;
    sequence.push(id);
  }
  return {
    sequence,
    open: Math.max(0, count - sequence.length),
    choices: lists.filter((id) => !(id === "dimensional" && count < lists.length))
  };
}

async function chooseList(title, choices) {
  if (choices.length <= 1) return choices[0] || "personal";
  const pick = await dialog(
    title,
    "<p>This extra working stays on an energy you can already use.</p><div class='form-group'><label>Energy</label><select name='list'>" +
      options(choices.map((id) => ({ id, label: id }))) + "</select></div>",
    [{ action: "ok", label: "Use This", default: true, callback: (_e, b, d) => ({ action: "ok", ...collect(b, d) }) }]
  );
  return pick?.list || choices[0];
}

async function rollItemIdentity(actor) {
  const catRoll = await promptedD100({
    title: "Magical item category",
    body: "Weapon, armor, gem, jewelry, a miscellaneous object, or a creature.",
    flavor: (actor?.name || "Hero") + " - item category",
    actor
  });
  if (catRoll == null) return null;
  const category = lookupBand(ROM_ITEM_CATEGORY, catRoll);
  const typeRoll = await promptedD100({
    title: category.label,
    body: "What form the item takes.",
    flavor: (actor?.name || "Hero") + " - item form",
    actor
  });
  if (typeRoll == null) return null;
  const row = lookupBand(ROM_ITEM_TYPES[category.id] || ROM_ITEM_TYPES.misc, typeRoll);
  let label = row.label;
  if (!label) {
    const named = await dialog(
      "Name the item",
      "<div class='form-group'><label>Item</label><input name='name' type='text' /></div>",
      [{ action: "ok", label: "Use This", default: true, callback: (_e, b, d) => ({ action: "ok", ...collect(b, d) }) }]
    );
    label = named?.name || category.label;
  }
  const condRoll = await promptedD100({
    title: "Item condition",
    body: "01-50 no catch. Higher rolls add a limit.",
    flavor: (actor?.name || "Hero") + " - item condition",
    actor
  });
  const condition = lookupBand(ROM_ITEM_CONDITION, condRoll || 1);
  return { label, condition: condition.label };
}

async function takeWorking(actor, prelude, listId, slotLabel) {
  const names = LISTS[listId] || PERSONAL;
  const pick = await dialog(
    slotLabel,
    "<div class='form-group'><label>" + listId + "</label><select name='spell'>" + options(names.map((n) => ({ id: n, label: n }))) + "</select></div>",
    [
      { action: "ok", label: "Take", default: true, callback: (_e, b, d) => ({ action: "ok", ...collect(b, d) }) },
      { action: "skip", label: "Skip" }
    ]
  );
  if (!pick || pick === "skip" || pick === "cancel") return null;
  const name = pick.spell || names[0];
  const rankRoll = await promptedD100({
    title: "Spell rank - " + name,
    body: "01-15 Good, 16-45 Excellent, 46-70 Remarkable, 71-90 Incredible, 91-00 Amazing.",
    flavor: (actor?.name || "Hero") + " - rank",
    actor
  });
  if (rankRoll == null) return null;
  const rank = lookupBand(ROM_SPELL_RANK, rankRoll).id;
  return { name, rank, energy: listId };
}

export async function pickRomSpells(prelude, actor = null) {
  if (!prelude) return [];
  const selected = [];
  const itemMode = prelude.type?.id === "items";
  const sequence = [];
  if (itemMode) {
    const choices = ["personal", "universal"];
    for (let i = 0; i < (prelude.itemCount || 1); i++) {
      sequence.push(await chooseList("Item " + (i + 1) + " energy", choices));
    }
  } else {
    const plan = spellSequence(prelude);
    sequence.push(...plan.sequence);
    for (let i = 0; i < plan.open; i++) {
      sequence.push(await chooseList("Extra spell " + (sequence.length + 1), plan.choices));
    }
    sequence.push(...(prelude.bonusLists || []));
  }
  for (let i = 0; i < sequence.length; i++) {
    const listId = sequence[i];
    let item = null;
    if (itemMode && actor) item = await rollItemIdentity(actor);
    const working = await takeWorking(
      actor,
      prelude,
      listId,
      (itemMode ? "Item working " : "Spell ") + (i + 1) + " of " + sequence.length
    );
    if (!working) continue;
    if (item && actor) {
      await writeGeneratedItem(actor, "equipment", item.label, {
        category: "RoM item",
        definition: item.label + " holds " + working.name + " at " + rankLabel(working.rank) + ". " + item.condition,
        rank: working.rank,
        number: rankMin(working.rank),
        notes: item.condition
      });
    }
    if (actor) {
      let extra = {
        rank: working.rank,
        number: rankMin(working.rank),
        category: "RoM " + listId,
        powerType: "Realms of Magic"
      };
      try {
        const { describeRomSpell } = await import("./data/rom-descriptions.mjs");
        extra = { ...extra, ...describeRomSpell(working.name, { energy: listId, rank: working.rank }) };
      } catch {
        extra.definition = working.name + " is a magical working on the " + listId + " list.";
      }
      if (item) extra.definition = (extra.definition || working.name) + " Held in " + item.label + ".";
      await writeGeneratedItem(actor, "power", working.name, extra);
    }
    selected.push(working);
  }
  return selected;
}

async function writeTalent(actor, name, result = null) {
  if (name === "Campaign talent" && result) {
    const { pickTalents } = await import("./wizard-picks.mjs");
    const one = { ...result, counts: { ...(result.counts || {}), talents: [1, 1] } };
    const picked = await pickTalents(one, actor);
    return picked?.[0] || null;
  }
  let talentName = name;
  if (name === "New talent") {
    const named = await dialog(
      "New talent",
      "<div class='form-group'><label>Name</label><input name='name' type='text' /></div>",
      [{ action: "ok", label: "Take", default: true, callback: (_e, b, d) => ({ action: "ok", ...collect(b, d) }) }]
    );
    talentName = named?.name || "New talent";
  }
  if (!actor) return { name: talentName };
  let extra = { category: "Realms of Magic" };
  try {
    const { ROM_TALENT_DEFINITIONS } = await import("./data/rom-descriptions.mjs");
    const stock = ROM_TALENT_DEFINITIONS[talentName.toLowerCase()];
    if (stock) extra = { ...extra, ...stock };
    else extra.definition = talentName + " is a magical study.";
  } catch {
    extra.definition = talentName + " is a magical study.";
  }
  await writeGeneratedItem(actor, "talent", talentName, extra);
  return { name: talentName };
}

export async function pickRomTalents(prelude, actor = null, result = null) {
  if (!prelude || prelude.type?.id !== "wielder") return [];
  const cRoll = await promptedD100({ title: "Magic-wielder talents", body: "01-35 one, 36-70 two, 71-00 three.", flavor: (actor?.name || "Hero") + " - ROM talents", actor });
  if (cRoll == null) return [];
  const needed = lookupBand(ROM_WIELDER_TALENT_COUNT, cRoll).count;
  const selected = [];
  for (let i = 0; i < needed; i++) {
    const tRoll = await promptedD100({
      title: "Magic-wielder talent " + (i + 1),
      body: "01-35 a campaign talent. 36-95 a listed magical study. 96-00 a new talent.",
      flavor: (actor?.name || "Hero") + " - ROM talent",
      actor
    });
    if (tRoll == null) break;
    const row = lookupBand(ROM_WIELDER_TALENTS, tRoll);
    const taken = await writeTalent(actor, row.label, result);
    if (taken) selected.push(taken);
  }
  if (prelude.school?.id === "scientific") {
    const pick = await dialog(
      "Laboratory talent",
      "<p>Laboratory magic includes one science talent.</p><div class='form-group'><label>Talent</label><select name='name'>" +
        options(SCIENCE_TALENTS.map((name) => ({ id: name, label: name }))) + "</select></div>",
      [{ action: "ok", label: "Take", default: true, callback: (_e, b, d) => ({ action: "ok", ...collect(b, d) }) }]
    );
    const taken = await writeTalent(actor, pick?.name || SCIENCE_TALENTS[0], result);
    if (taken) selected.push(taken);
  }
  return selected;
}

async function randomEnhancedKey(taken) {
  let guard = 0;
  while (guard < 12) {
    guard += 1;
    const face = await rollDie("1d10");
    let key = "endurance";
    if (face <= 2) key = "fighting";
    else if (face <= 4) key = "agility";
    else if (face <= 6) key = "strength";
    else if (face <= 8) key = "endurance";
    else if (face === 9) key = await chooseAbility("Reason or Intuition", taken.concat(["fighting", "agility", "strength", "endurance", "psyche"]));
    else key = "psyche";
    if (!taken.includes(key)) return key;
  }
  return ABILITIES.find((key) => !taken.includes(key)) || "endurance";
}

export async function pickRomEnhancement(prelude, actor, result) {
  if (!prelude || prelude.type?.id !== "enhanced" || !result) return [];
  const eRoll = await promptedD100({
    title: "Magical enhancement",
    body: "Raises chosen or random abilities. Amazing is the ceiling. Some results also grant one Personal working.",
    flavor: (actor?.name || "Hero") + " - enhancement",
    actor
  });
  if (eRoll == null) return [];
  const row = lookupBand(ROM_ENHANCEMENT, eRoll);
  const keys = [];
  for (let i = 0; i < row.select; i++) {
    const key = row.random
      ? await randomEnhancedKey(keys)
      : await chooseAbility("Raised ability " + (i + 1) + " of " + row.select + " (+" + row.raise + " CS)", keys);
    keys.push(key);
    if (!raiseAbility(result, key, row.raise)) {
      ui.notifications.info(`${key} is already at Amazing, so that raise is ignored.`);
    }
  }
  const cRoll = await promptedD100({
    title: "Enhancement condition",
    body: "01-60 permanent. Higher rolls add a limit on when the enhancement works.",
    flavor: (actor?.name || "Hero") + " - enhancement condition",
    actor
  });
  const condition = lookupBand(ROM_ENHANCEMENT_CONDITION, cRoll || 1);
  try {
    await persistGenerationStats(actor, result);
    const note = "<p><strong>Enhancement:</strong> " + keys.join(", ") + " +" + row.raise + " CS. " + condition.label + "</p>";
    await actor.update({ "system.notes": note + (actor.system.notes || "") });
  } catch { /* the abilities are still on the result */ }
  if (!row.power) return [];
  return pickRomSpells({
    ...prelude,
    type: { id: "wielder" },
    energy: ROM_ENERGY[0],
    spellCount: 1,
    bonusLists: []
  }, actor);
}

export async function noteWielderLife(actor, spells = []) {
  if (!actor) return;
  const span = await rollDie("1d10");
  let age = 17 + span;
  for (const spell of spells) {
    if (spell.energy === "personal") age += 1;
    else if (spell.energy === "universal") age += 2;
    else if (spell.energy === "dimensional") age += 3;
  }
  const master = await dialog(
    "Master",
    "<p>A wielder studies under a master. You can name that person now or leave it for later.</p><div class='form-group'><label>Master</label><input name='name' type='text' /></div>",
    [
      { action: "ok", label: "Note the master", default: true, callback: (_e, b, d) => ({ action: "ok", ...collect(b, d) }) },
      { action: "skip", label: "Later" }
    ]
  );
  const masterName = master && master !== "skip" && master !== "cancel" ? master.name : "";
  const line = "<p><strong>Age:</strong> " + age + (masterName ? ". <strong>Master:</strong> " + masterName : "") + "</p>";
  try {
    await actor.update({
      "system.identity.age": String(age),
      "system.notes": line + (actor.system.notes || "")
    });
  } catch { /* age can be written on the sheet */ }
}

export async function pickRomResources(prelude, actor, result) {
  if (!prelude || prelude.type?.id !== "wielder" || !result) return result;
  const rRoll = await promptedD100({ title: "Magic-wielder Resources", body: "01-05 Poor through 00 Amazing.", flavor: (actor?.name || "Hero") + " - resources", actor });
  if (rRoll != null) result.resources = lookupBand(ROM_RESOURCE_RANK, rRoll).id;
  const cRoll = await promptedD100({ title: "Starting Resource cache", body: "01-20 250, 21-45 500, 46-75 1000, 76-90 2500, 91-00 5000.", flavor: (actor?.name || "Hero") + " - cache", actor });
  const cache = lookupBand(ROM_RESOURCE_CACHE, cRoll || 50).rp;
  try { await persistGenerationStats(actor, result); await actor.setFlag("faserip", "resourceCache", cache); } catch {}
  return result;
}

export function romContactSlots() {
  return 0;
}
