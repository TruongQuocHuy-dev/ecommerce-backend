const ShopService = require('../services/shop.service');

class ShopController {
    // @desc    Get all shops
    // @route   GET /api/v1/shops
    // @access  Private/Admin
    async getShops(req, res) {
        try {
            const result = await ShopService.getShops(req.query);
            res.status(200).json({
                success: true,
                data: result,
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    }

    // @desc    Get all public approved shops for Mall
    // @route   GET /api/v1/shops/public
    // @access  Public
    async getPublicShops(req, res) {
        try {
            const result = await ShopService.getPublicShops(req.query);
            res.status(200).json({
                success: true,
                data: result,
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    }

    // @desc    Register a new shop (become seller)
    // @route   POST /api/v1/shops/register
    // @access  Private/User
    async registerShop(req, res) {
        try {
            const shopData = { ...req.body };

            // Handle uploaded files
            if (req.files) {
                if (req.files.logo && req.files.logo.length > 0) {
                    shopData.logo = req.files.logo[0].path;
                }
                if (req.files.banner && req.files.banner.length > 0) {
                    shopData.banner = req.files.banner[0].path;
                }
            }

            const shop = await ShopService.registerShop(shopData, req.user.userId);
            res.status(201).json({
                success: true,
                message: 'Shop registration submitted successfully and is pending approval.',
                data: shop,
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    }

    // @desc    Get single shop
    // @route   GET /api/v1/shops/:id
    // @access  Private/Admin
    async getShop(req, res) {
        try {
            const shop = await ShopService.getShopById(req.params.id);
            res.status(200).json({
                success: true,
                data: shop,
            });
        } catch (error) {
            res.status(404).json({
                success: false,
                message: error.message,
            });
        }
    }

    // @desc    Get current user's shop
    // @route   GET /api/v1/shops/my-shop
    // @access  Private
    async getMyShop(req, res) {
        try {
            const shop = await ShopService.getShopByOwnerId(req.user.userId);
            res.status(200).json({
                success: true,
                data: shop,
            });
        } catch (error) {
            res.status(404).json({
                success: false,
                message: error.message,
            });
        }
    }

    // @desc    Create shop
    // @route   POST /api/v1/shops
    // @access  Private/Seller
    async createShop(req, res) {
        try {
            const shop = await ShopService.createShop(req.body, req.user.userId);
            res.status(201).json({
                success: true,
                data: shop,
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    }

    // @desc    Update shop
    // @route   PATCH /api/v1/shops/:id
    // @access  Private/Seller/Admin
    async updateShop(req, res) {
        try {
            const updateData = { ...req.body };

            // Handle uploaded files
            if (req.files) {
                if (req.files.logo && req.files.logo.length > 0) {
                    updateData.logo = req.files.logo[0].path;
                }
                if (req.files.banner && req.files.banner.length > 0) {
                    updateData.banner = req.files.banner[0].path;
                }
            }

            const shop = await ShopService.updateShop(req.params.id, updateData);
            res.status(200).json({
                success: true,
                data: shop,
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    }

    // @desc    Approve shop
    // @route   PATCH /api/v1/shops/:id/approve
    // @access  Private/Admin
    async approveShop(req, res) {
        try {
            const shop = await ShopService.approveShop(
                req.params.id,
                req.user.userId
            );
            res.status(200).json({
                success: true,
                message: 'Shop approved successfully',
                data: shop,
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    }

    // @desc    Reject shop
    // @route   PATCH /api/v1/shops/:id/reject
    // @access  Private/Admin
    async rejectShop(req, res) {
        try {
            const { reason } = req.body;
            const shop = await ShopService.rejectShop(
                req.params.id,
                req.user.userId,
                reason
            );
            res.status(200).json({
                success: true,
                message: 'Shop rejected',
                data: shop,
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    }

    // @desc    Suspend shop
    // @route   PATCH /api/v1/shops/:id/suspend
    // @access  Private/Admin
    async suspendShop(req, res) {
        try {
            const { reason } = req.body;
            const shop = await ShopService.suspendShop(
                req.params.id,
                req.user.userId,
                reason
            );
            res.status(200).json({
                success: true,
                message: 'Shop suspended',
                data: shop,
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    }

    // @desc    Reactivate shop
    // @route   PATCH /api/v1/shops/:id/reactivate
    // @access  Private/Admin
    async reactivateShop(req, res) {
        try {
            const shop = await ShopService.reactivateShop(
                req.params.id,
                req.user.userId
            );
            res.status(200).json({
                success: true,
                message: 'Shop reactivated successfully',
                data: shop,
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    }

    // @desc    Get shop revenue
    // @route   GET /api/v1/shops/:id/revenue
    // @access  Private/Admin/Seller
    async getShopRevenue(req, res) {
        try {
            const revenue = await ShopService.getShopRevenue(
                req.params.id,
                req.query
            );
            res.status(200).json({
                success: true,
                data: revenue,
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    }

    // @desc    Delete shop
    // @route   DELETE /api/v1/shops/:id
    // @access  Private/Admin
    async deleteShop(req, res) {
        try {
            const result = await ShopService.deleteShop(req.params.id);
            res.status(200).json({
                success: true,
                ...result,
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    }

    // @desc    Get shop statistics
    // @route   GET /api/v1/shops/stats
    // @access  Private/Admin
    async getShopStats(req, res) {
        try {
            const stats = await ShopService.getShopStats();
            res.status(200).json({
                success: true,
                data: stats,
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    }
}

module.exports = new ShopController();
