const Shop = require('../models/shop.model');
const Product = require('../models/product.model');
const Order = require('../models/order.model');
const User = require('../models/user.model');
const NotificationService = require('./notification.service');

class ShopService {
    // Get all public shops (Mall view)
    async getPublicShops(filters = {}) {
        const { search, page = 1, limit = 20 } = filters;
        const skip = (page - 1) * limit;

        // Build the match conditions
        const matchConditions = {};
        if (search) {
            matchConditions.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
            ];
        }

        const pipeline = [
            // Join with User collection to check owner's role
            {
                $lookup: {
                    from: 'users',
                    localField: 'owner',
                    foreignField: '_id',
                    as: 'ownerDetails'
                }
            },
            {
                $unwind: '$ownerDetails'
            },
            // Match shops that are EITHER approved OR owned by an admin
            {
                $match: {
                    $or: [
                        { status: 'approved' },
                        { 'ownerDetails.role': 'admin' }
                    ],
                    ...matchConditions
                }
            }
        ];

        const [shopsResult, totalResult] = await Promise.all([
            Shop.aggregate([
                ...pipeline,
                {
                    $project: {
                        name: 1,
                        description: 1,
                        logo: 1,
                        banner: 1,
                        rating: 1,
                        reviewCount: 1,
                        totalProducts: 1,
                        address: 1,
                        businessType: 1,
                        createdAt: 1,
                        status: 1,
                        owner: 1,
                    }
                },
                { $sort: { rating: -1, totalOrders: -1, createdAt: -1 } },
                { $skip: skip },
                { $limit: parseInt(limit) }
            ]),
            Shop.aggregate([
                ...pipeline,
                { $count: 'total' }
            ])
        ]);

        const total = totalResult.length > 0 ? totalResult[0].total : 0;

