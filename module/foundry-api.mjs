/**
 * Foundry VTT v14 API accessors.
 * AppV1 sheets still work on v14 (removed in v16). Dialogs and editors use V2.
 */

export function getActorSheetClass() {
  return foundry.appv1.sheets.ActorSheet;
}

export function getItemSheetClass() {
  return foundry.appv1.sheets.ItemSheet;
}

export function getActorsCollection() {
  return foundry.documents.collections.Actors;
}

export function getItemsCollection() {
  return foundry.documents.collections.Items;
}

export function getTextEditor() {
  return foundry.applications.ux.TextEditor.implementation;
}

export async function renderSystemTemplate(path, data) {
  return foundry.applications.handlebars.renderTemplate(path, data);
}

export function deepClone(value) {
  return foundry.utils.deepClone(value);
}

export async function promptForm({ title, content, okLabel = "OK", width } = {}) {
  const DialogV2 = foundry.applications.api.DialogV2;
  const result = await DialogV2.wait({
    window: { title, icon: "fa-solid fa-table-list" },
    position: width ? { width } : {},
    content,
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
    window: { title },
    content,
    rejectClose: false
  });
}

export function formValue(form, name) {
  const el = form?.querySelector?.(`[name="${name}"]`);
  if (!el) return "";
  if (el.type === "checkbox") return !!el.checked;
  return el.value ?? "";
}
