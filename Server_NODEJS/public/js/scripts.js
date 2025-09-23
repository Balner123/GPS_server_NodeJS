let map;
let markers = [];

function initMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 0, lng: 0 },
    zoom: 2,
  });

  fetchCoordinatesAndUpdateMap();
  setInterval(fetchCoordinatesAndUpdateMap, 5000); // Update data every 5 seconds
}

function fetchCoordinatesAndUpdateMap() {
  fetch("/api/devices/coordinates")
    .then(response => response.json())
    .then(data => {
      const tableBody = document.querySelector("#coordinatesTable tbody");
      tableBody.innerHTML = "";

      // Remove existing markers from the map
      markers.forEach(marker => marker.setMap(null));
      markers = [];

      data.forEach(row => {
        if (row) {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${row.device}</td>
            <td>${row.longitude}</td>
            <td>${row.latitude}</td>
            <td>${row.timestamp}</td>
          `;
          tr.addEventListener("click", () => {
            window.location.href = `/device?name=device_${row.device}`;
          });
          tableBody.appendChild(tr);

          // Add marker to the map with the tooltip "tracker:<number>"
          const marker = new google.maps.Marker({
            position: { lat: parseFloat(row.latitude), lng: parseFloat(row.longitude) },
            map: map,
            title: `tracker:${row.device}`
          });
          markers.push(marker); // Add the new marker to the markers array
        }
      });
    })
    .catch(error => console.error("Error fetching data:", error));
}

document.addEventListener("DOMContentLoaded", function() {
  initMap();
});