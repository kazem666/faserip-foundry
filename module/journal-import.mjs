/** Pick one page inside a journal PDF and read that page onto a hero sheet. */

import { parseCharacterText } from "./pdf-character.mjs";
import { importHeroFromText } from "./pdf-import.mjs";
import { indexPdfImages, rasterForImage } from "./pdf-text.mjs";

let picker = null;
let ocrPromise = null;
let pdfjsPromise = null;
const pdfDocs = new Map();

function fileURL(src) {
  const value = String(src || "");
  if (/^(https?:|data:|blob:)/.test(value)) return value;
  const route = globalThis.foundry?.utils?.getRoute;
  if (typeof route === "function") return route(value);
  if (value.startsWith("/")) return value;
  return `/${value}`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

function pagesOf(journal) {
  const pages = journal?.pages;
  if (!pages) return [];
  if (typeof pages.values === "function") return [...pages.values()];
  return pages.contents || [];
}

export function journalSources() {
  const sources = [];
  for (const journal of game.journal?.contents || []) {
    const pages = pagesOf(journal);
    const pdfs = pages.filter((page) => page.type === "pdf" && page.src);
    for (const page of pdfs) {
      sources.push({
        id: page.uuid,
        label: `${journal.name} — ${page.name}`,
        kind: "pdf",
        src: fileURL(page.src),
        journal,
        page
      });
    }
    if (pdfs.length) continue;
    const images = pages.filter((page) => page.type === "image" && page.src);
    if (!images.length) continue;
    sources.push({ id: journal.uuid, label: journal.name, kind: "images", journal, images });
  }
  return sources;
}

export function viewerPageNumber(root) {
  const frame = root?.querySelector?.("iframe");
  try {
    const page = frame?.contentWindow?.PDFViewerApplication?.page;
    return Number(page) || 0;
  } catch {
    return 0;
  }
}

export function viewerSnapshot(root) {
  const frame = root?.querySelector?.("iframe");
  let source = null;
  try {
    source = frame?.contentDocument?.querySelector("#viewer canvas, .page canvas, canvas") || null;
  } catch { /* the viewer keeps its own page */ }
  if (!source) source = root?.querySelector?.("canvas");
  if (!source || source.width < 80 || source.height < 80) return null;
  const copy = document.createElement("canvas");
  copy.width = source.width;
  copy.height = source.height;
  copy.getContext("2d").drawImage(source, 0, 0);
  return copy;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("picture"));
    image.src = url;
  });
}

function fitOnto(canvas, image) {
  const scale = Math.min(1, 1600 / image.width);
  canvas.width = Math.max(1, Math.floor(image.width * scale));
  canvas.height = Math.max(1, Math.floor(image.height * scale));
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
}

async function drawRaster(canvas, raster) {
  if (raster.kind === "jpeg") {
    const url = URL.createObjectURL(new Blob([raster.bytes], { type: "image/jpeg" }));
    try {
      fitOnto(canvas, await loadImage(url));
    } finally {
      URL.revokeObjectURL(url);
    }
    return;
  }
  const full = document.createElement("canvas");
  full.width = raster.width;
  full.height = raster.height;
  const image = full.getContext("2d").createImageData(raster.width, raster.height);
  const data = image.data;
  const src = raster.pixels;
  if (raster.channels === 1) {
    for (let i = 0, p = 0; i < src.length; i++, p += 4) {
      data[p] = data[p + 1] = data[p + 2] = src[i];
      data[p + 3] = 255;
    }
  } else {
    for (let i = 0, p = 0; i + 2 < src.length; i += 3, p += 4) {
      data[p] = src[i];
      data[p + 1] = src[i + 1];
      data[p + 2] = src[i + 2];
      data[p + 3] = 255;
    }
  }
  full.getContext("2d").putImageData(image, 0, 0);
  fitOnto(canvas, full);
}

async function loadPdfjs() {
  if (!pdfjsPromise) pdfjsPromise = findPdfjs().catch((err) => {
    pdfjsPromise = null;
    throw err;
  });
  return pdfjsPromise;
}

