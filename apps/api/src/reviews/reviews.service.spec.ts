import { ReviewsService } from './reviews.service';

describe('review dashboard', () => {
  it('uses full-dataset aggregates independently of the displayed page', async () => {
    const prisma: any = {
      review: {
        aggregate: jest.fn().mockResolvedValue({ _avg: { rating: 4.456 }, _count: 151 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'employee', name: 'Елена', average: 4.5, count: 151 }]),
    };
    const result = await new ReviewsService(prisma).dashboard('company');
    expect(result.summary).toEqual({ average: 4.5, count: 151 });
    expect(result.byEmployee[0]?.count).toBe(151);
    expect(result.items).toEqual([]);
    expect(prisma.review.aggregate).toHaveBeenCalledWith(expect.objectContaining({ where: { companyId: 'company' } }));
    expect(prisma.review.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 26, where: { companyId: 'company' } }));
    expect(result.nextCursor).toBeNull();
  });

  it('rejects an invalid cursor before querying the database', async () => {
    const prisma: any = { review: { aggregate: jest.fn() } };
    await expect(new ReviewsService(prisma).dashboard('company', 'invalid')).rejects.toThrow('Invalid pagination cursor');
    expect(prisma.review.aggregate).not.toHaveBeenCalled();
  });
});
