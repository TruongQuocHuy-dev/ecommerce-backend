# 🚀 Electro Backend API

Backend service for a scalable **Electro-style E-commerce Platform**, built with Node.js, Express, and MongoDB.
Designed with modular architecture, clean code principles, and production-ready practices.

---

## 📌 Overview

This backend provides a complete RESTful API system for:

* Multi-role authentication (`admin`, `seller`, `user`)
* E-commerce operations (products, orders, cart, payments)
* Admin management & analytics
* Payment integrations (MoMo, VNPay)
* Scalable and maintainable backend architecture

---

## 🛠 Tech Stack

| Layer      | Technology           |
| ---------- | -------------------- |
| Runtime    | Node.js              |
| Framework  | Express.js           |
| Database   | MongoDB              |
| ODM        | Mongoose             |
| Auth       | JWT (`jsonwebtoken`) |
| Validation | express-validator    |
| Upload     | Multer + Cloudinary  |
| Cache/Lock | Redis (`ioredis`)    |

---

## ✨ Key Features

### 🔐 Authentication & Authorization

* JWT-based authentication
* Refresh token flow
* Role-based access control

### 🛍 E-commerce Core

* Product & category management
* Cart & checkout system
* Order lifecycle handling
* Reviews & ratings

### 🧑‍💼 Admin System

* User / Product moderation
* Analytics endpoints
* Audit logging system

### 💳 Payments

* MoMo integration (create + IPN)
* VNPay integration (return + IPN)

### ☁️ File Upload

* Image upload via Cloudinary

---

## 🔗 Main API Modules

| Module     | Description                   |
| ---------- | ----------------------------- |
| auth       | Authentication & user session |
| users      | User management (Admin)       |
| products   | Product CRUD & moderation     |
| categories | Category management           |
| orders     | Order processing              |
| payments   | Payment integrations          |
| cart       | Shopping cart                 |
| reviews    | Product reviews               |
| analytics  | Admin analytics               |
| audit-logs | Activity tracking             |

---

## ⚙️ Installation

### 1. Clone project

```bash
git clone https://github.com/your-username/ecommerce-backend.git
cd ecommerce-backend
npm install
```

---

### 2. Environment setup

```bash
cp .env.example .env
```

**Windows (PowerShell):**

```powershell
Copy-Item .env.example .env
```

Update `.env`:

```env
MONGODB_URI=mongodb://localhost:27017/ecommerce
PORT=3000
NODE_ENV=development

JWT_SECRET=your-secret
JWT_REFRESH_SECRET=your-refresh-secret
```

---

### 3. Run project

```bash
# Development
npm run dev

# Production
npm start
```

---

## 🏗 Project Structure

```bash
src/
├── app.js
├── configs/        # Database, Redis, Cloudinary configs
├── controllers/    # Handle request/response
├── services/       # Business logic layer
├── models/         # Mongoose schemas
├── routes/         # API routing
├── middlewares/    # Auth, error, upload, audit
├── utils/          # Helpers & utilities
```

---

## 🔐 Security

* JWT Authentication & refresh token
* Password hashing with bcrypt
* Request validation
* CORS protection
* Centralized error handling
* Audit logging for critical actions

---

## 📦 API Response Format

### ✅ Success

```json
{
  "status": 200,
  "message": "Success",
  "data": {}
}
```

### ❌ Error

```json
{
  "status": 400,
  "message": "Error message"
}
```

---

## 🧪 Testing

Use tools like:

* Postman
* Thunder Client

---

## 🚀 Future Improvements

* Payment gateway expansion (Stripe, PayPal)
* WebSocket real-time notifications
* Microservices architecture
* API documentation with Swagger

---

## 🤝 Contributing

1. Fork repository
2. Create feature branch
3. Commit changes
4. Open Pull Request

---

## 👨‍💻 Author

**Huy Rua**

---

## 📄 License

Licensed under the ISC License.
