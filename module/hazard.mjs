import { RANKS, rankValue } from "./config.mjs";
import { squaresPerArea } from "./movement.mjs";

const ABILITIES = [
  ["agility", "Agility"],
  ["endurance", "Endurance"],
  ["strength", "Strength"],
  ["fighting", "Fighting"],
  ["reason", "Reason"],
  ["intuition", "Intuition"],
  ["psyche", "Psyche"]
];

const CONDITIONS = [
  ["", "None"],
  ["held", "Held"],
  ["stun", "Stunned"],
  ["fear", "Fear"],
  ["blind", "Blind"],
  ["deaf", "Deaf"]
];

const stamps = new Map();

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

function regionEvents() {
  return globalThis.CONST?.REGION_EVENTS || globalThis.foundry?.CONST?.REGION_EVENTS || {
    TOKEN_ENTER: "tokenEnter",
    TOKEN_EXIT: "tokenExit",
    TOKEN_MOVE_WITHIN: "tokenMoveWithin",
    TOKEN_TURN_START: "tokenTurnStart"
  };
}

function rankChoices(includeNone) {
  const choices = includeNone ? { "": "None" } : {};
  for (const rank of RANKS) {
    if (rank.id === "shift0") continue;
    choices[rank.id] = rank.label;
  }
  return choices;
}

function abilityLabel(id) {
  return ABILITIES.find((row) => row[0] === id)?.[1] || "Agility";
}

function optionList(rows, selected) {
  return rows.map(([id, label]) => `<option value="${esc(id)}"${id === selected ? " selected" : ""}>${esc(label)}</option>`).join("");
}

function formValue(form, name) {
  return form?.elements?.[name]?.value ?? form?.querySelector?.(`[name="${name}"]`)?.value ?? "";
}

function formChecked(form, name) {
  const el = form?.elements?.[name] || form?.querySelector?.(`[name="${name}"]`);
  return !!el?.checked;
}

function gridSize() {
  return Number(globalThis.canvas?.grid?.size) || 100;
}

function radiusFor(areas) {
  const squares = Math.max(1, squaresPerArea() * (Number(areas) || 1));
  return (squares * gridSize()) / 2;
}

function sceneHazards() {
  return [...(globalThis.canvas?.scene?.regions ?? [])].filter((region) => region.getFlag?.("faserip", "hazard"));
}

export function hazardPanelHtml() {
  const rows = sceneHazards();
  const list = rows.length
    ? rows.map((region) => `<li>${esc(region.name)} <button type="button" data-action="removeHazard" data-region-id="${esc(region.id)}">Remove</button></li>`).join("")
    : `<li class="hint">No hazards on this scene.</li>`;
  return `
    <h3>Hazard</h3>
    <p class="hint">Click the map to drop a patch. Walking in, moving through it, or starting a turn there calls for a FEAT. A failed FEAT takes the damage and the condition. Armor still applies.</p>
    <ul class="stash-list">${list}</ul>
    <button type="button" data-action="placeHazard">Place hazard</button>`;
}

function pickPoint(hint) {
  const board = document.getElementById("board");
  if (!board || !globalThis.canvas?.canvasCoordinatesFromClient) {
    globalThis.ui?.notifications?.warn("The map is not ready.");
    return Promise.resolve(null);
  }
  globalThis.ui?.notifications?.info(hint);
  return new Promise((resolve) => {
    const finish = (point) => {
      board.removeEventListener("pointerdown", onDown, true);
      board.removeEventListener("contextmenu", onMenu, true);
      document.removeEventListener("keydown", onKey, true);
      resolve(point);
    };
    const onKey = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      finish(null);
    };
    const onMenu = (event) => {
      event.preventDefault();
      event.stopPropagation();
      finish(null);
    };
    const onDown = (event) => {
      if (event.button !== 0 && event.button !== 2) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.button === 2) {
        finish(null);
        return;
      }
      finish(globalThis.canvas.canvasCoordinatesFromClient({ x: event.clientX, y: event.clientY }));
    };
    board.addEventListener("pointerdown", onDown, true);
    board.addEventListener("contextmenu", onMenu, true);
    document.addEventListener("keydown", onKey, true);
  });
}

