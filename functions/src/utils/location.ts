// flashradar/utils/location.ts

/**
 * Get latitude/longitude from a ZIP code.
 * Right now this is just a placeholder that always returns {0,0}.
 * Later, integrate with a geocoding API like Google Maps or OpenCage.
 */
export async function getCoordsFromZip(
  zip: string
): Promise<{ latitude: number; longitude: number }> {
  console.log(`getCoordsFromZip called with zip: ${zip}`);
  return { latitude: 0, longitude: 0 };
}
