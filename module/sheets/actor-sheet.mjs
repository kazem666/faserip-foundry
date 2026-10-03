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
  MOVEMENT_AREAS,
  THROW_RANGE
} from "../config.mjs";
import { promptFeatRoll } from "../dice/universal-table.mjs";
import { toggleUniversalTable } from "../apps/universal-table-app.mjs";
import { promptJudgeAward } from "../play.mjs";
import { formatPending, readPending } from "../play-rules.mjs";
import { describeItemAction, rollItemAction, rollStandardAction, sheetActionGroups } from "../item-actions.mjs";
import { playComicHit } from "../comic-hit.mjs";
import { formatMovement, movementLines } from "../movement.mjs";
import { promptGeneration } from "../chargen.mjs";
import { isUpbEnabled, upbCatalogGroups, UPB_ORIGINS_OF_POWER, UPB_PHYSICAL_FORMS } from "../data/upb.mjs";
import { isUltimateTalentsEnabled, ULTIMATE_TALENT_CATEGORIES, ULTIMATE_TALENT_CATALOG } from "../data/ultimate-talents.mjs";
import { ultimateCatalog } from "../data/ultimate-list.mjs";
import { buildCatalogItemData } from "../data/descriptions.mjs";
import { confirmDialog, promptForm, formValue, getActorSheetClass, getTextEditor } from "../foundry-api.mjs";

const ActorSheetBase = getActorSheetClass();

function itemIdFrom(event) {
  const el = event.currentTarget || event.target;
  return el?.closest?.("[data-item-id]")?.dataset?.itemId || el?.dataset?.itemId || "";
}

function optionList(list) {
  return list.map((n) => "<option value='" + String(n) + "'>" + n + "</option>").join("");
}

function guardSheetUpdate(actor, formData) {
  if (!formData) return formData;
  const rolled = actor?.getFlag?.("faserip", "rolledStats") || actor?.flags?.faserip?.rolledStats;
    if (rolled?.abilities && formData) {
      const stale = ABILITIES.filter((key) => {
        const rank = formData[`system.abilities.${key}.rank`] ?? formData.system?.abilities?.[key]?.rank;
        return rank && rolled.abilities[key] && rank !== rolled.abilities[key];
      });
      if (stale.length >= 3) {
        for (const key of stale) {
          const number = rolled.numbers?.[key];
          if (formData[`system.abilities.${key}.rank`] != null || formData.system?.abilities?.[key] == null) {
            formData[`system.abilities.${key}.rank`] = rolled.abilities[key];
            if (number != null) formData[`system.abilities.${key}.number`] = Number(number);
          }
          if (formData.system?.abilities?.[key]) {
            formData.system.abilities[key].rank = rolled.abilities[key];
            if (number != null) formData.system.abilities[key].number = Number(number);
          }
        }
      }
    }
    const pool = (keys) => keys.reduce((sum, key) => {
      const number = Number(formData?.[`system.abilities.${key}.number`] ?? formData?.system?.abilities?.[key]?.number ?? 0);
      const rank = formData?.[`system.abilities.${key}.rank`] ?? formData?.system?.abilities?.[key]?.rank;
      return sum + abilityNumber({ rank, number });
    }, 0);
    const sourceHealth = actor?._source?.system?.health || {};
    const sourceKarma = actor?._source?.system?.karma || {};
    const phys = pool(["fighting", "agility", "strength", "endurance"]);
    const ment = pool(["reason", "intuition", "psyche"]);
    const submittedHealth = Number(formData?.["system.health.value"]);
    const submittedKarma = Number(formData?.["system.karma.value"]);
    if (formData && Number(sourceHealth.value) === Number(sourceHealth.max) && phys > 0 && submittedHealth === Number(sourceHealth.value)) {
      const mult = actor.getFlag?.("faserip", "doubleHealth") ? 2 : 1;
      formData["system.health.value"] = phys * mult;
    }
    if (formData && Number(sourceKarma.value) === Number(sourceKarma.max) && ment > 0 && submittedKarma === Number(sourceKarma.value)) {
      formData["system.karma.value"] = ment;
    }
  return formData;
}

