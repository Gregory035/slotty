import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SystemStatusService } from './system-status.service';

describe('SystemStatusService', () => {
  const companyId = '6b89a7b4-4ac8-4424-922a-5d4fc44322a0';

  it('returns operational counts without exposing credentials', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'slotty-status-'));
    const statusFile = join(directory, 'backup.json');
    await writeFile(statusFile, JSON.stringify({ state: 'success', startedAt: '2026-10-20T10:00:00Z', finishedAt: '2026-10-20T10:01:00Z', remote: true }));
    const previous = process.env.BACKUP_STATUS_FILE;
    process.env.BACKUP_STATUS_FILE = statusFile;
    const prisma = {
      bot: { findUnique: jest.fn().mockResolvedValue({ username: 'slotty_bot', status: 'ACTIVE', errorMessage: null, updatedAt: new Date() }) },
      subscription: { findFirst: jest.fn().mockResolvedValue(null) },
      notification: { groupBy: jest.fn().mockResolvedValue([{ status: 'FAILED', _count: { _all: 2 } }]) },
      outboxEvent: { groupBy: jest.fn().mockResolvedValue([]) },
      telegramUpdate: { groupBy: jest.fn().mockResolvedValue([]) },
      payment: { groupBy: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
    };
    try {
      const result = await new SystemStatusService(prisma as never).get(companyId);
      expect(result.bot).toEqual(expect.objectContaining({ webhookConfigured: true }));
      expect(result.queues.notifications).toEqual({ FAILED: 2 });
      expect(result.backup).toEqual(expect.objectContaining({ state: 'success', remote: true }));
      expect(JSON.stringify(result)).not.toContain('RESEND_API_KEY');
    } finally {
      if (previous === undefined) delete process.env.BACKUP_STATUS_FILE;
      else process.env.BACKUP_STATUS_FILE = previous;
      await rm(directory, { recursive: true, force: true });
    }
  });
});
