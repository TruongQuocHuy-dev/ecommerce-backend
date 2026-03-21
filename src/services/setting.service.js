const Setting = require('../models/setting.model');

// Default settings to seed if not exist
const DEFAULT_SETTINGS = {
    general: {
        value: {
            siteName: 'ShopeeClone',
            logo: '',
            favicon: '',
            supportEmail: 'support@shopee-clone.com',
            supportPhone: '',
            address: '',
            socialLinks: {
                facebook: '',
                instagram: '',
                youtube: '',
                tiktok: '',
            },
        },
        description: 'General site configuration',
        isPublic: true,
    },
    shipping: {
        value: {
            baseFee: 30000, // VND
            freeShipThreshold: 500000, // VND - Free ship for orders above this
            expressMultiplier: 1.5, // Express = baseFee * multiplier
        },
        description: 'Shipping fee configuration',
        isPublic: true,
    },
    banners: {
        value: [],
        description: 'Homepage banner management',
        isPublic: true,
    },
};

class SettingService {
    /**
     * Initialize default settings on first run
     */
    async initializeDefaults() {
        for (const [key, config] of Object.entries(DEFAULT_SETTINGS)) {
            const exists = await Setting.findOne({ key });
            if (!exists) {
                await Setting.create({
                    key,
                    value: config.value,
                    description: config.description,
                    isPublic: config.isPublic,
                });
            }
        }
    }

    /**
     * Get all settings (admin only)
     */
    async getAllSettings() {
        const settings = await Setting.find()
            .populate('updatedBy', 'name email')
            .sort({ key: 1 })
            .lean();
        return settings;
    }

    /**
     * Get a single setting by key
     * @param {string} key - Setting key
     * @param {boolean} isAdmin - Whether the requester is an admin
     */
    async getSettingByKey(key, isAdmin = false) {
        const setting = await Setting.findOne({ key })
            .populate('updatedBy', 'name email')
            .lean();

        if (!setting) {
            throw new Error(`Setting '${key}' not found`);
        }

        // Non-admins can only access public settings
        if (!isAdmin && !setting.isPublic) {
            throw new Error('Access denied');
        }

        return setting;
    }

    /**
     * Update a setting by key
     * @param {string} key - Setting key
     * @param {*} value - New value
     * @param {string} userId - Admin user ID
     */
    async updateSetting(key, value, userId) {
        // Validate key exists
        const existing = await Setting.findOne({ key });
        if (!existing) {
            throw new Error(`Setting '${key}' not found`);
        }

        // Validate value based on key
        this._validateSettingValue(key, value);

        const setting = await Setting.findOneAndUpdate(
            { key },
            { $set: { value, updatedBy: userId } },
            { new: true, runValidators: true }
        ).populate('updatedBy', 'name email');

        return setting;
    }

    /**
     * Update general settings
     */
    async updateGeneralSettings(data, userId) {
        const current = await Setting.getByKey('general');
        const merged = { ...current, ...data };
        return this.updateSetting('general', merged, userId);
    }

    /**
     * Update shipping settings
     */
    async updateShippingSettings(data, userId) {
        const current = await Setting.getByKey('shipping');
        const merged = { ...current, ...data };
        return this.updateSetting('shipping', merged, userId);
    }

    // ===== BANNER MANAGEMENT =====

    /**
     * Get all banners
     */
    async getBanners() {
        const banners = await Setting.getByKey('banners');
        return banners || [];
    }

    /**
     * Add a new banner
     */
    async addBanner(bannerData, userId) {
        const banners = await this.getBanners();

        const newBanner = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
            image: bannerData.image,
            link: bannerData.link || '',
            title: bannerData.title || '',
            isActive: bannerData.isActive !== false,
            order: banners.length,
            createdAt: new Date().toISOString(),
        };

        banners.push(newBanner);
        await this.updateSetting('banners', banners, userId);
        return newBanner;
    }

    /**
     * Update a banner
     */
    async updateBanner(bannerId, updates, userId) {
        const banners = await this.getBanners();
        const index = banners.findIndex((b) => b.id === bannerId);

        if (index === -1) {
            throw new Error('Banner not found');
        }

        banners[index] = { ...banners[index], ...updates };
        await this.updateSetting('banners', banners, userId);
        return banners[index];
    }

    /**
     * Delete a banner
     */
    async deleteBanner(bannerId, userId) {
        let banners = await this.getBanners();
        const index = banners.findIndex((b) => b.id === bannerId || b._id === bannerId);

        if (index === -1) {
            throw new Error('Banner not found');
        }

        banners.splice(index, 1);
        // Re-order remaining banners
        banners = banners.map((b, i) => ({ ...b, order: i }));
        await this.updateSetting('banners', banners, userId);
        return { message: 'Banner deleted successfully' };
    }

    /**
     * Reorder banners
     */
    async reorderBanners(orderedIds, userId) {
        const banners = await this.getBanners();

        if (!orderedIds || !Array.isArray(orderedIds) || orderedIds.length === 0) {
            return banners; // Nothing to do
        }

        const reordered = orderedIds
            .map((id, index) => {
                const banner = banners.find((b) => b.id === id || b._id === id);
                if (banner) {
                    return { ...banner, order: index };
                }
                return null;
            })
            .filter(Boolean);

        // Safety check to prevent wiping banners if invalid IDs were sent
        if (reordered.length === 0 && banners.length > 0) {
            throw new Error('Invalid reorder request: IDs do not match any existing banners');
        }

        await this.updateSetting('banners', reordered, userId);
        return reordered;
    }

    /**
     * Validate setting values based on key
     */
    _validateSettingValue(key, value) {
        switch (key) {
            case 'general':
                if (typeof value !== 'object' || value === null) {
                    throw new Error('General settings must be an object');
                }
                if (value.siteName && typeof value.siteName !== 'string') {
                    throw new Error('Site name must be a string');
                }
                if (value.supportEmail && typeof value.supportEmail !== 'string') {
                    throw new Error('Support email must be a string');
                }
                break;

            case 'shipping':
                if (typeof value !== 'object' || value === null) {
                    throw new Error('Shipping settings must be an object');
                }
                if (value.baseFee !== undefined && (typeof value.baseFee !== 'number' || value.baseFee < 0)) {
                    throw new Error('Base fee must be a non-negative number');
                }
                if (value.freeShipThreshold !== undefined && (typeof value.freeShipThreshold !== 'number' || value.freeShipThreshold < 0)) {
                    throw new Error('Free ship threshold must be a non-negative number');
                }
                if (value.expressMultiplier !== undefined && (typeof value.expressMultiplier !== 'number' || value.expressMultiplier < 1)) {
                    throw new Error('Express multiplier must be at least 1');
                }
                break;

            case 'banners':
                if (!Array.isArray(value)) {
                    throw new Error('Banners must be an array');
                }
                break;
        }
    }
}

module.exports = new SettingService();
