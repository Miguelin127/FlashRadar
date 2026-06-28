# Explore Feed Spec — Free/Premium Interleaving

## Goal
Free users get a useful feed (mostly free deals) while constantly being teased
with locked premium deals to drive upgrades.

## Feed pattern (free users only)
- Interleave: 20 free deals -> 6 premium deals (locked/blurred) -> repeat
- Premium deals: RANDOM from premium pool, but SESSION-STABLE
  (seed once per mount; don't reshuffle on every scroll/refresh, or pagination jitters)
- 400-deal cap still applies on top: the 20:6 pattern fills the 400,
  then "Upgrade to see 1000s of deals"
- Math: ~308 free + ~92 premium across the 400

## Premium users
- See everything unlocked, NO interleaving (20:6 is a free-tier mechanic only)

## Chips: tier toggle + store filter (two axes)
- NEW tier toggle: [ Free | All ]
  - "Free" = free-store deals only, no premium shown
  - "All"  = the interleaved 20:6 feed (free user) / everything (premium user)
- KEEP existing store chips below (Amazon, Walmart, Bestchoice, Ebay, etc.)
  so users can still filter to one store
- Tier toggle and store filter are independent axes

## Store tiers (source: constants/premiumStores.ts)
- FREE: walmart, target, homedepot, kingbull, outin, nike
- PREMIUM: amazon, bestbuy, costco, samsclub, lowes, walgreens, cvs,
  apple, ebay, bestchoice, satechi, hiby, philips + dept stores

## Known bugs to fix in same pass
1. Orphan "GRAB DEAL" buttons floating above grid (feed render/layout bug)
2. Ghost coupon text bleeds through blurred premium cards ("20% OFF: CODE")
3. MapScreen stuck dark (separate: 3rd premium definition + hardcoded dark theme)
4. Admin count gate: verify isAdmin matches (banner showed no count while on admin?)

## Build order
1. Interleave function (20:6, session-stable random)
2. Free/All tier toggle
3. Fix orphan GRAB DEAL layout
4. Verify 400 cap wraps it
