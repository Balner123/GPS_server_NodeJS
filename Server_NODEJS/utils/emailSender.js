const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function sendVerificationEmail(to, code) {
  await transporter.sendMail({
    from: 'GPS Server <lotr.system.cz@gmail.com>',
    to,
    subject: 'Your code is : ' + code,
    text: `Your code is : ${code}`
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
    from: 'GPS Server <lotr.system.cz@gmail.com>',
    to,
    subject,
    text
  });
}

module.exports = { sendVerificationEmail, sendGeofenceAlertEmail };