async function findPdfjs() {
  const urls = [];
  for (const frame of document.querySelectorAll("iframe")) {
    try {
      const lib = frame.contentWindow?.pdfjsLib;
      if (lib?.getDocument) return lib;
    } catch { /* sandboxed viewer */ }
    const src = frame.getAttribute("src") || "";
    const mark = src.indexOf("web/viewer");
    if (mark >= 0) urls.push(new URL("build/pdf.mjs", new URL(src.slice(0, mark), location.href)).href);
  }
  urls.push(new URL("scripts/pdfjs/build/pdf.mjs", location.origin).href);
  for (const url of urls) {
    try {
      const lib = await import(/* @vite-ignore */ url);
      if (!lib.getDocument) continue;
      const worker = url.replace(/pdf\.mjs(\?.*)?$/, "pdf.worker.mjs");
      if (lib.GlobalWorkerOptions) lib.GlobalWorkerOptions.workerSrc = worker;
      return lib;
    } catch { /* try the next copy */ }
  }
  return null;
}

async function openPdfDocument(src, bytes) {
  if (pdfDocs.has(src)) return pdfDocs.get(src);
  const lib = await loadPdfjs();
  if (!lib) return null;
  const doc = await lib.getDocument({ data: bytes.slice() }).promise;
  pdfDocs.set(src, doc);
  return doc;
}

function textFromItems(items) {
  const lines = [];
  let line = [];
  let lastY = null;
  for (const item of items || []) {
    const y = item.transform?.[5];
    if (lastY != null && y != null && Math.abs(y - lastY) > 2) {
      if (line.length) lines.push(line.join(" "));
      line = [];
    }
    if (y != null) lastY = y;
    if (item.str) line.push(item.str);
  }
  if (line.length) lines.push(line.join(" "));
  return lines.join("\n");
}

async function renderPdfPage(doc, pageNumber, canvas) {
  const page = await doc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: Math.min(3, 2200 / base.width) });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
  const content = await page.getTextContent();
  return textFromItems(content.items);
}

function ocrWorker() {
  if (!ocrPromise) ocrPromise = createOcr().catch((err) => {
    ocrPromise = null;
    throw err;
  });
  return ocrPromise;
}

async function createOcr() {
  const version = "5.1.1";
  const mod = await import(/* @vite-ignore */ `https://cdn.jsdelivr.net/npm/tesseract.js@${version}/dist/tesseract.esm.min.js`);
  const api = typeof mod.createWorker === "function" ? mod : mod.default;
  if (typeof api?.createWorker !== "function") throw new Error("The scan reader did not start.");
  return api.createWorker("eng", 1, {
    workerPath: `https://cdn.jsdelivr.net/npm/tesseract.js@${version}/dist/worker.min.js`,
    corePath: `https://cdn.jsdelivr.net/npm/tesseract.js-core@${version}/tesseract-core-simd-lstm.wasm.js`,
    langPath: "https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0"
  });
}

