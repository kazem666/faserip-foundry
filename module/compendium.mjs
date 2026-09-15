import { POWER_CATALOG, TALENT_CATALOG } from "./config-catalogs.mjs";
import { upbCatalogGroups } from "./data/upb.mjs";
import { buildCatalogItemData, catalogKey, describeCatalogItem, isGenericDefinition, POWER_DEFINITIONS, upbHint } from "./data/descriptions.mjs";
import {
  WEAPON_CATALOG, AMMO_CATALOG, VEHICLE_CATALOG, PLACE_CATALOG,
  EQUIPMENT_CATALOG, CREATURE_CATALOG, CONTACT_CATALOG, GEAR_PACKS, flattenCatalog
} from "./data/gear-catalogs.mjs";

const POWER_PACK = "faserip-powers";
const TALENT_PACK = "faserip-talents";

const CAT_LABEL = {
  resistances: "Resistances",
  senses: "Senses",
  movement: "Movement",
  matter: "Matter Control",
  energy: "Energy Control",
  bodyControl: "Body Control",
  distance: "Distance Attacks",
  mental: "Mental Powers",
  offensive: "Body Alterations / Offensive",
  defensive: "Body Alterations / Defensive",
  weapon: "Weapon Skills",
  fighting: "Fighting Skills",
  professional: "Professional Skills",
  scientific: "Scientific Skills",
  mystic: "Mystic and Mental Skills",
  other: "Other Skills",
  melee: "Melee Weapons",
  shooting: "Shooting Weapons",
  bow: "Bows",
  thrown: "Thrown Weapons",
  ammo: "Ammunition",
  road: "Road Vehicles",
  offRoad: "Off-Road Vehicles",
  railed: "Railed Vehicles",
  gev: "Ground-Effect Vehicles",
  air: "Air Vehicles",
  space: "Space Vehicles",
  water: "Water Vehicles",
  sub: "Submersibles",
  buildings: "Buildings",
  rooms: "Room Packages",
  work: "Work Packages",
  defense: "Defense Packages",
  support: "Support Packages",
  tools: "Tools",
  armor: "Armor",
  packs: "Reloads",
  hardware: "Hardware",
  domestic: "Domestic Creatures",
  wild: "Wild Creatures",
  unusual: "Unusual Creatures",
  types: "Contact Types",
  creature: "Creatures"
};

export function listPowerCatalogEntries() {
  const rows = [];
  for (const [id, list] of Object.entries(POWER_CATALOG)) {
    for (const raw of list) {
      rows.push({ raw, category: CAT_LABEL[id] || id, source: "Advanced Set" });
    }
  }
  for (const group of upbCatalogGroups()) {
    for (const raw of group.items) {
      rows.push({
        raw,
        category: group.label,
        source: "UPB",
        hint: upbHint(group.id)
      });
    }
  }
  return rows;
}

export function listTalentCatalogEntries() {
  const rows = [];
  for (const [id, list] of Object.entries(TALENT_CATALOG)) {
    for (const raw of list) {
      rows.push({ raw, category: CAT_LABEL[id] || id, source: "Advanced Set" });
    }
  }
  return rows;
}

export function buildPowerDocuments() {
  return listPowerCatalogEntries().map((row) => {
    const extra = { category: row.category };
    if (row.hint && !POWER_DEFINITIONS[catalogKey(row.raw)]) {
      extra.definition = `${row.raw.replace(/\s*\(counts as two[^)]*\)/gi, "").trim()}. ${row.hint}`;
    }
    const data = buildCatalogItemData("power", row.raw, extra);
    data.system.powerType = row.source;
    return data;
  });
}

export function buildTalentDocuments() {
  return listTalentCatalogEntries().map((row) =>
    buildCatalogItemData("talent", row.raw, { category: row.category })
  );
}

function labeled(catalog, fallback = "") {
  return flattenCatalog(catalog).map((row) => ({
    raw: row.raw,
    category: CAT_LABEL[row.category] || row.category || fallback
  }));
}

export function buildWeaponDocuments() {
  return labeled(WEAPON_CATALOG, "Weapons").map((row) =>
    buildCatalogItemData("weapon", row.raw, { category: row.category })
  );
}

