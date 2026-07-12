import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';

export const MXG_PYVISA_ARCHIVE_NAME = 'rf-wiki-mxg-pyvisa.zip';
export const MXG_PYVISA_CHECKSUM_NAME = `${MXG_PYVISA_ARCHIVE_NAME}.sha256`;
export const MXG_PYVISA_ROOT = 'rf-wiki-mxg-pyvisa';

const MXG_PYVISA_PACKAGE_DIRECTORY = 'examples/mxg_pyvisa';
const MXG_PYVISA_GUIDE = 'docs/MXG_PYVISA_GUIDE.md';
const ALLOWED_SOURCE_EXTENSIONS = new Set(['.json', '.md', '.py', '.txt']);

function compareArchivePaths(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** Discover the complete source tree while rejecting symlinks and unexpected artifacts. */
export async function listMxgPyvisaSourceFiles(projectRoot) {
  const discovered = [MXG_PYVISA_GUIDE];
  const packageRoot = resolve(projectRoot, MXG_PYVISA_PACKAGE_DIRECTORY);

  async function visit(directory, relativeDirectory = '') {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => compareArchivePaths(left.name, right.name));
    for (const entry of entries) {
      if (entry.name === '__pycache__' || entry.name === '.DS_Store') continue;
      const relativePath = relativeDirectory
        ? `${relativeDirectory}/${entry.name}`
        : entry.name;
      const absolutePath = resolve(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new TypeError(`MXG package source may not contain symlinks: ${relativePath}`);
      }
      if (entry.isDirectory()) {
        await visit(absolutePath, relativePath);
        continue;
      }
      if (!entry.isFile()) {
        throw new TypeError(`Unsupported MXG package source entry: ${relativePath}`);
      }
      if (!ALLOWED_SOURCE_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
        throw new TypeError(`Unexpected MXG package source file type: ${relativePath}`);
      }
      discovered.push(`${MXG_PYVISA_PACKAGE_DIRECTORY}/${relativePath}`);
    }
  }

  await visit(packageRoot);
  return Object.freeze(discovered.sort(compareArchivePaths));
}

const CRC32_TABLE = new Uint32Array(256);
for (let index = 0; index < CRC32_TABLE.length; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  CRC32_TABLE[index] = value >>> 0;
}

