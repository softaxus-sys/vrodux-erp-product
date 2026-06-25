const jwt = require('jsonwebtoken');

const secret   = process.env.JWT_SECRET   || 'change-me-in-production';
const issuer   = process.env.JWT_ISSUER   || 'VroduxERP';
const audience = process.env.JWT_AUDIENCE || 'VroduxERP-Client';
const accessMinutes  = parseInt(process.env.JWT_ACCESS_MINUTES  || '60',  10);
const refreshDays    = parseInt(process.env.JWT_REFRESH_DAYS    || '30',  10);

function signAccess(payload) {
  return jwt.sign(payload, secret, {
    issuer, audience,
    expiresIn: `${accessMinutes}m`,
  });
}

function signRefresh() {
  return jwt.sign({ type: 'refresh' }, secret, {
    issuer, audience,
    expiresIn: `${refreshDays}d`,
  });
}

function verify(token) {
  return jwt.verify(token, secret, { issuer, audience });
}

module.exports = { signAccess, signRefresh, verify, accessMinutes, refreshDays };
