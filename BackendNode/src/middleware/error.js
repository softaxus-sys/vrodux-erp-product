function errorHandler(err, req, res, next) {
  console.error(err);

  // Determine if this is an Identity route (uses envelope) vs raw route
  const isIdentityRoute = req.path.startsWith('/api/auth') ||
    req.path.startsWith('/api/users') ||
    req.path.startsWith('/api/roles');

  let status, code, description;

  if (err.name === 'ValidationError') {
    status = 422; code = 'Validation.Failed'; description = err.message;
  } else if (err.code === 11000) {
    status = 409; code = 'Duplicate'; description = 'A record with this key already exists.';
  } else if (err.name === 'CastError') {
    status = 400; code = 'BadRequest'; description = 'Invalid ID format.';
  } else {
    status = err.status || 500;
    code = err.code || 'InternalServerError';
    description = err.message || 'An unexpected error occurred.';
  }

  if (isIdentityRoute) {
    return res.status(status).json({ success: false, data: null, message: description, errorCode: code, traceId: '' });
  }
  return res.status(status).json({ code, description });
}

module.exports = { errorHandler };
