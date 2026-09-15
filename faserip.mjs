import { FaseripActor } from "./module/documents/actor.mjs";
import { FaseripItem } from "./module/documents/item.mjs";
import { HeroData, NpcData } from "./module/data/actor-data.mjs";
import { PowerData, TalentData, ContactData, EquipmentData, WeaponData } from "./module/data/item-data.mjs";
import { buildActorSheetClass } from "./module/sheets/actor-sheet.mjs";
import { buildItemSheetClass } from "./module/sheets/item-sheet.mjs";
import { RANKS, ABILITIES, BATTLE_EFFECTS, rankLabel, shiftRank, intensityNeeded, initiativeModifier } from "./module/config.mjs";
import { rollFeat, promptFeatRoll } from "./module/dice/universal-table.mjs";
import { generateHero, promptGeneration } from "./module/chargen.mjs";
import { createActorWizard } from "./module/wizard.mjs";
import { getActorsCollection, getItemsCollection, getDocumentSheetConfig, getActorSheetV1, getItemSheetV1 } from "./module/foundry-api.mjs";
import { ensureCatalogPacks, fillWorldDefinitions } from "./module/compendium.mjs";
import { buildCatalogItemData, describeCatalogItem } from "./module/data/descriptions.mjs";

const VERSION = "1.17.0";

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
