/** Pull readable text out of a PDF. Typed sheets and form fields. A scanned picture has no text to read. */

function latin1(bytes) {
  const src = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let out = "";
  const step = 0x8000;
  for (let i = 0; i < src.length; i += step) {
    out += String.fromCharCode(...src.subarray(i, i + step));
  }
  return out;
}

function toBytes(text) {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}

function decodeLiteral(body) {
  let out = "";
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch !== "\\") { out += ch; continue; }
    const next = body[++i];
    if (next == null) break;
    if (next === "n") out += "\n";
    else if (next === "r") out += "\r";
    else if (next === "t") out += "\t";
    else if (next === "b") out += "\b";
    else if (next === "f") out += "\f";
    else if (next === "(" || next === ")" || next === "\\") out += next;
    else if (next >= "0" && next <= "7") {
      let oct = next;
      for (let k = 0; k < 2 && body[i + 1] >= "0" && body[i + 1] <= "7"; k++) oct += body[++i];
      out += String.fromCharCode(parseInt(oct, 8));
    } else if (next === "\n" || next === "\r") {
      if (next === "\r" && body[i + 1] === "\n") i++;
    } else out += next;
  }
  return out;
}

function readLiteral(src, start) {
  let i = start + 1;
  let depth = 1;
  let body = "";
  while (i < src.length && depth > 0) {
    const ch = src[i];
    if (ch === "\\") {
      body += ch + (src[i + 1] || "");
      i += 2;
      continue;
    }
    if (ch === "(") depth++;
    if (ch === ")") {
      depth--;
      if (depth === 0) break;
    }
    body += ch;
    i++;
  }
  return { text: decodeLiteral(body), next: i + 1 };
}

function decodeHex(hex) {
  const clean = hex.replace(/\s+/g, "");
  if (!clean) return "";
  const bytes = [];
  for (let i = 0; i + 1 < clean.length; i += 2) {
    const n = parseInt(clean.slice(i, i + 2), 16);
    if (Number.isFinite(n)) bytes.push(n);
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    let out = "";
    for (let i = 2; i + 1 < bytes.length; i += 2) out += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
    return out;
  }
  return String.fromCharCode(...bytes);
}

function readHex(src, start) {
  const end = src.indexOf(">", start + 1);
  if (end < 0) return { text: "", next: start + 1 };
  return { text: decodeHex(src.slice(start + 1, end)), next: end + 1 };
}

export function textFromContent(src) {
  const parts = [];
  const breakLine = () => {
    if (parts.length && parts[parts.length - 1] !== "\n") parts.push("\n");
  };
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === "(") {
      const read = readLiteral(src, i);
      if (read.text) parts.push(read.text);
      i = read.next;
      continue;
    }
    if (ch === "<" && src[i + 1] !== "<") {
      const read = readHex(src, i);
      if (read.text) parts.push(read.text);
      i = read.next;
      continue;
    }
    if (ch === "T" && (src[i + 1] === "*" || src.startsWith("Td", i) || src.startsWith("TD", i) || src.startsWith("Tm", i))) {
      breakLine();
    }
    if (ch === "'" || ch === "\"") breakLine();
    i++;
  }
  return parts.join("");
}

function fieldValue(token) {
  if (!token) return "";
  if (token.startsWith("(")) return decodeLiteral(token.slice(1, -1));
  if (token.startsWith("<")) return decodeHex(token.slice(1, -1));
  return "";
}

export function extractFormFields(latin) {
  const lines = [];
  const token = String.raw`(?:\((?:\\.|[^)])*\)|<[^>]*>)`;
  const pair = new RegExp(`\\/T\\s*(${token})[\\s\\S]{0,500}?\\/V\\s*(${token})`, "g");
  const swapped = new RegExp(`\\/V\\s*(${token})[\\s\\S]{0,500}?\\/T\\s*(${token})`, "g");
  let match;
  while ((match = pair.exec(latin))) {
    const name = fieldValue(match[1]).trim();
    const value = fieldValue(match[2]).trim();
    if (name && value) lines.push(`${name}: ${value}`);
  }
  while ((match = swapped.exec(latin))) {
    const value = fieldValue(match[1]).trim();
    const name = fieldValue(match[2]).trim();
    if (name && value) lines.push(`${name}: ${value}`);
  }
  return lines.join("\n");
}

