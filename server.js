require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/configs/config.mongodb');

const PORT = process.env.PORT || 3000;

/**
 * Initialize Server
 */

// Connect to MongoDB
connectDB();

// Start server
const server = app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🚀 ShopeeClone Backend Server                      ║
║                                                       ║
║   📍 Server running on port: ${PORT}                   ║
║   🌍 Environment: ${process.env.NODE_ENV || 'development'}              ║
║   📊 API Base URL: http://localhost:${PORT}/api/v1    ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);
});

/**
 * Handle server errors
 */
server.on('error', (error) => {
  console.error('Server error:', error);
  process.exit(1);
});

/**
 * Graceful shutdown
 */
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

process.on('SIGINT', () => {
  console.log('\nSIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});
