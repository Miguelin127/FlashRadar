export function getDealRetailer(deal: any): string {
  const url = deal.merchantUrl || deal.affiliateUrl || deal.url || '';
  
  if (!url) {
    return (deal.store || '').toLowerCase().replace(/\.com|\.ca/g, '').trim();
  }

  try {
    const hostname = new URL(url).hostname.toLowerCase();
    
    if (hostname.includes('amazon')) return 'amazon';
    if (hostname.includes('target')) return 'target';
    if (hostname.includes('walmart')) return 'walmart';
    if (hostname.includes('bestbuy') || hostname.includes('best-buy')) return 'best buy';
    if (hostname.includes('cvs')) return 'cvs';
    if (hostname.includes('homedepot') || hostname.includes('home-depot')) return 'home depot';
    if (hostname.includes('walgreens')) return 'walgreens';
    if (hostname.includes('sephora')) return 'sephora';
    
    return (deal.store || '').toLowerCase().replace(/\.com|\.ca/g, '').trim();
  } catch {
    return (deal.store || '').toLowerCase().replace(/\.com|\.ca/g, '').trim();
  }
}
