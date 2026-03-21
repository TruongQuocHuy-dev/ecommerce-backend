const { StatusCode, ReasonStatusCode } = require('./httpStatusCode');

/**
 * Base Success Response Class
 */
class SuccessResponse {
  constructor({
    message,
    statusCode = StatusCode.OK,
    reasonStatusCode = ReasonStatusCode.OK,
    data = {},
  }) {
    this.message = !message ? reasonStatusCode : message;
    this.status = statusCode;
    this.data = data;
  }

  send(res, headers = {}) {
    return res.status(this.status).json(this);
  }
}

/**
 * OK Response (200)
 */
class OK extends SuccessResponse {
  constructor({ message, data = {} }) {
    super({ message, data });
  }
}

/**
 * Created Response (201)
 */
class CREATED extends SuccessResponse {
  constructor({
    message,
    statusCode = StatusCode.CREATED,
    reasonStatusCode = ReasonStatusCode.CREATED,
    data = {},
  }) {
    super({ message, statusCode, reasonStatusCode, data });
  }
}

module.exports = {
  SuccessResponse,
  OK,
  CREATED,
};
