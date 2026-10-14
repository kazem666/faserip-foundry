import { BATTLE_EFFECTS, RANKS, colorForRoll, rankIndex, rankLabel } from "../config.mjs";

const CUTS = [1, 2, 4, 7, 11, 16, 21, 26, 31, 36, 41, 46, 51, 56, 61, 66, 71, 76, 81, 86, 91, 95, 98, 100];

export const TABLE_BANDS = CUTS.map((lo, i) => {
  const hi = i === CUTS.length - 1 ? 100 : CUTS[i + 1] - 1;
  const label = lo === 100 ? "00" : lo === hi
    ? String(lo).padStart(2, "0")
    : `${String(lo).padStart(2, "0")}-${hi === 100 ? "00" : String(hi).padStart(2, "0")}`;
  return { lo, hi, label };
});

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

export function bandForRoll(roll) {
  const n = Math.min(100, Math.max(1, Number(roll) || 1));
  return TABLE_BANDS.find((band) => n >= band.lo && n <= band.hi) ?? TABLE_BANDS[0];
}

const EFFECT_LINES = [
  ["Blunt", "Attack"],
  ["Edged", "Attack"],
  ["Shooting"],
  ["Thrown", "Edged"],
  ["Thrown", "Blunt"],
  ["Energy"],
  ["Force"],
  ["Grappling"],
  ["Grabbing"],
  ["Escaping"],
  ["Charging"],
  ["Dodging"],
  ["Evading"],
  ["Blocking"],
  ["Catching"],
  ["Slam", "Check"],
  ["Stun", "Check"],
  ["Kill", "Check"]
];

const RANK_FACE = {
  shift0: ["0", "0"],
  feeble: ["Fe", "2"],
  poor: ["Pr", "4"],
  typical: ["Ty", "6"],
  good: ["Gd", "10"],
  excellent: ["Ex", "20"],
  remarkable: ["Rm", "30"],
  incredible: ["In", "40"],
  amazing: ["Am", "50"],
  monstrous: ["Mn", "75"],
  unearthly: ["Un", "100"],
  shiftx: ["X", "150"],
  shifty: ["Y", "200"],
  shiftz: ["Z", "500"],
  cl1000: ["1000", "1000"],
  cl3000: ["3000", "3000"],
  cl5000: ["5000", "5000"],
  beyond: ["B", ""]
};

function chartWord(text) {
  return String(text ?? "")
    .replace("Unconscious 1d10 turns", "1d10 turns")
    .replace("E/S (edged/shooting only)", "Edge/Shot")
    .replace("Endurance Loss", "Loss")
    .replace("No Effect", "No")
    .replace("Auto-Hit", "Auto")
    .replace("No Shift", "0")
    .replace(" armor", "");
}

function shortRank(id) {
  return RANKS.find((rank) => rank.id === id)?.label || "";
}

function columnName(highlight) {
  const label = BATTLE_EFFECTS[highlight?.columnId]?.label || "";
  return label.replace(/\s*\([^)]*\)\s*$/, "");
}

function resultWord(highlight) {
  if (highlight?.effect) return String(highlight.effect);
  const column = BATTLE_EFFECTS[highlight?.columnId];
  return column?.[highlight?.color] || "";
}

function shiftCaption(highlight) {
  const from = highlight?.fromRankId || "";
  const to = highlight?.rankId || "";
  const cs = Number(highlight?.cs) || 0;
  if (from && to && from !== to) {
    const delta = rankIndex(to) - rankIndex(from);
    const csText = cs && delta === cs ? ` (${cs > 0 ? `+${cs}` : cs} CS)` : "";
    return `${shortRank(from)} → ${shortRank(to)}${csText}`;
  }
  if (!cs) return "";
  return `${cs > 0 ? `+${cs}` : cs} CS`;
}

