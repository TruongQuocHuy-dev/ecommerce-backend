const Supplier = require('../models/supplier.model');
const { ConflictError, NotFoundError } = require('../utils/error.response');

class SupplierService {
  static createSupplier = async (payload) => {
    const name = String(payload.name || '').trim();

    const existing = await Supplier.findOne({ name });
    if (existing) {
      throw new ConflictError('Supplier with this name already exists');
    }

    const supplier = await Supplier.create({
      name,
      contactName: payload.contactName,
      email: payload.email,
      phone: payload.phone,
      address: payload.address,
    });

    return { supplier };
  };

  static getSuppliers = async (includeInactive = false) => {
    const query = includeInactive ? {} : { isActive: true };
    const suppliers = await Supplier.find(query).sort({ name: 1 }).lean();
    return { suppliers, totalCount: suppliers.length };
  };

  static updateSupplier = async (id, payload) => {
    const supplier = await Supplier.findById(id);
    if (!supplier) {
      throw new NotFoundError('Supplier not found');
    }

    if (payload.name && payload.name !== supplier.name) {
      const conflict = await Supplier.findOne({ name: payload.name });
      if (conflict) {
        throw new ConflictError('Supplier with this name already exists');
      }
    }

    Object.assign(supplier, payload);
    await supplier.save();

    return { supplier };
  };

  static deleteSupplier = async (id) => {
    const supplier = await Supplier.findById(id);
    if (!supplier) {
      throw new NotFoundError('Supplier not found');
    }

    supplier.isActive = false;
    await supplier.save();

    return { message: 'Supplier deleted successfully' };
  };
}

module.exports = SupplierService;
