/**
 * Formats a timestamp into a readable date and time string.
 * @param {string | Date} timestamp The timestamp to format.
 * @returns {string} The formatted date string or a fallback string for invalid input.
 */
function formatTimestamp(timestamp) {
    if (!timestamp) return 'N/A';
    
    try {
        const date = new Date(timestamp);
        // Check if the date is valid
        if (isNaN(date.getTime())) {
            return 'Invalid date';
        }
        // Use a consistent format across the application
        return date.toLocaleString('cs-CZ', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    } catch (e) {
        return 'Invalid date format';
    }
}

/**
 * Formats a geographic coordinate.
 * @param {string | number} coord The coordinate.
 * @returns {string} The formatted coordinate.
 */
function formatCoordinate(coord) {
    return coord !== null ? Number(coord).toFixed(6) : 'N/A';
}

/**
 * Formats speed.
 * @param {string | number} speed The speed in km/h.
 * @returns {string} The formatted speed.
 */
function formatSpeed(speed) {
    return speed !== null ? `${Number(speed).toFixed(2)} km/h` : 'N/A';
}

/**
 * Formats altitude.
 * @param {string | number} altitude The altitude in meters.
 * @returns {string} The formatted altitude.
 */
function formatAltitude(altitude) {
    return altitude !== null ? `${Number(altitude).toFixed(2)} m` : 'N/A';
}

/**
 * Formats accuracy.
 * @param {string | number} accuracy The accuracy in meters.
 * @returns {string} The formatted accuracy.
 */
function formatAccuracy(accuracy) {
    return accuracy !== null ? `${Number(accuracy).toFixed(2)} m` : 'N/A';
} 