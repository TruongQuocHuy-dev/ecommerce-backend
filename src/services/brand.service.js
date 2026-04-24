const Brand = require('../models/brand.model');
const { ConflictError, NotFoundError } = require('../utils/error.response');

class BrandService {
  static createBrand = async (payload) => {
    const name = String(payload.name || '').trim();

    const existing = await Brand.findOne({ name });
    if (existing) {
      throw new ConflictError('Brand with this name already exists');
    }

    const brand = await Brand.create({
      name,
      description: payload.description,
      website: payload.website,
      country: payload.country,
    });

    return { brand };
  };

  static getBrands = async (includeInactive = false) => {
    const query = includeInactive ? {} : { isActive: true };
    const brands = await Brand.find(query).sort({ name: 1 }).lean();
    return { brands, totalCount: brands.length };
  };

  static updateBrand = async (id, payload) => {
    const brand = await Brand.findById(id);
    if (!brand) {
      throw new NotFoundError('Brand not found');
    }

    if (payload.name && payload.name !== brand.name) {
      const conflict = await Brand.findOne({ name: payload.name });
      if (conflict) {
        throw new ConflictError('Brand with this name already exists');
      }
    }

    Object.assign(brand, payload);
    await brand.save();

    return { brand };
  };

  static deleteBrand = async (id) => {
    const brand = await Brand.findById(id);
    if (!brand) {
      throw new NotFoundError('Brand not found');
    }

    brand.isActive = false;
    await brand.save();

    return { message: 'Brand deleted successfully' };
  };
}

module.exports = BrandService;
