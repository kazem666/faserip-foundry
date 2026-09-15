import { FaseripActor } from "./module/documents/actor.mjs";
import { FaseripItem } from "./module/documents/item.mjs";
import { HeroData, NpcData } from "./module/data/actor-data.mjs";
import { PowerData, TalentData, ContactData, EquipmentData, WeaponData } from "./module/data/item-data.mjs";
import { buildActorSheetClass } from "./module/sheets/actor-sheet.mjs";
import { buildItemSheetClass } from "./module/sheets/item-sheet.mjs";
import { RANKS, ABILITIES, BATTLE_EFFECTS, rankLabel, shiftRank, intensityNeeded, initiativeModifier } from "./module/config.mjs";
import { rollFeat, promptFeatRoll } from "./module/dice/universal-table.mjs";
import { generateHero, writeGeneratedItem, persistGenerationStats } from "./module/chargen.mjs";
import { promptGeneration } from "./module/hero-dice.mjs";
import { createActorWizard } from "./module/wizard.mjs";
import { getActorsCollection, getItemsCollection, getDocumentSheetConfig, getActorSheetV1, getItemSheetV1 } from "./module/foundry-api.mjs";
import { ensureCatalogPacks, fillWorldDefinitions } from "./module/compendium.mjs";
import { buildCatalogItemData, describeCatalogItem } from "./module/data/descriptions.mjs";

const VERSION = "1.17.0";
