const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function sendVerificationEmail(to, code, type = 'email_verification') {
  let subject = '';
  let text = '';
  switch (type) {
    case 'email_verification':
      subject = `Verify Your Email : ${code}`;
      text = `Your LOTR System verification code is: ${code}\n\nThis code is valid for 10 minutes.\n\nIf you did not request this, please ignore this email.`;
      break;
    case 'account_deletion':
      subject = `Confirm Account Deletion : ${code}`;
      text = `To confirm your LOTR System account deletion, use the following code:\n\nDeletion Code: ${code}\n\nThis code is valid for 10 minutes.\n\nIf you did not request this, please ignore this email and contact support.`;
      break;
    default:
      subject = 'Your code is: ' + code;
      text = `Your code is: ${code}`;
  }

  await transporter.sendMail({
    from: `LOTR System <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text
  });
}

async function sendGeofenceAlertEmail(to, device, location) {
  const subject = `Geofence Alert for device: ${device.name || device.device_id}`;
  const text = `
    Warning!

    Your device '${device.name || device.device_id}' has reported a position outside of its defined geofence area.

    Details:
    - Time: ${new Date(location.timestamp).toLocaleString()}
    - Latitude: ${location.latitude}
    - Longitude: ${location.longitude}

    Please check your device's location on the map.
  `;

  await transporter.sendMail({
    from: `LOTR System <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text
  });
}

async function sendGeofenceReturnEmail(to, device, location) {
  const subject = `Device "${device.name || device.device_id}" has returned to the geofence`;
  const text = `
    Information:

    Your device '${device.name || device.device_id}' has returned to its defined geofence area.

    Details:
    - Time: ${new Date(location.timestamp).toLocaleString()}
    - Last Known Latitude: ${location.latitude}
    - Last Known Longitude: ${location.longitude}

    The alert for this device has been automatically resolved.
  `;

  await transporter.sendMail({
    from: `LOTR System <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text
  });
}

module.exports = { sendVerificationEmail, sendGeofenceAlertEmail };