/**
 * Foundry VTT v14 API accessors.
 * Sheet classes are resolved at init-time, never at module parse time.
 */

export function getActorSheetV2() {
  return foundry?.applications?.sheets?.ActorSheetV2 ?? null;
}

export function getItemSheetV2() {
  return foundry?.applications?.sheets?.ItemSheetV2 ?? null;
}

export function getHandlebarsMixin() {
  return foundry?.applications?.api?.HandlebarsApplicationMixin ?? null;
}

export function getActorSheetV1() {
  return foundry?.appv1?.sheets?.ActorSheet ?? globalThis.ActorSheet ?? null;
}

export function getItemSheetV1() {
  return foundry?.appv1?.sheets?.ItemSheet ?? globalThis.ItemSheet ?? null;
}

export function getActorSheetClass() {
  const cls = getActorSheetV1() ?? getActorSheetV2();
  return typeof cls === "function" ? cls : class FaseripStubActorSheet {};
}

export function getItemSheetClass() {
  const cls = getItemSheetV1() ?? getItemSheetV2();
  return typeof cls === "function" ? cls : class FaseripStubItemSheet {};
}

export function getActorsCollection() {
  return foundry?.documents?.collections?.Actors ?? globalThis.Actors ?? null;
}

export function getItemsCollection() {
  return foundry?.documents?.collections?.Items ?? globalThis.Items ?? null;
}

export function getDocumentSheetConfig() {
  return foundry?.applications?.apps?.DocumentSheetConfig ?? globalThis.DocumentSheetConfig ?? null;
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
    content: `<div class=\"faserip-dialog-scroll\">${content}</div>`,
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
    content: `<div class=\"faserip-dialog-scroll\">${content}</div>`,
    rejectClose: false
  });
}

export function formValue(form, name) {
  const el = form?.querySelector?.(`[name=\"${name}\"]`);
  if (!el) return "";
  if (el.type === "checkbox") return !!el.checked;
  return el.value ?? "";
}

export function itemIdFromTarget(target) {
  return target?.closest?.("[data-item-id]")?.dataset?.itemId
    || target?.dataset?.itemId
    || "";
}
