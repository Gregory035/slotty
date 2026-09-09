import { BadRequestException } from '@nestjs/common';

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface DateIdCursor {
  date: string;
  id: string;
}

export function encodeCursor(cursor: DateIdCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeCursor(value?: string): DateIdCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as DateIdCursor;
    if (
      typeof parsed.id !== 'string' ||
      typeof parsed.date !== 'string' ||
      Number.isNaN(new Date(parsed.date).getTime())
    ) {
      throw new Error('invalid cursor');
    }
    return parsed;
  } catch {
    throw new BadRequestException('Invalid pagination cursor');
  }
}

export function pageFromRows<T>(
  rows: T[],
  limit: number,
  cursorFor: (row: T) => DateIdCursor,
): CursorPage<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  return {
    items,
    hasMore,
    nextCursor: hasMore && last ? encodeCursor(cursorFor(last)) : null,
  };
}
