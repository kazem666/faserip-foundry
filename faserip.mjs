import { FaseripActor } from "./module/documents/actor.mjs";
import { FaseripItem } from "./module/documents/item.mjs";
import { HeroData, NpcData } from "./module/data/actor-data.mjs";
import { PowerData, TalentData, ContactData, EquipmentData, WeaponData } from "./module/data/item-data.mjs";
import { FaseripActorSheet } from "./module/sheets/actor-sheet.mjs";
import { FaseripItemSheet } from "./module/sheets/item-sheet.mjs";
import { RANKS, ABILITIES, BATTLE_EFFECTS, rankLabel, shiftRank, intensityNeeded, initiativeModifier } from "./module/config.mjs";
import { rollFeat, promptFeatRoll } from "./module/dice/universal-table.mjs";
import { generateHero, promptGeneration } from "./module/chargen.mjs";
import { createActorWizard } from "./module/wizard.mjs";
import { getActorSheetClass, getItemSheetClass, getActorsCollection, getItemsCollection } from "./module/foundry-api.mjs";

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
    button.faserip-generate { margin: 4px; font-weight: 700; }
  `;
  document.head.appendChild(style);
}

function registerSheets() {
  const ActorSheetBase = getActorSheetClass();
  const ItemSheetBase = getItemSheetClass();
  const ActorsCol = getActorsCollection();
  const ItemsCol = getItemsCollection();
  if (ActorsCol?.unregisterSheet) {
    try { ActorsCol.unregisterSheet("core", ActorSheetBase); } catch (err) {
      console.warn("FASERIP | could not unregister core actor sheet", err);
    }
  }
  if (ActorsCol?.registerSheet) {
    ActorsCol.registerSheet("faserip", FaseripActorSheet, {
      types: ["hero", "npc"],
      makeDefault: true,
      label: "FASERIP Character Sheet"
    });
  }
  if (ItemsCol?.unregisterSheet) {
    try { ItemsCol.unregisterSheet("core", ItemSheetBase); } catch (err) {
      console.warn("FASERIP | could not unregister core item sheet", err);
    }
  }
  if (ItemsCol?.registerSheet) {
    ItemsCol.registerSheet("faserip", FaseripItemSheet, {
      makeDefault: true,
      label: "FASERIP Item Sheet"
    });
  }
  try {
    const DocumentSheetConfig = foundry.applications?.apps?.DocumentSheetConfig;
    const ActorDoc = foundry.documents?.Actor ?? globalThis.Actor;
    const ItemDoc = foundry.documents?.Item ?? globalThis.Item;
    DocumentSheetConfig?.registerSheet?.(ActorDoc, "faserip", FaseripActorSheet, {
      types: ["hero", "npc"],
      makeDefault: true,
      label: "FASERIP Character Sheet"
    });
    DocumentSheetConfig?.registerSheet?.(ItemDoc, "faserip", FaseripItemSheet, {
      makeDefault: true,
      label: "FASERIP Item Sheet"
    });
  } catch (err) {
    console.warn("FASERIP | DocumentSheetConfig register skipped", err);
  }
}

function attachGenerateButton(root) {
  const el = root instanceof HTMLElement ? root : root?.[0];
  if (!el?.querySelector) return;
  if (el.querySelector(".faserip-generate")) return;
  const header = el.querySelector(".header-actions")
    || el.querySelector(".directory-header")
    || el.querySelector("[data-application-part='header']")
    || el.querySelector("header")
    || el;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "faserip-generate";
  btn.innerHTML = '<i class="fa-solid fa-dice"></i> Generate Hero';
  btn.addEventListener("click", (event) => {
    event.preventDefault();
    createActorWizard().catch((err) => {
      console.error(err);
      ui.notifications.error(err.message);
    });
  });
  header.prepend(btn);
}

function makeGenerateHeroMenu() {
  const Base = globalThis.FormApplication ?? class {
    static get defaultOptions() { return {}; }
    constructor() {}
    render() { return this; }
    close() { return Promise.resolve(); }
  };
  return class GenerateHeroMenu extends Base {
    static get defaultOptions() {
      const extra = {
        id: "faserip-generate-menu",
        title: "Generate Hero",
        template: null,
        width: 1,
        height: 1
      };
      return foundry?.utils?.mergeObject?.(super.defaultOptions ?? {}, extra) ?? extra;
    }
    async render() {
      try { this.close?.(); } catch {}
      return createActorWizard();
    }
    async _renderInner() { return document.createElement("div"); }
  };
}

async function pinDefaultSheets() {
  for (const actor of game.actors ?? []) {
    if (actor.type !== "hero" && actor.type !== "npc") continue;
    try {
      await actor.setFlag("core", "sheetClass", "faserip.FaseripActorSheet");
    } catch {}
  }
}

Hooks.once("init", () => {
  try {
    console.log("FASERIP | Initializing system 1.12.0");
    injectScrollableWindowStyles();
    CONFIG.Actor.documentClass = FaseripActor;
    CONFIG.Item.documentClass = FaseripItem;
    CONFIG.Actor.dataModels = { hero: HeroData, npc: NpcData };
    CONFIG.Item.dataModels = {
      power: PowerData,
      talent: TalentData,
      contact: ContactData,
      equipment: EquipmentData,
      weapon: WeaponData
    };
    CONFIG.Combat.initiative = { formula: "1d10 + @initMod", decimals: 0 };

    registerSheets();

    try {
      Handlebars.registerHelper("eq", (a, b) => a === b);
      Handlebars.registerHelper("gt", (a, b) => Number(a) > Number(b));
    } catch (err) {
      console.warn("FASERIP | helper register", err);
    }

    game.settings.register("faserip", "useUltimatePowersBook", {
      name: "Use Ultimate Powers Book (MA3)",
      hint: "Judge only. When on, Generate Hero uses MA3 physical form, origin of power, power-class tables, the expanded power list, the UPB count table, and UPB weakness rolls.",
      scope: "world",
      config: true,
      type: Boolean,
      default: false,
      restricted: true
    });
    game.settings.registerMenu("faserip", "generateHero", {
      name: "Generate Hero",
      label: "Open Character Builder",
      hint: "Runs the sequential 1d100 FASERIP generation wizard.",
      icon: "fas fa-dice",
      type: makeGenerateHeroMenu(),
      restricted: false
    });
    game.faserip = {
      rollFeat, promptFeatRoll, generateHero, promptGeneration, createActorWizard,
      ranks: RANKS, abilities: ABILITIES, battleEffects: BATTLE_EFFECTS,
      rankLabel, shiftRank, intensityNeeded, initiativeModifier
    };
  } catch (err) {
    console.error("FASERIP | init failed", err);
    Hooks.once("ready", () => ui.notifications.error(`FASERIP failed to initialize: ${err.message}`));
  }
});

Hooks.once("ready", () => {
  console.log("FASERIP | Ready", game.version, "sheet", FaseripActorSheet?.name);
  injectScrollableWindowStyles();
  attachGenerateButton(ui.actors?.element);
  document.querySelectorAll("#actors, .actors-sidebar, [id='actors']").forEach(attachGenerateButton);
  pinDefaultSheets().catch(() => {});
  ui.notifications.info("FASERIP 1.12.0 loaded. Generate Hero: Actors tab, sheet button, or Game Settings.");
});

Hooks.on("renderActorDirectory", (_app, html) => {
  attachGenerateButton(html ?? _app?.element);
});

Hooks.on("renderSidebarTab", (app, html) => {
  if (app?.tabName === "actors" || app?.id === "actors" || app?.constructor?.name === "ActorDirectory") {
    attachGenerateButton(html ?? app?.element);
  }
});

Hooks.on("renderApplicationV2", (app, element) => {
  const id = app?.id || app?.tabName || app?.constructor?.name || "";
  if (/actor/i.test(String(id))) attachGenerateButton(element ?? app?.element);
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
