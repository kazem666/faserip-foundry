/**
 * Tabbed window for the system settings that used to sit in one long list.
 */

import { SITUATIONS } from "../situation.mjs";

const PAGES = [
  {
    id: "appearance",
    label: "Appearance",
    groups: [
      { title: "Your screen", keys: ["uiTheme"] },
      { title: "Rolls and hits", keys: ["showUniversalTable", "comicHits", "jb2aVfx"] }
    ]
  },
  {
    id: "books",
    label: "Books",
    groups: [
      { title: "Optional books", keys: ["useUltimatePowersBook", "useUltimateTalents", "useRealmsOfMagic"] }
    ]
  },
  {
    id: "combat",
    label: "Combat",
    groups: [
      {
        title: "Rolling",
        keys: ["workflowEnabled", "autoRollAttack", "playersFastForward", "requireTarget", "autoColumnShifts", "autoDefenseReaction", "showWorkflowButtons"]
      },
      {
        title: "Health and results",
        keys: ["autoApplyDamage", "preferForceField", "autoEnduranceCheck", "autoBattleResults", "autoDyingClock", "autoSlamDirection", "autoLineOfFire", "autoKarmaOnKill", "strictInitiative"]
      }
    ]
  },
  {
    id: "table",
    label: "Table",
    groups: [
      { title: "Situation", keys: ["autoSituation", "situation"] },
      { title: "Movement", keys: ["feetPerArea", "autoFalling"] },
      { title: "Group Karma", keys: ["groupKarma"] }
    ]
  },
  {
    id: "house",
    label: "House rules",
    groups: [
      { title: "Fantastic Success", keys: ["houseFantastic", "houseFantasticBand"] },
      { title: "Team Maneuvers", keys: ["houseTeam"] },
      { title: "Tags", keys: ["houseTags"] },
      { title: "Focus", keys: ["houseFocus", "houseFocusAbility"] },
      { title: "Tailored characters", keys: ["houseTailored", "houseTailoredCap", "houseTailoredWeakness", "houseTailoredBudget"] }
    ]
  }
];

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

function settingConfig(key) {
  return globalThis.game?.settings?.settings?.get?.(`faserip.${key}`) || null;
}

function settingValue(key) {
  try { return globalThis.game.settings.get("faserip", key); }
  catch { return undefined; }
}

function labelFor(setting) {
  return String(setting?.name || "").replace(/^(Workflow|House rule):\s*/, "");
}

function fieldHtml(key, locked) {
  const setting = settingConfig(key);
  if (!setting) return "";
  const value = settingValue(key);
  const disabled = locked ? "disabled" : "";
  const hint = setting.hint ? `<p class="hint">${esc(setting.hint)}</p>` : "";
  if (key === "situation") {
    const options = SITUATIONS.map((row) => `<option value="${esc(row.id)}" ${row.id === (value || "") ? "selected" : ""}>${esc(row.label)}</option>`).join("");
    return `<label class="setting">${esc(labelFor(setting))}<select name="${esc(key)}" ${disabled}>${options}</select>${hint}</label>`;
  }
  if (setting.type === Boolean) {
    return `<label class="setting check"><span><input name="${esc(key)}" type="checkbox" ${value ? "checked" : ""} ${disabled} /> ${esc(labelFor(setting))}</span>${hint}</label>`;
  }
  if (setting.type === Number) {
    const range = setting.range || {};
    const bounds = [
      range.min != null ? `min="${esc(range.min)}"` : "",
      range.max != null ? `max="${esc(range.max)}"` : "",
      range.step != null ? `step="${esc(range.step)}"` : ""
    ].filter(Boolean).join(" ");
    return `<label class="setting">${esc(labelFor(setting))}<input name="${esc(key)}" type="number" value="${esc(value ?? 0)}" ${bounds} ${disabled} />${hint}</label>`;
  }
  const choices = setting.choices || null;
  if (choices) {
    const options = Object.entries(choices).map(([id, label]) => `<option value="${esc(id)}" ${id === value ? "selected" : ""}>${esc(label)}</option>`).join("");
    return `<label class="setting">${esc(labelFor(setting))}<select name="${esc(key)}" ${disabled}>${options}</select>${hint}</label>`;
  }
  return `<label class="setting">${esc(labelFor(setting))}<input name="${esc(key)}" type="text" value="${esc(value ?? "")}" ${disabled} />${hint}</label>`;
}

