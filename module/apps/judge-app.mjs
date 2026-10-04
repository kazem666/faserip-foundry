import { SITUATIONS, currentSituation, rollRandomEvent, setSituation } from "../situation.mjs";
import { rollCityEncounter } from "../encounters.mjs";
import { bindTableTools, currentJudgeTab, groupPanelHtml, picturePanelHtml, teamPanelHtml } from "../table-tools.mjs";

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

function heroRows() {
  const seen = new Set();
  const rows = [];
  const add = (actor, note) => {
    if (!actor || seen.has(actor.id)) return;
    if (actor.type && actor.type !== "hero" && actor.type !== "npc" && actor.type !== "character") return;
    seen.add(actor.id);
    const kind = actor.type === "npc" ? "NPC" : "";
    const extra = [kind, note].filter(Boolean).join(", ");
    rows.push({ id: actor.id, label: extra ? `${actor.name} (${extra})` : actor.name });
  };
  const canvas = globalThis.canvas;
  for (const token of canvas?.tokens?.placeables ?? []) add(token.actor, "on scene");
  for (const actor of globalThis.game?.actors ?? []) add(actor, "");
  return rows;
}

function defaultHeroId(rows) {
  const targeted = [...(globalThis.game?.user?.targets ?? [])][0]?.actor?.id;
  if (targeted && rows.some((row) => row.id === targeted)) return targeted;
  const controlled = globalThis.canvas?.tokens?.controlled?.[0]?.actor?.id;
  if (controlled && rows.some((row) => row.id === controlled)) return controlled;
  return rows[0]?.id || "";
}

function panelHtml() {
  const current = currentSituation();
  const heroes = heroRows();
  const picked = defaultHeroId(heroes);
  const situations = SITUATIONS.map((row) => {
    const mark = row.id === current.id ? " selected" : "";
    return `<option value="${esc(row.id)}"${mark}>${esc(row.label)}</option>`;
  }).join("");
  const heroOptions = heroes.length
    ? heroes.map((row) => `<option value="${esc(row.id)}"${row.id === picked ? " selected" : ""}>${esc(row.label)}</option>`).join("")
    : `<option value="">No heroes in this world</option>`;
  return `
    <div class="faserip-judge">
      <nav class="judge-tabs">
        <button type="button" data-tab="situation" class="${currentJudgeTab() === "situation" ? "active" : ""}">Situation</button>
        <button type="button" data-tab="team" class="${currentJudgeTab() === "team" ? "active" : ""}">Team</button>
        <button type="button" data-tab="feat" class="${currentJudgeTab() === "feat" ? "active" : ""}">Group FEAT</button>
        <button type="button" data-tab="picture" class="${currentJudgeTab() === "picture" ? "active" : ""}">Picture</button>
      </nav>
      <section data-panel="situation"${currentJudgeTab() === "situation" ? "" : " hidden"}>
        <h3>Situation</h3>
        <p class="hint">This applies to FEATs while the workflow is on. Night vision ignores darkness. Water powers ignore underwater. Rain, fog, cold, heat, darkness, and underwater also play on the scene when Gambit's FXMaster is on.</p>
        <label>Situation <select name="situation">${situations}</select></label>
        <button type="button" data-action="setSituation">Set situation</button>
        <h3>Table</h3>
        <button type="button" data-action="randomEvent">Random event</button>
        <label>Hero <select name="hero">${heroOptions}</select></label>
        <p class="hint">City encounter uses this hero's highest ability as the starting rank. Karma on the card goes to that sheet.</p>
        <button type="button" data-action="cityEncounter">City encounter</button>
      </section>
      ${teamPanelHtml()}
      ${groupPanelHtml()}
      ${picturePanelHtml()}
    </div>`;
}

let judgeApp = null;

function JudgeApp() {
  const Base = foundry.applications?.api?.ApplicationV2;
  if (!Base) return null;
  return class FaseripJudgeControls extends Base {
    static DEFAULT_OPTIONS = {
      id: "faserip-judge",
      classes: ["faserip", "faserip-judge-app"],
      tag: "div",
      window: {
        title: "Judge controls",
        icon: "fa-solid fa-gavel",
        resizable: true
      },
      position: { width: 560, height: 720 }
    };

    async _renderHTML() {
      const root = document.createElement("div");
      root.innerHTML = panelHtml();
      return root.firstElementChild;
    }

    async _replaceHTML(result, content) {
      if (content && result) content.replaceChildren(result);
      result?.querySelector("[data-action=setSituation]")?.addEventListener("click", async (event) => {
        event.preventDefault();
        const id = result.querySelector("[name=situation]")?.value || "";
        await setSituation(id);
        this.render(true);
      });
      result?.querySelector("[data-action=randomEvent]")?.addEventListener("click", (event) => {
        event.preventDefault();
        rollRandomEvent();
      });
      result?.querySelector("[data-action=cityEncounter]")?.addEventListener("click", (event) => {
        event.preventDefault();
        const id = result.querySelector("[name=hero]")?.value || "";
        const actor = globalThis.game?.actors?.get?.(id) || null;
        if (!actor) {
          globalThis.ui?.notifications?.warn("Choose a hero. The wheel and the Karma use that sheet.");
          return;
        }
        rollCityEncounter(actor);
      });
      bindTableTools(result, () => this.render(true));
    }
  };
}

export function openJudgeControls() {
  if (!globalThis.game?.user?.isGM) {
    globalThis.ui?.notifications?.warn("Only the Judge opens these controls.");
    return null;
  }
  const App = JudgeApp();
  if (!App) return null;
  if (!judgeApp) judgeApp = new App();
  return judgeApp.render(true);
}

function placeJudgeTool(controls) {
  const tool = {
    name: "faserip-judge",
    title: "Judge controls",
    icon: "fa-solid fa-gavel",
    button: true,
    visible: !!globalThis.game?.user?.isGM,
    order: 100,
    onChange: () => openJudgeControls(),
    onClick: () => openJudgeControls()
  };
  if (Array.isArray(controls)) {
    const tokens = controls.find((row) => row.name === "tokens" || row.name === "token");
    if (!tokens) return;
    tokens.tools = tokens.tools || [];
    if (!tokens.tools.some((row) => row.name === "faserip-judge")) tokens.tools.push(tool);
    return;
  }
  const tokens = controls?.tokens || controls?.token;
  if (!tokens) return;
  if (Array.isArray(tokens.tools)) {
    if (!tokens.tools.some((row) => row.name === "faserip-judge")) tokens.tools.push(tool);
    return;
  }
  tokens.tools = tokens.tools || {};
  tokens.tools["faserip-judge"] = tool;
}

export function registerJudgeControls() {
  const Hooks = globalThis.Hooks;
  if (!Hooks || Hooks._faseripJudge) return;
  Hooks._faseripJudge = true;
  Hooks.on("getSceneControlButtons", placeJudgeTool);
}
