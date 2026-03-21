const { StatusCode } = require('../utils/httpStatusCode');

/**
 * Global Error Handler Middleware
 * Catches all errors and formats them consistently
 */

const errorHandler = (err, req, res, next) => {
  // Log error in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Error:', err);
  }

  const statusCode = err.status || StatusCode.INTERNAL_SERVER_ERROR;
  const message = err.message || 'Internal Server Error';

  // Format error response
  const errorResponse = {
    status: statusCode,
    message: message,
  };

  // Include stack trace only in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => e.message);
    errorResponse.status = StatusCode.BAD_REQUEST;
    errorResponse.message = 'Validation Error';
    errorResponse.errors = errors;
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    errorResponse.status = StatusCode.CONFLICT;
    errorResponse.message = `${field} already exists`;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    errorResponse.status = StatusCode.UNAUTHORIZED;
    errorResponse.message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    errorResponse.status = StatusCode.UNAUTHORIZED;
    errorResponse.message = 'Token expired';
  }

  res.status(errorResponse.status).json(errorResponse);
};

module.exports = errorHandler;
