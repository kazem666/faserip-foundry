import { FaseripActor } from "./module/documents/actor.mjs";
import { FaseripItem } from "./module/documents/item.mjs";
import { HeroData, NpcData } from "./module/data/actor-data.mjs";
import { PowerData, TalentData, ContactData, EquipmentData, WeaponData } from "./module/data/item-data.mjs";
import { buildActorSheetClass } from "./module/sheets/actor-sheet.mjs";
import { buildItemSheetClass } from "./module/sheets/item-sheet.mjs";
import { RANKS, ABILITIES, BATTLE_EFFECTS, rankLabel, shiftRank, intensityNeeded, initiativeModifier } from "./module/config.mjs";
import { rollFeat, promptFeatRoll } from "./module/dice/universal-table.mjs";
import { showRollOnTable, toggleUniversalTable } from "./module/apps/universal-table-app.mjs";
import { bindFeatChat, openCombatChain, promptJudgeAward } from "./module/play.mjs";
import { registerWorkflowSettings, registerWorkflowSocket, workflowOn } from "./module/workflow.mjs";
import { registerComicSocket } from "./module/comic-hit.mjs";
import { registerMovement } from "./module/movement.mjs";
import { registerElevation } from "./module/elevation.mjs";
import { registerFalling } from "./module/falling.mjs";
import { registerTeleport } from "./module/teleport.mjs";
import { registerConditionEffects } from "./module/battle-results.mjs";
import { registerAutoAnimations } from "./module/auto-animations.mjs";
import { generateHero, writeGeneratedItem, persistGenerationStats, reapplyRolledStats } from "./module/chargen.mjs";
import { promptGeneration } from "./module/hero-dice.mjs";
import { createActorWizard } from "./module/wizard.mjs";
import { getActorsCollection, getItemsCollection, getDocumentSheetConfig, getActorSheetV1, getItemSheetV1 } from "./module/foundry-api.mjs";
import { ensureCatalogPacks, fillWorldDefinitions } from "./module/compendium.mjs";
import { buildCatalogItemData, describeCatalogItem } from "./module/data/descriptions.mjs";

const VERSION = "1.17.56";

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

function launchPdfImport(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  return import("./module/pdf-import.mjs").then((mod) => mod.promptPdfImport()).catch((err) => {
    console.error("FASERIP | pdf import failed", err);
    ui.notifications?.error(`PDF import failed: ${err.message}`);
  });
}

function launchJournalImport(journal, page, root) {
  return import("./module/journal-import.mjs").then((mod) => mod.promptJournalImport({
    journal,
    page,
    pageNumber: mod.viewerPageNumber(root),
    snapshot: mod.viewerSnapshot(root)
  })).catch((err) => {
    console.error("FASERIP | journal import failed", err);
    ui.notifications?.error(`Journal import failed: ${err.message}`);
  });
}

function journalPages(journal) {
  const pages = journal?.pages;
  if (!pages) return [];
  if (typeof pages.values === "function") return [...pages.values()];
  return pages.contents || [];
}

function journalFromApp(app) {
  const doc = app?.document || app?.page || null;
  if (doc?.documentName === "JournalEntryPage") return { journal: doc.parent, page: doc };
  if (doc?.documentName === "JournalEntry") return { journal: doc, page: null };
  return { journal: null, page: null };
}

function attachJournalImport(app, element) {
  try {
    const el = element instanceof HTMLElement ? element : element?.[0] || app?.element;
    if (!el?.querySelector || el.querySelector(":scope > .faserip-journal-import-bar, .window-content > .faserip-journal-import-bar")) return;
    const found = journalFromApp(app);
    const pages = journalPages(found.journal);
    const readable = pages.some((entry) => (entry.type === "pdf" || entry.type === "image") && entry.src);
    if (!readable && found.page?.type !== "pdf") return;
    const host = el.querySelector(".window-content") || el;
    if (host.querySelector(".faserip-import-journal")) return;
    const bar = document.createElement("div");
    bar.className = "faserip-journal-import-bar";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "faserip-import-pdf faserip-import-journal";
    btn.innerHTML = '<i class="fa-solid fa-book-open"></i> Import this page';
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const current = found.page?.type === "pdf" ? found.page : pages.find((entry) => entry.type === "pdf" && entry.src) || null;
      launchJournalImport(found.journal, current, el);
    });
    bar.appendChild(btn);
    host.prepend(bar);
  } catch (err) {
    console.warn("FASERIP | journal import button", err);
  }
}