        return {
            shops: shopsResult,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit),
        };
    }

    // Get all shops with filters
    async getShops(filters = {}) {
        const { status, search, page = 1, limit = 10 } = filters;
        const query = {};

        if (status && status !== 'all') {
            query.status = status;
        }

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
            ];
        }

        const skip = (page - 1) * limit;

        const [shops, total] = await Promise.all([
            Shop.find(query)
                .populate('owner', 'name email')
                .populate('approvedBy', 'name')
                .populate('suspendedBy', 'name')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Shop.countDocuments(query),
        ]);

        return {
            shops,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit),
        };
    }

    // Get single shop by ID
    async getShopById(shopId) {
        const shop = await Shop.findById(shopId)
            .populate('owner', 'name email phone')
            .populate('approvedBy', 'name')
            .populate('suspendedBy', 'name')
            .lean();

        if (!shop) {
            throw new Error('Shop not found');
        }

        // Get shop products count
        const productsCount = await Product.countDocuments({ shop: shopId });
        shop.productsCount = productsCount;

        return shop;
    }

    // Get single shop by owner ID
    async getShopByOwnerId(ownerId) {
        const shop = await Shop.findOne({ owner: ownerId })
            .populate('owner', 'name email phone')
            .populate('approvedBy', 'name')
            .populate('suspendedBy', 'name')
            .lean();

        if (!shop) {
            throw new Error('Shop not found');
        }

        // Get shop products count
        const productsCount = await Product.countDocuments({ shop: shop._id });
        shop.productsCount = productsCount;

        return shop;
    }

    // Register new shop (normal user)
    async registerShop(shopData, userId) {
        // Check if user already exists
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        // Check if user already has a shop or pending request
        const existingShop = await Shop.findOne({ owner: userId });
        if (existingShop) {
            if (existingShop.status === 'pending') {
                throw new Error('You already have a pending shop registration');
            } else if (existingShop.status === 'approved') {
                throw new Error('You already have an approved shop');
            } else if (existingShop.status === 'suspended') {
                throw new Error('Your shop is currently suspended');
            }
            // If rejected, allow re-registration by creating a new one or updating the old one. We will just throw for simplicity now.
            throw new Error(`You already have a shop with status: ${existingShop.status}`);
        }

        const shop = await Shop.create({
            ...shopData,
            owner: userId,
            status: 'pending' // Enforce pending status
        });

        // Notify admins about the new shop registration
        await NotificationService.notifyPendingApproval('Shop', shop._id, shop.name);

        return shop;
    }

    // Create new shop (admin)
    async createShop(shopData, ownerId) {
        // Check if user already has a shop
        const existingShop = await Shop.findOne({ owner: ownerId });
        if (existingShop) {
            throw new Error('User already has a shop');
        }

        const shop = await Shop.create({
            ...shopData,
            owner: ownerId,
        });

        return shop;
    }

    // Update shop
    async updateShop(shopId, updates) {
        const shop = await Shop.findByIdAndUpdate(
            shopId,
            { $set: updates },
            { new: true, runValidators: true }
        ).populate('owner', 'name email');

        if (!shop) {
            throw new Error('Shop not found');
        }

        return shop;
    }

    // Approve shop
    async approveShop(shopId, adminId) {
        const shop = await Shop.findById(shopId);

        if (!shop) {
            throw new Error('Shop not found');
        }

        if (shop.status === 'approved') {
            throw new Error('Shop is already approved');
        }

        shop.status = 'approved';
        shop.approvedAt = new Date();
        shop.approvedBy = adminId;
        shop.rejectedAt = undefined;
        shop.rejectedBy = undefined;
        shop.rejectionReason = undefined;

        await shop.save();

        // **NEW CORE LOGIC: UPDATE USER ROLE TO SELLER**
        await User.findByIdAndUpdate(shop.owner, { role: 'seller' });

        // Notify user about approval
        await NotificationService.createNotification({
            userId: shop.owner,
            type: 'SYSTEM',
            title: 'Đăng ký bán hàng thành công',
            message: `Chúc mừng! Cửa hàng "${shop.name}" của bạn đã được duyệt. Bạn hiện là Người bán.`,
            link: '/seller/dashboard',
            data: { shopId: shop._id },
        });

        return shop;
    }

    // Reject shop
    async rejectShop(shopId, adminId, reason) {
        const shop = await Shop.findById(shopId);

        if (!shop) {
            throw new Error('Shop not found');
        }

        shop.status = 'rejected';
        shop.rejectedAt = new Date();
        shop.rejectedBy = adminId;
        shop.rejectionReason = reason;
        shop.approvedAt = undefined;
        shop.approvedBy = undefined;

        await shop.save();

        // Notify user about rejection
        await NotificationService.createNotification({
            userId: shop.owner,
            type: 'SYSTEM',
            title: 'Đăng ký bán hàng bị từ chối',
            message: `Rất tiếc, cửa hàng "${shop.name}" của bạn không được duyệt. Lý do: ${reason}`,
            data: { shopId: shop._id, reason },
        });

        return shop;
    }

    // Suspend shop
    async suspendShop(shopId, adminId, reason) {
        const shop = await Shop.findById(shopId);

        if (!shop) {
            throw new Error('Shop not found');
        }

        if (shop.status !== 'approved') {
            throw new Error('Can only suspend approved shops');
        }

        shop.status = 'suspended';
        shop.suspendedAt = new Date();
        shop.suspendedBy = adminId;
        shop.suspensionReason = reason;

        await shop.save();

        return shop;
    }

    // Reactivate suspended shop
    async reactivateShop(shopId, adminId) {
        const shop = await Shop.findById(shopId);

        if (!shop) {
            throw new Error('Shop not found');
        }

        if (shop.status !== 'suspended') {
            throw new Error('Shop is not suspended');
        }

        shop.status = 'approved';
        shop.suspendedAt = undefined;
        shop.suspendedBy = undefined;
        shop.suspensionReason = undefined;

        await shop.save();

        return shop;
    }

    // Get shop revenue statistics
    async getShopRevenue(shopId, filters = {}) {
        const { startDate, endDate } = filters;
        const matchStage = {
            shop: shopId,
            status: { $in: ['delivered', 'completed'] },
        };

        if (startDate || endDate) {
            matchStage.createdAt = {};
            if (startDate) matchStage.createdAt.$gte = new Date(startDate);
            if (endDate) matchStage.createdAt.$lte = new Date(endDate);
        }

        const [revenueStats, orderStats] = await Promise.all([
            Order.aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: null,
                        totalRevenue: { $sum: '$totalAmount' },
                        averageOrder: { $avg: '$totalAmount' },
                        orderCount: { $sum: 1 },
                    },
                },
            ]),
            Order.aggregate([
                { $match: { shop: shopId } },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                    },
                },
            ]),
        ]);

        const stats = revenueStats[0] || {
            totalRevenue: 0,
            averageOrder: 0,
            orderCount: 0,
        };

        const ordersByStatus = {};
        orderStats.forEach((item) => {
            ordersByStatus[item._id] = item.count;
        });

        return {
            ...stats,
            ordersByStatus,
        };
    }

    // Delete shop
    async deleteShop(shopId) {
        const shop = await Shop.findById(shopId);

        if (!shop) {
            throw new Error('Shop not found');
        }

        // Check if shop has products
        const productsCount = await Product.countDocuments({ shop: shopId });
        if (productsCount > 0) {
            throw new Error(
                'Cannot delete shop with existing products. Please delete all products first.'
            );
        }

        await Shop.findByIdAndDelete(shopId);

        return { message: 'Shop deleted successfully' };
    }

    // Get shop statistics
    async getShopStats() {
        const stats = await Shop.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                },
            },
        ]);

        const result = {
            total: 0,
            pending: 0,
            approved: 0,
            rejected: 0,
            suspended: 0,
        };

        stats.forEach((item) => {
            result[item._id] = item.count;
            result.total += item.count;
        });

        return result;
    }
}

module.exports = new ShopService();
