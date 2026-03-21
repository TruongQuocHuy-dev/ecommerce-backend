const { validationResult } = require('express-validator');
const AddressService = require('../services/address.service');
const { OK, CREATED } = require('../utils/success.response');

/**
 * Address Controller - HTTP Handlers
 */

class AddressController {
  /**
   * POST /api/v1/addresses
   * Create new address
   */
  createAddress = async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user.userId;
      const result = await AddressService.createAddress(userId, req.body);

      new CREATED({
        message: 'Address created successfully',
        data: result,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/addresses
   * Get all user addresses
   */
  getUserAddresses = async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const result = await AddressService.getUserAddresses(userId);

      new OK({
        message: 'Addresses retrieved successfully',
        data: result,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/addresses/:id
   * Get single address
   */
  getAddress = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.userId;

      const result = await AddressService.getAddressById(id, userId);

      new OK({
        message: 'Address retrieved successfully',
        data: result,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * PUT /api/v1/addresses/:id
   * Update address
   */
  updateAddress = async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const userId = req.user.userId;

      const result = await AddressService.updateAddress(id, userId, req.body);

      new OK({
        message: 'Address updated successfully',
        data: result,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/v1/addresses/:id
   * Delete address
   */
  deleteAddress = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.userId;

      const result = await AddressService.deleteAddress(id, userId);

      new OK({
        message: result.message,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * PUT /api/v1/addresses/:id/set-default
   * Set address as default
   */
  setAsDefault = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.userId;

      const result = await AddressService.setAsDefault(id, userId);

      new OK({
        message: result.message,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/addresses/default
   * Get default address
   */
  getDefaultAddress = async (req, res, next) => {
    try {
      const userId = req.user.userId;

      const result = await AddressService.getDefaultAddress(userId);

      new OK({
        message: 'Default address retrieved successfully',
        data: result,
      }).send(res);
    } catch (error) {
      next(error);
    }
  };
}

module.exports = new AddressController();
