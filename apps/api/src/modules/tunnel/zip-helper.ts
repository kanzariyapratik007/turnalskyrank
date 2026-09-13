import * as archiverPkg from 'archiver';

export interface ZipFileEntry {
  name: string;
  content: string | Buffer;
}

export async function createZipBuffer(entries: ZipFileEntry[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    let archive: any;
    const pkg: any = archiverPkg;

    if (pkg.ZipArchive) {
      archive = new pkg.ZipArchive({ zlib: { level: 9 } });
    } else if (typeof pkg.default === 'function') {
      archive = pkg.default('zip', { zlib: { level: 9 } });
    } else if (typeof pkg === 'function') {
      archive = pkg('zip', { zlib: { level: 9 } });
    } else if (pkg.default?.ZipArchive) {
      archive = new pkg.default.ZipArchive({ zlib: { level: 9 } });
    } else {
      archive = new (pkg as any)({ zlib: { level: 9 } });
    }

    const buffers: Buffer[] = [];
    archive.on('data', (chunk: Buffer) => buffers.push(chunk));
    archive.on('end', () => resolve(Buffer.concat(buffers)));
    archive.on('error', (err: any) => reject(err));

    for (const entry of entries) {
      archive.append(entry.content, { name: entry.name });
    }

    archive.finalize();
  });
}
