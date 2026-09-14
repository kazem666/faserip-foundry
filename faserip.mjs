import { FaseripActor } from "./module/documents/actor.mjs";
import { FaseripItem } from "./module/documents/item.mjs";
import { HeroData, NpcData } from "./module/data/actor-data.mjs";
import { PowerData, TalentData, ContactData, EquipmentData, WeaponData } from "./module/data/item-data.mjs";
import * as actorSheetMod from "./module/sheets/actor-sheet.mjs";
import * as itemSheetMod from "./module/sheets/item-sheet.mjs";
import { RANKS, ABILITIES, BATTLE_EFFECTS, rankLabel, shiftRank, intensityNeeded, initiativeModifier } from "./module/config.mjs";
import { rollFeat, promptFeatRoll } from "./module/dice/universal-table.mjs";
import { generateHero, promptGeneration } from "./module/chargen.mjs";
import { createActorWizard } from "./module/wizard.mjs";
import { getActorsCollection, getItemsCollection, getDocumentSheetConfig, getActorSheetV1, getItemSheetV1 } from "./module/foundry-api.mjs";

const VERSION = "1.13.0";

function resolveActorSheet() {
  if (typeof actorSheetMod.buildActorSheetClass === "function") return actorSheetMod.buildActorSheetClass();
  if (actorSheetMod.FaseripActorSheet) return actorSheetMod.FaseripActorSheet;
  throw new Error("FASERIP actor sheet class missing");
}

function resolveItemSheet() {
  if (typeof itemSheetMod.buildItemSheetClass === "function") return itemSheetMod.buildItemSheetClass();
  if (itemSheetMod.FaseripItemSheet) return itemSheetMod.FaseripItemSheet;
  throw new Error("FASERIP item sheet class missing");
}

function injectScrollableWindowStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById("faserip-scroll-css")) return;
  const style = document.createElement("style");
  style.id = "faserip-scroll-css";
  style.textContent = ".application.dialog,.application.faserip-dialog,.application.faserip{max-height:92vh}button.faserip-generate{margin:4px;font-weight:700;white-space:nowrap;background:#eab308;color:#111;border:2px solid #111}";
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
    const el = root instanceof HTMLElement ? root : root?.[0] instanceof HTMLElement ? root[0] : root?.element instanceof HTMLElement ? root.element : null;
    if (!el?.querySelector) return;
    const scope = el.id === "actors" || el.classList?.contains("actors-sidebar") ? el : (el.querySelector?.("#actors, .actors-sidebar") || el);
    if (scope.querySelector?.(".faserip-generate")) return;
    const header = scope.querySelector(".header-actions") || scope.querySelector(".directory-header") || scope.querySelector("[data-application-part='header']") || scope.querySelector("header") || el.querySelector?.(".header-actions") || el;
    if (!header || header.querySelector?.(".faserip-generate")) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "faserip-generate";
    btn.innerHTML = '<i class="fa-solid fa-dice"></i> Generate Hero';
    btn.addEventListener("click", launchWizard);
    header.prepend ? header.prepend(btn) : header.appendChild(btn);
  } catch (err) {
    console.warn("FASERIP | attachGenerateButton", err);
  }
}

