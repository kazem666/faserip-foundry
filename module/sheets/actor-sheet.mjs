import {
  ABILITIES,
  RANKS,
  ORIGINS,
  BATTLE_EFFECTS,
  POWER_CATALOG,
  TALENT_CATALOG,
  CONTACT_TYPES,
  rankLabel,
  abilityNumber,
  initiativeModifier,
  MOVEMENT_AREAS,
  THROW_RANGE
} from "../config.mjs";
import { promptFeatRoll } from "../dice/universal-table.mjs";
import { promptGeneration } from "../chargen.mjs";
import { isUpbEnabled, upbCatalogGroups, UPB_ORIGINS_OF_POWER, UPB_PHYSICAL_FORMS } from "../data/upb.mjs";
import { confirmDialog, promptForm, formValue, getActorSheetClass, getTextEditor } from "../foundry-api.mjs";

const ActorSheetBase = getActorSheetClass();

function itemIdFrom(event) {
  const el = event.currentTarget || event.target;
  return el?.closest?.("[data-item-id]")?.dataset?.itemId || el?.dataset?.itemId || "";
}

export class FaseripActorSheet extends ActorSheetBase {
  static get defaultOptions() {
    const base = foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["faserip", "sheet", "actor"],
      template: "systems/faserip/templates/actor/character-sheet.hbs",
      width: 900,
      height: 820,
      resizable: true,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "record" }],
      dragDrop: [{ dragSelector: ".item, .record-card", dropSelector: null }],
      submitOnChange: true
    });
    return base;
  }

  get actor() {
    return this.document ?? super.actor;
  }

  async getData(options) {
    const context = await super.getData(options);
    try {
      const actor = this.actor;
      context.actor = actor;
      context.system = actor.system;
      context.ranks = RANKS;
      context.origins = [
        ...ORIGINS.map((o) => o.label),
        ...UPB_ORIGINS_OF_POWER.map((o) => o.label),
        ...UPB_PHYSICAL_FORMS.map((o) => o.label)
      ];
      context.initMod = initiativeModifier(actor.getAbilityNumber("intuition"));
      context.movement = MOVEMENT_AREAS[actor.getAbilityRank("endurance")] ?? 2;
      context.throwRange = THROW_RANGE[actor.getAbilityRank("strength")] ?? 1;
      context.bodyArmor = actor.getBodyArmor();
      context.forceField = actor.getForceField();
      context.healRate = actor.getAbilityNumber("endurance");
      context.combatColumns = Object.entries(BATTLE_EFFECTS).map(([id, col]) => ({ id, label: col.label }));
      context.abilities = ABILITIES.map((key) => {
        const data = actor.system.abilities[key] ?? {};
        const rank = data.rank ?? "typical";
        return {
          key,
          label: game.i18n.localize(`FASERIP.Ability.${key}`),
          abbr: game.i18n.localize(`FASERIP.AbilityAbbr.${key}`),
          rank,
          number: abilityNumber(data),
          rankLabel: rankLabel(rank)
        };
      });
      context.healthPct = actor.system.health.max
        ? Math.round((actor.system.health.value / actor.system.health.max) * 100)
        : 0;
      context.karmaPct = actor.system.karma.max
        ? Math.round((actor.system.karma.value / actor.system.karma.max) * 100)
        : 0;
      const items = actor.items.contents;
      const pips = (n = 0) => Array.from({ length: 10 }, (_, i) => ({ n: i + 1, on: i < Number(n || 0) }));
      const decorate = (collection) => collection.map((item) => ({
        id: item.id,
        name: item.name,
        img: item.img,
        type: item.type,
        rankLabel: rankLabel(item.system.rank ?? "typical"),
        category: item.system.category ?? "",
        slotsTaken: item.system.slotsTaken ?? 1,
        range: item.system.range ?? "",
        area: item.system.area ?? "",
        emanatesFrom: item.system.emanatesFrom ?? "",
        areasPerRound: item.system.areasPerRound ?? "",
        definition: item.system.definition ?? "",
        bonus: item.system.bonus ?? "",
        attribute: item.system.attribute ?? "",
        occupation: item.system.occupation ?? item.system.category ?? "",
        base: item.system.base ?? "",
        tie: item.system.tie ?? "",
        practicality: item.system.practicality ?? "",
        acquired: !!item.system.acquired,
        pips: pips(item.system.assistance),
        stunts: (item.system.stunts ?? []).map((s, index) => ({
          ...s,
          index,
          pips: pips(s.attempts)
        }))
      }));
      context.powers = decorate(items.filter((i) => i.type === "power"));
      context.talents = decorate(items.filter((i) => i.type === "talent"));
      context.contacts = decorate(items.filter((i) => i.type === "contact"));
      context.gear = decorate(items.filter((i) => i.type === "equipment" || i.type === "weapon"));
      try {
        const TextEditor = getTextEditor();
        context.enrichedBiography = await TextEditor.enrichHTML(actor.system.biography ?? "", { secrets: actor.isOwner });
        context.enrichedNotes = await TextEditor.enrichHTML(actor.system.notes ?? "", { secrets: actor.isOwner });
      } catch {
        context.enrichedBiography = actor.system.biography ?? "";
        context.enrichedNotes = actor.system.notes ?? "";
      }
      const gen = actor.getFlag("faserip", "generation");
      context.generation = gen
        ? {
            ...gen,
            powerNeed: gen.powerCount?.[0] ?? 0,
            talentNeed: gen.talentCount?.[0] ?? 0,
            contactNeed: gen.contactCount?.[0] ?? 0,
            contactMax: gen.contactCount?.[1] ?? 0,
            powerMax: gen.powerCount?.[1] ?? gen.powerCount?.[0] ?? 0
          }
        : null;
      const catLabels = {
        resistances: "Resistances", senses: "Senses", movement: "Movement",
        matter: "Matter Control", energy: "Energy Control", bodyControl: "Body Control",
        distance: "Distance Attacks", mental: "Mental Powers",
        offensive: "Body Alterations / Offensive", defensive: "Body Alterations / Defensive"
      };
      context.powerCatalog = Object.entries(POWER_CATALOG).map(([id, list]) => ({
        id, label: catLabels[id] || id, items: list
      }));
      context.talentCatalog = Object.entries(TALENT_CATALOG).map(([id, list]) => ({
        id,
        label: ({ weapon: "Weapon Skills", fighting: "Fighting Skills", professional: "Professional Skills",
          scientific: "Scientific Skills", mystic: "Mystic and Mental Skills", other: "Other Skills" })[id] || id,
        items: list
      }));
      context.contactCatalog = CONTACT_TYPES;
      context.upbEnabled = isUpbEnabled() || !!gen?.upb;
      context.upbCatalog = context.upbEnabled ? upbCatalogGroups() : [];
      context.upbSettingOn = isUpbEnabled();
      context.powerSlotsUsed = context.powers.reduce((sum, p) => sum + Math.max(0, Number(p.slotsTaken || 1)), 0);
      context.cssClass = context.cssClass || "editable";
      context.editable = this.isEditable;
    } catch (err) {
      console.error("FASERIP | actor sheet getData failed", err);
      ui.notifications?.error(`FASERIP sheet data error: ${err.message}`);
    }
    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;
    const on = (action, fn) => html.find(`[data-action='${action}']`).on("click", fn.bind(this));
    on("generate", this._onGenerate);
    on("rollAbility", this._onRollAbility);
    on("rollItem", this._onRollItem);
    on("itemEdit", this._onItemEdit);
    on("itemDelete", this._onItemDelete);
    on("itemCreate", this._onItemCreate);
    on("applyDamage", this._onApplyDamage);
    on("heal", this._onHeal);
    on("recover", this._onRecover);
    on("naturalHeal", this._onNaturalHeal);
    on("resetHealth", this._onResetHealth);
    on("resetKarma", this._onResetKarma);
    on("universal", this._onUniversal);
    on("rollResources", this._onRollResources);
    on("combatFeat", this._onCombatFeat);
    on("editImage", this._onEditImage);
    on("catalogAdd", this._onCatalogAdd);
    on("addStunt", this._onAddStunt);
    on("stuntAttempt", this._onStuntAttempt);
    on("contactAssist", this._onContactAssist);
  }

  async _onGenerate(event) {
    event.preventDefault();
    return promptGeneration(this.actor);
  }

  async _onRollAbility(event) {
    event.preventDefault();
    const ability = event.currentTarget.dataset.ability;
    return promptFeatRoll({
      actor: this.actor,
      rankId: this.actor.getAbilityRank(ability),
      label: game.i18n.localize(`FASERIP.Ability.${ability}`)
    });
  }

  async _onRollItem(event) {
    event.preventDefault();
    const item = this.actor.items.get(itemIdFrom(event));
    if (!item) return;
    return promptFeatRoll({
      actor: this.actor,
      rankId: item.system.rank ?? "typical",
      label: item.name,
      defaultColumn: item.system.effectsColumn ?? ""
    });
  }

  _onItemEdit(event) {
    event.preventDefault();
    const item = this.actor.items.get(itemIdFrom(event));
    item?.sheet?.render(true);
  }

  async _onItemDelete(event) {
    event.preventDefault();
    const item = this.actor.items.get(itemIdFrom(event));
    if (!item) return;
    const ok = await confirmDialog({ title: "Delete Item", content: `<p>Delete <strong>${item.name}</strong>?</p>` });
    if (ok) await item.delete();
  }

  async _onItemCreate(event) {
    event.preventDefault();
    const type = event.currentTarget.dataset.type;
    if (type === "power") {
      const catalog = { ...POWER_CATALOG };
      if (isUpbEnabled() || this.actor.getFlag("faserip", "generation")?.upb) {
        for (const group of upbCatalogGroups()) catalog["UPB " + group.label] = group.items;
      }
      return this.createFromCatalog("power", catalog);
    }
    if (type === "talent") return this.createFromCatalog("talent", TALENT_CATALOG);
    if (type === "contact") return this.createContact();
    await this.actor.createEmbeddedDocuments("Item", [{
      name: type === "weapon" ? "New Weapon" : "New Equipment",
      type
    }]);
  }

  async createFromCatalog(type, catalog) {
    const groups = Object.entries(catalog).map(([cat, list]) => {
      const opts = list.map((n) => `<option value="${String(n).replace(/"/g, """)}">${n}</option>`).join("");
      return `<optgroup label="${cat}">${opts}</optgroup>`;
    }).join("");
    const form = await promptForm({
      title: `Add ${type}`,
      content: `<div class="form-group"><label>Catalog</label><select name="pick"><option value="">custom</option>${groups}</select></div><div class="form-group"><label>Custom name</label><input type="text" name="custom" /></div>`,
      okLabel: "Create"
    });
    if (!form) return;
    const name = formValue(form, "pick") || formValue(form, "custom") || `New ${type}`;
    const extra = { name, type, system: {} };
    if (type === "power" && /body armor/i.test(name)) extra.system.bodyArmor = true;
    if (type === "power" && /force field/i.test(name)) extra.system.forceField = true;
    await this.actor.createEmbeddedDocuments("Item", [extra]);
  }

  async createContact() {
    const opts = CONTACT_TYPES.map((t) => `<option value="${t}">${t}</option>`).join("");
    const form = await promptForm({
      title: "Add Contact",
      content: `<div class="form-group"><label>Type</label><select name="type">${opts}</select></div><div class="form-group"><label>Name</label><input type="text" name="name" /></div>`,
      okLabel: "Create"
    });
    if (!form) return;
    const type = formValue(form, "type");
    const name = formValue(form, "name");
    await this.actor.createEmbeddedDocuments("Item", [{ name: name || type, type: "contact", system: { category: type, occupation: type } }]);
  }

  _formEl(name) {
    const root = this.element?.[0] ?? this.element;
    return root?.querySelector?.(`[name="${name}"]`);
  }

  async _onApplyDamage(event) {
    event.preventDefault();
    const amount = Number(this._formEl("damageAmount")?.value || 0);
    const energy = this._formEl("energyAttack")?.checked;
    const useForceField = this._formEl("useForceField")?.checked;
    if (amount) {
      const taken = await this.actor.applyDamage(amount, { energy, useForceField });
      ui.notifications.info(`${this.actor.name} takes ${taken} after armor/fields.`);
    }
  }

  async _onHeal(event) {
    event.preventDefault();
    const amount = Number(this._formEl("damageAmount")?.value || 0);
    if (amount) await this.actor.heal(amount);
  }

  async _onRecover(event) {
    event.preventDefault();
    await this.actor.recover();
  }

  async _onNaturalHeal(event) {
    event.preventDefault();
    await this.actor.naturalHeal({ rest: event.shiftKey });
  }

  async _onResetHealth(event) {
    event.preventDefault();
    await this.actor.update({
      "system.health.value": this.actor.system.health.max,
      "system.condition.unconscious": false
    });
  }

  async _onResetKarma(event) {
    event.preventDefault();
    await this.actor.update({ "system.karma.value": this.actor.system.karma.max });
  }

  async _onUniversal(event) {
    event.preventDefault();
    const rankId = this._formEl("universalRank")?.value || "typical";
    return promptFeatRoll({ actor: this.actor, rankId, label: "Universal Table" });
  }

  async _onCombatFeat(event) {
    event.preventDefault();
    const column = this._formEl("combatColumn")?.value;
    const def = BATTLE_EFFECTS[column];
    if (!def) return;
    return promptFeatRoll({
      actor: this.actor,
      rankId: this.actor.getAbilityRank(def.ability),
      label: def.label,
      defaultColumn: column
    });
  }

  async _onRollResources(event) {
    event.preventDefault();
    return promptFeatRoll({
      actor: this.actor,
      rankId: this.actor.system.resources?.rank ?? "typical",
      label: "Resources"
    });
  }

  async _onEditImage(event) {
    event.preventDefault();
    const FilePickerImpl = foundry.applications?.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
    const fp = new FilePickerImpl({
      type: "image",
      current: this.actor.img,
      callback: (path) => this.actor.update({ img: path })
    });
    return fp.browse();
  }

  async _onCatalogAdd(event) {
    event.preventDefault();
    const target = event.currentTarget;
    const type = target.dataset.type;
    const raw = target.dataset.name || "";
    const category = target.dataset.category || "";
    const two = /counts as two/i.test(raw);
    const name = raw.replace(/\s*\(counts as two(?: powers?)?\)\s*$/i, "").trim() || `New ${type}`;
    const system = { category };
    if (type === "power") {
      system.slotsTaken = two ? 2 : 1;
      if (/body armor/i.test(name)) system.bodyArmor = true;
      if (/force field/i.test(name)) system.forceField = true;
    }
    if (type === "talent") system.slotsTaken = 1;
    if (type === "contact") system.occupation = category;
    await this.actor.createEmbeddedDocuments("Item", [{ name, type, system }]);
  }

  async _onAddStunt(event) {
    event.preventDefault();
    const item = this.actor.items.get(event.currentTarget.dataset.itemId);
    if (!item) return;
    const form = await promptForm({
      title: `New stunt — ${item.name}`,
      content: `<div class="form-group"><label>Stunt name</label><input name="name" type="text" /></div>
        <div class="form-group"><label>Rank</label><input name="rank" type="text" placeholder="usually −1 CS from the parent Power" /></div>
        <div class="form-group"><label>Description</label><input name="description" type="text" /></div>`,
      okLabel: "Add"
    });
    if (!form) return;
    const stunts = foundry.utils.deepClone(item.system.stunts ?? []);
    stunts.push({
      name: formValue(form, "name") || "New Stunt",
      rank: formValue(form, "rank"),
      description: formValue(form, "description"),
      attempts: 0,
      mastered: false
    });
    await item.update({ "system.stunts": stunts });
  }

  async _onStuntAttempt(event) {
    event.preventDefault();
    const item = this.actor.items.get(event.currentTarget.dataset.itemId);
    const idx = Number(event.currentTarget.dataset.stunt);
    if (!item || Number.isNaN(idx)) return;
    const fee = 100;
    const available = this.actor.system.karma.value ?? 0;
    if (available < fee) {
      ui.notifications.warn(`${this.actor.name} needs ${fee} Karma for this stunt attempt.`);
      return;
    }
    const stunts = foundry.utils.deepClone(item.system.stunts ?? []);
    const row = stunts[idx];
    if (!row || row.mastered) return;
    row.attempts = Math.min(10, Number(row.attempts || 0) + 1);
    if (row.attempts >= 10) row.mastered = true;
    await this.actor.update({
      "system.karma.value": available - fee,
      "system.karmaBank.powers": (this.actor.system.karmaBank?.powers ?? 0) + fee,
      "system.karmaBank.totalSpent": (this.actor.system.karmaBank?.totalSpent ?? 0) + fee
    });
    await item.update({ "system.stunts": stunts });
    ui.notifications.info(`${row.name}: attempt ${row.attempts}/10${row.mastered ? " — mastered" : ""}`);
  }

  async _onContactAssist(event) {
    event.preventDefault();
    const item = this.actor.items.get(event.currentTarget.dataset.itemId);
    if (!item) return;
    const fee = 100;
    const available = this.actor.system.karma.value ?? 0;
    if (available < fee) {
      ui.notifications.warn(`${this.actor.name} needs ${fee} Karma to develop this Contact.`);
      return;
    }
    const next = Math.min(10, Number(item.system.assistance || 0) + 1);
    await this.actor.update({
      "system.karma.value": available - fee,
      "system.karmaBank.contacts": (this.actor.system.karmaBank?.contacts ?? 0) + fee,
      "system.karmaBank.totalSpent": (this.actor.system.karmaBank?.totalSpent ?? 0) + fee
    });
    await item.update({
      "system.assistance": next,
      "system.acquired": next >= 10
    });
    ui.notifications.info(`${item.name}: assistance ${next}/10${next >= 10 ? " — acquired" : ""}`);
  }
}
