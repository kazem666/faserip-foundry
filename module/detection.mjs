function modeClass() {
  return globalThis.foundry?.canvas?.perception?.DetectionMode
    || globalThis.CONFIG?.Canvas?.detectionModes?.basicSight?.constructor
    || null;
}

function visionClass() {
  return globalThis.foundry?.canvas?.perception?.VisionMode || null;
}

function addDetection(Detection, id, label, { walls = true, type = "sight" } = {}) {
  const modes = globalThis.CONFIG?.Canvas?.detectionModes;
  if (!Detection || !modes || modes[id]) return;
  class HiddenSight extends Detection {
    _canDetect() {
      return true;
    }
  }
  const types = Detection.DETECTION_TYPES || {};
  const kind = type === "other" ? (types.OTHER ?? types.MOVE ?? 2) : (types.SIGHT ?? 0);
  modes[id] = new HiddenSight({
    id,
    label,
    type: kind,
    walls,
    angle: walls,
    tokenConfig: true
  });
}

function addVision(id, label) {
  const Vision = visionClass();
  const modes = globalThis.CONFIG?.Canvas?.visionModes;
  const dark = modes?.darkvision;
  if (!Vision || !modes || modes[id] || !dark) return;
  try {
    modes[id] = new Vision({
      id,
      label,
      canvas: dark.canvas,
      lighting: dark.lighting,
      vision: dark.vision
    });
  } catch (err) {
    console.warn("FASERIP | vision mode", id, err);
  }
}

export function visionModeId(preferred, fallback = "darkvision") {
  const modes = globalThis.CONFIG?.Canvas?.visionModes;
  if (modes?.[preferred]) return preferred;
  return fallback;
}

export function detectionId(preferred, fallback) {
  const modes = globalThis.CONFIG?.Canvas?.detectionModes;
  if (modes?.[preferred]) return preferred;
  return fallback;
}

export function registerDetection() {
  try {
  const Detection = modeClass();
  addVision("faseripHeat", "Heat Sight");
  addVision("faseripUv", "UV Sight");
  addDetection(Detection, "faseripHeat", "Heat Sight", { walls: true, type: "sight" });
  addDetection(Detection, "faseripRadar", "Radar", { walls: false, type: "other" });
  addDetection(Detection, "faseripEnergy", "Energy Detection", { walls: true, type: "sight" });
  addDetection(Detection, "faseripTrue", "True Sight", { walls: true, type: "sight" });
  } catch (err) {
    console.warn("FASERIP | detection modes", err);
  }
}
