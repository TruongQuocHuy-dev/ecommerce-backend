const mongoose = require('mongoose');
const Product = require('../models/product.model');
const InventoryWarehouse = require('../models/inventoryWarehouse.model');
const InventoryStock = require('../models/inventoryStock.model');
const InventoryMovement = require('../models/inventoryMovement.model');
const { BadRequestError, ConflictError, NotFoundError } = require('../utils/error.response');

const DEFAULT_SKU = 'default';

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeSkuCode = (skuCode) => {
    const normalized = String(skuCode || '').trim();
    return normalized || DEFAULT_SKU;
};

const buildProductSearchIds = async (search) => {
    if (!search) return null;

    const regex = new RegExp(escapeRegex(search), 'i');
    const products = await Product.find({
        $or: [
            { name: regex },
            { description: regex },
            { 'skus.skuCode': regex },
        ],
    })
        .select('_id')
        .lean();

    return products.map((product) => product._id);
};

const syncProductInventory = async (productId) => {
    const product = await Product.findById(productId);
    if (!product) return null;

    const records = await InventoryStock.find({ product: productId }).select('skuCode quantity');
    const totalStock = records.reduce((total, record) => total + (record.quantity || 0), 0);

    if (product.skus && product.skus.length > 0) {
        const recordMap = records.reduce((map, record) => {
            const key = record.skuCode || DEFAULT_SKU;
            map.set(key, (map.get(key) || 0) + (record.quantity || 0));
            return map;
        }, new Map());

        product.skus = product.skus.map((sku) => {
            const key = sku.skuCode || DEFAULT_SKU;
            return {
                ...sku.toObject(),
                stock: recordMap.get(key) || 0,
            };
        });
    } else {
        product.stock = totalStock;
    }

    product.updateTotalStock();
    await product.save();

    return product;
};

const ensureWarehouse = async (warehouseId) => {
    const warehouse = await InventoryWarehouse.findById(warehouseId);
    if (!warehouse) {
        throw new NotFoundError('Warehouse not found');
    }
    if (!warehouse.isActive) {
        throw new BadRequestError('Warehouse is inactive');
    }
    return warehouse;
};

const ensureProduct = async (productId) => {
    const product = await Product.findById(productId);
    if (!product) {
        throw new NotFoundError('Product not found');
    }
    return product;
};

const buildStockRecord = async ({ productId, warehouseId, skuCode }) => {
    const normalizedSkuCode = normalizeSkuCode(skuCode);
    let record = await InventoryStock.findOne({ product: productId, warehouse: warehouseId, skuCode: normalizedSkuCode });

    if (!record) {
        record = await InventoryStock.create({
            product: productId,
            warehouse: warehouseId,
            skuCode: normalizedSkuCode,
            quantity: 0,
            reservedQuantity: 0,
        });
    }

    return record;
};

const transformWarehouse = (warehouse, stats = {}) => ({
    id: warehouse._id,
    name: warehouse.name,
    code: warehouse.code,
    description: warehouse.description,
    location: warehouse.location,
    capacity: warehouse.capacity,
    notes: warehouse.notes,
    isActive: warehouse.isActive,
    createdAt: warehouse.createdAt,
    updatedAt: warehouse.updatedAt,
    stockCount: stats.stockCount || 0,
    reservedCount: stats.reservedCount || 0,
    availableCount: stats.availableCount || 0,
    productCount: stats.productCount || 0,
});

const transformStockRecord = (record) => ({
    id: record._id,
    product: record.product,
    warehouse: record.warehouse,
    skuCode: record.skuCode,
    quantity: record.quantity,
    reservedQuantity: record.reservedQuantity,
    availableQuantity: Math.max((record.quantity || 0) - (record.reservedQuantity || 0), 0),
    lastMovementAt: record.lastMovementAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
});