export function buildAmmoDocuments() {
  return AMMO_CATALOG.map((raw) =>
    buildCatalogItemData("equipment", raw, { category: "Ammunition" })
  );
}

export function buildVehicleDocuments() {
  return labeled(VEHICLE_CATALOG, "Vehicles").map((row) =>
    buildCatalogItemData("equipment", row.raw, { category: row.category })
  );
}

export function buildPlaceDocuments() {
  return labeled(PLACE_CATALOG, "Places").map((row) =>
    buildCatalogItemData("equipment", row.raw, { category: row.category })
  );
}

export function buildEquipmentDocuments() {
  return labeled(EQUIPMENT_CATALOG, "Equipment").map((row) =>
    buildCatalogItemData("equipment", row.raw, { category: row.category })
  );
}

export function buildCreatureDocuments() {
  return labeled(CREATURE_CATALOG, "Creatures").map((row) =>
    buildCatalogItemData("equipment", row.raw, { category: row.category })
  );
}

export function buildContactDocuments() {
  return labeled(CONTACT_CATALOG, "Contacts").map((row) =>
    buildCatalogItemData("contact", row.raw, { category: row.category, occupation: row.raw })
  );
}

const BUILDERS = {
  weapons: buildWeaponDocuments,
  ammo: buildAmmoDocuments,
  vehicles: buildVehicleDocuments,
  places: buildPlaceDocuments,
  equipment: buildEquipmentDocuments,
  creatures: buildCreatureDocuments,
  contacts: buildContactDocuments
};

function packIsLocked(pack) {
  if (!pack) return true;
  if (pack.locked) return true;
  const pkg = pack.metadata?.packageType || pack.metadata?.package;
  if (pkg === "system" || String(pack.collection || "").startsWith("faserip.")) return true;
  return false;
}

async function locateOrCreatePack(name, label) {
  const collection = `world.${name}`;
  let pack = game.packs.get(collection);
  if (pack && !packIsLocked(pack)) return pack;
  const worldMatch = [...(game.packs ?? [])].find((p) => {
    if (packIsLocked(p)) return false;
    return p.collection === collection || p.metadata?.name === name;
  });
  if (worldMatch) return worldMatch;
  const meta = { name, label, type: "Item", system: "faserip" };
  try {
    const Ctor = foundry.documents?.collections?.CompendiumCollection;
    if (Ctor?.createCompendium) pack = await Ctor.createCompendium(meta);
  } catch (err) {
    console.warn("FASERIP | CompendiumCollection.createCompendium", err);
  }
  if (!pack && game.packs?.createCompendium) {
    try { pack = await game.packs.createCompendium(meta); } catch (err) {
      console.warn("FASERIP | game.packs.createCompendium", err);
    }
  }
  pack = game.packs.get(collection) ?? pack;
  if (pack && packIsLocked(pack)) return null;
  return pack;
}

async function syncPack(pack, documents) {
  if (!pack) return 0;
  if (packIsLocked(pack)) return 0;
  const index = await pack.getIndex({ fields: ["name", "type", "system"] });
  const have = new Map(index.map((e) => [`${e.type}:${e.name}`, e]));
  const missing = [];
  const updates = [];
  for (const doc of documents) {
    const existing = have.get(`${doc.type}:${doc.name}`);
    if (!existing) {
      missing.push(doc);
      continue;
    }
    const oldDef = existing.system?.definition ?? "";
    const nextDef = doc.system?.definition ?? "";
    if (nextDef && (isGenericDefinition(oldDef) || oldDef !== nextDef)) {
      const patch = { _id: existing._id, "system.definition": nextDef };
      if (doc.system?.category && !existing.system?.category) patch["system.category"] = doc.system.category;
      if (doc.system?.bonus && !existing.system?.bonus) patch["system.bonus"] = doc.system.bonus;
      if (doc.system?.attribute && !existing.system?.attribute) patch["system.attribute"] = doc.system.attribute;
      if (doc.system?.powerType && !existing.system?.powerType) patch["system.powerType"] = doc.system.powerType;
      if (doc.system?.weaponType && !existing.system?.weaponType) patch["system.weaponType"] = doc.system.weaponType;
      if (doc.system?.damage && !existing.system?.damage) patch["system.damage"] = doc.system.damage;
      if (doc.system?.range && !existing.system?.range) patch["system.range"] = doc.system.range;
      if (doc.system?.material && !existing.system?.material) patch["system.material"] = doc.system.material;
      if (doc.system?.occupation && !existing.system?.occupation) patch["system.occupation"] = doc.system.occupation;
      if (doc.system?.effectsColumn && !existing.system?.effectsColumn) patch["system.effectsColumn"] = doc.system.effectsColumn;
      updates.push(patch);
    }
  }
  const ItemDoc = CONFIG.Item.documentClass ?? foundry.documents?.Item ?? globalThis.Item;
  try {
    if (missing.length) await ItemDoc.createDocuments(missing, { pack: pack.collection, keepId: false });
    if (updates.length) await ItemDoc.updateDocuments(updates, { pack: pack.collection });
  } catch (err) {
    const msg = String(err?.message || err);
    if (/locked compendium/i.test(msg)) return 0;
    throw err;
  }
  return missing.length + updates.length;
}

