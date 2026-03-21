const SettingService = require('../services/setting.service');

class SettingController {
    // @desc    Get all settings
    // @route   GET /api/v1/settings
    // @access  Private/Admin
    async getAllSettings(req, res) {
        try {
            const settings = await SettingService.getAllSettings();
            res.status(200).json({
                success: true,
                data: settings,
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }

    // @desc    Get setting by key
    // @route   GET /api/v1/settings/:key
    // @access  Public (if isPublic) / Private/Admin
    async getSetting(req, res) {
        try {
            const isAdmin = req.user && req.user.role === 'admin';
            const setting = await SettingService.getSettingByKey(req.params.key, isAdmin);
            res.status(200).json({
                success: true,
                data: setting,
            });
        } catch (error) {
            const status = error.message.includes('not found') ? 404 : 403;
            res.status(status).json({
                success: false,
                message: error.message,
            });
        }
    }

    // @desc    Update general settings
    // @route   PUT /api/v1/settings/general
    // @access  Private/Admin
    async updateGeneral(req, res) {
        try {
            const setting = await SettingService.updateGeneralSettings(
                req.body,
                req.user.userId
            );
            res.status(200).json({
                success: true,
                message: 'General settings updated',
                data: setting,
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    }

    // @desc    Update shipping settings
    // @route   PUT /api/v1/settings/shipping
    // @access  Private/Admin
    async updateShipping(req, res) {
        try {
            const setting = await SettingService.updateShippingSettings(
                req.body,
                req.user.userId
            );
            res.status(200).json({
                success: true,
                message: 'Shipping settings updated',
                data: setting,
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    }

    // ===== BANNER CRUD =====

    // @desc    Get all banners
    // @route   GET /api/v1/settings/banners
    // @access  Public
    async getBanners(req, res) {
        try {
            const banners = await SettingService.getBanners();
            res.status(200).json({
                success: true,
                data: banners,
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }

    // @desc    Add a banner
    // @route   POST /api/v1/settings/banners
    // @access  Private/Admin
    async addBanner(req, res) {
        try {
            const { link, title, isActive } = req.body;
            let image = req.body.image;

            if (req.file) {
                image = req.file.path;
            }

            if (!image) {
                return res.status(400).json({
                    success: false,
                    message: 'Banner image is required',
                });
            }
            const banner = await SettingService.addBanner(
                { image, link, title, isActive },
                req.user.userId
            );
            res.status(201).json({
                success: true,
                message: 'Banner added',
                data: banner,
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    }

    // @desc    Update a banner
    // @route   PUT /api/v1/settings/banners/:bannerId
    // @access  Private/Admin
    async updateBanner(req, res) {
        try {
            const updateData = { ...req.body };
            if (req.file) {
                updateData.image = req.file.path;
            }

            const banner = await SettingService.updateBanner(
                req.params.bannerId,
                updateData,
                req.user.userId
            );
            res.status(200).json({
                success: true,
                message: 'Banner updated',
                data: banner,
            });
        } catch (error) {
            const status = error.message.includes('not found') ? 404 : 400;
            res.status(status).json({
                success: false,
                message: error.message,
            });
        }
    }

    // @desc    Delete a banner
    // @route   DELETE /api/v1/settings/banners/:bannerId
    // @access  Private/Admin
    async deleteBanner(req, res) {
        try {
            const result = await SettingService.deleteBanner(
                req.params.bannerId,
                req.user.userId
            );
            res.status(200).json({
                success: true,
                ...result,
            });
        } catch (error) {
            const status = error.message.includes('not found') ? 404 : 400;
            res.status(status).json({
                success: false,
                message: error.message,
            });
        }
    }

    // @desc    Reorder banners
    // @route   PUT /api/v1/settings/banners/reorder
    // @access  Private/Admin
    async reorderBanners(req, res) {
        try {
            const { orderedIds } = req.body;
            if (!Array.isArray(orderedIds)) {
                return res.status(400).json({
                    success: false,
                    message: 'orderedIds must be an array',
                });
            }
            const banners = await SettingService.reorderBanners(
                orderedIds,
                req.user.userId
            );
            res.status(200).json({
                success: true,
                message: 'Banners reordered',
                data: banners,
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    }

    // @desc    Initialize default settings
    // @route   POST /api/v1/settings/init
    // @access  Private/Admin
    async initDefaults(req, res) {
        try {
            await SettingService.initializeDefaults();
            res.status(200).json({
                success: true,
                message: 'Default settings initialized',
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }
}

module.exports = new SettingController();
