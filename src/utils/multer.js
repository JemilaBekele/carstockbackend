// config/multer.config.js
const multer = require('multer');
const httpStatus = require('http-status');
const path = require('path');
const fs = require('fs');
const ApiError = require('./ApiError');

// Create a wrapped version of the multer middleware
const debugUploadSellFiles = function (req, res, next) {
  // Count the number of times fileFilter is called
  let fileFilterCallCount = 0;

  // Configure storage for sell files
  const storage = multer.diskStorage({
    destination(req, file, cb) {
      let destPath;

      // Save images to sell/images folder
      if (file.fieldname === 'image') {
        destPath = path.join(__dirname, '../../uploads/sell/images');
      }
      // Save documents to sell/documents folder
      else if (file.fieldname === 'document') {
        destPath = path.join(__dirname, '../../uploads/sell/documents');
      }
      // For any other files, use temporary location
      else {
        destPath = path.join(__dirname, '../../uploads/temp');
      }

      // Ensure directory exists
      fs.mkdir(destPath, { recursive: true }, (err) => {
        if (err) {
          console.error('Error creating directory:', err);
          return cb(err);
        }
        console.log('Directory ensured:', destPath);
        cb(null, destPath);
      });
    },
    filename(req, file, cb) {
      // Generate unique filename
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const ext = path.extname(file.originalname);
      const basename = path.basename(file.originalname, ext);

      // Clean filename (remove special characters)
      const cleanBasename = basename.replace(/[^a-zA-Z0-9-_]/g, '');
      const filename = `${cleanBasename}-${uniqueSuffix}${ext}`;

      cb(null, filename);
    },
  });

  // Create a new instance with enhanced logging
  const enhancedMulter = multer({
    storage,
    fileFilter: (req, file, cb) => {
      fileFilterCallCount++;

      // IMPORTANT: Accept image files
      if (file.fieldname === 'image') {
        const allowedImageTypes = [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          'image/jpg',
        ];

        if (!allowedImageTypes.includes(file.mimetype)) {
          return cb(
            new ApiError(
              httpStatus.BAD_REQUEST,
              'Image must be a valid image file (jpeg, png, gif, webp)',
            ),
            false,
          );
        }
        return cb(null, true);
      }

      // IMPORTANT: Accept document files
      if (file.fieldname === 'document') {
        const allowedDocumentTypes = [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/plain',
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
        ];

        if (!allowedDocumentTypes.includes(file.mimetype)) {
          return cb(
            new ApiError(httpStatus.BAD_REQUEST, 'Unsupported document type'),
            false,
          );
        }
        return cb(null, true);
      }

      // Reject all other fields
      return cb(null, false);
    },
    limits: {
      fileSize: 20 * 1024 * 1024, // 20MB limit
    },
  });

  // Use .fields() to accept specific field names
  const uploadMiddleware = enhancedMulter.fields([
    { name: 'image', maxCount: 1 },
    { name: 'document', maxCount: 1 },
  ]);

  // Call the multer middleware
  uploadMiddleware(req, res, (err) => {
    if (err) {
      console.error('❌ Multer error:', err);
      console.error('Error details:', {
        message: err.message,
        name: err.name,
        stack: err.stack,
      });
      return next(err);
    }

    if (req.files) {
      Object.keys(req.files).forEach((fieldname) => {
        const files = req.files[fieldname];
        files.forEach((file, index) => {
          console.log(
            `    [${index}] ${file.originalname} (${file.mimetype}, ${file.size} bytes)`,
          );
          console.log(`        Saved to: ${file.path}`);
        });
      });
    }

    next();
  });
};
const uploadImage = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    // Only process these specific fields as files
    if (['image'].includes(file.fieldname)) {
      if (!file.mimetype.startsWith('image/')) {
        return cb(
          new ApiError(httpStatus.BAD_REQUEST, 'Only images allowed'),
          false,
        );
      }
      return cb(null, true);
    }
    // Explicitly ignore all other fields
    return cb(null, false);
  },
  limits: { fileSize: 40 * 1024 * 1024 }, // 🔺 40MB limit
}).any();
const uploadImacamp = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    // Only process these specific fields as files
    if (['logo'].includes(file.fieldname)) {
      if (!file.mimetype.startsWith('image/')) {
        return cb(
          new ApiError(httpStatus.BAD_REQUEST, 'Only images allowed'),
          false,
        );
      }
      return cb(null, true);
    }
    // Explicitly ignore all other fields
    return cb(null, false);
  },
  limits: { fileSize: 40 * 1024 * 1024 }, // 🔺 40MB limit
}).any();
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    // Only process these specific fields as files
    if (['photo', 'national'].includes(file.fieldname)) {
      if (!file.mimetype.startsWith('image/')) {
        return cb(
          new ApiError(httpStatus.BAD_REQUEST, 'Only images allowed'),
          false,
        );
      }
      return cb(null, true);
    }
    // Explicitly ignore all other fields
    return cb(null, false);
  },
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
}).any();

module.exports = {
  upload,
  uploadImage,
  uploadImacamp,
  debugUploadSellFiles,
};
