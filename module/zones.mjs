import { rankValue } from "./config.mjs";

const REGION_EVENTS = () => globalThis.CONST?.REGION_EVENTS || globalThis.foundry?.CONST?.REGION_EVENTS || {
  TOKEN_ENTER: "tokenEnter",
  TOKEN_TURN_START: "tokenTurnStart"
};

function gridSize() {
  return Number(globalThis.canvas?.grid?.size) || 100;
}

export function circleTemplateData(point, radiusPx, color, label) {
  const grid = gridSize();
  const unit = Number(globalThis.canvas?.scene?.grid?.distance) || 5;
  return {
    t: "circle",
    x: point.x,
    y: point.y,
    distance: (radiusPx / grid) * unit,
    direction: 0,
    fillColor: color,
    borderColor: color,
    hidden: false,
    flags: { faserip: { area: label || "area" } }
  };
}

export function coveredBy(point, radiusPx) {
  const tokens = globalThis.canvas?.tokens?.placeables ?? [];
  const names = [];
  for (const token of tokens) {
    const center = token.center || { x: token.x, y: token.y };
    if (Math.hypot(center.x - point.x, center.y - point.y) <= radiusPx) names.push(token.name);
  }
  const squares = Math.max(1, Math.round(Math.PI * (radiusPx / gridSize()) ** 2));
  const who = names.length ? ` Inside: ${names.join(", ")}.` : " Nobody is standing in it.";
  return `${squares} square${squares === 1 ? "" : "s"}.${who}`;
}

export function zoneBehaviorData(zone, rank) {
  const models = globalThis.CONFIG?.RegionBehavior?.dataModels;
  if (!models?.faseripZone) return null;
  return {
    name: zone,
    type: "faseripZone",
    system: { zone, rank: rank || "typical" }
  };
}

function zoneTag(zone) {
  if (zone === "ice") return "cold";
  if (zone === "radiation") return "radiation";
  if (zone === "storm") return "";
  return "fire";
}

async function applyZone(behavior, event, when) {
  const zone = behavior.zone || "fire";
  const token = event?.data?.token;
  const actor = token?.actor;
  if (!actor) return;
  const regionId = behavior.parent?.parent?.id || behavior.parent?.id || zone;
  const round = globalThis.game?.combat?.round ?? "out";
  const stamp = `${regionId}:${round}:${when}`;
  if (token.getFlag?.("faserip", "zoneHit") === stamp) return;
  try { await token.setFlag?.("faserip", "zoneHit", stamp); } catch { /* the effect still runs */ }
  if (zone === "ice" || zone === "weather" || zone === "storm" || zone === "illusion" || zone === "animate" || zone === "mark") {
    const line = zone === "ice"
      ? `${actor.name} steps onto the ice.`
      : zone === "illusion"
        ? `${actor.name} is inside an illusion. Intuition can test it.`
        : zone === "animate"
          ? `${actor.name} is in the animated area.`
          : zone === "mark"
            ? `${actor.name} is inside the working.`
            : `${actor.name} is in the weather.`;
    globalThis.ui?.notifications?.info(line);
    return;
  }
  if (zone === "bind") {
    try { await actor.setFlag("faserip", "stuck", true); } catch { /* the note still lands */ }
    globalThis.ui?.notifications?.info(`${actor.name} is caught in the rings.`);
    return;
  }
  if (when === "enter" && globalThis.game?.combat) return;
  const amount = rankValue(behavior.rank || "typical");
  const tag = zoneTag(zone);
  const { resistHarm } = await import("./resistances.mjs");
  const harm = resistHarm(actor, { rankId: behavior.rank || "typical", tags: tag ? [tag, "energy"] : ["energy"], amount, name: zone });
  if (harm.result === "cancel") {
    globalThis.ui?.notifications?.info(harm.note || `${actor.name} shrugs off the ${zone}.`);
    return;
  }
  const dealt = harm.result === "reduce" ? harm.amount : amount;
  if (!(dealt > 0) || typeof actor.applyDamage !== "function") return;
  const taken = await actor.applyDamage(dealt, { energy: true });
  const note = harm.note ? ` ${harm.note}` : "";
  globalThis.ui?.notifications?.info(`${actor.name} takes ${taken} from the ${zone}.${note}`);
}

export function registerZones() {
  try {
  const Type = globalThis.foundry?.data?.regionBehaviors?.RegionBehaviorType;
  const { StringField } = globalThis.foundry?.data?.fields || {};
  const models = globalThis.CONFIG?.RegionBehavior?.dataModels;
  if (!Type || !StringField || !models || models.faseripZone) return;
  const events = REGION_EVENTS();
  class FaseripZoneBehavior extends Type {
    static defineSchema() {
      return {
        zone: new StringField({ initial: "fire" }),
        rank: new StringField({ initial: "typical" })
      };
    }
  }
  FaseripZoneBehavior.events = {
    [events.TOKEN_ENTER]: function onEnter(event) { return applyZone(this, event, "enter"); },
    [events.TOKEN_TURN_START]: function onTurn(event) { return applyZone(this, event, "turn"); }
  };
  models.faseripZone = FaseripZoneBehavior;
  if (globalThis.CONFIG.RegionBehavior.typeIcons) {
    globalThis.CONFIG.RegionBehavior.typeIcons.faseripZone = "fa-solid fa-fire";
  }
  } catch (err) {
    console.warn("FASERIP | region behavior", err);
  }
}

export async function syncWeatherZone(scene, mode, rank = "typical") {
  if (!scene?.createEmbeddedDocuments) return;
  const existing = [...(scene.regions ?? [])].filter((region) => region.getFlag?.("faserip", "weatherZone"));
  if (mode === "clear" || mode === "wind") {
    if (existing.length) await scene.deleteEmbeddedDocuments("Region", existing.map((region) => region.id));
    return;
  }
  const width = Number(scene.width || globalThis.canvas?.dimensions?.width || 4000);
  const height = Number(scene.height || globalThis.canvas?.dimensions?.height || 4000);
  const behavior = zoneBehaviorData("weather", rank);
  const behaviors = [];
  if (mode === "storm" || mode === "rain") {
    behaviors.push({ name: "Weather", type: "modifyMovementCost", system: { difficulties: { walk: mode === "storm" ? 2 : 1 } } });
  }
  if (behavior) behaviors.push(behavior);
  const data = {
    name: mode === "fog" ? "Fog" : "Weather",
    color: mode === "fog" ? "#94a3b8" : "#64748b",
    shapes: [{ type: "rectangle", x: 0, y: 0, width, height, rotation: 0 }],
    behaviors,
    flags: { faserip: { weatherZone: mode } }
  };
  if (existing.length) {
    await scene.updateEmbeddedDocuments("Region", [{ _id: existing[0].id, ...data }]);
    if (existing.length > 1) await scene.deleteEmbeddedDocuments("Region", existing.slice(1).map((region) => region.id));
    return;
  }
  await scene.createEmbeddedDocuments("Region", [data]);
}
