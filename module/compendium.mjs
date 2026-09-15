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
    buildCatalogItemData("equipment", raw.raw ? raw.raw : raw, { category: raw.category || row.category })
  );
}
