import { rankLabel, intensityNeeded } from "./config.mjs";
import { dialog, collect, options } from "./wizard-picks.mjs";
import { writeGeneratedItem } from "./chargen.mjs";
import {
  WEAPON_CATALOG, AMMO_CATALOG, VEHICLE_CATALOG, EQUIPMENT_CATALOG, PLACE_CATALOG
} from "./data/gear-catalogs.mjs";
import { describeGear } from "./data/gear-descriptions.mjs";

const COST_OVERRIDES = {
  "club": "feeble", "baseball bat": "feeble", "knife": "poor", "switchblade": "poor",
  "brass knuckles": "poor", "nightstick": "poor", "chain": "poor", "whip": "poor",
  "staff": "poor", "bo stick": "poor", "nunchaku": "poor", "dagger": "typical",
  "short sword": "typical", "hatchet": "typical", "spear": "typical", "javelin": "typical",
  "mace": "typical", "cestus": "typical", "shield": "typical", "throwing knife": "poor",
  "shuriken": "poor", "boomerang": "poor", "bola": "poor", "net": "poor",
  "regular bow": "typical", "long bow": "typical", "crossbow": "typical",
  "compound bow": "good", "heavy crossbow": "good", "sword": "typical", "rapier": "typical",
  "axe": "typical", "quarterstaff": "typical", "broadsword": "good", "great sword": "good",
  "battle axe": "good", "war hammer": "good", "sledgehammer": "poor", "pike": "typical",
  "riot shield": "good", "cheap handgun": "typical", "handgun / pistol": "typical",
  "target pistol": "good", "variable pistol": "good", "flare pistol": "typical",
  "rifle": "good", "hunting rifle": "good", "shotgun": "good",
  "machine pistol": "excellent", "sub-machine gun": "excellent", "assault rifle": "excellent",
  "automatic rifle": "excellent", "sniper rifle": "excellent", "riot gun": "excellent",
  "gyro-jet pistol": "excellent", "stun pistol": "excellent", "laser pistol": "remarkable",
  "concussion pistol": "remarkable", "plasma beam handgun": "incredible",
  "laser rifle": "remarkable", "stun rifle": "remarkable", "concussion rifle": "remarkable",
  "machine gun": "remarkable", "grenade launcher": "remarkable", "flamethrower": "remarkable",
  "bazooka": "remarkable", "law": "remarkable", "missile launcher": "incredible",
  "light artillery": "incredible", "heavy artillery": "amazing", "superheavy artillery": "monstrous",
  "stun cannon": "incredible", "concussion cannon": "incredible", "laser cannon": "amazing",
  "fragmentation grenade": "good", "concussion grenade": "good", "stun grenade": "good",
  "smoke grenade": "typical", "tear gas grenade": "typical", "incendiary grenade": "good",
  "flash grenade": "typical", "sonic grenade": "excellent", "knock-out grenade": "good",
  "standard ammunition": "poor", "armor-piercing shot": "typical", "rubber shot": "poor",
  "explosive shot": "good", "mercy rounds": "typical", "flashlight": "feeble",
  "halogen flashlight": "poor", "first aid kit": "poor", "crowbar": "feeble",
  "lockpicks": "poor", "toolkit": "typical", "electronics kit": "good", "camera": "typical",
  "binoculars": "poor", "radio": "typical", "walkie-talkie": "typical", "cell phone": "typical",
  "laptop": "good", "desktop computer": "good", "handcuffs": "poor", "gas mask": "typical",
  "scuba gear": "good", "climbing gear": "typical", "parachute": "typical",
  "leather jacket": "poor", "helmet": "typical", "flak vest": "good", "kevlar vest": "excellent",
  "riot armor": "excellent", "nbc suit": "excellent", "asbestos suit": "good",
  "body suit": "typical", "vacuum suit": "remarkable", "ammo reload": "poor",
  "medkit refill": "poor", "fuel canister": "typical", "power pack": "good",
  "silencer": "typical", "rocket pack": "remarkable", "bicycle": "feeble",
  "motorcycle": "good", "motor trike": "good", "mini-car": "good", "sedan": "good",
  "van": "good", "pickup truck": "good", "jeep": "good", "taxi": "good",
  "convertible": "excellent", "sports car": "excellent", "luxury car": "excellent",
  "security limo": "remarkable", "police car": "excellent", "ambulance": "excellent",
  "bus": "remarkable", "semi": "remarkable", "armored car": "incredible", "tank": "amazing",
  "jetpack": "remarkable", "hang glider": "typical", "ultralight": "good",
  "private plane": "remarkable", "traffic helicopter": "remarkable", "motorboat": "good",
  "speedboat": "excellent", "sailboat": "good", "rowboat": "poor", "yacht": "incredible",
  "apartment": "typical", "small house": "good", "medium house": "excellent",
  "large house": "remarkable", "mansion": "incredible"
};

