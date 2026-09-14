/**
 * Foundry VTT v14 API accessors.
 * Character and item sheets use AppV1 (still supported on v14, removed in v16).
 * Dialogs and editors use V2.
 */

export function getActorSheetClass() {
  return foundry.appv1?.sheets?.ActorSheet
    ?? globalThis.ActorSheet;
}

export function getItemSheetClass() {
  return foundry.appv1?.sheets?.ItemSheet
    ?? globalThis.ItemSheet;
}

export function getActorsCollection() {
  return foundry.documents?.collections?.Actors
    ?? globalThis.Actors;
}

export function getItemsCollection() {
  return foundry.documents?.collections?.Items
    ?? globalThis.Items;
}

export function getTextEditor() {
  return foundry.applications?.ux?.TextEditor?.implementation
    ?? foundry.applications?.ux?.TextEditor
    ?? globalThis.TextEditor;
}

export async function renderSystemTemplate(path, data) {
  const fn = foundry.applications?.handlebars?.renderTemplate ?? globalThis.renderTemplate;
  return fn(path, data);
}

export function deepClone(value) {
  return foundry.utils.deepClone(value);
}

export async function promptForm({ title, content, okLabel = "OK", width } = {}) {
  const DialogV2 = foundry.applications.api.DialogV2;
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
      {
        action: "cancel",
        label: "Cancel",
        icon: "fa-solid fa-xmark"
      }
    ],
    rejectClose: false
  });
  if (!result || result === "cancel") return null;
  return result;
}

export async function confirmDialog({ title, content } = {}) {
  const DialogV2 = foundry.applications.api.DialogV2;
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
