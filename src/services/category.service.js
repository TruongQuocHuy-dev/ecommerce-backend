const Category = require('../models/category.model');
const {
  BadRequestError,
  NotFoundError,
  ConflictError,
} = require('../utils/error.response');

/**
 * Category Service - Category Management Business Logic
 */

class CategoryService {
  /**
   * Create new category
   */
  static createCategory = async (categoryData) => {
    const { name, description, image, parent } = categoryData;

    // Check if category name already exists
    const existingCategory = await Category.findOne({ name });
    if (existingCategory) {
      throw new ConflictError('Category with this name already exists');
    }

    // If parent provided, verify it exists
    if (parent) {
      const parentCategory = await Category.findById(parent);
      if (!parentCategory) {
        throw new NotFoundError('Parent category not found');
      }
    }

    // Create category
    const category = await Category.create({
      name,
      description,
      image,
      parent: parent || null,
    });

    return {
      category: {
        id: category._id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        image: category.image,
        parent: category.parent,
        isActive: category.isActive,
      },
    };
  };

  /**
   * Get all categories (with hierarchical structure)
   */
  static getCategories = async (includeInactive = false) => {
    const filter = includeInactive ? {} : { isActive: true };

    const categories = await Category.find(filter)
      .populate('parent', 'name slug')
      .sort({ name: 1 });

    // Build hierarchical structure
    const categoryMap = {};
    const rootCategories = [];

    // First pass: create lookup map
    categories.forEach((cat) => {
      categoryMap[cat._id] = {
        id: cat._id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        image: cat.image,
        isActive: cat.isActive,
        children: [],
      };
    });

    // Second pass: build hierarchy
    categories.forEach((cat) => {
      if (cat.parent) {
        const parent = categoryMap[cat.parent._id];
        if (parent) {
          parent.children.push(categoryMap[cat._id]);
        }
      } else {
        rootCategories.push(categoryMap[cat._id]);
      }
    });

    return {
      categories: rootCategories,
      totalCount: categories.length,
    };
  };

  /**
   * Get single category by ID
   */
  static getCategoryById = async (categoryId) => {
    const category = await Category.findById(categoryId).populate(
      'parent',
      'name slug'
    );

    if (!category) {
      throw new NotFoundError('Category not found');
    }

    // Get subcategories
    const subcategories = await category.getSubcategories();

    return {
      category: {
        id: category._id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        image: category.image,
        parent: category.parent,
        isActive: category.isActive,
        subcategories: subcategories.map((sub) => ({
          id: sub._id,
          name: sub.name,
          slug: sub.slug,
        })),
      },
    };
  };

  /**
   * Update category
   */
  static updateCategory = async (categoryId, updateData) => {
    const category = await Category.findById(categoryId);

    if (!category) {
      throw new NotFoundError('Category not found');
    }

    // Check if new name conflicts with existing
    if (updateData.name && updateData.name !== category.name) {
      const existing = await Category.findOne({ name: updateData.name });
      if (existing) {
        throw new ConflictError('Category with this name already exists');
      }
    }

    // If parent is being updated, verify it exists
    if (updateData.parent) {
      const parentCategory = await Category.findById(updateData.parent);
      if (!parentCategory) {
        throw new NotFoundError('Parent category not found');
      }
      
      // Prevent circular reference
      if (updateData.parent === categoryId) {
        throw new BadRequestError('Category cannot be its own parent');
      }
    }

    // Update category
    Object.assign(category, updateData);
    await category.save();

    return {
      category: {
        id: category._id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        image: category.image,
        parent: category.parent,
        isActive: category.isActive,
      },
    };
  };

  /**
   * Delete category (soft delete)
   */
  static deleteCategory = async (categoryId) => {
    const category = await Category.findById(categoryId);

    if (!category) {
      throw new NotFoundError('Category not found');
    }

    // Check if category has subcategories
    const subcategories = await Category.find({ parent: categoryId });
    if (subcategories.length > 0) {
      throw new BadRequestError(
        'Cannot delete category with subcategories. Delete or reassign subcategories first.'
      );
    }

    // Soft delete
    category.isActive = false;
    await category.save();

    return {
      message: 'Category deleted successfully',
    };
  };
}

module.exports = CategoryService;