function sharpen(source) {
  const scale = source.width < 1400 ? 2 : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(source.width * scale));
  canvas.height = Math.max(1, Math.floor(source.height * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    let tone = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    tone = Math.max(0, Math.min(255, (tone - 28) * 1.4));
    data[i] = data[i + 1] = data[i + 2] = tone;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

async function readScan(worker, canvas) {
  const image = sharpen(canvas);
  const read = async (mode) => {
    await worker.setParameters({ tessedit_pageseg_mode: mode });
    const result = await worker.recognize(image);
    return result?.data?.text || "";
  };
  const block = await read("6");
  if (parseCharacterText(block, { fullSheet: true }).found >= 5) return block;
  const column = await read("4");
  const blockScore = parseCharacterText(block, { fullSheet: true }).found;
  const columnScore = parseCharacterText(column, { fullSheet: true }).found;
  return columnScore > blockScore ? column : block;
}

function pointOn(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (canvas.width / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / rect.height)
  };
}

function PickerApp() {
  const Base = foundry.applications?.api?.ApplicationV2;
  if (!Base) return null;
  return class FaseripJournalImport extends Base {
    static DEFAULT_OPTIONS = {
      id: "faserip-journal-import",
      classes: ["faserip", "faserip-journal-import"],
      tag: "div",
      window: { title: "Import a journal page", icon: "fa-solid fa-book-open", resizable: true },
      position: { width: 880, height: 760 }
    };

    constructor() {
      super();
      this.sources = [];
      this.sourceId = "";
      this.pageIndex = 0;
      this.pageCount = 0;
      this.pageText = "";
      this.selection = null;
      this.drag = null;
      this.busy = false;
      this.bytes = null;
      this.images = [];
      this.pdfDoc = null;
      this.mode = "";
      this.seedCanvas = null;
      this.startPage = 0;
    }

    configure({ journal, page, pageNumber = 0, snapshot = null } = {}) {
      this.pendingJournal = journal || page?.parent || null;
      this.pendingPage = page || null;
      this.startPage = Number(pageNumber) || 0;
      this.seedCanvas = snapshot || null;
      this.loadedKey = "";
    }

    async _renderHTML() {
      const root = document.createElement("div");
      root.className = "faserip-page-pick";
      root.innerHTML = `
        <div class="faserip-page-tools">
          <select class="journal-choice"></select>
          <button type="button" data-action="prev">Previous</button>
          <label>Page <input class="page-num" type="number" min="1" value="1"> / <span class="page-count">0</span></label>
          <button type="button" data-action="next">Next</button>
        </div>
        <p class="faserip-page-hint">Box one character, from the name through Contacts. A page often holds more than one.</p>
        <div class="faserip-page-stage">
          <canvas class="page-image"></canvas>
          <canvas class="page-box"></canvas>
        </div>
        <div class="faserip-page-actions">
          <button type="button" data-action="read">Read this selection</button>
          <button type="button" data-action="cancel">Cancel</button>
        </div>
        <p class="faserip-page-status"></p>`;
      return root;
    }

    async _replaceHTML(result, content) {
      if (content && result) content.replaceChildren(result);
      this.#mount(result);
    }

    #mount(root) {
      this.root = root;
      if (root.dataset.bound) return;
      root.dataset.bound = "1";
      root.querySelector(".journal-choice").addEventListener("change", (event) => {
        this.sourceId = event.target.value;
        this.pageIndex = 0;
        this.selection = null;
        this.startPage = 0;
        this.loadedKey = "";
        this.#open().then(() => this.#show());
      });
      root.querySelector("[data-action='prev']").addEventListener("click", () => this.#step(-1));
      root.querySelector("[data-action='next']").addEventListener("click", () => this.#step(1));
      root.querySelector(".page-num").addEventListener("change", (event) => {
        const next = Number(event.target.value) || 1;
        this.pageIndex = Math.min(this.pageCount, Math.max(1, next)) - 1;
        this.selection = null;
        this.#show();
      });
      root.querySelector("[data-action='read']").addEventListener("click", () => this.#read());
      root.querySelector("[data-action='cancel']").addEventListener("click", () => this.close());
      const stage = root.querySelector(".faserip-page-stage");
      stage.addEventListener("pointerdown", (event) => this.#down(event));
      stage.addEventListener("pointermove", (event) => this.#move(event));
      stage.addEventListener("pointerup", (event) => this.#up(event));
      stage.addEventListener("pointerleave", (event) => this.#up(event));
    }

    async load() {
      this.sources = journalSources();
      const select = this.root?.querySelector(".journal-choice");
      if (!select) return;
      select.innerHTML = this.sources.map((source) => `<option value="${escapeHtml(source.id)}">${escapeHtml(source.label)}</option>`).join("");
      const preferred = this.pendingPage?.uuid || this.pendingJournal?.uuid || "";
      const match = this.sources.find((source) => source.id === preferred)
        || this.sources.find((source) => source.journal === this.pendingJournal)
        || this.sources[0];
      if (!match) {
        this.#status("No PDF journal is in this world yet.");
        return;
      }
      this.sourceId = match.id;
      select.value = match.id;
      await this.#open();
      if (this.startPage > 0 && this.pageCount) {
        this.pageIndex = Math.min(this.pageCount, this.startPage) - 1;
      }
      await this.#show();
    }

    source() {
      return this.sources.find((source) => source.id === this.sourceId) || null;
    }

    async #open() {
      const source = this.source();
      if (!source || !this.root) return;
      if (this.loadedKey === source.id) return;
      this.#status("Opening the book…");
      await new Promise((resolve) => setTimeout(resolve, 30));
      this.bytes = null;
      this.images = [];
      this.pdfDoc = null;
      this.mode = "";
      this.pageCount = 0;
      this.pageIndex = 0;
      try {
        if (source.kind === "images") {
          this.mode = "images";
          this.pageCount = source.images.length;
        } else {
          const response = await fetch(source.src);
          if (!response.ok) throw new Error(`The book file did not load (${response.status}).`);
          this.bytes = new Uint8Array(await response.arrayBuffer());
          this.images = indexPdfImages(this.bytes);
          if (this.images.length) {
            this.mode = "images-pdf";
            this.pageCount = this.images.length;
          } else {
            this.pdfDoc = await openPdfDocument(source.src, this.bytes);
            if (this.pdfDoc) {
              this.mode = "pdfjs";
              this.pageCount = this.pdfDoc.numPages || 0;
            }
          }
        }
      } catch (err) {
        console.error("FASERIP | journal pdf", err);
        this.#status(err.message || "That journal PDF could not be opened.");
      }
      if (!this.pageCount && this.seedCanvas) {
        this.mode = "snapshot";
        this.pageCount = 1;
        this.#status("Showing the page that is open in the journal.");
      } else if (!this.pageCount) {
        this.#status("Open the journal to the character and use Import this page while that page is on screen.");
      }
      this.loadedKey = source.id;
      const count = this.root.querySelector(".page-count");
      if (count) count.textContent = String(this.pageCount);
    }

    async #step(delta) {
      if (!this.pageCount) return;
      this.pageIndex = Math.min(this.pageCount - 1, Math.max(0, this.pageIndex + delta));
      this.selection = null;
      await this.#show();
    }

    async #show() {
      const canvas = this.root?.querySelector(".page-image");
      if (!canvas) return;
      const number = this.root.querySelector(".page-num");
      const count = this.root.querySelector(".page-count");
      if (number) number.value = String(this.pageIndex + 1);
      if (count) count.textContent = String(this.pageCount);
      this.pageText = "";
      this.#status(this.pageCount ? `Page ${this.pageIndex + 1} of ${this.pageCount}.` : "This book has no pages the reader can show.");
      try {
        if (this.mode === "images") {
          const page = this.source().images[this.pageIndex];
          fitOnto(canvas, await loadImage(fileURL(page.src)));
        } else if (this.mode === "images-pdf") {
          const raster = await rasterForImage(this.bytes, this.images[this.pageIndex]);
          if (!raster) throw new Error("That page picture could not be drawn.");
          await drawRaster(canvas, raster);
        } else if (this.mode === "pdfjs") {
          this.pageText = await renderPdfPage(this.pdfDoc, this.pageIndex + 1, canvas);
        } else if (this.mode === "snapshot" && this.seedCanvas) {
          canvas.width = this.seedCanvas.width;
          canvas.height = this.seedCanvas.height;
          canvas.getContext("2d").drawImage(this.seedCanvas, 0, 0);
        } else {
          canvas.width = 0;
          canvas.height = 0;
        }
      } catch (err) {
        console.error("FASERIP | journal page draw", err);
        this.#status(err.message || "That page could not be drawn.");
      }
      this.#paint();
    }

    #status(text) {
      const node = this.root?.querySelector(".faserip-page-status");
      if (node) node.textContent = text;
    }

    #paint() {
      const image = this.root?.querySelector(".page-image");
      const box = this.root?.querySelector(".page-box");
      if (!image || !box) return;
      box.width = image.width;
      box.height = image.height;
      const ctx = box.getContext("2d");
      ctx.clearRect(0, 0, box.width, box.height);
      const mark = this.drag || this.selection;
      if (!mark || mark.w < 2 || mark.h < 2) return;
      ctx.strokeStyle = "#eab308";
      ctx.lineWidth = Math.max(3, image.width / 350);
      ctx.strokeRect(mark.x, mark.y, mark.w, mark.h);
    }

    #down(event) {
      const box = this.root.querySelector(".page-box");
      if (!box?.width) return;
      box.setPointerCapture?.(event.pointerId);
      const point = pointOn(box, event);
      this.drag = { x: point.x, y: point.y, w: 0, h: 0, x0: point.x, y0: point.y };
      this.selection = null;
    }

    #move(event) {
      if (!this.drag) return;
      const box = this.root.querySelector(".page-box");
      const point = pointOn(box, event);
      const x = Math.min(this.drag.x0, point.x);
      const y = Math.min(this.drag.y0, point.y);
      this.drag = { x, y, w: Math.abs(point.x - this.drag.x0), h: Math.abs(point.y - this.drag.y0), x0: this.drag.x0, y0: this.drag.y0 };
      this.#paint();
    }

    #up() {
      if (!this.drag) return;
      this.selection = this.drag.w >= 24 && this.drag.h >= 24
        ? { x: this.drag.x, y: this.drag.y, w: this.drag.w, h: this.drag.h }
        : null;
      this.drag = null;
      this.#paint();
    }

    #crop() {
      const image = this.root.querySelector(".page-image");
      const crop = document.createElement("canvas");
      const mark = this.selection;
      if (!mark) {
        crop.width = image.width;
        crop.height = image.height;
        crop.getContext("2d").drawImage(image, 0, 0);
        return crop;
      }
      const x = Math.max(0, Math.floor(mark.x));
      const y = Math.max(0, Math.floor(mark.y));
      const w = Math.min(image.width - x, Math.floor(mark.w));
      const h = Math.min(image.height - y, Math.floor(mark.h));
      crop.width = Math.max(1, w);
      crop.height = Math.max(1, h);
      crop.getContext("2d").drawImage(image, x, y, crop.width, crop.height, 0, 0, crop.width, crop.height);
      return crop;
    }

    async #read() {
      if (this.busy) return;
      const image = this.root?.querySelector(".page-image");
      if (!image?.width) {
        this.#status("Turn to a page first.");
        return;
      }
      this.busy = true;
      try {
        let text = "";
        const whole = !this.selection;
        if (whole && this.pageText && parseCharacterText(this.pageText, { fullSheet: true }).found >= 4) {
          text = this.pageText;
        } else {
          this.#status("Reading the scan. The first one can take a moment.");
          text = await readScan(await ocrWorker(), this.#crop());
        }
        const preview = parseCharacterText(text, { fullSheet: true });
        if (!preview.found && !preview.powers.length && !preview.talents.length) {
          ui.notifications?.warn("That box did not show ability ranks. Drag a box around the stat line and try again.");
          this.#status("No ranks in that selection.");
          return;
        }
        const label = this.source()?.label || "journal";
        await importHeroFromText(text, label, { fullSheet: true });
      } catch (err) {
        console.error("FASERIP | journal read", err);
        ui.notifications?.error(err.message === "The scan reader did not start."
          ? err.message
          : "That page could not be read. Box the stat line and try again.");
      } finally {
        this.busy = false;
      }
    }
  };
}

export async function promptJournalImport(options = {}) {
  const App = PickerApp();
  if (!App) {
    ui.notifications?.error("The page picker needs this Foundry version's application window.");
    return null;
  }
  if (!picker) picker = new App();
  picker.configure(options);
  await picker.render({ force: true });
  await picker.load();
  return picker;
}
