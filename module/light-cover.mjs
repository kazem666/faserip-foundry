import { gridSeparation } from "./movement.mjs";

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

function gridUnit() {
  const distance = Number(globalThis.canvas?.grid?.distance ?? globalThis.canvas?.scene?.grid?.distance);
  return distance > 0 ? distance : 5;
}

function placeables() {
  return globalThis.canvas?.tokens?.placeables ?? [];
}

export function lightRadius(token) {
  const doc = token?.document || token;
  const light = doc?.light;
  if (!light || light.negative || doc.hidden) return 0;
  if (light.alpha != null && Number(light.alpha) <= 0) return 0;
  const level = Number(globalThis.canvas?.scene?.environment?.darknessLevel) || 0;
  const gate = light.darkness;
  if (gate && (level < Number(gate.min ?? 0) || level > Number(gate.max ?? 1))) return 0;
  return Math.max(Number(light.bright) || 0, Number(light.dim) || 0);
}

function within(token, source) {
  const reach = lightRadius(source);
  if (!(reach > 0) || !token || !source) return false;
  const unit = gridUnit();
  const horizontal = gridSeparation(token, source) * unit;
  const vertical = Math.abs((Number(token.document?.elevation) || 0) - (Number(source.document?.elevation) || 0));
  return Math.hypot(horizontal, vertical) <= reach + 0.05;
}

export function tokenInLight(token) {
  if (!token) return null;
  let best = null;
  for (const source of placeables()) {
    if (!within(token, source)) continue;
    const gap = gridSeparation(token, source);
    if (!best || gap < best.gap) best = { source, gap };
  }
  return best?.source || null;
}

export function tokensShareLight(from, to) {
  if (!from || !to) return false;
  for (const source of placeables()) {
    if (within(from, source) && within(to, source)) return true;
  }
  return false;
}

function plainLight(doc) {
  try {
    if (typeof doc.light?.toObject === "function") return doc.light.toObject();
  } catch {
    /* use the fields that are already on the token */
  }
  const light = doc.light || {};
  return {
    bright: Number(light.bright) || 0,
    dim: Number(light.dim) || 0,
    alpha: light.alpha,
    color: light.color,
    negative: !!light.negative,
    animation: light.animation,
    darkness: light.darkness
  };
}

export function lightCensus() {
  const units = String(globalThis.canvas?.scene?.grid?.units || "ft");
  const on = [];
  const doused = [];
  for (const token of placeables()) {
    const doc = token.document;
    if (!doc) continue;
    const name = token.name || doc.name || "Token";
    if (doc.getFlag?.("faserip", "dousedLight")) doused.push(name);
    const radius = lightRadius(token);
    if (radius > 0) on.push({ name, radius, units });
  }
  on.sort((a, b) => a.name.localeCompare(b.name));
  return { on, doused };
}

export function lightPanelHtml() {
  const { on, doused } = lightCensus();
  const rows = on.length
    ? on.map((row) => `<li>${esc(row.name)} · ${Math.round(row.radius)} ${esc(row.units)}</li>`).join("")
    : `<li class="hint">No token lights are on.</li>`;
  const waiting = doused.length ? `<p class="hint">${doused.length} doused, ready to relight.</p>` : "";
  return `
    <h3>Lights</h3>
    <p class="hint">Anyone standing in a token's light ignores the darkness column shift. Night vision ignores darkness everywhere.</p>
    <ul class="stash-list">${rows}</ul>
    ${waiting}
    <button type="button" data-action="douseLights">Douse lights</button>
    <button type="button" data-action="relightLights">Relight</button>`;
}

export async function douseSceneLights() {
  const scene = globalThis.canvas?.scene;
  if (!scene || !globalThis.game?.user?.isGM) return 0;
  const updates = [];
  for (const token of placeables()) {
    const doc = token.document;
    if (!doc || !(lightRadius(token) > 0)) continue;
    const light = plainLight(doc);
    updates.push({
      _id: doc.id,
      light: { ...light, bright: 0, dim: 0 },
      flags: { faserip: { dousedLight: light } }
    });
  }
  if (!updates.length) {
    globalThis.ui?.notifications?.info("No lights are on.");
    return 0;
  }
  await scene.updateEmbeddedDocuments("Token", updates);
  globalThis.ui?.notifications?.info(`Doused ${updates.length} light${updates.length === 1 ? "" : "s"}.`);
  return updates.length;
}

export async function relightSceneLights() {
  const scene = globalThis.canvas?.scene;
  if (!scene || !globalThis.game?.user?.isGM) return 0;
  const updates = [];
  for (const token of placeables()) {
    const doc = token.document;
    const saved = doc?.getFlag?.("faserip", "dousedLight");
    if (!doc || !saved) continue;
    updates.push({
      _id: doc.id,
      light: saved,
      "flags.faserip.-=dousedLight": null
    });
  }
  if (!updates.length) {
    globalThis.ui?.notifications?.info("No doused lights to restore.");
    return 0;
  }
  await scene.updateEmbeddedDocuments("Token", updates);
  globalThis.ui?.notifications?.info(`Relit ${updates.length} light${updates.length === 1 ? "" : "s"}.`);
  return updates.length;
}
