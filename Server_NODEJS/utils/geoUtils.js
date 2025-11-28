/**
 * Checks if a GPS point is inside a polygon.
 * @param {object} point - The point to check, with 'latitude' and 'longitude'.
 * @param {Array<Array<number>>} polygon - An array of [longitude, latitude] pairs.
 * @returns {boolean} - True if the point is inside, false otherwise.
 */
function isPointInPolygon(point, polygon) {
    const x = point.longitude, y = point.latitude;
    let isInside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i][0], yi = polygon[i][1];
        const xj = polygon[j][0], yj = polygon[j][1];
        const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) isInside = !isInside;
    }
    return isInside;
}

/**
 * Checks if a GPS point is inside a circle.
 * @param {object} point - The point to check, with 'latitude' and 'longitude'.
 * @param {object} circle - The circle object with 'center' ([lng, lat]) and 'radius' in meters.
 * @returns {boolean} - True if the point is inside, false otherwise.
 */
function isPointInCircle(point, circle) {
    const { center, radius } = circle;
    const R = 6371e3; // Earth's radius in meters
    const lat1 = point.latitude * Math.PI / 180;
    const lat2 = center[1] * Math.PI / 180;
    const deltaLat = (center[1] - point.latitude) * Math.PI / 180;
    const deltaLng = (center[0] - point.longitude) * Math.PI / 180;

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = R * c; // Distance in meters
    return distance <= radius;
}

/**
 * Calculates the Haversine distance between two points in meters.
 * @param {number} lat1 
 * @param {number} lon1 
 * @param {number} lat2 
 * @param {number} lon2 
 * @returns {number} Distance in meters.
 */
function getHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;
  
    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
    return R * c;
}

/**
 * Aggregates location points based on distance threshold.
 * @param {Array<object>} locations - Array of location objects, sorted by time.
 * @param {number} distanceThreshold - Distance threshold in meters.
 * @returns {Array<object>} - Aggregated locations.
 */
function clusterLocations(locations, distanceThreshold) {
    if (locations.length < 2) {
      return locations;
    }
  
    const clusteredLocations = [];
    let i = 0;
  
    while (i < locations.length) {
      const currentPoint = locations[i];
      const cluster = [currentPoint];
      let j = i + 1;
  
      while (j < locations.length) {
        const previousPointInCluster = cluster[cluster.length - 1];
        const nextPoint = locations[j];
        
        const distance = getHaversineDistance(
          previousPointInCluster.latitude,
          previousPointInCluster.longitude,
          nextPoint.latitude,
          nextPoint.longitude
        );
  
        if (distance < distanceThreshold) {
          cluster.push(nextPoint);
          j++;
        } else {
          break;
        }
      }
  
      if (cluster.length > 1) {
        const totalLat = cluster.reduce((sum, point) => sum + Number(point.latitude), 0);
        const totalLon = cluster.reduce((sum, point) => sum + Number(point.longitude), 0);
        
        const mergedPoint = {
          latitude: totalLat / cluster.length,
          longitude: totalLon / cluster.length,
          startTime: cluster[0].timestamp,
          endTime: cluster[cluster.length - 1].timestamp,
          type: 'cluster',
          device_id: currentPoint.device_id,
          clusterThreshold: distanceThreshold, // Pass threshold to frontend
          originalPoints: cluster 
        };
        clusteredLocations.push(mergedPoint);
      } else {
        clusteredLocations.push(currentPoint);
      }
      
      i = j; // Move main index past the processed cluster
    }
  
    return clusteredLocations;
}

module.exports = {
    isPointInPolygon,
    isPointInCircle,
    getHaversineDistance,
    clusterLocations
};
