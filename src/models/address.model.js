const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Please provide recipient name'],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Please provide phone number'],
      trim: true,
    },
    address: {
      type: String,
      required: [true, 'Please provide street address'],
      trim: true,
    },
    city: {
      type: String,
      required: [true, 'Please provide city'],
      trim: true,
    },
    province: {
      type: String,
      trim: true,
    },
    postalCode: {
      type: String,
      trim: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster user address lookup
addressSchema.index({ user: 1 });
addressSchema.index({ user: 1, isDefault: 1 });

// Static method to set address as default
addressSchema.statics.setAsDefault = async function (addressId, userId) {
  // First, set all user's addresses to non-default
  await this.updateMany(
    { user: userId },
    { isDefault: false }
  );
  
  // Then set the specified address as default
  await this.findByIdAndUpdate(addressId, { isDefault: true });
};

module.exports = mongoose.model('Address', addressSchema);
