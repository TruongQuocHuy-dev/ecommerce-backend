const { validationResult } = require('express-validator');
const BrandService = require('../services/brand.service');
const { OK, CREATED } = require('../utils/success.response');

class BrandController {
  createBrand = async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const result = await BrandService.createBrand(req.body);
      new CREATED({ message: 'Brand created successfully', data: result }).send(res);
    } catch (error) {
      next(error);
    }
  };

  getBrands = async (req, res, next) => {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const result = await BrandService.getBrands(includeInactive);
      new OK({ message: 'Brands retrieved successfully', data: result }).send(res);
    } catch (error) {
      next(error);
    }
  };

  updateBrand = async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const result = await BrandService.updateBrand(req.params.id, req.body);
      new OK({ message: 'Brand updated successfully', data: result }).send(res);
    } catch (error) {
      next(error);
    }
  };

  deleteBrand = async (req, res, next) => {
    try {
      const result = await BrandService.deleteBrand(req.params.id);
      new OK({ message: result.message }).send(res);
    } catch (error) {
      next(error);
    }
  };
}

module.exports = new BrandController();
