// Single source of truth for premium-gated stores.
// FREE: walmart, target, homedepot, kingbull, outin, nike
// PREMIUM: everything in this list
export const PREMIUM_STORES = [
  "amazon", "bestbuy", "costco", "samsclub", "lowes",
  "walgreens", "cvs", "apple", "nordstrom", "bloomingdales",
  "neimanmarcus", "saks", "macys", "sephora", "footlocker",
  "gamestop", "tjmaxx", "marshalls", "ross", "burlington",
  "bestchoice", "satechi", "hiby", "philips", "ebay",
];

export const FREE_DEAL_LIMIT = 400; // Free users see max this many; premium unlimited

export function isStoreLocked(storeKey: string | undefined, isPremium: boolean): boolean {
  if (isPremium) return false;
  return PREMIUM_STORES.includes((storeKey || "").toLowerCase());
}
