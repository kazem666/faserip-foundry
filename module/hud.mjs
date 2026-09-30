import { toggleFlying, powerKeepsAloft } from "./falling.mjs";
import { promptForm, formValue } from "./foundry-api.mjs";

function rootOf(html) {
  return html instanceof HTMLElement ? html : html?.[0] || null;
}

function actorOf(hud) {
  return hud?.object?.actor || hud?.object?.document?.actor || null;
}

async function spendFromHud(actor) {
  const form = await promptForm({
    title: `Spend Karma — ${actor.name}`,
    content: `<p>${actor.name} has ${actor.system?.karma?.value ?? 0} Karma.</p><div class="form-group"><label>Amount</label><input type="number" name="amount" min="1" value="10" /></div>`,
    okLabel: "Spend"
  });
  if (!form) return;
  const amount = Math.max(0, Number(formValue(form, "amount") || 0));
  if (!amount || typeof actor.spendKarma !== "function") return;
  if ((actor.system?.karma?.value ?? 0) < amount) {
    globalThis.ui?.notifications?.warn(`${actor.name} does not have ${amount} Karma.`);
    return;
  }
  await actor.spendKarma(amount);
  globalThis.ui?.notifications?.info(`${actor.name} spends ${amount} Karma.`);
}

async function usePowerFromHud(actor) {
  const powers = [...(actor.items ?? [])].filter((item) => item.type === "power" || item.type === "weapon" || item.type === "talent");
  if (!powers.length) {
    globalThis.ui?.notifications?.warn(`${actor.name} has nothing to use.`);
    return;
  }
  const options = powers.map((item) => `<option value="${item.id}">${item.name}</option>`).join("");
  const form = await promptForm({
    title: `Use — ${actor.name}`,
    content: `<div class="form-group"><label>Power</label><select name="item">${options}</select></div>`,
    okLabel: "Use"
  });
  if (!form) return;
  const item = actor.items.get(formValue(form, "item"));
  if (!item) return;
  const { rollItemAction } = await import("./item-actions.mjs");
  return rollItemAction(actor, item, {});
}

function button(title, icon, action) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "faserip-hud-btn";
  el.title = title;
  el.dataset.faseripHud = action;
  el.innerHTML = `<i class="${icon}"></i>`;
  return el;
}

export function registerHud() {
  const Hooks = globalThis.Hooks;
  if (!Hooks || Hooks._faseripHud) return;
  Hooks._faseripHud = true;
  Hooks.on("renderTokenHUD", (hud, html) => {
    const root = rootOf(html);
    const actor = actorOf(hud);
    if (!root || !actor || root.querySelector(".faserip-hud")) return;
    const col = root.querySelector(".col.left") || root;
    const bar = document.createElement("div");
    bar.className = "faserip-hud";
    const canFly = [...(actor.items ?? [])].some((item) => powerKeepsAloft(item.name));
    if (canFly) bar.append(button("Flight", "fa-solid fa-dove", "fly"));
    bar.append(button("Spend Karma", "fa-solid fa-star", "karma"));
    bar.append(button("Use a power", "fa-solid fa-bolt", "power"));
    col.append(bar);
    bar.addEventListener("click", (event) => {
      const hit = event.target?.closest?.("[data-faserip-hud]");
      if (!hit) return;
      event.preventDefault();
      event.stopPropagation();
      const action = hit.dataset.faseripHud;
      const run = action === "fly"
        ? toggleFlying(actor).then((on) => globalThis.ui?.notifications?.info(on ? `${actor.name} is flying.` : `${actor.name} lands.`))
        : action === "karma"
          ? spendFromHud(actor)
          : usePowerFromHud(actor);
      Promise.resolve(run).catch((err) => console.warn("FASERIP | hud", err));
    });
  });
  Hooks.on("hotbarDrop", (bar, data, slot) => {
    if (data?.type !== "Item") return;
    createItemMacro(data, slot).catch((err) => console.warn("FASERIP | hotbar", err));
    return false;
  });
}

async function createItemMacro(data, slot) {
  const uuid = data.uuid;
  const item = uuid ? await globalThis.fromUuid?.(uuid) : null;
  if (!item) return;
  const MacroDoc = globalThis.Macro;
  if (!MacroDoc?.create) return;
  const command = [
    `const item = await fromUuid(${JSON.stringify(uuid)});`,
    "const actor = item?.actor || item?.parent || canvas.tokens.controlled[0]?.actor;",
    "if (actor && item && game.faserip?.rollItem) await game.faserip.rollItem(actor, item);"
  ].join("\n");
  const macro = await MacroDoc.create({
    name: item.name,
    type: "script",
    img: item.img,
    command,
    flags: { faserip: { itemUuid: uuid } }
  });
  await globalThis.game?.user?.assignHotbarMacro?.(macro, slot);
}
