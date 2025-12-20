// flashradar/types.ts

export interface Deal {
  id: string;
  title: string;
  store: string;
  price: number;
  originalPrice?: number;
  zip: string;
  image: string;
  timestamp?: any;

  // Optional fields used across Explore/Map/Radar
  rare?: boolean;
  discountPercent?: number;
  distance?: number; // distance calculated from ZIP or GPS
  latitude?: number;
  longitude?: number;
  category?: string;

  // Voting
  upVotes?: number;
  downVotes?: number;

  // Runtime-only fields (not stored in Firestore, but used in UI)
  isHot?: boolean;
  isLive?: boolean;
  isSaved?: boolean;
  distanceInMiles?: number | null;
}

export type RootStackParamList = {
  MainTabs: undefined;
  DealDetail: { deal: Deal };
  Home: undefined;
  Login: undefined;
  SignUp: undefined;
  Settings: undefined;
};
