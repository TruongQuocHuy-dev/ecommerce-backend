const Product = require('../models/product.model');
const Category = require('../models/category.model');
const User = require('../models/user.model');
const {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} = require('../utils/error.response');
const NotificationService = require('./notification.service');

/**
 * Product Service - Product Management Business Logic
 */

class ProductService {
  /**
   * Create new product
   */
  static createProduct = async (productData, sellerId, imageFiles) => {
    const {
      name, description, price, originalPrice, stock, category,
      tierVariations, skus, metaTitle, metaDescription, metaKeywords,
      isFeatured
    } = productData;

    // Verify seller exists and has seller/admin role
    const seller = await User.findById(sellerId);
    if (!seller) {
      throw new NotFoundError('Seller not found');
    }

    if (!['seller', 'admin'].includes(seller.role)) {
      throw new ForbiddenError('Only sellers and admins can create products');
    }

    // Verify category exists
    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      throw new NotFoundError('Category not found');
    }

    // Handle dynamic file uploads from upload.any()
    const mainImages = [];
    const skuImagesMap = {}; // { '0': 'url1', '1': 'url2' }

    if (imageFiles && imageFiles.length > 0) {
      imageFiles.forEach(file => {
        if (file.fieldname === 'images') {
          mainImages.push(file.path);
        } else if (file.fieldname.startsWith('skuImages_')) {
          const index = file.fieldname.split('_')[1];
          skuImagesMap[index] = file.path;
        }
      });
    }

    if (mainImages.length === 0) {
      throw new BadRequestError('At least one main product image is required');
    }

    // Find the shop owned by the seller
    const Shop = require('../models/shop.model');
    const shop = await Shop.findOne({ owner: sellerId });
    if (!shop) {
      throw new BadRequestError('Seller does not have an active shop');
    }

    // Parse and map SKU images
    let parsedSkus = [];
    if (skus) {
      parsedSkus = JSON.parse(skus);
      parsedSkus = parsedSkus.map((sku, index) => {
        if (skuImagesMap[index]) {
          sku.images = [skuImagesMap[index]];
        }
        return sku;
      });
    }

    // Create product
    const product = await Product.create({
      name,
      description,
      price,
      originalPrice: originalPrice || price,
      stock,
      category,
      images: mainImages,
      tierVariations: tierVariations ? JSON.parse(tierVariations) : [],
      skus: parsedSkus,
      metaTitle,
      metaDescription,
      metaKeywords,
      seller: sellerId,
      shop: shop._id,
      isFeatured: isFeatured === 'true' || isFeatured === true,
      // Seller products require approval, admin products auto-approved
      approvalStatus: seller.role === 'seller' ? 'pending' : 'approved',
      approvedBy: seller.role === 'admin' ? sellerId : undefined,
      approvedAt: seller.role === 'admin' ? new Date() : undefined,
    });

    // Increment shop totalProducts
    shop.totalProducts += 1;
    await shop.save();

    // Populate category and seller info
    await product.populate('category', 'name slug');
    await product.populate('seller', 'name email');

    // Notify admin if product is pending approval
    if (product.approvalStatus === 'pending') {
      await NotificationService.notifyPendingApproval('Product', product._id, product.name);
    }

