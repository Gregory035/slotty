import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';
import { access, readFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

const apply = process.argv.includes('--apply');
const deleteLocal = process.argv.includes('--delete-local');
const required = ['DATABASE_URL', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) throw new Error(`Missing environment variables: ${missing.join(', ')}`);
if (deleteLocal && !apply) throw new Error('--delete-local requires --apply');

const root = resolve(process.env.WORK_EXAMPLES_DIR || './data/work-examples');
const bucket = process.env.S3_BUCKET;
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || 'us-east-1',
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
});
const prisma = new PrismaClient();

try {
  const rows = await prisma.workExample.findMany({
    where: { OR: [{ imageData: { not: null } }, { storageKey: { not: null } }] },
    select: { id: true, companyId: true, imageData: true, storageKey: true, thumbnailKey: true },
    orderBy: { createdAt: 'asc' },
  });
  let migrated = 0;
  let skipped = 0;
  for (const row of rows) {
    const base = `${row.companyId}/${row.id}`;
    const storageKey = row.storageKey || `${base}.webp`;
    const thumbnailKey = row.thumbnailKey || `${base}-thumb.webp`;
    const source = row.imageData ? Buffer.from(row.imageData) : await readLocal(storageKey);
    if (!source) {
      console.warn(`skip ${row.id}: source image not found`);
      skipped += 1;
      continue;
    }
    const full = row.imageData
      ? await sharp(source, { failOn: 'warning' }).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer()
      : source;
    const thumbnail = row.imageData
      ? await sharp(source, { failOn: 'warning' }).rotate().resize({ width: 480, height: 480, fit: 'cover', withoutEnlargement: true }).webp({ quality: 76 }).toBuffer()
      : await readLocal(thumbnailKey) || await sharp(source).resize({ width: 480, height: 480, fit: 'cover', withoutEnlargement: true }).webp({ quality: 76 }).toBuffer();
    if (apply) {
      await Promise.all([
        upload(storageKey, full),
        upload(thumbnailKey, thumbnail),
      ]);
      await prisma.workExample.update({
        where: { id: row.id },
        data: { storageKey, thumbnailKey, mimeType: 'image/webp', imageData: null },
      });
      if (deleteLocal) await Promise.all([removeLocal(storageKey), removeLocal(thumbnailKey)]);
    }
    migrated += 1;
  }
  console.log(`${apply ? 'Migrated' : 'Ready to migrate'}: ${migrated}; skipped: ${skipped}`);
  if (!apply) console.log('Dry run only. Repeat with --apply after checking the result.');
} finally {
  await prisma.$disconnect();
}

async function upload(Key, Body) {
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key,
    Body,
    ContentType: 'image/webp',
    CacheControl: 'public, max-age=31536000, immutable',
  }));
}

async function readLocal(key) {
  const file = resolve(root, key);
  if (!file.startsWith(`${root}/`)) return null;
  try {
    await access(file);
    return await readFile(file);
  } catch {
    return null;
  }
}

async function removeLocal(key) {
  const file = resolve(root, key);
  if (file.startsWith(`${root}/`)) await unlink(file).catch(() => undefined);
}
