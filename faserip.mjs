import { FaseripActor } from "./module/documents/actor.mjs";
import { FaseripItem } from "./module/documents/item.mjs";
import { HeroData, NpcData } from "./module/data/actor-data.mjs";
import { PowerData, TalentData, ContactData, EquipmentData, WeaponData } from "./module/data/item-data.mjs";
import { buildActorSheetClass } from "./module/sheets/actor-sheet.mjs";
import { buildItemSheetClass } from "./module/sheets/item-sheet.mjs";
import { RANKS, ABILITIES, BATTLE_EFFECTS, rankLabel, shiftRank, intensityNeeded, initiativeModifier } from "./module/config.mjs";
import { rollFeat, promptFeatRoll } from "./module/dice/universal-table.mjs";
import { generateHero, writeGeneratedItem, persistGenerationStats, reapplyRolledStats } from "./module/chargen.mjs";
import { promptGeneration } from "./module/hero-dice.mjs";
import { createActorWizard } from "./module/wizard.mjs";
import { getActorsCollection, getItemsCollection, getDocumentSheetConfig, getActorSheetV1, getItemSheetV1 } from "./module/foundry-api.mjs";
import { ensureCatalogPacks, fillWorldDefinitions } from "./module/compendium.mjs";
import { buildCatalogItemData, describeCatalogItem } from "./module/data/descriptions.mjs";

const VERSION = "1.17.13";

async function seedRollTables(opts = {}) {
  try {
    const mod = await import("./module/roll-tables.mjs");
    return await mod.ensureRollTables(opts);
  } catch (err) {
    console.warn("FASERIP | roll tables unavailable", err);
    return 0;
  }
}

function injectScrollableWindowStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById("faserip-scroll-css")) return;
  const style = document.createElement("style");
  style.id = "faserip-scroll-css";
  style.textContent = `
    .application.dialog, .application.faserip-dialog, .application.faserip { max-height: 92vh; }
    .application.dialog .window-content, .application.faserip-dialog .window-content {
      display: flex; flex-direction: column; overflow: hidden !important; min-height: 0;
      max-height: calc(92vh - 2.75rem);
    }
    .application.dialog form, .application.faserip-dialog form, .application.dialog .dialog-form {
      display: flex; flex-direction: column; min-height: 0; overflow: hidden; flex: 1 1 auto;
    }
    .application.dialog .dialog-content, .application.faserip-dialog .dialog-content, .faserip-dialog-scroll {
      flex: 1 1 auto; overflow-y: auto !important; overflow-x: hidden; min-height: 0;
      max-height: calc(92vh - 9rem);
    }
    .application.faserip .window-content { overflow-y: auto !important; max-height: calc(92vh - 2.75rem); }
    .app.window-app .window-content { overflow-y: auto; }
    button.faserip-generate { margin: 4px; font-weight: 700; white-space: nowrap; }
  `;
  document.head.appendChild(style);
}

function launchWizard(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  return createActorWizard().catch((err) => {
    console.error("FASERIP | generate hero failed", err);
    ui.notifications?.error(`Hero generation failed: ${err.message}`);
  });
}

function attachGenerateButton(root) {
  try {
    const el = root instanceof HTMLElement
      ? root
      : root?.[0] instanceof HTMLElement
        ? root[0]
        : root?.element instanceof HTMLElement
          ? root.element
          : null;
    if (!el?.querySelector) return;
    const scope = el.id === "actors" || el.classList?.contains("actors-sidebar")
      ? el
      : (el.querySelector?.("#actors, .actors-sidebar, [data-tab='actors']") || el);
    if (scope.querySelector?.(".faserip-generate")) return;
    const header = scope.querySelector(".header-actions")
      || scope.querySelector(".directory-header")
      || scope.querySelector("[data-application-part='header']")
      || scope.querySelector("header")
      || el.querySelector?.(".header-actions")
      || el;
    if (!header || header.querySelector?.(".faserip-generate")) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "faserip-generate";
    btn.innerHTML = '<i class="fa-solid fa-dice"></i> Generate Hero';
    btn.addEventListener("click", launchWizard);
    if (header.prepend) header.prepend(btn);
    else header.appendChild(btn);
  } catch (err) {
    console.warn("FASERIP | attachGenerateButton", err);
  }
}

