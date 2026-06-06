// flashradar/types.ts

export interface Deal {
  id: string;
  title: string;
  description?: string;
  store: string;
  storeKey?: string;
  price: number;
  originalPrice?: number;
  discountPercent?: number;
  zip?: string;
  image?: string;
  imageUrl?: string | null;
  images?: string[];
  timestamp?: any;
  publishedAt?: any;

  // Location
  latitude?: number;
  longitude?: number;
  distance?: number;
  distanceInMiles?: number | null;

  // Flags
  rare?: boolean;
  hot?: boolean;
  live?: boolean;
  isHot?: boolean;
  isLive?: boolean;
  isSaved?: boolean;
  lightning?: boolean;

  // Category / tier
  category?: string;
  tier?: "free" | "premium" | string | null;

  // Links
  url?: string | null;
  link?: string;
  merchantUrl?: string | null;
  affiliateUrl?: string | null;

  // Promo
  couponCode?: string;
  promoCode?: string;

  // Amazon
  asin?: string;

  // Voting
  upVotes?: number;
  downVotes?: number;

  // Scoring
  dealScore?: number;
  resaleIntel?: {
    marketValue: number;
    profitPotential: number;
    roiPercent: number;
    demandLevel: "NORMAL" | "HIGH" | "ULTRA";
  } | null;
}

export type RootStackParamList = {
  MainTabs: undefined;
  DealDetail: { deal: Deal };
  Home: undefined;
  Login: undefined;
  SignUp: undefined;
  Settings: undefined;
};