export const catalog = {
  FREE: { price: 0, staff: 1, limit: 30 },
  SOLO: { price: 99, staff: 1, limit: null },
  TEAM: { price: 299, staff: 5, limit: null },
  BUSINESS: { price: 599, staff: 15, limit: null },
} as const;