function keyName(name) { return String(name || "").trim().toLowerCase(); }

export function resourceCostFor(name, kind = "", category = "") {
  const key = keyName(name);
  if (COST_OVERRIDES[key]) return COST_OVERRIDES[key];
  if (kind === "ammo") return "poor";
  if (category === "tools" || category === "packs") return "typical";
  if (category === "armor") return "good";
  if (category === "hardware") return "excellent";
  if (category === "melee" || category === "thrown" || category === "bow") return "typical";
  if (category === "shooting") return "good";
  if (kind === "vehicle") {
    if (category === "space") return "amazing";
    if (category === "air") return "remarkable";
    if (category === "water" || category === "sub") return "excellent";
    return "good";
  }
  if (kind === "place") return category === "buildings" ? "good" : "typical";
  return "typical";
}

function shopItem(name, kind, category) {
  const cost = resourceCostFor(name, kind, category);
  const gear = describeGear(name, { itemType: kind === "weapon" ? "weapon" : "equipment", category });
  return {
    name,
    kind: gear.itemType === "weapon" ? "weapon" : "equipment",
    category,
    cost,
    definition: gear.definition || "",
    extra: gear
  };
}

export function buildShopDepartments() {
  const depts = [];
  for (const [category, list] of Object.entries(WEAPON_CATALOG)) {
    depts.push({ id: "weapon-" + category, label: "Weapons - " + category, items: list.map((n) => shopItem(n, "weapon", category)) });
  }
  depts.push({ id: "ammo", label: "Ammunition", items: AMMO_CATALOG.map((n) => shopItem(n, "ammo", "ammo")) });
  for (const [category, list] of Object.entries(EQUIPMENT_CATALOG)) {
    depts.push({ id: "eq-" + category, label: "Equipment - " + category, items: list.map((n) => shopItem(n, "equipment", category)) });
  }
  for (const category of ["road", "offRoad", "air", "water"]) {
    const list = VEHICLE_CATALOG[category] || [];
    depts.push({ id: "veh-" + category, label: "Vehicles - " + category, items: list.map((n) => shopItem(n, "vehicle", category)) });
  }
  depts.push({ id: "homes", label: "Homes", items: (PLACE_CATALOG.buildings || []).map((n) => shopItem(n, "place", "buildings")) });
  return depts;
}

function affordLabel(resources, cost) {
  const info = intensityNeeded(resources, cost);
  if (info.delta >= 1) return "Affordable";
  if (info.delta === 0) return "Same rank - Resource FEAT (Yellow)";
  if (info.delta === -1) return "Stretch - Resource FEAT (Red)";
  return "Too expensive";
}

function canAttempt(resources, cost) { return intensityNeeded(resources, cost).delta >= -1; }
function autoBuy(resources, cost) { return intensityNeeded(resources, cost).delta >= 1; }

