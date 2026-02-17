import { analyzeFlip } from "./analyzeFlip";
import { PricePoint } from "../utils/priceHistory";

const mockPriceHistory: PricePoint[] = [
  { date: Date.now() - 1000 * 60 * 60 * 24 * 180, price: 120 },
  { date: Date.now() - 1000 * 60 * 60 * 24 * 90, price: 98 },
  { date: Date.now() - 1000 * 60 * 60 * 24 * 30, price: 92 },
  { date: Date.now(), price: 89 },
];

const result = analyzeFlip({
  userId: "test-user-123",
  title: "Test Product – Bluetooth Headphones",
  buyPrice: 55,
  priceHistory: mockPriceHistory,
  demand: "HIGH",
  dealOrigin: "OVERSTOCK",
  source: "LINK",
  platformInputs: {
    amazon: {
      resalePrice: 119,
      buyPrice: 55,
      estimatedFees: 18,
      demand: "HIGH",
    },
    ebay: {
      resalePrice: 110,
      buyPrice: 55,
      estimatedFees: 14,
      demand: "MEDIUM",
    },
    fb: {
      resalePrice: 95,
      buyPrice: 55,
      estimatedFees: 0,
      demand: "LOW",
    },
  },
});

console.log("FLIP RESULT ↓↓↓");
console.log(JSON.stringify(result, null, 2));

