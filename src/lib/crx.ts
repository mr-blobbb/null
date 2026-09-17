/* NULL · crx.ts
   Reading a Chrome extension without Chrome.

   A .crx is a zip with a header glued on the front, and the browser already
   has everything needed to open one: `DecompressionStream("deflate-raw")` is a
   zip's compression method, so no unzip library is required for the whole of
   this file.

   What comes out is a manifest and a map of path → bytes. That is enough to
   list what an extension is, what it asks for, and — for the simple ones — to
   run its popup. */

export type Manifest = {
  manifest_version?: number;
  name?: string;
  version?: string;
  description?: string;
  permissions?: string[];
  host_permissions?: string[];
  optional_permissions?: string[];
  background?: { service_worker?: string; scripts?: string[]; page?: string };
  content_scripts?: { js?: string[]; css?: string[]; matches?: string[] }[];
  action?: { default_popup?: string; default_title?: string };
  browser_action?: { default_popup?: string };
  options_page?: string;
  options_ui?: { page?: string };
  icons?: Record<string, string>;
};

export type Pack = {
  manifest: Manifest;
  files: Map<string, Uint8Array>;
  /** where the popup page lives inside the pack, if it has one */
  popup: string | null;
};

/* ---------- the container ---------- */

/** Strip the CRX header and hand back the zip underneath. Both container
 *  versions are supported: 3 is what the Web Store ships, 2 is what older
 *  `.crx` files floating around the internet are. */
export function unwrapCrx(bytes: Uint8Array): Uint8Array {
  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (magic !== "Cr24") throw new Error("that file is not a .crx");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = view.getUint32(4, true);
  if (version === 3) {
    const header = view.getUint32(8, true);
    return bytes.subarray(12 + header);
  }
  if (version === 2) {
    const pub = view.getUint32(8, true);
    const sig = view.getUint32(12, true);
    return bytes.subarray(16 + pub + sig);
  }
  throw new Error(`a .crx version ${version} container is not something NULL knows how to open`);
}

/* ---------- the zip ---------- */

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

async function inflate(raw: Uint8Array, method: number): Promise<Uint8Array> {
  if (method === 0) return raw;
  if (method !== 8) throw new Error(`zip entry uses compression method ${method}`);
  const stream = new Blob([raw as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Read every file in a zip. Directories are skipped: this only cares about
 *  the files an extension is made of. */
export async function readZip(bytes: Uint8Array): Promise<Map<string, Uint8Array>> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  /* the end-of-central-directory record sits at the very end, possibly after
     a comment, so it is found by scanning backwards */
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0 && i > bytes.length - 66000; i--) {
    if (view.getUint32(i, true) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("that zip has no index — it may be truncated");

  const count = view.getUint16(eocd + 10, true);
  let at = view.getUint32(eocd + 16, true);
  const files = new Map<string, Uint8Array>();

  for (let n = 0; n < count; n++) {
    if (view.getUint32(at, true) !== CENTRAL) break;
    const method = view.getUint16(at + 10, true);
    const compressed = view.getUint32(at + 20, true);
    const nameLen = view.getUint16(at + 28, true);
    const extraLen = view.getUint16(at + 30, true);
    const commentLen = view.getUint16(at + 32, true);
    const localAt = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLen));

    if (!name.endsWith("/")) {
      const lNameLen = view.getUint16(localAt + 26, true);
      const lExtraLen = view.getUint16(localAt + 28, true);
      const start = localAt + 30 + lNameLen + lExtraLen;
      const raw = bytes.subarray(start, start + compressed);
      try {
        files.set(name, await inflate(raw, method));
      } catch {
        /* one unreadable file should not lose the other two hundred */
        files.set(name, new Uint8Array());
      }
    }
    at += 46 + nameLen + extraLen + commentLen;
  }

  return files;
}

/* ---------- the pack ---------- */

const decoder = new TextDecoder();

export async function openCrx(bytes: Uint8Array): Promise<Pack> {
  const files = await readZip(unwrapCrx(bytes));
  const raw = files.get("manifest.json");
  if (!raw) throw new Error("that extension has no manifest.json, so there is nothing to read");
  let manifest: Manifest;
  try {
    manifest = JSON.parse(decoder.decode(raw)) as Manifest;
  } catch {
    throw new Error("that extension's manifest.json is not valid JSON");
  }
  const popup = manifest.action?.default_popup ?? manifest.browser_action?.default_popup ?? manifest.options_ui?.page ?? manifest.options_page ?? null;
  return { manifest, files, popup: popup ?? null };
}
