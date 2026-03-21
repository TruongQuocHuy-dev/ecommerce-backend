const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const {
  BadRequestError,
  UnauthorizedError,
  ConflictError,
  NotFoundError,
} = require('../utils/error.response');
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
} = require('./email.service');

/**
 * Access Service - Authentication Business Logic
 * Handles user registration, login, token management, password reset
 */

class AccessService {
  /**
   * User Registration
   */
  static register = async ({ name, email, password }) => {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new ConflictError('Email already registered');
    }

    // Create new user
    const user = await User.create({
      name,
      email,
      password,
    });

    // Generate verification token
    const verificationToken = user.generateVerificationToken();
    await user.save();

    // Send verification email
    try {
      await sendVerificationEmail(email, verificationToken);
    } catch (error) {
      console.error('Error sending verification email:', error);
      // Don't throw error, user is created successfully
    }

    // Return user data (without password)
    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
      },
      message: 'Registration successful. Please check your email to verify your account.',
    };
  };

  /**
   * User Login
   */
  static login = async ({ email, password }) => {
    // Find user by email (include password field)
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Check password
    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Check if email is verified
    if (!user.isVerified) {
      throw new UnauthorizedError(
        'Please verify your email before logging in. Check your inbox for the verification link.'
      );
    }

    // Generate tokens
    const accessToken = user.generateAuthToken();
    const refreshToken = user.generateRefreshToken();
    await user.save();

    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    };
  };

  /**
   * Logout
   */
  static logout = async (userId) => {
    const user = await User.findById(userId);
    if (user) {
      user.refreshToken = undefined;
      await user.save();
    }

    return { message: 'Logged out successfully' };
  };

  /**
   * Refresh Access Token
   */
  static refreshToken = async (refreshToken) => {
    if (!refreshToken) {
      throw new BadRequestError('Refresh token is required');
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (error) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    // Find user and verify stored refresh token
    const user = await User.findById(decoded.userId);
    if (!user || user.refreshToken !== refreshToken) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    // Generate new access token
    const accessToken = user.generateAuthToken();

    return {
      accessToken,
    };
  };

  /**
   * Verify Email
   */
  static verifyEmail = async (token) => {
    // Hash the token to match database
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with this verification token
    const user = await User.findOne({ verificationToken: hashedToken });

    if (!user) {
      throw new BadRequestError('Invalid or expired verification token');
    }

    // Mark as verified
    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();

    // Send welcome email
    try {
      await sendWelcomeEmail(user.email, user.name);
    } catch (error) {
      console.error('Error sending welcome email:', error);
    }

    return {
      message: 'Email verified successfully. You can now login.',
    };
  };

  /**
   * Forgot Password
   */
  static forgotPassword = async (email) => {
    const user = await User.findOne({ email });

    if (!user) {
      // Don't reveal if email exists or not (security best practice)
      return {
        message: 'If an account exists with this email, a password reset link has been sent.',
      };
    }

    // Generate reset token
    const resetToken = user.generateResetPasswordToken();
    await user.save();

    // Send reset email
    try {
      await sendPasswordResetEmail(email, resetToken);
    } catch (error) {
      // If email fails, remove reset token
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();

      throw new BadRequestError('Error sending password reset email. Please try again.');
    }

    return {
      message: 'If an account exists with this email, a password reset link has been sent.',
    };
  };

  /**
   * Reset Password
   */
  static resetPassword = async (token, newPassword) => {
    // Hash the token to match database
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with valid reset token
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      throw new BadRequestError('Invalid or expired reset token');
    }

    // Update password
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    return {
      message: 'Password reset successful. You can now login with your new password.',
    };
  };
}

module.exports = AccessService;
