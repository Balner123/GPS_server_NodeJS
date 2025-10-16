# GPX Export Implementation Plan

This document outlines the steps to implement a GPX export feature for each device.

## 1. Backend Changes

### 1.1. Create a new API endpoint for GPX export.
- **File:** `routes/devices.api.js`
- **Route:** `GET /api/devices/export/gpx/:deviceId`
- **Middleware:** `isAuthenticated`, `isUser`
- **Controller Function:** `exportDeviceDataAsGpx`

### 1.2. Implement the GPX export logic in the controller.
- **File:** `controllers/deviceController.js`
- **Function:** `exportDeviceDataAsGpx(req, res)`
- **Logic:**
    1. Get `deviceId` from `req.params`.
    2. Find the device by `device_id` and `user_id` to ensure authorization.
    3. Fetch all location data for the device from the `locations` table, ordered by `timestamp`.
    4. Generate a GPX 1.1 formatted XML string from the location data.
    5. Set response headers:
        - `Content-Type`: `application/gpx+xml`
        - `Content-Disposition`: `attachment; filename="device_{deviceId}_export.gpx"`
    6. Send the GPX string as the response.

### 1.3. Create a GPX generation helper function.
- **File:** `controllers/deviceController.js` (or a new file in `utils`)
- **Function:** `generateGpx(deviceName, locations)`
- **Logic:**
    1. Create the GPX XML structure.
    2. Add a metadata section with the device name and export time.
    3. Create a track (`<trk>`) with a single track segment (`<trkseg>`).
    4. Iterate through the location data and add each point as a track point (`<trkpt>`) with `lat` and `lon` attributes.
    5. Inside each `<trkpt>`, add `<ele>`, `<time>`, and `<speed>` tags.
    6. Return the complete GPX XML string.

## 2. Frontend Changes

### 2.1. Add an "Export GPX" button to the UI.
- **File:** `views/manage-devices.ejs`
- **Location:** Inside the `device-info-card` div.
- **Element:** A new button with `id="export-gpx-btn"`.

### 2.2. Add an event listener to the button.
- **File:** `public/js/device.js`
- **Logic:**
    1. In the `selectDevice` function, when a device is selected, show the "Export GPX" button.
    2. Add a click event listener to the button.
    3. When clicked, the event listener will construct the URL for the GPX export (`/api/devices/export/gpx/{deviceId}`) and open it in a new window or trigger a download.