export async function fillActorSheetContext(sheet, context) {
    const actor = sheet.actor;
      context.actor = actor;
      context.system = actor.system;
      context.ranks = RANKS;
      context.origins = [
        ...ORIGINS.map((o) => o.label),
        ...UPB_ORIGINS_OF_POWER.map((o) => o.label),
        ...UPB_PHYSICAL_FORMS.map((o) => o.label)
      ];
      context.initMod = actor.getInitiativeMod();
      context.pendingText = formatPending(readPending(actor));
      context.isGM = !!game.user?.isGM;
      const pace = movementLines(actor);
      context.movement = MOVEMENT_AREAS[actor.getAbilityRank("endurance")] ?? 2;
      context.movementText = pace.walk;
      context.movementModes = pace.extra;
      context.feetPerArea = pace.feetPerArea;
      context.squaresPerArea = Number.isInteger(pace.squaresPerArea) ? pace.squaresPerArea : Math.round(pace.squaresPerArea * 10) / 10;
      context.throwRange = THROW_RANGE[actor.getAbilityRank("strength")] ?? 1;
      context.throwText = formatMovement(context.throwRange);
      context.bodyArmor = actor.getBodyArmor();
      context.forceField = actor.getForceField();
      context.healRate = actor.getAbilityNumber("endurance");
      context.resourceCache = Number(actor.getFlag?.("faserip", "resourceCache") || 0);
      try {
        const { magicStudyNote } = await import("../magic.mjs");
        context.magicStudyNote = magicStudyNote(actor);
      } catch {
        context.magicStudyNote = "";
      }
      context.combatColumns = Object.entries(BATTLE_EFFECTS).map(([id, col]) => ({ id, label: col.label }));
      context.abilities = ABILITIES.map((key) => {
        const rank = actor.getAbilityRank(key);
        return {
          key,
          label: game.i18n.localize(`FASERIP.Ability.${key}`),
          abbr: game.i18n.localize(`FASERIP.AbilityAbbr.${key}`),
          rank,
          number: actor.getAbilityNumber(key),
          rankLabel: rankLabel(rank),
          options: RANKS.map((r) => ({ ...r, selected: r.id === rank }))
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
      const decorate = (collection) => collection.map((item) => {
        const spec = describeItemAction(item);
        return {
        id: item.id,
        name: item.name,
        img: item.img,
        type: item.type,
        rankLabel: rankLabel(item.system.rank ?? "typical"),
        weaponType: item.system.weaponType ?? "",
        damage: item.system.damage ?? "",
        effectsColumn: item.system.effectsColumn ?? "",
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
        actionLabel: spec.label,
        actionTitle: spec.title,
        pips: pips(item.system.assistance),
        stunts: (item.system.stunts ?? []).map((s, index) => ({
          ...s,
          index,
          pips: pips(s.attempts)
        }))
      };
      });
      context.powers = decorate(items.filter((i) => i.type === "power"));
      context.talents = decorate(items.filter((i) => i.type === "talent"));
      context.contacts = decorate(items.filter((i) => i.type === "contact"));
      context.gear = decorate(items.filter((i) => i.type === "equipment" || i.type === "weapon"));
      context.actionGroups = sheetActionGroups(items, actor);
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
      const talentsOn = isUltimateTalentsEnabled() || !!gen?.ultimateTalents;
      context.talentCatalog = talentsOn
        ? ULTIMATE_TALENT_CATEGORIES.map((cat) => ({
          id: cat.id,
          label: cat.label,
          items: (ULTIMATE_TALENT_CATALOG[cat.id] || []).map((row) => row.name)
        }))
        : Object.entries(TALENT_CATALOG).map(([id, list]) => ({
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
      context.editable = sheet.isEditable;
      const battle = actor.getFlag("faserip", "battle");
      const { describeCondition } = await import("../battle-results.mjs");
      context.conditionText = describeCondition(actor);
      context.conditionDying = battle?.state === "dying";
      context.conditionHours = battle?.state === "unconscious" && battle?.unit === "hours";
      context.groupMember = !!actor.getFlag("faserip", "groupMember");
      try { context.groupKarma = game.settings.get("faserip", "groupKarma") || 0; } catch { context.groupKarma = 0; }
      const situationMod = await import("../situation.mjs");
      context.situations = situationMod.SITUATIONS;
      context.situation = situationMod.currentSituation().id;
      context.poisoned = !!actor.getFlag("faserip", "poison");
  return context;
}

class FaseripActorSheetLegacy extends ActorSheetBase {
  static get defaultOptions() {
    const base = foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["faserip", "sheet", "actor"],
      template: "systems/faserip/templates/actor/character-sheet.hbs",
      width: 900,
      height: 820,
      resizable: true,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "record" }],
      dragDrop: [{ dragSelector: ".item, .record-card", dropSelector: null }],
      submitOnChange: true,
      submitOnClose: false
    });
    return base;
  }

  get actor() {
    return this.document ?? super.actor;
  }

  async _updateObject(event, formData) {
    guardSheetUpdate(this.actor, formData);
    return super._updateObject(event, formData);
  }

  async getData(options) {
    const context = await super.getData(options);
    try {
      await fillActorSheetContext(this, context);
    } catch (err) {
      console.error("FASERIP | actor sheet getData failed", err);
      ui.notifications?.error(`FASERIP sheet data error: ${err.message}`);
    }
    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);
    const root = html instanceof HTMLElement ? html : html?.[0] ?? this.element?.[0] ?? this.element;
    const on = (action, fn) => {
      const bound = fn.bind(this);
      if (html?.find) {
        html.find(`[data-action='${action}']`).on("click", bound);
        return;
      }
      root?.querySelectorAll?.(`[data-action='${action}']`)?.forEach((el) => el.addEventListener("click", bound));
    };
    on("toggleTable", this._onToggleTable);
    on("award", this._onAward);
    if (!this.isEditable) return;
    on("generate", this._onGenerate);
    on("rollAbility", this._onRollAbility);
    on("rollItem", this._onRollItem);
    on("rollSheetAction", this._onRollSheetAction);
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
    on("rollHeight", this._onRollHeight);
    on("rollCalling", this._onRollCalling);
    on("rollQuirk", this._onRollQuirk);
    on("rollLife", this._onRollLife);
    on("rollPopularity", this._onRollPopularity);
    on("fallImpact", this._onFall);
    on("catchFall", this._onCatch);
    on("holdOn", this._onHoldOn);
    on("dyingFeat", this._onDyingFeat);
    on("aidDying", this._onAid);
    on("hourPasses", this._onHour);
    on("clearCondition", this._onClearCondition);
    on("tickCondition", this._onTickCondition);
    on("bankKarma", this._onBankKarma);
    on("toggleGroup", this._onToggleGroup);
    on("advanceAbility", this._onAdvanceAbility);
    on("advancePower", this._onAdvancePower);
    on("advanceResources", this._onAdvanceResources);
    on("advancePopularity", this._onAdvancePopularity);
    on("addPower", this._onAddPower);
    on("addTalent", this._onAddTalent);
    on("addContact", this._onAddContact);
    on("setSituation", this._onSetSituation);
    on("randomEvent", this._onRandomEvent);
    on("holdBreath", this._onHoldBreath);
    on("drown", this._onDrown);
    on("poison", this._onPoison);
    on("treatPoison", this._onTreatPoison);
    on("escapeFate", this._onEscapeFate);
    on("askContact", this._onAskContact);
  }

  async _onGenerate(event) {
    event.preventDefault();
    return promptGeneration(this.actor);
  }

  async _onRollHeight(event) {
    event.preventDefault();
    const { writeHeightWeight } = await import("../life.mjs");
    return writeHeightWeight(this.actor);
  }

  async _onRollCalling(event) {
    event.preventDefault();
    const { writeCalling } = await import("../life.mjs");
    return writeCalling(this.actor);
  }

  async _onRollQuirk(event) {
    event.preventDefault();
    const { writeQuirk } = await import("../life.mjs");
    return writeQuirk(this.actor);
  }

  async _onRollLife(event) {
    event.preventDefault();
    const { writeLifeDetails } = await import("../life.mjs");
    return writeLifeDetails(this.actor);
  }

  async _onRollAbility(event) {
    event.preventDefault();
    const ability = event.currentTarget.dataset.ability;
    return promptFeatRoll({
      actor: this.actor,
      ability,
      rankId: this.actor.getAbilityRank(ability),
      label: game.i18n.localize(`FASERIP.Ability.${ability}`)
    });
  }

  async _onRollItem(event) {
    event.preventDefault();
    const item = this.actor.items.get(itemIdFrom(event));
    if (!item) return;
    return rollItemAction(this.actor, item, { dialog: !!event.shiftKey });
  }

  async _onRollSheetAction(event) {
    event.preventDefault();
    const standard = event.currentTarget?.dataset?.standard;
    if (standard) return rollStandardAction(this.actor, standard, { dialog: !!event.shiftKey });
    const item = this.actor.items.get(itemIdFrom(event));
    if (!item) return;
    return rollItemAction(this.actor, item, { dialog: !!event.shiftKey });
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
      const catalog = { ...POWER_CATALOG, ...ultimateCatalog() };
      if (isUpbEnabled() || this.actor.getFlag("faserip", "generation")?.upb) {
        for (const group of upbCatalogGroups()) catalog["UPB " + group.label] = group.items;
      }
      return this.createFromCatalog("power", catalog);
    }
    if (type === "talent") {
      const talentsOn = isUltimateTalentsEnabled() || !!this.actor.getFlag("faserip", "generation")?.ultimateTalents;
      if (!talentsOn) return this.createFromCatalog("talent", TALENT_CATALOG);
      const catalog = {};
      for (const cat of ULTIMATE_TALENT_CATEGORIES) {
        catalog[cat.label] = (ULTIMATE_TALENT_CATALOG[cat.id] || []).map((row) => row.name);
      }
      return this.createFromCatalog("talent", catalog);
    }
    if (type === "contact") return this.createContact();
    await this.actor.createEmbeddedDocuments("Item", [{
      name: type === "weapon" ? "New Weapon" : "New Equipment",
      type
    }]);
  }

  async createFromCatalog(type, catalog) {
    const groups = Object.entries(catalog).map(([cat, list]) => {
      return "<optgroup label='" + cat + "'>" + optionList(list) + "</optgroup>";
    }).join("");
    const form = await promptForm({
      title: "Add " + type,
      content: "<div class='form-group'><label>Catalog</label><select name='pick'><option value=''>custom</option>" + groups + "</select></div><div class='form-group'><label>Custom name</label><input type='text' name='custom' /></div>",
      okLabel: "Create"
    });
    if (!form) return;
    const name = formValue(form, "pick") || formValue(form, "custom") || ("New " + type);
    if (type === "power" || type === "talent") {
      await this.actor.createEmbeddedDocuments("Item", [buildCatalogItemData(type, name)]);
      return;
    }
    await this.actor.createEmbeddedDocuments("Item", [{ name, type, system: {} }]);
  }

  async createContact() {
    const opts = optionList(CONTACT_TYPES);
    const form = await promptForm({
      title: "Add Contact",
      content: "<div class='form-group'><label>Type</label><select name='type'>" + opts + "</select></div><div class='form-group'><label>Name</label><input type='text' name='name' /></div>",
      okLabel: "Create"
    });
    if (!form) return;
    const type = formValue(form, "type");
    const name = formValue(form, "name");
    await this.actor.createEmbeddedDocuments("Item", [{ name: name || type, type: "contact", system: { category: type, occupation: type } }]);
  }

  _formEl(name) {
    const root = this.element?.[0] ?? this.element;
    return root?.querySelector?.("[name=\"" + name + "\"]");
  }

  async _onApplyDamage(event) {
    event.preventDefault();
    const amount = Number(this._formEl("damageAmount")?.value || 0);
    const energy = this._formEl("energyAttack")?.checked;
    const useForceField = this._formEl("useForceField")?.checked;
    if (amount) {
      const taken = await this.actor.applyDamage(amount, { energy, useForceField });
      ui.notifications.info(this.actor.name + " takes " + taken + " after armor/fields.");
      playComicHit({ targetUuid: this.actor.uuid, taken, effect: "Hit" });
      if (Number(this.actor.system?.health?.value) === 0) {
        const { collapseAtZero } = await import("../battle-results.mjs");
        await collapseAtZero(this.actor);
      }
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
    }, { faseripHeal: true });
    const { releaseIfConscious } = await import("../battle-results.mjs");
    await releaseIfConscious(this.actor);
  }

  async _onResetKarma(event) {
    event.preventDefault();
    await this.actor.update({ "system.karma.value": this.actor.system.karma.max });
  }

  _onToggleTable(event) {
    event.preventDefault();
    return toggleUniversalTable();
  }

  _onAward(event) {
    event.preventDefault();
    return promptJudgeAward([this.actor.id]);
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
      ability: def.ability,
      rankId: this.actor.getAbilityRank(def.ability),
      label: def.label,
      defaultColumn: column
    });
  }

  async _onRollResources(event) {
    event.preventDefault();
    const { resourcesUsed, stampResources } = await import("../clock.mjs");
    if (resourcesUsed(this.actor)) {
      ui.notifications?.warn(`${this.actor.name} already called on Resources this week.`);
      return;
    }
    const rolled = await promptFeatRoll({
      actor: this.actor,
      rankId: this.actor.system.resources?.rank ?? "typical",
      label: "Resources",
      karmaMode: "resources"
    });
    if (rolled) await stampResources(this.actor);
    return rolled;
  }

  async _onRollPopularity(event) {
    event.preventDefault();
    const { rankFromNumber } = await import("../config.mjs");
    const score = Number(this.actor.system?.popularity?.value || 0);
    return promptFeatRoll({
      actor: this.actor,
      rankId: rankFromNumber(Math.max(0, score)),
      label: "Popularity",
      karmaMode: "none"
    });
  }

  async _onFall(event) {
    event.preventDefault();
    const { promptFall } = await import("../battle-results.mjs");
    return promptFall(this.actor);
  }

  async _onCatch(event) {
    event.preventDefault();
    const { promptCatch } = await import("../battle-results.mjs");
    return promptCatch(this.actor);
  }

  async _onHoldOn(event) {
    event.preventDefault();
    const { holdOn } = await import("../battle-results.mjs");
    return holdOn(this.actor);
  }

  async _onDyingFeat(event) {
    event.preventDefault();
    const { buyEnduranceFeat } = await import("../battle-results.mjs");
    return buyEnduranceFeat(this.actor);
  }

  async _onAid(event) {
    event.preventDefault();
    const { aidDying } = await import("../battle-results.mjs");
    return aidDying(this.actor);
  }

  async _onHour(event) {
    event.preventDefault();
    const { hourPasses } = await import("../battle-results.mjs");
    return hourPasses(this.actor);
  }

  async _onClearCondition(event) {
    event.preventDefault();
    const { clearCondition } = await import("../battle-results.mjs");
    return clearCondition(this.actor);
  }

  async _onTickCondition(event) {
    event.preventDefault();
    const { tickOne } = await import("../battle-results.mjs");
    return tickOne(this.actor, { force: true });
  }

  async _onBankKarma(event) {
    event.preventDefault();
    const { bankKarma } = await import("../advancement.mjs");
    return bankKarma(this.actor);
  }

  async _onToggleGroup(event) {
    event.preventDefault();
    const { toggleGroupMember } = await import("../advancement.mjs");
    return toggleGroupMember(this.actor);
  }

  async _onAdvanceAbility(event) {
    event.preventDefault();
    const { promptAbilityAdvance } = await import("../advancement.mjs");
    return promptAbilityAdvance(this.actor);
  }

  async _onAdvancePower(event) {
    event.preventDefault();
    const { promptPowerAdvance } = await import("../advancement.mjs");
    return promptPowerAdvance(this.actor);
  }

  async _onAdvanceResources(event) {
    event.preventDefault();
    const { promptResourceAdvance } = await import("../advancement.mjs");
    return promptResourceAdvance(this.actor);
  }

  async _onAdvancePopularity(event) {
    event.preventDefault();
    const { promptPopularityAdvance } = await import("../advancement.mjs");
    return promptPopularityAdvance(this.actor);
  }

  async _onAddPower(event) {
    event.preventDefault();
    const { promptPowerAdd } = await import("../advancement.mjs");
    return promptPowerAdd(this.actor);
  }

  async _onAddTalent(event) {
    event.preventDefault();
    const { promptTalentAdd } = await import("../advancement.mjs");
    return promptTalentAdd(this.actor);
  }

  async _onAddContact(event) {
    event.preventDefault();
    const { promptContactAdd } = await import("../advancement.mjs");
    return promptContactAdd(this.actor);
  }

  async _onLearnWorking(event) {
    event.preventDefault();
    const { promptLearnWorking } = await import("../magic.mjs");
    return promptLearnWorking(this.actor);
  }

  async _onStudyWorking(event) {
    event.preventDefault();
    const { promptStudyWorking } = await import("../magic.mjs");
    return promptStudyWorking(this.actor);
  }

  async _onRefineWorking(event) {
    event.preventDefault();
    const { promptRefineWorking } = await import("../magic.mjs");
    return promptRefineWorking(this.actor);
  }

  async _onDrawCache(event) {
    event.preventDefault();
    const { promptDrawCache } = await import("../magic.mjs");
    return promptDrawCache(this.actor);
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
    const name = raw.replace(/\s*\(counts as two(?: powers?)?\)\s*$/i, "").trim() || ("New " + type);
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
      title: "New stunt - " + item.name,
      content: "<div class='form-group'><label>Stunt name</label><input name='name' type='text' /></div><div class='form-group'><label>Rank</label><input name='rank' type='text' /></div><div class='form-group'><label>Description</label><input name='description' type='text' /></div>",
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
      ui.notifications.warn(this.actor.name + " needs " + fee + " Karma for this stunt attempt.");
      return;
    }
    const stunts = foundry.utils.deepClone(item.system.stunts ?? []);
    const row = stunts[idx];
    if (!row || row.mastered) return;
    const bank = this.actor.system.karmaBank ?? {};
    await this.actor.update({
      "system.karma.value": available - fee,
      "system.karmaBank.powers": (bank.powers ?? 0) + fee,
      "system.karmaBank.totalSpent": (bank.totalSpent ?? 0) + fee
    });
    const message = await promptFeatRoll({
      actor: this.actor,
      rankId: item.system.rank || "typical",
      label: `${item.name}: ${row.name}`,
      ability: "powers"
    });
    const color = message?.flags?.faserip?.color || message?.getFlag?.("faserip", "color") || "";
    if (!message || color === "white") {
      await this.actor.update({
        "system.karma.value": available,
        "system.karmaBank.powers": bank.powers ?? 0,
        "system.karmaBank.totalSpent": bank.totalSpent ?? 0
      });
      ui.notifications.info(`${row.name} does not work. The 100 Karma is returned.`);
      return;
    }
    row.attempts = Math.min(10, Number(row.attempts || 0) + 1);
    if (row.attempts >= 10) row.mastered = true;
    await item.update({ "system.stunts": stunts });
    const verdict = {
      green: "does not work, and that much is clear.",
      yellow: "might work, but only in a specific condition.",
      red: "works. The Judge sets what it does."
    }[color] || "is attempted.";
    ui.notifications.info(`${row.name} ${verdict} Attempt ${row.attempts}/10.`);
  }

  async _onAskContact(event) {
    event.preventDefault();
    const item = this.actor.items.get(event.currentTarget.dataset.itemId);
    if (!item) return;
    ui.notifications.info(`The Judge checks ${item.name} in private.`);
    return promptFeatRoll({
      actor: this.actor,
      rankId: (await import("../config.mjs")).rankFromNumber(Math.max(0, Number(this.actor.system?.popularity?.value || 0))),
      label: `Contact: ${item.name}`,
      karmaMode: "none",
      whisperGM: true
    });
  }

  async _onSetSituation(event) {
    event.preventDefault();
    const { setSituation } = await import("../situation.mjs");
    return setSituation(this._formEl("situationId")?.value || "");
  }

  async _onRandomEvent(event) {
    event.preventDefault();
    const { rollRandomEvent } = await import("../situation.mjs");
    return rollRandomEvent();
  }

  async _onHoldBreath(event) {
    event.preventDefault();
    if (this.actor.getFlag("faserip", "waterBreath") || this.actor.getFlag("faserip", "lifeSupport")) {
      ui.notifications?.info(`${this.actor.name} does not need to hold a breath.`);
      return;
    }
    const held = Number(this.actor.getFlag("faserip", "breath") || 0) + 1;
    await this.actor.setFlag("faserip", "breath", held);
    const { rankFromNumber } = await import("../config.mjs");
    return promptFeatRoll({
      actor: this.actor,
      rankId: this.actor.getAbilityRank("endurance"),
      label: `Holding breath, round ${held}`,
      ability: "endurance",
      defaultIntensity: rankFromNumber(held)
    });
  }

  async _onDrown(event) {
    event.preventDefault();
    if (this.actor.getFlag("faserip", "waterBreath") || this.actor.getFlag("faserip", "lifeSupport")) {
      ui.notifications?.info(`${this.actor.name} keeps breathing.`);
      return;
    }
    const message = await promptFeatRoll({
      actor: this.actor,
      rankId: this.actor.getAbilityRank("endurance"),
      label: "Drowning",
      ability: "endurance",
      defaultIntensity: "monstrous"
    });
    const pass = message?.flags?.faserip?.intensityPass;
    if (message && pass === false) {
      const { dropEndurance } = await import("../battle-results.mjs");
      await dropEndurance(this.actor, "");
    }
  }

  async _onPoison(event) {
    event.preventDefault();
    const { RANKS } = await import("../config.mjs");
    const options = RANKS.map((rank) => `<option value="${rank.id}" ${rank.id === "excellent" ? "selected" : ""}>${rank.label}</option>`).join("");
    const form = await promptForm({
      title: "Poison",
      okLabel: "Roll",
      content: `<form><p class="hint">Failure means 1–10 rounds unconscious and one Endurance rank lost. Health does not return until the poison is treated.</p><div class="form-group"><label>Intensity</label><select name="rank">${options}</select></div></form>`
    });
    if (!form) return;
    const intensityId = formValue(form, "rank") || "excellent";
    const { resistHarm } = await import("../resistances.mjs");
    const warded = resistHarm(this.actor, { name: "Poison", rankId: intensityId, tags: ["toxin"] });
    if (warded.result === "cancel") {
      ui.notifications?.info(warded.note);
      return;
    }
    const message = await promptFeatRoll({
      actor: this.actor,
      rankId: this.actor.getAbilityRank("endurance"),
      label: "Poison",
      ability: "endurance",
      defaultIntensity: intensityId
    });
    if (!message || message.flags?.faserip?.intensityPass !== false) return;
    const rounds = (await new Roll("1d10").evaluate({ allowInteractive: false })).total;
    await this.actor.setFlag("faserip", "poison", { intensityId, rounds });
    await this.actor.update({ "system.condition.unconscious": true });
    const { dropEndurance } = await import("../battle-results.mjs");
    await dropEndurance(this.actor, "");
    ui.notifications.warn(`${this.actor.name} is poisoned and unconscious for ${rounds} rounds.`);
  }

  async _onTreatPoison(event) {
    event.preventDefault();
    if (!this.actor.getFlag("faserip", "poison")) {
      ui.notifications.info(`${this.actor.name} is not poisoned.`);
      return;
    }
    const skilled = [...this.actor.items].some((item) => item.type === "talent" && /first aid|medicine/i.test(item.name || ""));
    if (!skilled && !game.user?.isGM) {
      ui.notifications.warn("Treating poison takes First Aid, Medicine, or the Judge.");
      return;
    }
    await this.actor.unsetFlag("faserip", "poison");
    ui.notifications.info(`${this.actor.name} is no longer poisoned.`);
  }

  async _onEscapeFate(event) {
    event.preventDefault();
    const karma = Number(this.actor.system?.karma?.value || 0);
    if (karma <= 100) {
      ui.notifications.warn(`${this.actor.name} needs more than 100 Karma to spend down to the escape reserve.`);
      return;
    }
    await this.actor.update({ "system.karma.value": 100 });
    ui.notifications.info(`${this.actor.name} spends Karma down to 100 trying to escape.`);
  }

  async _onContactAssist(event) {
    event.preventDefault();
    const item = this.actor.items.get(event.currentTarget.dataset.itemId);
    if (!item) return;
    const fee = 100;
    const available = this.actor.system.karma.value ?? 0;
    if (available < fee) {
      ui.notifications.warn(this.actor.name + " needs " + fee + " Karma to develop this Contact.");
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
    ui.notifications.info(item.name + ": assistance " + next + "/10");
  }
}

