import { POWER_CATALOG } from "./config-catalogs.mjs";
import { describeGear } from "./data/gear-descriptions.mjs";
import { WEAPON_CATALOG } from "./data/gear-catalogs.mjs";
import { ULTIMATE_GROUPS } from "./data/ultimate-list.mjs";
import { UPB_POWERS } from "./data/upb-powers.mjs";
import { STANDARD_ACTIONS, describeItemAction } from "./item-actions.mjs";
import { specFor } from "./vfx.mjs";

/**
 * Automated Animations matches a rinsed item name against world menu labels.
 * These rows are cloned from the installed menu so laser and energy weapons
 * stay on the energy beam, and every catalog attack has a label of its own.
 */
const PRESETS = {
  "jb2a.energy_beam": { menu: "range", template: "firebolt", video: { dbSection: "range", menuType: "generic", animation: "energybeam", variant: "01", color: "blue" } },
  "jb2a.bullet": { menu: "range", template: "bow", video: { dbSection: "range", menuType: "weapon", animation: "bullet", variant: "1", color: "orange" } },
  "jb2a.arrow": { menu: "range", template: "bow" },
  "jb2a.fire_jet": { menu: "range", template: "firebolt" },
  "jb2a.fire_bolt": { menu: "range", template: "firebolt" },
  "jb2a.fireball.beam.orange": { menu: "preset", template: "fireball" },
  "jb2a.ray_of_frost": { menu: "range", template: "rayoffrost" },
  "jb2a.lightning_bolt.narrow.blue": { menu: "range", template: "witchbolt" },
  "jb2a.thunderwave": { menu: "templatefx", template: "calllightning" },
  "jb2a.magic_missile": { menu: "range", template: "magicmissile" },
  "jb2a.sword.melee": { menu: "melee", template: "sword" },
  "jb2a.greatsword.melee": { menu: "melee", template: "greatsword" },
  "jb2a.dagger.melee": { menu: "melee", template: "dagger" },
  "jb2a.scimitar.melee": { menu: "melee", template: "sword" },
  "jb2a.glaive.melee": { menu: "melee", template: "spear" },
  "jb2a.halberd.melee": { menu: "melee", template: "spear" },
  "jb2a.greataxe.melee": { menu: "melee", template: "greataxe" },
  "jb2a.maul.melee": { menu: "melee", template: "maul" },
  "jb2a.warhammer.melee": { menu: "melee", template: "mace" },
  "jb2a.quarterstaff.melee": { menu: "melee", template: "spear" },
  "jb2a.club.melee": { menu: "melee", template: "greatclub" },
  "jb2a.mace.melee": { menu: "melee", template: "mace" },
  "jb2a.spear.melee": { menu: "melee", template: "spear" },
  "jb2a.handaxe.melee": { menu: "melee", template: "handaxe" },
  "jb2a.unarmed_strike": { menu: "melee", template: "unarmedstrike" },
  "jb2a.melee_generic": { menu: "melee", template: "sword" },
  "jb2a.shield_attack": { menu: "melee", template: "mace" },
  "jb2a.claws": { menu: "ontoken", template: "claw" },
  "jb2a.healing_generic": { menu: "ontoken", template: "curewounds" },
  "jb2a.teleport": { menu: "preset", template: "mistystep" },
  "jb2a.shield": { menu: "aura", template: "spiritguardians" },
  "jb2a.darkness": { menu: "templatefx", template: "fogcloud" },
  "jb2a.boulder": { menu: "range", template: "magicmissile" },
  "jb2a.water_splash": { menu: "templatefx", template: "fogcloud" },
  "jb2a.gust_of_wind": { menu: "range", template: "witchbolt" },
  "jb2a.entangle": { menu: "templatefx", template: "fogcloud" },
  "jb2a.detect_magic": { menu: "ontoken", template: "curewounds" },
  "jb2a.wind_stream": { menu: "ontoken", template: "curewounds" },
  "jb2a.cast_generic": { menu: "ontoken", template: "curewounds" },
  "jb2a.web": { menu: "range", template: "magicmissile" },
  "jb2a.shuriken": { menu: "range", template: "bow" },
  "jb2a.boomerang": { menu: "range", template: "bow" },
  "jb2a.javelin": { menu: "range", template: "bow" },
  "jb2a.liquid": { menu: "range", template: "rayoffrost" },
  "jb2a.dizzy_stars": { menu: "ontoken", template: "tollthedead" }
};

const FALLBACK = { menu: "ontoken", template: "curewounds" };
const MENUS = ["melee", "range", "ontoken", "templatefx", "aura", "preset"];

function rinse(name) {
  return String(name || "").replace(/\s+/g, "").toLowerCase();
}

