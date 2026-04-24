/**
 * Backfill newly added product-related data for existing records.
 * - Seed default Brands and Suppliers (idempotent)
 * - Ensure a default warehouse exists
 * - Assign brand/supplier to products that do not have them
 * - Create missing inventory stock records from current product/sku stock
 * - Create initial inbound inventory movements when possible
 *
 * Usage:
 *   node scripts/seedProductEnhancements.js
 *   npm run seed:product-enhancements
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');

const Product = require('../src/models/product.model');
const Brand = require('../src/models/brand.model');
const Supplier = require('../src/models/supplier.model');
const InventoryWarehouse = require('../src/models/inventoryWarehouse.model');
const InventoryStock = require('../src/models/inventoryStock.model');
const InventoryMovement = require('../src/models/inventoryMovement.model');
const User = require('../src/models/user.model');

const DEFAULT_WAREHOUSE = {
  name: 'Main Warehouse',
  code: 'MAIN-001',
  description: 'Default warehouse for migrated inventory records',
  location: {
    country: 'VN',
    city: 'Ho Chi Minh City',
    district: 'District 1',
    address: 'Default migration location',
  },
  capacity: 100000,
  notes: 'Auto-created by product enhancement migration script',
  isActive: true,
};

const DEFAULT_BRANDS = [
  { name: 'Generic Brand', country: 'VN', website: 'https://example.com/generic' },
  { name: 'TechLine', country: 'VN', website: 'https://example.com/techline' },
  { name: 'HomePlus', country: 'VN', website: 'https://example.com/homeplus' },
  { name: 'StyleNest', country: 'VN', website: 'https://example.com/stylenest' },
  { name: 'FitCore', country: 'VN', website: 'https://example.com/fitcore' },
];

const DEFAULT_SUPPLIERS = [
  {
    name: 'Default Supplier A',
    contactName: 'Supply Team A',
    email: 'supplier-a@example.com',
    phone: '0900000001',
    address: 'Ho Chi Minh City',
  },
  {
    name: 'Default Supplier B',
    contactName: 'Supply Team B',
    email: 'supplier-b@example.com',
    phone: '0900000002',
    address: 'Ha Noi',
  },
  {
    name: 'Default Supplier C',
    contactName: 'Supply Team C',
    email: 'supplier-c@example.com',
    phone: '0900000003',
    address: 'Da Nang',
  },
];

const getActor = async () => {
  const admin = await User.findOne({ role: 'admin' }).select('_id').lean();
  if (admin?._id) return admin._id;

  const seller = await User.findOne({ role: 'seller' }).select('_id').lean();
  if (seller?._id) return seller._id;

  const anyUser = await User.findOne({}).select('_id').lean();
  return anyUser?._id || null;
};

const ensureBrand = async (payload) => {
  const existing = await Brand.findOne({ name: payload.name });
  if (existing) return existing;
  return Brand.create(payload);
};

const ensureSupplier = async (payload) => {
  const existing = await Supplier.findOne({ name: payload.name });
  if (existing) return existing;
  return Supplier.create(payload);
};

const ensureWarehouse = async () => {
  const existing = await InventoryWarehouse.findOne({ code: DEFAULT_WAREHOUSE.code });
  if (existing) return existing;
  return InventoryWarehouse.create(DEFAULT_WAREHOUSE);
};

const buildSeedPool = async () => {
  const brands = [];
  for (const payload of DEFAULT_BRANDS) {
    const brand = await ensureBrand(payload);
    brands.push(brand);
  }

  const suppliers = [];
  for (const payload of DEFAULT_SUPPLIERS) {
    const supplier = await ensureSupplier(payload);
    suppliers.push(supplier);
  }

  return { brands, suppliers };
};

const pickFromPool = (pool, index) => {
  if (!pool.length) return null;
  return pool[index % pool.length];
};

const seedStockForProduct = async ({ product, warehouseId, actorId }) => {
  let createdStockCount = 0;
  let createdMovementCount = 0;

  const skuRows = Array.isArray(product.skus) && product.skus.length > 0
    ? product.skus.map((sku) => ({ skuCode: sku.skuCode || 'default', quantity: sku.stock || 0 }))
    : [{ skuCode: 'default', quantity: product.totalStock || product.stock || 0 }];

  for (const skuRow of skuRows) {
    const existingStock = await InventoryStock.findOne({
      product: product._id,
      warehouse: warehouseId,
      skuCode: skuRow.skuCode,
    }).lean();

    if (existingStock) {
      continue;
    }

    await InventoryStock.create({
      product: product._id,
      warehouse: warehouseId,
      skuCode: skuRow.skuCode,
      quantity: skuRow.quantity,
      reservedQuantity: 0,
      lastMovementAt: new Date(),
      updatedBy: actorId || undefined,
    });
    createdStockCount += 1;

    if (actorId && skuRow.quantity > 0) {
      await InventoryMovement.create({
        product: product._id,
        warehouse: warehouseId,
        skuCode: skuRow.skuCode,
        movementType: 'inbound',
        quantity: skuRow.quantity,
        reason: 'Initial migration seed',
        note: 'Auto-created for existing products after inventory module rollout',
        actor: actorId,
        beforeQuantity: 0,
        afterQuantity: skuRow.quantity,
      });
      createdMovementCount += 1;
    }
  }

  return { createdStockCount, createdMovementCount };
};

const run = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set. Add it to backend/.env');
  }

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  console.log('Connected to MongoDB');

  const { brands, suppliers } = await buildSeedPool();
  const warehouse = await ensureWarehouse();
  const actorId = await getActor();

  const products = await Product.find({}).select('_id brand supplier skus stock totalStock').lean();

  let backfilledBrand = 0;
  let backfilledSupplier = 0;
  let createdStockRecords = 0;
  let createdMovements = 0;

  for (let i = 0; i < products.length; i += 1) {
    const product = products[i];
    const update = {};

    if (!product.brand && brands.length > 0) {
      update.brand = pickFromPool(brands, i)._id;
      backfilledBrand += 1;
    }

    if (!product.supplier && suppliers.length > 0) {
      update.supplier = pickFromPool(suppliers, i)._id;
      backfilledSupplier += 1;
    }

    if (Object.keys(update).length > 0) {
      await Product.updateOne({ _id: product._id }, { $set: update });
    }

    const seeded = await seedStockForProduct({
      product,
      warehouseId: warehouse._id,
      actorId,
    });

    createdStockRecords += seeded.createdStockCount;
    createdMovements += seeded.createdMovementCount;
  }

  console.log('Migration done');
  console.log(`Products scanned: ${products.length}`);
  console.log(`Backfilled brand: ${backfilledBrand}`);
  console.log(`Backfilled supplier: ${backfilledSupplier}`);
  console.log(`Created stock records: ${createdStockRecords}`);
  console.log(`Created inbound movements: ${createdMovements}`);
  if (!actorId) {
    console.log('No user found for movement actor, movements were skipped.');
  }
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });
