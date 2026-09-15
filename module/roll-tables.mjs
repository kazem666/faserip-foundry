/**
 * Seed Foundry RollTables for each generation catalog, split by category.
 * Text results only — no copyrighted book wording.
 */

import { ORIGINS, ORIGIN_TABLE, RANDOM_RANKS, ABILITY_MODIFIER_TABLE, SPECIAL_COUNT_TABLE, POWER_CATEGORIES, POWER_CATALOG, TALENT_CATEGORIES, TALENT_CATALOG, CONTACT_TYPES, RANK_BY_ID } from "./config.mjs";
import { UPB_POWERS, UPB_POWER_CLASSES, UPB_COUNT_TABLE, UPB_WEAKNESS_STIMULUS, UPB_WEAKNESS_EFFECT, UPB_WEAKNESS_DURATION } from "./data/upb.mjs";
import { UPB_PHYSICAL_FORMS, UPB_ORIGINS_OF_POWER } from "./data/upb-forms.mjs";
import {
  ROM_CHARACTER_TYPE,
  ROM_ENERGY,
  ROM_SPELL_COUNT,
  ROM_SPELL_RANK,
  ROM_WIELDER_TALENT_COUNT,
  ROM_ITEM_COUNT,
  ROM_RESOURCE_RANK,
  ROM_RESOURCE_CACHE,
  ROM_ENHANCEMENT,
  ROM_ENHANCEMENT_CONDITION,
  ROM_ITEM_CONDITION,
  ROM_SCHOOL_TABLE,
  schoolById
} from "./data/rom.mjs";

const PACK_NAME = "faserip-roll-tables";
const PACK_LABEL = "FASERIP Roll Tables";

function resultRow(lo, hi, text, i) {
  return {
    _id: undefined,
    type: 0,
    text: String(text),
    name: String(text),
    weight: 1,
    range: [lo, hi],
    drawn: false,
    img: "icons/svg/d20-grey.svg",
    flags: { faserip: { catalog: true } }
  };
}

function tableDoc(name, description, rows, formula = "1d100") {
  return {
    name,
    img: "icons/svg/d20-grey.svg",
    description: description || "",
    formula,
    replacement: true,
    displayRoll: true,
    results: rows.map((row, i) => resultRow(row.lo, row.hi, row.text, i)),
    flags: { faserip: { catalog: true } }
  };
}

function originLabel(id) {
  return ORIGINS.find((o) => o.id === id)?.label || id;
}

function rankText(id) {
  return RANK_BY_ID[id]?.label || id;
}

