import { rankIndex } from "./config.mjs";
import { senseKind } from "./senses.mjs";

function rollColor(message) {
  return message?.getFlag?.("faserip", "color") || message?.flags?.faserip?.color || "";
}

function detectionRank(actor) {
  let best = "";
  for (const item of actor?.items ?? []) {
    if (item.type !== "power") continue;
    if (senseKind(item.name) !== "magic" && !/magic detection/i.test(item.name || "")) continue;
    const rank = item.system?.rank || "";
    if (!best || rankIndex(rank) > rankIndex(best)) best = rank;
  }
  return best;
}

export function itemIsVeiled(item) {
  return !!item?.system?.unknown && !globalThis.game?.user?.isGM;
}

export async function identifyItem(actor, item) {
  if (!actor || !item?.system?.unknown) return null;
  const reason = actor.getAbilityRank?.("reason") || "typical";
  const detected = detectionRank(actor);
  const useDetection = detected && rankIndex(detected) > rankIndex(reason);
  const ability = useDetection ? "intuition" : "reason";
  const { rollFeat } = await import("./dice/universal-table.mjs");
  const { shiftPlan } = await import("./workflow.mjs");
  const plan = shiftPlan(actor, { ability });
  const message = await rollFeat({
    actor,
    rankId: useDetection ? detected : reason,
    label: useDetection ? "Magic Detection" : "Reason",
    ability,
    cs: plan.cs || 0,
    shiftNotes: plan.note || "",
    consumeOutgoing: !!plan.consumeOutgoing,
    consumeStrike: !!plan.consumeStrike,
    consumeMagicResist: !!plan.consumeMagicResist
  });
  const color = rollColor(message);
  if (!color) return message;
  if (color === "white") {
    globalThis.ui?.notifications?.info("It stays unknown.");
    return message;
  }
  await item.update({ "system.unknown": false });
  globalThis.ui?.notifications?.info(`It is ${item.name}.`);
  return message;
}
