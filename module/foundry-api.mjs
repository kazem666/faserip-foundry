/**
 * Foundry VTT v14 API accessors.
 * Never return undefined from the sheet-class helpers — `class X extends undefined` crashes
 * the whole system module before init hooks run.
 */

function stubSheet(kind) {
  return class FaseripStubSheet {
    static get defaultOptions() {
      return {
        classes: ["faserip", "sheet", kind],
        template: kind === "actor"
          ? "systems/faserip/templates/actor/character-sheet.hbs"
          : "systems/faserip/templates/item/item-sheet.hbs",
        width: kind === "actor" ? 900 : 520,
        height: kind === "actor" ? 820 : 560,
        resizable: true,
        tabs: kind === "actor"
          ? [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "record" }]
          : [],
        submitOnChange: true
      };
    }
    constructor(...args) {
      this.document = args[0]?.document ?? args[0];
      this.object = this.document;
      this.actor = this.document;
      this.item = this.document;
      this.element = null;
      this.isEditable = true;
    }
    async getData() {
      return { actor: this.document, item: this.document, system: this.document?.system ?? {} };
    }
    activateListeners() {}
    render() {
      ui.notifications?.error("FASERIP could not find Foundry's Actor/Item sheet class.");
      return this;
    }
    close() { return Promise.resolve(); }
  };
}

export function getActorSheetClass() {
  const cls = foundry?.appv1?.sheets?.ActorSheet
    ?? globalThis.ActorSheet
    ?? foundry?.appv1?.api?.ActorSheet;
  return typeof cls === "function" ? cls : stubSheet("actor");
}

export function getItemSheetClass() {
  const cls = foundry?.appv1?.sheets?.ItemSheet
    ?? globalThis.ItemSheet
    ?? foundry?.appv1?.api?.ItemSheet;
  return typeof cls === "function" ? cls : stubSheet("item");
}

export function getActorsCollection() {
  return foundry?.documents?.collections?.Actors
    ?? globalThis.Actors
    ?? null;
}

export function getItemsCollection() {
  return foundry?.documents?.collections?.Items
    ?? globalThis.Items
    ?? null;
}

export function getTextEditor() {
  return foundry?.applications?.ux?.TextEditor?.implementation
    ?? foundry?.applications?.ux?.TextEditor
    ?? globalThis.TextEditor
    ?? { enrichHTML: async (s) => s ?? "" };
}

export async function renderSystemTemplate(path, data) {
  const fn = foundry?.applications?.handlebars?.renderTemplate ?? globalThis.renderTemplate;
  return fn(path, data);
}

export function deepClone(value) {
  return foundry.utils.deepClone(value);
}

export async function promptForm({ title, content, okLabel = "OK", width } = {}) {
  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (!DialogV2) {
    ui.notifications?.error("DialogV2 is not available in this Foundry build.");
    return null;
  }
  const result = await DialogV2.wait({
    classes: ["faserip-dialog"],
    window: { title, icon: "fa-solid fa-table-list", resizable: true },
    position: width ? { width } : {},
    content: `<div class="faserip-dialog-scroll">${content}</div>`,
    buttons: [
      {
        action: "ok",
        label: okLabel,
        icon: "fa-solid fa-check",
        default: true,
        callback: (_event, button) => button.form
      },
      { action: "cancel", label: "Cancel", icon: "fa-solid fa-xmark" }
    ],
    rejectClose: false
  });
  if (!result || result === "cancel") return null;
  return result;
}

export async function confirmDialog({ title, content } = {}) {
  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (!DialogV2) return window.confirm(title || "OK");
  return DialogV2.confirm({
    classes: ["faserip-dialog"],
    window: { title, resizable: true },
    content: `<div class="faserip-dialog-scroll">${content}</div>`,
    rejectClose: false
  });
}

export function formValue(form, name) {
  const el = form?.querySelector?.(`[name="${name}"]`);
  if (!el) return "";
  if (el.type === "checkbox") return !!el.checked;
  return el.value ?? "";
}
