"use strict";

/**
 * catchAsync — wraps an async Express route handler so that any thrown
 * error or rejected promise is forwarded to Express's error handler via next().
 *
 * Without this, Express 4.x does not catch async errors automatically —
 * a rejection in an async route causes the request to hang forever.
 *
 * Usage:
 *   router.post('/order', catchAsync(async (req, res) => {
 *     await someAsyncOperation();
 *     res.json({ ok: true });
 *   }));
 */
function catchAsync(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = catchAsync;
