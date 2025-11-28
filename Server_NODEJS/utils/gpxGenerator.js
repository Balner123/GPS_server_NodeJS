/**
 * Generates a GPX string from an array of location objects.
 * @param {string} deviceName - Name of the device.
 * @param {Array<object>} locations - Array of location objects.
 * @returns {string} - XML string in GPX format.
 */
function generateGpx(deviceName, locations) {
    let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="GPS Server" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${deviceName} - GPS Track</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
  <trk>
    <name>${deviceName}</name>
    <trkseg>`;

    locations.forEach(loc => {
        gpx += `
      <trkpt lat="${loc.latitude}" lon="${loc.longitude}">
        <ele>${loc.altitude || 0}</ele>
        <time>${new Date(loc.timestamp).toISOString()}</time>
        <speed>${loc.speed || 0}</speed>
      </trkpt>`;
    });

    gpx += `
    </trkseg>
  </trk>
</gpx>`;
    return gpx;
}

module.exports = { generateGpx };