function plaqueHtml(highlight) {
  if (!highlight?.rankId && highlight?.roll == null) return "";
  const color = ["white", "green", "yellow", "red"].includes(highlight.color) ? highlight.color : "";
  const colorName = color ? color.charAt(0).toUpperCase() + color.slice(1) : "";
  const column = columnName(highlight);
  const action = highlight.label || "";
  const lead = [highlight.actorName || "", action, column && column !== action ? column : ""].filter(Boolean).join(" · ");
  const word = resultWord(highlight);
  const shift = shiftCaption(highlight);
  const roll = Number.isFinite(Number(highlight.roll)) ? esc(highlight.roll) : "";
  return `<div class="utable-plaque">
    ${color ? `<i class="swatch ${esc(color)}"></i>` : ""}
    ${lead ? `<span class="lead">${esc(lead)}</span>` : ""}
    <span class="rank">${esc(shortRank(highlight.rankId) || rankLabel(highlight.rankId))}</span>
    ${roll ? `<span class="roll-num">${roll}</span>` : ""}
    ${colorName ? `<span class="color-name">${esc(colorName)}</span>` : ""}
    ${word ? `<strong class="effect">${esc(word)}</strong>` : ""}
    ${shift ? `<span class="shift">${esc(shift)}</span>` : ""}
  </div>`;
}

function historyHtml(history, currentId) {
  if (!history?.length) return "";
  const buttons = history.map((entry) => {
    const color = ["white", "green", "yellow", "red"].includes(entry.color) ? entry.color : "";
    const who = entry.actorName || entry.label || "FEAT";
    const current = entry.id === currentId ? " is-current" : "";
    const title = [who, entry.label, columnName(entry), entry.roll, color].filter(Boolean).join(" · ");
    return `<button type="button" class="utable-past${current}" data-roll-id="${esc(entry.id)}" title="${esc(title)}"><i class="swatch ${esc(color)}"></i><span>${esc(who)} ${esc(entry.roll ?? "")}</span></button>`;
  }).join("");
  return `<div class="utable-history">${buttons}</div>`;
}

function rollEntry(highlight) {
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    rankId: highlight?.rankId || "",
    fromRankId: highlight?.fromRankId || "",
    roll: highlight?.roll,
    color: highlight?.color || "",
    label: highlight?.label || "FEAT",
    actorName: highlight?.actorName || "",
    columnId: highlight?.columnId || "",
    effect: highlight?.effect || "",
    cs: Number(highlight?.cs) || 0
  };
}

export function buildTable(highlight, history = [], currentId = "") {
  const effects = Object.values(BATTLE_EFFECTS);
  const hitRank = highlight?.rankId || "";
  const fromRank = highlight?.fromRankId && highlight.fromRankId !== hitRank ? highlight.fromRankId : "";
  const hitRoll = Number(highlight?.roll);
  const hitBand = Number.isFinite(hitRoll) ? bandForRoll(hitRoll) : null;
  const marked = (rank) => {
    if (rank.id === hitRank) return " hit-col";
    if (rank.id === fromRank) return " from-col";
    return "";
  };

  const effectHead = RANKS.map((rank, i) => {
    const lines = EFFECT_LINES[i] || [effects[i]?.label || ""];
    return `<th class="effect${marked(rank)}" title="${esc(effects[i]?.label || "")}">${lines.map(esc).join("<br>")}</th>`;
  }).join("");

  const resultRow = (color, label) => {
    const cells = RANKS.map((rank, i) => {
      const word = effects[i]?.[color] || "";
      return `<td class="${color}${marked(rank)}" title="${esc(word)}">${esc(chartWord(word))}</td>`;
    }).join("");
    return `<tr class="result"><th class="${color}">${label}</th>${cells}</tr>`;
  };

  const rankHead = RANKS.map((rank) => {
    const [face, number] = RANK_FACE[rank.id] || [rank.abbr, String(rank.value)];
    const started = rank.id === fromRank ? ", started here" : "";
    return `<th class="rank${marked(rank)}" title="${esc(rank.label + started)}"><span class="face">${esc(face)}</span>${number ? `<span class="num">${esc(number)}</span>` : ""}</th>`;
  }).join("");

  const body = TABLE_BANDS.map((band) => {
    const markedRow = hitBand && band.lo === hitBand.lo ? " hit-row" : "";
    const cells = RANKS.map((rank) => {
      const color = colorForRoll(rank.id, band.lo);
      const hit = hitBand && band.lo === hitBand.lo && rank.id === hitRank;
      const ghost = rank.id === fromRank ? " from-col" : "";
      const text = hit ? esc(hitRoll) : "";
      return `<td class="${color}${ghost}${hit ? " hit" : ""}" data-rank="${rank.id}" data-lo="${band.lo}" title="${esc(rank.label)} ${band.label} ${color}">${text}</td>`;
    }).join("");
    return `<tr class="${markedRow.trim()}"><th class="dice${markedRow}">${band.label}</th>${cells}</tr>`;
  }).join("");

  return `
    <div class="faserip-utable">
      ${plaqueHtml(highlight)}
      <div class="utable-fit">
        <div class="utable-sheet">
          <table>
          <thead>
            <tr class="effects"><th class="corner">Column</th>${effectHead}</tr>
            ${resultRow("white", "White")}
            ${resultRow("green", "Green")}
            ${resultRow("yellow", "Yellow")}
            ${resultRow("red", "Red")}
            <tr class="ranks"><th class="corner">Rank</th>${rankHead}</tr>
          </thead>
          <tbody>${body}</tbody>
          </table>
        </div>
      </div>
      ${historyHtml(history, currentId)}
    </div>
  `;
}