export function buildRollTableDocuments() {
  const tables = [];

  tables.push(tableDoc(
    "Advanced — Origin",
    "Advanced Set origin of the hero (01–00).",
    ORIGIN_TABLE.map((row) => ({ lo: row.lo, hi: row.hi, text: originLabel(row.id) }))
  ));

  for (const col of [1, 2, 3, 4, 5]) {
    tables.push(tableDoc(
      `Advanced — Random Ranks Column ${col}`,
      `Primary-ability ranks on Random Ranks column ${col}.`,
      RANDOM_RANKS[col].map((row) => ({ lo: row.lo, hi: row.hi, text: rankText(row.id) }))
    ));
  }

  tables.push(tableDoc(
    "Advanced — Resource Modifier",
    "Column shift applied to starting Resources.",
    ABILITY_MODIFIER_TABLE.map((row) => ({ lo: row.lo, hi: row.hi, text: row.label }))
  ));

  tables.push(tableDoc(
    "Advanced — Powers / Talents / Contacts Count",
    "Starting and maximum special-ability counts.",
    SPECIAL_COUNT_TABLE.map((row) => ({
      lo: row.lo,
      hi: row.hi,
      text: `Powers ${row.powers[0]}-${row.powers[1]}, Talents ${row.talents[0]}-${row.talents[1]}, Contacts ${row.contacts[0]}-${row.contacts[1]}`
    }))
  ));

  tables.push(tableDoc(
    "Advanced — Power Category",
    "Which Advanced Set power list to roll on next.",
    POWER_CATEGORIES.map((row) => ({ lo: row.lo, hi: row.hi, text: row.label }))
  ));

  for (const cat of POWER_CATEGORIES) {
    const list = POWER_CATALOG[cat.id] || [];
    if (!list.length) continue;
    const rows = list.map((name, i) => {
      const lo = Math.floor((i * 100) / list.length) + 1;
      const hi = Math.floor(((i + 1) * 100) / list.length) || 100;
      return { lo: i === 0 ? 1 : lo, hi: i === list.length - 1 ? 100 : hi, text: name };
    });
    tables.push(tableDoc(`Advanced — ${cat.label}`, `Powers in the ${cat.label} category.`, rows));
  }

  tables.push(tableDoc(
    "Advanced — Talent Category",
    "Which Advanced Set talent list to roll on next.",
    TALENT_CATEGORIES.map((row) => ({ lo: row.lo, hi: row.hi, text: row.label }))
  ));

  for (const cat of TALENT_CATEGORIES) {
    const list = TALENT_CATALOG[cat.id] || [];
    if (!list.length) continue;
    const rows = list.map((name, i) => {
      const lo = Math.floor((i * 100) / list.length) + 1;
      const hi = Math.floor(((i + 1) * 100) / list.length) || 100;
      return { lo: i === 0 ? 1 : lo, hi: i === list.length - 1 ? 100 : hi, text: name };
    });
    tables.push(tableDoc(`Advanced — ${cat.label}`, `Talents in the ${cat.label} category.`, rows));
  }

  if (CONTACT_TYPES?.length) {
    const rows = CONTACT_TYPES.map((name, i) => {
      const lo = Math.floor((i * 100) / CONTACT_TYPES.length) + 1;
      const hi = Math.floor(((i + 1) * 100) / CONTACT_TYPES.length) || 100;
      return { lo: i === 0 ? 1 : lo, hi: i === CONTACT_TYPES.length - 1 ? 100 : hi, text: name };
    });
    tables.push(tableDoc("Advanced — Contact Type", "Starting Contact occupations.", rows));
  }

  tables.push(tableDoc(
    "UPB — Physical Form",
    "MA3 physical form (01–00).",
    UPB_PHYSICAL_FORMS.map((row) => ({ lo: row.lo, hi: row.hi, text: `${row.label} (col ${row.column})` }))
  ));

  tables.push(tableDoc(
    "UPB — Origin of Power",
    "How the Powers arrived.",
    UPB_ORIGINS_OF_POWER.map((row) => ({ lo: row.lo, hi: row.hi, text: row.label }))
  ));

  tables.push(tableDoc(
    "UPB — Power Class",
    "Which UPB class table to roll on next.",
    UPB_POWER_CLASSES.map((row) => ({ lo: row.lo, hi: row.hi, text: `${row.label} (${row.code})` }))
  ));

  tables.push(tableDoc(
    "UPB — Powers / Talents / Contacts Count",
    "MA3 starting and maximum counts.",
    UPB_COUNT_TABLE.map((row) => ({
      lo: row.lo,
      hi: row.hi,
      text: `Powers ${row.powers[0]}-${row.powers[1]}, Talents ${row.talents[0]}-${row.talents[1]}, Contacts ${row.contacts[0]}-${row.contacts[1]}`
    }))
  ));

  for (const cls of UPB_POWER_CLASSES) {
    const list = UPB_POWERS[cls.id] || [];
    if (!list.length) continue;
    tables.push(tableDoc(
      `UPB — ${cls.label}`,
      `${cls.label} class (${cls.code}), 01–00.`,
      list.map((row) => ({
        lo: row.lo,
        hi: row.hi,
        text: row.countsAsTwo ? `${row.name} (counts as two)` : row.name
      }))
    ));
  }

  if (UPB_POWERS.addendaRank?.length) {
    tables.push(tableDoc(
      "UPB — Addenda Rank / Award",
      "Optional addenda R-class Powers. Not on the main class table.",
      UPB_POWERS.addendaRank.map((row) => ({ lo: row.lo, hi: row.hi, text: row.name }))
    ));
  }
  if (UPB_POWERS.addendaForm?.length) {
    tables.push(tableDoc(
      "UPB — Addenda Form",
      "Collective Mass and similar omitted forms.",
      UPB_POWERS.addendaForm.map((row) => ({ lo: row.lo, hi: row.hi, text: row.name }))
    ));
  }

  tables.push(tableDoc(
    "UPB — Weakness Stimulus",
    "What triggers a generated weakness.",
    UPB_WEAKNESS_STIMULUS.map((row) => ({ lo: row.lo, hi: row.hi, text: row.label }))
  ));
  tables.push(tableDoc(
    "UPB — Weakness Effect",
    "What the weakness does.",
    UPB_WEAKNESS_EFFECT.map((row) => ({ lo: row.lo, hi: row.hi, text: row.label }))
  ));
  tables.push(tableDoc(
    "UPB — Weakness Duration",
    "How long the weakness lasts.",
    UPB_WEAKNESS_DURATION.map((row) => ({ lo: row.lo, hi: row.hi, text: row.label }))
  ));

  tables.push(tableDoc(
    "RoM — Character Type",
    "Magical-character path (01–00).",
    ROM_CHARACTER_TYPE.map((row) => ({ lo: row.lo, hi: row.hi, text: row.label }))
  ));
  tables.push(tableDoc(
    "RoM — School",
    "School of magic (01–00).",
    ROM_SCHOOL_TABLE.map((row) => ({ lo: row.lo, hi: row.hi, text: schoolById(row.id).label }))
  ));
  tables.push(tableDoc(
    "RoM — Energy Sources",
    "Personal / Universal / Dimensional lists available.",
    ROM_ENERGY.map((row) => ({ lo: row.lo, hi: row.hi, text: row.label }))
  ));
  tables.push(tableDoc(
    "RoM — Starting Spell Count",
    "How many starting workings a wielder begins with.",
    ROM_SPELL_COUNT.map((row) => ({ lo: row.lo, hi: row.hi, text: String(row.count) }))
  ));
  tables.push(tableDoc(
    "RoM — Spell Rank",
    "Starting rank of a working or item-held working.",
    ROM_SPELL_RANK.map((row) => ({ lo: row.lo, hi: row.hi, text: rankText(row.id) }))
  ));
  tables.push(tableDoc(
    "RoM — Wielder Talent Count",
    "How many magic-wielder talents to take.",
    ROM_WIELDER_TALENT_COUNT.map((row) => ({ lo: row.lo, hi: row.hi, text: String(row.count) }))
  ));
  tables.push(tableDoc(
    "RoM — Magical Item Count",
    "Starting enchanted items and any ability CS.",
    ROM_ITEM_COUNT.map((row) => ({
      lo: row.lo,
      hi: row.hi,
      text: `${row.count} item(s)` + (row.abilityCs ? ` (+${row.abilityCs} CS)` : "")
    }))
  ));
  tables.push(tableDoc(
    "RoM — Wielder Resources",
    "Starting Resources for a magic wielder.",
    ROM_RESOURCE_RANK.map((row) => ({ lo: row.lo, hi: row.hi, text: rankText(row.id) }))
  ));
  tables.push(tableDoc(
    "RoM — Resource Cache",
    "Starting Resource-point cache.",
    ROM_RESOURCE_CACHE.map((row) => ({ lo: row.lo, hi: row.hi, text: String(row.rp) }))
  ));
  tables.push(tableDoc(
    "RoM — Enhancement",
    "How many abilities rise, and whether a Personal working is granted.",
    ROM_ENHANCEMENT.map((row) => ({
      lo: row.lo,
      hi: row.hi,
      text: `${row.select} abilit${row.select === 1 ? "y" : "ies"} +${row.raise} CS` +
        (row.random ? ", random" : ", chosen") +
        (row.power ? ", plus one Personal working" : "")
    }))
  ));
  tables.push(tableDoc(
    "RoM — Enhancement Condition",
    "Whether an enhancement needs a catch.",
    ROM_ENHANCEMENT_CONDITION.map((row) => ({ lo: row.lo, hi: row.hi, text: row.label }))
  ));
  tables.push(tableDoc(
    "RoM — Item Condition",
    "Catch or extra working on a starting magical item.",
    ROM_ITEM_CONDITION.map((row) => ({ lo: row.lo, hi: row.hi, text: row.label }))
  ));

  return tables;
}