    return {
      product: {
        id: product._id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        price: product.price,
        originalPrice: product.originalPrice,
        discountPercentage: product.discountPercentage,
        stock: product.stock,
        category: product.category,
        images: product.images,
        seller: {
          id: product.seller._id,
          name: product.seller.name,
        },
        averageRating: product.averageRating,
        numReviews: product.numReviews,
        isActive: product.isActive,
        isFeatured: product.isFeatured,
        createdAt: product.createdAt,
      },
    };
  };

  /**
   * Get all products with filters and pagination
   */
  static getProducts = async (filters, options) => {
    const {
      category,
      minPrice,
      maxPrice,
      search,
      seller,
      isFeatured,
      isActive = true,
      approvalStatus,
    } = filters;

    const {
      page = 1,
      limit = 10,
      sort = '-createdAt',
    } = options;

    // Build query
    const query = {};

    // Active filter (default true for public, but allow admin to see all)
    if (isActive !== 'all') {
      query.isActive = isActive === 'true' || isActive === true;
    }

    if (approvalStatus) {
      query.approvalStatus = approvalStatus;
    }

    // Category filter
    if (category) {
      query.category = category;
    }

    // Price range filter
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    // Seller filter
    if (seller) {
      query.seller = seller;
    }

    // Featured filter
    if (isFeatured !== undefined) {
      query.isFeatured = isFeatured === 'true' || isFeatured === true;
    }

    // Text search
    if (search) {
      query.$text = { $search: search };
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit) > 100 ? 100 : parseInt(limit); // Max 100 per page
    const skip = (pageNum - 1) * limitNum;

    // Sort
    const sortOptions = this.parseSortOptions(sort);

    // Execute query
    const [products, totalCount] = await Promise.all([
      Product.find(query)
        .populate('category', 'name slug')
        .populate('seller', 'name email')
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Product.countDocuments(query),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limitNum);

    return {
      products: products.map((product) => ({
        id: product._id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        price: product.price,
        originalPrice: product.originalPrice,
        stock: product.stock,
        category: product.category,
        images: product.images,
        seller: {
          id: product.seller._id,
          name: product.seller.name,
        },
        averageRating: product.averageRating,
        numReviews: product.numReviews,
        isFeatured: product.isFeatured,
        isActive: product.isActive,
        approvalStatus: product.approvalStatus,
        createdAt: product.createdAt,
        totalSold: product.skus ? product.skus.reduce((acc, sku) => acc + (sku.sold || 0), 0) : (product.sold || 0),
        skus: product.skus,
        tierVariations: product.tierVariations,
      })),
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalItems: totalCount,
        itemsPerPage: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    };
  };

  /**
   * Get single product by ID
   */
  static getProductById = async (productId) => {
    const product = await Product.findById(productId)
      .populate('category', 'name slug description')
      .populate('seller', 'name email');

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    return {
      product: {
        id: product._id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        price: product.price,
        originalPrice: product.originalPrice,
        discountPercentage: product.discountPercentage,
        stock: product.stock,
        totalSold: product.skus ? product.skus.reduce((acc, sku) => acc + (sku.sold || 0), 0) : (product.sold || 0),
        category: product.category,
        images: product.images,
        seller: {
          id: product.seller._id,
          name: product.seller.name,
          email: product.seller.email,
        },
        averageRating: product.averageRating,
        numReviews: product.numReviews,
        isActive: product.isActive,
        isFeatured: product.isFeatured,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
        skus: product.skus,
        tierVariations: product.tierVariations,
      },
    };
  };

  /**
   * Update product
   */
  static updateProduct = async (productId, updateData, userId, imageFiles) => {
    const product = await Product.findById(productId);

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    // Check authorization: only seller who owns the product or admin
    const user = await User.findById(userId);
    if (
      product.seller.toString() !== userId &&
      user.role !== 'admin'
    ) {
      throw new ForbiddenError('You are not authorized to update this product');
    }

    // If category is being updated, verify it exists
    if (updateData.category) {
      const categoryExists = await Category.findById(updateData.category);
      if (!categoryExists) {
        throw new NotFoundError('Category not found');
      }
    }

    // Handle new images (Main & SKUs)
    const newImages = [];
    const skuImagesMap = {};

    if (imageFiles && imageFiles.length > 0) {
      imageFiles.forEach(file => {
        if (file.fieldname === 'images') {
          newImages.push(file.path);
        } else if (file.fieldname.startsWith('skuImages_')) {
          const index = file.fieldname.split('_')[1];
          skuImagesMap[index] = file.path;
        }
      });

      if (newImages.length > 0) {
        // Append new images to existing (up to 5 total)
        updateData.images = [...product.images, ...newImages].slice(0, 5);
      }
    }

    // Parse JSON fields if they are strings (Multipart form data sends objects as strings)
    if (typeof updateData.tierVariations === 'string') {
      try {
        updateData.tierVariations = JSON.parse(updateData.tierVariations);
      } catch (e) {
        console.error('Error parsing tierVariations', e);
      }
    }

    if (typeof updateData.skus === 'string') {
      try {
        updateData.skus = JSON.parse(updateData.skus);

        // Map any new sku images that were uploaded
        updateData.skus = updateData.skus.map((sku, index) => {
          if (skuImagesMap[index]) {
            sku.images = [skuImagesMap[index]];
          }
          return sku;
        });
      } catch (e) {
        console.error('Error parsing skus', e);
      }
    } else if (Array.isArray(updateData.skus)) {
      // In case it's already an array
      updateData.skus = updateData.skus.map((sku, index) => {
        if (skuImagesMap[index]) {
          sku.images = [skuImagesMap[index]];
        }
        return sku;
      });
    }

    if (updateData.isFeatured !== undefined) {
      updateData.isFeatured = updateData.isFeatured === 'true' || updateData.isFeatured === true;
    }

    // Update product
    Object.assign(product, updateData);
    await product.save();

    // Populate and return
    await product.populate('category', 'name slug');
    await product.populate('seller', 'name email');

    return {
      product: {
        id: product._id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        price: product.price,
        originalPrice: product.originalPrice,
        stock: product.stock,
        category: product.category,
        images: product.images,
        seller: {
          id: product.seller._id,
          name: product.seller.name,
        },
        averageRating: product.averageRating,
        numReviews: product.numReviews,
        isActive: product.isActive,
        updatedAt: product.updatedAt,
      },
    };
  };

  /**
   * Delete product (soft delete)
   */
  static deleteProduct = async (productId, userId) => {
    const product = await Product.findById(productId);

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    // Check authorization
    const user = await User.findById(userId);
    if (
      product.seller.toString() !== userId &&
      user.role !== 'admin'
    ) {
      throw new ForbiddenError('You are not authorized to delete this product');
    }

    // Soft delete
    product.isActive = false;
    await product.save();

    // Decrement shop totalProducts if it exists
    if (product.shop) {
      const Shop = require('../models/shop.model');
      await Shop.findByIdAndUpdate(product.shop, { $inc: { totalProducts: -1 } });
    }

    return {
      message: 'Product deleted successfully',
    };
  };

  /**
   * Parse sort options
   */
  static parseSortOptions(sort) {
    const sortMap = {
      price: { price: 1 },
      '-price': { price: -1 },
      name: { name: 1 },
      '-name': { name: -1 },
      createdAt: { createdAt: 1 },
      '-createdAt': { createdAt: -1 },
      rating: { averageRating: 1 },
      '-rating': { averageRating: -1 },
    };

    return sortMap[sort] || { createdAt: -1 }; // Default: newest first
  }
}

module.exports = ProductService;
