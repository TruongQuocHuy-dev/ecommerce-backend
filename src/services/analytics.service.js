const Order = require('../models/order.model');
const Product = require('../models/product.model');
const User = require('../models/user.model');
const Shop = require('../models/shop.model');
const { startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths, format } = require('date-fns');

class AnalyticsService {
    // Helper to get date range based on query
    getDateRange(startDate, endDate, period = 'last7days') {
        let start, end;

        if (startDate && endDate) {
            start = startOfDay(new Date(startDate));
            end = endOfDay(new Date(endDate));
        } else {
            end = endOfDay(new Date());
            if (period === 'last30days') {
                start = subDays(end, 30);
            } else if (period === 'lastMonth') {
                start = startOfMonth(subMonths(new Date(), 1));
                end = endOfMonth(subMonths(new Date(), 1));
            } else if (period === 'thisMonth') {
                start = startOfMonth(new Date());
            } else {
                // Default last 7 days
                start = subDays(end, 7);
            }
        }
        return { start, end };
    }

    async getOverviewStats() {
        // Parallel execution for performance
        const [
            revenue,
            orders,
            pendingOrders,
            deliveredOrders,
            canceledOrders,
            products,
            users,
            newUsers,
            totalShops,
            pendingShops
        ] = await Promise.all([
            Order.aggregate([
                { $match: { status: 'delivered' } },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } }
            ]),
            Order.countDocuments(),
            Order.countDocuments({ status: 'pending' }),
            Order.countDocuments({ status: 'delivered' }),
            Order.countDocuments({ status: 'cancelled' }),
            Product.countDocuments(),
            User.countDocuments({ role: 'customer' }),
            User.countDocuments({ role: 'customer', createdAt: { $gte: startOfMonth(new Date()) } }),
            Shop.countDocuments({ status: 'approved' }),
            Shop.countDocuments({ status: 'pending' })
        ]);

        // Get previous month stats for comparison
        const lastMonthStart = startOfMonth(subMonths(new Date(), 1));
        const lastMonthEnd = endOfMonth(subMonths(new Date(), 1));

        const [prevRevenue, prevOrders] = await Promise.all([
            Order.aggregate([
                {
                    $match: {
                        status: 'delivered',
                        createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd }
                    }
                },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } }
            ]),
            Order.countDocuments({ createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd } })
        ]);

        const totalRevenue = revenue[0]?.total || 0;
        const previousRevenue = prevRevenue[0]?.total || 0;
        const revenueGrowth = previousRevenue === 0 ? (totalRevenue > 0 ? 100 : 0) : ((totalRevenue - previousRevenue) / previousRevenue) * 100;

        const totalOrders = orders;
        const previousOrders = prevOrders;
        const ordersGrowth = previousOrders === 0 ? (totalOrders > 0 ? 100 : 0) : ((totalOrders - previousOrders) / previousOrders) * 100;

        const cancellationRate = totalOrders === 0 ? 0 : (canceledOrders / totalOrders) * 100;

        return {
            totalRevenue,
            revenueGrowth: parseFloat(revenueGrowth.toFixed(1)),
            totalOrders,
            ordersGrowth: parseFloat(ordersGrowth.toFixed(1)),
            pendingOrders,
            totalProducts: products,
            totalUsers: users,
            newUsersThisMonth: newUsers,
            totalShops,
            pendingShops,
            deliveredOrders,
            canceledOrders,
            cancellationRate: parseFloat(cancellationRate.toFixed(1))
        };
    }

    async getRevenueAnalytics({ startDate, endDate, period }) {
        const { start, end } = this.getDateRange(startDate, endDate, period);

        const revenueByDate = await Order.aggregate([
            {
                $match: {
                    status: 'delivered',
                    createdAt: { $gte: start, $lte: end }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    revenue: { $sum: "$totalAmount" },
                    orders: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        return {
            chartData: revenueByDate.map(item => ({
                date: item._id,
                revenue: item.revenue,
                orders: item.orders
            })),
            totalRevenue: revenueByDate.reduce((acc, curr) => acc + curr.revenue, 0),
            totalOrders: revenueByDate.reduce((acc, curr) => acc + curr.orders, 0)
        };
    }

    async getTopProducts({ limit = 5 }) {
        // Top selling products by quantity
        const topProducts = await Order.aggregate([
            { $match: { status: 'delivered' } },
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.product',
                    name: { $first: '$items.name' }, // Assuming name is stored in items, otherwise need $lookup
                    totalSold: { $sum: '$items.quantity' },
                    totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
                }
            },
            { $sort: { totalSold: -1 } },
            { $limit: parseInt(limit) },
            {
                $lookup: {
                    from: 'products',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'productInfo'
                }
            },
            { $unwind: '$productInfo' },
            {
                $project: {
                    name: '$productInfo.name',
                    image: { $arrayElemAt: ['$productInfo.images', 0] },
                    price: '$productInfo.price',
                    category: '$productInfo.category',
                    totalSold: 1,
                    totalRevenue: 1
                }
            }
        ]);

        return topProducts;
    }

    async getOrderStatusDistribution() {
        const distribution = await Order.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Ensure all statuses are represented
        const allStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'];
        const result = allStatuses.map(status => {
            const found = distribution.find(d => d._id === status);
            return {
                status,
                count: found ? found.count : 0
            };
        });

        return result;
    }

    async getUserGrowth({ period }) {
        const { start, end } = this.getDateRange(null, null, period || 'last30days');

        const growth = await User.aggregate([
            {
                $match: {
                    createdAt: { $gte: start, $lte: end },
                    role: 'customer'
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        return growth.map(g => ({
            date: g._id,
            users: g.count
        }));
    }
}

module.exports = new AnalyticsService();
