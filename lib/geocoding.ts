// lib/geocoding.ts
export async function getCoords(address: string) {
  try {
    // Gọi API của OpenStreetMap để tìm tọa độ
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
    );
    const data = await response.json();

    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
      };
    }
    return null;
  } catch (error) {
    console.error("Lỗi Geocoding:", error);
    return null;
  }
}