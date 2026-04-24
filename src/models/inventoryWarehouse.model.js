const mongoose = require('mongoose');

const inventoryWarehouseSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Warehouse name is required'],
            trim: true,
            maxlength: [150, 'Warehouse name cannot exceed 150 characters'],
        },
        code: {
            type: String,
            required: [true, 'Warehouse code is required'],
            trim: true,
            uppercase: true,
            maxlength: [50, 'Warehouse code cannot exceed 50 characters'],
            unique: true,
            index: true,
        },
        description: {
            type: String,
            trim: true,
            maxlength: [500, 'Warehouse description cannot exceed 500 characters'],
        },
        location: {
            country: { type: String, trim: true },
            city: { type: String, trim: true },
            district: { type: String, trim: true },
            address: { type: String, trim: true },
        },
        capacity: {
            type: Number,
            min: [0, 'Warehouse capacity cannot be negative'],
            default: 0,
        },
        notes: {
            type: String,
            trim: true,
            maxlength: [1000, 'Warehouse notes cannot exceed 1000 characters'],
        },
        manager: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('InventoryWarehouse', inventoryWarehouseSchema);