require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const routes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

/**
 * Middlewares
 */

// CORS - Allow cross-origin requests
const allowedOrigins = [
  'http://localhost:3000',  // Local backend
  'http://localhost:5173',  // Admin dashboard (Vite default)
  'http://localhost:5174',  // Admin dashboard (alternate)
  'http://localhost:8081',  // React Native Metro bundler
  process.env.FRONTEND_URL, // Primary frontend
  process.env.MOBILE_URL,   // Mobile deep link or IP
].filter(Boolean);

// Allow any local network IP for mobile development (192.168.x.x)
const isLocalNetwork = (origin) => {
  return origin && (origin.startsWith('http://192.168.') || origin.startsWith('http://10.0.2.2'));
};

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin) || isLocalNetwork(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// HTTP request logger (only in development)
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

/**
 * Routes
 */
app.use('/api/v1', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to ShopeeClone API',
    version: '1.0.0',
    documentation: '/api/v1/health',
  });
});

/**
 * Error Handling
 * Must be last middleware
 */
app.use(errorHandler);

// Handle 404 - Route not found
app.use((req, res) => {
  res.status(404).json({
    status: 404,
    message: 'Route not found',
  });
});

module.exports = app;
