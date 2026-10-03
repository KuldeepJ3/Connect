const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// 1. Authenticate with your .env credentials
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// 2. Configure the storage engine to accept all media types
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'connect_app_uploads', // This folder will auto-create in Cloudinary
    resource_type: 'auto'          // Crucial: Allows images, videos, and documents
  }
});

// 3. Create the Multer upload middleware
const upload = multer({ storage: storage });

module.exports = upload;