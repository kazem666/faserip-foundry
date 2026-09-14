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
import { getActorsCollection, getItemsCollection, getActorSheetClass, getItemSheetClass } from "./module/foundry-api.mjs";

Hooks.once("init", () => {
  console.log("FASERIP | Initializing system 1.3.1 (Foundry v14)");
  CONFIG.Actor.documentClass = FaseripActor;
  CONFIG.Item.documentClass = FaseripItem;
  CONFIG.Actor.dataModels = { hero: HeroData, npc: NpcData };
  CONFIG.Item.dataModels = { power: PowerData, talent: TalentData, contact: ContactData, equipment: EquipmentData, weapon: WeaponData };
  CONFIG.Combat.initiative = { formula: "1d10 + @initMod", decimals: 0 };

  const Actors = getActorsCollection();
  const Items = getItemsCollection();
  Actors.unregisterSheet("core", getActorSheetClass());
  Actors.registerSheet("faserip", FaseripActorSheet, { types: ["hero", "npc"], makeDefault: true, label: "FASERIP Character Sheet" });
  Items.unregisterSheet("core", getItemSheetClass());
  Items.registerSheet("faserip", FaseripItemSheet, { makeDefault: true, label: "FASERIP Item Sheet" });

  Handlebars.registerHelper("eq", (a, b) => a === b);
  game.faserip = { rollFeat, promptFeatRoll, generateHero, promptGeneration, createActorWizard, ranks: RANKS, abilities: ABILITIES, battleEffects: BATTLE_EFFECTS, rankLabel, shiftRank, intensityNeeded, initiativeModifier };
});

Hooks.on("renderActorDirectory", (_app, html) => {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root || root.querySelector(".faserip-generate")) return;
  const header = root.querySelector(".header-actions") || root.querySelector(".directory-header") || root.querySelector("header") || root;
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
  header.appendChild(btn);
});
