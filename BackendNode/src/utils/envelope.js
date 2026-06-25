/**
 * Wraps data in the .NET-compatible envelope shape:
 * { success, data, message, errorCode, traceId }
 *
 * The frontend apiClient (used for Identity) reads this envelope.
 * The rawApiClient (used for HR, Finance, etc.) reads raw JSON directly.
 */
const { v4: uuidv4 } = require('uuid');

function ok(res, data, statusCode = 200) {
  return res.status(statusCode).json({
    success:   true,
    data,
    message:   null,
    errorCode: null,
    traceId:   uuidv4(),
  });
}

function fail(res, statusCode, errorCode, message) {
  return res.status(statusCode).json({
    success:   false,
    data:      null,
    message,
    errorCode,
    traceId:   uuidv4(),
  });
}

module.exports = { ok, fail };
