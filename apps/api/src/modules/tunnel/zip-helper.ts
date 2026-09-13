import archiver from 'archiver';

export interface ZipFileEntry {
  name: string;
  content: string | Buffer;
}

export async function createZipBuffer(entries: ZipFileEntry[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archiverFunc: any = (archiver as any).default || archiver;
    const archive = archiverFunc('zip', { zlib: { level: 9 } });
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