function labelsFor(name) {
  const raw = String(name || "").trim();
  const cleaned = raw.replace(/\s*\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
  const labels = new Set();
  for (const value of [raw, cleaned]) {
    const label = rinse(value);
    if (label.length >= 3) labels.add(label);
  }
  return [...labels];
}

function rowFor(name, spec, overwrite = false) {
  if (!spec?.file) return [];
  const preset = PRESETS[spec.file] || FALLBACK;
  return labelsFor(name).map((label) => ({
    label,
    menu: preset.menu,
    template: preset.template,
    video: preset.video || null,
    animation: preset.video?.animation || preset.template,
    overwrite
  }));
}

function powerSpec(name) {
  const item = { name, type: "power", system: {} };
  const action = describeItemAction(item);
  return specFor({ item, columnId: action.column || "", label: name });
}

function weaponSpec(name) {
  const gear = describeGear(name, { itemType: "weapon" });
  const item = {
    name,
    type: "weapon",
    system: { weaponType: gear.weaponType || "", effectsColumn: gear.effectsColumn || "" }
  };
  return specFor({ item, columnId: gear.effectsColumn || "", label: name });
}

export function recognitionPlans() {
  const map = new Map();
  const put = (rows) => {
    for (const row of rows) {
      if (!map.has(row.label) || row.overwrite) map.set(row.label, row);
    }
  };
  for (const list of Object.values(POWER_CATALOG)) {
    for (const name of list) put(rowFor(name, powerSpec(name)));
  }
  for (const group of ULTIMATE_GROUPS) {
    for (const item of group.items || []) put(rowFor(item.name, powerSpec(item.name)));
  }
  for (const list of Object.values(UPB_POWERS)) {
    if (!Array.isArray(list)) continue;
    for (const row of list) put(rowFor(row.name, powerSpec(row.name)));
  }
  for (const list of Object.values(WEAPON_CATALOG)) {
    if (!Array.isArray(list)) continue;
    for (const name of list) put(rowFor(name, weaponSpec(name), true));
  }
  for (const action of STANDARD_ACTIONS) {
    const item = { name: action.label, type: "weapon", system: { effectsColumn: action.column } };
    put(rowFor(action.label, specFor({ item, columnId: action.column, label: action.label }), true));
  }
  return [...map.values()];
}

function cloneEntry(value) {
  const utils = globalThis.foundry?.utils;
  if (typeof utils?.deepClone === "function") return utils.deepClone(value);
  return JSON.parse(JSON.stringify(value));
}

function isOurs(entry) {
  return entry?.metaData?.faserip === true || String(entry?.id || "").startsWith("faserip-");
}

function findTemplate(entries, templateLabel) {
  return entries.find((entry) => entry?.label === templateLabel && !isOurs(entry))
    || entries.find((entry) => entry?.label === templateLabel)
    || entries.find((entry) => !isOurs(entry) && entry?.primary?.video)
    || null;
}

function signature(entries) {
  return entries
    .map((entry) => {
      const video = entry?.primary?.video || {};
      return `${entry.label}|${video.animation}|${video.menuType}|${video.variant}|${video.color}`;
    })
    .sort()
    .join("\n");
}

function stamp(template, plan, menu) {
  const entry = cloneEntry(template);
  entry.id = `faserip-${plan.label}`;
  entry.label = plan.label;
  entry.menu = menu;
  entry.metaData = { ...(entry.metaData || {}), default: false, faserip: true };
  if (plan.video && entry.primary?.video) {
    entry.primary.video = { ...entry.primary.video, ...plan.video };
  }
  return entry;
}

export async function seedFaseripAutorec() {
  const settings = globalThis.game?.settings;
  if (!settings || !globalThis.game.user?.isGM) return 0;
  if (!globalThis.game.modules?.get("autoanimations")?.active) return 0;
  const plans = recognitionPlans();
  let written = 0;
  for (const menu of MENUS) {
    let current = [];
    try { current = settings.get("autoanimations", `aaAutorec-${menu}`) || []; } catch { continue; }
    if (!Array.isArray(current) || !current.length) {
      console.warn(`FASERIP | Automated Animations ${menu} menu is empty, so those names were left unchanged.`);
      continue;
    }
    const wanted = plans.filter((plan) => plan.menu === menu);
    const templates = new Map();
    const additions = [];
    for (const plan of wanted) {
      if (!templates.has(plan.template)) templates.set(plan.template, findTemplate(current, plan.template));
      const template = templates.get(plan.template);
      if (!template?.primary?.video) continue;
      additions.push(stamp(template, plan, menu));
    }
    if (!additions.length) continue;
    const ours = current.filter(isOurs);
    if (signature(ours) === signature(additions)) continue;
    const kept = current.filter((entry) => !isOurs(entry));
    await settings.set("autoanimations", `aaAutorec-${menu}`, kept.concat(additions));
    written += additions.length;
  }
  return written;
}

export function registerAutoAnimations() {
  const Hooks = globalThis.Hooks;
  if (!Hooks?.once) return;
  Hooks.once("aa.ready", () => {
    seedFaseripAutorec()
      .then((count) => {
        if (count) {
          globalThis.ui?.notifications?.info(`Automated Animations now recognizes ${count} FASERIP attacks, weapons, and powers.`);
        }
      })
      .catch((err) => console.warn("FASERIP | Automated Animations", err));
  });
}
