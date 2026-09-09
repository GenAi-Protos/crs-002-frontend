// Reading a ZIP, which is what a DOCX is.
//
// The writer in zip.ts only ever stores; a Word document from anywhere else is
// deflated, so this side needs to inflate. DecompressionStream does that in the
// browser, which keeps the dependency count at zero.
//
// It reads the central directory rather than walking local headers, because a
// local header may carry sizes of zero and defer them to a data descriptor. The
// central directory always holds the real ones.

const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;

export interface UnzipEntry {
  name: string;
  data: Uint8Array;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  // deflate-raw is the ZIP method 8 payload: no zlib header.
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function unzip(buffer: ArrayBuffer): Promise<UnzipEntry[]> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  // The end-of-central-directory record sits in the last 64KB, after a comment
  // of unknown length, so it is found by scanning backwards for its signature.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Not a ZIP file, or the file is truncated.");

  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);

  const entries: UnzipEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (view.getUint32(offset, true) !== CEN_SIG) break;
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = new TextDecoder().decode(
      bytes.subarray(offset + 46, offset + 46 + nameLength),
    );

    // The local header repeats the name and extra field, and their lengths can
    // differ from the central copy, so they are read again here.
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const raw = bytes.subarray(start, start + compressedSize);

    if (method === 0) {
      entries.push({ name, data: raw });
    } else if (method === 8) {
      entries.push({ name, data: await inflateRaw(raw) });
    }
    // Any other method is skipped rather than guessed at. A DOCX uses 0 or 8.

    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

export async function readTextEntry(
  buffer: ArrayBuffer,
  name: string,
): Promise<string | null> {
  const entry = (await unzip(buffer)).find((e) => e.name === name);
  return entry ? new TextDecoder().decode(entry.data) : null;
}
