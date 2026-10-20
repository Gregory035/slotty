import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';

@Injectable()
export class WorkImageStorageService {
  private readonly root: string;
  private readonly bucket?: string;
  private readonly s3?: S3Client;

  constructor(config: ConfigService) {
    this.root = resolve(config.get<string>('WORK_EXAMPLES_DIR') || './data/work-examples');
    if (config.get<string>('WORK_EXAMPLES_STORAGE') !== 's3') return;

    this.bucket = config.getOrThrow<string>('S3_BUCKET');
    this.s3 = new S3Client({
      endpoint: config.get<string>('S3_ENDPOINT'),
      region: config.get<string>('S3_REGION') || 'us-east-1',
      forcePathStyle: config.get<boolean>('S3_FORCE_PATH_STYLE') ?? false,
      credentials: {
        accessKeyId: config.getOrThrow<string>('S3_ACCESS_KEY_ID'),
        secretAccessKey: config.getOrThrow<string>('S3_SECRET_ACCESS_KEY'),
      },
    });
  }

  async store(companyId: string, buffer: Buffer) {
    const base = `${companyId}/${randomUUID()}`;
    const storageKey = `${base}.webp`;
    const thumbnailKey = `${base}-thumb.webp`;
    const image = sharp(buffer, { failOn: 'warning' }).rotate();
    const [full, thumbnail] = await Promise.all([
      image.clone().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(),
      image.clone().resize({ width: 480, height: 480, fit: 'cover', withoutEnlargement: true }).webp({ quality: 76 }).toBuffer(),
    ]);
    await Promise.all([this.write(storageKey, full), this.write(thumbnailKey, thumbnail)]);
    return { storageKey, thumbnailKey, mimeType: 'image/webp' };
  }

  async read(key: string): Promise<Buffer> {
    this.assertSafeKey(key);
    if (!this.s3 || !this.bucket) return readFile(this.pathFor(key));
    const result = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!result.Body) throw new Error('Work image object has no body');
    return Buffer.from(await result.Body.transformToByteArray());
  }

  async remove(...keys: Array<string | null | undefined>) {
    const filtered = keys.filter((key): key is string => Boolean(key));
    filtered.forEach((key) => this.assertSafeKey(key));
    if (this.s3 && this.bucket && filtered.length) {
      await this.s3.send(new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: { Objects: filtered.map((Key) => ({ Key })), Quiet: true },
      }));
      return;
    }
    await Promise.all(filtered.map((key) => unlink(this.pathFor(key)).catch(() => undefined)));
  }

  private pathFor(key: string) {
    this.assertSafeKey(key);
    const path = resolve(this.root, key);
    return path;
  }

  private assertSafeKey(key: string): void {
    if (!/^[a-f0-9-]+\/[a-f0-9-]+(?:-thumb)?\.webp$/i.test(key)) {
      throw new Error('Invalid work image key');
    }
  }

  private async write(key: string, data: Buffer): Promise<void> {
    if (this.s3 && this.bucket) {
      await this.s3.send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable',
      }));
      return;
    }
    const target = this.pathFor(key);
    const temporary = `${target}.tmp`;
    await mkdir(dirname(target), { recursive: true });
    await writeFile(temporary, data, { flag: 'wx' });
    await rename(temporary, target);
  }
}
