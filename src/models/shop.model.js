const mongoose = require('mongoose');

const shopSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Please provide shop name'],
            trim: true,
            maxlength: [100, 'Shop name cannot exceed 100 characters'],
        },
        description: {
            type: String,
            required: [true, 'Please provide shop description'],
            maxlength: [1000, 'Description cannot exceed 1000 characters'],
        },
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Shop must have an owner'],
        },
        logo: {
            type: String,
            default: 'https://via.placeholder.com/150',
        },
        banner: {
            type: String,
            default: 'https://via.placeholder.com/800x200',
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected', 'suspended'],
            default: 'pending',
        },
        address: {
            street: String,
            city: String,
            state: String,
            zipCode: String,
            country: {
                type: String,
                default: 'Vietnam',
            },
        },
        phone: {
            type: String,
            trim: true,
        },
        email: {
            type: String,
            lowercase: true,
            trim: true,
        },
        // Business information
        businessType: {
            type: String,
            enum: ['individual', 'company'],
            default: 'individual',
        },
        taxId: {
            type: String,
            trim: true,
        },
        // Statistics
        totalProducts: {
            type: Number,
            default: 0,
        },
        totalOrders: {
            type: Number,
            default: 0,
        },
        totalRevenue: {
            type: Number,
            default: 0,
        },
        rating: {
            type: Number,
            default: 0,
            min: 0,
            max: 5,
        },
        reviewCount: {
            type: Number,
            default: 0,
        },
        // Approval tracking
        approvedAt: Date,
        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        rejectedAt: Date,
        rejectedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        rejectionReason: String,
        suspendedAt: Date,
        suspendedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        suspensionReason: String,
    },
    {
        timestamps: true,
    }
);

// Index for faster queries
shopSchema.index({ owner: 1 });
shopSchema.index({ status: 1 });
shopSchema.index({ name: 'text', description: 'text' });

// Virtual for getting shop products
shopSchema.virtual('products', {
    ref: 'Product',
    localField: '_id',
    foreignField: 'shop',
});

module.exports = mongoose.model('Shop', shopSchema);
