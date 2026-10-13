/**
 * Optional lethal-methods flag. Off until the Judge turns the house rule on.
 * A Kill result stands only when the character is flagged. There is no award for maiming.
 */

export function pulledKill(effect, { ruleOn = false, lethal = false } = {}) {
  if (!ruleOn || effect !== "Kill" || lethal) return { effect, note: "" };
  return { effect: "Stun", note: "Lethal methods are off, so Kill counts as Stun." };
}
