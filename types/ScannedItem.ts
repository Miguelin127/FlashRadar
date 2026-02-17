// types/ScannedItem.ts

export type ScannedItem = {
  id: string;
  uid: string;
  type: "barcode" | "image";
  barcode?: string;
  title: string;
  image?: string;
  source: "manual" | "api";
  createdAt: number;
};
