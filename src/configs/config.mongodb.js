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

    // Run one-time migration for products missing the shop field
    try {
      const Product = require('../models/product.model');
      const Shop = require('../models/shop.model');
      const productsWithoutShop = await Product.find({ shop: { $exists: false } });
      if (productsWithoutShop.length > 0) {
        console.log(`🧹 Found ${productsWithoutShop.length} products without a shop field. Starting migration...`);
        let migratedCount = 0;
        for (const product of productsWithoutShop) {
          const shop = await Shop.findOne({ owner: product.seller });
          if (shop) {
            product.shop = shop._id;
            await product.save({ validateBeforeSave: false });
            migratedCount++;
          }
        }
        console.log(`✅ Migrated ${migratedCount}/${productsWithoutShop.length} products with their correct shop field.`);
      }
    } catch (migrationError) {
      console.error('❌ Error during product shop field migration:', migrationError);
    }

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