let tableApp = null;

function readTableFrame() {
  try {
    const raw = globalThis.game?.settings?.get?.("faserip", "utableFrame");
    const data = JSON.parse(raw || "");
    const width = Number(data?.width);
    const height = Number(data?.height);
    const left = Number(data?.left);
    const top = Number(data?.top);
    if (!width || !height || !Number.isFinite(left) || !Number.isFinite(top)) return null;
    const viewW = window.innerWidth || width;
    const viewH = window.innerHeight || height;
    return {
      width: Math.min(Math.max(280, width), Math.max(280, viewW - 16)),
      height: Math.min(Math.max(220, height), Math.max(220, viewH - 16)),
      left: Math.min(Math.max(0, left), Math.max(0, viewW - 80)),
      top: Math.min(Math.max(0, top), Math.max(0, viewH - 80))
    };
  } catch {
    return null;
  }
}

function rememberTableFrame(position) {
  const width = Number(position?.width);
  const height = Number(position?.height);
  const left = Number(position?.left);
  const top = Number(position?.top);
  if (!width || !height || !Number.isFinite(left) || !Number.isFinite(top)) return;
  const settings = globalThis.game?.settings;
  if (!settings?.set) return;
  settings.set("faserip", "utableFrame", JSON.stringify({ left, top, width, height })).catch(() => {});
}

function applyTableFrame(app) {
  const frame = readTableFrame();
  if (!frame || !app?.position) return;
  app.position.left = frame.left;
  app.position.top = frame.top;
  app.position.width = frame.width;
  app.position.height = frame.height;
}