async function inflate(bytes) {
  if (typeof DecompressionStream !== "function" || typeof Blob === "undefined") return null;
  const modes = ["deflate", "deflate-raw"];
  for (const mode of modes) {
    try {
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(mode));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    } catch { /* try the other wrapper */ }
  }
  return null;
}

function streamsFrom(latin) {
  const found = [];
  let idx = 0;
  while (idx < latin.length) {
    const marker = latin.indexOf("stream", idx);
    if (marker < 0) break;
    if (latin.slice(Math.max(0, marker - 3), marker) === "end") {
      idx = marker + 6;
      continue;
    }
    let start = marker + 6;
    if (latin[start] === "\r") start++;
    if (latin[start] === "\n") start++;
    const dictStart = latin.lastIndexOf("<<", marker);
    const dict = dictStart >= 0 ? latin.slice(dictStart, marker) : "";
    const lengthMatch = /\/Length\s+(\d+)/.exec(dict);
    let data = "";
    if (lengthMatch) {
      const len = Number(lengthMatch[1]);
      data = latin.slice(start, start + len);
      idx = start + len;
    } else {
      const end = latin.indexOf("endstream", start);
      if (end < 0) break;
      data = latin.slice(start, end).replace(/\r?\n$/, "");
      idx = end + 9;
    }
    if (!/\/Subtype\s*\/Image/.test(dict)) found.push({ dict, data });
  }
  return found;
}

export async function extractPdfText(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const raw = latin1(bytes);
  const pieces = [extractFormFields(raw)];
  for (const stream of streamsFrom(raw)) {
    let content = stream.data;
    if (/FlateDecode/.test(stream.dict)) {
      const inflated = await inflate(toBytes(stream.data));
      if (!inflated) continue;
      content = latin1(inflated);
    }
    const text = textFromContent(content);
    if (text.trim()) pieces.push(text);
  }
  return pieces.filter(Boolean).join("\n").replace(/\u0000/g, "").slice(0, 200000);
}

const STREAM = [115, 116, 114, 101, 97, 109];
const END_MARK = [101, 110, 100, 115, 116, 114, 101, 97, 109];

function indexOfBytes(bytes, needle, from = 0) {
  const first = needle[0];
  const limit = bytes.length - needle.length;
  for (let i = from; i <= limit; i++) {
    if (bytes[i] !== first) continue;
    let ok = true;
    for (let j = 1; j < needle.length; j++) {
      if (bytes[i + j] !== needle[j]) { ok = false; break; }
    }
    if (ok) return i;
  }
  return -1;
}

function windowText(bytes, start, end) {
  let out = "";
  for (let i = start; i < end; i++) out += String.fromCharCode(bytes[i]);
  return out;
}

function lastDictNumber(dict, key) {
  const re = new RegExp(`\\/${key}\\s+(\\d+)`, "g");
  let match;
  let value = 0;
  while ((match = re.exec(dict))) value = Number(match[1]);
  return value;
}

function paeth(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const leftDelta = Math.abs(estimate - left);
  const upDelta = Math.abs(estimate - up);
  const upLeftDelta = Math.abs(estimate - upLeft);
  if (leftDelta <= upDelta && leftDelta <= upLeftDelta) return left;
  if (upDelta <= upLeftDelta) return up;
  return upLeft;
}

