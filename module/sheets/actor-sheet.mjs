import {
  ABILITIES, RANKS, ORIGINS, BATTLE_EFFECTS, POWER_CATALOG, TALENT_CATALOG, CONTACT_TYPES,
  rankLabel, abilityNumber, initiativeModifier, MOVEMENT_AREAS, THROW_RANGE
} from "../config.mjs";
import { promptFeatRoll } from "../dice/universal-table.mjs";
import { promptGeneration } from "../chargen.mjs";
import { getActorSheetClass, getTextEditor, confirmDialog, promptForm, formValue } from "../foundry-api.mjs";

const ActorSheetBase = getActorSheetClass();

export class FaseripActorSheet extends ActorSheetBase {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["faserip", "sheet", "actor"],
      template: "systems/faserip/templates/actor/character-sheet.hbs",
      width: 780,
      height: 860,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "powers" }],
      dragDrop: [{ dragSelector: ".item-list .item", dropSelector: null }]
    });
  }

  async getData(options) {
    const context = await super.getData(options);
    const actor = this.actor;
    context.system = actor.system;
    context.ranks = RANKS;
    context.origins = ORIGINS.map((o) => o.label);
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
    context.healthPct = actor.system.health.max ? Math.round((actor.system.health.value / actor.system.health.max) * 100) : 0;
    context.karmaPct = actor.system.karma.max ? Math.round((actor.system.karma.value / actor.system.karma.max) * 100) : 0;
    const items = actor.items.contents;
    const decorate = (collection) => collection.map((item) => ({
      id: item.id, name: item.name, img: item.img, type: item.type,
      rankLabel: rankLabel(item.system.rank ?? "typical"),
      category: item.system.category ?? ""
    }));
    context.powers = decorate(items.filter((i) => i.type === "power"));
    context.talents = decorate(items.filter((i) => i.type === "talent"));
    context.contacts = decorate(items.filter((i) => i.type === "contact"));
    context.gear = decorate(items.filter((i) => i.type === "equipment" || i.type === "weapon"));
    const TextEditor = getTextEditor();
    context.enrichedBiography = await TextEditor.enrichHTML(actor.system.biography ?? "", { secrets: actor.isOwner });
    context.enrichedNotes = await TextEditor.enrichHTML(actor.system.notes ?? "", { secrets: actor.isOwner });
    const gen = actor.getFlag("faserip", "generation");
    context.generation = gen ? {
      ...gen,
      powerNeed: gen.powerCount?.[0] ?? 0,
      talentNeed: gen.talentCount?.[0] ?? 0,
      contactNeed: gen.contactCount?.[0] ?? 0,
      contactMax: gen.contactCount?.[1] ?? 0
    } : null;
    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;
    html.find("[data-action='roll-ability']").on("click", this._onRollAbility.bind(this));
    html.find("[data-action='roll-item']").on("click", this._onRollItem.bind(this));
    html.find("[data-action='item-edit']").on("click", this._onItemEdit.bind(this));
    html.find("[data-action='item-delete']").on("click", this._onItemDelete.bind(this));
    html.find("[data-action='item-create']").on("click", this._onItemCreate.bind(this));
    html.find("[data-action='apply-damage']").on("click", this._onApplyDamage.bind(this));
    html.find("[data-action='heal']").on("click", this._onHeal.bind(this));
    html.find("[data-action='recover']").on("click", this._onRecover.bind(this));
    html.find("[data-action='natural-heal']").on("click", this._onNaturalHeal.bind(this));
    html.find("[data-action='reset-health']").on("click", this._onResetHealth.bind(this));
    html.find("[data-action='reset-karma']").on("click", this._onResetKarma.bind(this));
    html.find("[data-action='universal']").on("click", this._onUniversal.bind(this));
    html.find("[data-action='roll-resources']").on("click", this._onRollResources.bind(this));
    html.find("[data-action='generate']").on("click", this._onGenerate.bind(this));
    html.find("[data-action='combat-feat']").on("click", this._onCombatFeat.bind(this));
  }

  async _onRollAbility(event) {
    event.preventDefault();
    const ability = event.currentTarget.dataset.ability;
    return promptFeatRoll({ actor: this.actor, rankId: this.actor.getAbilityRank(ability), label: game.i18n.localize(`FASERIP.Ability.${ability}`) });
  }

  async _onRollItem(event) {
    event.preventDefault();
    const item = this.actor.items.get(event.currentTarget.closest(".item")?.dataset.itemId);
    if (!item) return;
    return promptFeatRoll({ actor: this.actor, rankId: item.system.rank ?? "typical", label: item.name, defaultColumn: item.system.effectsColumn ?? "" });
  }

  _onItemEdit(event) {
    event.preventDefault();
    this.actor.items.get(event.currentTarget.closest(".item")?.dataset.itemId)?.sheet.render(true);
  }

  async _onItemDelete(event) {
    event.preventDefault();
    const item = this.actor.items.get(event.currentTarget.closest(".item")?.dataset.itemId);
    if (!item) return;
    const ok = await confirmDialog({ title: "Delete Item", content: `<p>Delete <strong>${item.name}</strong>?</p>` });
    if (ok) await item.delete();
  }

  async _onItemCreate(event) {
    event.preventDefault();
    const type = event.currentTarget.dataset.type;
    if (type === "power") return this._createFromCatalog("power", POWER_CATALOG);
    if (type === "talent") return this._createFromCatalog("talent", TALENT_CATALOG);
    if (type === "contact") return this._createContact();
    await this.actor.createEmbeddedDocuments("Item", [{ name: type === "weapon" ? "New Weapon" : "New Equipment", type }]);
  }

  async _createFromCatalog(type, catalog) {
    const groups = Object.entries(catalog).map(([cat, list]) => {
      const opts = list.map((n) => `<option value="${n.replace(/"/g, """)}">${n}</option>`).join("");
      return `<optgroup label="${cat}">${opts}</optgroup>`;
    }).join("");
    const form = await promptForm({
      title: `Add ${type}`,
      content: `<div class="form-group"><label>Catalog</label><select name="pick"><option value="">custom</option>${groups}</select></div><div class="form-group"><label>Custom name</label><input type="text" name="custom" /></div>`,
      okLabel: "Create"
    });
    if (!form) return;
    const name = formValue(form, "pick") || formValue(form, "custom") || `New ${type}`;
    const extra = { name, type };
    if (type === "power" && /body armor/i.test(name)) extra.system = { bodyArmor: true };
    if (type === "power" && /force field/i.test(name)) extra.system = { forceField: true };
    await this.actor.createEmbeddedDocuments("Item", [extra]);
  }

  async _createContact() {
    const opts = CONTACT_TYPES.map((t) => `<option value="${t}">${t}</option>`).join("");
    const form = await promptForm({
      title: "Add Contact",
      content: `<div class="form-group"><label>Type</label><select name="type">${opts}</select></div><div class="form-group"><label>Name</label><input type="text" name="name" /></div>`,
      okLabel: "Create"
    });
    if (!form) return;
    const type = formValue(form, "type");
    const name = formValue(form, "name");
    await this.actor.createEmbeddedDocuments("Item", [{ name: name || type, type: "contact", system: { category: type } }]);
  }

  async _onApplyDamage(event) {
    event.preventDefault();
    const amount = Number(this.element.find('[name="damageAmount"]').val() || 0);
    const energy = this.element.find('[name="energyAttack"]').is(":checked");
    const useForceField = this.element.find('[name="useForceField"]').is(":checked");
    if (amount) {
      const taken = await this.actor.applyDamage(amount, { energy, useForceField });
      ui.notifications.info(`${this.actor.name} takes ${taken} after armor/fields.`);
    }
  }

  async _onHeal(event) {
    event.preventDefault();
    const amount = Number(this.element.find('[name="damageAmount"]').val() || 0);
    if (amount) await this.actor.heal(amount);
  }

  async _onRecover(event) { event.preventDefault(); await this.actor.recover(); }
  async _onNaturalHeal(event) { event.preventDefault(); await this.actor.naturalHeal({ rest: event.shiftKey }); }
  async _onResetHealth(event) {
    event.preventDefault();
    await this.actor.update({ "system.health.value": this.actor.system.health.max, "system.condition.unconscious": false });
  }
  async _onResetKarma(event) {
    event.preventDefault();
    await this.actor.update({ "system.karma.value": this.actor.system.karma.max });
  }
  async _onUniversal(event) {
    event.preventDefault();
    return promptFeatRoll({ actor: this.actor, rankId: this.element.find('[name="universalRank"]').val() || "typical", label: "Universal Table" });
  }
  async _onCombatFeat(event) {
    event.preventDefault();
    const column = this.element.find('[name="combatColumn"]').val();
    const def = BATTLE_EFFECTS[column];
    if (!def) return;
    return promptFeatRoll({ actor: this.actor, rankId: this.actor.getAbilityRank(def.ability), label: def.label, defaultColumn: column });
  }
  async _onRollResources(event) {
    event.preventDefault();
    return promptFeatRoll({ actor: this.actor, rankId: this.actor.system.resources?.rank ?? "typical", label: "Resources" });
  }
  async _onGenerate(event) {
    event.preventDefault();
    return promptGeneration(this.actor);
  }
}
