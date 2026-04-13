const express = require('express');

const router = express.Router();
const { productController } = require('../controllers');
const auth = require('../middlewares/auth');
const { uploadImage } = require('../utils/multer');

// const checkPermission = require('../middlewares/permission.middleware');

// Create a product

router.post(
  '/api/products',
  auth,
  uploadImage,
  // checkPermission('CREATE_PRODUCT'),
  productController.createProduct,
);
router.get(
  '/api/products/Active/All',
  // checkPermission('CREATE_PRODUCT'),
  productController.getActiveAllProducts,
);
router.get(
  '/api/products/random/with/shop/stocks',
  // checkPermission('CREATE_PRODUCT'), getRandomProductsWithShopStocks
  productController.getRandomProductsWithShopStocks,
);

router.get(
  '/api/products/get/all/Top/Selling/Products',
  auth,
  // checkPermission('VIEW_PRODUCT_BATCHES'), // Uncomment if you have permission checks
  productController.getTopSellingProducts,
);
// Get a product by ID
router.get(
  '/api/products/:id',
  // checkPermission('VIEW_PRODUCT'),
  productController.getProduct,
);

// Get a product by code
router.get(
  '/api/products/code/:code',
  auth,
  // checkPermission('VIEW_PRODUCT'),
  productController.getProductByCode,
);

// Get all products
router.get(
  '/api/products',
  auth,

  // checkPermission('VIEW_PRODUCT'),
  productController.getProducts,
);

// Update a product
router.put(
  '/api/products/:id',
  auth,
  uploadImage,
  // checkPermission('UPDATE_PRODUCT'),
  productController.updateProduct,
);

// Delete a product
router.delete(
  '/api/products/:id',
  auth,
  // checkPermission('DELETE_PRODUCT'),
  productController.deleteProduct,
);
router.get(
  '/api/product/detail/:productId',
  auth,
  productController.getProductById,
);
router.get(
  '/api/products/shop/find/ByShops/:productId',
  auth, // if you need authentication
  productController.getProductByShops,
);
module.exports = router;
