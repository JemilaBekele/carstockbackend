const express = require('express');

const router = express.Router();
const validate = require('../middlewares/validate');
const { authValidation } = require('../validations');
const { authController } = require('../controllers');
const auth = require('../middlewares/auth');
// const checkPermission = require('../middlewares/permission.middleware');

// User management routes
router.post(
  '/api/register',
  auth,
  // checkPermission('CREATE_USER'),
  // validate(userValidation.createUserSchema),
  authController.createUser,
);

router.get(
  '/api/users',
  auth,
  // validate(userValidation.getUsersSchema),
  authController.getUsers,
);

router.get(
  '/api/users/:userId',
  auth,
  // validate(userValidation.getUserSchema),
  authController.getUser,
);
router.get(
  '/api/users/Usermy/data',
  auth,
  // validate(userValidation.getUserSchema),
  authController.getUsermy,
);

router.put(
  '/api/users/:userId',
  auth,
  // checkPermission('UPDATE_USER'),
  // validate(userValidation.updateUserSchema),
  authController.updateUser,
);
router.patch(
  '/api/users/change-password',
  auth,
  authController.changeUserPassword,
);
router.delete(
  '/api/users/:userId',
  auth,
  // checkPermission('DELETE_USER'),
  authController.deleteUser,
);

router.put(
  '/api/users/:userId/status',
  auth,
  // checkPermission('UPDATE_USER_STATUS'),
  // validate(userValidation.changeStatusSchema),
  authController.changeUserStatus,
);

router.get(
  '/api/users/email',
  auth,
  // validate(userValidation.getUserByEmailSchema),
  authController.getUserByEmail,
);

// Authentication route
router.post(
  '/api/login',
  // validate(userValidation.loginSchema),  , Saleslogin,
  authController.login,
);
router.post(
  '/api/login/Sales/only',
  // validate(userValidation.loginSchema),  , ,
  authController.Saleslogin,
);
router.post(
  '/api/login/Store/only',
  // validate(userValidation.loginSchema),  Storelogin, Saleslogin,
  authController.Storelogin,
);
router.post(
  '/api/auth/refresh-tokens',
  validate(authValidation.refreshTokenSchema),
  authController.refreshTokens,
);
router.put(
  '/api/user/reset-password/:userId',
  auth,
  authController.resetPassword,
);
module.exports = router;
