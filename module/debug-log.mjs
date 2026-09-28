const lines = [];
let timer = 0;

export function agentLog(payload) {
  const body = { sessionId: "12e9d0", timestamp: Date.now(), ...payload };
  // #region agent log
  fetch("http://127.0.0.1:7675/ingest/e592db75-1f3d-4579-a49d-0597d6872c34", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "12e9d0" }, body: JSON.stringify(body) }).catch(() => {});
  // #endregion
  lines.push(body);
  clearTimeout(timer);
  timer = setTimeout(() => { flushAgentLog().catch(() => {}); }, 400);
}

export async function flushAgentLog() {
  if (!lines.length) return;
  const text = lines.map((line) => JSON.stringify(line)).join("\n") + "\n";
  try {
    const file = new File([text], "debug-12e9d0.log", { type: "text/plain" });
    const picker = foundry?.applications?.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
    if (picker?.upload) await picker.upload("data", "", file, {}, { notify: false });
  } catch (err) {
    console.warn("FASERIP | debug log flush", err);
  }
}
