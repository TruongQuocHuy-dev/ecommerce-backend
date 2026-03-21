const mongoose = require('mongoose');

/**
 * MongoDB Connection Configuration
 * Includes retry logic and connection event listeners
 */

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // Mongoose 6+ no longer needs these options:
      // useNewUrlParser: true,
      // useUnifiedTopology: true,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    // Initialize default settings (no-op if already exist)
    const SettingService = require('../services/setting.service');
    await SettingService.initializeDefaults();
    console.log('✅ Default settings initialized');

    // Connection event listeners
    mongoose.connection.on('connected', () => {
      console.log('Mongoose connected to DB');
    });

    mongoose.connection.on('error', (err) => {
      console.error(`Mongoose connection error: ${err}`);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('Mongoose disconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('Mongoose connection closed due to app termination');
      process.exit(0);
    });
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    // Retry connection after 5 seconds
    setTimeout(connectDB, 5000);
  }
};

module.exports = connectDB;