function makeGenerateHeroMenu() {
  const AppV2 = foundry.applications?.api?.ApplicationV2;
  const Base = AppV2 ?? class { constructor() {} async render() { return this; } async close() { return this; } };
  return class FaseripGenerateHeroMenu extends Base {
    static DEFAULT_OPTIONS = { id: "faserip-generate-menu", window: { title: "Generate Hero" }, position: { width: 200, height: 80 } };
    async _renderHTML() { return document.createElement("div"); }
    async _replaceHTML() {}
    async render() { launchWizard(); try { await this.close?.(); } catch {} return this; }
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
  ActorsCol?.registerSheet?.("faserip", ActorSheetClass, { types: ["hero", "npc"], makeDefault: true, label: "FASERIP Character Sheet" });
  ItemsCol?.registerSheet?.("faserip", ItemSheetClass, { makeDefault: true, label: "FASERIP Item Sheet" });
  try {
    DocumentSheetConfig?.registerSheet?.(ActorDoc, "faserip", ActorSheetClass, { types: ["hero", "npc"], makeDefault: true, label: "FASERIP Character Sheet" });
    DocumentSheetConfig?.registerSheet?.(ItemDoc, "faserip", ItemSheetClass, { makeDefault: true, label: "FASERIP Item Sheet" });
  } catch (err) {
    console.warn("FASERIP | DocumentSheetConfig register skipped", err);
  }
}

async function pinDefaultSheets() {
  for (const actor of game.actors ?? []) {
    if (actor.type !== "hero" && actor.type !== "npc") continue;
    try { await actor.setFlag("core", "sheetClass", "faserip.FaseripActorSheet"); } catch {}
  }
}

function isActorDirectory(app, element) {
  const id = String(app?.id || app?.tabName || app?.constructor?.name || "");
  if (/actor/i.test(id)) return true;
  const el = element instanceof HTMLElement ? element : element?.[0];
  return el?.id === "actors" || !!el?.classList?.contains("actors-sidebar");
}

Hooks.once("init", () => {
  try {
    console.log(`FASERIP | Initializing system ${VERSION}`);
    injectScrollableWindowStyles();
    CONFIG.Actor.documentClass = FaseripActor;
    CONFIG.Item.documentClass = FaseripItem;
    CONFIG.Actor.dataModels = { hero: HeroData, npc: NpcData };
    CONFIG.Item.dataModels = { power: PowerData, talent: TalentData, contact: ContactData, equipment: EquipmentData, weapon: WeaponData };
    CONFIG.Combat.initiative = { formula: "1d10 + @initMod", decimals: 0 };
    const FaseripActorSheet = resolveActorSheet();
    const FaseripItemSheet = resolveItemSheet();
    registerSheets(FaseripActorSheet, FaseripItemSheet);
    try {
      Handlebars.registerHelper("eq", (a, b) => a === b);
      Handlebars.registerHelper("gt", (a, b) => Number(a) > Number(b));
    } catch {}
    game.settings.register("faserip", "useUltimatePowersBook", {
      name: "Use Ultimate Powers Book (MA3)",
      hint: "Judge only. When on, Generate Hero uses MA3 tables.",
      scope: "world", config: true, type: Boolean, default: false, restricted: true
    });
    try {
      game.settings.registerMenu("faserip", "generateHero", {
        name: "Generate Hero", label: "Open Character Builder",
        hint: "Runs the sequential 1d100 FASERIP generation wizard.",
        icon: "fas fa-dice", type: makeGenerateHeroMenu(), restricted: false
      });
    } catch (err) { console.warn("FASERIP | settings menu skipped", err); }
    game.faserip = {
      version: VERSION, rollFeat, promptFeatRoll, generateHero, promptGeneration, createActorWizard,
      ranks: RANKS, abilities: ABILITIES, battleEffects: BATTLE_EFFECTS,
      rankLabel, shiftRank, intensityNeeded, initiativeModifier,
      ActorSheet: FaseripActorSheet, ItemSheet: FaseripItemSheet
    };
  } catch (err) {
    console.error("FASERIP | init failed", err);
    Hooks.once("ready", () => ui.notifications.error(`FASERIP failed to initialize: ${err.message}`));
  }
});

Hooks.on("renderActorDirectory", (_app, html) => attachGenerateButton(html ?? _app?.element ?? _app));
Hooks.on("renderSidebarTab", (app, html) => { if (isActorDirectory(app, html)) attachGenerateButton(html ?? app?.element ?? app); });
Hooks.on("renderApplicationV2", (app, element) => { if (isActorDirectory(app, element)) attachGenerateButton(element ?? app?.element ?? app); });
Hooks.on("getActorContextOptions", (_app, options) => {
  try {
    options.unshift({ name: "Generate Hero", label: "Generate Hero", icon: '<i class="fa-solid fa-dice"></i>', callback: () => launchWizard(), onClick: () => launchWizard() });
  } catch {}
});

Hooks.once("ready", () => {
  console.log("FASERIP | Ready", game.version, "system", VERSION);
  injectScrollableWindowStyles();
  attachGenerateButton(ui.actors?.element);
  document.querySelectorAll("#actors, .actors-sidebar").forEach(attachGenerateButton);
  pinDefaultSheets().catch(() => {});
  ui.notifications.info(`FASERIP ${VERSION} loaded. Generate Hero: Create Actor, Actors tab, or Game Settings.`);
});

Hooks.on("createActor", async (actor, _options, userId) => {
  if (game.user.id !== userId) return;
  if (actor.type !== "hero" && actor.type !== "npc") return;
  if (actor.getFlag("faserip", "generating")) return;
  try { await actor.setFlag("core", "sheetClass", "faserip.FaseripActorSheet"); } catch {}
  try { actor.sheet?.render(true); } catch (err) { console.error("FASERIP | could not open sheet", err); }
});
