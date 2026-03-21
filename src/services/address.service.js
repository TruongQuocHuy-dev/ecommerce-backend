const Address = require('../models/address.model');
const {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
} = require('../utils/error.response');

/**
 * Address Service - Address Management Business Logic
 */

class AddressService {
  /**
   * Create new address
   */
  static createAddress = async (userId, addressData) => {
    const { name, phone, address, city, province, postalCode, isDefault } = addressData;

    // If this is set as default, unset all other defaults first
    if (isDefault) {
      await Address.updateMany({ user: userId }, { isDefault: false });
    } else {
      // Check if user has any addresses
      const addressCount = await Address.countDocuments({ user: userId });
      // If this is the first address, make it default
      if (addressCount === 0) {
        addressData.isDefault = true;
      }
    }

    const newAddress = await Address.create({
      user: userId,
      name,
      phone,
      address,
      city,
      province,
      postalCode,
      isDefault: addressData.isDefault,
    });

    return {
      address: {
        id: newAddress._id,
        name: newAddress.name,
        phone: newAddress.phone,
        address: newAddress.address,
        city: newAddress.city,
        province: newAddress.province,
        postalCode: newAddress.postalCode,
        isDefault: newAddress.isDefault,
        createdAt: newAddress.createdAt,
      },
    };
  };

  /**
   * Get all user addresses
   */
  static getUserAddresses = async (userId) => {
    const addresses = await Address.find({ user: userId })
      .sort({ isDefault: -1, createdAt: -1 })
      .lean();

    return {
      addresses: addresses.map((addr) => ({
        id: addr._id,
        name: addr.name,
        phone: addr.phone,
        address: addr.address,
        city: addr.city,
        province: addr.province,
        postalCode: addr.postalCode,
        isDefault: addr.isDefault,
        createdAt: addr.createdAt,
      })),
      totalCount: addresses.length,
    };
  };

  /**
   * Get single address by ID
   */
  static getAddressById = async (addressId, userId) => {
    const address = await Address.findById(addressId);

    if (!address) {
      throw new NotFoundError('Address not found');
    }

    // Verify user owns this address
    if (address.user.toString() !== userId) {
      throw new ForbiddenError('You are not authorized to access this address');
    }

    return {
      address: {
        id: address._id,
        name: address.name,
        phone: address.phone,
        address: address.address,
        city: address.city,
        province: address.province,
        postalCode: address.postalCode,
        isDefault: address.isDefault,
        createdAt: address.createdAt,
      },
    };
  };

  /**
   * Update address
   */
  static updateAddress = async (addressId, userId, updateData) => {
    const address = await Address.findById(addressId);

    if (!address) {
      throw new NotFoundError('Address not found');
    }

    // Verify user owns this address
    if (address.user.toString() !== userId) {
      throw new ForbiddenError('You are not authorized to update this address');
    }

    // If setting as default, unset all other defaults first
    if (updateData.isDefault === true) {
      await Address.updateMany({ user: userId }, { isDefault: false });
    }

    // Update address
    Object.assign(address, updateData);
    await address.save();

    return {
      address: {
        id: address._id,
        name: address.name,
        phone: address.phone,
        address: address.address,
        city: address.city,
        province: address.province,
        postalCode: address.postalCode,
        isDefault: address.isDefault,
        updatedAt: address.updatedAt,
      },
    };
  };

  /**
   * Delete address
   */
  static deleteAddress = async (addressId, userId) => {
    const address = await Address.findById(addressId);

    if (!address) {
      throw new NotFoundError('Address not found');
    }

    // Verify user owns this address
    if (address.user.toString() !== userId) {
      throw new ForbiddenError('You are not authorized to delete this address');
    }

    const wasDefault = address.isDefault;

    await address.deleteOne();

    // If deleted address was default, set another address as default
    if (wasDefault) {
      const nextAddress = await Address.findOne({ user: userId }).sort({ createdAt: -1 });
      if (nextAddress) {
        nextAddress.isDefault = true;
        await nextAddress.save();
      }
    }

    return {
      message: 'Address deleted successfully',
    };
  };

  /**
   * Set address as default
   */
  static setAsDefault = async (addressId, userId) => {
    const address = await Address.findById(addressId);

    if (!address) {
      throw new NotFoundError('Address not found');
    }

    // Verify user owns this address
    if (address.user.toString() !== userId) {
      throw new ForbiddenError('You are not authorized to modify this address');
    }

    // Set as default
    await Address.setAsDefault(addressId, userId);

    return {
      message: 'Default address updated successfully',
    };
  };

  /**
   * Get default address
   */
  static getDefaultAddress = async (userId) => {
    const address = await Address.findOne({ user: userId, isDefault: true });

    if (!address) {
      throw new NotFoundError('No default address found');
    }

    return {
      address: {
        id: address._id,
        name: address.name,
        phone: address.phone,
        address: address.address,
        city: address.city,
        province: address.province,
        postalCode: address.postalCode,
        isDefault: address.isDefault,
      },
    };
  };
}

module.exports = AddressService;