export async function ensureCatalogPacks({ notify = false } = {}) {
  if (!game.user?.isGM) return;
  const powerPack = await locateOrCreatePack(POWER_PACK, "FASERIP Powers");
  const talentPack = await locateOrCreatePack(TALENT_PACK, "FASERIP Talents");
  const addedPowers = await syncPack(powerPack, buildPowerDocuments());
  const addedTalents = await syncPack(talentPack, buildTalentDocuments());
  const gearAdded = {};
  for (const spec of GEAR_PACKS) {
    try {
      const pack = await locateOrCreatePack(spec.name, spec.label);
      const builder = BUILDERS[spec.builder];
      gearAdded[spec.builder] = builder ? await syncPack(pack, builder()) : 0;
    } catch (err) {
      const msg = String(err?.message || err);
      if (!/locked compendium/i.test(msg)) console.warn("FASERIP | gear pack", spec.name, err);
      gearAdded[spec.builder] = 0;
    }
  }
  const gearTotal = Object.values(gearAdded).reduce((a, b) => a + b, 0);
  if (notify) {
    ui.notifications.info(`FASERIP compendia ready. Powers +${addedPowers}, Talents +${addedTalents}, Gear +${gearTotal}.`);
  } else if (addedPowers || addedTalents || gearTotal) {
    ui.notifications.info("FASERIP loaded Powers, Talents, and Gear into world Compendium packs.");
  }
}

const FILL_TYPES = new Set(["power", "talent", "weapon", "equipment", "contact"]);

export async function fillActorDefinitions(actor) {
  if (!actor?.items) return 0;
  const updates = [];
  for (const item of actor.items) {
    if (!FILL_TYPES.has(item.type)) continue;
    const info = describeCatalogItem(item.type, item.name, {
      category: item.system.category,
      definition: item.system.definition
    });
    const patch = { _id: item.id };
    let dirty = false;
    if (info.definition && (isGenericDefinition(item.system.definition) || !item.system.definition)) {
      patch["system.definition"] = info.definition;
      dirty = true;
    }
    if (item.type === "talent") {
      if (!item.system.bonus && info.bonus) {
        patch["system.bonus"] = info.bonus;
        dirty = true;
      }
      if (!item.system.attribute && info.attribute) {
        patch["system.attribute"] = info.attribute;
        dirty = true;
      }
    }
    if (item.type === "weapon") {
      if (!item.system.weaponType && info.weaponType) {
        patch["system.weaponType"] = info.weaponType;
        dirty = true;
      }
      if (!item.system.damage && info.damage) {
        patch["system.damage"] = info.damage;
        dirty = true;
      }
      if ((!item.system.range || item.system.range === "1 area") && info.range) {
        patch["system.range"] = info.range;
        dirty = true;
      }
      if (!item.system.effectsColumn && info.effectsColumn) {
        patch["system.effectsColumn"] = info.effectsColumn;
        dirty = true;
      }
    }
    if (dirty) updates.push(patch);
  }
  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
  return updates.length;
}

export async function fillWorldDefinitions() {
  let n = 0;
  for (const actor of game.actors ?? []) {
    try { n += await fillActorDefinitions(actor); } catch (err) {
      console.warn("FASERIP | fill definitions", actor.name, err);
    }
  }
  return n;
}
