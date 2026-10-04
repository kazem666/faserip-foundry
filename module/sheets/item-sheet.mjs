import { RANKS, BATTLE_EFFECTS } from "../config.mjs";
import { ammoStatus, defaultCapacity, isSpareAmmo, spareRounds, tracksAmmo } from "../ammo.mjs";
import { chargeStatus, expendableKind, tracksCharges } from "../charges.mjs";
import { getItemSheetV2, getItemSheetV1, getItemSheetClass, getHandlebarsMixin } from "../foundry-api.mjs";

const TEMPLATE = "systems/faserip/templates/item/item-sheet.hbs";

function fillItemContext(sheet, context = {}) {
  const item = sheet.document ?? sheet.item;
  context.item = item;
  context.system = item.system;
  context.ranks = RANKS;
  context.columns = Object.entries(BATTLE_EFFECTS).map(([id, col]) => ({ id, label: col.label }));
  context.isPower = item.type === "power";
  context.isTalent = item.type === "talent";
  context.isContact = item.type === "contact";
  context.isWeapon = item.type === "weapon";
  context.isEquipment = item.type === "equipment" || item.type === "weapon";
  context.canVeil = item.type === "power" || item.type === "equipment" || item.type === "weapon";
  context.veiled = !!item.system?.unknown && !globalThis.game?.user?.isGM;
  context.displayName = context.veiled ? "Unknown" : item.name;
  context.showVeilToggle = context.canVeil && !!globalThis.game?.user?.isGM;
  context.activity = item.system?.activity || {};
  context.tracksAmmo = tracksAmmo(item);
  context.ammoAuto = defaultCapacity(item.name, item.system?.weaponType) > 0;
  context.ammo = ammoStatus(item);
  context.spareAmmo = isSpareAmmo(item);
  context.roundsLeft = context.spareAmmo ? spareRounds(item) : 0;
  context.tracksCharges = tracksCharges(item);
  context.chargeAuto = expendableKind(item) !== "";
  context.charges = chargeStatus(item);
  context.chargesLeft = context.charges?.left ?? 0;
  context.chargeField = item.type === "weapon" ? "system.charges" : "system.rounds";
  context.conditions = [
    { id: "", label: "None" },
    { id: "held", label: "Held" },
    { id: "fear", label: "Fear" },
    { id: "stun", label: "Stunned" },
    { id: "blind", label: "Blind" },
    { id: "deaf", label: "Deaf" }
  ];
  context.cssClass = context.cssClass || (sheet.isEditable ? "editable" : "locked");
  context.editable = sheet.isEditable;
  return context;
}

export function buildItemSheetClass() {
  const Mixin = getHandlebarsMixin();
  const V2 = getItemSheetV2();
  if (typeof Mixin === "function" && typeof V2 === "function") {
    return class FaseripItemSheet extends Mixin(V2) {
      static DEFAULT_OPTIONS = {
        classes: ["faserip", "sheet", "item"],
        tag: "form",
        position: { width: 520, height: 680 },
        window: { resizable: true, icon: "fa-solid fa-bolt" },
        form: { submitOnChange: true, closeOnSubmit: false },
        actions: {
          identifyItem(_event) {
            const item = this.document;
            import("../unknown.mjs").then((mod) => mod.identifyItem(item?.actor, item));
          },
          reloadWeapon(_event) {
            const item = this.document;
            import("../ammo.mjs").then((mod) => mod.reloadWeapon(item?.actor, item));
          }
        }
      };
      static PARTS = { body: { template: TEMPLATE, scrollable: [""] } };
      async _prepareContext(options) {
        const context = await super._prepareContext(options);
        return fillItemContext(this, context);
      }
    };
  }
  const V1 = getItemSheetV1() ?? getItemSheetClass();
  return class FaseripItemSheet extends V1 {
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions ?? {}, {
        classes: ["faserip", "sheet", "item"],
        template: TEMPLATE,
        width: 520,
        height: 560,
        resizable: true,
        submitOnChange: true
      });
    }
    async getData(options) {
      const context = await super.getData(options);
      return fillItemContext(this, context);
    }
  };
}

const ItemSheetBase = getItemSheetClass();
export class FaseripItemSheet extends ItemSheetBase {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions ?? {}, {
      classes: ["faserip", "sheet", "item"],
      template: TEMPLATE,
      width: 520,
      height: 560,
      resizable: true,
      submitOnChange: true
    });
  }
  async getData(options) {
    const context = await super.getData(options);
    return fillItemContext(this, context);
  }
}
