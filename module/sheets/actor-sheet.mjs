import {
  ABILITIES, RANKS, ORIGINS, BATTLE_EFFECTS, POWER_CATALOG, TALENT_CATALOG, CONTACT_TYPES,
  rankLabel, abilityNumber, initiativeModifier, MOVEMENT_AREAS, THROW_RANGE
} from "../config.mjs";
import { promptFeatRoll } from "../dice/universal-table.mjs";
import { promptGeneration } from "../chargen.mjs";
import { confirmDialog, promptForm, formValue, getTextEditor } from "../foundry-api.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export class FaseripActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["faserip", "actor"],
    position: { width: 820, height: 900 },
    form: { submitOnChange: true, closeOnSubmit: false },
    window: { resizable: true, icon: "fa-solid fa-mask" },
    actions: {
      generate: FaseripActorSheet.onGenerate,
      rollAbility: FaseripActorSheet.onRollAbility,
      rollItem: FaseripActorSheet.onRollItem,
      itemEdit: FaseripActorSheet.onItemEdit,
      itemDelete: FaseripActorSheet.onItemDelete,
      itemCreate: FaseripActorSheet.onItemCreate,
      applyDamage: FaseripActorSheet.onApplyDamage,
      heal: FaseripActorSheet.onHeal,
      recover: FaseripActorSheet.onRecover,
      naturalHeal: FaseripActorSheet.onNaturalHeal,
      resetHealth: FaseripActorSheet.onResetHealth,
      resetKarma: FaseripActorSheet.onResetKarma,
      universal: FaseripActorSheet.onUniversal,
      rollResources: FaseripActorSheet.onRollResources,
      combatFeat: FaseripActorSheet.onCombatFeat,
      editImage: FaseripActorSheet.onEditImage,
      tab: FaseripActorSheet.onTab
    }
  };

  static PARTS = {
    body: { template: "systems/faserip/templates/actor/character-sheet.hbs", scrollable: [".sheet-body"] }
  };

  get actor() { return this.document; }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor;
    context.actor = actor;
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
    const decorate = (c) => c.map((item) => ({ id: item.id, name: item.name, img: item.img, type: item.type, rankLabel: rankLabel(item.system.rank ?? "typical"), category: item.system.category ?? "" }));
    context.powers = decorate(items.filter((i) => i.type === "power"));
    context.talents = decorate(items.filter((i) => i.type === "talent"));
    context.contacts = decorate(items.filter((i) => i.type === "contact"));
    context.gear = decorate(items.filter((i) => i.type === "equipment" || i.type === "weapon"));
    const TextEditor = getTextEditor();
    context.enrichedBiography = await TextEditor.enrichHTML(actor.system.biography ?? "", { secrets: actor.isOwner });
    context.enrichedNotes = await TextEditor.enrichHTML(actor.system.notes ?? "", { secrets: actor.isOwner });
    const gen = actor.getFlag("faserip", "generation");
    context.generation = gen ? { ...gen, powerNeed: gen.powerCount?.[0] ?? 0, talentNeed: gen.talentCount?.[0] ?? 0, contactNeed: gen.contactCount?.[0] ?? 0, contactMax: gen.contactCount?.[1] ?? 0 } : null;
    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.showTab(this._activeTab ?? "powers");
  }

  showTab(tab) {
    this._activeTab = tab;
    this.element.querySelectorAll(".sheet-tabs [data-tab]").forEach((el) => el.classList.toggle("active", el.dataset.tab === tab));
    this.element.querySelectorAll(".sheet-body .tab").forEach((el) => { el.style.display = el.dataset.tab === tab ? "block" : "none"; });
  }

  static onTab(event, target) { event.preventDefault(); this.showTab(target.dataset.tab); }
  static async onGenerate(event) { event.preventDefault(); return promptGeneration(this.actor); }
  static async onRollAbility(event, target) {
    event.preventDefault();
    return promptFeatRoll({ actor: this.actor, rankId: this.actor.getAbilityRank(target.dataset.ability), label: game.i18n.localize(`FASERIP.Ability.${target.dataset.ability}`) });
  }
  static async onRollItem(event, target) {
    event.preventDefault();
    const item = this.actor.items.get(target.closest(".item")?.dataset.itemId);
    if (item) return promptFeatRoll({ actor: this.actor, rankId: item.system.rank ?? "typical", label: item.name, defaultColumn: item.system.effectsColumn ?? "" });
  }
  static onItemEdit(event, target) { event.preventDefault(); this.actor.items.get(target.closest(".item")?.dataset.itemId)?.sheet.render({ force: true }); }
  static async onItemDelete(event, target) {
    event.preventDefault();
    const item = this.actor.items.get(target.closest(".item")?.dataset.itemId);
    if (!item) return;
    if (await confirmDialog({ title: "Delete Item", content: `<p>Delete <strong>${item.name}</strong>?</p>` })) await item.delete();
  }
  static async onItemCreate(event, target) {
    event.preventDefault();
    const type = target.dataset.type;
    if (type === "power") return this.addFromCatalog("power", POWER_CATALOG);
    if (type === "talent") return this.addFromCatalog("talent", TALENT_CATALOG);
    if (type === "contact") return this.addContact();
    await this.actor.createEmbeddedDocuments("Item", [{ name: type === "weapon" ? "New Weapon" : "New Equipment", type }]);
  }
  async addFromCatalog(type, catalog) {
    const groups = Object.entries(catalog).map(([cat, list]) => `<optgroup label="${cat}">${list.map((n) => `<option value="${n.replace(/"/g, """)}">${n}</option>`).join("")}</optgroup>`).join("");
    const form = await promptForm({ title: `Add ${type}`, content: `<div class="form-group"><select name="pick"><option value="">custom</option>${groups}</select></div><div class="form-group"><input type="text" name="custom" /></div>`, okLabel: "Create" });
    if (!form) return;
    const name = formValue(form, "pick") || formValue(form, "custom") || `New ${type}`;
    const extra = { name, type };
    if (type === "power" && /body armor/i.test(name)) extra.system = { bodyArmor: true };
    if (type === "power" && /force field/i.test(name)) extra.system = { forceField: true };
    await this.actor.createEmbeddedDocuments("Item", [extra]);
  }
  async addContact() {
    const opts = CONTACT_TYPES.map((t) => `<option value="${t}">${t}</option>`).join("");
    const form = await promptForm({ title: "Add Contact", content: `<select name="type">${opts}</select><input type="text" name="name" />`, okLabel: "Create" });
    if (!form) return;
    const type = formValue(form, "type");
    await this.actor.createEmbeddedDocuments("Item", [{ name: formValue(form, "name") || type, type: "contact", system: { category: type } }]);
  }
  static async onApplyDamage(event) {
    event.preventDefault();
    const amount = Number(this.element.querySelector('[name="damageAmount"]')?.value || 0);
    if (!amount) return;
    const taken = await this.actor.applyDamage(amount, { energy: this.element.querySelector('[name="energyAttack"]')?.checked, useForceField: this.element.querySelector('[name="useForceField"]')?.checked });
    ui.notifications.info(`${this.actor.name} takes ${taken} after armor/fields.`);
  }
  static async onHeal(event) { event.preventDefault(); const amount = Number(this.element.querySelector('[name="damageAmount"]')?.value || 0); if (amount) await this.actor.heal(amount); }
  static async onRecover(event) { event.preventDefault(); await this.actor.recover(); }
  static async onNaturalHeal(event) { event.preventDefault(); await this.actor.naturalHeal({ rest: event.shiftKey }); }
  static async onResetHealth(event) { event.preventDefault(); await this.actor.update({ "system.health.value": this.actor.system.health.max, "system.condition.unconscious": false }); }
  static async onResetKarma(event) { event.preventDefault(); await this.actor.update({ "system.karma.value": this.actor.system.karma.max }); }
  static async onUniversal(event) { event.preventDefault(); return promptFeatRoll({ actor: this.actor, rankId: this.element.querySelector('[name="universalRank"]')?.value || "typical", label: "Universal Table" }); }
  static async onCombatFeat(event) {
    event.preventDefault();
    const column = this.element.querySelector('[name="combatColumn"]')?.value;
    const def = BATTLE_EFFECTS[column];
    if (def) return promptFeatRoll({ actor: this.actor, rankId: this.actor.getAbilityRank(def.ability), label: def.label, defaultColumn: column });
  }
  static async onRollResources(event) { event.preventDefault(); return promptFeatRoll({ actor: this.actor, rankId: this.actor.system.resources?.rank ?? "typical", label: "Resources" }); }
  static async onEditImage(event) {
    event.preventDefault();
    const FilePickerImpl = foundry.applications.apps.FilePicker.implementation;
    return new FilePickerImpl({ type: "image", current: this.actor.img, callback: (path) => this.actor.update({ img: path }) }).browse();
  }
}