async function askHazard() {
  const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) return null;
  const form = await DialogV2.wait({
    window: { title: "Place hazard" },
    content: `<form class="faserip-feat-dialog">
      <label>Name <input name="name" type="text" value="Hazard" /></label>
      <label>Ability <select name="ability">${optionList(ABILITIES, "agility")}</select></label>
      <label>Intensity <select name="intensity">${optionList(RANKS.filter((rank) => rank.id !== "shift0").map((rank) => [rank.id, rank.label]), "typical")}</select></label>
      <label>Damage <select name="damage">${optionList([["", "None"], ...RANKS.filter((rank) => rank.id !== "shift0").map((rank) => [rank.id, rank.label])], "good")}</select></label>
      <label>Condition <select name="condition">${optionList(CONDITIONS, "")}</select></label>
      <label>Width in areas <input name="areas" type="number" min="0.25" step="0.25" value="1" /></label>
      <label class="check"><input type="checkbox" name="onEnter" checked /> Walking in</label>
      <label class="check"><input type="checkbox" name="onMove" checked /> Moving through</label>
      <label class="check"><input type="checkbox" name="onTurn" checked /> Starting a turn inside</label>
    </form>`,
    buttons: [
      { action: "ok", label: "Click the map", default: true, callback: (_event, button) => button.form },
      { action: "cancel", label: "Cancel" }
    ],
    rejectClose: false
  });
  if (!form || form === "cancel") return null;
  const name = String(formValue(form, "name") || "Hazard").trim() || "Hazard";
  const onEnter = formChecked(form, "onEnter");
  const onMove = formChecked(form, "onMove");
  const onTurn = formChecked(form, "onTurn");
  if (!onEnter && !onMove && !onTurn) {
    globalThis.ui?.notifications?.warn("Choose when the hazard calls for a FEAT.");
    return null;
  }
  return {
    name,
    ability: formValue(form, "ability") || "agility",
    intensity: formValue(form, "intensity") || "typical",
    damage: formValue(form, "damage") || "",
    condition: formValue(form, "condition") || "",
    areas: Math.max(0.25, Number(formValue(form, "areas")) || 1),
    onEnter,
    onMove,
    onTurn
  };
}

export async function placeHazard() {
  if (!globalThis.game?.user?.isGM) return null;
  const scene = globalThis.canvas?.scene;
  if (!scene?.createEmbeddedDocuments) {
    globalThis.ui?.notifications?.warn("Open a scene first.");
    return null;
  }
  if (!globalThis.CONFIG?.RegionBehavior?.dataModels?.faseripHazard) {
    globalThis.ui?.notifications?.warn("Hazard regions are not ready. Reload the world.");
    return null;
  }
  const spec = await askHazard();
  if (!spec) return null;
  const point = await pickPoint(`${spec.name}: click the center. Right-click cancels.`);
  if (!point) return null;
  const radius = radiusFor(spec.areas);
  const drawing = await scene.createEmbeddedDocuments("Drawing", [{
    x: point.x - radius,
    y: point.y - radius,
    shape: { type: "e", width: radius * 2, height: radius * 2 },
    strokeWidth: 4,
    strokeColor: "#9a3412",
    strokeAlpha: 1,
    fillType: 1,
    fillColor: "#f97316",
    fillAlpha: 0.28,
    text: spec.name,
    fontSize: Math.max(16, Math.round(radius * 0.28)),
    textColor: "#431407",
    interface: false,
    hidden: false,
    flags: { faserip: { hazard: true } }
  }]);
  const drawingId = drawing?.[0]?.id || "";
  await scene.createEmbeddedDocuments("Region", [{
    name: spec.name,
    color: "#f97316",
    shapes: [{ type: "ellipse", x: point.x, y: point.y, radiusX: radius, radiusY: radius }],
    behaviors: [{
      name: spec.name,
      type: "faseripHazard",
      system: {
        ability: spec.ability,
        intensity: spec.intensity,
        damage: spec.damage,
        condition: spec.condition,
        onEnter: spec.onEnter,
        onMove: spec.onMove,
        onTurn: spec.onTurn
      }
    }],
    flags: { faserip: { hazard: true, hazardDrawing: drawingId } }
  }]);
  globalThis.ui?.notifications?.info(`${spec.name} is on the map.`);
  return true;
}

export async function removeHazard(regionId) {
  const scene = globalThis.canvas?.scene;
  const region = scene?.regions?.get?.(regionId);
  if (!scene || !region) return;
  const drawingId = region.getFlag?.("faserip", "hazardDrawing");
  await scene.deleteEmbeddedDocuments("Region", [region.id]);
  if (drawingId) {
    try { await scene.deleteEmbeddedDocuments("Drawing", [drawingId]); } catch { /* the patch is already gone */ }
  }
}

function shouldHandle(event) {
  if (event?.user) return !!event.user.isSelf;
  const user = globalThis.game?.user;
  return !!(user?.isActiveGM ?? user?.isGM);
}

function regionIdOf(behavior) {
  return behavior?.parent?.parent?.id || behavior?.parent?.id || behavior?.id || "hazard";
}

function stampKey(token, behavior) {
  const doc = token?.document || token;
  return `${doc?.id || "token"}:${regionIdOf(behavior)}`;
}

function claim(token, behavior, kind) {
  const key = stampKey(token, behavior);
  const row = stamps.get(key) || {};
  if (kind === "turn") {
    const round = globalThis.game?.combat?.round ?? "scene";
    if (row.turn === round) return false;
    row.turn = round;
    stamps.set(key, row);
    return true;
  }
  if (row.cross) return false;
  row.cross = true;
  stamps.set(key, row);
  return true;
}

