import {
  ABILITIES, ABILITY_MODIFIER_TABLE, BATTLE_EFFECTS, ORIGINS, ORIGIN_TABLE,
  POWER_CATEGORIES, POWER_CATALOG, SPECIAL_COUNT_TABLE, TALENT_CATEGORIES, TALENT_CATALOG,
  CONTACT_TYPES, lookupTable, originById, rankIndex, rankLabel, rankMin, rollOnColumn, shiftRank
} from "../config.mjs";
import { describePower, describeTalent } from "../data/descriptions.mjs";
import { ROM_DEFINITIONS } from "../data/rom-descriptions.mjs";
import { cleanPowerName, isTwoSlotPower } from "../data/slots.mjs";
import { describeItemAction } from "../item-actions.mjs";
import { rollD100 } from "../dice/percentile.mjs";
import { clampCounts, persistGenerationStats, applyGeneration } from "../chargen.mjs";
import { archetypeSetup, tuneArchetypeResult, ARCHETYPE_CHOICES, packagePowers, promptArchetypeExtras, pickMartialPowers, pickImplants, vampireWeakness } from "../life.mjs";
import { BUILDS, CALLINGS, QUIRKS, STATURE, band, heightAndWeight, statureText } from "../data/archetypes.mjs";
import { isUpbEnabled } from "../data/upb.mjs";
import { SYMBIOTE_BONDS } from "../data/symbiote.mjs";
import {
  isRomEnabled, lookupBand, schoolById, startingMastery,
  ROM_CHARACTER_TYPE, ROM_ENERGY, ROM_SPELL_COUNT, ROM_SPELL_RANK,
  ROM_WIELDER_TALENT_COUNT, ROM_WIELDER_TALENTS, ROM_ITEM_COUNT, ROM_ITEM_CATEGORY, ROM_ITEM_TYPES,
  ROM_SCHOOLS, ROM_SCHOOL_TABLE, ROM_RESOURCE_RANK, ROM_RESOURCE_CACHE, ROM_ENHANCEMENT, ROM_ENHANCEMENT_CONDITION, ROM_ITEM_CONDITION
} from "../data/rom.mjs";
import { isUltimateTalentsEnabled } from "../data/ultimate-talents.mjs";

const STEPS = [
  { id: "identity", label: "Hero" },
  { id: "origin", label: "Origin" },
  { id: "abilities", label: "Abilities" },
  { id: "powers", label: "Powers" },
  { id: "talents", label: "Talents" },
  { id: "contacts", label: "Contacts" },
  { id: "review", label: "Review" }
];

const BLURB = {
  resistances: "Stand up to one kind of harm. Compare this rank to the attack.",
  senses: "Notice, identify, or track with this rank instead of Intuition.",
  movement: "A way across the scene. Speed and stunts use this rank.",
  matter: "Shape or command an element that is already there.",
  energy: "Bend a force such as light, sound, gravity, or magnetism.",
  bodyControl: "Change your own body. The rank is how far the change holds.",
  distance: "A ranged attack. The battle column is on the card.",
  mental: "A mind power. A target usually resists with Psyche.",
  offensive: "The body itself is the weapon.",
  defensive: "Armor, recovery, or a field that keeps damage off Health.",
  symbiote: "A living bond. These are ordinary powers the coat already knows how to use."
};

const WEAKNESSES = [
  "None", "Allergy / Dependence", "Attracts Unexpected", "Fatiguing Power",
  "Involuntary Change", "Mute / Communication Limit", "Physical Handicap",
  "Psychological Limitation", "Susceptibility", "Trigger / Powerless", "Uncontrolled Power"
];

const ABILITY_LABEL = {
  fighting: "Fighting", agility: "Agility", strength: "Strength", endurance: "Endurance",
  reason: "Reason", intuition: "Intuition", psyche: "Psyche"
};

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

function d100Index(length, roll) {
  if (!length) return 0;
  return Math.min(length - 1, Math.floor((Number(roll) - 1) * length / 100));
}

function powerFacts(name, category) {
  const described = describePower(name, { category });
  const action = describeItemAction({ name, type: "power", system: { effectsColumn: described.effectsColumn || "" } });
  const column = action.column ? BATTLE_EFFECTS[action.column] : null;
  const slots = Math.max(described.slotsTaken || 1, isTwoSlotPower(name) ? 2 : 1);
  let grade = "FEAT";
  let play = `Roll a ${ABILITY_LABEL[action.ability] || "Reason"} FEAT at this rank.`;
  if (column) {
    grade = column.label;
    play = `${ABILITY_LABEL[column.ability] || column.ability}. White ${column.white}. Green ${column.green}. Yellow ${column.yellow}. Red ${column.red}.`;
  }
  if (described.bodyArmor) play = `Body armor. Soak physical damage up to this rank. ${play}`;
  if (described.forceField) play = `Force field. Soak damage up to this rank. ${play}`;
  return { name: cleanPowerName(name), definition: described.definition, slots, grade, play, bodyArmor: described.bodyArmor, forceField: described.forceField };
}

let creatorApp = null;

