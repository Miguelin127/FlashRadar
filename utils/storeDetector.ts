export const STORE_DOMAINS: { [key: string]: string } = {
  'amazon.com': 'Amazon',
  'samsclub.com': "Sam's Club",
  'bestbuy.com': 'Best Buy',
  'target.com': 'Target',
  'walmart.com': 'Walmart',
  'costco.com': 'Costco',
  'lowes.com': "Lowe's",
  'homedepot.com': 'Home Depot',
  'walgreens.com': 'Walgreens',
  'cvs.com': 'CVS',
  'sephora.com': 'Sephora',
  'nike.com': 'Nike',
  'jcpenney.com': 'JC Penney',
  'macys.com': "Macy's",
  'ebay.com': 'eBay',
};

export function detectStoreFromUrl(urlString: string): string | null {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();
    
    for (const [domain, storeName] of Object.entries(STORE_DOMAINS)) {
      if (hostname.includes(domain)) {
        return storeName;
      }
    }
  } catch (e) {
    // Invalid URL
  }
  return null;
}