function attachJournalDirectoryButton(root) {
  try {
    const el = root instanceof HTMLElement ? root : root?.[0] || root?.element;
    if (!el?.querySelector || el.querySelector(".faserip-import-journal")) return;
    const header = el.querySelector(".header-actions")
      || el.querySelector(".directory-header")
      || el.querySelector("header")
      || el;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "faserip-import-pdf faserip-import-journal";
    btn.innerHTML = '<i class="fa-solid fa-book-open"></i> Import page';
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      launchJournalImport(null, null, null);
    });
    header.appendChild(btn);
  } catch (err) {
    console.warn("FASERIP | journal directory button", err);
  }
}

function isJournalDirectory(app, element) {
  const name = String(app?.constructor?.name || "");
  if (name === "JournalDirectory") return true;
  const id = String(app?.id || app?.tabName || "");
  if (id === "journal") return true;
  const el = element instanceof HTMLElement ? element : element?.[0];
  return el?.id === "journal";
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
    attachImportButton(scope, header);
  } catch (err) {
    console.warn("FASERIP | attachGenerateButton", err);
  }
}

function attachImportButton(scope, header) {
  try {
    const host = header || scope;
    if (!host || host.querySelector?.(".faserip-import-pdf") || scope?.querySelector?.(".faserip-import-pdf")) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "faserip-import-pdf";
    btn.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Import PDF';
    btn.addEventListener("click", launchPdfImport);
    const generate = host.querySelector?.(".faserip-generate");
    if (generate?.after) generate.after(btn);
    else host.appendChild(btn);
  } catch (err) {
    console.warn("FASERIP | attachImportButton", err);
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

function makePdfImportMenu() {
  const AppV2 = foundry.applications?.api?.ApplicationV2;
  const Base = AppV2 ?? class {
    constructor() {}
    async render() { return this; }
    async close() { return this; }
  };
  return class FaseripPdfImportMenu extends Base {
    static DEFAULT_OPTIONS = {
      id: "faserip-pdf-import-menu",
      window: { title: "Import character PDF", icon: "fa-solid fa-file-pdf" },
      position: { width: 200, height: 80 }
    };
    async _renderHTML() {
      const div = document.createElement("div");
      div.textContent = "Choose a PDF…";
      return div;
    }
    async _replaceHTML(result, content) {
      if (content && result) content.replaceChildren(result);
    }
    async render() {
      launchPdfImport();
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
    const BaseCombatant = CONFIG.Combatant?.documentClass;
    if (typeof BaseCombatant === "function") {
      class FaseripCombatant extends BaseCombatant {
        getInitiativeRoll(formula) {
          const built = this.actor?.getInitiativeRoll?.(formula);
          if (built && typeof built.evaluate === "function") return built;
          return super.getInitiativeRoll(formula);
        }
      }
      CONFIG.Combatant.documentClass = FaseripCombatant;
    }
    const FaseripActorSheet = buildActorSheetClass();
    const FaseripItemSheet = buildItemSheetClass();
    registerSheets(FaseripActorSheet, FaseripItemSheet);
    registerMovement();
    registerElevation();
    registerFalling();
    registerTeleport();
    registerConditionEffects();
    registerAutoAnimations();
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
    game.settings.register("faserip", "useUltimateTalents", {
      name: "Use Ultimate Talents list",
      hint: "Judge only. When on, Generate Hero rolls talent categories and specialties from the Ultimate Talents list instead of the short Advanced Set list.",
      scope: "world", config: true, type: Boolean, default: false, restricted: true
    });
    game.settings.register("faserip", "useRealmsOfMagic", {
      name: "Use Realms of Magic (MHAC-9)",
      hint: "Judge only. When on, Generate Hero can use the magical-character path. Packs seed even if this is off.",
      scope: "world", config: true, type: Boolean, default: false, restricted: true
    });
    registerWorkflowSettings();
    try {
      game.settings.registerMenu("faserip", "generateHero", {
        name: "Generate Hero", label: "Open Character Builder",
        hint: "Runs the sequential 1d100 FASERIP generation wizard.",
        icon: "fas fa-dice", type: makeGenerateHeroMenu(), restricted: false
      });
      game.settings.registerMenu("faserip", "importPdf", {
        name: "Import Character PDF", label: "Choose PDF",
        hint: "Reads a typed or fillable character PDF and creates a hero sheet. A scanned picture of a page has no text to read.",
        icon: "fas fa-file-pdf", type: makePdfImportMenu(), restricted: false
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
      rollFeat, promptFeatRoll, generateHero, promptGeneration, createActorWizard, promptPdfImport: launchPdfImport, promptJournalImport: launchJournalImport, writeGeneratedItem, persistGenerationStats, reapplyRolledStats,
      ranks: RANKS, abilities: ABILITIES, battleEffects: BATTLE_EFFECTS,
      rankLabel, shiftRank, intensityNeeded, initiativeModifier,
      toggleUniversalTable, openUniversalTable: showRollOnTable,
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

Hooks.on("renderActorDirectory", (_app, html) => {
  attachGenerateButton(html ?? _app?.element ?? _app);
  attachAwardButton(html ?? _app?.element ?? _app);
});
Hooks.on("renderSidebarTab", (app, html) => {
  if (isJournalDirectory(app, html)) attachJournalDirectoryButton(html ?? app?.element);
  if (!isActorDirectory(app, html)) return;
  attachGenerateButton(html ?? app?.element ?? app);
  attachAwardButton(html ?? app?.element ?? app);
});
Hooks.on("renderApplicationV2", (app, element) => {
  if (!isActorDirectory(app, element)) return;
  attachGenerateButton(element ?? app?.element ?? app);
  attachAwardButton(element ?? app?.element ?? app);
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
    const pdf = document.createElement("button");
    pdf.type = "button";
    pdf.className = "faserip-import-pdf";
    pdf.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Import PDF';
    pdf.addEventListener("click", launchPdfImport);
    btn.after(pdf);
  } catch {}
});
Hooks.on("renderJournalDirectory", (app, html) => attachJournalDirectoryButton(html ?? app?.element));
Hooks.on("renderJournalEntrySheet", (app, html) => attachJournalImport(app, html ?? app?.element));
Hooks.on("renderJournalEntryPagePDFSheet", (app, html) => attachJournalImport(app, html ?? app?.element));
Hooks.on("renderApplicationV2", (app, element) => {
  if (isJournalDirectory(app, element)) {
    attachJournalDirectoryButton(element ?? app?.element);
    return;
  }
  const name = String(app?.constructor?.name || "");
  if (/JournalEntry/.test(name) && !/Directory/.test(name)) attachJournalImport(app, element ?? app?.element);
});
Hooks.on("getJournalEntryContextOptions", (_app, options) => {
  try {
    options.unshift({
      name: "Import character page",
      label: "Import character page",
      icon: '<i class="fa-solid fa-book-open"></i>',
      condition: (li) => {
        const id = li?.dataset?.documentId || li?.dataset?.entryId;
        return journalPages(game.journal?.get?.(id)).some((page) => (page.type === "pdf" || page.type === "image") && page.src);
      },
      callback: (li) => {
        const id = li?.dataset?.documentId || li?.dataset?.entryId;
        launchJournalImport(game.journal?.get?.(id), null, null);
      },
      onClick: (li) => {
        const id = li?.dataset?.documentId || li?.dataset?.entryId;
        launchJournalImport(game.journal?.get?.(id), null, null);
      }
    });
  } catch {}
});
Hooks.on("getActorContextOptions", (_app, options) => {
  try {
    options.unshift({
      name: "Generate Hero", label: "Generate Hero",
      icon: '<i class="fa-solid fa-dice"></i>',
      callback: () => launchWizard(), onClick: () => launchWizard()
    });
    options.unshift({
      name: "Import PDF", label: "Import PDF",
      icon: '<i class="fa-solid fa-file-pdf"></i>',
      callback: () => launchPdfImport(), onClick: () => launchPdfImport()
    });
  } catch {}
});

function attachUniversalTableButton() {
  try {
    const hotbar = document.querySelector("#hotbar");
    if (!hotbar || hotbar.querySelector(".faserip-utable-btn")) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "faserip-utable-btn";
    btn.title = "Show or hide the Universal Table";
    btn.innerHTML = '<i class="fa-solid fa-table-cells"></i>';
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      toggleUniversalTable();
    });
    hotbar.prepend(btn);
  } catch (err) {
    console.warn("FASERIP | universal table button", err);
  }
}

Hooks.on("createChatMessage", (message) => {
  const rankId = message.getFlag?.("faserip", "rankId") ?? message.flags?.faserip?.rankId;
  const roll = message.getFlag?.("faserip", "roll") ?? message.flags?.faserip?.roll;
  const color = message.getFlag?.("faserip", "color") ?? message.flags?.faserip?.color;
  if (!rankId || roll == null || !color) return;
  const label = message.getFlag?.("faserip", "label") ?? message.flags?.faserip?.label ?? "FEAT";
  const actorName = message.getFlag?.("faserip", "actorName") ?? message.flags?.faserip?.actorName ?? message.speaker?.alias ?? "";
  if (workflowOn("showUniversalTable")) {
    showRollOnTable({ rankId, roll, color, label, actorName }).catch((err) => {
      console.warn("FASERIP | universal table", err);
    });
  }
  const damageAmount = message.getFlag?.("faserip", "damageAmount") ?? message.flags?.faserip?.damageAmount;
  const checkColumn = message.getFlag?.("faserip", "checkColumn") ?? message.flags?.faserip?.checkColumn;
  if (damageAmount == null && !checkColumn) return;
  openCombatChain(message).catch((err) => console.warn("FASERIP | combat chain", err));
});

function bindFeatMessage(message, html) {
  try { bindFeatChat(message, html); } catch (err) { console.warn("FASERIP | feat chat", err); }
}

Hooks.on("renderChatMessageHTML", bindFeatMessage);

function attachAwardButton(root) {
  try {
    if (!game.user?.isGM) return;
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
    if (scope.querySelector?.(".faserip-award")) return;
    const header = scope.querySelector(".header-actions")
      || scope.querySelector(".directory-header")
      || scope.querySelector("header")
      || el;
    if (!header || header.querySelector?.(".faserip-award")) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "faserip-award";
    btn.innerHTML = '<i class="fa-solid fa-award"></i> Award';
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      promptJudgeAward();
    });
    header.appendChild(btn);
  } catch (err) {
    console.warn("FASERIP | award button", err);
  }
}

Hooks.on("renderHotbar", () => attachUniversalTableButton());

Hooks.once("ready", () => {
  console.log("FASERIP | Ready", game.version, "system", VERSION);
  registerWorkflowSocket();
  registerComicSocket();
  injectScrollableWindowStyles();
  attachUniversalTableButton();
  attachGenerateButton(ui.actors?.element);
  attachAwardButton(ui.actors?.element);
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

function protectRecentHealth(actor, changes) {
  const lock = actor.getFlag?.("faserip", "healthLock") || actor.flags?.faserip?.healthLock;
  if (!lock || Date.now() - Number(lock.at || 0) > 2500) return;
  const locked = Number(lock.value);
  if (!Number.isFinite(locked)) return;
  const nested = changes?.system?.health;
  if (nested && nested.value != null && Number(nested.value) > locked) nested.value = locked;
  if (changes && changes["system.health.value"] != null && Number(changes["system.health.value"]) > locked) {
    changes["system.health.value"] = locked;
  }
}

Hooks.on("preUpdateActor", (actor, changes, options) => {
  if (!options?.faseripDamage && !options?.faseripHeal && !options?.faseripApplyRolls) {
    try { protectRecentHealth(actor, changes); } catch (err) {
      console.warn("FASERIP | protectRecentHealth", err);
    }
  }
  if (options?.faseripApplyRolls || options?.faseripReapply || options?.faseripDamage || options?.faseripAdvance) return;
  if (changes) {
    for (const key of Object.keys(changes)) {
      const match = String(key).match(/^system\.abilities\.([^.]+)\.(rank|number)$/);
      if (!match) continue;
      changes.system = changes.system || {};
      changes.system.abilities = { ...(changes.system.abilities || {}) };
      changes.system.abilities[match[1]] = { ...(changes.system.abilities[match[1]] || {}), [match[2]]: changes[key] };
    }
  }
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
  if (!actor || actor._faseripReapplyLock) return;
  if (!actor.getFlag("faserip", "rolledStats")) return;
  actor._faseripReapplyLock = true;
  try {
    const mod = await import("./module/chargen.mjs");
    if (typeof mod.reapplyRolledStats === "function") await mod.reapplyRolledStats(actor);
  } catch {}
  finally { actor._faseripReapplyLock = false; }
}

Hooks.on("updateActor", (actor, _changes, options) => {
  if (options?.faseripApplyRolls || options?.faseripReapply || options?.faseripAdvance) return;
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
  import("./module/chargen.mjs")
    .then((mod) => mod.syncFullResourcePools?.(actor))
    .catch(() => {});
});

Hooks.on("renderApplicationV2", (app) => {
  const actor = app?.actor ?? app?.document;
  if (!actor || actor.documentName !== "Actor") return;
  tryReapplyRolledStats(actor).catch(() => {});
});

Hooks.on("updateCombat", (combat, changes) => {
  if (changes?.round == null) return;
  import("./module/battle-results.mjs")
    .then((mod) => mod.tickCombatConditions(combat))
    .catch((err) => console.warn("FASERIP | condition clock", err));
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
