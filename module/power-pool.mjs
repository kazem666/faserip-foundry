/**
 * Optional power pool. Off until the Judge turns the house rule on.
 * Powers marked in the pool share one ready slot. The rest are set aside.
 */

import { houseOn } from "./house-rules.mjs";

export function inPool(item) {
  return !!(item?.getFlag?.("faserip", "pool") || item?.flags?.faserip?.pool);
}

export function poolReady(item) {
  return !!(item?.getFlag?.("faserip", "poolReady") || item?.flags?.faserip?.poolReady);
}

export function poolBlocked(item) {
  if (!houseOn("housePowerPool") || item?.type !== "power") return false;
  return inPool(item) && !poolReady(item);
}

export async function togglePool(item) {
  if (!houseOn("housePowerPool") || item?.type !== "power") return null;
  if (inPool(item)) {
    await item.unsetFlag("faserip", "pool");
    await item.unsetFlag("faserip", "poolReady");
    globalThis.ui?.notifications?.info(`${item.name} is out of the pool.`);
    return item;
  }
  await item.setFlag("faserip", "pool", true);
  const ready = [...(item.actor?.items ?? [])].some((other) => other.id !== item.id && other.type === "power" && poolReady(other));
  if (ready) await item.unsetFlag("faserip", "poolReady");
  else await item.setFlag("faserip", "poolReady", true);
  globalThis.ui?.notifications?.info(ready ? `${item.name} is in the pool and set aside.` : `${item.name} is in the pool and ready.`);
  return item;
}

export async function makePoolReady(item) {
  if (!houseOn("housePowerPool") || !inPool(item)) return null;
  for (const other of item.actor?.items ?? []) {
    if (other.type !== "power" || other.id === item.id) continue;
    if (poolReady(other)) await other.unsetFlag("faserip", "poolReady");
  }
  await item.setFlag("faserip", "poolReady", true);
  globalThis.ui?.notifications?.info(`${item.name} is ready. The other pooled powers are set aside.`);
  return item;
}
