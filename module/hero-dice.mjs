export async function promptGeneration(actor) {
  const { openCreator } = await import("./apps/creator-app.mjs");
  return openCreator({ actor });
}

export { rollHeroDice } from "./roll-hero-dice.mjs";
