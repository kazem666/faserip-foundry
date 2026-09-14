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

Hooks.once("init", () => {
  try {
    console.log("FASERIP | Initializing system 1.7.0");
    CONFIG.Actor.documentClass = FaseripActor;
    CONFIG.Item.documentClass = FaseripItem;
    CONFIG.Actor.dataModels = { hero: HeroData, npc: NpcData };
    CONFIG.Item.dataModels = { power: PowerData, talent: TalentData, contact: ContactData, equipment: EquipmentData, weapon: WeaponData };
    CONFIG.Combat.initiative = { formula: "1d10 + @initMod", decimals: 0 };
    const DocumentSheetConfig = foundry.applications.apps.DocumentSheetConfig;
    DocumentSheetConfig.registerSheet(Actor, "faserip", FaseripActorSheet, { types: ["hero", "npc"], makeDefault: true, label: "FASERIP Character Sheet" });
    DocumentSheetConfig.registerSheet(Item, "faserip", FaseripItemSheet, { makeDefault: true, label: "FASERIP Item Sheet" });
    Handlebars.registerHelper("eq", (a, b) => a === b);
    game.settings.register("faserip", "useUltimatePowersBook", {
      name: "Use Ultimate Powers Book (MA3)",
      hint: "Judge only. Enables MA3 power-class tables, expanded power list, UPB count table, and UPB weakness rolls during Generate Hero.",
      scope: "world",
      config: true,
      type: Boolean,
      default: false,
      restricted: true
    });
    game.faserip = { rollFeat, promptFeatRoll, generateHero, promptGeneration, createActorWizard, ranks: RANKS, abilities: ABILITIES, battleEffects: BATTLE_EFFECTS, rankLabel, shiftRank, intensityNeeded, initiativeModifier };
  } catch (err) {
    console.error("FASERIP | init failed", err);
    Hooks.once("ready", () => ui.notifications.error("FASERIP failed to initialize: " + err.message));
  }
});

Hooks.once("ready", () => {
  console.log("FASERIP | Ready", game.version);
  ui.notifications.info("FASERIP 1.7.0 loaded. Judges can enable Ultimate Powers Book in Configure Settings.");
});

Hooks.on("renderActorDirectory", (_app, html) => {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root || root.querySelector(".faserip-generate")) return;
  const header = root.querySelector(".header-actions") || root.querySelector(".directory-header") || root.querySelector("header") || root;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "faserip-generate";
  btn.innerHTML = "<i class='fa-solid fa-dice'></i> Generate Hero";
  btn.addEventListener("click", (event) => {
    event.preventDefault();
    createActorWizard().catch((err) => { console.error(err); ui.notifications.error(err.message); });
  });
  header.prepend(btn);
});

Hooks.on("createActor", async (actor, _options, userId) => {
  if (game.user.id !== userId) return;
  if (actor.type !== "hero" && actor.type !== "npc") return;
  try { actor.sheet?.render({ force: true }); }
  catch (err) { console.error("FASERIP | could not open sheet", err); }
});
