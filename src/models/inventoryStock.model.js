const mongoose = require('mongoose');

const inventoryStockSchema = new mongoose.Schema(
    {
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true,
            index: true,
        },
        warehouse: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'InventoryWarehouse',
            required: true,
            index: true,
        },
        skuCode: {
            type: String,
            required: true,
            trim: true,
            default: 'default',
            index: true,
        },
        quantity: {
            type: Number,
            default: 0,
            min: [0, 'Quantity cannot be negative'],
        },
        reservedQuantity: {
            type: Number,
            default: 0,
            min: [0, 'Reserved quantity cannot be negative'],
        },
        lastMovementAt: {
            type: Date,
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    {
        timestamps: true,
    }
);

inventoryStockSchema.index({ product: 1, warehouse: 1, skuCode: 1 }, { unique: true });

module.exports = mongoose.model('InventoryStock', inventoryStockSchema);