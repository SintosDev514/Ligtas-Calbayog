async function snapToRoad(lat, lng) {
  try {
    const res = await fetch(
      `https://router.project-osrm.org/nearest/v1/driving/${lng},${lat}?number=1`
    );
    const data = await res.json();
    if (data.code === "Ok" && data.waypoints?.length > 0) {
      const [snapLng, snapLat] = data.waypoints[0].location;
      return { lat: snapLat, lng: snapLng };
    }
    return null;
  } catch {
    return null;
  }
}

export async function openBestStreetView(lat, lng, Linking) {
  const road = await snapToRoad(lat, lng);
  const targetLat = road ? road.lat : lat;
  const targetLng = road ? road.lng : lng;
  const url = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${targetLat},${targetLng}`;
  Linking.openURL(url);
}
