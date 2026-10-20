import { ConfigService } from '@nestjs/config';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { WorkImageStorageService } from './work-image-storage.service';

describe('WorkImageStorageService', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'slotty-work-images-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('stores, reads and removes optimized images locally', async () => {
    const config = new ConfigService({
      WORK_EXAMPLES_DIR: root,
      WORK_EXAMPLES_STORAGE: 'local',
    });
    const service = new WorkImageStorageService(config);
    const source = await sharp({
      create: { width: 32, height: 32, channels: 3, background: '#c7ff31' },
    }).png().toBuffer();

    const stored = await service.store('38ea57df-4e62-46b3-b878-99b591e2bc2e', source);
    const [full, thumbnail] = await Promise.all([
      service.read(stored.storageKey),
      service.read(stored.thumbnailKey),
    ]);

    expect(full.length).toBeGreaterThan(0);
    expect(thumbnail.length).toBeGreaterThan(0);
    await service.remove(stored.storageKey, stored.thumbnailKey);
    await expect(service.read(stored.storageKey)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects path traversal keys', async () => {
    const service = new WorkImageStorageService(new ConfigService({ WORK_EXAMPLES_DIR: root }));
    await expect(service.read('../secret')).rejects.toThrow('Invalid work image key');
  });
});
