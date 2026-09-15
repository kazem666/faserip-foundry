/**
 * Original mechanical blurbs for Advanced Set gear catalogs.
 * Fan-written play aids — not reprinted rulebook text.
 * Marvel-unique names are omitted or replaced with generic labels.
 */

import { GEAR_DEFINITIONS_A } from "./gear-descriptions-a.mjs";
import { GEAR_DEFINITIONS_B } from "./gear-descriptions-b.mjs";

export const GEAR_DEFINITIONS = { ...GEAR_DEFINITIONS_A, ...GEAR_DEFINITIONS_B };

export function describeGear(name, extra = {}) {
  const key = String(name || "")
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/[—–]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  const stock = GEAR_DEFINITIONS[key];
  if (!stock) {
    return {
      definition: extra.definition || `${String(name).trim()} is catalog gear. The Judge sets cost, material, and effect from your rulebook.`,
      itemType: extra.itemType || extra.type || "equipment",
      category: extra.category || ""
    };
  }
  return { ...stock, ...extra, definition: extra.definition || stock.definition };
}
