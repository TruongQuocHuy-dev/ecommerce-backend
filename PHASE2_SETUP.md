# Phase 2 - Quick Setup Guide

## ⚠️ Important: Cloudinary Setup Required

Before testing product endpoints with images, you need to set up Cloudinary:

### 1. Create Cloudinary Account
- Go to https://cloudinary.com/users/register/free
- Sign up for free account
- Verify your email

### 2. Get Your Credentials
After login, go to Dashboard:
- Cloud Name
- API Key  
- API Secret

### 3. Add to .env
Update your `backend/.env` file:
```env
CLOUDINARY_CLOUD_NAME=your-cloud-name-here
CLOUDINARY_API_KEY=your-api-key-here
CLOUDINARY_API_SECRET=your-api-secret-here
```

### 4. Restart Server
```bash
# Stop current server (Ctrl+C)
npm run dev
```

---

## 🧪 Testing Phase 2

### Step 1: Setup Admin Role
```bash
mongosh
use shopee-clone
db.users.updateOne(
  { email: "techlead@shopee.com" },
  { $set: { role: "admin" } }
)
```

### Step 2: Login as Admin
```powershell
.\test-login.ps1
# Save the token
```

### Step 3: Test Categories
```powershell
# Edit test-categories.ps1 and replace <ADMIN_TOKEN> with your token
.\test-categories.ps1
```

### Step 4: Setup Seller Role
```bash
# Create another user or update existing:
db.users.updateOne(
  { email: "techlead@shopee.com" },
  { $set: { role: "seller" } }
)
```

### Step 5: Test Products (Use Postman)

**Create Product:**
```
POST http://localhost:3000/api/v1/products
Headers:
  Authorization: Bearer <SELLER_TOKEN>
  Content-Type: multipart/form-data

Body (form-data):
  name: iPhone 15 Pro
  description: Latest iPhone with A17 Pro chip
  price: 999
  originalPrice: 1099
  stock: 50
  category: <CATEGORY_ID>
  images: [select image file(s)]
```

**Get Products:**
```
GET http://localhost:3000/api/v1/products
GET http://localhost:3000/api/v1/products?category=<ID>
GET http://localhost:3000/api/v1/products?minPrice=500&maxPrice=1500
GET http://localhost:3000/api/v1/products?search=iphone
GET http://localhost:3000/api/v1/products?page=1&limit=10&sort=-price
```

---

## 📡 Available Endpoints

### Categories (Admin Only)
- POST   /api/v1/categories
- GET    /api/v1/categories
- GET    /api/v1/categories/:id
- PUT    /api/v1/categories/:id
- DELETE /api/v1/categories/:id

### Products (Public GET, Seller/Admin POST/PUT/DELETE)
- POST   /api/v1/products
- GET    /api/v1/products
- GET    /api/v1/products/:id
- PUT    /api/v1/products/:id
- DELETE /api/v1/products/:id

---

## 🔧 Troubleshooting

**"Only image files are allowed"**
- Make sure you're uploading .jpg, .jpeg, .png, or .webp files

**"You are not authorized"**
- Check your user role in MongoDB
- Make sure you're using correct token

**Cloudinary errors**
- Verify credentials in .env
- Restart server after adding credentials

**"Category not found"**
- Create categories first using test-categories.ps1
- Use the returned category ID

---

## 📊 Files Created in Phase 2

**Models:**
- product.model.js
- category.model.js

**Services:**
- product.service.js
- category.service.js

**Controllers:**
- product.controller.js
- category.controller.js

**Routes:**
- routes/product/index.js
- routes/category/index.js

**Config:**
- configs/config.cloudinary.js
- middlewares/upload.js

**Total: 10 new files**