function TableApp() {
  const Base = foundry.applications?.api?.ApplicationV2;
  if (!Base) return null;
  return class FaseripUniversalTable extends Base {
    static DEFAULT_OPTIONS = {
      id: "faserip-universal-table",
      classes: ["faserip", "faserip-universal-table"],
      tag: "div",
      window: {
        title: "Universal Table",
        icon: "fa-solid fa-table-cells",
        resizable: true
      },
      position: { width: 920, height: 640 }
    };

    highlight = null;

    async _renderHTML() {
      const root = document.createElement("div");
      root.innerHTML = buildTable(this.highlight, this._history || [], this._currentId || "");
      return root.firstElementChild;
    }

    _onRender(context, options) {
      super._onRender?.(context, options);
      const content = this.element?.querySelector?.(".window-content") ?? this.element;
      if (!this._fitObserver) this._fitObserver = new ResizeObserver(() => this.#fitTable());
      this._fitWatched ??= new Set();
      for (const node of [this.element, content]) {
        if (node && !this._fitWatched.has(node)) {
          this._fitWatched.add(node);
          this._fitObserver.observe(node);
        }
      }
      if (content && !this._wheelBound) {
        this._wheelBound = (event) => this.#onWheel(event);
        content.addEventListener("wheel", this._wheelBound, { passive: false });
        this._panDown = (event) => this.#onPanDown(event);
        this._panMove = (event) => this.#onPanMove(event);
        this._panUp = (event) => this.#onPanUp(event);
        this._panMenu = (event) => {
          if (event.target?.closest?.(".utable-fit")) event.preventDefault();
        };
        content.addEventListener("pointerdown", this._panDown);
        content.addEventListener("pointermove", this._panMove);
        content.addEventListener("pointerup", this._panUp);
        content.addEventListener("pointercancel", this._panUp);
        content.addEventListener("contextmenu", this._panMenu);
        this._historyClick = (event) => {
          const button = event.target?.closest?.("[data-roll-id]");
          if (!button) return;
          const entry = (this._history || []).find((item) => item.id === button.dataset.rollId);
          if (!entry) return;
          event.preventDefault();
          this.highlight = entry;
          this._currentId = entry.id;
          this._pendingFocus = true;
          this.render({});
        };
        content.addEventListener("click", this._historyClick);
      }
      if (!this.element.querySelector(".utable-fit-btn")) {
        const close = this.element.querySelector('.window-header button[data-action="close"]');
        if (close) {
          const fit = document.createElement("button");
          fit.type = "button";
          fit.className = "header-control icon fa-solid fa-compress utable-fit-btn";
          fit.dataset.tooltip = "Fit the whole chart";
          fit.setAttribute("aria-label", "Fit the whole chart");
          fit.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.#fitAll();
          });
          close.before(fit);
        }
      }
      this.#fitTable();
      if (this._pendingFocus) {
        this._pendingFocus = false;
        requestAnimationFrame(() => this.focusResult());
      }
    }

    async _replaceHTML(result, content) {
      const locked = this.#liveFrame();
      if (content && result) content.replaceChildren(result);
      this._natural = null;
      this.#fitTable();
      if (locked) {
        try { this.setPosition(locked); } catch { /* size is restored after render */ }
      }
    }

    async close(options) {
      rememberTableFrame(this.position);
      this._fitObserver?.disconnect();
      this._fitObserver = null;
      this._fitWatched = null;
      const content = this.element?.querySelector?.(".window-content") ?? this.element;
      if (content && this._wheelBound) content.removeEventListener("wheel", this._wheelBound);
      if (content && this._panDown) {
        content.removeEventListener("pointerdown", this._panDown);
        content.removeEventListener("pointermove", this._panMove);
        content.removeEventListener("pointerup", this._panUp);
        content.removeEventListener("pointercancel", this._panUp);
        content.removeEventListener("contextmenu", this._panMenu);
        content.removeEventListener("click", this._historyClick);
      }
      this._wheelBound = null;
      this._panDown = null;
      this._historyClick = null;
      this._pan = null;
      return super.close(options);
    }

    #liveFrame() {
      const el = this.element;
      if (!el || this.minimized) return null;
      const width = parseFloat(el.style.width);
      const height = parseFloat(el.style.height);
      const left = parseFloat(el.style.left);
      const top = parseFloat(el.style.top);
      if (!width || !height || !Number.isFinite(left) || !Number.isFinite(top)) return null;
      return { left, top, width, height };
    }

    #sheetParts() {
      const host = this.element?.querySelector?.(".utable-fit");
      const sheet = host?.querySelector?.(".utable-sheet");
      return { host, sheet };
    }

    #fitTable() {
      const { host, sheet } = this.#sheetParts();
      if (!host || !sheet || this._fitting) return;
      this._fitting = true;
      if (!this._natural?.w || !this._natural?.h) {
        const previous = sheet.style.zoom;
        sheet.style.zoom = "1";
        const w = sheet.offsetWidth;
        const h = sheet.offsetHeight;
        sheet.style.zoom = previous;
        if (w && h) this._natural = { w, h };
      }
      const availW = host.clientWidth;
      const availH = host.clientHeight;
      if (this._natural?.w && this._natural?.h && availW && availH) {
        this._fitScale = Math.max(0.15, Math.min(availW / this._natural.w, availH / this._natural.h));
        const factor = Math.max(1, this._userFactor || 1);
        this.#place(Math.min(this._fitScale * 8, this._fitScale * factor));
      }
      this._fitting = false;
    }

    #place(zoom) {
      const { host, sheet } = this.#sheetParts();
      if (!host || !sheet) return;
      sheet.style.zoom = String(zoom);
      const slackX = Math.max(0, host.clientWidth - sheet.offsetWidth);
      const slackY = Math.max(0, host.clientHeight - sheet.offsetHeight);
      sheet.style.marginLeft = `${slackX / 2}px`;
      sheet.style.marginTop = `${slackY / 2}px`;
    }

    #onWheel(event) {
      const { host, sheet } = this.#sheetParts();
      if (!host || !sheet || !host.contains(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      const oldZoom = Number(sheet.style.zoom) || this._fitScale || 1;
      const fit = this._fitScale || oldZoom;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? host.clientHeight : 1;
      const factor = Math.exp(-event.deltaY * unit * 0.0015);
      const next = Math.min(fit * 8, Math.max(fit, oldZoom * factor));
      if (Math.abs(next - oldZoom) < 0.001) return;
      this._userFactor = next / fit;
      const rect = host.getBoundingClientRect();
      const marginL = parseFloat(sheet.style.marginLeft) || 0;
      const marginT = parseFloat(sheet.style.marginTop) || 0;
      const offsetX = event.clientX - rect.left;
      const offsetY = event.clientY - rect.top;
      const contentX = (host.scrollLeft + offsetX - marginL) / oldZoom;
      const contentY = (host.scrollTop + offsetY - marginT) / oldZoom;
      this.#place(next);
      host.scrollLeft = contentX * next + (parseFloat(sheet.style.marginLeft) || 0) - offsetX;
      host.scrollTop = contentY * next + (parseFloat(sheet.style.marginTop) || 0) - offsetY;
    }

    #onPanDown(event) {
      if (event.button !== 2) return;
      const { host } = this.#sheetParts();
      if (!host || !host.contains(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      this._pan = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        left: host.scrollLeft,
        top: host.scrollTop
      };
      host.classList.add("is-panning");
      host.setPointerCapture?.(event.pointerId);
    }

    #onPanMove(event) {
      if (!this._pan || event.pointerId !== this._pan.id) return;
      const { host } = this.#sheetParts();
      if (!host) return;
      host.scrollLeft = this._pan.left - (event.clientX - this._pan.x);
      host.scrollTop = this._pan.top - (event.clientY - this._pan.y);
    }

    #onPanUp(event) {
      if (!this._pan || event.pointerId !== this._pan.id) return;
      this.#sheetParts().host?.classList.remove("is-panning");
      this._pan = null;
    }

    focusResult() {
      const { host, sheet } = this.#sheetParts();
      const cell = sheet?.querySelector?.("td.hit");
      if (!host || !sheet || !cell || !this._fitScale) return;
      const regionW = 64 + 48 * 9;
      const regionH = 32 + 20 * 11;
      const zoom = Math.min(
        this._fitScale * 8,
        Math.max(this._fitScale, Math.min(host.clientWidth / regionW, host.clientHeight / regionH))
      );
      this._userFactor = zoom / this._fitScale;
      this.#place(zoom);
      const hostRect = host.getBoundingClientRect();
      const cellRect = cell.getBoundingClientRect();
      host.scrollLeft += (cellRect.left + cellRect.width / 2) - (hostRect.left + hostRect.width / 2);
      host.scrollTop += (cellRect.top + cellRect.height / 2) - (hostRect.top + hostRect.height / 2);
      cell.classList.add("is-landed");
      sheet.querySelector("th.rank.hit-col")?.classList.add("is-landed");
      sheet.querySelector("th.dice.hit-row")?.classList.add("is-landed");
    }

    #fitAll() {
      this._userFactor = 1;
      this.#fitTable();
      const { host } = this.#sheetParts();
      if (!host) return;
      host.scrollLeft = 0;
      host.scrollTop = 0;
    }
  };
}

