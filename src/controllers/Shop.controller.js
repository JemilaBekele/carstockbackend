const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { shopService } = require('../services');
const ApiError = require('../utils/ApiError');

// Create Shop
const createShop = catchAsync(async (req, res) => {
  const shop = await shopService.createShop(req.body);
  res.status(httpStatus.CREATED).send({
    success: true,
    message: 'Shop created successfully',
    shop,
  });
});

// Get Shop by ID
const getShop = catchAsync(async (req, res) => {
  const shop = await shopService.getShopById(req.params.id);
  if (!shop) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Shop not found');
  }
  res.status(httpStatus.OK).send({
    success: true,
    shop,
  });
});

// Get all Shops 
const getShops = catchAsync(async (req, res) => {
  const userId = req.user.id; // ✅ extract userId
  const result = await shopService.getAllShops(userId);
  res.status(httpStatus.OK).send({
    success: true,
    ...result,
  });
});
const getAllshop = catchAsync(async (req, res) => {
  const result = await shopService.getAllshop();
  res.status(httpStatus.OK).send({
    success: true,
    ...result,
  });
});
// controller getAllShopsbaseduser

const getAllShopsbaseduser = catchAsync(async (req, res) => {
  const userId = req.user.id; // ✅ extract userId
  const result = await shopService.getAllShopsbaseduser(userId);
  res.status(httpStatus.OK).send({
    success: true,
    ...result,
  });
});

const getAvailableBatchesByProductAndShop = catchAsync(async (req, res) => {
  const { productId, shopId } = req.params;
  const result = await shopService.getAvailableBatchesByProductAndShop(
    productId,
    shopId,
  );

  res.status(httpStatus.OK).send({
    success: true,
    ...result,
  });
});
const UsergetAvailableBatchesByProductAndShop = catchAsync(async (req, res) => {
  const { shopId, productId } = req.params;
  const userId = req.user.id; // ✅ extract params
  const result = await shopService.UsergetAvailableBatchesByProductAndShop(
    shopId,
    productId,
    userId,
  );

  res.status(httpStatus.OK).send({
    success: true,
    ...result,
  });
});

// Update Shop
const updateShop = catchAsync(async (req, res) => {
  const shop = await shopService.updateShop(req.params.id, req.body);
  res.status(httpStatus.OK).send({
    success: true,
    message: 'Shop updated successfully',
    shop,
  });
});

// Delete Shop
const deleteShop = catchAsync(async (req, res) => {
  await shopService.deleteShop(req.params.id);
  res.status(httpStatus.OK).send({
    success: true,
    message: 'Shop deleted successfully',
  });
});

module.exports = {
  createShop,
  getAllshop,
  getShop,
  getShops,
  updateShop,
  deleteShop,
  getAvailableBatchesByProductAndShop,
  getAllShopsbaseduser,
  UsergetAvailableBatchesByProductAndShop,
};
