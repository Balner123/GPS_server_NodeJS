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
      text = `Thank you for registering with LOTR System. Please use the following code to verify your email address:\n\nVerification Code: ${code}\n\nThis code is valid for 10 minutes.\n\nIf you did not register for this service, please ignore this email.\n\nBest regards,\nLOTR System Team`;
      break;
    case 'account_deletion':
      subject = `Confirm Account Deletion : ${code}`;
      text = `You have requested to permanently delete your LOTR System account. To confirm this action, please use the following verification code:\n\nDeletion Code: ${code}\n\nThis code is valid for 10 minutes.\n\nIf you did not request to delete your account, please ignore this email and contact support immediately.\n\nBest regards,\nLOTR System Team`;
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

module.exports = { sendVerificationEmail, sendGeofenceAlertEmail };