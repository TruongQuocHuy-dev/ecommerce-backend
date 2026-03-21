const mongoose = require('mongoose');
const slugify = require('slugify');

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a category name'],
      unique: true,
      trim: true,
      maxlength: [50, 'Category name cannot exceed 50 characters'],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
    },
    description: {
      type: String,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    image: {
      type: String, // Cloudinary URL
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null, // null means root category
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Generate slug from name before saving
categorySchema.pre('save', function (next) {
  if (this.isModified('name')) {
    this.slug = slugify(this.name, {
      lower: true,
      strict: true,
    });
  }
  next();
});

// Method to get subcategories
categorySchema.methods.getSubcategories = async function () {
  return await this.model('Category').find({ parent: this._id, isActive: true });
};

// Indexes for faster queries (slug index not needed - defined with unique: true in field)
categorySchema.index({ parent: 1 });
categorySchema.index({ isActive: 1 });

module.exports = mongoose.model('Category', categorySchema);
