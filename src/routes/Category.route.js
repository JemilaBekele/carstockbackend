const express = require('express');

const router = express.Router();
const { categoryController } = require('../controllers');
const auth = require('../middlewares/auth');
// const checkPermission = require('../middlewares/permission.middleware');

// Category Routes
router.post(
  '/api/categories',
  auth,
  //   checkPermission('CREATE_CATEGORY'),
  categoryController.createCategory,
);

router.get(
  '/api/categories/:id',
  auth,
  //   checkPermission('VIEW_CATEGORY'),
  categoryController.getCategory,
);

router.get(
  '/api/categories',
  //   checkPermission('VIEW_CATEGORY'),
  categoryController.getCategories,
);

router.put(
  '/api/categories/:id',
  auth,
  //   checkPermission('UPDATE_CATEGORY'),
  categoryController.updateCategory,
);

router.delete(
  '/api/categories/:id',
  auth,
  //   checkPermission('DELETE_CATEGORY'),
  categoryController.deleteCategory,
);

module.exports = router;
