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
  console.log("FASERIP | Initializing system 1.3.0 (Foundry v14)");

  CONFIG.Actor.documentClass = FaseripActor;
  CONFIG.Item.documentClass = FaseripItem;

  CONFIG.Actor.dataModels = {
    hero: HeroData,
    npc: NpcData
  };
  CONFIG.Item.dataModels = {
    power: PowerData,
    talent: TalentData,
    contact: ContactData,
    equipment: EquipmentData,
    weapon: WeaponData
  };

  CONFIG.Combat.initiative = {
    formula: "1d10 + @initMod",
    decimals: 0
  };

  CONFIG.Actor.trackableAttributes = {
    hero: {
      bar: ["health", "karma"],
      value: ["popularity.value"]
    },
    npc: {
      bar: ["health", "karma"],
      value: ["popularity.value"]
    }
  };

  const Actors = getActorsCollection();
  const Items = getItemsCollection();
  const ActorSheetBase = getActorSheetClass();
  const ItemSheetBase = getItemSheetClass();

  Actors.unregisterSheet("core", ActorSheetBase);
  Actors.registerSheet("faserip", FaseripActorSheet, {
    types: ["hero", "npc"],
    makeDefault: true,
    label: "FASERIP Character Sheet"
  });

  Items.unregisterSheet("core", ItemSheetBase);
  Items.registerSheet("faserip", FaseripItemSheet, {
    makeDefault: true,
    label: "FASERIP Item Sheet"
  });

  Handlebars.registerHelper("eq", (a, b) => a === b);
  Handlebars.registerHelper("gt", (a, b) => Number(a) > Number(b));

  game.faserip = {
    rollFeat,
    promptFeatRoll,
    generateHero,
    promptGeneration,
    createActorWizard,
    ranks: RANKS,
    abilities: ABILITIES,
    battleEffects: BATTLE_EFFECTS,
    rankLabel,
    shiftRank,
    intensityNeeded,
    initiativeModifier
  };
});

Hooks.once("ready", () => {
  console.log("FASERIP | Ready on Foundry", game.version);
});

Hooks.on("createActor", async (actor) => {
  if (actor.type !== "hero" && actor.type !== "npc") return;
  if (actor.system.health.value === 24 && actor.system.health.max) {
    await actor.update({
      "system.health.value": actor.system.health.max,
      "system.karma.value": actor.system.karma.max
    });
  }
});
