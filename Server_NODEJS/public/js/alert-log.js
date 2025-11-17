        document.addEventListener('DOMContentLoaded', function() {
            const API_BASE_URL = window.location.origin;

            // Delete button functionality
            const deleteButtons = document.querySelectorAll('.btn-delete-alert');
            deleteButtons.forEach(button => {
                button.addEventListener('click', function() {
                    const alertId = this.getAttribute('data-alert-id');
                    showConfirmationModal({
                        title: 'Confirm Alert Deletion',
                        body: 'Are you sure you want to permanently delete this alert? This action cannot be undone.',
                        confirmText: 'Delete',
                        confirmClass: 'btn-danger',
                        onConfirm: async () => {
                            try {
                                const response = await fetch(`/api/admin/alerts/${alertId}`, {
                                    method: 'DELETE',
                                    headers: {
                                        'Content-Type': 'application/json'
                                    }
                                });
                                const data = await response.json();
                                if (response.ok) {
                                    const row = document.getElementById(`alert-row-${alertId}`);
                                    if (row) {
                                        row.remove();
                                    }
                                    displayAlert(data.message || 'Alert deleted successfully!', 'success');
                                } else {
                                    displayAlert('Error deleting alert: ' + (data.error || 'Unknown error'), 'danger');
                                }
                            } catch (error) {
                                console.error('Error:', error);
                                displayAlert('An error occurred while deleting the alert.', 'danger');
                            }
                        }
                    });
                });
            });

            // Mark All Read button functionality
            const markAllReadBtn = document.getElementById('mark-all-alerts-read-btn');
            if (markAllReadBtn) {
                markAllReadBtn.addEventListener('click', function() {
                    showConfirmationModal({
                        title: 'Confirm Mark All Read',
                        body: 'Are you sure you want to mark all displayed alerts as read?',
                        confirmText: 'Mark All Read',
                        confirmClass: 'btn-warning',
                        onConfirm: async () => {
                            try {
                                // Fetch all alerts currently displayed on the page
                                const allAlertElements = document.querySelectorAll('.list-group-item[id^="alert-row-"]');
                                const alertIds = Array.from(allAlertElements)
                                                    .map(el => el.id.replace('alert-row-', ''))
                                                    .filter(id => id); // Filter out any empty strings

                                if (alertIds.length === 0) {
                                    displayAlert('No alerts to mark as read.', 'info');
                                    return;
                                }

                                const response = await fetch(`${API_BASE_URL}/api/devices/alerts/read`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ alertIds: alertIds })
                                });

                                const result = await response.json();
                                if (!response.ok || !result.success) {
                                    throw new Error(result.error || 'Failed to mark alerts as read.');
                                }

                                displayAlert(result.message || 'All alerts marked as read.', 'success');
                                // Reload the page to reflect the changes
                                window.location.reload();

                            } catch (error) {
                                console.error('Error marking all alerts as read:', error);
                                displayAlert(`Error marking alerts as read: ${error.message}`, 'danger');
                            }
                        }
                    });
                });
            }
        });