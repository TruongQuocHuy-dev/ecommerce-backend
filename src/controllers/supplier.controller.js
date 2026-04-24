const { validationResult } = require('express-validator');
const SupplierService = require('../services/supplier.service');
const { OK, CREATED } = require('../utils/success.response');

class SupplierController {
  createSupplier = async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const result = await SupplierService.createSupplier(req.body);
      new CREATED({ message: 'Supplier created successfully', data: result }).send(res);
    } catch (error) {
      next(error);
    }
  };

  getSuppliers = async (req, res, next) => {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const result = await SupplierService.getSuppliers(includeInactive);
      new OK({ message: 'Suppliers retrieved successfully', data: result }).send(res);
    } catch (error) {
      next(error);
    }
  };

  updateSupplier = async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const result = await SupplierService.updateSupplier(req.params.id, req.body);
      new OK({ message: 'Supplier updated successfully', data: result }).send(res);
    } catch (error) {
      next(error);
    }
  };

  deleteSupplier = async (req, res, next) => {
    try {
      const result = await SupplierService.deleteSupplier(req.params.id);
      new OK({ message: result.message }).send(res);
    } catch (error) {
      next(error);
    }
  };
}

module.exports = new SupplierController();
