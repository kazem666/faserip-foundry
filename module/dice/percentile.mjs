export async function rollD100({ flavor = "Percentile", actor = null } = {}) {
  const roll = await new Roll("1d100").evaluate();
  const speaker = actor ? ChatMessage.getSpeaker({ actor }) : ChatMessage.getSpeaker();
  await roll.toMessage({ speaker, flavor, flags: { faserip: { percentile: true } } });
  return Number(roll.total);
}
