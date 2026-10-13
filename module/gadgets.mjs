/**
 * Optional gadget design. Off until the Judge turns the house rule on.
 * The gear shop is unchanged.
 */

import { ABILITIES, BATTLE_EFFECTS, intensityNeeded, rankIndex, rankLabel, rankValue } from "./config.mjs";
import { houseOn } from "./house-rules.mjs";
import { confirmDialog, formValue, promptForm } from "./foundry-api.mjs";
import { PLACE_CATALOG } from "./data/gear-catalogs.mjs";

const GADGET_RANKS = ["feeble", "poor", "typical", "good", "excellent", "remarkable", "incredible", "amazing", "monstrous", "unearthly", "shiftx", "shifty", "shiftz"];
const ATTACKS = ["blunt", "edged", "shooting", "throwEdged", "throwBlunt", "energy", "force"];
const WORK_LAB = {
  "laboratory package": "remarkable",
  "workshop package": "remarkable",
  "medical bay package": "excellent",
  "computer room package": "excellent"
};

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

function abilityKey(name) {
  const key = String(name || "").trim().toLowerCase();
  return ABILITIES.includes(key) ? key : "";
}

export function gadgetStake(ranks, { omni = false } = {}) {
  const values = (ranks || []).map((id) => Math.max(0, rankValue(id))).filter((n) => n > 0);
  if (!values.length) return 0;
  const highest = Math.max(...values);
  const rest = values.reduce((sum, n) => sum + n, 0) - highest;
  const stake = highest * 10 + rest * 5;
  return omni ? stake * 2 : stake;
}

export function omniUses(rankId) {
  return Math.max(1, Math.round(rankValue(rankId) / 10));
}

export function withinLab(labId, rankId) {
  const lab = rankIndex(labId);
  const rank = rankIndex(rankId);
  if (lab < 0 || rank < 0) return false;
  return rank <= lab;
}

export function repairShift(inField, labId, rankId) {
  if (inField || !withinLab(labId, rankId)) return -2;
  return 0;
}

export function partsBand(resources, costRank) {
  const info = intensityNeeded(resources, costRank);
  if (info.delta <= -2) return "refuse";
  if (info.delta === -1) return "red";
  if (info.delta === 0) return "yellow";
  return "green";
}

export function labOptions(resourcesRank, places = []) {
  const rows = [];
  const seen = new Set();
  const add = (id, label) => {
    const key = `${id}|${label}`;
    if (!id || rankIndex(id) < 0 || seen.has(key)) return;
    seen.add(key);
    rows.push({ id, label });
  };
  const resources = resourcesRank || "typical";
  add(resources, `Workshop at Resources (${rankLabel(resources)})`);
  for (const place of places) add(place.rank, place.label);
  return rows;
}

export function readDesign(input = {}) {
  const name = String(input.name || "").trim();
  const lab = input.lab || "typical";
  const material = input.material || "typical";
  const facets = [{ name: "Body", rank: material, kind: "material" }];
  if (input.omni) {
    facets.push({ name: "Omni", rank: input.omniRank || "typical", kind: "omni" });
  } else {
    for (const piece of input.pieces || []) {
      const label = String(piece.name || "").trim();
      if (!label) continue;
      const ability = abilityKey(label);
      facets.push({
        name: ability ? ability.charAt(0).toUpperCase() + ability.slice(1) : label,
        rank: piece.rank || "typical",
        kind: ability ? "ability" : "power",
        ability,
        column: ATTACKS.includes(piece.column) ? piece.column : ""
      });
    }
  }
  if (!name) return { error: "Name the device." };
  const over = facets.find((facet) => !withinLab(lab, facet.rank));
  if (over) return { error: `${over.name} is above the workshop (${rankLabel(lab)}).` };
  const attack = [...facets].reverse().find((facet) => facet.column);
  const costRank = facets.reduce((best, facet) => (rankIndex(facet.rank) > rankIndex(best) ? facet.rank : best), facets[0].rank);
  return {
    name,
    lab,
    omni: !!input.omni,
    facets,
    stake: gadgetStake(facets.map((facet) => facet.rank), { omni: !!input.omni }),
    costRank,
    attackRank: attack?.rank || "",
    attackColumn: attack?.column || "",
    type: input.omni || attack ? "weapon" : "equipment"
  };
}

async function labsFor(actor) {
  const { resourceCostFor } = await import("./wizard-shop.mjs");
  const resources = actor?.system?.resources?.rank || "typical";
  const buildings = new Set((PLACE_CATALOG.buildings || []).map((row) => row.toLowerCase()));
  const places = [];
  for (const item of actor?.items ?? []) {
    const key = String(item.name || "").trim().toLowerCase();
    if (WORK_LAB[key]) {
      places.push({ rank: WORK_LAB[key], label: `${item.name} (${rankLabel(WORK_LAB[key])})` });
    } else if (buildings.has(key)) {
      const rank = resourceCostFor(item.name, "place", "buildings");
      places.push({ rank, label: `${item.name} (${rankLabel(rank)})` });
    }
  }
  return labOptions(resources, places);
}