async function tryPurchase(actor, resources, item) {
  const info = intensityNeeded(resources, item.cost || "typical");
  if (info.delta <= -2) {
    ui.notifications.warn(item.name + " costs " + rankLabel(item.cost) + ". Your Resources cannot cover it at creation.");
    return false;
  }
  if (!autoBuy(resources, item.cost)) {
    const { rollFeat } = await import("./dice/universal-table.mjs");
    const feat = await rollFeat({ actor, rankId: resources, intensityId: item.cost, label: "Resource FEAT - " + item.name });
    const color = feat?.flags?.faserip?.color || "white";
    const pass = info.delta === 0 ? (color === "yellow" || color === "red") : color === "red";
    if (!pass) {
      ui.notifications.warn("Resource FEAT failed. " + item.name + " stays on the shelf.");
      return false;
    }
  }
  await writeGeneratedItem(actor, item.kind, item.name, {
    rank: item.extra?.material || "typical",
    number: 0,
    category: item.category || "",
    definition: item.definition || "",
    weaponType: item.extra?.weaponType || "",
    effectsColumn: item.extra?.effectsColumn || "",
    range: item.extra?.range || "",
    damage: item.extra?.damage || "",
    bodyArmor: !!item.extra?.bodyArmor,
    notes: "Starting gear. Resource cost " + rankLabel(item.cost) + "."
  });
  ui.notifications.info("Bought " + item.name + " (" + rankLabel(item.cost) + "). Resources stay " + rankLabel(resources) + ".");
  return true;
}

export async function pickStartingShop(actor, result = {}) {
  const resources = result.resources || actor?.system?.resources?.rank || "typical";
  const depts = buildShopDepartments();
  const bought = [];
  while (true) {
    const deptOpts = depts.map((d) => ({ id: d.id, label: d.label + " (" + d.items.length + ")" }));
    const menu = await dialog(
      "Starting Gear Shop",
      "<p><strong>Resources:</strong> " + rankLabel(resources) + "</p>" +
      "<p class='hint'>Advanced Set: buy against the item Resource cost. Rank is not spent. Cheaper than your rank is automatic. Same rank needs Yellow. One rank higher needs Red. Two-plus higher is refused.</p>" +
      "<p class='hint'>Bought so far: " + (bought.length ? bought.join(", ") : "nothing") + "</p>" +
      "<div class='form-group'><label>Department</label><select name='dept'>" + options(deptOpts) + "</select></div>",
      [
        { action: "open", label: "Browse", icon: "fa-solid fa-cart-shopping", default: true, callback: (_e, b, d) => ({ action: "open", ...collect(b, d) }) },
        { action: "done", label: "Done Shopping" },
        { action: "skip", label: "No Gear" }
      ]
    );
    if (!menu || menu === "cancel" || menu === "done" || menu === "skip") break;
    const dept = depts.find((d) => d.id === menu.dept) || depts[0];
    if (!dept) break;
    const itemOpts = dept.items.map((it) => ({
      id: it.name,
      label: it.name + " - " + rankLabel(it.cost) + " (" + affordLabel(resources, it.cost) + ")"
    }));
    const pick = await dialog(
      dept.label,
      "<p>Resources " + rankLabel(resources) + ". Choose one item.</p>" +
      "<div class='form-group'><label>Item</label><select name='item'>" + options(itemOpts) + "</select></div>",
      [
        { action: "buy", label: "Buy / Attempt FEAT", icon: "fa-solid fa-bag-shopping", default: true, callback: (_e, b, d) => ({ action: "buy", ...collect(b, d) }) },
        { action: "back", label: "Back" },
        { action: "done", label: "Done Shopping" }
      ],
      640
    );
    if (!pick || pick === "cancel" || pick === "done") break;
    if (pick === "back") continue;
    const item = dept.items.find((it) => it.name === pick.item);
    if (!item) continue;
    if (!canAttempt(resources, item.cost)) {
      ui.notifications.warn(item.name + " is too expensive for " + rankLabel(resources) + " Resources.");
      continue;
    }
    const ok = await tryPurchase(actor, resources, item);
    if (ok) bought.push(item.name);
  }
  return bought;
}
