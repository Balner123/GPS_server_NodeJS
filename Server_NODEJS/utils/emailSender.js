const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
  user: 'lotr.system.cz@gmail.com',
  pass: 'zjdq zwpa hkcq kkrb'
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

module.exports = { sendVerificationEmail };