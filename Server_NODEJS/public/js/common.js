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

/**
 * Shows a confirmation modal and executes a callback on confirmation.
 * @param {object} options - The options for the modal.
 * @param {string} options.title - The title of the modal.
 * @param {string} options.body - The body text of the modal.
 * @param {string} [options.confirmText='Confirm'] - The text for the confirm button.
 * @param {string} [options.confirmClass='btn-danger'] - The Bootstrap class for the confirm button.
 * @param {function} options.onConfirm - The callback function to execute when the confirm button is clicked.
 */
function showConfirmationModal({ title, body, confirmText = 'Confirm', confirmClass = 'btn-danger', onConfirm }) {
    const modalElement = document.getElementById('confirmationModal');
    if (!modalElement) {
        console.error('Confirmation modal element not found in the DOM.');
        return;
    }

    const modalTitle = modalElement.querySelector('#confirmationModalLabel');
    const modalBody = modalElement.querySelector('#confirmationModalBody');
    const confirmButton = modalElement.querySelector('#confirmActionButton');

    modalTitle.textContent = title;
    modalBody.innerHTML = body; // Use innerHTML to allow for HTML in the body
    confirmButton.textContent = confirmText;

    // Reset and apply the button class
    confirmButton.className = 'btn';
    confirmButton.classList.add(confirmClass);

    const modal = new bootstrap.Modal(modalElement);

    // Clone the button and replace it to remove any old event listeners
    const newConfirmButton = confirmButton.cloneNode(true);
    confirmButton.parentNode.replaceChild(newConfirmButton, confirmButton);

    // Add the new event listener
    newConfirmButton.addEventListener('click', () => {
        if (typeof onConfirm === 'function') {
            onConfirm();
        }
        modal.hide();
    });

    modal.show();
}

/**
 * Shows a modal with a text input field.
 * @param {object} options - The options for the modal.
 * @param {string} options.title - The title of the modal.
 * @param {string} [options.body] - Optional text to display above the input.
 * @param {string} options.label - The label for the input field.
 * @param {string} [options.value=''] - The initial value for the input field.
 * @param {string} [options.confirmText='Confirm'] - The text for the confirm button.
 * @param {function} options.onConfirm - The callback function to execute. It receives the input value as an argument.
 */
function showInputModal({ title, body = '', label, value = '', confirmText = 'Confirm', onConfirm }) {
    const modalElement = document.getElementById('inputModal');
    if (!modalElement) {
        console.error('Input modal element not found in the DOM.');
        return;
    }

    const modalTitle = modalElement.querySelector('#inputModalLabel');
    const modalBodyText = modalElement.querySelector('#inputModalBodyText');
    const modalFieldLabel = modalElement.querySelector('#inputModalFieldLabel');
    const modalField = modalElement.querySelector('#inputModalField');
    const confirmButton = modalElement.querySelector('#inputConfirmActionButton');

    modalTitle.textContent = title;
    modalBodyText.textContent = body;
    modalFieldLabel.textContent = label;
    modalField.value = value;
    confirmButton.textContent = confirmText;

    const modal = new bootstrap.Modal(modalElement);

    const newConfirmButton = confirmButton.cloneNode(true);
    confirmButton.parentNode.replaceChild(newConfirmButton, confirmButton);

    const handleConfirm = () => {
        const inputValue = modalField.value;
        if (typeof onConfirm === 'function') {
            onConfirm(inputValue);
        }
        modal.hide();
    };

    newConfirmButton.addEventListener('click', handleConfirm);

    // Also allow submitting by pressing Enter in the input field
    modalField.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault(); // Prevent form submission if it's in a form
            handleConfirm();
        }
    });

    modal.show();

    // Focus the input field when the modal is shown
    modalElement.addEventListener('shown.bs.modal', function () {
        modalField.focus();
        modalField.select();
    }, { once: true });
}