function makeCatalogMenu() {
  const AppV2 = foundry.applications?.api?.ApplicationV2;
  const Base = AppV2 ?? class {
    constructor() {}
    async render() { return this; }
    async close() { return this; }
  };
  return class FaseripCatalogMenu extends Base {
    static DEFAULT_OPTIONS = {
      id: "faserip-catalog-menu",
      window: { title: "FASERIP Catalogs", icon: "fa-solid fa-book" },
      position: { width: 220, height: 80 }
    };
    async _renderHTML() {
      const div = document.createElement("div");
      div.textContent = "Seeding catalogs…";
      return div;
    }
    async _replaceHTML(result, content) {
      if (content && result) content.replaceChildren(result);
    }
    async render(...args) {
      try {
        await ensureCatalogPacks({ notify: true });
        await seedRollTables({ notify: true, rebuild: true });
        const n = await fillWorldDefinitions();
        if (n) ui.notifications.info(`Filled descriptions on ${n} existing item(s).`);
      } catch (err) {
        console.error("FASERIP | catalog rebuild", err);
        ui.notifications?.error(err.message);
      }
      try { await this.close?.(); } catch {}
      return this;
    }
  };
}

function makeGenerateHeroMenu() {
  const AppV2 = foundry.applications?.api?.ApplicationV2;
  const Base = AppV2 ?? class {
    constructor() {}
    async render() { return this; }
    async close() { return this; }
  };
  return class FaseripGenerateHeroMenu extends Base {
    static DEFAULT_OPTIONS = {
      id: "faserip-generate-menu",
      window: { title: "Generate Hero", icon: "fa-solid fa-dice" },
      position: { width: 200, height: 80 }
    };
    async _renderHTML() {
      const div = document.createElement("div");
      div.textContent = "Opening generator…";
      return div;
    }
    async _replaceHTML(result, content) {
      if (content && result) content.replaceChildren(result);
    }
    async render(...args) {
      launchWizard();
      try { await this.close?.(); } catch {}
      return this;
    }
  };
}

function registerSheets(ActorSheetClass, ItemSheetClass) {
  const ActorsCol = getActorsCollection();
  const ItemsCol = getItemsCollection();
  const DocumentSheetConfig = getDocumentSheetConfig();
  const ActorDoc = foundry.documents?.Actor ?? globalThis.Actor;
  const ItemDoc = foundry.documents?.Item ?? globalThis.Item;
  try { ActorsCol?.unregisterSheet?.("core", getActorSheetV1()); } catch {}
  try { ItemsCol?.unregisterSheet?.("core", getItemSheetV1()); } catch {}
  try {
    const V2A = foundry.applications?.sheets?.ActorSheetV2;
    const V2I = foundry.applications?.sheets?.ItemSheetV2;
    if (V2A) DocumentSheetConfig?.unregisterSheet?.(ActorDoc, "core", V2A);
    if (V2I) DocumentSheetConfig?.unregisterSheet?.(ItemDoc, "core", V2I);
  } catch {}
  if (ActorsCol?.registerSheet) {
    ActorsCol.registerSheet("faserip", ActorSheetClass, {
      types: ["hero", "npc"], makeDefault: true, label: "FASERIP Character Sheet"
    });
  }
  if (ItemsCol?.registerSheet) {
    ItemsCol.registerSheet("faserip", ItemSheetClass, {
      makeDefault: true, label: "FASERIP Item Sheet"
    });
  }
  try {
    DocumentSheetConfig?.registerSheet?.(ActorDoc, "faserip", ActorSheetClass, {
      types: ["hero", "npc"], makeDefault: true, label: "FASERIP Character Sheet"
    });
    DocumentSheetConfig?.registerSheet?.(ItemDoc, "faserip", ItemSheetClass, {
      makeDefault: true, label: "FASERIP Item Sheet"
    });
  } catch (err) {
    console.warn("FASERIP | DocumentSheetConfig register skipped", err);
  }
}

async function pinDefaultSheets() {
  for (const actor of game.actors ?? []) {
    if (actor.type !== "hero" && actor.type !== "npc") continue;
    try { await actor.setFlag("core", "sheetClass", "faserip.FaseripActorSheet"); } catch {}
  }
  for (const item of game.items ?? []) {
    try { await item.setFlag("core", "sheetClass", "faserip.FaseripItemSheet"); } catch {}
  }
}

