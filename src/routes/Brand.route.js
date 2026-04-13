const express = require('express');

const router = express.Router();
const { brandController } = require('../controllers');
const auth = require('../middlewares/auth');

//
// Create a Brand
//
router.post(
  '/api/brands',
  // auth,
  brandController.createBrand,
);

//
// Get a Brand by ID
//
router.get(
  '/api/brands/:id',
  // checkPermission('VIEW_BRAND'),
  brandController.getBrand,
);

//
// Get all Brands
//
router.get(
  '/api/brands',
  // checkPermission('VIEW_BRAND'),
  brandController.getBrands,
);

//
// Update a Brand
//
router.put('/api/brands/:id', auth, brandController.updateBrand);

router.delete(
  '/api/brands/:id',
  auth,
  // checkPermission('DELETE_BRAND'),
  brandController.deleteBrand,
);

module.exports = router;
