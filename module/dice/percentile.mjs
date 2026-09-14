export async function rollD100({ flavor = "Percentile", actor = null } = {}) {
  const roll = await new Roll("1d100").evaluate();
  const speaker = actor ? ChatMessage.getSpeaker({ actor }) : ChatMessage.getSpeaker();
  await roll.toMessage({ speaker, flavor, flags: { faserip: { percentile: true } } });
  return Number(roll.total);
}

export async function promptNextRoll(title, body) {
  const DialogV2 = foundry.applications.api.DialogV2;
  const choice = await DialogV2.wait({
    classes: ["faserip-dialog"],
    window: { title, icon: "fa-solid fa-dice", resizable: true },
    position: { width: 460 },
    content: `<div class="faserip-dialog-scroll"><p>${body}</p></div>`,
    buttons: [
      { action: "roll", label: "Roll 1d100", icon: "fa-solid fa-dice", default: true },
      { action: "cancel", label: "Stop" }
    ],
    rejectClose: false
  });
  return choice === "roll";
}

export async function promptedD100({ title, body, flavor, actor = null } = {}) {
  const go = await promptNextRoll(title, body);
  if (!go) return null;
  return rollD100({ flavor: flavor || title, actor });
}
