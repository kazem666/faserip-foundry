import { RANKS, colorForRoll, rankLabel } from "../config.mjs";

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

export function buildTable(highlight) {
  const hitRank = highlight?.rankId || "";
  const hitRoll = Number(highlight?.roll);
  const hitBand = Number.isFinite(hitRoll) ? bandForRoll(hitRoll) : null;
  const colorName = highlight?.color
    ? highlight.color.charAt(0).toUpperCase() + highlight.color.slice(1)
    : "";
  const caption = highlight
    ? `${highlight.actorName ? `${highlight.actorName} · ` : ""}${highlight.label || "FEAT"} · ${rankLabel(hitRank)} · ${hitRoll} · ${colorName}`
    : "Column is the rank. Row is the d100. White, green, yellow, and red match the chat card.";

  const head = RANKS.map((rank) => {
    const marked = rank.id === hitRank ? " hit-col" : "";
    return `<th class="rank${marked}" title="${esc(rank.label)}">${esc(rank.abbr)}</th>`;
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

  return `
    <div class="faserip-utable">
      <p class="utable-caption ${esc(highlight?.color || "")}">${esc(caption)}</p>
      <div class="utable-legend">
        <span class="swatch white">White</span>
        <span class="swatch green">Green</span>
        <span class="swatch yellow">Yellow</span>
        <span class="swatch red">Red</span>
      </div>
      <div class="utable-scroll">
        <table>
          <thead><tr><th class="corner">d100</th>${head}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </div>
  `;
}

let tableApp = null;

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

    async _replaceHTML(result, content) {
      if (content && result) content.replaceChildren(result);
      content?.querySelector?.(".hit")?.scrollIntoView({ block: "center", inline: "center" });
    }
  };
}

export async function openUniversalTable(highlight = null) {
  const App = TableApp();
  if (!App) return null;
  if (!tableApp) tableApp = new App();
  if (highlight) tableApp.highlight = highlight;
  return tableApp.render(true);
}

export function toggleUniversalTable() {
  if (tableApp?.rendered) return tableApp.close();
  return openUniversalTable(tableApp?.highlight ?? null);
}

export function showRollOnTable(highlight) {
  return openUniversalTable(highlight);
}
