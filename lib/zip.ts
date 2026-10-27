import {
  isSafeGeneratedPath,
  MAX_GENERATED_FILE_BYTES,
  MAX_GENERATED_FILES,
} from './generated-file-policy';
import type { GeneratedFile } from './generated-files';

const encoder = new TextEncoder();
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let value = n;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  crcTable[n] = value >>> 0;
}

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function header(size: number) {
  return new Uint8Array(size);
}

function join(chunks: Uint8Array[]) {
  const result = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

/** Creates a UTF-8, uncompressed ZIP archive without requiring a server or third-party code. */
export function createZip(files: GeneratedFile[]) {
  if (!files.length || files.length > MAX_GENERATED_FILES)
    throw new Error('Invalid ZIP file list.');
  const seen = new Set<string>();
  let totalBytes = 0;
  const entries = files.map((file) => {
    if (!isSafeGeneratedPath(file.path)) throw new Error('Unsafe file path in ZIP bundle.');
    const normalized = file.path.toLowerCase();
    if (seen.has(normalized)) throw new Error('ZIP bundle contains duplicate file paths.');
    seen.add(normalized);
    const name = encoder.encode(file.path);
    const content = encoder.encode(file.content);
    totalBytes += content.length;
    if (totalBytes > MAX_GENERATED_FILE_BYTES) throw new Error('ZIP bundle is too large.');
    return { name, content, crc: crc32(content) };
  });

  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;
  for (const entry of entries) {
    const local = header(30 + entry.name.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true); // UTF-8 names
    localView.setUint16(8, 0, true); // Stored, no compression
    localView.setUint16(10, 0, true); // fixed 1980-01-01 timestamp
    localView.setUint16(12, 0x0021, true);
    localView.setUint32(14, entry.crc, true);
    localView.setUint32(18, entry.content.length, true);
    localView.setUint32(22, entry.content.length, true);
    localView.setUint16(26, entry.name.length, true);
    localView.setUint16(28, 0, true);
    local.set(entry.name, 30);
    localParts.push(local, entry.content);

    const central = header(46 + entry.name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0x0021, true);
    centralView.setUint32(16, entry.crc, true);
    centralView.setUint32(20, entry.content.length, true);
    centralView.setUint32(24, entry.content.length, true);
    centralView.setUint16(28, entry.name.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, localOffset, true);
    central.set(entry.name, 46);
    centralParts.push(central);
    localOffset += local.length + entry.content.length;
  }

  const centralDirectory = join(centralParts);
  const end = header(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralDirectory.length, true);
  endView.setUint32(16, localOffset, true);
  endView.setUint16(20, 0, true);
  return join([...localParts, centralDirectory, end]);
}