function packIsLocked(pack) {
  if (!pack) return true;
  if (pack.locked) return true;
  const pkg = pack.metadata?.packageType || pack.metadata?.package;
  if (pkg === "system" || String(pack.collection || "").startsWith("faserip.")) return true;
  return false;
}

async function locateOrCreatePack() {
  const collection = `world.${PACK_NAME}`;
  let pack = game.packs.get(collection);
  if (pack && !packIsLocked(pack)) return pack;
  const worldMatch = [...(game.packs ?? [])].find((p) => {
    if (packIsLocked(p)) return false;
    return p.collection === collection || p.metadata?.name === PACK_NAME;
  });
  if (worldMatch) return worldMatch;
  const meta = { name: PACK_NAME, label: PACK_LABEL, type: "RollTable", system: "faserip" };
  try {
    const Ctor = foundry.documents?.collections?.CompendiumCollection;
    if (Ctor?.createCompendium) pack = await Ctor.createCompendium(meta);
  } catch (err) {
    console.warn("FASERIP | roll-table pack", err);
  }
  if (!pack && game.packs?.createCompendium) {
    try { pack = await game.packs.createCompendium(meta); } catch (err) {
      console.warn("FASERIP | roll-table pack", err);
    }
  }
  return game.packs.get(collection) ?? pack;
}

export async function ensureRollTables({ notify = false } = {}) {
  if (!game.user?.isGM) return 0;
  const pack = await locateOrCreatePack();
  if (!pack || packIsLocked(pack)) return 0;
  const docs = buildRollTableDocuments();
  const index = await pack.getIndex({ fields: ["name"] });
  const have = new Set(index.map((e) => e.name));
  const missing = docs.filter((d) => !have.has(d.name));
  if (!missing.length) {
    if (notify) ui.notifications.info(`FASERIP roll tables ready (${index.size || have.size}).`);
    return 0;
  }
  const TableDoc = CONFIG.RollTable?.documentClass ?? foundry.documents?.RollTable ?? globalThis.RollTable;
  try {
    await TableDoc.createDocuments(missing, { pack: pack.collection, keepId: false });
  } catch (err) {
    const msg = String(err?.message || err);
    if (/locked compendium/i.test(msg)) return 0;
    console.warn("FASERIP | roll table seed", err);
    return 0;
  }
  if (notify) ui.notifications.info(`FASERIP roll tables: +${missing.length} tables.`);
  return missing.length;
}