function unfilterRows(bytes, width, channels) {
  const rowIn = width * channels + 1;
  if (!rowIn || bytes.length < rowIn) return null;
  const rows = Math.floor(bytes.length / rowIn);
  const out = new Uint8Array(rows * width * channels);
  const prior = new Uint8Array(width * channels);
  for (let y = 0; y < rows; y++) {
    const filter = bytes[y * rowIn];
    const row = bytes.subarray(y * rowIn + 1, (y + 1) * rowIn);
    const dest = out.subarray(y * width * channels, (y + 1) * width * channels);
    for (let i = 0; i < row.length; i++) {
      const left = i >= channels ? dest[i - channels] : 0;
      const up = prior[i] || 0;
      const upLeft = i >= channels ? (prior[i - channels] || 0) : 0;
      let value = row[i];
      if (filter === 1) value = (value + left) & 255;
      else if (filter === 2) value = (value + up) & 255;
      else if (filter === 3) value = (value + ((left + up) >> 1)) & 255;
      else if (filter === 4) value = (value + paeth(left, up, upLeft)) & 255;
      else if (filter !== 0) return null;
      dest[i] = value;
    }
    prior.set(dest);
  }
  return out;
}

/** Large pictures inside a PDF, in file order. One scanned page is usually one picture. */
export function indexPdfImages(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const images = [];
  let cursor = 0;
  while (cursor < bytes.length) {
    const marker = indexOfBytes(bytes, STREAM, cursor);
    if (marker < 0) break;
    if (marker >= 3 && bytes[marker - 3] === 101 && bytes[marker - 2] === 110 && bytes[marker - 1] === 100) {
      cursor = marker + STREAM.length;
      continue;
    }
    let start = marker + STREAM.length;
    if (bytes[start] === 13) start++;
    if (bytes[start] === 10) start++;
    const dict = windowText(bytes, Math.max(0, marker - 800), marker);
    const length = lastDictNumber(dict, "Length");
    let end = length ? start + length : indexOfBytes(bytes, END_MARK, start);
    if (end < start) break;
    cursor = end + (length ? 0 : END_MARK.length);
    if (!/\/Subtype\s*\/Image/.test(dict) || /\/ImageMask\s+true/.test(dict)) continue;
    const width = lastDictNumber(dict, "Width");
    const height = lastDictNumber(dict, "Height");
    if (width < 400 || height < 400) continue;
    const jpeg = /\/DCTDecode\b/.test(dict);
    const flate = /\/FlateDecode\b/.test(dict);
    if (!jpeg && !flate) continue;
    const gray = /\/DeviceGray\b/.test(dict);
    const rgb = /\/DeviceRGB\b/.test(dict);
    if (flate && !jpeg && !gray && !rgb) continue;
    const predictor = Number((/\/Predictor\s+(\d+)/.exec(dict) || [])[1] || 1);
    images.push({
      filter: jpeg ? "jpeg" : "flate",
      offset: start,
      length: end - start,
      width,
      height,
      channels: gray && !rgb ? 1 : 3,
      predictor
    });
  }
  const kept = [];
  for (const image of images) {
    const previous = kept[kept.length - 1];
    if (previous && previous.width === image.width && previous.height === image.height) {
      if (image.filter === "jpeg" && previous.filter !== "jpeg") kept[kept.length - 1] = image;
      continue;
    }
    kept.push(image);
  }
  return kept;
}

export async function rasterForImage(buffer, image) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const slice = bytes.subarray(image.offset, image.offset + image.length);
  if (image.filter === "jpeg") {
    if (slice[0] !== 0xff || slice[1] !== 0xd8) return null;
    return { kind: "jpeg", bytes: slice, width: image.width, height: image.height };
  }
  const inflated = await inflate(slice);
  if (!inflated) return null;
  const expected = image.width * image.height * image.channels;
  let pixels = inflated;
  if (image.predictor >= 10) pixels = unfilterRows(inflated, image.width, image.channels);
  else if (inflated.length < expected) return null;
  if (!pixels || pixels.length < expected) return null;
  return {
    kind: "raw",
    width: image.width,
    height: image.height,
    channels: image.channels,
    pixels: pixels.subarray(0, expected)
  };
}
