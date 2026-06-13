const analyticsService = require('../services/analytics.service');

class AnalyticsController {
    // GET /analytics/overview
    async getOverview(req, res) {
        try {
            const data = await analyticsService.getOverviewStats();
            res.json({ success: true, data });
        } catch (error) {
            console.error('Analytics Overview Error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // GET /analytics/revenue
    async getRevenue(req, res) {
        try {
            const { startDate, endDate, period } = req.query;
            const data = await analyticsService.getRevenueAnalytics({ startDate, endDate, period });
            res.json({ success: true, data });
        } catch (error) {
            console.error('Analytics Revenue Error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // GET /analytics/products
    async getTopProducts(req, res) {
        try {
            const { limit } = req.query;
            const data = await analyticsService.getTopProducts({ limit });
            res.json({ success: true, data });
        } catch (error) {
            console.error('Analytics Products Error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // GET /analytics/orders
    async getOrderStats(req, res) {
        try {
            const data = await analyticsService.getOrderStatusDistribution();
            res.json({ success: true, data });
        } catch (error) {
            console.error('Analytics Orders Error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // GET /analytics/users
    async getUserAnalytics(req, res) {
        try {
            const { period } = req.query;
            const data = await analyticsService.getUserGrowth({ period });
            res.json({ success: true, data });
        } catch (error) {
            console.error('Analytics User Error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // GET /analytics/seller/overview
    async getSellerOverview(req, res) {
        try {
            const sellerId = req.user.userId;
            const data = await analyticsService.getSellerOverviewStats(sellerId);
            res.json({ success: true, data });
        } catch (error) {
            console.error('Seller Analytics Overview Error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // GET /analytics/seller/revenue
    async getSellerRevenue(req, res) {
        try {
            const sellerId = req.user.userId;
            const { startDate, endDate, period } = req.query;
            const data = await analyticsService.getSellerRevenueAnalytics(sellerId, { startDate, endDate, period });
            res.json({ success: true, data });
        } catch (error) {
            console.error('Seller Analytics Revenue Error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // GET /analytics/seller/products
    async getSellerTopProducts(req, res) {
        try {
            const sellerId = req.user.userId;
            const { limit } = req.query;
            const data = await analyticsService.getSellerTopProducts(sellerId, { limit });
            res.json({ success: true, data });
        } catch (error) {
            console.error('Seller Analytics Products Error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // GET /analytics/seller/orders
    async getSellerOrderStats(req, res) {
        try {
            const sellerId = req.user.userId;
            const data = await analyticsService.getSellerOrderStatusDistribution(sellerId);
            res.json({ success: true, data });
        } catch (error) {
            console.error('Seller Analytics Orders Error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

module.exports = new AnalyticsController();