export async function openUniversalTable(highlight = null, { record = false } = {}) {
  const App = TableApp();
  if (!App) return null;
  if (!tableApp) tableApp = new App();
  const live = tableApp.rendered ? {
    left: tableApp.position.left,
    top: tableApp.position.top,
    width: tableApp.position.width,
    height: tableApp.position.height
  } : null;
  if (!live) applyTableFrame(tableApp);
  if (highlight) {
    const entry = record ? rollEntry(highlight) : highlight;
    if (record) {
      tableApp._history = [entry, ...(tableApp._history || [])].slice(0, 6);
      tableApp._currentId = entry.id;
    } else if (entry.id) tableApp._currentId = entry.id;
    tableApp.highlight = entry;
    tableApp._pendingFocus = true;
  }
  const rendered = await tableApp.render(live ? {} : true);
  if (live?.width && live?.height && !tableApp.minimized) {
    try { tableApp.setPosition(live); } catch { /* keep the size already on screen */ }
  } else if (!live) {
    const frame = readTableFrame();
    if (frame && typeof tableApp.setPosition === "function") {
      try { tableApp.setPosition(frame); } catch { /* position applies on the next open */ }
    }
  }
  return rendered;
}

export function toggleUniversalTable() {
  if (tableApp?.rendered) return tableApp.close();
  return openUniversalTable(tableApp?.highlight ?? null);
}

export function showRollOnTable(highlight) {
  return openUniversalTable(highlight, { record: true });
}
