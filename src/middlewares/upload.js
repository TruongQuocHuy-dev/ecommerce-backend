const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../configs/config.cloudinary');

/**
 * Multer + Cloudinary Storage Configuration
 * For uploading product images
 */

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'shopee-clone/products',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [
      {
        width: 800,
        height: 800,
        crop: 'limit',
        quality: 'auto:good',
      },
    ],
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
});

module.exports = upload;