function isActorDirectory(app, element) {
  const id = String(app?.id || app?.tabName || app?.constructor?.name || "");
  if (/actor/i.test(id)) return true;
  const el = element instanceof HTMLElement ? element : element?.[0];
  if (el?.id === "actors" || el?.classList?.contains("actors-sidebar")) return true;
  return false;
}

Hooks.once("init", () => {
  try {
    console.log(`FASERIP | Initializing system ${VERSION}`);
    injectScrollableWindowStyles();
    CONFIG.Actor.documentClass = FaseripActor;
    CONFIG.Item.documentClass = FaseripItem;
    CONFIG.Actor.dataModels = { hero: HeroData, npc: NpcData };
    CONFIG.Item.dataModels = {
      power: PowerData, talent: TalentData, contact: ContactData, equipment: EquipmentData, weapon: WeaponData
    };
    CONFIG.Combat.initiative = { formula: "1d10 + @initMod", decimals: 0 };
    const FaseripActorSheet = buildActorSheetClass();
    const FaseripItemSheet = buildItemSheetClass();
    registerSheets(FaseripActorSheet, FaseripItemSheet);
    try {
      Handlebars.registerHelper("eq", (a, b) => a === b);
      Handlebars.registerHelper("gt", (a, b) => Number(a) > Number(b));
    } catch (err) {
      console.warn("FASERIP | helper register", err);
    }
    game.settings.register("faserip", "useUltimatePowersBook", {
      name: "Use Ultimate Powers Book (MA3)",
      hint: "Judge only. When on, Generate Hero uses MA3 physical form, origin of power, power-class tables, the expanded power list, the UPB count table, and UPB weakness rolls.",
      scope: "world", config: true, type: Boolean, default: false, restricted: true
    });
    game.settings.register("faserip", "useRealmsOfMagic", {
      name: "Use Realms of Magic (MHAC-9)",
      hint: "Judge only. When on, Generate Hero can use the magical-character path. Packs seed even if this is off.",
      scope: "world", config: true, type: Boolean, default: false, restricted: true
    });
    try {
      game.settings.registerMenu("faserip", "generateHero", {
        name: "Generate Hero", label: "Open Character Builder",
        hint: "Runs the sequential 1d100 FASERIP generation wizard.",
        icon: "fas fa-dice", type: makeGenerateHeroMenu(), restricted: false
      });
    } catch (err) { console.warn("FASERIP | settings menu skipped", err); }
    try {
      game.settings.registerMenu("faserip", "rebuildCatalogs", {
        name: "Rebuild Catalog Compendia", label: "Seed Catalog Packs",
        hint: "Creates world Item packs plus one RollTable per generation category.",
        icon: "fas fa-book", type: makeCatalogMenu(), restricted: true
      });
    } catch (err) { console.warn("FASERIP | catalog menu skipped", err); }
    game.faserip = {
      version: VERSION,
      rollFeat, promptFeatRoll, generateHero, promptGeneration, createActorWizard, writeGeneratedItem, persistGenerationStats, reapplyRolledStats,
      ranks: RANKS, abilities: ABILITIES, battleEffects: BATTLE_EFFECTS,
      rankLabel, shiftRank, intensityNeeded, initiativeModifier,
      ensureCatalogPacks, fillWorldDefinitions, seedRollTables, buildCatalogItemData, describeCatalogItem,
      ActorSheet: FaseripActorSheet, ItemSheet: FaseripItemSheet
    };
    import("./module/data/rom.mjs").then((rom) => {
      game.faserip.isRomEnabled = rom.isRomEnabled;
      game.faserip.romLimits = rom.ROM_LIMITS;
      game.faserip.magicEffects = rom.MAGIC_EFFECTS;
    }).catch(() => {});
  } catch (err) {
    console.error("FASERIP | init failed", err);
    Hooks.once("ready", () => ui.notifications.error(`FASERIP failed to initialize: ${err.message}`));
  }
});

