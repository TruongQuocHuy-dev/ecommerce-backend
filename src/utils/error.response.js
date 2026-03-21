const { StatusCode, ReasonStatusCode } = require('./httpStatusCode');

/**
 * Base Error Response Class
 */
class ErrorResponse extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/**
 * Bad Request Error (400)
 */
class BadRequestError extends ErrorResponse {
  constructor(
    message = ReasonStatusCode.BAD_REQUEST,
    statusCode = StatusCode.BAD_REQUEST
  ) {
    super(message, statusCode);
  }
}

/**
 * Unauthorized Error (401)
 */
class UnauthorizedError extends ErrorResponse {
  constructor(
    message = ReasonStatusCode.UNAUTHORIZED,
    statusCode = StatusCode.UNAUTHORIZED
  ) {
    super(message, statusCode);
  }
}

/**
 * Forbidden Error (403)
 */
class ForbiddenError extends ErrorResponse {
  constructor(
    message = ReasonStatusCode.FORBIDDEN,
    statusCode = StatusCode.FORBIDDEN
  ) {
    super(message, statusCode);
  }
}

/**
 * Not Found Error (404)
 */
class NotFoundError extends ErrorResponse {
  constructor(
    message = ReasonStatusCode.NOT_FOUND,
    statusCode = StatusCode.NOT_FOUND
  ) {
    super(message, statusCode);
  }
}

/**
 * Conflict Error (409)
 */
class ConflictError extends ErrorResponse {
  constructor(
    message = ReasonStatusCode.CONFLICT,
    statusCode = StatusCode.CONFLICT
  ) {
    super(message, statusCode);
  }
}

/**
 * Internal Server Error (500)
 */
class InternalServerError extends ErrorResponse {
  constructor(
    message = ReasonStatusCode.INTERNAL_SERVER_ERROR,
    statusCode = StatusCode.INTERNAL_SERVER_ERROR
  ) {
    super(message, statusCode);
  }
}

module.exports = {
  ErrorResponse,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  InternalServerError,
};