function showSheetTab(root, tab) {
  if (!root?.querySelectorAll) return;
  root.querySelectorAll(".sheet-tabs [data-tab]").forEach((el) => {
    el.classList.toggle("active", el.dataset.tab === tab);
  });
  root.querySelectorAll(".sheet-body > .tab").forEach((el) => {
    el.classList.toggle("active", el.dataset.tab === tab);
  });
}

export function buildActorSheetClass() {
  const Mixin = globalThis.foundry?.applications?.api?.HandlebarsApplicationMixin;
  const V2 = globalThis.foundry?.applications?.sheets?.ActorSheetV2;
  if (typeof Mixin !== "function" || typeof V2 !== "function") return FaseripActorSheetLegacy;
  const actions = {
    sheetTab(event, target) {
      event?.preventDefault?.();
      const tab = target?.dataset?.tab || "record";
      this._faseripTab = tab;
      showSheetTab(this.element, tab);
    }
  };
  for (const key of Object.getOwnPropertyNames(FaseripActorSheetLegacy.prototype)) {
    if (!key.startsWith("_on")) continue;
    const action = key.slice(3, 4).toLowerCase() + key.slice(4);
    actions[action] = function (event, target) {
      if (event && target) {
        try { Object.defineProperty(event, "currentTarget", { configurable: true, value: target }); } catch { /* use the event target */ }
      }
      return FaseripActorSheetLegacy.prototype[key].call(this, event);
    };
  }
  return class FaseripActorSheet extends Mixin(V2) {
    static DEFAULT_OPTIONS = {
      classes: ["faserip", "sheet", "actor"],
      tag: "form",
      position: { width: 900, height: 820 },
      window: { resizable: true, icon: "fa-solid fa-mask" },
      form: { submitOnChange: true, closeOnSubmit: false },
      actions,
      dragDrop: [{ dragSelector: ".item, .record-card", dropSelector: null }]
    };

    static PARTS = {
      body: {
        template: "systems/faserip/templates/actor/character-sheet.hbs",
        scrollable: [""]
      }
    };

    async _prepareContext(options) {
      const context = await super._prepareContext(options);
      try {
        await fillActorSheetContext(this, context);
      } catch (err) {
        console.error("FASERIP | actor sheet context failed", err);
        ui.notifications?.error(`FASERIP sheet data error: ${err.message}`);
      }
      return context;
    }

    async _processSubmitData(event, form, submitData) {
      guardSheetUpdate(this.actor, submitData);
      return super._processSubmitData(event, form, submitData);
    }

    _onRender(context, options) {
      super._onRender?.(context, options);
      showSheetTab(this.element, this._faseripTab || "record");
    }

    _formEl(name) {
      return this.element?.querySelector?.(`[name="${name}"]`);
    }
  };
}