function CreatorApp() {
  const Base = foundry.applications?.api?.ApplicationV2;
  if (!Base) return null;
  return class FaseripCreator extends Base {
    static DEFAULT_OPTIONS = {
      id: "faserip-creator",
      classes: ["faserip", "faserip-creator"],
      tag: "div",
      window: { title: "Create a Hero", icon: "fa-solid fa-mask", resizable: true },
      position: { width: 1080, height: 760 }
    };

    constructor(options = {}, done) {
      super();
      this._done = done;
      const actor = options.actor || null;
      this.actor = actor;
      this.step = "identity";
      this.unlocked = 0;
      this.busy = false;
      this.notice = "";
      this.name = actor?.name || "New Hero";
      this.publicId = actor?.system?.identity?.public || "";
      this.secretName = actor?.system?.identity?.secret || "";
      this.actorType = actor?.type || "hero";
      this.secretId = !!actor?.system?.identity?.secretId;
      this.useUpb = isUpbEnabled();
      this.useUltimateTalents = isUltimateTalentsEnabled();
      this.useRom = isRomEnabled();
      this.useHitech = false;
      this.rom = null;
      this.romOrdinary = null;
      this.romMaster = "";
      this.romCampaign = false;
      this.archetype = "";
      this.lifeHeight = false;
      this.lifeCalling = false;
      this.lifeQuirk = false;
      this.buildRoll = null;
      this.statureRoll = null;
      this.weightRoll = null;
      this.build = null;
      this.stature = null;
      this.calling = null;
      this.quirkPair = null;
      this.socialPositive = null;
      this.socialNegative = null;
      this.abilityRolls = {};
      this.abilities = {};
      this.numbers = {};
      this.resources = null;
      this.resourceMod = null;
      this.resourceModRoll = null;
      this.originId = "altered";
      this.originRoll = null;
      this.upbForm = null;
      this.upbFormRoll = null;
      this.upbOrigin = null;
      this.upbOriginRoll = null;
      this.result = null;
      this.raise = "";
      this.tuned = false;
      this.powers = [];
      this.powerCategory = null;
      this.openPower = "";
      this.talents = [];
      this.talentCategory = null;
      this.openTalent = "";
      this.contacts = [];
      this.contactType = CONTACT_TYPES[0];
      this.contactName = "";
      this.weakness = "None";
      this.weaknessNotes = "";
    }

    get special() {
      return !!this.archetype;
    }

    get steps() {
      if (this.special && !this.#extraPath()) return STEPS.slice(0, 3);
      if (this.#extraPath() && !this.useRom) {
        const withPowers = this.archetype === "elder" || this.archetype === "spaceknight";
        return withPowers
          ? [STEPS[0], STEPS[1], STEPS[2], STEPS[3], STEPS[4], STEPS[5], STEPS[6]]
          : [STEPS[0], STEPS[1], STEPS[2], STEPS[4], STEPS[5], STEPS[6]];
      }
      if (!this.useRom) return STEPS;
      return [
        STEPS[0], STEPS[1], STEPS[2],
        { id: "magic", label: "Magic" },
        { id: "powers", label: "Workings" },
        STEPS[4], STEPS[5], STEPS[6]
      ];
    }

    #dualArchetype() {
      return ["vampire", "elder", "spaceknight", "martial", "cyborg"].includes(this.archetype);
    }

    #extraPath() {
      return this.#dualArchetype() && (this.useRom || this.useHitech);
    }

    async close(options) {
      const out = await super.close(options);
      this.#hideTip();
      this._tip?.remove();
      this._tip = null;
      this._done?.(this.actor || null);
      this._done = null;
      if (creatorApp === this) creatorApp = null;
      return out;
    }

    async _renderHTML() {
      this.#hideTip();
      const root = document.createElement("div");
      root.className = "creator";
      root.innerHTML = this.#html();
      return root;
    }

    async _replaceHTML(result, content) {
      content.replaceChildren(result);
      result.addEventListener("click", (event) => this.#onClick(event));
      result.addEventListener("input", (event) => this.#onInput(event));
      result.addEventListener("change", (event) => this.#onInput(event));
      result.addEventListener("pointerover", (event) => this.#onHover(event));
      result.addEventListener("pointerout", (event) => this.#onHoverOut(event));
    }

    #tipEl() {
      if (!this._tip) {
        this._tip = document.createElement("div");
        this._tip.className = "creator-tip";
        this._tip.hidden = true;
        document.body.appendChild(this._tip);
      }
      return this._tip;
    }

    #hideTip() {
      if (this._tip) this._tip.hidden = true;
    }

    #onHover(event) {
      const card = event.target.closest?.("[data-blurb]");
      if (!card || !card.dataset.blurb) return this.#hideTip();
      const tip = this.#tipEl();
      tip.innerHTML = `<strong>${esc(card.dataset.title || "")}</strong><p>${esc(card.dataset.blurb)}</p>`;
      tip.hidden = false;
      const box = card.getBoundingClientRect();
      const width = Math.min(380, window.innerWidth - 24);
      let left = box.right + 14;
      if (left + width > window.innerWidth - 12) left = Math.max(12, box.left - width - 14);
      let top = Math.max(12, Math.min(box.top, window.innerHeight - 220));
      tip.style.width = `${width}px`;
      tip.style.left = `${left}px`;
      tip.style.top = `${top}px`;
    }

    #onHoverOut(event) {
      const card = event.target.closest?.("[data-blurb]");
      if (!card) return;
      const next = event.relatedTarget?.closest?.("[data-blurb]");
      if (next === card) return;
      this.#hideTip();
    }

    #stepIndex(id = this.step) {
      return this.steps.findIndex((row) => row.id === id);
    }

    #html() {
      const steps = this.steps.map((row, index) => {
        const state = row.id === this.step ? "is-on" : index <= this.unlocked ? "is-done" : "is-locked";
        return `<button type="button" class="creator-step ${state}" data-action="goto" data-step="${row.id}" ${index > this.unlocked ? "disabled" : ""}><span>${index + 1}</span>${esc(row.label)}</button>`;
      }).join("");
      return `
        <header class="creator-rail">${steps}</header>
        <div class="creator-stage">${this.#stage()}</div>
        ${this.notice ? `<p class="creator-notice">${esc(this.notice)}</p>` : ""}
        <footer class="creator-bar">${this.#footer()}</footer>`;
    }

    #stage() {
      if (this.step === "identity") return this.#identity();
      if (this.step === "origin") return this.#origin();
      if (this.step === "abilities") return this.#abilities();
      if (this.step === "magic") return this.#magic();
      if (this.step === "powers") return this.#powers();
      if (this.step === "talents") return this.#talents();
      if (this.step === "contacts") return this.#contacts();
      return this.#review();
    }

    #lifeDie(action, label, value, blurb) {
      return `<article class="life-die" data-title="${esc(label)}" data-blurb="${esc(blurb || "")}">
        <span>${esc(label)}</span>
        <button type="button" class="stat-die" data-action="${action}" title="Roll ${esc(label)}"><i class="fa-solid fa-dice"></i></button>
        <strong>${esc(value || "—")}</strong>
      </article>`;
    }

    #identity() {
      const books = ARCHETYPE_CHOICES.map((row) => `<option value="${esc(row.id)}" ${row.id === this.archetype ? "selected" : ""}>${esc(row.label)}</option>`).join("");
      const quirkText = this.quirkPair
        ? `${this.quirkPair.kind}: ${this.quirkPair.positive.name} / ${this.quirkPair.negative.name}`
        : "";
      const quirkBlurb = this.quirkPair
        ? `${this.quirkPair.positive.name}: ${this.quirkPair.positive.note} ${this.quirkPair.negative.name}: ${this.quirkPair.negative.note}`
        : "";
      return `
        <section class="creator-block">
          <p class="creator-kicker">Who is this?</p>
          <h2>${esc(this.name || "Name the hero")}</h2>
          <div class="creator-fields">
            <label>Hero name<input name="name" type="text" value="${esc(this.name)}" /></label>
            <label>Public identity<input name="publicId" type="text" value="${esc(this.publicId)}" /></label>
            <label>Secret identity<input name="secretName" type="text" value="${esc(this.secretName)}" /></label>
            <label>Sheet<select name="actorType"><option value="hero" ${this.actorType === "hero" ? "selected" : ""}>Hero</option><option value="npc" ${this.actorType === "npc" ? "selected" : ""}>NPC</option></select></label>
            <label class="check"><input name="secretId" type="checkbox" ${this.secretId ? "checked" : ""} /> Secret identity</label>
            <label class="check"><input name="useUpb" type="checkbox" ${this.useUpb ? "checked" : ""} /> Ultimate Powers Book tables</label>
            <label class="check"><input name="useUltimateTalents" type="checkbox" ${this.useUltimateTalents ? "checked" : ""} /> Ultimate Talents list</label>
            <label class="check"><input name="useRom" type="checkbox" ${this.useRom ? "checked" : ""} /> Realms of Magic path</label>
            <label class="check"><input name="useHitech" type="checkbox" ${this.useHitech ? "checked" : ""} /> High-tech gear</label>
            <label>Archetype<select name="archetype">${books}</select></label>
          </div>
          <div class="life-row">
            ${this.#lifeDie("roll-calling", "Calling", this.calling?.label, this.calling?.note || "")}
            ${this.#lifeDie("roll-quirk", "Quirk", quirkText, quirkBlurb)}
            ${this.#lifeDie("roll-social-pos", "Positive social", this.socialPositive?.name, this.socialPositive?.note || "")}
            ${this.#lifeDie("roll-social-neg", "Negative social", this.socialNegative?.name, this.socialNegative?.note || "")}
            ${this.#lifeDie("roll-build", "Build", this.build?.label, "Slender 01–25, average 26–75, muscular 76–00.")}
            ${this.#lifeDie("roll-stature", "Stature", this.stature?.height, this.stature ? statureText(this.stature) : "Height. Weight is scaled by Strength.")}
          </div>
          ${this.#bodyLine()}
          <p class="creator-fine">Vampire, elder, spaceknight, martial artist, and cyborg keep their own powers. Check Realms of Magic, High-tech gear, or both to add that second source. Leave both off and this creator ends after Abilities.</p>
        </section>`;
    }

    #origin() {
      if (this.useUpb && !this.archetype) return this.#upbOrigin();
      const setup = archetypeSetup(this.archetype);
      const locked = setup?.originId || "";
      const cards = ORIGINS.map((origin) => {
        const on = origin.id === this.originId ? "is-on" : "";
        const disabled = locked && origin.id !== locked ? "disabled" : "";
        return `<button type="button" class="name-card ${on}" data-action="pick-origin" data-id="${esc(origin.id)}" data-title="${esc(origin.label)}" data-blurb="${esc(`Column ${origin.column}. ${origin.notes}`)}" ${disabled}><strong>${esc(origin.label)}</strong></button>`;
      }).join("");
      const rolled = this.originRoll ? `<p class="roll-pill">Origin roll ${this.originRoll}</p>` : "";
      return `<section class="creator-block"><div class="creator-block-head"><div><p class="creator-kicker">Origin</p><h2>Where the power comes from</h2></div><button type="button" class="roll-btn" data-action="roll-origin" ${locked ? "disabled" : ""}>Roll origin</button></div>${rolled}<div class="choice-grid">${cards}</div></section>`;
    }

    #upbOrigin() {
      return `<section class="creator-block"><p class="creator-kicker">Ultimate Powers Book</p><h2>Form, then origin of power</h2><div id="upb-origin-mount"></div></section>`;
    }

    #abilities() {
      const cards = ABILITIES.map((key) => {
        const rank = this.abilities[key];
        const face = rank
          ? `<strong>${esc(rankLabel(rank))}</strong><em>${this.numbers[key]}</em><small>${this.abilityRolls[key] || "—"}</small>`
          : `<strong class="await">Roll</strong>`;
        return `<article class="ability-card ${rank ? "is-rolled" : ""}">
          <span>${esc(ABILITY_LABEL[key].slice(0, 1))}</span>
          <small>${esc(ABILITY_LABEL[key])}</small>
          <button type="button" class="stat-die" data-action="roll-stat" data-stat="${key}" title="Roll ${esc(ABILITY_LABEL[key])}"><i class="fa-solid fa-dice"></i></button>
          ${face}
        </article>`;
      }).join("");
      const health = ["fighting", "agility", "strength", "endurance"].reduce((sum, key) => sum + Number(this.numbers[key] || 0), 0);
      const karma = ["reason", "intuition", "psyche"].reduce((sum, key) => sum + Number(this.numbers[key] || 0), 0);
      const counts = this.result?.counts;
      const canRaise = this.result && (this.result.origin?.id === "altered" || this.result.formRaiseOne);
      const raise = canRaise ? `<label class="raise">Raise one ability +1 CS<select name="raise">${ABILITIES.map((key) => `<option value="${key}" ${this.raise === key ? "selected" : ""}>${esc(ABILITY_LABEL[key])}</option>`).join("")}</select></label>` : "";
      const resourceFace = this.resources ? rankLabel(this.resources) : "Roll";
      return `<section class="creator-block">
        <p class="creator-kicker">FASERIP</p>
        <h2>Click each die</h2>
        <div class="ability-row">${cards}</div>
        <div class="stat-pills">
          <span>Health ${health || "—"}</span>
          <span>Karma ${karma || "—"}</span>
        </div>
        <div class="count-row">
          <article class="ability-card resource-card ${this.resources ? "is-rolled" : ""}">
            <small>Resources</small>
            <button type="button" class="stat-die" data-action="roll-resources" title="Roll Resources"><i class="fa-solid fa-dice"></i></button>
            <strong>${esc(resourceFace)}</strong>
          </article>
          <div class="count-roll">
            <button type="button" class="roll-btn big" data-action="roll-counts">Roll powers, talents, and contacts</button>
            <p>${counts ? `Powers ${counts.powers[0]}/${counts.powers[1]} · Talents ${counts.talents[0]}/${counts.talents[1]} · Contacts ${counts.contacts[0]}/${counts.contacts[1]}` : "Rolled after the seven abilities."}</p>
            ${this.useRom ? `<p class="creator-fine">Realms of Magic replaces that power number with workings on the Magic step. A power the origin itself grants is still chosen afterward. Talents and contacts still use this roll, unless the hero is a wielder.</p>` : ""}
          </div>
        </div>
        ${raise}
      </section>`;
    }

    #powers() {
      const originSlots = this.#originPowerSlots();
      const originSpent = this.#spent("origin");
      const spellSlots = this.useRom ? Number(this.result?.counts?.powers?.[0] || 0) : 0;
      const spellSpent = this.#spent("magic");
      const needed = this.useRom ? spellSlots : Number(this.result?.counts?.powers?.[0] || 0);
      const spent = this.useRom ? spellSpent : this.#spent("all");
      const tray = this.#tray(this.powers, "power");
      const romNote = this.useRom && this.rom?.type?.id === "items"
        ? "Each item holds one working. That item count is the power count."
        : (this.useRom ? "Workings come from the magic table." : "");
      const originTitle = this.#mutantSource() ? "Mutant powers" : "Origin powers";
      const originNote = originSlots
        ? `${this.result?.origin?.label || originTitle} keeps ${originSlots} power${originSlots === 1 ? "" : "s"} from the ${this.useUpb ? "Ultimate Powers classes" : "normal lists"}. Pick them here. They do not spend a working.`
        : "";
      if (!this.powerCategory) {
        const table = this.#categoryTable();
        const card = (row) => {
          const band = row.lo == null
            ? BLURB[row.id] || "Powers in this class."
            : `${row.lo}–${row.hi === 100 ? "00" : row.hi}. ${BLURB[row.id] || "Powers in this class."}`;
          return `<button type="button" class="name-card" data-action="pick-category" data-id="${esc(row.id)}" data-title="${esc(row.label)}" data-blurb="${esc(band)}"><strong>${esc(row.label)}</strong></button>`;
        };
        const energyLine = this.useRom && this.rom?.energy?.label ? `<p class="creator-fine">Energy: ${esc(this.rom.energy.label)}.</p>` : "";
        const kicker = this.useRom
          ? `Workings ${spellSpent}/${spellSlots}${originSlots ? ` · ${originTitle} ${originSpent}/${originSlots}` : ""}`
          : `Powers ${spent}/${needed}`;
        const groups = this.useRom
          ? [
              originSlots ? { title: originTitle, rows: table.filter((row) => !this.#magicCategory(row)), roll: `<button type="button" class="roll-btn" data-action="roll-origin-category">Roll ${esc(originTitle.toLowerCase())}</button>` } : null,
              { title: "Workings", rows: table.filter((row) => this.#magicCategory(row)), roll: "" }
            ].filter(Boolean)
          : [{ title: "", rows: table, roll: `<button type="button" class="roll-btn" data-action="roll-category">Roll category</button>` }];
        const grids = groups.map((group) => {
          const head = group.title ? `<div class="creator-block-head"><h3>${esc(group.title)}</h3>${group.roll}</div>` : "";
          return `${head}<div class="choice-grid">${group.rows.map(card).join("")}</div>`;
        }).join("");
        return `<section class="creator-block"><div class="creator-block-head"><div><p class="creator-kicker">${esc(kicker)}</p><h2>${this.useRom ? (originSlots ? `${originTitle}, then workings` : "Choose a working") : "Roll a category, or choose one"}</h2>${energyLine}${romNote ? `<p class="creator-fine">${esc(romNote)}</p>` : ""}${originNote ? `<p class="creator-fine">${esc(originNote)}</p>` : ""}</div>${this.useRom ? "" : groups[0].roll}</div>${tray}${this.useRom ? grids : `<div class="choice-grid">${table.map(card).join("")}</div>`}</section>`;
      }
      const cat = this.powerCategory;
      const magicView = this.#magicCategory(cat);
      const poolNeeded = magicView ? spellSlots : (this.useRom ? originSlots : needed);
      const poolSpent = magicView ? spellSpent : (this.useRom ? originSpent : spent);
      const list = this.#powerList();
      const cards = list.map((row) => {
        const on = row.name === this.openPower ? "is-on" : "";
        const locked = row.slots > (poolNeeded - poolSpent) ? "is-locked" : "";
        const blurb = `${row.grade}. ${row.definition} ${row.play}${row.slots > 1 ? " Spends two slots." : ""}`;
        return `<button type="button" class="name-card ${on} ${locked}" data-action="open-power" data-name="${esc(row.name)}" data-title="${esc(row.name)}" data-blurb="${esc(blurb)}"><strong>${esc(row.name)}</strong></button>`;
      }).join("");
      const open = list.find((row) => row.name === this.openPower);
      const rankLine = magicView
        ? "Rank is Good through Amazing."
        : (open?.slots > 1 ? "This power spends two of your slots." : "This power spends one slot.") + ` Rank rolls on column ${this.result?.origin?.column || 1} when you take it.`;
      const detail = open ? `<aside class="power-detail">
        <p class="creator-kicker">${esc(open.grade)}</p>
        <h3>${esc(open.name)}</h3>
        <p>${esc(open.definition)}</p>
        <p class="play">${esc(open.play)}</p>
        <p class="creator-fine">${esc(rankLine)}</p>
        <button type="button" class="roll-btn" data-action="take-power" data-name="${esc(open.name)}">Take this power</button>
      </aside>` : `<aside class="power-detail empty"><p>Choose a power to read what it does.</p></aside>`;
      const band = cat.roll ? `Rolled ${cat.roll}` : "Chosen";
      const poolLabel = magicView ? "workings" : (this.useRom ? "origin powers" : "slots");
      return `<section class="creator-split">
        <div>
          <div class="creator-block-head">
            <div><p class="creator-kicker">${esc(band)} · ${poolSpent}/${poolNeeded} ${esc(poolLabel)}</p><h2>${esc(cat.label)}</h2><p class="creator-lead">${esc(BLURB[cat.id] || "Read a power, then take it or roll one.")}</p></div>
            <div class="btn-row"><button type="button" class="roll-btn" data-action="roll-power">Roll one</button><button type="button" class="text-btn" data-action="clear-category">All categories</button></div>
          </div>
          ${tray}
          <div class="power-grid">${cards}</div>
        </div>
        ${detail}
      </section>`;
    }

    #talents() {
      const needed = Number(this.result?.counts?.talents?.[0] || 0);
      const cap = Math.min(this.useUpb ? 8 : 6, Number(this.result?.counts?.talents?.[1] || needed));
      const tray = this.#tray(this.talents, "talent");
      if (!this.talentCategory) {
        const table = this.#talentCategories();
        const cards = table.map((row) => {
          const bandText = row.lo != null ? `${row.lo}–${row.hi === 100 ? "00" : row.hi}` : "List";
          return `<button type="button" class="name-card" data-action="pick-talent-cat" data-id="${esc(row.id)}" data-title="${esc(row.label)}" data-blurb="${esc(bandText)}"><strong>${esc(row.label)}</strong></button>`;
        }).join("");
        return `<section class="creator-block"><div class="creator-block-head"><div><p class="creator-kicker">Talents ${this.talents.length}/${needed}</p><h2>Roll a talent category</h2></div><button type="button" class="roll-btn" data-action="roll-talent-cat">Roll category</button></div>${tray}<div class="choice-grid">${cards}</div></section>`;
      }
      const list = this.#talentList();
      const cards = list.map((row) => `<button type="button" class="name-card ${row.name === this.openTalent ? "is-on" : ""}" data-action="open-talent" data-name="${esc(row.name)}" data-title="${esc(row.name)}" data-blurb="${esc(row.definition || "")}"><strong>${esc(row.name)}</strong></button>`).join("");
      const open = list.find((row) => row.name === this.openTalent);
      const detail = open ? `<aside class="power-detail"><h3>${esc(open.name)}</h3><p>${esc(open.definition)}</p><button type="button" class="roll-btn" data-action="take-talent" data-name="${esc(open.name)}">Take this talent</button></aside>` : `<aside class="power-detail empty"><p>Choose a talent to read it.</p></aside>`;
      return `<section class="creator-split"><div><div class="creator-block-head"><div><p class="creator-kicker">${this.talents.length}/${needed} starting · max ${cap}</p><h2>${esc(this.talentCategory.label)}</h2></div><div class="btn-row"><button type="button" class="roll-btn" data-action="roll-talent">Roll one</button><button type="button" class="text-btn" data-action="clear-talent-cat">All categories</button></div></div>${tray}<div class="power-grid">${cards}</div></div>${detail}</section>`;
    }

    #contacts() {
      const target = this.originId === "alien" ? Math.min(1, Number(this.result?.counts?.contacts?.[0] || 0)) : Number(this.result?.counts?.contacts?.[0] || 0);
      const types = CONTACT_TYPES.map((type) => `<button type="button" class="mini-chip ${type === this.contactType ? "is-on" : ""}" data-action="pick-contact-type" data-type="${esc(type)}">${esc(type)}</button>`).join("");
      const list = this.contacts.map((row, index) => `<li><strong>${esc(row.name)}</strong><em>${esc(row.type)}</em><button type="button" data-action="drop-contact" data-index="${index}">Remove</button></li>`).join("");
      return `<section class="creator-block"><p class="creator-kicker">Contacts ${this.contacts.length}/${target}</p><h2>People the hero can call</h2><div class="chip-row">${types}</div><label class="contact-name">Name<input name="contactName" type="text" value="${esc(this.contactName)}" placeholder="A person, office, or people" /></label><button type="button" class="roll-btn" data-action="add-contact">Add contact</button><ul class="picked-list">${list || "<li class='empty'>None yet.</li>"}</ul></section>`;
    }

    #review() {
      const powers = this.powers.map((row) => `<li><strong>${esc(row.name)}</strong> ${esc(rankLabel(row.rank))} · ${esc(row.grade || row.category)}</li>`).join("");
      const talents = this.talents.map((row) => `<li>${esc(row.name)}</li>`).join("");
      const contacts = this.contacts.map((row) => `<li>${esc(row.name)} <em>${esc(row.type)}</em></li>`).join("");
      const weak = WEAKNESSES.map((name) => `<option value="${esc(name)}" ${name === this.weakness ? "selected" : ""}>${esc(name)}</option>`).join("");
      return `<section class="creator-block"><p class="creator-kicker">Ready</p><h2>${esc(this.name)}</h2><p class="creator-lead">${esc(this.result?.origin?.label || "")}${this.publicId ? ` · ${esc(this.publicId)}` : ""}</p><div class="review-cols"><div><h3>Powers</h3><ul>${powers || "<li>None</li>"}</ul></div><div><h3>Talents</h3><ul>${talents || "<li>None</li>"}</ul></div><div><h3>Contacts</h3><ul>${contacts || "<li>None</li>"}</ul></div></div><label>Weakness<select name="weakness">${weak}</select></label><label>Notes<input name="weaknessNotes" type="text" value="${esc(this.weaknessNotes)}" /></label></section>`;
    }

    #tray(list, kind) {
      if (!list.length) return "";
      const chips = list.map((row, index) => `<button type="button" class="tray-chip" data-action="drop-${kind}" data-index="${index}">${esc(row.name)}${row.rank ? ` · ${esc(rankLabel(row.rank))}` : ""} <i class="fa-solid fa-xmark"></i></button>`).join("");
      return `<div class="tray">${chips}</div>`;
    }

    #footer() {
      const index = this.#stepIndex();
      const back = index > 0 ? `<button type="button" class="text-btn" data-action="back">Back</button>` : `<span></span>`;
      let next = "Next";
      if (this.step === "abilities" && this.special && !this.#extraPath()) next = "Continue this path";
      if (this.step === "review") next = "Finish hero";
      if (this.step === "powers" || this.step === "talents" || this.step === "contacts") next = "Next";
      return `${back}<button type="button" class="roll-btn" data-action="next" ${this.busy ? "disabled" : ""}>${next}</button>`;
    }

    #onInput(event) {
      const el = event.target;
      if (!el?.name) return;
      if (el.type === "checkbox") this[el.name] = !!el.checked;
      else this[el.name] = el.value;
      if (el.name === "useUpb" || el.name === "useRom" || el.name === "useHitech" || el.name === "archetype") this.render();
    }

    async #onClick(event) {
      const button = event.target.closest("[data-action]");
      if (!button || this.busy) return;
      const action = button.dataset.action;
      if (action === "goto") return this.#go(button.dataset.step);
      if (action === "back") return this.#go(this.steps[Math.max(0, this.#stepIndex() - 1)].id);
      if (action === "next") return this.#next();
      if (action === "roll-origin") return this.#guard(() => this.#rollOrigin());
      if (action === "roll-rom-type") return this.#guard(() => this.#rollRomType());
      if (action === "pick-rom-type") return this.#pickRomType(button.dataset.id);
      if (action === "roll-rom-school") return this.#guard(() => this.#rollRomSchool());
      if (action === "pick-rom-school") return this.#pickRomSchool(button.dataset.id);
      if (action === "roll-rom-energy") return this.#guard(() => this.#rollRomEnergy());
      if (action === "pick-rom-energy") return this.#pickRomEnergy(button.dataset.id);
      if (action === "roll-rom-count") return this.#guard(() => this.#rollRomCount());
      if (action === "roll-rom-enhance") return this.#guard(() => this.#rollRomEnhance());
      if (action === "roll-rom-resources") return this.#guard(() => this.#rollRomResources());
      if (action === "rom-raise") return this.#romRaise(button.dataset.ability);
      if (action === "pick-origin") {
        this.originId = button.dataset.id;
        this.notice = "";
        return this.render();
      }
      if (action === "roll-stat") return this.#guard(() => this.#rollStat(button.dataset.stat));
      if (action === "roll-resources") return this.#guard(() => this.#rollResources());
      if (action === "roll-counts") return this.#guard(() => this.#rollCounts());
      if (action === "roll-calling") return this.#guard(() => this.#rollCalling());
      if (action === "roll-quirk") return this.#guard(() => this.#rollQuirk());
      if (action === "roll-social-pos") return this.#guard(() => this.#rollSocial("positive"));
      if (action === "roll-social-neg") return this.#guard(() => this.#rollSocial("negative"));
      if (action === "roll-build") return this.#guard(() => this.#rollBuild());
      if (action === "roll-stature") return this.#guard(() => this.#rollStature());
      if (action === "roll-category") return this.#guard(() => this.#rollCategory());
      if (action === "roll-origin-category") return this.#guard(() => this.#rollOriginCategory());
      if (action === "pick-category") return this.#setCategory(button.dataset.id, null);
      if (action === "clear-category") {
        this.powerCategory = null;
        this.openPower = "";
        return this.render();
      }
      if (action === "open-power") {
        this.openPower = this.openPower === button.dataset.name ? "" : button.dataset.name;
        return this.render();
      }
      if (action === "take-power") return this.#guard(() => this.#takePower(button.dataset.name));
      if (action === "roll-power") return this.#guard(() => this.#rollPower());
      if (action === "drop-power") {
        this.powers.splice(Number(button.dataset.index), 1);
        return this.render();
      }
      if (action === "roll-talent-cat") return this.#guard(() => this.#rollTalentCategory());
      if (action === "pick-talent-cat") return this.#setTalentCategory(button.dataset.id, null);
      if (action === "clear-talent-cat") {
        this.talentCategory = null;
        this.openTalent = "";
        return this.render();
      }
      if (action === "open-talent") {
        this.openTalent = this.openTalent === button.dataset.name ? "" : button.dataset.name;
        return this.render();
      }
      if (action === "take-talent") return this.#takeTalent(button.dataset.name);
      if (action === "roll-talent") return this.#guard(() => this.#rollTalent());
      if (action === "drop-talent") {
        this.talents.splice(Number(button.dataset.index), 1);
        return this.render();
      }
      if (action === "pick-contact-type") {
        this.contactType = button.dataset.type;
        return this.render();
      }
      if (action === "add-contact") return this.#addContact();
      if (action === "drop-contact") {
        this.contacts.splice(Number(button.dataset.index), 1);
        return this.render();
      }
      if (action === "pick-upb-form") return this.#pickUpbForm(button.dataset.id);
      if (action === "roll-upb-form") return this.#guard(() => this.#rollUpbForm());
      if (action === "pick-upb-origin") return this.#pickUpbOrigin(button.dataset.id);
      if (action === "roll-upb-origin") return this.#guard(() => this.#rollUpbOrigin());
      if (action === "angel-side") {
        this.angelSide = button.dataset.side;
        return this.render();
      }
    }

    async #guard(work) {
      this.busy = true;
      this.notice = "";
      try {
        await work();
      } catch (err) {
        console.error("FASERIP | creator", err);
        this.notice = err.message || "That roll failed.";
      } finally {
        this.busy = false;
        if (!this._leaving) this.render();
      }
    }

    async #next() {
      if (this.step === "identity") {
        if (!String(this.name || "").trim()) {
          this.notice = "Give the hero a name.";
          return this.render();
        }
        await this.#ensureActor();
        return this.#go("origin", true);
      }
      if (this.step === "origin") {
        if (this.useUpb && !this.archetype && (!this.upbForm || !this.upbOrigin)) {
          this.notice = "Choose a form and an origin of power.";
          return this.render();
        }
        return this.#go("abilities", true);
      }
      if (this.step === "abilities") {
        const missing = ABILITIES.filter((key) => !this.abilities[key]);
        if (missing.length) {
          this.notice = `Still to roll: ${missing.map((key) => ABILITY_LABEL[key]).join(", ")}.`;
          return this.render();
        }
        if (!this.resources) {
          this.notice = "Roll Resources.";
          return this.render();
        }
        if (!this.result) {
          this.notice = "Roll how many powers, talents, and contacts.";
          return this.render();
        }
        if (this.special && !this.#extraPath()) return this.#guard(() => this.#handOff());
        if (this.useRom) return this.#go("magic", true);
        return this.#go(this.steps[this.#stepIndex() + 1].id, true);
      }
      if (this.step === "magic") {
        const ready = this.#romReady();
        if (ready) {
          this.notice = ready;
          return this.render();
        }
        if (this.rom?.type?.id === "wielder") {
          while (this.abilities.psyche && rankIndex(this.abilities.psyche) < rankIndex("good")) this.#applyRomRaise("psyche", 1);
        }
        return this.#go("powers", true);
      }
      if (this.step === "powers") {
        const openOrigin = this.#originPowerSlots() - this.#spent("origin");
        if (openOrigin > 0) {
          const label = this.#mutantSource() ? "mutant power" : "origin power";
          this.notice = `Pick the ${label}${openOrigin === 1 ? "" : "s"} (${openOrigin} left). They sit beside the workings.`;
          return this.render();
        }
        return this.#go("talents", true);
      }
      if (this.step === "talents") return this.#go("contacts", true);
      if (this.step === "contacts") return this.#go("review", true);
      if (this.step === "review") return this.#guard(() => this.#finish());
    }

    #go(step, forward = false) {
      const index = this.#stepIndex(step);
      if (index < 0 || index > this.unlocked && !forward) return;
      if (forward) this.unlocked = Math.max(this.unlocked, index);
      this.step = step;
      this.notice = "";
      return this.render();
    }

    async #ensureActor() {
      if (this.actor) {
        await this.actor.update({
          name: this.name,
          "system.identity.public": this.publicId,
          "system.identity.secret": this.secretName,
          "system.identity.secretId": !!this.secretId
        });
        return this.actor;
      }
      this.actor = await CONFIG.Actor.documentClass.create({
        name: this.name,
        type: this.actorType || "hero",
        system: { identity: { public: this.publicId, secret: this.secretName, origin: "", secretId: !!this.secretId } },
        flags: { faserip: { generating: true } }
      }, { renderSheet: false, render: false });
      return this.actor;
    }

    async #rollOrigin() {
      const roll = await rollD100({ flavor: `${this.actor?.name || this.name} — Origin`, actor: this.actor });
      const row = lookupTable(ORIGIN_TABLE, roll);
      this.originRoll = roll;
      this.originId = row.id;
      this.notice = `${originById(row.id).label} (${roll}). You can still pick a different origin.`;
    }

    #generationContext() {
      const setup = archetypeSetup(this.archetype);
      if (setup) {
        this.originId = setup.originId;
        this.useUpb = false;
      }
      const origin = originById(this.originId || "altered");
      const column = Number(this.upbForm?.column || origin.column || 1);
      return { setup, origin, column, skipMods: !!this.useUpb || !!this.archetype };
    }

    #boostStat(key, rank) {
      if (!this.result) return rank;
      const form = this.useUpb ? this.#upbFormRecord() : null;
      let cs = Number(form?.abilityCs?.[key] || 0);
      if (form?.allPrimaryCs) cs += form.allPrimaryCs;
      if (cs <= -99) return "shift0";
      if (cs) rank = shiftRank(rank, cs);
      if (this.archetype === "martial" && key === "fighting") {
        rank = shiftRank(rank, 2);
        const order = ["feeble", "poor", "typical", "good", "excellent", "remarkable", "incredible", "amazing"];
        if (order.indexOf(rank) > order.indexOf("amazing")) rank = "amazing";
        if (order.indexOf(rank) >= 0 && order.indexOf(rank) < order.indexOf("remarkable")) rank = "remarkable";
      }
      if (this.archetype === "elder" && ["endurance", "intuition", "psyche"].includes(key)) rank = shiftRank(rank, 2);
      return rank;
    }

    async #rollStat(key) {
      if (!ABILITIES.includes(key)) return;
      await this.#ensureActor();
      const { setup, origin, column, skipMods } = this.#generationContext();
      let roll = 0;
      let rank;
      if (setup?.fixedAbilities) {
        rank = setup.fixedAbilities[key] || "typical";
      } else {
        roll = await rollD100({ flavor: `${this.actor.name} — ${ABILITY_LABEL[key]}`, actor: this.actor });
        rank = typeof setup?.rankFor === "function" ? setup.rankFor(key, roll) : rollOnColumn(column, roll);
        if (!skipMods && origin.id === "mutant" && key === "endurance") rank = shiftRank(rank, 1);
        if (!skipMods && origin.id === "hitech" && key === "reason") rank = shiftRank(rank, 2);
        rank = this.#boostStat(key, rank);
      }
      this.abilityRolls[key] = roll;
      this.abilities[key] = rank;
      this.numbers[key] = rankMin(rank);
      if (this.result) {
        this.result.abilities[key] = rank;
        this.result.numbers[key] = this.numbers[key];
        this.result.abilityRolls[key] = roll;
        await persistGenerationStats(this.actor, this.result, { quiet: true, originLabel: this.result.origin.label });
      }
      this.notice = `${ABILITY_LABEL[key]}: ${rankLabel(rank)}${roll ? ` (${roll})` : ""}.`;
    }

    async #rollResources() {
      await this.#ensureActor();
      const { origin } = this.#generationContext();
      const roll = await rollD100({ flavor: `${this.actor.name} — Resources`, actor: this.actor });
      const resourceMod = lookupTable(ABILITY_MODIFIER_TABLE, roll);
      let resources = (!this.useUpb && origin.id === "hitech") ? "good" : (!this.useUpb && origin.id === "alien") ? "poor" : "typical";
      resources = shiftRank(resources, resourceMod.cs);
      if (!this.useUpb && origin.id === "mutant") resources = shiftRank(resources, -1);
      if (this.result) {
        const form = this.useUpb ? this.#upbFormRecord() : null;
        if (form?.resourcesFixed) resources = form.resourcesFixed;
        else if (form?.resourceCs) resources = shiftRank(resources, form.resourceCs);
        this.result.resources = resources;
        this.result.resourceMod = resourceMod;
        this.result.resourceModRoll = roll;
        await persistGenerationStats(this.actor, this.result, { quiet: true, originLabel: this.result.origin.label });
      }
      this.resources = resources;
      this.resourceMod = resourceMod;
      this.resourceModRoll = roll;
      this.notice = `Resources: ${rankLabel(resources)} (${roll}).`;
    }

    #baseCounts(powerRoll, talentRoll, contactRoll) {
      const { origin } = this.#generationContext();
      const countSrc = this.useUpb ? this._countTable : SPECIAL_COUNT_TABLE;
      let counts = clampCounts({
        powers: lookupTable(countSrc, powerRoll)?.powers ?? [2, 4],
        talents: lookupTable(countSrc, talentRoll)?.talents ?? [1, 4],
        contacts: lookupTable(countSrc, contactRoll)?.contacts ?? [0, 4]
      }, this.useUpb);
      if (!this.useUpb && origin.id === "mutant") counts.powers[0] = Math.min(5, counts.powers[0] + 1);
      if (!this.useUpb && origin.id === "alien") {
        counts.powers[0] = Math.max(2, counts.powers[0] - 1);
        counts.contacts[0] = Math.min(1, counts.contacts[0]);
        counts.contacts[1] = 1;
      }
      return clampCounts(counts, this.useUpb);
    }

    async #rollCounts() {
      const missing = ABILITIES.filter((key) => !this.abilities[key]);
      if (missing.length) {
        this.notice = `Roll ${missing.map((key) => ABILITY_LABEL[key]).join(", ")} first.`;
        return;
      }
      if (this.useUpb) await this.#loadUpb();
      await this.#ensureActor();
      const actor = this.actor;
      const powerRoll = await rollD100({ flavor: `${actor.name} — Number of Powers`, actor });
      const talentRoll = await rollD100({ flavor: `${actor.name} — Number of Talents`, actor });
      const contactRoll = await rollD100({ flavor: `${actor.name} — Number of Contacts`, actor });
      const counts = this.#baseCounts(powerRoll, talentRoll, contactRoll);
      const { setup, origin, column } = this.#generationContext();
      if (!this.result) {
        const popularity = (!this.useUpb && (origin.id === "mutant" || origin.id === "robot")) ? 0 : 10;
        const result = {
          origin: { ...origin, column, notes: this.upbForm?.notes || origin.notes, label: this.upbForm?.label || setup?.originLabel || origin.label },
          originRoll: this.originRoll,
          abilities: { ...this.abilities },
          numbers: { ...this.numbers },
          abilityRolls: { ...this.abilityRolls },
          resources: this.resources,
          resourceModRoll: this.resourceModRoll,
          resourceMod: this.resourceMod,
          counts, popularity, useUpb: !!this.useUpb, column,
          countRolls: { powers: powerRoll, talents: talentRoll, contacts: contactRoll },
          useUltimateTalents: !!this.useUltimateTalents
        };
        if (this.useUpb && this.upbForm) {
          const { finalizeUpbResult } = await import("../wizard-upb.mjs");
          finalizeUpbResult(result, { form: this.#upbFormRecord(), originOfPower: this.upbOrigin });
          this.powers = this.powers.filter((row) => row.category !== "Form");
          for (const bonus of result.bonusPowers || []) {
            this.powers.push({ name: bonus, category: "Form", rank: "good", rankRoll: 0, cost: 0, grade: "Form bonus", bodyArmor: /armor/i.test(bonus), forceField: /force field/i.test(bonus) });
          }
        }
        if (this.archetype) {
          tuneArchetypeResult(result, this.archetype);
          this.tuned = true;
        }
        this.abilities = { ...result.abilities };
        this.numbers = { ...result.numbers };
        this.resources = result.resources;
        this.result = result;
        this.raise = ABILITIES[0];
      } else {
        const form = this.useUpb ? this.#upbFormRecord() : null;
        if (form?.extraPower) counts.powers[0] += form.extraPower;
        if (form?.lessPower) counts.powers[0] = Math.max(0, counts.powers[0] - form.lessPower);
        this.result.counts = clampCounts(counts, this.useUpb);
        this.result.countRolls = { powers: powerRoll, talents: talentRoll, contacts: contactRoll };
      }
      await persistGenerationStats(actor, this.result, { quiet: true, originLabel: this.result.origin.label });
      const shown = this.result.counts;
      this.archetypePowerBudget = Number(shown.powers[0] || 0);
      this.notice = `Powers ${shown.powers[0]}/${shown.powers[1]}. Talents ${shown.talents[0]}/${shown.talents[1]}. Contacts ${shown.contacts[0]}/${shown.contacts[1]}.`;
    }

    async #rollCalling() {
      await this.#ensureActor();
      const roll = await rollD100({ flavor: `${this.actor.name} — Calling`, actor: this.actor });
      const index = Math.min(CALLINGS.length - 1, Math.floor(((roll - 1) / 100) * CALLINGS.length));
      this.calling = { ...CALLINGS[index], roll };
      this.notice = `Calling: ${this.calling.label} (${roll}).`;
    }

    async #rollQuirk() {
      await this.#ensureActor();
      const typeRoll = await rollD100({ flavor: `${this.actor.name} — Quirk type`, actor: this.actor });
      const kind = typeRoll <= 50 ? "physical" : "mental";
      const posRoll = await rollD100({ flavor: `${this.actor.name} — Positive ${kind} quirk`, actor: this.actor });
      const negRoll = await rollD100({ flavor: `${this.actor.name} — Negative ${kind} quirk`, actor: this.actor });
      this.quirkPair = {
        kind,
        positive: band(QUIRKS[kind].positive, posRoll),
        negative: band(QUIRKS[kind].negative, negRoll)
      };
      this.notice = `${kind}: ${this.quirkPair.positive.name} and ${this.quirkPair.negative.name}.`;
    }

    async #rollSocial(side) {
      await this.#ensureActor();
      const roll = await rollD100({ flavor: `${this.actor.name} — ${side} social`, actor: this.actor });
      const row = { ...band(QUIRKS.social[side], roll), roll };
      if (side === "positive") this.socialPositive = row;
      else this.socialNegative = row;
      this.notice = `${side === "positive" ? "Positive" : "Negative"} social: ${row.name} (${roll}).`;
    }

    #bodyPreview() {
      if (!this.buildRoll || !this.statureRoll) return null;
      const strength = this.abilities.strength || "typical";
      return heightAndWeight(this.buildRoll, this.statureRoll, strength, this.weightRoll || 50);
    }

    #bodyLine() {
      const body = this.#bodyPreview();
      if (!body) return "";
      const pending = this.abilities.strength ? "" : " Weight uses Typical until Strength is rolled, then updates when the hero is saved.";
      return `<p class="creator-fine">${esc(body.height)}, ${esc(body.weight)}. ${esc(body.build)}. ${esc(body.modifier)}.${esc(pending)}</p>`;
    }

    async #rollBuild() {
      await this.#ensureActor();
      const roll = await rollD100({ flavor: `${this.actor.name} — Build`, actor: this.actor });
      this.buildRoll = roll;
      this.build = band(BUILDS, roll);
      this.notice = `Build: ${this.build.label} (${roll}).`;
    }

    async #rollStature() {
      await this.#ensureActor();
      const roll = await rollD100({ flavor: `${this.actor.name} — Stature`, actor: this.actor });
      this.statureRoll = roll;
      this.stature = band(STATURE, roll);
      const weight = await new Roll("1d100").evaluate();
      this.weightRoll = Number(weight.total);
      const body = this.#bodyPreview();
      this.notice = body
        ? `${body.height}, ${body.weight} (${body.build}).`
        : `Stature: ${this.stature.height} (${roll}).`;
    }

    async #writeLife(actor) {
      const update = {};
      if (this.calling) {
        update["system.identity.calling"] = this.calling.label;
        update["system.identity.personality"] = `${this.calling.label}: ${this.calling.note}`;
      }
      const bits = [];
      if (this.quirkPair) {
        const pair = this.quirkPair;
        bits.push(`${pair.kind} ${pair.positive.name} (${pair.positive.points} pt): ${pair.positive.note}`);
        bits.push(`${pair.kind} ${pair.negative.name} (${pair.negative.points} pt): ${pair.negative.note}`);
      }
      if (this.socialPositive) bits.push(`social ${this.socialPositive.name} (${this.socialPositive.points} pt): ${this.socialPositive.note}`);
      if (this.socialNegative) bits.push(`social ${this.socialNegative.name} (${this.socialNegative.points} pt): ${this.socialNegative.note}`);
      if (bits.length) update["system.identity.quirks"] = bits.join(" | ");
      if (this.buildRoll && this.statureRoll) {
        const strength = actor.getAbilityRank?.("strength") || this.abilities.strength || "typical";
        const body = heightAndWeight(this.buildRoll, this.statureRoll, strength, this.weightRoll || 50);
        update["system.identity.height"] = body.height;
        update["system.identity.weight"] = body.weight;
        const feature = `Build: ${body.build}. ${body.modifier}.`;
        const existing = String(actor.system?.identity?.physicalFeatures || "");
        if (!existing.includes(feature)) update["system.identity.physicalFeatures"] = [existing, feature].filter(Boolean).join(" ");
      }
      if (Object.keys(update).length) await actor.update(update);
    }

    #upbClasses() {
      return (this._upbClasses || []);
    }

    #powerList() {
      const cat = this.powerCategory;
      if (!cat) return [];
      if (this.#magicCategory(cat)) {
        const names = this.#romLists()[cat.id] || [];
        return names.map((name) => ({
          name,
          definition: ROM_DEFINITIONS[name.toLowerCase()] || `${name} is a magical working.`,
          slots: 1,
          grade: "Magic",
          play: cat.id === "dimensional" ? "Dimensional. It finishes at the end of the round." : "A magical working at the rolled rank."
        }));
      }
      if (this.useUpb && cat.id !== "symbiote") {
        const rows = this._upbPowers?.[cat.id] || [];
        return rows.map((row) => ({ ...powerFacts(row.name, cat.label), slots: row.countsAsTwo ? 2 : powerFacts(row.name, cat.label).slots, lo: row.lo, hi: row.hi, countsAsTwo: !!row.countsAsTwo }));
      }
      if (cat.id === "symbiote") {
        return SYMBIOTE_BONDS.map((bond) => {
          const facts = powerFacts(bond.power, "Symbiote");
          return { ...facts, definition: `${facts.definition} ${bond.note}`, bondNote: bond.note };
        });
      }
      return (POWER_CATALOG[cat.id] || []).map((raw) => powerFacts(raw, cat.label));
    }

    #magicCategory(cat) {
      return !!cat && ["personal", "universal", "dimensional"].includes(cat.id);
    }

    #originCategories() {
      const table = this.useUpb ? [...this.#upbClasses()] : [...POWER_CATEGORIES];
      table.push({ id: "symbiote", label: "Symbiote" });
      return table;
    }

    #mutantSource() {
      if (this.useUpb) {
        const form = this.#upbFormRecord();
        const group = String(form.group || "");
        const id = String(form.id || "");
        const label = String(form.label || this.result?.origin?.label || "");
        return group === "Mutant" || id.startsWith("mutant") || /^mutant\b/i.test(label);
      }
      return this.#generationContext().origin?.id === "mutant" || this.result?.origin?.id === "mutant";
    }

    #originPowerSlots() {
      if (!this.useRom) return 0;
      if (this.#mutantSource()) {
        if (this.romOrdinary) return Math.max(0, Number(this.romOrdinary[0]) || 0);
        return Math.max(0, Number(this.result?.counts?.powers?.[0]) || 0);
      }
      if (this.useUpb) return Math.max(0, Number(this.#upbFormRecord()?.extraPower) || 0);
      return 0;
    }

    #spent(kind) {
      return this.powers.reduce((sum, power) => {
        const cost = Number(power.cost) || 0;
        if (kind === "magic") return power.powerType === "Realms of Magic" ? sum + cost : sum;
        if (kind === "origin") return power.source === "origin" ? sum + cost : sum;
        return sum + cost;
      }, 0);
    }

    #categoryTable() {
      if (this.useRom) {
        const magic = this.#romCategories();
        if (!this.#originPowerSlots()) return magic;
        return magic.concat(this.#originCategories());
      }
      return this.#originCategories();
    }

    #setCategory(id, roll) {
      const table = this.#categoryTable();
      const row = table.find((entry) => entry.id === id) || lookupTable(table, roll || 1);
      this.powerCategory = { ...row, roll: roll || null };
      this.openPower = "";
      this.notice = "";
      return this.render();
    }

    async #rollCategory() {
      const table = this.useRom ? this.#romCategories() : this.#categoryTable();
      const roll = await rollD100({ flavor: `${this.actor.name} — Power category`, actor: this.actor });
      const row = lookupTable(table, roll);
      this.powerCategory = { ...row, roll };
      this.openPower = "";
      this.notice = `${row.label} (${roll}).`;
    }

    async #rollOriginCategory() {
      const left = this.#originPowerSlots() - this.#spent("origin");
      if (left <= 0) {
        this.notice = "The origin powers are already chosen.";
        return this.render();
      }
      const roll = await rollD100({ flavor: `${this.actor.name} — Origin power category`, actor: this.actor });
      const row = lookupTable(this.#originCategories(), roll);
      this.powerCategory = { ...row, roll };
      this.openPower = "";
      this.notice = `${row.label} (${roll}). Origin power.`;
      return this.render();
    }

    async #rollPower() {
      const list = this.#powerList();
      if (!list.length) return;
      const roll = await rollD100({ flavor: `${this.actor.name} — ${this.powerCategory.label}`, actor: this.actor });
      let row = list[d100Index(list.length, roll)];
      if (this.useUpb && !this.#magicCategory(this.powerCategory) && this.powerCategory.id !== "symbiote") {
        const { lookupUpbPower } = await import("../data/upb.mjs");
        const found = lookupUpbPower(this.powerCategory.id, roll);
        row = list.find((entry) => entry.name === found?.name) || row;
      }
      this.openPower = row.name;
      await this.#takePower(row.name, { fromRoll: true });
    }

    async #takePower(name, { fromRoll = false } = {}) {
      const list = this.#powerList();
      const row = list.find((entry) => entry.name === name);
      if (!row || !this.result) return;
      const magic = this.#magicCategory(this.powerCategory);
      const needed = magic
        ? Number(this.result.counts.powers[0] || 0)
        : (this.useRom ? this.#originPowerSlots() : Number(this.result.counts.powers[0] || 0));
      const spent = magic ? this.#spent("magic") : (this.useRom ? this.#spent("origin") : this.#spent("all"));
      const cost = row.slots > 1 ? 2 : 1;
      if (spent + cost > needed) {
        this.notice = `${row.name} needs ${cost} slot${cost === 2 ? "s" : ""}. ${Math.max(0, needed - spent)} left.`;
        this.openPower = row.name;
        return;
      }
      const rankRoll = await rollD100({ flavor: `${this.actor.name} — ${row.name} rank`, actor: this.actor });
      const rank = magic ? lookupBand(ROM_SPELL_RANK, rankRoll).id : rollOnColumn(this.result.origin.column || this.result.column || 1, rankRoll);
      let item = null;
      if (magic && this.rom?.type?.id === "items") item = await this.#rollRomItem();
      this.powers.push({
        name: row.name, category: magic ? `RoM ${this.powerCategory.id}` : this.powerCategory.label, rank, rankRoll, cost,
        grade: row.grade, bodyArmor: row.bodyArmor, forceField: row.forceField,
        powerType: magic ? "Realms of Magic" : "",
        source: magic ? "magic" : (this.useRom ? "origin" : ""),
        definition: row.definition || "",
        bondNote: row.bondNote || "",
        energy: magic ? this.powerCategory.id : "",
        item
      });
      this.openPower = "";
      this.powerCategory = null;
      const held = item ? ` Held in ${item.label}.` : "";
      this.notice = fromRoll
        ? `Rolled ${row.name}: ${rankLabel(rank)}.${held} Pick the next category.`
        : `${row.name}: ${rankLabel(rank)}.${held} Pick the next category.`;
    }

    #talentCategories() {
      if (this.useRom && this.rom?.type?.id === "wielder" && !this.romCampaign) {
        return [{ id: "rom-study", label: "Magical studies", lo: 1, hi: 100 }];
      }
      if (this.result?.origin?.id === "hitech" && !this.talents.length) {
        return [{ id: "hitech", label: "Scientific / professional", lo: null, hi: null }];
      }
      if (this.useUltimateTalents) return this._ultimateTalentCategories || [];
      return TALENT_CATEGORIES;
    }

    #talentList() {
      const cat = this.talentCategory;
      if (!cat) return [];
      if (cat.id === "rom-study") {
        return ROM_WIELDER_TALENTS.map((row) => ({ name: row.label, definition: row.label, lo: row.lo, hi: row.hi }));
      }
      if (cat.id === "hitech") {
        if (this.useUltimateTalents) {
          return (this._hitechTalents || []).map((row) => ({ name: row.name, definition: row.definition || describeTalent(row.name).definition }));
        }
        return [].concat(TALENT_CATALOG.scientific || [], TALENT_CATALOG.professional || []).map((name) => ({
          name, definition: describeTalent(name).definition
        }));
      }
      if (this.useUltimateTalents) {
        const rows = this._ultimateTalentCatalog?.[cat.id] || [];
        return rows.map((row) => ({ name: row.name, definition: row.definition || describeTalent(row.name).definition }));
      }
      return (TALENT_CATALOG[cat.id] || []).map((name) => ({ name, definition: describeTalent(name).definition }));
    }

    #setTalentCategory(id, roll) {
      const table = this.#talentCategories();
      const row = table.find((entry) => entry.id === id) || table[0];
      this.talentCategory = { ...row, roll: roll || null };
      this.openTalent = "";
      return this.render();
    }

    async #rollTalentCategory() {
      const available = this.#talentCategories();
      if (available.length === 1 && available[0].lo == null) {
        this.talentCategory = { ...available[0], roll: null };
        this.notice = available[0].label;
        return;
      }
      const table = available.filter((row) => row.lo != null);
      const roll = await rollD100({ flavor: `${this.actor.name} — Talent category`, actor: this.actor });
      const row = lookupTable(table.length ? table : TALENT_CATEGORIES, roll);
      this.talentCategory = { ...row, roll };
      this.openTalent = "";
      this.notice = `${row.label} (${roll}).`;
    }

    async #rollTalent() {
      const list = this.#talentList();
      if (!list.length) return;
      const roll = await rollD100({ flavor: `${this.actor.name} — ${this.talentCategory.label}`, actor: this.actor });
      let row = list[d100Index(list.length, roll)];
      if (this.talentCategory?.id === "rom-study") {
        const found = lookupBand(ROM_WIELDER_TALENTS, roll);
        row = list.find((entry) => entry.name === found.label) || row;
      }
      if (this.useUltimateTalents && this.talentCategory.lo != null) {
        const rows = this._ultimateTalentCatalog?.[this.talentCategory.id] || [];
        const found = lookupTable(rows, roll);
        if (found?.name) row = list.find((entry) => entry.name === found.name) || row;
      }
      await this.#takeTalent(row.name);
    }

    #takeTalent(name) {
      const list = this.#talentList();
      const row = list.find((entry) => entry.name === name) || { name, definition: "" };
      if (row.name === "Campaign talent") {
        this.romCampaign = true;
        this.talentCategory = null;
        this.notice = "Pick that talent from the normal lists.";
        return this.render();
      }
      const needed = Number(this.result?.counts?.talents?.[0] || 0);
      const cap = Math.min(this.useUpb ? 8 : 6, Number(this.result?.counts?.talents?.[1] || 6));
      if (this.talents.length >= cap) {
        this.notice = `Talent maximum is ${cap}.`;
        return this.render();
      }
      let extra = "";
      if (this.talents.length >= needed && this.result) {
        this.result.resources = shiftRank(this.result.resources, -1);
        extra = ` Resources are now ${rankLabel(this.result.resources)}.`;
      }
      this.talents.push({ name: row.name, category: this.talentCategory?.label || "", definition: row.definition || "" });
      this.openTalent = "";
      this.romCampaign = false;
      this.notice = `${row.name}.${extra}`;
      if (this.talents.length >= needed) this.talentCategory = null;
      return this.render();
    }

    #addContact() {
      const target = Number(this.result?.counts?.contacts?.[1] || this.result?.counts?.contacts?.[0] || 4);
      if (this.contacts.length >= target) {
        this.notice = `Contact maximum is ${target}.`;
        return this.render();
      }
      const name = String(this.contactName || "").trim() || this.contactType;
      this.contacts.push({ name, type: this.contactType });
      this.contactName = "";
      this.notice = "";
      return this.render();
    }

    async #loadUpb() {
      if (this._upbReady) return;
      const upb = await import("../data/upb.mjs");
      this._upbClasses = upb.UPB_POWER_CLASSES;
      this._upbPowers = upb.UPB_POWERS;
      this._countTable = upb.UPB_COUNT_TABLE;
      this._forms = upb.UPB_PHYSICAL_FORMS;
      this._origins = upb.UPB_ORIGINS_OF_POWER;
      this._compound = upb.UPB_COMPOUND_COUNT;
      this._lookup = upb.lookupBand;
      const talents = await import("../data/ultimate-talents.mjs");
      this._ultimateTalentCategories = talents.ULTIMATE_TALENT_CATEGORIES;
      this._ultimateTalentCatalog = talents.ULTIMATE_TALENT_CATALOG;
      this._hitechTalents = (talents.ULTIMATE_HITECH_CATEGORIES || []).flatMap((id) => talents.ULTIMATE_TALENT_CATALOG[id] || []);
      this._upbReady = true;
    }

    async #rollUpbForm() {
      await this.#loadUpb();
      const roll = await rollD100({ flavor: `${this.actor?.name || this.name} — Physical form`, actor: this.actor });
      const form = this._lookup(this._forms, roll);
      this.upbFormRoll = roll;
      this.upbForm = form;
      this.notice = `${form.label} (${roll}).`;
    }

    #pickUpbForm(id) {
      const form = (this._forms || []).find((row) => row.id === id || row.label === id);
      if (form) this.upbForm = form;
      return this.render();
    }

    async #rollUpbOrigin() {
      await this.#loadUpb();
      const roll = await rollD100({ flavor: `${this.actor?.name || this.name} — Origin of power`, actor: this.actor });
      this.upbOriginRoll = roll;
      this.upbOrigin = this._lookup(this._origins, roll);
      this.notice = `${this.upbOrigin.label} (${roll}).`;
    }

    #pickUpbOrigin(id) {
      const row = (this._origins || []).find((entry) => entry.id === id || entry.label === id);
      if (row) this.upbOrigin = row;
      return this.render();
    }

    #upbFormRecord() {
      const form = { ...(this.upbForm || {}) };
      if (form.pickAngelDemon && this.angelSide === "demon") {
        return { ...form, label: "Demon", popularityCs: -2, bonusPowers: ["Fire Generation", "Resistance to Fire and Heat"] };
      }
      if (form.pickAngelDemon && this.angelSide === "angel") {
        return { ...form, label: "Angel", popularityCs: 2, bonusPowers: ["Artifact Creation (magical sword)"] };
      }
      return form;
    }

    #romLists() {
      return {
        personal: ["Absorption", "Armor", "Alteration - Appearance", "Healing", "Invisibility", "Levitation"],
        universal: ["Eldritch Beam", "Matter Animation", "Shield", "Teleport", "Illusion", "Bind"],
        dimensional: ["Dimensional Aperture", "Entreaty", "Banishment", "Dimensional Gate"]
      };
    }

    #romCategories() {
      let lists = this.rom?.energy?.lists;
      if (this.rom?.type?.id === "items") lists = ["personal", "universal"];
      if (this.rom?.type?.id === "enhanced") lists = ["personal"];
      if (!lists?.length) lists = ["personal", "universal"];
      const labels = { personal: "Personal", universal: "Universal", dimensional: "Dimensional" };
      return lists.map((id) => ({ id, label: labels[id] || id, lo: 1, hi: 100 }));
    }

    #rememberOrdinary() {
      if (this.romOrdinary || !this.result?.counts?.powers) return;
      this.romOrdinary = this.result.counts.powers.slice();
    }

    #setRomPowers(count) {
      this.#rememberOrdinary();
      if (!this.result) return;
      const n = Math.max(0, Number(count) || 0);
      this.result.counts.powers = [n, n];
    }

    #romReady() {
      const rom = this.rom;
      if (!rom?.type) return "Roll or choose a magical character type.";
      if (!rom.school) return "Roll or choose a school.";
      if (rom.type.id === "wielder" && !rom.energy) return "Roll the energy sources.";
      if (rom.type.id === "wielder" && !rom.spellCount) return "Roll the number of spells.";
      if (rom.type.id === "items" && !rom.itemCount) return "Roll the number of items.";
      if (rom.type.id === "items" && rom.abilityCs && !rom.raised) return "Raise one ability with the item bonus.";
      if (rom.type.id === "enhanced" && !rom.enhancement) return "Roll the enhancement.";
      return "";
    }

    #magic() {
      const rom = this.rom || {};
      const types = ROM_CHARACTER_TYPE.map((row) => {
        const on = rom.type?.id === row.id ? "is-on" : "";
        return `<button type="button" class="name-card ${on}" data-action="pick-rom-type" data-id="${esc(row.id)}" data-title="${esc(row.label)}" data-blurb="${esc(`${row.lo}–${row.hi === 100 ? "00" : row.hi}`)}"><strong>${esc(row.label)}</strong></button>`;
      }).join("");
      const schools = ROM_SCHOOLS.map((row) => {
        const on = rom.school?.id === row.id ? "is-on" : "";
        return `<button type="button" class="name-card ${on}" data-action="pick-rom-school" data-id="${esc(row.id)}" data-title="${esc(row.label)}" data-blurb="${esc(row.notes)}"><strong>${esc(row.label)}</strong></button>`;
      }).join("");
      const ordinary = this.romOrdinary ? `The abilities step rolled ${this.romOrdinary[0]} ordinary powers. The workings replace that roll.` : "The ordinary power roll is set aside here.";
      const originSlots = this.#originPowerSlots();
      const originLine = originSlots
        ? ` ${this.result?.origin?.label || "Mutant"} still picks ${originSlots} power${originSlots === 1 ? "" : "s"} from the power classes, in addition to the workings.`
        : "";
      let countLine = "Roll the magic table next.";
      if (rom.type?.id === "items" && rom.itemCount) {
        countLine = `${rom.itemCount} magical item${rom.itemCount === 1 ? "" : "s"}. Each item holds one working, so this hero has ${rom.itemCount} power${rom.itemCount === 1 ? "" : "s"}.`;
        if (rom.abilityCs) countLine += ` Raise one ability +${rom.abilityCs} CS.`;
      } else if (rom.type?.id === "wielder" && rom.spellCount) {
        countLine = `${rom.spellCount} starting spell${rom.spellCount === 1 ? "" : "s"}. ${rom.energy?.label || ""}`;
      } else if (rom.type?.id === "enhanced" && rom.enhancement) {
        countLine = rom.enhancement.power ? "The enhancement also grants one Personal working." : "This enhancement grants no extra working.";
      }
      const raises = rom.type?.id === "items" && rom.abilityCs && !rom.raised
        ? `<div class="choice-grid">${ABILITIES.map((key) => `<button type="button" class="name-card" data-action="rom-raise" data-ability="${key}"><strong>${esc(ABILITY_LABEL[key])}</strong></button>`).join("")}</div>`
        : "";
      const energies = ROM_ENERGY.map((row) => {
        const on = rom.energy?.id === row.id ? "is-on" : "";
        return `<button type="button" class="name-card ${on}" data-action="pick-rom-energy" data-id="${esc(row.id)}" data-title="${esc(row.label)}" data-blurb="${esc(`${row.lo}–${row.hi === 100 ? "00" : row.hi}. Workings may use ${row.lists.join(", ")}.`)}"><strong>${esc(row.label)}</strong></button>`;
      }).join("");
      const extra = rom.type?.id === "wielder"
        ? `<div class="creator-block-head"><h3>Energy ${rom.energyRoll ? `· rolled ${rom.energyRoll}` : ""}</h3><button type="button" class="roll-btn" data-action="roll-rom-energy">Roll energy</button></div><div class="choice-grid">${energies}</div><p class="creator-fine">01–15 is Personal only. 16–50 adds Universal. 51–00 adds Dimensional. The roll can be changed by choosing another card.</p><div class="btn-row"><button type="button" class="roll-btn" data-action="roll-rom-count">Roll spell count</button><button type="button" class="roll-btn" data-action="roll-rom-resources">Roll Resources</button></div><label>Master<input name="romMaster" type="text" value="${esc(this.romMaster)}" /></label>`
        : rom.type?.id === "items"
          ? `<div class="btn-row"><button type="button" class="roll-btn" data-action="roll-rom-count">Roll item count</button></div>${raises}`
          : rom.type?.id === "enhanced"
            ? `<div class="btn-row"><button type="button" class="roll-btn" data-action="roll-rom-enhance">Roll enhancement</button></div>`
            : "";
      return `<section class="creator-block">
        <p class="creator-kicker">Realms of Magic</p>
        <h2>Type, school, then the magic table</h2>
        <p class="creator-fine">${esc(ordinary)}${esc(originLine)} ${esc(countLine)}</p>
        <div class="creator-block-head"><h3>Character type ${rom.typeRoll ? `· rolled ${rom.typeRoll}` : ""}</h3><button type="button" class="roll-btn" data-action="roll-rom-type">Roll type</button></div>
        <div class="choice-grid">${types}</div>
        <div class="creator-block-head"><h3>School ${rom.schoolRoll ? `· rolled ${rom.schoolRoll}` : ""}</h3><button type="button" class="roll-btn" data-action="roll-rom-school">Roll school</button></div>
        <div class="choice-grid">${schools}</div>
        ${extra}
      </section>`;
    }

    #ensureRom() {
      if (!this.rom) this.rom = {};
      return this.rom;
    }

    async #rollRomType() {
      const roll = await rollD100({ flavor: `${this.actor?.name || this.name} — magical character`, actor: this.actor });
      const rom = this.#ensureRom();
      rom.type = lookupBand(ROM_CHARACTER_TYPE, roll);
      rom.typeRoll = roll;
      rom.energy = null;
      rom.spellCount = 0;
      rom.itemCount = 0;
      rom.abilityCs = 0;
      rom.enhancement = null;
      rom.raised = false;
      this.notice = `${rom.type.label} (${roll}).`;
    }

    #pickRomType(id) {
      const rom = this.#ensureRom();
      rom.type = ROM_CHARACTER_TYPE.find((row) => row.id === id) || rom.type;
      rom.energy = null;
      rom.spellCount = 0;
      rom.itemCount = 0;
      rom.abilityCs = 0;
      rom.enhancement = null;
      rom.raised = false;
      return this.render();
    }

    async #rollRomSchool() {
      const roll = await rollD100({ flavor: `${this.actor?.name || this.name} — school`, actor: this.actor });
      const rom = this.#ensureRom();
      rom.school = schoolById(lookupBand(ROM_SCHOOL_TABLE, roll).id);
      rom.schoolRoll = roll;
      this.notice = `${rom.school.label} (${roll}).`;
    }

    #pickRomSchool(id) {
      const rom = this.#ensureRom();
      rom.school = schoolById(id);
      return this.render();
    }

    async #rollRomEnergy() {
      const roll = await rollD100({ flavor: `${this.actor?.name || this.name} — energy`, actor: this.actor });
      const rom = this.#ensureRom();
      rom.energy = lookupBand(ROM_ENERGY, roll);
      rom.energyRoll = roll;
      this.notice = `${rom.energy.label} (${roll}).`;
    }

    #pickRomEnergy(id) {
      const rom = this.#ensureRom();
      rom.energy = ROM_ENERGY.find((row) => row.id === id) || rom.energy;
      this.notice = rom.energy?.label || "";
      return this.render();
    }

    async #rollRomCount() {
      const rom = this.#ensureRom();
      if (rom.type?.id === "items") {
        const roll = await rollD100({ flavor: `${this.actor?.name || this.name} — item count`, actor: this.actor });
        const row = lookupBand(ROM_ITEM_COUNT, roll);
        rom.itemCount = row.count;
        rom.abilityCs = row.abilityCs;
        rom.countRoll = roll;
        rom.energy = ROM_ENERGY[1];
        rom.spellCount = row.count;
        rom.raised = !row.abilityCs;
        this.#setRomPowers(row.count);
        this.notice = `${row.count} item${row.count === 1 ? "" : "s"} (${roll}). Each one is a power.`;
        return;
      }
      const roll = await rollD100({ flavor: `${this.actor?.name || this.name} — spell count`, actor: this.actor });
      const count = lookupBand(ROM_SPELL_COUNT, roll).count;
      const bonus = rom.school?.id === "scientific" ? 3 : 0;
      rom.spellCount = count + bonus;
      rom.countRoll = roll;
      if (!rom.energy) rom.energy = ROM_ENERGY[2];
      const talentRoll = await rollD100({ flavor: `${this.actor?.name || this.name} — wielder talents`, actor: this.actor });
      const talents = lookupBand(ROM_WIELDER_TALENT_COUNT, talentRoll).count;
      this.#rememberOrdinary();
      if (this.result) this.result.counts.talents = [talents, talents];
      this.#setRomPowers(rom.spellCount);
      this.notice = `${count} spells (${roll})${bonus ? `, plus ${bonus} from the laboratory school` : ""}. ${talents} magical studies.`;
    }

    async #rollRomEnhance() {
      const roll = await rollD100({ flavor: `${this.actor?.name || this.name} — enhancement`, actor: this.actor });
      const rom = this.#ensureRom();
      const row = lookupBand(ROM_ENHANCEMENT, roll);
      const condRoll = await rollD100({ flavor: `${this.actor?.name || this.name} — enhancement condition`, actor: this.actor });
      rom.enhancement = { ...row, roll, condition: lookupBand(ROM_ENHANCEMENT_CONDITION, condRoll) };
      rom.energy = ROM_ENERGY[0];
      rom.spellCount = row.power ? 1 : 0;
      this.#setRomPowers(rom.spellCount);
      const keys = [];
      for (let i = 0; i < row.select; i++) {
        const face = (await new Roll("1d10").evaluate()).total;
        let key = "endurance";
        if (face <= 2) key = "fighting";
        else if (face <= 4) key = "agility";
        else if (face <= 6) key = "strength";
        else if (face <= 8) key = "endurance";
        else if (face === 9) key = rankIndex(this.abilities.reason) <= rankIndex(this.abilities.intuition) ? "reason" : "intuition";
        else key = "psyche";
        if (keys.includes(key)) continue;
        keys.push(key);
        this.#applyRomRaise(key, row.raise);
      }
      rom.raisedKeys = keys;
      this.notice = `${keys.join(", ") || "No new raise"} +${row.raise} CS (${roll}).`;
    }

    async #rollRomResources() {
      const roll = await rollD100({ flavor: `${this.actor?.name || this.name} — wielder Resources`, actor: this.actor });
      const cacheRoll = await rollD100({ flavor: `${this.actor?.name || this.name} — resource cache`, actor: this.actor });
      const rom = this.#ensureRom();
      const rank = lookupBand(ROM_RESOURCE_RANK, roll).id;
      rom.cache = lookupBand(ROM_RESOURCE_CACHE, cacheRoll).rp;
      if (this.result) this.result.resources = rank;
      this.resources = rank;
      this.notice = `Resources ${rankLabel(rank)}. Cache ${rom.cache}.`;
    }

    #applyRomRaise(key, cs) {
      if (!this.abilities?.[key]) return;
      let next = this.abilities[key];
      for (let i = 0; i < cs; i++) {
        const raised = shiftRank(next, 1);
        if (rankIndex(raised) > rankIndex("amazing")) break;
        next = raised;
      }
      this.abilities[key] = next;
      this.numbers[key] = rankMin(next);
      if (this.result) {
        this.result.abilities[key] = next;
        this.result.numbers[key] = rankMin(next);
      }
    }

    #romRaise(key) {
      const cs = Number(this.rom?.abilityCs || 0);
      if (!cs || this.rom?.raised) return;
      this.#applyRomRaise(key, cs);
      this.rom.raised = true;
      this.notice = `${ABILITY_LABEL[key]} is now ${rankLabel(this.abilities[key])}.`;
      return this.render();
    }

    async #rollRomItem() {
      const catRoll = await rollD100({ flavor: `${this.actor?.name || this.name} — item category`, actor: this.actor });
      const category = lookupBand(ROM_ITEM_CATEGORY, catRoll);
      const typeRoll = await rollD100({ flavor: `${this.actor?.name || this.name} — ${category.label}`, actor: this.actor });
      const form = lookupBand(ROM_ITEM_TYPES[category.id] || ROM_ITEM_TYPES.misc, typeRoll);
      const condRoll = await rollD100({ flavor: `${this.actor?.name || this.name} — item condition`, actor: this.actor });
      const condition = lookupBand(ROM_ITEM_CONDITION, condRoll);
      return { label: form.label || category.label, condition: condition.label };
    }

    async #handOff() {
      await this.#ensureActor();
      const actor = this.actor;
      const { runFullGeneration } = await import("../wizard.mjs");
      const setup = archetypeSetup(this.archetype);
      const payload = {
        originId: this.originId,
        rollOrigin: false,
        useUpb: false,
        useUltimateTalents: this.useUltimateTalents,
        useRom: this.useRom,
        archetype: this.archetype,
        originLabel: setup?.originLabel || this.result?.origin?.label,
        rankFor: setup?.rankFor || null,
        fixedAbilities: setup?.fixedAbilities || null,
        secretId: this.secretId,
        publicId: this.publicId,
        secretName: this.secretName,
        lifeHeight: false,
        lifeCalling: false,
        lifeQuirk: false,
        raise: (this.result?.origin?.id === "altered" || this.result?.formRaiseOne) ? this.raise : null,
        rolled: this.result,
        tuned: this.tuned
      };
      await this.#writeLife(actor);
      this._leaving = true;
      try { await this.close(); } catch {}
      await runFullGeneration(actor, payload);
    }

    async #writeRom(actor) {
      const { writeGeneratedItem } = await import("../chargen.mjs");
      const rom = this.rom || {};
      for (const power of this.powers) {
        if (!power.item?.label) continue;
        await writeGeneratedItem(actor, "equipment", power.item.label, {
          category: "RoM item",
          rank: power.rank,
          number: rankMin(power.rank),
          definition: `${power.item.label} holds ${power.name} at ${rankLabel(power.rank)}. ${power.item.condition || ""}`,
          notes: power.item.condition || ""
        });
      }
      const mastery = startingMastery(rom.type?.id === "wielder" ? Number(rom.spellCount || 0) : 0);
      const lines = [
        `<p><strong>School:</strong> ${rom.school?.label || ""} — ${rom.school?.notes || ""}</p>`,
        `<p><strong>Path:</strong> ${rom.type?.label || ""}</p>`,
        `<p><strong>Mastery:</strong> ${mastery.label}</p>`
      ];
      if (rom.enhancement) lines.push(`<p><strong>Enhancement:</strong> ${(rom.raisedKeys || []).join(", ")} +${rom.enhancement.raise} CS. ${rom.enhancement.condition?.label || ""}</p>`);
      if (this.romMaster) lines.push(`<p><strong>Master:</strong> ${this.romMaster}</p>`);
      if (rom.cache) {
        try { await actor.setFlag("faserip", "resourceCache", rom.cache); } catch { /* the note still records it */ }
        lines.push(`<p><strong>Resource cache:</strong> ${rom.cache}</p>`);
      }
      await actor.update({ "system.notes": lines.join("") + (actor.system.notes || "") });
    }

    async #attachArchetype(actor) {
      const id = this.archetype;
      await promptArchetypeExtras(actor, this.result, id);
      if (id === "martial") {
        const martial = (await pickMartialPowers(actor, this.archetypePowerBudget ?? this.result?.counts?.powers?.[0] ?? 0)) || [];
        for (const row of martial) this.powers.push({ ...row, cost: 0, source: "archetype", powerType: "" });
      }
      if (id === "cyborg") await pickImplants(actor);
      for (const row of packagePowers(id)) {
        this.powers.push({ ...row, category: row.category || "Archetype", cost: 0, source: "archetype", powerType: "" });
      }
    }

    async #finish() {
      await this.#ensureActor();
      const actor = this.actor;
      const weakness = !this.weakness || this.weakness === "None"
        ? ""
        : (this.weaknessNotes ? `${this.weakness}: ${this.weaknessNotes}` : this.weakness);
      const fullWeakness = this.archetype === "vampire" ? [weakness, vampireWeakness()].filter(Boolean).join(" ") : weakness;
      if (this.#dualArchetype()) await this.#attachArchetype(actor);
      const canRaise = this.result?.origin?.id === "altered" || this.result?.formRaiseOne;
      await applyGeneration(actor, this.result, {
        raiseAbility: canRaise ? (this.raise || null) : null,
        secretId: this.secretId,
        powers: this.powers,
        talents: this.talents,
        contacts: this.contacts,
        weakness: fullWeakness
      });
      if (this.useRom && this.rom) await this.#writeRom(actor);
      let purchasedGear = [];
      try {
        const { pickStartingShop } = await import("../wizard-shop.mjs");
        const shopResult = { ...this.result };
        if (this.useHitech && rankIndex(shopResult.resources) < rankIndex("good")) shopResult.resources = "good";
        purchasedGear = (await pickStartingShop(actor, shopResult)) || [];
        if (this.useHitech) {
          const note = "<p><strong>High-tech gear:</strong> Starting purchases used at least Good Resources.</p>";
          await actor.update({ "system.notes": note + (actor.system.notes || "") });
        }
      } catch (err) {
        console.warn("FASERIP | starting shop skipped", err);
      }
      await actor.update({
        name: this.name,
        "system.identity.public": this.publicId,
        "system.identity.secret": this.secretName,
        "system.identity.archetype": ARCHETYPE_CHOICES.find((row) => row.id === this.archetype)?.label || ""
      });
      try {
        await this.#writeLife(actor);
      } catch (err) {
        console.warn("FASERIP | life rolls", err);
      }
      await actor.setFlag("faserip", "generation", {
        origin: this.result.origin.label,
        upb: !!this.useUpb,
        rom: !!this.useRom,
        school: this.rom?.school?.label || "",
        magicType: this.rom?.type?.label || "",
        powers: this.powers.map((row) => row.name),
        talents: this.talents.map((row) => row.name),
        contacts: this.contacts.map((row) => row.name),
        weakness: fullWeakness,
        gear: purchasedGear,
        powerCount: this.result.counts.powers,
        talentCount: this.result.counts.talents,
        contactCount: this.result.counts.contacts
      });
      try { await actor.unsetFlag("faserip", "generating"); } catch {}
      ui.notifications.info(`${actor.name}: ${this.powers.length} powers, ${this.talents.length} talents, ${this.contacts.length} contacts.`);
      try { actor.sheet?.render(true); } catch { actor.sheet?.render?.({ force: true }); }
      this._leaving = true;
      await this.close();
    }

    async render(force, options) {
      if (this.useUpb || this.useUltimateTalents) await this.#loadUpb();
      if (this.step === "origin" && this.useUpb && !this.archetype) {
        const html = await super.render(force, options);
        this.#paintUpb();
        return html;
      }
      return super.render(force, options);
    }

    #paintUpb() {
      const mount = this.element?.querySelector?.("#upb-origin-mount");
      if (!mount || !this._forms) return;
      const forms = this._forms.map((form) => {
        const on = this.upbForm?.label === form.label ? "is-on" : "";
        return `<button type="button" class="name-card ${on}" data-action="pick-upb-form" data-id="${esc(form.label)}" data-title="${esc(form.label)}" data-blurb="${esc(`Column ${form.column}. ${form.notes || ""}`)}"><strong>${esc(form.label)}</strong></button>`;
      }).join("");
      const origins = (this._origins || []).map((row) => {
        const on = this.upbOrigin?.label === row.label ? "is-on" : "";
        return `<button type="button" class="name-card ${on}" data-action="pick-upb-origin" data-id="${esc(row.label)}" data-title="${esc(row.label)}" data-blurb="${esc(row.notes || "")}"><strong>${esc(row.label)}</strong></button>`;
      }).join("");
      const angel = this.upbForm?.pickAngelDemon ? `<div class="btn-row"><button type="button" class="roll-btn" data-action="angel-side" data-side="angel">Angel</button><button type="button" class="roll-btn" data-action="angel-side" data-side="demon">Demon</button></div>` : "";
      mount.innerHTML = `
        <div class="creator-block-head"><h3>Physical form ${this.upbFormRoll ? `· rolled ${this.upbFormRoll}` : ""}</h3><button type="button" class="roll-btn" data-action="roll-upb-form">Roll form</button></div>
        ${angel}
        <div class="choice-grid">${forms}</div>
        <div class="creator-block-head"><h3>Origin of power ${this.upbOriginRoll ? `· rolled ${this.upbOriginRoll}` : ""}</h3><button type="button" class="roll-btn" data-action="roll-upb-origin">Roll origin</button></div>
        <div class="choice-grid">${origins}</div>`;
    }
  };
}

export async function openCreator(options = {}) {
  const App = CreatorApp();
  if (!App) {
    ui.notifications.error("This Foundry build cannot open the hero creator.");
    return null;
  }
  if (creatorApp?.rendered) await creatorApp.close();
  return new Promise((resolve) => {
    creatorApp = new App(options, resolve);
    creatorApp.render(true);
  });
}