Hooks.on("renderActorDirectory", (_app, html) => attachGenerateButton(html ?? _app?.element ?? _app));
Hooks.on("renderSidebarTab", (app, html) => {
  if (isActorDirectory(app, html)) attachGenerateButton(html ?? app?.element ?? app);
});
Hooks.on("renderApplicationV2", (app, element) => {
  if (isActorDirectory(app, element)) attachGenerateButton(element ?? app?.element ?? app);
});
Hooks.on("renderSettings", (_app, html) => {
  try {
    const el = html instanceof HTMLElement ? html : html?.[0] ?? _app?.element;
    if (!el?.querySelector || el.querySelector(".faserip-generate-settings")) return;
    const section = el.querySelector('section[data-category="faserip"]') || el.querySelector(".settings-list") || el;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "faserip-generate faserip-generate-settings";
    btn.innerHTML = '<i class="fa-solid fa-dice"></i> Generate Hero';
    btn.addEventListener("click", launchWizard);
    section.prepend(btn);
  } catch {}
});
Hooks.on("getActorContextOptions", (_app, options) => {
  try {
    options.unshift({
      name: "Generate Hero", label: "Generate Hero",
      icon: '<i class="fa-solid fa-dice"></i>',
      callback: () => launchWizard(), onClick: () => launchWizard()
    });
  } catch {}
});

Hooks.once("ready", () => {
  console.log("FASERIP | Ready", game.version, "system", VERSION);
  injectScrollableWindowStyles();
  attachGenerateButton(ui.actors?.element);
  document.querySelectorAll("#actors, .actors-sidebar, [id='actors']").forEach(attachGenerateButton);
  pinDefaultSheets().catch(() => {});
  Promise.resolve()
    .then(() => ensureCatalogPacks())
    .then(() => seedRollTables())
    .then(() => fillWorldDefinitions())
    .then((n) => {
      if (n) ui.notifications.info(`FASERIP filled descriptions on ${n} existing Power/Talent item(s).`);
    })
    .catch((err) => console.warn("FASERIP | catalog seed", err));
  ui.notifications.info(`FASERIP ${VERSION} loaded. Generate Hero: Create Actor, Actors tab button, or Game Settings.`);
});

Hooks.on("preUpdateActor", (actor, changes, options) => {
  if (options?.faseripApplyRolls || options?.faseripReapply) return;
  const rolled = actor.getFlag("faserip", "rolledStats");
  if (!rolled?.abilities || !changes?.system?.abilities) return;
  const generating = !!actor.getFlag("faserip", "generating");
  const incoming = changes.system.abilities;
  const touched = ABILITIES.filter((key) => incoming[key]);
  const stale = touched.filter((key) => incoming[key]?.rank && rolled.abilities[key] && incoming[key].rank !== rolled.abilities[key]);
  if (!generating && !(touched.length >= 4 && stale.length >= 3)) return;
  for (const key of stale) {
    incoming[key] = {
      rank: rolled.abilities[key],
      ...(rolled.numbers?.[key] != null ? { number: Number(rolled.numbers[key]) } : {})
    };
  }
});

async function tryReapplyRolledStats(actor) {
  if (!actor || actor.getFlag("faserip", "generating")) return;
  if (!actor.getFlag("faserip", "rolledStats")) return;
  try {
    const mod = await import("./module/chargen.mjs");
    if (typeof mod.reapplyRolledStats === "function") await mod.reapplyRolledStats(actor);
  } catch {}
}

Hooks.on("updateActor", (actor, _changes, options) => {
  if (options?.faseripApplyRolls || options?.faseripReapply) return;
  tryReapplyRolledStats(actor).catch(() => {});
});

Hooks.on("renderActorSheet", (app) => {
  const actor = app?.actor ?? app?.document;
  if (app && !app._faseripClosePatched && typeof app.close === "function") {
    app._faseripClosePatched = true;
    const orig = app.close.bind(app);
    app.close = (options = {}) => orig({ ...options, submit: false });
  }
  tryReapplyRolledStats(actor).catch(() => {});
});

Hooks.on("renderApplicationV2", (app) => {
  const actor = app?.actor ?? app?.document;
  if (!actor || actor.documentName !== "Actor") return;
  tryReapplyRolledStats(actor).catch(() => {});
});

Hooks.on("createActor", async (actor, _options, userId) => {
  if (game.user.id !== userId) return;
  if (actor.type !== "hero" && actor.type !== "npc") return;
  if (actor.getFlag("faserip", "generating")) return;
  try { await actor.setFlag("core", "sheetClass", "faserip.FaseripActorSheet"); } catch {}
  try { actor.sheet?.render(true); } catch (err) {
    console.error("FASERIP | could not open sheet", err);
  }
});
