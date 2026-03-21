# Electro Backend API

Backend API for an Electro-style E-commerce Platform built with Node.js, Express, and MongoDB.

## Features

- Authentication and Authorization: JWT-based auth with role-based access control (`admin`, `seller`, `user`)
- E-commerce Core: products, categories, cart, orders, addresses, discounts, reviews
- Admin Features: analytics endpoints, user/shop/product moderation, audit logs
- Payments: MoMo and VNPay integration (create payment, webhook/IPN, return URL)
- File Upload: image upload via Multer + Cloudinary
- Database: MongoDB with Mongoose ODM
- API Design: modular RESTful API under versioned prefix

## Tech Stack

- Runtime: Node.js
- Framework: Express.js
- Database: MongoDB
- ODM: Mongoose
- Language: JavaScript (CommonJS)
- Authentication: JWT (`jsonwebtoken`)
- Validation: `express-validator`
- File Upload: `multer`, `cloudinary`, `multer-storage-cloudinary`
- Caching/Locking: Redis (`ioredis`)
- Logging: Morgan

## API Endpoints

Base URL: `/api/v1`

### Health

- `GET /health` - Service health check

### Authentication

- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user
- `GET /auth/me` - Get current user
- `POST /auth/logout` - Logout
- `POST /auth/refresh-token` - Refresh access token
- `GET /auth/verify-email/:token` - Verify email
- `POST /auth/forgot-password` - Request password reset
- `POST /auth/reset-password` - Reset password

### Users (Admin)

- `GET /users` - Get all users
- `GET /users/:id` - Get single user
- `PUT /users/:id` - Update user
- `PUT /users/:id/block` - Block/unblock user

### Products

- `GET /products` - Get all products
- `GET /products/:id` - Get single product
- `POST /products` - Create product (Seller/Admin)
- `PUT /products/:id` - Update product (Seller/Admin)
- `DELETE /products/:id` - Delete product (Seller/Admin)
- `GET /products/pending` - Get pending products (Admin)
- `POST /products/:id/approve` - Approve product (Admin)
- `POST /products/:id/reject` - Reject product (Admin)

### Categories

- `GET /categories` - Get all categories
- `GET /categories/:id` - Get single category
- `POST /categories` - Create category (Admin)
- `PUT /categories/:id` - Update category (Admin)
- `DELETE /categories/:id` - Delete category (Admin)

### Orders

- `GET /orders` - Get current user orders
- `GET /orders/:id` - Get order details
- `POST /orders` - Create order (checkout)
- `POST /orders/manual` - Create manual order (Admin/Seller)
- `PUT /orders/:id/status` - Update order status (Admin/Seller)
- `DELETE /orders/:id/cancel` - Cancel order

### Payments

- `POST /payments/momo/create` - Create MoMo payment URL
- `POST /payments/momo/ipn` - MoMo webhook/IPN
- `POST /payments/vnpay/create` - Create VNPay payment URL
- `GET /payments/vnpay/return` - VNPay return URL
- `GET /payments/vnpay/ipn` - VNPay IPN
- `GET /payments/:orderId/status` - Check payment status

### Other Modules

- `cart`, `addresses`, `discounts`, `shops`, `reviews`, `analytics`, `settings`, `audit-logs`, `notifications`

## Installation

### Clone and install

```bash
git clone <repository-url>
cd backend
npm install
```

### Environment setup

```bash
cp .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

Update `.env` with your configuration:

```env
MONGODB_URI=mongodb://localhost:27017/ecommerce
PORT=3000
NODE_ENV=development
JWT_SECRET=your-super-secret-jwt-key-here
JWT_REFRESH_SECRET=your-super-secret-refresh-key-here
```

### Run the application

```bash
# Development
npm run dev

# Production
npm start
```

## Database Models

- User: authentication, profile, roles
- Product: product details, inventory, category relation
- Category: category hierarchy and metadata
- Cart: user cart items and totals
- Order: order lifecycle and payment information
- Address: shipping addresses
- Discount: promo and discount rules
- Review: product ratings and comments
- Shop: seller shop profile/status
- AuditLog: activity tracking for state-changing actions

## Security Features

- JWT Authentication: secure token-based auth
- Password Hashing: `bcryptjs`
- Input Validation: `express-validator`
- CORS configuration with origin allow-list
- Centralized error handler
- Audit logging for mutable operations

## Development

### Scripts

- `npm run dev` - Start development server with nodemon
- `npm start` - Start production server
- `npm test` - Placeholder test script (currently not implemented)

### Project Structure

```text
src/
|- app.js
|- configs/         # Database, Redis, Cloudinary configs
|- controllers/     # Route controllers
|- middlewares/     # Auth, upload, audit, error handling
|- models/          # Mongoose models
|- routes/          # API route modules
|- services/        # Business logic and external integrations
|- utils/           # Response helpers and utilities
```

## API Response Format

### Success response

```json
{
  "message": "Operation successful",
  "status": 200,
  "data": {}
}
```

### Error response

```json
{
  "status": 400,
  "message": "Error description"
}
```

## Contributing

1. Fork the repository.
2. Create a feature branch.
3. Make your changes.
4. Add or update tests where applicable.
5. Submit a pull request.

## License

This project is licensed under the ISC License.
