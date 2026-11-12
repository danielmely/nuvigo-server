// Sends email through Resend (https://resend.com). Needs two Railway variables:
//   RESEND_API_KEY  an API key from your Resend account
//   MAIL_FROM       e.g. "NuviGo <no-reply@nuvigo.app>" (the domain must be verified in Resend)
// Without them, create() returns null and password reset answers "not set up yet".
const https = require('https');

function create({ apiKey, from }) {
  if (!apiKey || !from) return null;
  return function sendMail(to, subject, text) {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify({ from, to: [to], subject, text });
      const req = https.request({
        hostname: 'api.resend.com', path: '/emails', method: 'POST',
        headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      }, (res) => {
        let d = ''; res.on('data', (c) => (d += c));
        res.on('end', () => (res.statusCode >= 200 && res.statusCode < 300 ? resolve() : reject(new Error('mail ' + res.statusCode + ' ' + d.slice(0, 200)))));
      });
      req.on('error', reject);
      req.setTimeout(15000, () => req.destroy(new Error('mail timeout')));
      req.write(body); req.end();
    });
  };
}

module.exports = { create };
