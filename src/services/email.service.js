const nodemailer = require('nodemailer');

/**
 * Email Service
 * Handles all email sending functionality
 */

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
};

/**
 * Send verification email
 */
const sendVerificationEmail = async (email, verificationToken) => {
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;

  const transporter = createTransporter();

  const mailOptions = {
    from: `"ShopeeClone" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Verify Your Email - ShopeeClone',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to ShopeeClone!</h2>
        <p>Please verify your email address by clicking the button below:</p>
        <a href="${verificationUrl}" 
           style="display: inline-block; padding: 12px 24px; background-color: #FF6B00; 
                  color: white; text-decoration: none; border-radius: 4px; margin: 20px 0;">
          Verify Email
        </a>
        <p>Or copy and paste this link in your browser:</p>
        <p style="color: #666; word-break: break-all;">${verificationUrl}</p>
        <p style="color: #999; font-size: 12px; margin-top: 30px;">
          This link will expire in 24 hours. If you didn't create an account, please ignore this email.
        </p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};

/**
 * Send password reset email
 */
const sendPasswordResetEmail = async (email, resetToken) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

  const transporter = createTransporter();

  const mailOptions = {
    from: `"ShopeeClone" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Reset Your Password - ShopeeClone',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>You requested to reset your password. Click the button below to proceed:</p>
        <a href="${resetUrl}" 
           style="display: inline-block; padding: 12px 24px; background-color: #FF6B00; 
                  color: white; text-decoration: none; border-radius: 4px; margin: 20px 0;">
          Reset Password
        </a>
        <p>Or copy and paste this link in your browser:</p>
        <p style="color: #666; word-break: break-all;">${resetUrl}</p>
        <p style="color: #999; font-size: 12px; margin-top: 30px;">
          This link will expire in 10 minutes. If you didn't request a password reset, please ignore this email.
        </p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};

/**
 * Send welcome email
 */
const sendWelcomeEmail = async (email, name) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: `"ShopeeClone" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Welcome to ShopeeClone!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to ShopeeClone, ${name}! 🎉</h2>
        <p>Your email has been verified successfully. You can now enjoy all our features:</p>
        <ul>
          <li>Browse thousands of products</li>
          <li>Create your wishlist</li>
          <li>Track your orders</li>
          <li>Get exclusive deals</li>
        </ul>
        <a href="${process.env.FRONTEND_URL}" 
           style="display: inline-block; padding: 12px 24px; background-color: #FF6B00; 
                  color: white; text-decoration: none; border-radius: 4px; margin: 20px 0;">
          Start Shopping
        </a>
        <p style="color: #999; font-size: 12px; margin-top: 30px;">
          Happy shopping!<br>
          The ShopeeClone Team
        </p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
};
