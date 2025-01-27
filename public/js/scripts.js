async function fetchData() {
    const response = await fetch('/api/devices');
    const data = await response.json();
    const tableBody = document.getElementById('table-body');
    tableBody.innerHTML = '';
    data.forEach(device => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${device.ID}</td>
        <td>${device.device}</td>
        <td>${device.longitude}</td>
        <td>${device.latitude}</td>
      `;
      tableBody.appendChild(row);
    });
  }
  
  setInterval(fetchData, 1000); // Fetch data every second