let map;
let routePath;
let mapInitialized = false;
let markers = []; // Declare markers array

function initMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 0, lng: 0 },
    zoom: 2,
  });

  const urlParams = new URLSearchParams(window.location.search);
  const deviceName = urlParams.get('name');

  // Set the device name in the placeholder
  document.getElementById("deviceName").textContent = deviceName;

  fetchCoordinatesAndUpdateMap(deviceName);
  setInterval(() => fetchCoordinatesAndUpdateMap(deviceName), 5000); // Update data every 5 seconds
}

function fetchCoordinatesAndUpdateMap(deviceName) {
  fetch(`/device_data?name=${deviceName}`)
    .then(response => response.json())
    .then(data => {
      const tableBody = document.querySelector("#deviceDataTable tbody");
      tableBody.innerHTML = "";  // Clear existing data

      const pathCoordinates = [];

      // Remove existing markers from the map
      markers.forEach(marker => marker.setMap(null));
      markers = []; // Clear the markers array

      data.forEach(row => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${row.longitude}</td>
          <td>${row.latitude}</td>
          <td>${row.timestamp}</td>
        `;
        tableBody.appendChild(tr);

        // Add coordinates to the path
        pathCoordinates.push({ lat: parseFloat(row.latitude), lng: parseFloat(row.longitude) });

        // Add marker for each point with a tooltip showing the timestamp
        const marker = new google.maps.Marker({
          position: { lat: parseFloat(row.latitude), lng: parseFloat(row.longitude) },
          map: map,
          title: `Timestamp: ${row.timestamp}`,
        });
        markers.push(marker); // Add the new marker to the markers array
      });

      // Remove existing polyline from the map
      if (routePath) {
        routePath.setMap(null);
      }

      // Draw the polyline
      routePath = new google.maps.Polyline({
        path: pathCoordinates,
        geodesic: true,
        strokeColor: '#FF0000',
        strokeOpacity: 1.0,
        strokeWeight: 2,
      });

      routePath.setMap(map);

      // Center the map to the first coordinate only if the map is not initialized
      if (!mapInitialized && pathCoordinates.length > 0) {
        const firstPoint = pathCoordinates[0];
        map.setCenter(firstPoint);
        map.setZoom(10);
        mapInitialized = true; // Set the flag to true after the first initialization
      }
    })
    .catch(error => console.error("Error fetching data:", error));
}

document.addEventListener("DOMContentLoaded", function() {
  initMap();
});