// Share links keep the whole inventory in the page address after the #, so nothing is sent to a server.
import { parseImport, snapshot } from './state';
import type { State } from './state';

const b64 = (bytes: Uint8Array): string => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64 = (t: string): Uint8Array => Uint8Array.from(atob(t.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const pipe = async (data: Uint8Array, t: CompressionStream | DecompressionStream) =>
  new Uint8Array(await new Response(new Blob([data as BlobPart]).stream().pipeThrough(t)).arrayBuffer());

/** "z" links are compressed, "j" links are plain JSON (used when the browser cannot compress). */
export async function encodeShare(st: State): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(snapshot(st)));
  if (typeof CompressionStream !== 'undefined') {
    try { return 's=z' + b64(await pipe(json, new CompressionStream('deflate-raw'))); } catch { /* fall through */ }
  }
  return 's=j' + b64(json);
}

/** Returns the shared inventory, or null when the hash holds none or it is damaged. */
export async function decodeShare(hash: string): Promise<State | null> {
  const m = /^#?s=([zj])([A-Za-z0-9_-]+)$/.exec(hash);
  if (!m || m[2].length > 200_000) return null;
  try {
    let bytes = unb64(m[2]);
    if (m[1] === 'z') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
    return parseImport(JSON.parse(new TextDecoder().decode(bytes)));
  } catch { return null; }
}
