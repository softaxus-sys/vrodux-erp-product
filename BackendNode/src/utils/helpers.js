const crypto = require('crypto');

/** Generate a short unique suffix, e.g. for GRN-20260616-A3BX9F */
function shortId(len = 6) {
  return crypto.randomBytes(Math.ceil(len / 2)).toString('hex').slice(0, len).toUpperCase();
}

function docNumber(prefix) {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `${prefix}-${date}-${shortId(6)}`;
}

/** Build a paged response matching the .NET PagedResult<T> shape */
function paged(items, total, page, pageSize) {
  const totalPages = Math.ceil(total / pageSize);
  return {
    items,
    page,
    pageSize,
    totalCount: total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

/** Parse ?page and ?pageSize from query with safe defaults */
function parsePaging(query) {
  const page     = Math.max(1, parseInt(query.page     || '1',  10));
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize || '20', 10)));
  const skip     = (page - 1) * pageSize;
  return { page, pageSize, skip };
}

/** Standard error body mirroring .NET ErrorResponse */
function errBody(code, description) {
  return { code, description };
}

module.exports = { shortId, docNumber, paged, parsePaging, errBody };
