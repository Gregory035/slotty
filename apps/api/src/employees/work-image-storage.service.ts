import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';

@Injectable()
export class WorkImageStorageService {
  private readonly root = resolve(process.env.WORK_EXAMPLES_DIR || './data/work-examples');

  async store(companyId: string, buffer: Buffer) {
    const base = `${companyId}/${randomUUID()}`;
    const storageKey = `${base}.webp`;
    const thumbnailKey = `${base}-thumb.webp`;
    const image = sharp(buffer, { failOn: 'warning' }).rotate();
    const [full, thumbnail] = await Promise.all([
      image.clone().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(),
      image.clone().resize({ width: 480, height: 480, fit: 'cover', withoutEnlargement: true }).webp({ quality: 76 }).toBuffer(),
    ]);
    await Promise.all([this.writeAtomic(storageKey, full), this.writeAtomic(thumbnailKey, thumbnail)]);
    return { storageKey, thumbnailKey, mimeType: 'image/webp' };
  }

  read(key: string) { return readFile(this.pathFor(key)); }

  async remove(...keys: Array<string | null | undefined>) {
    await Promise.all(keys.filter((key): key is string => Boolean(key)).map((key) => unlink(this.pathFor(key)).catch(() => undefined)));
  }

  private pathFor(key: string) {
    const path = resolve(this.root, key);
    if (!path.startsWith(`${this.root}/`)) throw new Error('Invalid work image key');
    return path;
  }

  private async writeAtomic(key: string, data: Buffer) {
    const target = this.pathFor(key);
    const temporary = `${target}.tmp`;
    await mkdir(dirname(target), { recursive: true });
    await writeFile(temporary, data, { flag: 'wx' });
    await rename(temporary, target);
  }
}
