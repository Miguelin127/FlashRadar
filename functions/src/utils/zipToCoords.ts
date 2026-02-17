const zipCoords: Record<string, { latitude: number; longitude: number }> = {
  '60601': { latitude: 41.8864, longitude: -87.6231 },
  '90210': { latitude: 34.0901, longitude: -118.4065 },
  '10001': { latitude: 40.7128, longitude: -74.006 },
  '30301': { latitude: 33.749, longitude: -84.388 },
};

export default function getCoordsFromZip(zip: string) {
  return zipCoords[zip];
}