function release(token, behavior) {
  const row = stamps.get(stampKey(token, behavior));
  if (row) row.cross = false;
}

async function suffer(actor, behavior) {
  const notes = [];
  const amount = rankValue(behavior.damage || "");
  if (amount > 0 && typeof actor.applyDamage === "function") {
    try {
      const taken = await actor.applyDamage(amount, { energy: false });
      notes.push(taken > 0 ? `${taken} Health` : "armor held");
    } catch (err) {
      console.warn("FASERIP | hazard damage", err);
    }
  }
  const condition = behavior.condition || "";
  if (condition && typeof actor.toggleStatusEffect === "function") {
    try {
      await actor.toggleStatusEffect(condition, { active: true, overlay: false });
      if (condition === "fear") await actor.setFlag("faserip", "emotion", "fear");
      const label = CONDITIONS.find((row) => row[0] === condition)?.[1] || condition;
      notes.push(label);
    } catch (err) {
      console.warn("FASERIP | hazard condition", err);
    }
  }
  const name = behavior.parent?.name || behavior.parent?.parent?.name || "Hazard";
  globalThis.ui?.notifications?.info(notes.length ? `${actor.name} is caught by ${name}: ${notes.join(", ")}.` : `${actor.name} fails against ${name}.`);
}

async function runHazard(behavior, event, kind) {
  if (!shouldHandle(event)) return;
  if (kind === "enter" && behavior.onEnter === false) return;
  if (kind === "move" && behavior.onMove === false) return;
  if (kind === "turn" && behavior.onTurn === false) return;
  const token = event?.data?.token;
  const actor = token?.actor || token?.document?.actor;
  if (!token || !actor) return;
  if (kind === "exit") {
    release(token, behavior);
    return;
  }
  if (!claim(token, behavior, kind)) return;
  const { conditionBlock } = await import("./battle-results.mjs");
  if (conditionBlock(actor)) {
    await suffer(actor, behavior);
    return;
  }
  const ability = behavior.ability || "agility";
  const { shiftPlan } = await import("./workflow.mjs");
  const { rollFeat } = await import("./dice/universal-table.mjs");
  const plan = shiftPlan(actor, { ability, reservePending: true });
  const name = behavior.parent?.name || behavior.parent?.parent?.name || "Hazard";
  const message = await rollFeat({
    actor,
    rankId: actor.getAbilityRank?.(ability) || "typical",
    label: `${name} · ${abilityLabel(ability)}`,
    cs: plan.cs,
    intensityId: behavior.intensity || "typical",
    shiftNotes: [name, plan.note].filter(Boolean).join("; "),
    holdPending: true,
    allowKarma: false,
    skipCondition: true
  });
  const passed = message?.flags?.faserip?.intensityPass;
  if (passed) {
    globalThis.ui?.notifications?.info(`${actor.name} gets through ${name}.`);
    return;
  }
  await suffer(actor, behavior);
}

export function registerHazards() {
  try {
    const Type = globalThis.foundry?.data?.regionBehaviors?.RegionBehaviorType;
    const fields = globalThis.foundry?.data?.fields;
    const models = globalThis.CONFIG?.RegionBehavior?.dataModels;
    if (!Type || !fields || !models || models.faseripHazard) return;
    const events = regionEvents();
    class FaseripHazardBehavior extends Type {
      static defineSchema() {
        return {
          ability: new fields.StringField({ initial: "agility", choices: Object.fromEntries(ABILITIES) }),
          intensity: new fields.StringField({ initial: "typical", choices: rankChoices(false) }),
          damage: new fields.StringField({ initial: "" }),
          condition: new fields.StringField({ initial: "" }),
          onEnter: new fields.BooleanField({ initial: true }),
          onMove: new fields.BooleanField({ initial: true }),
          onTurn: new fields.BooleanField({ initial: true })
        };
      }
    }
    const handlers = {};
    if (events.TOKEN_ENTER) handlers[events.TOKEN_ENTER] = function onEnter(event) { return runHazard(this, event, "enter"); };
    if (events.TOKEN_MOVE_WITHIN) handlers[events.TOKEN_MOVE_WITHIN] = function onMove(event) { return runHazard(this, event, "move"); };
    if (events.TOKEN_TURN_START) handlers[events.TOKEN_TURN_START] = function onTurn(event) { return runHazard(this, event, "turn"); };
    if (events.TOKEN_EXIT) handlers[events.TOKEN_EXIT] = function onExit(event) { return runHazard(this, event, "exit"); };
    FaseripHazardBehavior.events = handlers;
    models.faseripHazard = FaseripHazardBehavior;
    if (globalThis.CONFIG.RegionBehavior.typeIcons) {
      globalThis.CONFIG.RegionBehavior.typeIcons.faseripHazard = "fa-solid fa-triangle-exclamation";
    }
  } catch (err) {
    console.warn("FASERIP | hazard region", err);
  }
}