function crc32(data) {
  let value = 0xffffffff;
  for (const byte of data) {
    value = CRC32_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function normalizedArchivePath(path) {
  const normalized = path.replaceAll('\\', '/');
  if (!normalized || normalized.startsWith('/') || normalized.split('/').includes('..')) {
    throw new TypeError(`Unsafe ZIP entry path: ${path}`);
  }
  return normalized;
}

/** Build a deterministic, store-only ZIP with fixed DOS timestamp 1980-01-01 00:00:00. */
export function createDeterministicZip(entries) {
  const sorted = [...entries]
    .map(({ path, data }) => ({
      path: normalizedArchivePath(path),
      data: Buffer.from(data),
    }))
    .sort((left, right) => compareArchivePaths(left.path, right.path));

  if (new Set(sorted.map(({ path }) => path)).size !== sorted.length) {
    throw new TypeError('ZIP manifest contains duplicate paths.');
  }

  const localParts = [];
  const centralParts = [];
  let localOffset = 0;
  const utf8Flag = 0x0800;
  const dosTime = 0;
  const dosDate = 0x0021;

  for (const entry of sorted) {
    const name = Buffer.from(entry.path, 'utf8');
    const checksum = crc32(entry.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(utf8Flag, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(entry.data.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, entry.data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x031e, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(utf8Flag, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(entry.data.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    central.writeUInt32LE(localOffset, 42);
    centralParts.push(central, name);

    localOffset += local.length + name.length + entry.data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(sorted.length, 8);
  end.writeUInt16LE(sorted.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

export function sha256Hex(data) {
  return createHash('sha256').update(data).digest('hex');
}

export async function buildMxgPyvisaPackage(projectRoot) {
  const sourceFiles = await listMxgPyvisaSourceFiles(projectRoot);
  const entries = await Promise.all(sourceFiles.map(async (sourcePath) => ({
    path: `${MXG_PYVISA_ROOT}/${sourcePath}`,
    data: await readFile(resolve(projectRoot, sourcePath)),
  })));
  const archive = createDeterministicZip(entries);
  const sha256 = sha256Hex(archive);
  const manifest = Object.freeze(sourceFiles.map((path) => `${MXG_PYVISA_ROOT}/${path}`));
  return {
    archive,
    sha256,
    checksum: `${sha256}  ${MXG_PYVISA_ARCHIVE_NAME}\n`,
    manifest,
  };
}

function findEndOfCentralDirectory(archive) {
  const signature = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  const offset = archive.lastIndexOf(signature);
  if (offset < 0 || offset + 22 > archive.length) {
    throw new TypeError('ZIP end-of-central-directory record is missing.');
  }
  return offset;
}

/** Parse and CRC-check the store-only archive produced above. */
export function readStoredZipEntries(input) {
  const archive = Buffer.from(input);
  const endOffset = findEndOfCentralDirectory(archive);
  const entryCount = archive.readUInt16LE(endOffset + 10);
  const centralSize = archive.readUInt32LE(endOffset + 12);
  const centralOffset = archive.readUInt32LE(endOffset + 16);
  if (centralOffset + centralSize !== endOffset) {
    throw new TypeError('ZIP central-directory bounds are inconsistent.');
  }

  const entries = new Map();
  let cursor = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (archive.readUInt32LE(cursor) !== 0x02014b50) {
      throw new TypeError(`ZIP central entry ${index} has an invalid signature.`);
    }
    const method = archive.readUInt16LE(cursor + 10);
    const expectedCrc = archive.readUInt32LE(cursor + 16);
    const compressedSize = archive.readUInt32LE(cursor + 20);
    const uncompressedSize = archive.readUInt32LE(cursor + 24);
    const nameLength = archive.readUInt16LE(cursor + 28);
    const extraLength = archive.readUInt16LE(cursor + 30);
    const commentLength = archive.readUInt16LE(cursor + 32);
    const localOffset = archive.readUInt32LE(cursor + 42);
    const nameStart = cursor + 46;
    const path = normalizedArchivePath(archive.subarray(nameStart, nameStart + nameLength).toString('utf8'));

    if (method !== 0 || compressedSize !== uncompressedSize) {
      throw new TypeError(`${path} is not a store-only ZIP entry.`);
    }
    if (archive.readUInt32LE(localOffset) !== 0x04034b50) {
      throw new TypeError(`${path} has an invalid local-file header.`);
    }
    const localNameLength = archive.readUInt16LE(localOffset + 26);
    const localExtraLength = archive.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const data = archive.subarray(dataStart, dataStart + uncompressedSize);
    if (data.length !== uncompressedSize || crc32(data) !== expectedCrc) {
      throw new TypeError(`${path} failed ZIP size or CRC verification.`);
    }
    if (entries.has(path)) throw new TypeError(`ZIP contains duplicate entry: ${path}`);
    entries.set(path, Buffer.from(data));
    cursor = nameStart + nameLength + extraLength + commentLength;
  }

  if (cursor !== endOffset || entries.size !== entryCount) {
    throw new TypeError('ZIP central-directory entry count is inconsistent.');
  }
  return entries;
}

export async function extractStoredZip(input, destination) {
  const root = resolve(destination);
  const entries = readStoredZipEntries(input);
  for (const [archivePath, data] of entries) {
    const target = resolve(root, archivePath);
    if (target !== root && !target.startsWith(`${root}${sep}`)) {
      throw new TypeError(`ZIP entry escapes extraction root: ${archivePath}`);
    }
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, data);
  }
  return [...entries.keys()];
}
