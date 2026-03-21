const User = require('../models/user.model');
const { NotFoundError } = require('../utils/error.response');

class UserService {
    static getAllUsers = async ({ page = 1, limit = 10, search = '' }) => {
        const skip = (page - 1) * limit;
        const query = {};

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
            ];
        }

        const users = await User.find(query)
            .select('-password')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await User.countDocuments(query);

        return {
            users,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    };

    static getUserById = async (id) => {
        const user = await User.findById(id).select('-password');
        if (!user) {
            throw new NotFoundError('User not found');
        }
        return user;
    };

    static updateUser = async (id, updateData) => {
        // Prevent password update through this generic endpoint
        if (updateData.password) {
            delete updateData.password;
        }

        // Get the old user to check role before updating
        const oldUser = await User.findById(id);
        if (!oldUser) {
            throw new NotFoundError('User not found');
        }

        const user = await User.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true, runValidators: true }
        ).select('-password');

        // Notify user if role is changed to seller
        if (updateData.role === 'seller' && oldUser.role !== 'seller') {
            const NotificationService = require('./notification.service');
            await NotificationService.createNotification({
                userId: user._id,
                type: 'SYSTEM_ALERT',
                title: 'Nâng cấp tài khoản thành công',
                message: 'Tài khoản của bạn đã được quản trị viên cấp quyền Người bán (Seller).',
                link: '/seller/dashboard',
            });
        }

        return user;
    };

    static toggleBlockUser = async (id) => {
        const user = await User.findById(id);
        if (!user) {
            throw new NotFoundError('User not found');
        }

        user.status = user.status === 'active' ? 'blocked' : 'active';
        await user.save();

        return {
            message: `User ${user.status === 'active' ? 'unblocked' : 'blocked'} successfully`,
            user,
        };
    };
}

module.exports = UserService;
