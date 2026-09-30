/** Build a playable hero from a character PDF the user chooses. */

import { ABILITIES, rankValue } from "./config.mjs";
import { extractPdfText } from "./pdf-text.mjs";
import { heroSummary, parseCharacterText } from "./pdf-character.mjs";
import { persistGenerationStats, writeGeneratedItem } from "./chargen.mjs";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

function pickPdfFile() {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf,.pdf,text/plain,.txt";
    input.style.display = "none";
    document.body.appendChild(input);
    input.addEventListener("change", () => {
      const file = input.files?.[0] || null;
      input.remove();
      resolve(file);
    }, { once: true });
    input.click();
  });
}

async function readFileText(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const head = String.fromCharCode(...bytes.subarray(0, 5));
  if (head === "%PDF-") return extractPdfText(bytes);
  return new TextDecoder().decode(bytes);
}

async function confirmHero(hero) {
  const DialogV2 = foundry.applications?.api?.DialogV2;
  const body = `<div class="faserip-dialog-scroll">
    <label class="faserip-import-name">Name <input type="text" name="heroName" value="${escapeHtml(hero.name)}"></label>
    <p>Create a character sheet from the ranks below.</p>
    <pre>${escapeHtml(heroSummary(hero))}</pre>
  </div>`;
  if (DialogV2?.input) {
    try {
      const result = await DialogV2.input({
        classes: ["faserip-dialog"],
        window: { title: "Import character", icon: "fa-solid fa-file-pdf" },
        position: { width: 520 },
        content: body,
        ok: { label: "Create character", icon: "fa-solid fa-user" }
      });
      if (!result) return null;
      const typed = String(result.heroName || "").trim();
      if (typed) hero.name = typed.slice(0, 80);
      return hero;
    } catch (err) {
      console.warn("FASERIP | import confirm", err);
    }
  }
  if (!DialogV2?.wait) return hero;
  const choice = await DialogV2.wait({
    classes: ["faserip-dialog"],
    window: { title: "Import character", icon: "fa-solid fa-file-pdf" },
    position: { width: 520 },
    content: body,
    buttons: [
      { action: "create", label: "Create character", icon: "fa-solid fa-user", default: true },
      { action: "cancel", label: "Cancel" }
    ],
    rejectClose: false
  });
  return choice === "create" ? hero : null;
}

export async function importHeroFromText(text, filename, { mechanicsOnly = false, fullSheet = false } = {}) {
  const hero = parseCharacterText(text, { filename, mechanicsOnly, fullSheet });
  if (!hero.found && !hero.powers.length && !hero.talents.length) return { hero, actor: null, empty: true };
  if (hero.found < 4) {
    ui.notifications?.warn(`Found ${hero.found} of 7 abilities. The sheet will still be created from what could be read.`);
  }
  const accepted = await confirmHero(hero);
  if (!accepted) return { hero, actor: null, empty: false };
  const actor = await createHero(accepted, filename);
  ui.notifications?.info(`${actor.name} is ready on the character sheet.`);
  return { hero: accepted, actor, empty: false };
}

async function createHero(hero, filename) {
  const ActorDoc = foundry.documents?.Actor ?? globalThis.Actor;
  const abilities = {};
  const numbers = {};
  for (const key of ABILITIES) {
    const row = hero.abilities[key];
    if (!row) continue;
    abilities[key] = row.id;
    numbers[key] = row.number || rankValue(row.id);
  }
  const actor = await ActorDoc.create({
    name: hero.name || "Imported Hero",
    type: "hero",
    flags: { faserip: { generating: true, importedPdf: filename || "" } }
  }, { renderSheet: false, render: false });
  await persistGenerationStats(actor, {
    abilities,
    numbers,
    resources: hero.resources,
    popularity: hero.popularity,
    origin: hero.identity.origin ? { label: hero.identity.origin } : null
  }, { quiet: true, originLabel: hero.identity.origin || "" });
  const lists = [
    ["power", hero.powers],
    ["talent", hero.talents],
    ["contact", hero.contacts],
    ["weapon", hero.weapons],
    ["equipment", hero.equipment]
  ];
  for (const [type, rows] of lists) {
    for (const row of rows || []) {
      await writeGeneratedItem(actor, type, row.name, { rank: row.rank, number: row.number });
    }
  }
  const update = {};
  for (const [key, value] of Object.entries(hero.identity || {})) {
    if (value) update[`system.identity.${key}`] = value;
  }
  if (hero.weakness) update["system.story.weaknesses"] = hero.weakness;
  if (hero.history) update["system.story.briefHistory"] = hero.history;
  if (hero.notes) update["system.notes"] = `<p>${escapeHtml(hero.notes)}</p>`;
  const healthMax = Number(actor.system.health?.max || 0);
  const karmaMax = Number(actor.system.karma?.max || 0);
  if (hero.health?.value && healthMax && hero.health.value < healthMax) update["system.health.value"] = hero.health.value;
  if (hero.karma?.value && karmaMax && hero.karma.value < karmaMax) update["system.karma.value"] = hero.karma.value;
  if (Object.keys(update).length) await actor.update(update, { faseripApplyRolls: true });
  try { await actor.unsetFlag("faserip", "generating"); } catch {}
  try { actor.sheet?.render(true); } catch { actor.sheet?.render?.({ force: true }); }
  return actor;
}

export async function promptPdfImport() {
  const file = await pickPdfFile();
  if (!file) return null;
  let text = "";
  try {
    text = await readFileText(file);
  } catch (err) {
    console.error("FASERIP | pdf read", err);
    ui.notifications?.error("That PDF could not be read.");
    return null;
  }
  const imported = await importHeroFromText(text, file.name);
  if (imported.empty) {
    ui.notifications?.warn("No character text in that PDF. A typed sheet or a filled form works. A scanned picture of a page does not.");
    return null;
  }
  return imported.actor;
}
