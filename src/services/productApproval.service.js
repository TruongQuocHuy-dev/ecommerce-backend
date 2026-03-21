const Product = require('../models/product.model');
const User = require('../models/user.model');
const NotificationService = require('./notification.service');
const {
    BadRequestError,
    NotFoundError,
    ForbiddenError,
} = require('../utils/error.response');

/**
 * Product Approval Service - Admin approval workflow for seller products
 */

class ProductApprovalService {
    /**
     * Get products pending approval (Admin only)
     */
    static getPendingProducts = async (filters = {}, options = {}) => {
        const { seller, category, search } = filters;
        const { page = 1, limit = 20 } = options;

        const query = { approvalStatus: 'pending' };

        if (seller) query.seller = seller;
        if (category) query.category = category;
        if (search) query.$text = { $search: search };

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit) > 100 ? 100 : parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        const [products, totalCount] = await Promise.all([
            Product.find(query)
                .populate('seller', 'name email')
                .populate('category', 'name')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .lean(),
            Product.countDocuments(query),
        ]);

        return {
            products: products.map((p) => ({
                id: p._id,
                name: p.name,
                description: p.description,
                price: p.price,
                stock: p.stock,
                images: p.images,
                category: p.category,
                seller: p.seller,
                approvalStatus: p.approvalStatus,
                createdAt: p.createdAt,
            })),
            pagination: {
                currentPage: pageNum,
                totalPages: Math.ceil(totalCount / limitNum),
                totalItems: totalCount,
            },
        };
    };

    /**
     * Approve a single product (Admin only)
     */
    static approveProduct = async (productId, adminId) => {
        const product = await Product.findById(productId);

        if (!product) {
            throw new NotFoundError('Product not found');
        }

        if (product.approvalStatus === 'approved') {
            throw new BadRequestError('Product is already approved');
        }

        product.approvalStatus = 'approved';
        product.approvedBy = adminId;
        product.approvedAt = new Date();
        product.rejectionReason = undefined; // Clear any previous rejection reason
        product.isActive = true; // Activate product

        await product.save();

        if (product.seller) {
            await NotificationService.notifyProductApprovalResult(product.seller, product._id, product.name, true);
        }

        return {
            product: {
                id: product._id,
                name: product.name,
                approvalStatus: product.approvalStatus,
                approvedAt: product.approvedAt,
            },
        };
    };

    /**
     * Reject a product with reason (Admin only)
     */
    static rejectProduct = async (productId, adminId, reason) => {
        if (!reason || reason.trim().length === 0) {
            throw new BadRequestError('Rejection reason is required');
        }

        const product = await Product.findById(productId);

        if (!product) {
            throw new NotFoundError('Product not found');
        }

        product.approvalStatus = 'rejected';
        product.rejectionReason = reason;
        product.isActive = false; // Deactivate rejected products

        await product.save();

        if (product.seller) {
            await NotificationService.notifyProductApprovalResult(product.seller, product._id, product.name, false, reason);
        }

        return {
            product: {
                id: product._id,
                name: product.name,
                approvalStatus: product.approvalStatus,
                rejectionReason: product.rejectionReason,
            },
        };
    };

    /**
     * Bulk approve products (Admin only)
     */
    static bulkApproveProducts = async (productIds, adminId) => {
        if (!productIds || productIds.length === 0) {
            throw new BadRequestError('No product IDs provided');
        }

        const productsToUpdate = await Product.find({
            _id: { $in: productIds },
            approvalStatus: { $ne: 'approved' },
        }).select('seller name _id');

        const result = await Product.updateMany(
            {
                _id: { $in: productIds },
                approvalStatus: { $ne: 'approved' },
            },
            {
                $set: {
                    approvalStatus: 'approved',
                    approvedBy: adminId,
                    approvedAt: new Date(),
                    isActive: true,
                    rejectionReason: undefined,
                },
            }
        );

        // Notify sellers
        for (const p of productsToUpdate) {
            if (p.seller) {
                // Ignore awaiting the promise individually to speed up if many
                NotificationService.notifyProductApprovalResult(p.seller, p._id, p.name, true).catch(e => console.error("Error notifying seller", e));
            }
        }

        return {
            message: `Successfully approved ${result.modifiedCount} product(s)`,
            approvedCount: result.modifiedCount,
        };
    };

    /**
     * Bulk reject products (Admin only)
     */
    static bulkRejectProducts = async (productIds, adminId, reason) => {
        if (!productIds || productIds.length === 0) {
            throw new BadRequestError('No product IDs provided');
        }

        if (!reason || reason.trim().length === 0) {
            throw new BadRequestError('Rejection reason is required');
        }

        const productsToUpdate = await Product.find({
            _id: { $in: productIds },
            approvalStatus: { $ne: 'rejected' },
        }).select('seller name _id');

        const result = await Product.updateMany(
            {
                _id: { $in: productIds },
                approvalStatus: { $ne: 'rejected' },
            },
            {
                $set: {
                    approvalStatus: 'rejected',
                    rejectionReason: reason,
                    isActive: false,
                },
            }
        );

        // Notify sellers
        for (const p of productsToUpdate) {
            if (p.seller) {
                NotificationService.notifyProductApprovalResult(p.seller, p._id, p.name, false, reason).catch(e => console.error("Error notifying seller", e));
            }
        }

        return {
            message: `Successfully rejected ${result.modifiedCount} product(s)`,
            rejectedCount: result.modifiedCount,
        };
    };

    /**
     * Get out of stock products (Admin/Seller)
     */
    static getOutOfStockProducts = async (filters = {}, options = {}) => {
        const { seller, category } = filters;
        const { page = 1, limit = 20 } = options;

        const query = {
            $or: [
                { totalStock: 0 },
                { skus: { $elemMatch: { stock: 0 } } }
            ],
            approvalStatus: 'approved'
        };

        if (seller) query.seller = seller;
        if (category) query.category = category;

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit) > 100 ? 100 : parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        const [products, totalCount] = await Promise.all([
            Product.find(query)
                .populate('seller', 'name email')
                .populate('category', 'name')
                .sort({ updatedAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .lean(),
            Product.countDocuments(query),
        ]);

        return {
            products: products.map((p) => {
                const outOfStockSkus = (p.skus || []).filter(sku => sku.stock === 0);
                return {
                    id: p._id,
                    name: p.name,
                    price: p.price,
                    totalStock: p.totalStock,
                    images: p.images,
                    category: p.category,
                    seller: p.seller,
                    tierVariations: p.tierVariations,
                    updatedAt: p.updatedAt,
                    outOfStockSkus: outOfStockSkus.map(s => ({
                        _id: s._id,
                        skuCode: s.skuCode,
                        stock: s.stock,
                        price: s.price,
                        tierIndex: s.tierIndex,
                    }))
                };
            }),
            pagination: {
                currentPage: pageNum,
                totalPages: Math.ceil(totalCount / limitNum),
                totalItems: totalCount,
            },
        };
    };

    /**
     * Get low stock products (Admin/Seller)
     */
    static getLowStockProducts = async (threshold = 10, filters = {}, options = {}) => {
        const { seller, category } = filters;
        const { page = 1, limit = 20 } = options;

        const query = {
            $or: [
                { totalStock: { $gt: 0, $lte: threshold } },
                { skus: { $elemMatch: { stock: { $gt: 0, $lte: threshold } } } }
            ],
            approvalStatus: 'approved',
        };

        if (seller) query.seller = seller;
        if (category) query.category = category;

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit) > 100 ? 100 : parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        const [products, totalCount] = await Promise.all([
            Product.find(query)
                .populate('seller', 'name email')
                .populate('category', 'name')
                .sort({ totalStock: 1 }) // Lowest stock first
                .skip(skip)
                .limit(limitNum)
                .lean(),
            Product.countDocuments(query),
        ]);

        return {
            products: products.map((p) => {
                const lowStockSkus = (p.skus || []).filter(sku => sku.stock > 0 && sku.stock <= threshold);
                return {
                    id: p._id,
                    name: p.name,
                    price: p.price,
                    totalStock: p.totalStock,
                    images: p.images,
                    category: p.category,
                    seller: p.seller,
                    tierVariations: p.tierVariations,
                    updatedAt: p.updatedAt,
                    lowStockSkus: lowStockSkus.map(s => ({
                        _id: s._id,
                        skuCode: s.skuCode,
                        stock: s.stock,
                        price: s.price,
                        tierIndex: s.tierIndex,
                    }))
                };
            }),
            pagination: {
                currentPage: pageNum,
                totalPages: Math.ceil(totalCount / limitNum),
                totalItems: totalCount,
            },
        };
    };
}

module.exports = ProductApprovalService;
