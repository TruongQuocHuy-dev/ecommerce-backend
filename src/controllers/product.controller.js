const { validationResult } = require('express-validator');
const ProductService = require('../services/product.service');
const { OK, CREATED } = require('../utils/success.response');

/**
 * Product Controller - HTTP Handlers
 */

class ProductController {
  /**
   * POST /api/v1/products
   * Create new product (seller/admin only)
   */
  createProduct = async (req, res, next) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('Product Validation Errors:', errors.array());
        return res.status(400).json({ errors: errors.array() });
      }

      const sellerId = req.user.userId;
      const imageFiles = req.files; // From multer

      const result = await ProductService.createProduct(
        req.body,
        sellerId,
        imageFiles
      );

      new CREATED({
        message: 'Product created successfully',
        data: result,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/products
   * Get all products with filters and pagination
   */
  getProducts = async (req, res, next) => {
    try {
      const filters = {
        category: req.query.category,
        minPrice: req.query.minPrice,
        maxPrice: req.query.maxPrice,
        search: req.query.search,
        seller: req.query.seller,
        brand: req.query.brand,
        supplier: req.query.supplier,
        isFeatured: req.query.isFeatured,
        isActive: req.query.isActive,
        approvalStatus: req.query.approvalStatus,
      };

      // Ensure non-admins only see approved products, 
      // UNLESS a seller is fetching their OWN products
      const user = req.user;
      if (!user || (user.role !== 'admin' && filters.seller !== user.userId)) {
        filters.approvalStatus = 'approved';
      }

      const options = {
        page: req.query.page,
        limit: req.query.limit,
        sort: req.query.sort,
      };

      const result = await ProductService.getProducts(filters, options);

      new OK({
        message: 'Products retrieved successfully',
        data: result,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/products/:id
   * Get single product
   */
  getProduct = async (req, res, next) => {
    try {
      const result = await ProductService.getProductById(req.params.id);

      new OK({
        message: 'Product retrieved successfully',
        data: result,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * PUT /api/v1/products/:id
   * Update product (seller/admin only)
   */
  updateProduct = async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user.userId;
      const imageFiles = req.files; // From multer

      const result = await ProductService.updateProduct(
        req.params.id,
        req.body,
        userId,
        imageFiles
      );

      new OK({
        message: 'Product updated successfully',
        data: result,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/v1/products/:id
   * Delete product (seller/admin only)
   */
  deleteProduct = async (req, res, next) => {
    try {
      const userId = req.user.userId;

      const result = await ProductService.deleteProduct(req.params.id, userId);

      new OK({
        message: result.message,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/v1/products/bulk-delete
   * Bulk delete products (seller/admin only)
   */
  bulkDeleteProducts = async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user.userId;
      const { ids } = req.body;

      const result = await ProductService.bulkDeleteProducts(ids, userId);

      new OK({
        message: result.message,
        data: result,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };
}

module.exports = new ProductController();
