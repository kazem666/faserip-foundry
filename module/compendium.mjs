import { POWER_CATALOG, TALENT_CATALOG } from "./config-catalogs.mjs";
import { upbCatalogGroups } from "./data/upb.mjs";
import { buildCatalogItemData, catalogKey, describeCatalogItem, POWER_DEFINITIONS, upbHint } from "./data/descriptions.mjs";

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
  other: "Other Skills"
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

async function locateOrCreatePack(name, label) {
  const collection = `world.${name}`;
  let pack = game.packs.get(collection);
  if (pack) return pack;
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
  return game.packs.get(collection) ?? pack;
}

async function syncPack(pack, documents) {
  if (!pack) return 0;
  const index = await pack.getIndex({ fields: ["name", "type"] });
  const have = new Set(index.map((e) => `${e.type}:${e.name}`));
  const missing = documents.filter((doc) => !have.has(`${doc.type}:${doc.name}`));
  if (!missing.length) return 0;
  const ItemDoc = CONFIG.Item.documentClass ?? foundry.documents?.Item ?? globalThis.Item;
  await ItemDoc.createDocuments(missing, { pack: pack.collection, keepId: false });
  return missing.length;
}

export async function ensureCatalogPacks({ notify = false } = {}) {
  if (!game.user?.isGM) return;
  const powerPack = await locateOrCreatePack(POWER_PACK, "FASERIP Powers");
  const talentPack = await locateOrCreatePack(TALENT_PACK, "FASERIP Talents");
  const addedPowers = await syncPack(powerPack, buildPowerDocuments());
  const addedTalents = await syncPack(talentPack, buildTalentDocuments());
  if (notify) {
    ui.notifications.info(`FASERIP compendia ready. Powers +${addedPowers}, Talents +${addedTalents}.`);
  } else if (addedPowers || addedTalents) {
    ui.notifications.info(`FASERIP loaded Powers and Talents into Compendium packs.`);
  }
}

export async function fillActorDefinitions(actor) {
  if (!actor?.items) return 0;
  const updates = [];
  for (const item of actor.items) {
    if (item.type !== "power" && item.type !== "talent") continue;
    const info = describeCatalogItem(item.type, item.name, {
      category: item.system.category,
      definition: item.system.definition
    });
    const patch = { _id: item.id };
    let dirty = false;
    if (!item.system.definition && info.definition) {
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