function pageHtml(page, active, gm) {
  const groups = page.groups.map((group) => {
    const fields = group.keys.map((key) => {
      const setting = settingConfig(key);
      const locked = !gm && setting?.scope === "world";
      return fieldHtml(key, locked);
    }).join("");
    return `<section><h3>${esc(group.title)}</h3>${fields}</section>`;
  }).join("");
  const lock = !gm ? `<p class="hint">World settings on this tab are for the Judge. Your own screen theme can still be saved.</p>` : "";
  return `<div class="settings-body" data-panel="${esc(page.id)}" ${page.id === active ? "" : "hidden"}>${lock}${groups}</div>`;
}

export function makeSettingsApp() {
  const Base = foundry.applications?.api?.ApplicationV2;
  if (!Base) return class { async render() { return this; } async close() { return this; } };
  return class FaseripSettingsApp extends Base {
    static DEFAULT_OPTIONS = {
      id: "faserip-settings",
      classes: ["faserip", "faserip-settings-app"],
      window: { title: "FASERIP Settings", icon: "fa-solid fa-sliders", resizable: true },
      position: { width: 640, height: 720 }
    };

    constructor(options = {}) {
      super(options);
      this.tab = "appearance";
    }

    async _renderHTML() {
      const gm = !!globalThis.game?.user?.isGM;
      const tabs = PAGES.map((page) => `<button type="button" data-tab="${esc(page.id)}" class="${page.id === this.tab ? "active" : ""}">${esc(page.label)}</button>`).join("");
      const panels = PAGES.map((page) => pageHtml(page, this.tab, gm)).join("");
      const root = document.createElement("form");
      root.className = "faserip-settings";
      root.innerHTML = `<nav class="settings-tabs">${tabs}</nav>${panels}<footer><span class="hint" data-status></span><button type="submit">Save</button></footer>`;
      return root;
    }

    async _replaceHTML(result, content) {
      content.replaceChildren(result);
      result.addEventListener("click", (event) => {
        const tab = event.target.closest("[data-tab]");
        if (!tab || !result.contains(tab)) return;
        event.preventDefault();
        this.tab = tab.dataset.tab;
        result.querySelectorAll("[data-tab]").forEach((button) => button.classList.toggle("active", button === tab));
        result.querySelectorAll("[data-panel]").forEach((panel) => { panel.hidden = panel.dataset.panel !== this.tab; });
      });
      result.addEventListener("submit", (event) => {
        event.preventDefault();
        this.#save(result).catch((err) => {
          console.error("FASERIP | settings", err);
          globalThis.ui?.notifications?.error(err.message || "Those settings could not be saved.");
        });
      });
    }

    async #save(root) {
      const gm = !!globalThis.game?.user?.isGM;
      let changed = 0;
      for (const input of root.querySelectorAll("[name]")) {
        const key = input.name;
        const setting = settingConfig(key);
        if (!setting) continue;
        if (setting.scope === "world" && !gm) continue;
        let next = input.type === "checkbox" ? !!input.checked : input.value;
        if (setting.type === Number) next = Number(input.value || 0);
        const current = settingValue(key);
        if (current === next) continue;
        await globalThis.game.settings.set("faserip", key, next);
        changed += 1;
      }
      const status = root.querySelector("[data-status]");
      if (status) status.textContent = changed ? "Saved." : "No changes.";
    }
  };
}
