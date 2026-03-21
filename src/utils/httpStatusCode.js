/**
 * HTTP Status Codes
 * Centralized constants for API responses
 */

const StatusCode = {
  // Success
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,

  // Client Errors
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,

  // Server Errors
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
};

const ReasonStatusCode = {
  OK: 'Success',
  CREATED: 'Created',
  BAD_REQUEST: 'Bad Request',
  UNAUTHORIZED: 'Unauthorized',
  FORBIDDEN: 'Forbidden',
  NOT_FOUND: 'Not Found',
  CONFLICT: 'Conflict',
  UNPROCESSABLE_ENTITY: 'Unprocessable Entity',
  INTERNAL_SERVER_ERROR: 'Internal Server Error',
};

module.exports = {
  StatusCode,
  ReasonStatusCode,
};
