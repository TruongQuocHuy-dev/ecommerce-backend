const Product = require('../models/product.model');
const Category = require('../models/category.model');
const User = require('../models/user.model');
const {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} = require('../utils/error.response');
const NotificationService = require('./notification.service');

const MAX_TIER_COUNT = 2;
const MAX_OPTIONS_PER_TIER = 20;
const MAX_SKU_COUNT = 200;
const MAX_SKU_IMAGES = 5;
const MAX_PRODUCT_IMAGES = 5;

/**
 * Product Service - Product Management Business Logic
 */

class ProductService {
  static escapeRegex(value = '') {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  static parseJsonArrayField(value, fieldName) {
    if (value === undefined || value === null || value === '') {
      return [];
    }

    if (Array.isArray(value)) {
      return value;
    }

    if (typeof value !== 'string') {
      throw new BadRequestError(`${fieldName} must be a valid JSON array`);
    }

    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) {
        throw new BadRequestError(`${fieldName} must be a valid JSON array`);
      }
      return parsed;
    } catch (error) {
      if (error instanceof BadRequestError) {
        throw error;
      }
      throw new BadRequestError(`Invalid ${fieldName} format`);
    }
  }

  static validateVariantData(tierVariations, skus) {
    if (!Array.isArray(tierVariations)) {
      throw new BadRequestError('tierVariations must be an array');
    }

    if (!Array.isArray(skus)) {
      throw new BadRequestError('skus must be an array');
    }

    if (tierVariations.length > MAX_TIER_COUNT) {
      throw new BadRequestError(`A product supports at most ${MAX_TIER_COUNT} tier variations`);
    }

    const normalizedTierOptions = tierVariations.map((tier, tierIndex) => {
      if (!tier || typeof tier.name !== 'string' || !tier.name.trim()) {
        throw new BadRequestError(`tierVariations[${tierIndex}].name is required`);
      }

      if (!Array.isArray(tier.options) || tier.options.length === 0) {
        throw new BadRequestError(`tierVariations[${tierIndex}] must have at least one option`);
      }

      if (tier.options.length > MAX_OPTIONS_PER_TIER) {
        throw new BadRequestError(
          `tierVariations[${tierIndex}] cannot exceed ${MAX_OPTIONS_PER_TIER} options`
        );
      }

      const normalizedOptions = tier.options.map((option, optionIndex) => {
        if (typeof option !== 'string' || !option.trim()) {
          throw new BadRequestError(
            `tierVariations[${tierIndex}].options[${optionIndex}] must be a non-empty string`
          );
        }

        return option.trim().toLowerCase();
      });

      const optionSet = new Set(normalizedOptions);
      if (optionSet.size !== normalizedOptions.length) {
        throw new BadRequestError(`tierVariations[${tierIndex}] has duplicate options`);
      }

      return normalizedOptions;
    });

    if (skus.length > MAX_SKU_COUNT) {
      throw new BadRequestError(`A product supports at most ${MAX_SKU_COUNT} SKUs`);
    }

    const expectedSkuCount = normalizedTierOptions.length
      ? normalizedTierOptions.reduce((count, options) => count * options.length, 1)
      : null;

    if (normalizedTierOptions.length > 0 && skus.length === 0) {
      throw new BadRequestError('skus are required when tierVariations exist');
    }

    if (expectedSkuCount !== null && skus.length !== expectedSkuCount) {
      throw new BadRequestError(
        `SKU count does not match tier combinations (expected ${expectedSkuCount}, received ${skus.length})`
      );
    }

    const skuCodeSet = new Set();
    const tierIndexSet = new Set();

    skus.forEach((sku, skuIndex) => {
      if (!sku || typeof sku.skuCode !== 'string' || !sku.skuCode.trim()) {
        throw new BadRequestError(`skus[${skuIndex}].skuCode is required`);
      }

      const normalizedSkuCode = sku.skuCode.trim().toLowerCase();
      if (skuCodeSet.has(normalizedSkuCode)) {
        throw new BadRequestError(`Duplicate skuCode detected: ${sku.skuCode}`);
      }
      skuCodeSet.add(normalizedSkuCode);

      if (!Array.isArray(sku.tierIndex)) {
        throw new BadRequestError(`skus[${skuIndex}].tierIndex must be an array`);
      }

      if (sku.tierIndex.length !== normalizedTierOptions.length) {
        throw new BadRequestError(
          `skus[${skuIndex}].tierIndex length must equal number of tier variations`
        );
      }

      const tierKey = sku.tierIndex.join('_');
      if (tierIndexSet.has(tierKey)) {
        throw new BadRequestError(`Duplicate SKU tierIndex combination detected at skus[${skuIndex}]`);
      }
      tierIndexSet.add(tierKey);

      sku.tierIndex.forEach((optionIndex, tierIndex) => {
        if (!Number.isInteger(optionIndex)) {
          throw new BadRequestError(
            `skus[${skuIndex}].tierIndex[${tierIndex}] must be an integer`
          );
        }

        const maxOptionIndex = normalizedTierOptions[tierIndex].length - 1;
        if (optionIndex < 0 || optionIndex > maxOptionIndex) {
          throw new BadRequestError(
            `skus[${skuIndex}].tierIndex[${tierIndex}] is out of range`
          );
        }
      });

      if (sku.images && (!Array.isArray(sku.images) || sku.images.length > MAX_SKU_IMAGES)) {
        throw new BadRequestError(
          `skus[${skuIndex}].images must be an array with at most ${MAX_SKU_IMAGES} items`
        );
      }
    });
  }

  static hasModerationSensitiveChanges(updateData) {
    const moderationFields = [
      'name',
      'description',
      'price',
      'originalPrice',
      'stock',
      'category',
      'images',
      'tierVariations',
      'skus',
      'metaTitle',
      'metaDescription',
      'metaKeywords',
    ];

    return moderationFields.some((field) => updateData[field] !== undefined);
  }

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
    let parsedSkus = this.parseJsonArrayField(skus, 'skus');
    parsedSkus = parsedSkus.map((sku, index) => {
      if (skuImagesMap[index]) {
        sku.images = [skuImagesMap[index]];
      }
      return sku;
    });

    const parsedTierVariations = this.parseJsonArrayField(
      tierVariations,
      'tierVariations'
    );

    this.validateVariantData(parsedTierVariations, parsedSkus);

    // Create product
    const product = await Product.create({
      name,
      description,
      price,
      originalPrice: originalPrice || price,
      stock,
      category,
      images: mainImages,
      tierVariations: parsedTierVariations,
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

    // Search by name, description, and SKU code
    if (search) {
      const safeSearch = this.escapeRegex(String(search).trim());
      if (safeSearch) {
        const searchRegex = new RegExp(safeSearch, 'i');
        query.$or = [
          { name: searchRegex },
          { description: searchRegex },
          { 'skus.skuCode': searchRegex },
        ];
      }
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
    }

    const removeExistingImages = this.parseJsonArrayField(
      updateData.removeExistingImages,
      'removeExistingImages'
    );

    if (!removeExistingImages.every((image) => typeof image === 'string')) {
      throw new BadRequestError('removeExistingImages must contain image URLs only');
    }

    const existingImagesSet = new Set(product.images || []);
    const invalidRemovedImage = removeExistingImages.find((image) => !existingImagesSet.has(image));
    if (invalidRemovedImage) {
      throw new BadRequestError('removeExistingImages contains invalid image URL');
    }

    const retainedExistingImages = (product.images || []).filter(
      (image) => !removeExistingImages.includes(image)
    );

    const hasImageUpdateIntent = removeExistingImages.length > 0 || newImages.length > 0;
    if (hasImageUpdateIntent) {
      const nextImages = [...retainedExistingImages, ...newImages];

      if (nextImages.length === 0) {
        throw new BadRequestError('Product must have at least one image');
      }

      if (nextImages.length > MAX_PRODUCT_IMAGES) {
        throw new BadRequestError(`Product can have at most ${MAX_PRODUCT_IMAGES} images`);
      }

      updateData.images = nextImages;
    }

    delete updateData.removeExistingImages;

    // Parse JSON fields if they are strings (Multipart form data sends objects as strings)
    if (typeof updateData.tierVariations === 'string') {
      updateData.tierVariations = this.parseJsonArrayField(
        updateData.tierVariations,
        'tierVariations'
      );
    }

    if (typeof updateData.skus === 'string') {
      updateData.skus = this.parseJsonArrayField(updateData.skus, 'skus');

      // Map any new sku images that were uploaded
      updateData.skus = updateData.skus.map((sku, index) => {
        if (skuImagesMap[index]) {
          sku.images = [skuImagesMap[index]];
        }
        return sku;
      });
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

    const nextTierVariations =
      updateData.tierVariations !== undefined ? updateData.tierVariations : product.tierVariations;
    const nextSkus = updateData.skus !== undefined ? updateData.skus : product.skus;
    this.validateVariantData(nextTierVariations || [], nextSkus || []);

    if (
      user.role === 'seller' &&
      ['approved', 'rejected'].includes(product.approvalStatus) &&
      this.hasModerationSensitiveChanges(updateData)
    ) {
      updateData.approvalStatus = 'pending';
      updateData.approvedBy = undefined;
      updateData.approvedAt = undefined;
      updateData.rejectionReason = undefined;
    }

    // Update product
    Object.assign(product, updateData);
    await product.save();

    // Populate and return
    await product.populate('category', 'name slug');
    await product.populate('seller', 'name email');

    if (product.approvalStatus === 'pending' && user.role === 'seller') {
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
   * Bulk delete products (soft delete)
   */
  static bulkDeleteProducts = async (productIds, userId) => {
    if (!Array.isArray(productIds) || productIds.length === 0) {
      throw new BadRequestError('Product IDs must be a non-empty array');
    }

    const user = await User.findById(userId).select('role');
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const query = {
      _id: { $in: productIds },
      isActive: true,
    };

    if (user.role !== 'admin') {
      query.seller = userId;
    }

    const products = await Product.find(query).select('_id shop').lean();

    if (products.length === 0) {
      throw new NotFoundError('No active products found to delete');
    }

    const deletableIds = products.map((p) => p._id);

    const result = await Product.updateMany(
      { _id: { $in: deletableIds } },
      { $set: { isActive: false } }
    );

    // Keep shop totalProducts in sync with soft-deleted products.
    const shopDecreaseMap = products.reduce((acc, p) => {
      if (!p.shop) return acc;
      const shopId = p.shop.toString();
      acc[shopId] = (acc[shopId] || 0) + 1;
      return acc;
    }, {});

    const Shop = require('../models/shop.model');
    await Promise.all(
      Object.entries(shopDecreaseMap).map(([shopId, count]) =>
        Shop.findByIdAndUpdate(shopId, { $inc: { totalProducts: -count } })
      )
    );

    return {
      message: `Successfully deleted ${result.modifiedCount} product(s)`,
      deletedCount: result.modifiedCount,
      requestedCount: productIds.length,
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
