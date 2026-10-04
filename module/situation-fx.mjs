const PREFIX = "faserip_";

const SITUATION_FX = {
  night: { darkness: 0.55 },
  dark: { darkness: 0.92 },
  fog: { darkness: 0.45, particles: [{ type: "fog", options: { density: 0.12 } }] },
  rain: { darkness: 0.3, particles: [{ type: "rain", options: { density: 0.55, splash: true } }] },
  heavyRain: {
    darkness: 0.62,
    particles: [
      { type: "rain", options: { density: 2.4, splash: true } },
      { type: "clouds", options: { density: 0.9 } }
    ]
  },
  heat: {
    filters: [{
      type: "color",
      options: { color: { value: "#ffb15a", apply: true }, saturation: 1.2, brightness: 1.12, contrast: 1.05 }
    }]
  },
  cold: { particles: [{ type: "snow", options: { density: 0.4 } }] },
  underwater: {
    darkness: 0.4,
    particles: [{ type: "bubbles", options: { density: 0.45 } }],
    filters: [{ type: "underwater", options: {} }]
  }
};

function fxOn() {
  return !!globalThis.game?.modules?.get?.("fxmaster")?.active;
}

function viewedScene() {
  return globalThis.canvas?.scene || globalThis.game?.scenes?.current || globalThis.game?.scenes?.active || null;
}

function isActiveJudge() {
  const user = globalThis.game?.user;
  if (!user?.isGM) return false;
  const active = globalThis.game?.users?.activeGM;
  return !active || active.id === user.id;
}

function known(kind, type) {
  const table = kind === "filter"
    ? globalThis.CONFIG?.fxmaster?.filterEffects
    : globalThis.CONFIG?.fxmaster?.particleEffects;
  return !table || !!table[type];
}

function wanted(spec, kind) {
  const rows = kind === "filter" ? spec.filters : spec.particles;
  const out = {};
  for (const row of rows || []) {
    if (!known(kind, row.type)) continue;
    out[`${PREFIX}${row.type}`] = { type: row.type, options: row.options || {} };
  }
  return out;
}

function flagDiff(current, next, path) {
  const update = {};
  for (const key of Object.keys(current || {})) {
    if (!key.startsWith(PREFIX) || next[key]) continue;
    update[`${path}.-=${key}`] = null;
  }
  for (const [key, value] of Object.entries(next)) {
    if (JSON.stringify(current?.[key]) === JSON.stringify(value)) continue;
    update[`${path}.${key}`] = value;
  }
  return update;
}

export async function syncSituationFx(situationId, { quiet = false } = {}) {
  if (!isActiveJudge()) return;
  const scene = viewedScene();
  if (!scene) return;
  const spec = SITUATION_FX[situationId] || {};
  const update = {};
  if (fxOn()) {
    Object.assign(update, flagDiff(scene.getFlag?.("fxmaster", "effects"), wanted(spec, "particle"), "flags.fxmaster.effects"));
    Object.assign(update, flagDiff(scene.getFlag?.("fxmaster", "filters"), wanted(spec, "filter"), "flags.fxmaster.filters"));
  } else if (!quiet && (spec.particles?.length || spec.filters?.length)) {
    globalThis.ui?.notifications?.warn("Gambit's FXMaster is off, so this situation does not play on the scene.");
  }
  const saved = scene.getFlag?.("faserip", "situationView");
  const currentDark = Number(scene.environment?.darknessLevel) || 0;
  if (spec.darkness == null) {
    if (saved && Number.isFinite(Number(saved.darkness))) {
      update["environment.darknessLevel"] = Number(saved.darkness);
      update["flags.faserip.-=situationView"] = null;
    }
  } else if (Math.abs(currentDark - spec.darkness) > 0.01) {
    if (!saved) update["flags.faserip.situationView"] = { darkness: currentDark };
    update["environment.darknessLevel"] = spec.darkness;
  }
  if (!Object.keys(update).length) return;
  await scene.update(update);
}

export function registerSituationFx() {
  const Hooks = globalThis.Hooks;
  if (!Hooks || Hooks._faseripSituationFx) return;
  Hooks._faseripSituationFx = true;
  const run = (id, quiet) => {
    syncSituationFx(id, { quiet }).catch((err) => console.warn("FASERIP | situation fx", err));
  };
  Hooks.on("updateSetting", (setting) => {
    if (setting?.key !== "faserip.situation") return;
    run(setting.value || "", false);
  });
  Hooks.on("canvasReady", () => {
    let id = "";
    try { id = globalThis.game?.settings?.get?.("faserip", "situation") || ""; } catch { id = ""; }
    run(id, true);
  });
}
