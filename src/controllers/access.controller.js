const { body, validationResult } = require('express-validator');
const AccessService = require('../services/access.service');
const { CREATED, OK } = require('../utils/success.response');
const { createAuditLog } = require('../middlewares/auditLog.middleware');

/**
 * Access Controller - Authentication HTTP Handlers
 * Handles HTTP requests and responses for authentication
 */

class AccessController {
  /**
   * POST /api/v1/auth/register
   * Register a new user
   */
  register = async (req, res, next) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, email, password } = req.body;

      const result = await AccessService.register({ name, email, password });

      new CREATED({
        message: result.message,
        data: result.user,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/v1/auth/login
   * Login user
   */
  login = async (req, res, next) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      const result = await AccessService.login({ email, password });

      // Log login (best-effort, don't block response)
      createAuditLog({
        userId: result.user.id,
        userRole: result.user.role,
        action: 'LOGIN',
        entity: 'User',
        entityId: result.user.id,
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('user-agent'),
        status: 'success',
        metadata: {
          method: req.method,
          path: req.path,
        },
      }).catch(() => {});

      new OK({
        message: 'Login successful',
        data: result,
      }).send(res);
    } catch (error) {
      // Log login failed (best-effort)
      const email = req.body?.email;
      if (email) {
        createAuditLog({
          userId: undefined,
          action: 'LOGIN_FAILED',
          entity: 'User',
          entityId: undefined,
          ipAddress: req.ip || req.connection?.remoteAddress,
          userAgent: req.get('user-agent'),
          status: 'failed',
          errorMessage: error.message,
          metadata: {
            method: req.method,
            path: req.path,
            email,
          },
        }).catch(() => {});
      }
      next(error);
    }
  };

  /**
   * POST /api/v1/auth/logout
   * Logout user
   */
  logout = async (req, res, next) => {
    try {
      const userId = req.user.userId;

      const result = await AccessService.logout(userId);

      // Log logout (best-effort)
      createAuditLog({
        userId,
        userRole: req.user.role,
        action: 'LOGOUT',
        entity: 'User',
        entityId: userId,
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('user-agent'),
        status: 'success',
        metadata: {
          method: req.method,
          path: req.path,
        },
      }).catch(() => {});

      new OK({
        message: result.message,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/v1/auth/refresh-token
   * Refresh access token
   */
  refreshToken = async (req, res, next) => {
    try {
      const { refreshToken } = req.body;

      const result = await AccessService.refreshToken(refreshToken);

      new OK({
        message: 'Token refreshed successfully',
        data: result,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/auth/verify-email/:token
   * Verify email address
   */
  verifyEmail = async (req, res, next) => {
    try {
      const { token } = req.params;

      const result = await AccessService.verifyEmail(token);

      new OK({
        message: result.message,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/v1/auth/forgot-password
   * Send password reset email
   */
  forgotPassword = async (req, res, next) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email } = req.body;

      const result = await AccessService.forgotPassword(email);

      new OK({
        message: result.message,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/v1/auth/reset-password
   * Reset password with token
   */
  resetPassword = async (req, res, next) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { token, password } = req.body;

      const result = await AccessService.resetPassword(token, password);

      new OK({
        message: result.message,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };
  /**
   * GET /api/v1/auth/me
   * Get current user info
   */
  getMe = async (req, res, next) => {
    try {
      new OK({
        message: 'Get user info success',
        data: {
          user: req.user,
        },
      }).send(res);
    } catch (error) {
      next(error);
    }
  };
}

module.exports = new AccessController();
