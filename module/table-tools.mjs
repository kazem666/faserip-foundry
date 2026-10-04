import { ABILITIES, BATTLE_EFFECTS, battleResult, colorForRoll, rankLabel, shiftRank } from "./config.mjs";
import { abilityForColumn, readPending, writePending } from "./play-rules.mjs";
import { shiftPlan } from "./workflow.mjs";

const COLOR_RANK = { white: 0, green: 1, yellow: 2, red: 3 };
const ABILITY_LABEL = {
  fighting: "Fighting", agility: "Agility", strength: "Strength", endurance: "Endurance",
  reason: "Reason", intuition: "Intuition", psyche: "Psyche"
};

let includeNpc = false;
let pictureApp = null;
let judgeTab = "situation";

export function currentJudgeTab() {
  return judgeTab;
}

function hiddenAttr(id) {
  return judgeTab === id ? "" : " hidden";
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

function requestId() {
  return globalThis.foundry?.utils?.randomID?.() || Math.random().toString(36).slice(2);
}

function sceneActors() {
  const seen = new Set();
  const rows = [];
  for (const token of globalThis.canvas?.tokens?.placeables ?? []) {
    const actor = token.actor;
    if (!actor || seen.has(actor.id)) continue;
    if (actor.type !== "hero" && actor.type !== "character" && actor.type !== "npc") continue;
    seen.add(actor.id);
    rows.push(actor);
  }
  rows.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return rows;
}

function heroes() {
  return sceneActors().filter((actor) => includeNpc || actor.type !== "npc");
}

function resourceLabel(actor) {
  return rankLabel(actor.system?.resources?.rank || "typical");
}

function readStash() {
  try {
    const raw = globalThis.game?.settings?.get?.("faserip", "partyStash");
    const list = JSON.parse(raw || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function writeStash(list) {
  await globalThis.game?.settings?.set?.("faserip", "partyStash", JSON.stringify(list));
}

export function teamPanelHtml() {
  const people = heroes();
  const body = people.length
    ? people.map((actor) => {
      const health = actor.system?.health || {};
      const checked = actor.type === "npc" ? "" : " checked";
      return `<tr>
        <td><input type="checkbox" name="member" value="${esc(actor.id)}"${checked} /></td>
        <td>${esc(actor.name)}</td>
        <td>${Number(health.value || 0)} / ${Number(health.max || 0)}</td>
        <td>${Number(actor.system?.karma?.value || 0)}</td>
        <td>${Number(actor.system?.popularity?.value || 0)}</td>
        <td>${esc(resourceLabel(actor))}</td>
      </tr>`;
    }).join("")
    : `<tr><td colspan="6">No heroes are on this scene.</td></tr>`;
  const stash = readStash();
  const pile = stash.length
    ? stash.map((entry) => `<li><label class="check"><input type="checkbox" name="stash" value="${esc(entry.id)}" /> ${esc(entry.name)}</label></li>`).join("")
    : `<li class="hint">The pile is empty.</li>`;
  const heroOptions = people.map((actor) => `<option value="${esc(actor.id)}">${esc(actor.name)}</option>`).join("");
  const gear = [];
  for (const actor of people) {
    for (const item of actor.items ?? []) {
      if (item.type !== "weapon" && item.type !== "equipment" && item.type !== "power") continue;
      gear.push(`<option value="${esc(actor.id)}|${esc(item.id)}">${esc(actor.name)} — ${esc(item.name)}</option>`);
    }
  }
  return `
    <section data-panel="team"${hiddenAttr("team")}>
      <h3>Team</h3>
      <p class="hint">Heroes on this scene. Award adds Karma to every checked sheet. The pile is shared gear the Judge is holding.</p>
      <label class="check"><input type="checkbox" name="includeNpc" ${includeNpc ? "checked" : ""} /> Include NPCs on the scene</label>
      <table class="team-table">
        <thead><tr><th></th><th>Name</th><th>Health</th><th>Karma</th><th>Popularity</th><th>Resources</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
      <label>Karma <input type="number" name="karma" value="10" step="1" /></label>
      <button type="button" data-action="awardKarma">Award to checked</button>
      <h3>Shared pile</h3>
      <ul class="stash-list">${pile}</ul>
      <label>Give checked pile items to <select name="giveHero">${heroOptions || `<option value="">No hero</option>`}</select></label>
      <button type="button" data-action="giveStash">Give</button>
      <label>Put this on the pile <select name="takeGear">${gear.join("") || `<option value="">Nothing to move</option>`}</select></label>
      <button type="button" data-action="takeGear">Move to the pile</button>
      <label>Or add a note <input type="text" name="stashNote" placeholder="Crate, keys, a case" /></label>
      <button type="button" data-action="addNote">Add note</button>
    </section>`;
}

export function groupPanelHtml() {
  const people = heroes();
  const checks = people.length
    ? people.map((actor) => `<label class="check"><input type="checkbox" name="feat" value="${esc(actor.id)}" checked /> ${esc(actor.name)}</label>`).join("")
    : `<p class="hint">No heroes are on this scene.</p>`;
  const abilities = ABILITIES.map((id) => `<option value="${esc(id)}"${id === "reason" ? " selected" : ""}>${esc(ABILITY_LABEL[id] || id)}</option>`).join("");
  const columns = [`<option value="">Plain FEAT</option>`].concat(
    Object.entries(BATTLE_EFFECTS).map(([id, col]) => `<option value="${esc(id)}">${esc(col.label)}</option>`)
  ).join("");
  const oppose = [`<option value="">No opposition</option>`].concat(
    sceneActors().map((actor) => `<option value="${esc(actor.id)}">${esc(actor.name)}</option>`)
  ).join("");
  return `
    <section data-panel="feat"${hiddenAttr("feat")}>
      <h3>Group FEAT</h3>
      <p class="hint">Each checked hero rolls the same ability. A column uses that column's ability and prints the battle result. Opposition rolls once.</p>
      <div class="check-list">${checks}</div>
      <label>Ability <select name="ability">${abilities}</select></label>
      <label>Column <select name="column">${columns}</select></label>
      <label>Opposition <select name="oppose">${oppose}</select></label>
      <button type="button" data-action="groupFeat">Roll the group</button>
    </section>`;
}

export function picturePanelHtml() {
  return `
    <section data-panel="picture"${hiddenAttr("picture")}>
      <h3>Table picture</h3>
      <p class="hint">Shows an image or a short clip on every client. Clear takes it down.</p>
      <label>File <input type="text" name="picture" placeholder="A world path or a web address" /></label>
      <button type="button" data-action="browsePicture">Browse</button>
      <label>Caption <input type="text" name="caption" placeholder="Optional" /></label>
      <button type="button" data-action="showPicture">Show to the table</button>
      <button type="button" data-action="clearPicture">Clear</button>
    </section>`;
}

function checkedValues(root, name) {
  return [...(root?.querySelectorAll?.(`[name="${name}"]:checked`) ?? [])].map((el) => el.value).filter(Boolean);
}

async function awardKarma(root) {
  const amount = Number(root.querySelector("[name=karma]")?.value || 0);
  if (!amount) {
    globalThis.ui?.notifications?.warn("Enter a Karma amount.");
    return;
  }
  const ids = checkedValues(root, "member");
  if (!ids.length) {
    globalThis.ui?.notifications?.warn("Check at least one hero.");
    return;
  }
  const names = [];
  for (const id of ids) {
    const actor = globalThis.game?.actors?.get?.(id);
    if (!actor) continue;
    const current = Number(actor.system?.karma?.value || 0);
    const next = Math.max(0, current + amount);
    await actor.update({ "system.karma.value": next });
    names.push(actor.name);
  }
  globalThis.ui?.notifications?.info(`${amount > 0 ? "+" : ""}${amount} Karma for ${names.join(", ") || "nobody"}.`);
}

async function giveStash(root) {
  const hero = globalThis.game?.actors?.get?.(root.querySelector("[name=giveHero]")?.value || "");
  const ids = new Set(checkedValues(root, "stash"));
  if (!hero || !ids.size) {
    globalThis.ui?.notifications?.warn("Check pile items and choose a hero.");
    return;
  }
  const stash = readStash();
  const giving = stash.filter((entry) => ids.has(entry.id));
  const data = giving.map((entry) => ({
    name: entry.name || "Gear",
    type: entry.type === "weapon" || entry.type === "power" ? entry.type : "equipment",
    img: entry.img || "icons/svg/item-bag.svg",
    system: entry.system || {}
  }));
  await hero.createEmbeddedDocuments("Item", data);
  await writeStash(stash.filter((entry) => !ids.has(entry.id)));
  globalThis.ui?.notifications?.info(`${hero.name} receives ${giving.map((entry) => entry.name).join(", ")}.`);
}

async function takeGear(root) {
  const raw = root.querySelector("[name=takeGear]")?.value || "";
  const [actorId, itemId] = raw.split("|");
  const actor = globalThis.game?.actors?.get?.(actorId);
  const item = actor?.items?.get?.(itemId);
  if (!item) {
    globalThis.ui?.notifications?.warn("Choose something to move.");
    return;
  }
  const stash = readStash();
  stash.push({
    id: requestId(),
    name: item.name,
    type: item.type,
    img: item.img,
    system: item.toObject?.().system || { ...item.system }
  });
  await writeStash(stash);
  await item.delete();
  globalThis.ui?.notifications?.info(`${item.name} is on the shared pile.`);
}

async function addNote(root) {
  const name = String(root.querySelector("[name=stashNote]")?.value || "").trim();
  if (!name) return;
  const stash = readStash();
  stash.push({ id: requestId(), name, type: "equipment", img: "icons/svg/item-bag.svg", system: { rank: "typical", notes: name } });
  await writeStash(stash);
}

async function spendShift(actor, plan) {
  if (!actor || !plan) return;
  if (!plan.consumeOutgoing && !plan.consumeStrike && !plan.consumeMagicResist) return;
  const pending = readPending(actor);
  const next = { ...pending };
  if (plan.consumeOutgoing) {
    next.nextCs = 0;
    next.nextNote = "";
  }
  if (plan.consumeStrike) {
    next.strikeCs = 0;
    next.strikeNote = "";
  }
  if (plan.consumeMagicResist) {
    next.psycheCs = 0;
    next.psycheNote = "";
  }
  await writePending(actor, next);
}

async function oneRoll(actor, { ability, columnId, oppose }) {
  const used = columnId ? abilityForColumn(columnId, ability) : ability;
  const base = actor.getAbilityRank?.(used) || "typical";
  const plan = shiftPlan(actor, { ability: used, effectsColumn: columnId, target: oppose || null });
  const rankId = shiftRank(base, plan.cs || 0);
  const roll = await new globalThis.Roll("1d100").evaluate({ allowInteractive: false });
  const total = Number(roll.total);
  const color = colorForRoll(rankId, total);
  await spendShift(actor, plan);
  return {
    roll,
    name: actor.name,
    total,
    color,
    rank: rankLabel(rankId),
    effect: columnId ? battleResult(columnId, color) : "",
    note: plan.note || "",
    consumeIncoming: !!plan.consumeIncoming
  };
}

function verdict(hero, oppose) {
  if (!oppose) return "";
  const heroRank = COLOR_RANK[hero.color] ?? 0;
  const opposeRank = COLOR_RANK[oppose.color] ?? 0;
  if (heroRank > opposeRank) return "beats the opposition";
  if (heroRank === opposeRank) return "ties the opposition";
  return "falls short";
}

async function rollGroup(root) {
  const ids = checkedValues(root, "feat");
  if (!ids.length) {
    globalThis.ui?.notifications?.warn("Check at least one hero.");
    return;
  }
  const ability = root.querySelector("[name=ability]")?.value || "reason";
  const columnId = root.querySelector("[name=column]")?.value || "";
  const oppose = globalThis.game?.actors?.get?.(root.querySelector("[name=oppose]")?.value || "") || null;
  const opposeRow = oppose ? await oneRoll(oppose, { ability, columnId, oppose: null }) : null;
  const rows = [];
  const rolls = opposeRow ? [opposeRow.roll] : [];
  let spentIncoming = !!opposeRow?.consumeIncoming;
  for (const id of ids) {
    const actor = globalThis.game?.actors?.get?.(id);
    if (!actor || actor.id === oppose?.id) continue;
    const row = await oneRoll(actor, { ability, columnId, oppose });
    rows.push(row);
    rolls.push(row.roll);
    if (row.consumeIncoming) spentIncoming = true;
  }
  if (spentIncoming && oppose) {
    const pending = readPending(oppose);
    await writePending(oppose, { ...pending, incomingCs: 0, incomingNote: "" });
  }
  const title = columnId ? (BATTLE_EFFECTS[columnId]?.label || "Group FEAT") : (ABILITY_LABEL[ability] || "FEAT");
  const lines = rows.map((row) => {
    const mark = verdict(row, opposeRow);
    return `<li><strong>${esc(row.name)}</strong> ${row.total} ${esc(row.color)} (${esc(row.rank)})${row.effect ? ` — ${esc(row.effect)}` : ""}${mark ? ` — ${esc(mark)}` : ""}${row.note ? ` <em>${esc(row.note)}</em>` : ""}</li>`;
  }).join("");
  const opposeLine = opposeRow
    ? `<p><strong>${esc(opposeRow.name)}</strong> opposes at ${opposeRow.total} ${esc(opposeRow.color)} (${esc(opposeRow.rank)})${opposeRow.effect ? ` — ${esc(opposeRow.effect)}` : ""}.</p>`
    : "";
  await globalThis.ChatMessage?.create?.({
    speaker: globalThis.ChatMessage?.getSpeaker?.() || {},
    content: `<div class="faserip-group-feat"><h3>${esc(title)}</h3>${opposeLine}<ul>${lines}</ul></div>`,
    rolls
  });
}

function pictureHtml(src, caption) {
  const video = /\.(mp4|webm|ogg|mov)(\?|$)/i.test(src);
  const media = video
    ? `<video src="${esc(src)}" controls autoplay playsinline></video>`
    : `<img src="${esc(src)}" alt="" />`;
  return `<div class="faserip-picture">${media}${caption ? `<p>${esc(caption)}</p>` : ""}</div>`;
}

function PictureApp() {
  const Base = globalThis.foundry?.applications?.api?.ApplicationV2;
  if (!Base) return null;
  return class FaseripTablePicture extends Base {
    static DEFAULT_OPTIONS = {
      id: "faserip-table-picture",
      classes: ["faserip", "faserip-picture-app"],
      tag: "div",
      window: { title: "At the table", icon: "fa-solid fa-image", resizable: true },
      position: { width: 760, height: 560 }
    };

    async _renderHTML() {
      const root = document.createElement("div");
      root.innerHTML = pictureHtml(this._src || "", this._caption || "");
      return root.firstElementChild;
    }

    async _replaceHTML(result, content) {
      if (content && result) content.replaceChildren(result);
    }
  };
}

function openPicture(src, caption) {
  const App = PictureApp();
  if (!App || !src) return;
  if (!pictureApp) pictureApp = new App();
  pictureApp._src = src;
  pictureApp._caption = caption || "";
  pictureApp.render(true);
}

function closePicture() {
  pictureApp?.close?.();
  pictureApp = null;
}

function emitPicture(action, payload) {
  globalThis.game?.socket?.emit?.("system.faserip", { system: "table", action, ...payload });
}

async function browsePicture(root) {
  const FilePickerImpl = globalThis.foundry?.applications?.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
  if (!FilePickerImpl) return;
  const current = root.querySelector("[name=picture]")?.value || "";
  const path = await new Promise((resolve) => {
    try {
      const picker = new FilePickerImpl({
        type: "imagevideo",
        current,
        callback: (next) => resolve(next || "")
      });
      picker.browse().catch(() => resolve(""));
    } catch {
      resolve("");
    }
  });
  if (path && root.querySelector("[name=picture]")) root.querySelector("[name=picture]").value = path;
}

export function bindTableTools(root, rerender) {
  const refresh = async (work) => {
    await work();
    rerender?.();
  };
  root.querySelector("[name=includeNpc]")?.addEventListener("change", (event) => {
    includeNpc = !!event.currentTarget.checked;
    rerender?.();
  });
  root.querySelector("[data-action=awardKarma]")?.addEventListener("click", (event) => {
    event.preventDefault();
    awardKarma(root).then(() => rerender?.());
  });
  root.querySelector("[data-action=giveStash]")?.addEventListener("click", (event) => {
    event.preventDefault();
    refresh(() => giveStash(root));
  });
  root.querySelector("[data-action=takeGear]")?.addEventListener("click", (event) => {
    event.preventDefault();
    refresh(() => takeGear(root));
  });
  root.querySelector("[data-action=addNote]")?.addEventListener("click", (event) => {
    event.preventDefault();
    refresh(() => addNote(root));
  });
  root.querySelector("[data-action=groupFeat]")?.addEventListener("click", (event) => {
    event.preventDefault();
    rollGroup(root);
  });
  root.querySelector("[data-action=browsePicture]")?.addEventListener("click", (event) => {
    event.preventDefault();
    browsePicture(root);
  });
  root.querySelector("[data-action=showPicture]")?.addEventListener("click", (event) => {
    event.preventDefault();
    const src = String(root.querySelector("[name=picture]")?.value || "").trim();
    const caption = String(root.querySelector("[name=caption]")?.value || "").trim();
    if (!src) {
      globalThis.ui?.notifications?.warn("Choose a picture or clip.");
      return;
    }
    openPicture(src, caption);
    emitPicture("show", { src, caption });
  });
  root.querySelector("[data-action=clearPicture]")?.addEventListener("click", (event) => {
    event.preventDefault();
    closePicture();
    emitPicture("clear", {});
  });
  root.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const tab = button.dataset.tab;
      judgeTab = tab || "situation";
      root.querySelectorAll("[data-tab]").forEach((el) => el.classList.toggle("active", el === button));
      root.querySelectorAll("[data-panel]").forEach((panel) => {
        panel.hidden = panel.dataset.panel !== tab;
      });
    });
  });
}

export function registerTableTools() {
  if (!globalThis.game?.socket) {
    globalThis.Hooks?.once?.("ready", registerTableTools);
    return;
  }
  if (globalThis.game.faserip?._tableSocket) return;
  globalThis.game.faserip = globalThis.game.faserip || {};
  globalThis.game.faserip._tableSocket = true;
  globalThis.game.socket.on("system.faserip", (data) => {
    if (data?.system !== "table") return;
    if (data.action === "show") openPicture(data.src, data.caption);
    if (data.action === "clear") closePicture();
  });
}
