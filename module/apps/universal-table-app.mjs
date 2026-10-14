import { BATTLE_EFFECTS, RANKS, colorForRoll, rankLabel } from "../config.mjs";

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

export function buildTable(highlight) {
  const effects = Object.values(BATTLE_EFFECTS);
  const hitRank = highlight?.rankId || "";
  const hitRoll = Number(highlight?.roll);
  const hitBand = Number.isFinite(hitRoll) ? bandForRoll(hitRoll) : null;
  const colorName = highlight?.color
    ? highlight.color.charAt(0).toUpperCase() + highlight.color.slice(1)
    : "";
  const caption = highlight
    ? `${highlight.actorName ? `${highlight.actorName} · ` : ""}${highlight.label || "FEAT"} · ${rankLabel(hitRank)} · ${hitRoll} · ${colorName}`
    : "";
  const marked = (rank) => rank.id === hitRank ? " hit-col" : "";

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
    return `<th class="rank${marked(rank)}" title="${esc(rank.label)}"><span class="face">${esc(face)}</span>${number ? `<span class="num">${esc(number)}</span>` : ""}</th>`;
  }).join("");

  const body = TABLE_BANDS.map((band) => {
    const markedRow = hitBand && band.lo === hitBand.lo ? " hit-row" : "";
    const cells = RANKS.map((rank) => {
      const color = colorForRoll(rank.id, band.lo);
      const hit = hitBand && band.lo === hitBand.lo && rank.id === hitRank;
      const text = hit ? esc(hitRoll) : "";
      return `<td class="${color}${hit ? " hit" : ""}" data-rank="${rank.id}" data-lo="${band.lo}" title="${esc(rank.label)} ${band.label} ${color}">${text}</td>`;
    }).join("");
    return `<tr class="${markedRow.trim()}"><th class="dice${markedRow}">${band.label}</th>${cells}</tr>`;
  }).join("");

  const callout = caption
    ? `<p class="utable-callout ${esc(highlight?.color || "")}">${esc(caption)}</p>`
    : "";

  return `
    <div class="faserip-utable">
      <div class="utable-fit">
        <div class="utable-sheet">
          ${callout}
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
      root.innerHTML = buildTable(this.highlight);
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
      }
      this.#fitTable();
    }

    async _replaceHTML(result, content) {
      if (content && result) content.replaceChildren(result);
      this._natural = null;
      this.#fitTable();
    }

    async close(options) {
      rememberTableFrame(this.position);
      this._fitObserver?.disconnect();
      this._fitObserver = null;
      this._fitWatched = null;
      const content = this.element?.querySelector?.(".window-content") ?? this.element;
      if (content && this._wheelBound) content.removeEventListener("wheel", this._wheelBound);
      this._wheelBound = null;
      return super.close(options);
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
  };
}

export async function openUniversalTable(highlight = null) {
  const App = TableApp();
  if (!App) return null;
  if (!tableApp) tableApp = new App();
  applyTableFrame(tableApp);
  if (highlight) tableApp.highlight = highlight;
  const rendered = await tableApp.render(true);
  const frame = readTableFrame();
  if (frame && typeof tableApp.setPosition === "function") {
    try { tableApp.setPosition(frame); } catch { /* position applies on the next open */ }
  }
  return rendered;
}

export function toggleUniversalTable() {
  if (tableApp?.rendered) return tableApp.close();
  return openUniversalTable(tableApp?.highlight ?? null);
}

export function showRollOnTable(highlight) {
  return openUniversalTable(highlight);
}
