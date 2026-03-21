const User = require('../models/user.model');
const Favorite = require('../models/favorite.model');
const { OK } = require('../utils/success.response');
const { BadRequestError, NotFoundError } = require('../utils/error.response');
const mongoose = require('mongoose');

class ProfileController {
    // Get current user profile
    getProfile = async (req, res, next) => {
        try {
            const user = await User.findById(req.user.userId).select('-password');
            if (!user) throw new NotFoundError('User not found');

            new OK({
                message: 'Get profile success',
                data: user,
            }).send(res);
        } catch (error) {
            next(error);
        }
    };

    // Update profile
    updateProfile = async (req, res, next) => {
        try {
            const { name, avatar } = req.body;

            const updateData = {};
            if (name) updateData.name = name;
            if (avatar !== undefined) updateData.avatar = avatar;

            const user = await User.findByIdAndUpdate(
                req.user.userId,
                updateData,
                { new: true, runValidators: true }
            ).select('-password');

            if (!user) throw new NotFoundError('User not found');

            new OK({
                message: 'Profile updated safely',
                data: user,
            }).send(res);
        } catch (error) {
            next(error);
        }
    };

    // Upload avatar
    uploadAvatar = async (req, res, next) => {
        try {
            if (!req.file) {
                throw new BadRequestError('Image file is required');
            }

            new OK({
                message: 'Avatar uploaded successfully',
                data: {
                    url: req.file.path,
                },
            }).send(res);
        } catch (error) {
            next(error);
        }
    };

    // Get favorite products
    getFavorites = async (req, res, next) => {
        try {
            const favorites = await Favorite.find({ user: req.user.userId })
                .populate('product', 'name price images rating soldCount shop')
                .sort('-createdAt');

            new OK({
                message: 'Get favorites success',
                data: favorites,
            }).send(res);
        } catch (error) {
            next(error);
        }
    };

    // Add a product to favorites
    addFavorite = async (req, res, next) => {
        try {
            const { productId } = req.body;

            if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
                throw new BadRequestError('Invalid product ID');
            }

            // Check if already favorited
            const existing = await Favorite.findOne({ user: req.user.userId, product: productId });
            if (existing) {
                return new OK({
                    message: 'Product already in favorites',
                    data: existing
                }).send(res);
            }

            const favorite = await Favorite.create({
                user: req.user.userId,
                product: productId
            });

            new OK({
                message: 'Product added to favorites',
                data: favorite,
            }).send(res);
        } catch (error) {
            if (error.code === 11000) {
                return next(new BadRequestError('Product already in favorites'));
            }
            next(error);
        }
    };

    // Remove a product from favorites
    removeFavorite = async (req, res, next) => {
        try {
            const { productId } = req.params;

            if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
                throw new BadRequestError('Invalid product ID');
            }

            const deleted = await Favorite.findOneAndDelete({
                user: req.user.userId,
                product: productId
            });

            if (!deleted) {
                throw new NotFoundError('Favorite not found');
            }

            new OK({
                message: 'Product removed from favorites',
                data: deleted,
            }).send(res);
        } catch (error) {
            next(error);
        }
    };
}

module.exports = new ProfileController();