const transformMovement = (movement) => ({
    id: movement._id,
    product: movement.product,
    warehouse: movement.warehouse,
    fromWarehouse: movement.fromWarehouse,
    toWarehouse: movement.toWarehouse,
    skuCode: movement.skuCode,
    movementType: movement.movementType,
    quantity: movement.quantity,
    reason: movement.reason,
    note: movement.note,
    beforeQuantity: movement.beforeQuantity,
    afterQuantity: movement.afterQuantity,
    targetBeforeQuantity: movement.targetBeforeQuantity,
    targetAfterQuantity: movement.targetAfterQuantity,
    actor: movement.actor,
    createdAt: movement.createdAt,
});

class InventoryService {
    static getOverview = async ({ search, productId, warehouseId, threshold = 10, page = 1, limit = 20 } = {}) => {
        const filters = {};

        if (productId) {
            filters.product = productId;
        }

        if (warehouseId) {
            filters.warehouse = warehouseId;
        }

        if (search) {
            const productIds = await buildProductSearchIds(search);
            if (!productIds || productIds.length === 0) {
                return {
                    summary: {
                        totalStock: 0,
                        reservedStock: 0,
                        availableStock: 0,
                        recordCount: 0,
                        warehouseCount: 0,
                        lowStockCount: 0,
                        movementCount: 0,
                    },
                    warehouses: [],
                    records: [],
                    movements: [],
                    pagination: { currentPage: 1, totalPages: 0, totalItems: 0, itemsPerPage: parseInt(limit, 10) || 20 },
                };
            }

            filters.product = { $in: productIds };
        }

        const pageNum = parseInt(page, 10) || 1;
        const limitNum = Math.min(parseInt(limit, 10) || 20, 100);
        const skip = (pageNum - 1) * limitNum;

        const [records, totalRecords, warehouses, movements] = await Promise.all([
            InventoryStock.find(filters)
                .populate('product', 'name images price stock totalStock skus tierVariations approvalStatus')
                .populate('warehouse', 'name code location isActive')
                .sort({ updatedAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .lean(),
            InventoryStock.countDocuments(filters),
            InventoryWarehouse.find({ isActive: true }).sort({ name: 1 }).lean(),
            InventoryMovement.find(filters)
                .populate('product', 'name images')
                .populate('warehouse', 'name code')
                .populate('fromWarehouse', 'name code')
                .populate('toWarehouse', 'name code')
                .populate('actor', 'name email')
                .sort({ createdAt: -1 })
                .limit(10)
                .lean(),
        ]);

        const warehouseStats = records.reduce((acc, record) => {
            const warehouseKey = String(record.warehouse?._id || record.warehouse || '');
            const quantity = record.quantity || 0;
            const reserved = record.reservedQuantity || 0;
            const current = acc.get(warehouseKey) || {
                stockCount: 0,
                reservedCount: 0,
                availableCount: 0,
                productIds: new Set(),
            };

            current.stockCount += quantity;
            current.reservedCount += reserved;
            current.availableCount += Math.max(quantity - reserved, 0);
            current.productIds.add(String(record.product?._id || record.product || ''));
            acc.set(warehouseKey, current);
            return acc;
        }, new Map());

        const summary = records.reduce((acc, record) => {
            const quantity = record.quantity || 0;
            const reserved = record.reservedQuantity || 0;
            acc.totalStock += quantity;
            acc.reservedStock += reserved;
            acc.availableStock += Math.max(quantity - reserved, 0);
            if (quantity <= threshold) {
                acc.lowStockCount += 1;
            }
            return acc;
        }, {
            totalStock: 0,
            reservedStock: 0,
            availableStock: 0,
            recordCount: totalRecords,
            warehouseCount: warehouses.length,
            lowStockCount: 0,
            movementCount: movements.length,
        });

        return {
            summary,
            warehouses: warehouses.map((warehouse) => {
                const stats = warehouseStats.get(String(warehouse._id)) || {
                    stockCount: 0,
                    reservedCount: 0,
                    availableCount: 0,
                    productIds: new Set(),
                };

                return transformWarehouse(warehouse, {
                    stockCount: stats.stockCount,
                    reservedCount: stats.reservedCount,
                    availableCount: stats.availableCount,
                    productCount: stats.productIds.size,
                });
            }),
            records: records.map(transformStockRecord),
            movements: movements.map(transformMovement),
            pagination: {
                currentPage: pageNum,
                totalPages: Math.ceil(totalRecords / limitNum),
                totalItems: totalRecords,
                itemsPerPage: limitNum,
            },
        };
    };

    static listWarehouses = async () => {
        const warehouses = await InventoryWarehouse.find().sort({ name: 1 }).lean();
        return warehouses.map((warehouse) => transformWarehouse(warehouse));
    };

    static createWarehouse = async (payload) => {
        const code = String(payload.code || '').trim().toUpperCase();
        if (!code) {
            throw new BadRequestError('Warehouse code is required');
        }

        const existing = await InventoryWarehouse.findOne({ code });
        if (existing) {
            throw new ConflictError('Warehouse code already exists');
        }

        const warehouse = await InventoryWarehouse.create({
            name: payload.name,
            code,
            description: payload.description,
            location: payload.location || {},
            capacity: payload.capacity || 0,
            notes: payload.notes,
            manager: payload.manager,
            isActive: payload.isActive !== undefined ? payload.isActive : true,
        });

        return transformWarehouse(warehouse.toObject());
    };

    static updateWarehouse = async (warehouseId, payload) => {
        const warehouse = await InventoryWarehouse.findById(warehouseId);
        if (!warehouse) {
            throw new NotFoundError('Warehouse not found');
        }

        if (payload.code) {
            const normalizedCode = String(payload.code).trim().toUpperCase();
            if (!normalizedCode) {
                throw new BadRequestError('Warehouse code is required');
            }

            const conflict = await InventoryWarehouse.findOne({ code: normalizedCode, _id: { $ne: warehouseId } });
            if (conflict) {
                throw new ConflictError('Warehouse code already exists');
            }

            warehouse.code = normalizedCode;
        }

        if (payload.name !== undefined) warehouse.name = payload.name;
        if (payload.description !== undefined) warehouse.description = payload.description;
        if (payload.location !== undefined) warehouse.location = payload.location;
        if (payload.capacity !== undefined) warehouse.capacity = payload.capacity;
        if (payload.notes !== undefined) warehouse.notes = payload.notes;
        if (payload.manager !== undefined) warehouse.manager = payload.manager;
        if (payload.isActive !== undefined) warehouse.isActive = payload.isActive;

        await warehouse.save();
        return transformWarehouse(warehouse.toObject());
    };

    static getMovements = async ({ productId, warehouseId, page = 1, limit = 20 } = {}) => {
        const query = {};
        if (productId) query.product = productId;
        if (warehouseId) query.warehouse = warehouseId;

        const pageNum = parseInt(page, 10) || 1;
        const limitNum = Math.min(parseInt(limit, 10) || 20, 100);
        const skip = (pageNum - 1) * limitNum;

        const [movements, totalItems] = await Promise.all([
            InventoryMovement.find(query)
                .populate('product', 'name images')
                .populate('warehouse', 'name code')
                .populate('fromWarehouse', 'name code')
                .populate('toWarehouse', 'name code')
                .populate('actor', 'name email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .lean(),
            InventoryMovement.countDocuments(query),
        ]);

        return {
            movements: movements.map(transformMovement),
            pagination: {
                currentPage: pageNum,
                totalPages: Math.ceil(totalItems / limitNum),
                totalItems,
                itemsPerPage: limitNum,
            },
        };
    };

    static recordMovement = async (payload, actorId) => {
        const product = await ensureProduct(payload.productId);
        const skuCode = normalizeSkuCode(payload.skuCode);
        const movementType = String(payload.movementType || '').trim();
        const quantity = Number(payload.quantity);
        const reason = String(payload.reason || '').trim();

        if (!movementType) {
            throw new BadRequestError('Movement type is required');
        }

        if (!Number.isFinite(quantity) || quantity === 0) {
            throw new BadRequestError('Quantity is required');
        }

        if (!reason) {
            throw new BadRequestError('Reason is required');
        }

        if (movementType === 'transfer') {
            const fromWarehouseId = payload.fromWarehouseId;
            const toWarehouseId = payload.toWarehouseId;

            if (!fromWarehouseId || !toWarehouseId) {
                throw new BadRequestError('Both source and destination warehouses are required for transfer');
            }

            if (String(fromWarehouseId) === String(toWarehouseId)) {
                throw new BadRequestError('Source and destination warehouses must be different');
            }

            const sourceWarehouse = await ensureWarehouse(fromWarehouseId);
            const targetWarehouse = await ensureWarehouse(toWarehouseId);
            const sourceRecord = await buildStockRecord({ productId: product._id, warehouseId: sourceWarehouse._id, skuCode });
            const targetRecord = await buildStockRecord({ productId: product._id, warehouseId: targetWarehouse._id, skuCode });

            if (sourceRecord.quantity < quantity) {
                throw new BadRequestError('Source warehouse does not have enough stock');
            }

            const sourceBefore = sourceRecord.quantity;
            const targetBefore = targetRecord.quantity;

            sourceRecord.quantity -= quantity;
            sourceRecord.lastMovementAt = new Date();
            sourceRecord.updatedBy = actorId;
            await sourceRecord.save();

            targetRecord.quantity += quantity;
            targetRecord.lastMovementAt = new Date();
            targetRecord.updatedBy = actorId;
            await targetRecord.save();

            const movement = await InventoryMovement.create({
                product: product._id,
                warehouse: targetWarehouse._id,
                fromWarehouse: sourceWarehouse._id,
                toWarehouse: targetWarehouse._id,
                skuCode,
                movementType: 'transfer',
                quantity,
                reason,
                note: payload.note,
                actor: actorId,
                beforeQuantity: sourceBefore,
                afterQuantity: sourceRecord.quantity,
                targetBeforeQuantity: targetBefore,
                targetAfterQuantity: targetRecord.quantity,
            });

            await syncProductInventory(product._id);

            return {
                movement: transformMovement(movement.toObject()),
            };
        }

        if (!payload.warehouseId) {
            throw new BadRequestError('Warehouse is required');
        }

        const warehouse = await ensureWarehouse(payload.warehouseId);
        const record = await buildStockRecord({ productId: product._id, warehouseId: warehouse._id, skuCode });
        const beforeQuantity = record.quantity;
        const beforeReserved = record.reservedQuantity;
        let afterQuantity = beforeQuantity;
        let afterReserved = beforeReserved;
        let delta = quantity;

        if (movementType === 'inbound') {
            afterQuantity = beforeQuantity + quantity;
        } else if (movementType === 'outbound') {
            if (beforeQuantity < quantity) {
                throw new BadRequestError('Not enough stock for outbound movement');
            }
            afterQuantity = beforeQuantity - quantity;
            delta = -quantity;
        } else if (movementType === 'adjustment') {
            afterQuantity = beforeQuantity + quantity;
            delta = quantity;
        } else if (movementType === 'reserve') {
            if (beforeQuantity - beforeReserved < quantity) {
                throw new BadRequestError('Not enough available stock to reserve');
            }
            afterReserved = beforeReserved + quantity;
        } else if (movementType === 'release') {
            if (beforeReserved < quantity) {
                throw new BadRequestError('Not enough reserved stock to release');
            }
            afterReserved = beforeReserved - quantity;
        } else {
            throw new BadRequestError('Unsupported movement type');
        }

        if (afterQuantity < 0) {
            throw new BadRequestError('Quantity cannot be negative');
        }

        if (afterReserved < 0) {
            throw new BadRequestError('Reserved quantity cannot be negative');
        }

        record.quantity = afterQuantity;
        record.reservedQuantity = afterReserved;
        record.lastMovementAt = new Date();
        record.updatedBy = actorId;
        await record.save();

        const movement = await InventoryMovement.create({
            product: product._id,
            warehouse: warehouse._id,
            skuCode,
            movementType,
            quantity: movementType === 'adjustment' ? delta : quantity,
            reason,
            note: payload.note,
            actor: actorId,
            beforeQuantity,
            afterQuantity,
        });

        await syncProductInventory(product._id);

        return {
            movement: transformMovement(movement.toObject()),
        };
    };
}

module.exports = InventoryService;