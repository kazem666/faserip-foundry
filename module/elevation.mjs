import { feetPerArea } from "./movement.mjs";

/** Distance at which a token below a flyer is drawn at half size. */
export const ELEVATION_NEAR_FEET = 40;
export const ELEVATION_MIN_SCALE = 0.4;

/**
 * Visual size for a token under a flyer.
 * `riseFeet` is how far above it the flyer is. `horizontalFeet` is the ground distance.
 * Farther away, in the air or across the map, draws smaller.
 */
export function scaleForDistance(riseFeet, horizontalFeet) {
  const rise = Number(riseFeet);
  const horizontal = Number(horizontalFeet);
  if (!(rise > 0.5)) return 1;
  const away = Math.hypot(Math.max(0, horizontal) || 0, rise);
  const scale = ELEVATION_NEAR_FEET / (ELEVATION_NEAR_FEET + away);
  return Math.min(1, Math.max(ELEVATION_MIN_SCALE, scale));
}

function sceneUnitInFeet() {
  const units = String(globalThis.canvas?.scene?.grid?.units || "").toLowerCase();
  if (units.startsWith("area")) return feetPerArea();
  return 1;
}

export function elevationFeet(token) {
  const raw = Number(token?.document?.elevation ?? token?.elevation ?? 0);
  if (!Number.isFinite(raw)) return 0;
  return raw * sceneUnitInFeet();
}

export function feetToSceneElevation(feet) {
  const unit = sceneUnitInFeet();
  const n = Number(feet);
  if (!Number.isFinite(n) || !(unit > 0)) return 0;
  return n / unit;
}

function gridSquareFeet() {
  const distance = Number(globalThis.canvas?.grid?.distance ?? globalThis.canvas?.scene?.grid?.distance ?? 5);
  const per = Number.isFinite(distance) && distance > 0 ? distance : 5;
  return per * sceneUnitInFeet();
}

function horizontalFeet(a, b) {
  const size = Number(globalThis.canvas?.grid?.size || globalThis.canvas?.dimensions?.size || 0);
  if (!(size > 0) || !a?.center || !b?.center) return 0;
  const squares = Math.hypot((a.center.x - b.center.x) / size, (a.center.y - b.center.y) / size);
  return squares * gridSquareFeet();
}

function measureTokens() {
  const all = globalThis.canvas?.tokens?.placeables ?? [];
  const draggedId = globalThis.canvas?.tokens?._draggedToken?.document?.id
    ?? globalThis.canvas?.tokens?._draggedToken?.id;
  return all.filter((token) => {
    if (!token?.document || token.document.hidden && !globalThis.game?.user?.isGM) return false;
    if (draggedId && !token.isPreview && (token.id === draggedId || token.document.id === draggedId)) return false;
    return true;
  });
}

/** Scale for this token from the nearest flyer above it. Tokens at the same height stay full size. */
export function scaleBelowFlyers(token, tokens = measureTokens()) {
  if (!token) return 1;
  const mine = elevationFeet(token);
  let nearest = null;
  for (const other of tokens) {
    if (!other || other === token) continue;
    const rise = elevationFeet(other) - mine;
    if (!(rise > 0.5)) continue;
    const scale = scaleForDistance(rise, horizontalFeet(token, other));
    if (nearest === null || scale > nearest) nearest = scale;
  }
  return nearest ?? 1;
}

let refreshQueued = false;

function requestScaleRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(() => {
    refreshQueued = false;
    const tokens = measureTokens();
    for (const token of tokens) {
      const next = scaleBelowFlyers(token, tokens);
      if (token._faseripElevScale === next) continue;
      token._faseripElevScale = next;
      token.renderFlags?.set({ refreshMesh: true });
    }
  });
}

function installTokenScale() {
  const Base = globalThis.CONFIG?.Token?.objectClass;
  if (typeof Base !== "function" || Base.prototype._faseripElevation) return;
  class FaseripToken extends Base {
    _refreshMeshSizeAndScale() {
      super._refreshMeshSizeAndScale();
      const factor = this._faseripElevScale ?? scaleBelowFlyers(this);
      this._faseripElevScale = factor;
      if (factor < 0.999 && this.mesh?.scale) {
        this.mesh.scale.x *= factor;
        this.mesh.scale.y *= factor;
      }
    }

    _refreshElevation() {
      super._refreshElevation();
      requestScaleRefresh();
    }

    _getTooltipText() {
      const feet = Math.round(elevationFeet(this));
      if (!feet) return "";
      return `${feet > 0 ? "+" : ""}${feet} ft`;
    }
  }
  FaseripToken.prototype._faseripElevation = true;
  CONFIG.Token.objectClass = FaseripToken;
}

function installCombatElevation() {
  const Base = globalThis.CONFIG?.ui?.combat;
  if (typeof Base !== "function" || Base.prototype._faseripElevation) return;
  class FaseripCombatTracker extends Base {
    static PARTS = {
      header: Base.PARTS.header,
      tracker: {
        template: "systems/faserip/templates/combat/tracker.hbs",
        scrollable: [""]
      },
      footer: Base.PARTS.footer
    };

    async _prepareTurnContext(combat, combatant, index) {
      const turn = await super._prepareTurnContext(combat, combatant, index);
      const token = combatant.token;
      turn.elevation = token ? Math.round(elevationFeet(token)) : "";
      turn.canEditElevation = !!token && !!combatant.isOwner;
      const { staysAloft } = await import("./falling.mjs");
      turn.canDrop = !!token && !staysAloft(token) && elevationFeet(token) >= 8 && !!combatant.isOwner;
      return turn;
    }

    _attachFrameListeners() {
      super._attachFrameListeners();
      this.element?.addEventListener("click", (event) => {
        const button = event.target?.closest?.("[data-faserip-drop]");
        if (!button) return;
        event.preventDefault();
        event.stopPropagation();
        const combatantId = button.closest("[data-combatant-id]")?.dataset?.combatantId;
        const token = this.viewed?.combatants?.get(combatantId)?.token;
        if (!token) return;
        import("./falling.mjs").then((mod) => mod.dropToken(token)).catch((err) => {
          console.warn("FASERIP | drop", err);
        });
      });
    }

    _onChangeInput(event) {
      const input = event.target;
      if (input?.classList?.contains("elevation-input")) return this._onUpdateElevation(event);
      return super._onChangeInput(event);
    }

    _onUpdateElevation(event) {
      const combatantId = event.target.closest("[data-combatant-id]")?.dataset?.combatantId;
      const combatant = this.viewed?.combatants?.get(combatantId);
      const token = combatant?.token;
      if (!token || !combatant.isOwner) return;
      const feet = Number(String(event.target.value ?? "").trim());
      if (!Number.isFinite(feet)) return;
      return token.update({ elevation: feetToSceneElevation(feet) });
    }
  }
  FaseripCombatTracker.prototype._faseripElevation = true;
  CONFIG.ui.combat = FaseripCombatTracker;
}

export function registerElevation() {
  installTokenScale();
  installCombatElevation();
  const Hooks = globalThis.Hooks;
  if (!Hooks || Hooks._faseripElevation) return;
  Hooks._faseripElevation = true;
  const refresh = () => requestScaleRefresh();
  Hooks.on("canvasReady", refresh);
  Hooks.on("updateToken", refresh);
  Hooks.on("createToken", refresh);
  Hooks.on("deleteToken", refresh);
}