function rankSelect(name, selected = "typical") {
  const options = GADGET_RANKS.map((id) => `<option value="${esc(id)}" ${id === selected ? "selected" : ""}>${esc(rankLabel(id))}</option>`).join("");
  return `<select name="${esc(name)}">${options}</select>`;
}

function columnSelect(name) {
  const options = [`<option value="">Utility</option>`]
    .concat(ATTACKS.map((id) => `<option value="${esc(id)}">${esc(BATTLE_EFFECTS[id]?.label || id)}</option>`))
    .join("");
  return `<select name="${esc(name)}">${options}</select>`;
}

function karmaOf(actor) {
  return Number(actor?.system?.karma?.value || 0);
}

async function setKarma(actor, value) {
  await actor.update({ "system.karma.value": Math.max(0, value) });
}

async function reasonInstall(actor, facet, { cs = 0, label = "Install" } = {}) {
  const { rollFeat } = await import("./dice/universal-table.mjs");
  const message = await rollFeat({
    actor,
    rankId: actor?.getAbilityRank?.("reason") || "typical",
    intensityId: facet.rank,
    cs,
    label: `${label}: ${facet.name}`
  });
  if (!message) return null;
  return !!message.flags?.faserip?.intensityPass;
}

export async function promptDesignGadget(actor) {
  if (!houseOn("houseGadgets") || !actor) return null;
  const labs = await labsFor(actor);
  const labOptionsHtml = labs.map((row) => `<option value="${esc(row.id)}">${esc(row.label)}</option>`).join("");
  const pieces = [1, 2, 3].map((n) => `<div class="form-group"><label>Piece ${n}</label><input type="text" name="piece${n}" placeholder="Flight, Strength, a sensor…" /> ${rankSelect("pieceRank" + n)} ${columnSelect("pieceColumn" + n)}</div>`).join("");
  const form = await promptForm({
    title: "Design a gadget",
    width: 560,
    okLabel: "Stake and build",
    content: `<p class="hint">Stake is 10 Karma per point of the highest rank, plus 5 per point of each other rank. An omni-gadget doubles the stake. The stake comes back if the parts cannot be bought. The workshop caps every rank. Reason is rolled once for the body and once for each piece.</p>
      <div class="form-group"><label>Name</label><input type="text" name="name" /></div>
      <div class="form-group"><label>Workshop</label><select name="lab">${labOptionsHtml}</select></div>
      <div class="form-group"><label>Body material</label>${rankSelect("material")}</div>
      <label class="check"><input type="checkbox" name="omni" /> Omni-gadget. Name the function when it is used. It then burns out.</label>
      <div class="form-group"><label>Omni rank</label>${rankSelect("omniRank")}</div>
      ${pieces}`
  });
  if (!form) return null;
  const design = readDesign({
    name: formValue(form, "name"),
    lab: formValue(form, "lab"),
    material: formValue(form, "material"),
    omni: !!form.querySelector?.('[name="omni"]')?.checked,
    omniRank: formValue(form, "omniRank"),
    pieces: [1, 2, 3].map((n) => ({
      name: formValue(form, "piece" + n),
      rank: formValue(form, "pieceRank" + n),
      column: formValue(form, "pieceColumn" + n)
    }))
  });
  if (design.error) {
    globalThis.ui?.notifications?.warn(design.error);
    return null;
  }
  const band = partsBand(actor.system?.resources?.rank || "typical", design.costRank);
  if (band === "refuse") {
    globalThis.ui?.notifications?.warn(`The parts are two or more ranks above Resources (${rankLabel(design.costRank)}).`);
    return null;
  }
  if (karmaOf(actor) < design.stake) {
    globalThis.ui?.notifications?.warn(`${actor.name} needs ${design.stake} Karma to stake this design.`);
    return null;
  }
  const go = await confirmDialog({
    title: design.name,
    content: `<p>Stake <strong>${design.stake}</strong> Karma. Resources roll for ${esc(rankLabel(design.costRank))} parts (${band === "green" ? "any success" : band}). Then Reason for ${design.facets.length} piece${design.facets.length === 1 ? "" : "s"}.</p>`
  });
  if (!go) return null;
  await setKarma(actor, karmaOf(actor) - design.stake);
  const { rollFeat } = await import("./dice/universal-table.mjs");
  const shop = await rollFeat({
    actor,
    rankId: actor.system?.resources?.rank || "typical",
    label: `Parts for ${design.name} (${rankLabel(design.costRank)}, ${band})`
  });
  if (!shop) {
    await setKarma(actor, karmaOf(actor) + design.stake);
    globalThis.ui?.notifications?.info("Design stopped. The stake is returned.");
    return null;
  }
  const color = shop.flags?.faserip?.color || "white";
  const gotParts = band === "green" ? color !== "white" : (band === "yellow" ? color === "yellow" || color === "red" : color === "red");
  if (!gotParts) {
    await setKarma(actor, karmaOf(actor) + design.stake);
    globalThis.ui?.notifications?.warn("The parts are not available. The stake is returned.");
    return null;
  }
  const installed = [];
  for (const facet of design.facets) {
    let ok = await reasonInstall(actor, facet, { label: design.name });
    if (ok == null) {
      await setKarma(actor, karmaOf(actor) + design.stake);
      globalThis.ui?.notifications?.info("Design stopped. The stake is returned.");
      return null;
    }
    if (!ok) {
      const again = karmaOf(actor) >= 10 && await confirmDialog({
        title: facet.name,
        content: `<p>${esc(facet.name)} did not install. Try again for 10 Karma?</p>`
      });
      if (again) {
        await setKarma(actor, karmaOf(actor) - 10);
        ok = await reasonInstall(actor, facet, { label: design.name + " retry" });
        if (ok == null) {
          await setKarma(actor, karmaOf(actor) + design.stake);
          return null;
        }
      }
    }
    if (!ok && facet.kind === "material") {
      await setKarma(actor, karmaOf(actor) + design.stake);
      globalThis.ui?.notifications?.warn("The body was not built. The stake is returned.");
      return null;
    }
    if (ok) installed.push(facet);
  }
  const attack = [...installed].reverse().find((facet) => facet.column);
  const top = installed.reduce((best, facet) => (rankIndex(facet.rank) > rankIndex(best.rank) ? facet : best), installed[0]);
  const omniFacet = installed.find((facet) => facet.kind === "omni");
  const usesMax = omniFacet ? omniUses(omniFacet.rank) : 0;
  const notes = installed.map((facet) => `${facet.name} ${rankLabel(facet.rank)}${facet.column ? ` (${BATTLE_EFFECTS[facet.column]?.label || facet.column})` : ""}`).join(". ");
  const system = {
    rank: attack?.rank || top.rank,
    number: rankValue(top.rank),
    material: installed.find((facet) => facet.kind === "material")?.rank || design.lab,
    category: "Gadget",
    definition: design.omni ? "Names its function when used, then burns out." : notes,
    notes
  };
  if (design.type === "weapon") {
    system.effectsColumn = attack?.column || "";
    system.damage = attack ? String(rankValue(attack.rank)) : "";
    system.weaponType = "Gadget";
    system.range = attack ? "1 area" : "";
  }
  const created = await actor.createEmbeddedDocuments("Item", [{
    name: design.name,
    type: design.omni || attack ? "weapon" : "equipment",
    system
  }]);
  const item = created?.[0];
  if (item) {
    await item.setFlag("faserip", "gadget", {
      omni: !!omniFacet,
      omniRank: omniFacet?.rank || "",
      lab: design.lab,
      attackRank: attack?.rank || "",
      facets: installed,
      burned: false,
      usesLeft: usesMax,
      usesMax,
      functionName: ""
    });
  }
  await globalThis.ChatMessage?.create?.({
    speaker: globalThis.ChatMessage?.getSpeaker?.({ actor }),
    content: `<div class="faserip-chat"><header><span class="feat-label">Gadget</span></header><p>${esc(actor.name)} builds ${esc(design.name)}. ${esc(notes)} Stake spent: ${design.stake} Karma.</p></div>`
  });
  globalThis.ui?.notifications?.info(`${design.name} is built.`);
  return item || null;
}

