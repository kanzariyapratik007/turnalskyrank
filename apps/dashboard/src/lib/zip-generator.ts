// Pure TypeScript / JavaScript ZIP archive generator (Zero dependencies)

function makeCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
}

const crcTable = makeCrcTable();

function crc32(data: Uint8Array): number {
  let crc = 0 ^ (-1);
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ data[i]) & 0xff];
  }
  return (crc ^ (-1)) >>> 0;
}

export interface ZipFileEntry {
  name: string;
  content: string | Uint8Array;
}

export function generateZip(files: ZipFileEntry[]): Blob {
  const encoder = new TextEncoder();
  const fileRecords: {
    nameBytes: Uint8Array;
    contentBytes: Uint8Array;
    crc: number;
    offset: number;
  }[] = [];

  const chunks: Uint8Array[] = [];
  let currentOffset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const contentBytes = typeof file.content === 'string' ? encoder.encode(file.content) : file.content;
    const fileCrc = crc32(contentBytes);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const dv = new DataView(localHeader.buffer);

    // Local file header signature: 0x04034b50 (PK\x03\x04)
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(4, 20, true); // Version needed to extract
    dv.setUint16(6, 0, true);  // General purpose bit flag
    dv.setUint16(8, 0, true);  // Compression method (0 = Stored / Uncompressed)
    dv.setUint16(10, 0, true); // Last mod file time
    dv.setUint16(12, 0, true); // Last mod file date
    dv.setUint32(14, fileCrc, true); // CRC-32
    dv.setUint32(18, contentBytes.length, true); // Compressed size
    dv.setUint32(22, contentBytes.length, true); // Uncompressed size
    dv.setUint16(26, nameBytes.length, true);    // File name length
    dv.setUint16(28, 0, true);                   // Extra field length

    localHeader.set(nameBytes, 30);

    fileRecords.push({
      nameBytes,
      contentBytes,
      crc: fileCrc,
      offset: currentOffset,
    });

    chunks.push(localHeader);
    chunks.push(contentBytes);

    currentOffset += localHeader.length + contentBytes.length;
  }

  // Central Directory
  const centralDirStart = currentOffset;
  let centralDirSize = 0;

  for (const rec of fileRecords) {
    const cdHeader = new Uint8Array(46 + rec.nameBytes.length);
    const dv = new DataView(cdHeader.buffer);

    // Central file header signature: 0x02014b50 (PK\x01\x02)
    dv.setUint32(0, 0x02014b50, true);
    dv.setUint16(4, 20, true);  // Version made by
    dv.setUint16(6, 20, true);  // Version needed to extract
    dv.setUint16(8, 0, true);   // General purpose bit flag
    dv.setUint16(10, 0, true);  // Compression method
    dv.setUint16(12, 0, true);  // Last mod file time
    dv.setUint16(14, 0, true);  // Last mod file date
    dv.setUint32(16, rec.crc, true); // CRC-32
    dv.setUint32(20, rec.contentBytes.length, true); // Compressed size
    dv.setUint32(24, rec.contentBytes.length, true); // Uncompressed size
    dv.setUint16(28, rec.nameBytes.length, true);    // File name length
    dv.setUint16(30, 0, true);                       // Extra field length
    dv.setUint16(32, 0, true);                       // File comment length
    dv.setUint16(34, 0, true);                       // Disk number start
    dv.setUint16(36, 0, true);                       // Internal file attributes
    dv.setUint32(38, 0, true);                       // External file attributes
    dv.setUint32(42, rec.offset, true);              // Relative offset of local header

    cdHeader.set(rec.nameBytes, 46);

    chunks.push(cdHeader);
    centralDirSize += cdHeader.length;
  }

  // End of Central Directory Record
  const eocd = new Uint8Array(22);
  const eocdDv = new DataView(eocd.buffer);

  // End of central dir signature: 0x06054b50 (PK\x05\x06)
  eocdDv.setUint32(0, 0x06054b50, true);
  eocdDv.setUint16(4, 0, true); // Number of this disk
  eocdDv.setUint16(6, 0, true); // Disk where central directory starts
  eocdDv.setUint16(8, fileRecords.length, true);  // Total entries on this disk
  eocdDv.setUint16(10, fileRecords.length, true); // Total entries in central directory
  eocdDv.setUint32(12, centralDirSize, true);     // Size of central directory
  eocdDv.setUint32(16, centralDirStart, true);    // Offset of start of central directory
  eocdDv.setUint16(20, 0, true);                  // Comment length

  chunks.push(eocd);

  return new Blob(chunks, { type: 'application/zip' });
}
