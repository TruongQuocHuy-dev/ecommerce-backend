const { OK } = require('../utils/success.response');
const UserService = require('../services/user.service');

class UserController {
    /**
     * GET /api/v1/users
     * Get all users (Admin only)
     */
    getAllUsers = async (req, res, next) => {
        try {
            const { page = 1, limit = 10, search = '' } = req.query;
            const result = await UserService.getAllUsers({ page, limit, search });

            new OK({
                message: 'Get users success',
                data: result,
            }).send(res);
        } catch (error) {
            next(error);
        }
    };

    /**
     * GET /api/v1/users/:id
     * Get user by ID
     */
    getUser = async (req, res, next) => {
        try {
            const result = await UserService.getUserById(req.params.id);

            new OK({
                message: 'Get user success',
                data: result,
            }).send(res);
        } catch (error) {
            next(error);
        }
    };

    /**
     * PUT /api/v1/users/:id
     * Update user details (e.g., role)
     */
    updateUser = async (req, res, next) => {
        try {
            const result = await UserService.updateUser(req.params.id, req.body);

            new OK({
                message: 'Update user success',
                data: result,
            }).send(res);
        } catch (error) {
            next(error);
        }
    };

    /**
     * PUT /api/v1/users/:id/block
     * Block/Unblock user
     */
    toggleBlockUser = async (req, res, next) => {
        try {
            const result = await UserService.toggleBlockUser(req.params.id);

            new OK({
                message: result.message,
                data: result.user,
            }).send(res);
        } catch (error) {
            next(error);
        }
    };
}

module.exports = new UserController();
