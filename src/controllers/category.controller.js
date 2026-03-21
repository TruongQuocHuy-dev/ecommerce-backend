const { validationResult } = require('express-validator');
const CategoryService = require('../services/category.service');
const { OK, CREATED } = require('../utils/success.response');

/**
 * Category Controller - HTTP Handlers
 */

class CategoryController {
  /**
   * POST /api/v1/categories
   * Create new category (admin only)
   */
  createCategory = async (req, res, next) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const payload = { ...req.body };
      if (req.file) {
        payload.image = req.file.path;
      }

      const result = await CategoryService.createCategory(payload);

      new CREATED({
        message: 'Category created successfully',
        data: result,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/categories
   * Get all categories
   */
  getCategories = async (req, res, next) => {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const result = await CategoryService.getCategories(includeInactive);

      new OK({
        message: 'Categories retrieved successfully',
        data: result,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/categories/:id
   * Get single category
   */
  getCategory = async (req, res, next) => {
    try {
      const result = await CategoryService.getCategoryById(req.params.id);

      new OK({
        message: 'Category retrieved successfully',
        data: result,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * PUT /api/v1/categories/:id
   * Update category (admin only)
   */
  updateCategory = async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const payload = { ...req.body };
      if (req.file) {
        payload.image = req.file.path;
      }

      const result = await CategoryService.updateCategory(
        req.params.id,
        payload
      );

      new OK({
        message: 'Category updated successfully',
        data: result,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/v1/categories/:id
   * Delete category (admin only)
   */
  deleteCategory = async (req, res, next) => {
    try {
      const result = await CategoryService.deleteCategory(req.params.id);

      new OK({
        message: result.message,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };
}

module.exports = new CategoryController();
