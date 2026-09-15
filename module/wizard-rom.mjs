import {
  isRomEnabled, wantRom, lookupBand, schoolById, startingMastery,
  ROM_CHARACTER_TYPE, ROM_ENERGY, ROM_SPELL_COUNT, ROM_SPELL_RANK,
  ROM_WIELDER_TALENT_COUNT, ROM_ITEM_COUNT, ROM_SCHOOLS, ROM_SCHOOL_TABLE,
  ROM_RESOURCE_RANK, ROM_RESOURCE_CACHE, ROM_ENHANCEMENT,
  ROM_ENHANCEMENT_CONDITION, ROM_ITEM_CONDITION
} from "./data/rom.mjs";
import { dialog, collect, options } from "./wizard-picks.mjs";
import { writeGeneratedItem, persistGenerationStats } from "./chargen.mjs";
import { promptedD100 } from "./dice/percentile.mjs";
import { rankLabel, rankMin, shiftRank } from "./config.mjs";

export { isRomEnabled, wantRom };

const PERSONAL = ["Absorption", "Armor", "Alteration - Appearance", "Healing", "Invisibility", "Levitation"];
const UNIVERSAL = ["Eldritch Beam", "Matter Animation", "Shield", "Teleport", "Illusion", "Bind"];
const DIMENSIONAL = ["Dimensional Aperture", "Entreaty", "Banishment", "Dimensional Gate"];
const LISTS = { personal: PERSONAL, universal: UNIVERSAL, dimensional: DIMENSIONAL };
const ITEM_NAMES = ["Enchanted Sword", "Enchanted Mail", "Focus Ruby", "Amulet", "Staff", "Wand", "Familiar"];
const ROM_TALENT_NAMES = ["Demonologist", "Occultist", "Runesmith", "Bibliophile", "Theogonist", "Chronicler of Magic"];
export const ROM_CONTACTS = ["Master of the School", "Fellow Disciple", "Relic Dealer", "Occult Librarian", "Temple Keeper"];

export async function pickRomPrelude(actor) {
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
  if (school.id === "scientific" && type.id === "wielder") spellCount += 3;
  const mastery = startingMastery(type.id === "wielder" ? spellCount : 0);
  ui.notifications.info(type.label + " / " + school.label + " / " + energy.label);
  try {
    await actor.update({
      "system.identity.origin": "Magical - " + school.label,
      "system.notes": "<p><strong>School:</strong> " + school.label + " — " + school.notes + "</p><p><strong>Mastery:</strong> " + mastery.label + "</p>" + (actor.system.notes || "")
    });
  } catch {}
  return { type, school, energy, spellCount, itemCount, abilityCs, mastery };
}

export async function pickRomSpells(prelude, actor = null) {
  if (!prelude) return [];
  const selected = [];
  const lists = prelude.energy.lists || ["personal"];
  const needed = prelude.type?.id === "items" ? (prelude.itemCount || 1) : (prelude.spellCount || 3);
  for (let i = 0; i < needed; i++) {
    const listId = lists[i % lists.length];
    const names = LISTS[listId] || PERSONAL;
    const pick = await dialog(
      (prelude.type?.id === "items" ? "Item working " : "Spell ") + (i + 1) + " of " + needed,
      "<div class='form-group'><label>" + listId + "</label><select name='spell'>" + options(names.map((n) => ({ id: n, label: n }))) + "</select></div>",
      [
        { action: "ok", label: "Take", default: true, callback: (_e, b, d) => ({ action: "ok", ...collect(b, d) }) },
        { action: "skip", label: "Skip" }
      ]
    );
    if (!pick || pick === "skip" || pick === "cancel") continue;
    const name = pick.spell || names[0];
    const rankRoll = await promptedD100({ title: "Spell rank - " + name, body: "01-15 Good, 16-45 Excellent, 46-70 Remarkable, 71-90 Incredible, 91-00 Amazing.", flavor: (actor?.name || "Hero") + " - rank", actor });
    if (rankRoll == null) break;
    const rank = lookupBand(ROM_SPELL_RANK, rankRoll).id;
    if (prelude.type?.id === "items" && actor) {
      const itemName = ITEM_NAMES[i % ITEM_NAMES.length];
      await writeGeneratedItem(actor, "equipment", itemName, {
        category: "RoM item",
        definition: itemName + " holds " + name + " at " + rankLabel(rank) + ".",
        rank, number: rankMin(rank)
      });
    }
    if (actor) {
      let extra = {
        rank, number: rankMin(rank), category: "RoM " + listId,
        powerType: "Realms of Magic"
      };
      try {
        const { describeRomSpell } = await import("./data/rom-descriptions.mjs");
        extra = { ...extra, ...describeRomSpell(name, { energy: listId, rank }) };
      } catch {
        extra.definition = name + " is a magical working on the " + listId + " list.";
      }
      await writeGeneratedItem(actor, "power", name, extra);
    }
    selected.push({ name, rank, energy: listId });
  }
  return selected;
}

export async function pickRomTalents(prelude, actor = null) {
  if (!prelude || prelude.type?.id !== "wielder") return [];
  const cRoll = await promptedD100({ title: "Magic-wielder talents", body: "01-35 one, 36-70 two, 71-00 three.", flavor: (actor?.name || "Hero") + " - ROM talents", actor });
  if (cRoll == null) return [];
  const needed = lookupBand(ROM_WIELDER_TALENT_COUNT, cRoll).count;
  const selected = [];
  for (let i = 0; i < needed; i++) {
    const name = ROM_TALENT_NAMES[i % ROM_TALENT_NAMES.length];
    selected.push({ name });
    if (actor) {
      let extra = { category: "Realms of Magic" };
      try {
        const { ROM_TALENT_DEFINITIONS } = await import("./data/rom-descriptions.mjs");
        const stock = ROM_TALENT_DEFINITIONS[name.toLowerCase()];
        if (stock) extra = { ...extra, ...stock };
      } catch {
        extra.definition = name + " is a magical talent.";
      }
      await writeGeneratedItem(actor, "talent", name, extra);
    }
  }
  return selected;
}

export async function pickRomEnhancement(prelude, actor, result) {
  if (!prelude || prelude.type?.id !== "enhanced" || !result) return [];
  const eRoll = await promptedD100({ title: "Magical enhancement", body: "Raises abilities (cap Amazing) and may grant one Personal working.", flavor: (actor?.name || "Hero") + " - enhancement", actor });
  if (eRoll == null) return [];
  const row = lookupBand(ROM_ENHANCEMENT, eRoll);
  const key = "strength";
  if (result.abilities[key]) {
    result.abilities[key] = shiftRank(result.abilities[key], row.raise || 1);
    result.numbers[key] = rankMin(result.abilities[key]);
  }
  try { await persistGenerationStats(actor, result); } catch {}
  return row.power ? pickRomSpells({ ...prelude, type: { id: "wielder" }, energy: ROM_ENERGY[0], spellCount: 1 }, actor) : [];
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

export function romContactSlots(prelude, selectedPowers = []) {
  return Math.max(Number(prelude?.itemCount || 0), Number(selectedPowers.length || prelude?.spellCount || 0), 1);
}
