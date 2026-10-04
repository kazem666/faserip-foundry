export function defaultCapacity(name = "", weaponType = "") {
  const key = `${name} ${weaponType}`.toLowerCase();
  if (/artillery|cannon|bazooka|\blaw\b|missile launcher|grenade launcher|flare pistol/.test(key)) return 1;
  if (/shotgun|riot gun/.test(key)) return 6;
  if (/machine gun|sub-machine|automatic rifle|assault|machine pistol/.test(key)) return 30;
  if (/flamethrower/.test(key)) return 10;
  if (/plasma beam handgun|laser pistol|stun pistol|concussion pistol/.test(key)) return 12;
  if (/laser rifle|stun rifle|concussion rifle|plasma/.test(key)) return 20;
  if (/crossbow|\bbow\b/.test(key)) return 20;
  if (/sniper|hunting rifle|\brifle\b/.test(key)) return 10;
  if (/pistol|handgun|gyro/.test(key)) return 8;
  const type = String(weaponType || "").toLowerCase();
  if (type === "bow") return 20;
  if (type === "shooting") return 8;
  if (type === "energy" || type === "stun") return 12;
  return 0;
}

export function defaultStack(name = "") {
  const key = String(name || "").toLowerCase();
  if (/missile/.test(key)) return 4;
  if (/canister|fuel/.test(key)) return 6;
  if (/gyro/.test(key)) return 12;
  if (/power pack/.test(key)) return 30;
  if (/arrow|bolt/.test(key)) return 20;
  return 30;
}

export function tracksAmmo(item) {
  if (!item || item.type !== "weapon") return false;
  if (item.system?.ammoOff) return false;
  if (item.system?.usesAmmo) return true;
  return defaultCapacity(item.name, item.system?.weaponType) > 0;
}

export function weaponCapacity(item) {
  const set = Number(item?.system?.capacity) || 0;
  if (set > 0) return set;
  return defaultCapacity(item?.name, item?.system?.weaponType) || 6;
}

export function ammoStatus(item) {
  if (!tracksAmmo(item)) return null;
  const capacity = weaponCapacity(item);
  const raw = Number(item.system?.shots);
  const shots = !Number.isFinite(raw) || raw < 0 ? capacity : Math.max(0, Math.min(capacity, raw));
  return { shots, capacity, empty: shots <= 0 };
}

export function ammoBlock(item) {
  const status = ammoStatus(item);
  if (!status || !status.empty) return "";
  return `${item.name} is empty. Reload it.`;
}

export function isSpareAmmo(item) {
  if (item?.type !== "equipment") return false;
  const name = String(item.name || "").toLowerCase();
  const category = String(item.system?.category || "");
  return category === "Ammunition" || /ammunition|ammo reload|power pack|arrow|bolt|canister|missile|gyro|fuel canister/.test(name);
}

export function spareRounds(item) {
  const raw = Number(item?.system?.rounds);
  if (Number.isFinite(raw) && raw >= 0) return raw;
  return defaultStack(item?.name);
}

function familyOf(item) {
  const key = `${item?.name || ""} ${item?.system?.weaponType || ""}`.toLowerCase();
  if (/gyro/.test(key)) return "gyro";
  if (/missile|bazooka|\blaw\b|launcher|artillery|cannon|flare/.test(key)) return "heavy";
  if (/flame|canister|fuel/.test(key)) return "canister";
  if (/laser|plasma|stun|concussion|power pack/.test(key)) return "power";
  if (/bow|crossbow|arrow|bolt/.test(key)) return "arrow";
  return "bullet";
}

function spareFits(family, item) {
  if (!isSpareAmmo(item) || spareRounds(item) <= 0) return false;
  if (familyOf(item) === family) return true;
  const name = String(item.name || "").toLowerCase();
  return (family === "bullet" || family === "arrow") && /standard ammunition|ammo reload/.test(name);
}

function findSpare(actor, weapon) {
  const family = familyOf(weapon);
  let best = null;
  let bestRounds = -1;
  for (const item of actor?.items ?? []) {
    if (!spareFits(family, item)) continue;
    const rounds = spareRounds(item);
    if (rounds > bestRounds) {
      best = item;
      bestRounds = rounds;
    }
  }
  return best;
}

export async function spendShot(item) {
  const status = ammoStatus(item);
  if (!status || !item?.update) return false;
  const left = Math.max(0, status.shots - 1);
  await item.update({
    "system.usesAmmo": true,
    "system.capacity": status.capacity,
    "system.shots": left
  });
  const note = left > 0 ? `${item.name}: ${left} shot${left === 1 ? "" : "s"} left.` : `${item.name} is empty.`;
  globalThis.ui?.notifications?.info(note);
  return true;
}

export async function reloadWeapon(actor, weapon) {
  const status = ammoStatus(weapon);
  if (!status || !weapon?.update) {
    globalThis.ui?.notifications?.warn("That weapon does not count shots.");
    return false;
  }
  const need = status.capacity - status.shots;
  if (need <= 0) {
    globalThis.ui?.notifications?.info(`${weapon.name} is already loaded.`);
    return false;
  }
  const spare = findSpare(actor, weapon);
  if (!spare) {
    globalThis.ui?.notifications?.warn(`${weapon.name} needs matching ammunition on the sheet. The shot count can also be edited on the weapon.`);
    return false;
  }
  const have = spareRounds(spare);
  const take = Math.min(need, have);
  await spare.update({ "system.rounds": have - take });
  const shots = status.shots + take;
  await weapon.update({
    "system.usesAmmo": true,
    "system.ammoOff": false,
    "system.capacity": status.capacity,
    "system.shots": shots
  });
  const left = have - take;
  globalThis.ui?.notifications?.info(`${weapon.name} is at ${shots}/${status.capacity}. ${spare.name} has ${left} left.`);
  return true;
}