export async function promptUseGadget(actor, item) {
  if (!houseOn("houseGadgets") || !actor || !item) return null;
  const gadget = item.getFlag?.("faserip", "gadget");
  if (!gadget?.omni) return null;
  if (gadget.burned || Number(gadget.usesLeft) <= 0) {
    globalThis.ui?.notifications?.warn(`${item.name} burned out. It needs repair.`);
    return null;
  }
  const columns = ATTACKS.map((id) => `<option value="${esc(id)}">${esc(BATTLE_EFFECTS[id]?.label || id)}</option>`).join("");
  const form = await promptForm({
    title: item.name,
    okLabel: "Use",
    content: `<p class="hint">${gadget.usesLeft} use${Number(gadget.usesLeft) === 1 ? "" : "s"} left at ${esc(rankLabel(gadget.omniRank))}. The last use burns it out.</p>
      <div class="form-group"><label>Function</label><input type="text" name="fn" placeholder="What it does this time" /></div>
      <div class="form-group"><label>This use</label><select name="column"><option value="">Utility</option>${columns}</select></div>`
  });
  if (!form) return null;
  const fn = String(formValue(form, "fn") || "").trim();
  if (!fn) {
    globalThis.ui?.notifications?.warn("Name the function.");
    return null;
  }
  const column = formValue(form, "column");
  const left = Number(gadget.usesLeft) - 1;
  const burned = left <= 0;
  if (column) {
    const previous = {
      "system.rank": item.system?.rank,
      "system.number": item.system?.number,
      "system.damage": item.system?.damage,
      "system.effectsColumn": item.system?.effectsColumn
    };
    await item.update({
      "system.rank": gadget.omniRank,
      "system.number": rankValue(gadget.omniRank),
      "system.damage": String(rankValue(gadget.omniRank)),
      "system.effectsColumn": column
    });
    const { promptFeatRoll } = await import("./dice/universal-table.mjs");
    const message = await promptFeatRoll({
      actor,
      item,
      rankId: gadget.omniRank,
      label: `${item.name}: ${fn}`,
      ability: BATTLE_EFFECTS[column]?.ability || "agility",
      defaultColumn: column
    });
    if (!message) {
      await item.update(previous);
      return null;
    }
  } else {
    await item.update({ "system.effectsColumn": "", "system.damage": "" });
    await globalThis.ChatMessage?.create?.({
      speaker: globalThis.ChatMessage?.getSpeaker?.({ actor }),
      content: `<div class="faserip-chat"><p>${esc(item.name)} acts as ${esc(fn)} at ${esc(rankLabel(gadget.omniRank))}.</p></div>`
    });
  }
  const next = { ...gadget, usesLeft: Math.max(0, left), burned, functionName: fn };
  if (burned) {
    await item.update({ "system.effectsColumn": "", "system.damage": "" });
  }
  await item.setFlag("faserip", "gadget", next);
  if (burned) globalThis.ui?.notifications?.info(`${item.name} burns out and needs repair.`);
  return item;
}

