const mongoose = require('mongoose');

const inventoryMovementSchema = new mongoose.Schema(
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
        fromWarehouse: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'InventoryWarehouse',
        },
        toWarehouse: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'InventoryWarehouse',
        },
        skuCode: {
            type: String,
            required: true,
            trim: true,
            default: 'default',
            index: true,
        },
        movementType: {
            type: String,
            enum: ['inbound', 'outbound', 'adjustment', 'reserve', 'release', 'transfer'],
            required: true,
            index: true,
        },
        quantity: {
            type: Number,
            required: true,
        },
        reason: {
            type: String,
            required: true,
            trim: true,
            maxlength: [300, 'Movement reason cannot exceed 300 characters'],
        },
        note: {
            type: String,
            trim: true,
            maxlength: [1000, 'Movement note cannot exceed 1000 characters'],
        },
        actor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        beforeQuantity: {
            type: Number,
        },
        afterQuantity: {
            type: Number,
        },
        targetBeforeQuantity: {
            type: Number,
        },
        targetAfterQuantity: {
            type: Number,
        },
    },
    {
        timestamps: true,
    }
);

inventoryMovementSchema.index({ product: 1, warehouse: 1, createdAt: -1 });

module.exports = mongoose.model('InventoryMovement', inventoryMovementSchema);