export async function promptRepairGadget(actor, item) {
  if (!houseOn("houseGadgets") || !actor || !item) return null;
  const gadget = item.getFlag?.("faserip", "gadget");
  if (!gadget?.burned) {
    globalThis.ui?.notifications?.info(`${item.name} does not need repair.`);
    return null;
  }
  const labs = await labsFor(actor);
  const options = labs.map((row) => `<option value="${esc(row.id)}">${esc(row.label)}</option>`).join("");
  const facet = (gadget.facets || []).reduce((best, row) => (!best || rankIndex(row.rank) > rankIndex(best.rank) ? row : best), null)
    || { name: item.name, rank: gadget.omniRank || item.system?.rank || "typical" };
  const form = await promptForm({
    title: `Repair ${item.name}`,
    okLabel: "Repair",
    content: `<p class="hint">A workshop at or above the device rolls Reason as usual. The field, or a bench below the device, is −2 CS.</p>
      <label class="check"><input type="checkbox" name="field" /> In the field</label>
      <div class="form-group"><label>Workshop</label><select name="lab">${options}</select></div>`
  });
  if (!form) return null;
  const inField = !!form.querySelector?.('[name="field"]')?.checked;
  const lab = formValue(form, "lab") || gadget.lab || "typical";
  const cs = repairShift(inField, lab, facet.rank);
  const ok = await reasonInstall(actor, facet, { cs, label: `Repair ${item.name}` });
  if (ok == null) return null;
  if (!ok) {
    globalThis.ui?.notifications?.warn(`${item.name} is still burned out.`);
    return null;
  }
  const usesMax = gadget.omni ? (gadget.usesMax || omniUses(gadget.omniRank)) : 0;
  await item.setFlag("faserip", "gadget", { ...gadget, burned: false, usesLeft: usesMax, functionName: "" });
  globalThis.ui?.notifications?.info(`${item.name} is repaired.`);
  return item;
}

export async function promptBreakGadget(actor, item) {
  if (!houseOn("houseGadgets") || !item) return null;
  const gadget = item.getFlag?.("faserip", "gadget");
  if (!gadget || gadget.burned) return null;
  const ok = await confirmDialog({
    title: item.name,
    content: `<p>Mark ${esc(item.name)} broken? It needs a repair before it works again.</p>`
  });
  if (!ok) return null;
  await item.update({ "system.effectsColumn": "", "system.damage": "" });
  await item.setFlag("faserip", "gadget", { ...gadget, burned: true, usesLeft: 0, functionName: "" });
  globalThis.ui?.notifications?.info(`${item.name} is broken.`);
  return item;
}
