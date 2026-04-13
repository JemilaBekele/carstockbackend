const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { brandService } = require('../services');
const ApiError = require('../utils/ApiError');

const createBrand = catchAsync(async (req, res) => {
  const brand = await brandService.createBrand(req.body);

  res.status(httpStatus.CREATED).send({
    success: true,
    message: 'Brand created successfully',
    brand,
  });
});

// Update Brand
const updateBrand = catchAsync(async (req, res) => {
  const brand = await brandService.updateBrand(req.params.id, req.body);

  res.status(httpStatus.OK).send({
    success: true,
    message: 'Brand updated successfully',
    brand,
  });
});

//
// Get Brand by ID
//
const getBrand = catchAsync(async (req, res) => {
  const brand = await brandService.getBrandById(req.params.id);
  if (!brand) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Brand not found');
  }

  res.status(httpStatus.OK).send({
    success: true,
    brand,
  });
});

//
// Get All Brands
//
const getBrands = catchAsync(async (req, res) => {
  const result = await brandService.getAllBrands();
  res.status(httpStatus.OK).send({
    success: true,
    ...result,
  });
});

//
// Delete Brand
//
const deleteBrand = catchAsync(async (req, res) => {
  await brandService.deleteBrand(req.params.id);

  res.status(httpStatus.OK).send({
    success: true,
    message: 'Brand deleted successfully',
  });
});

module.exports = {
  createBrand,
  getBrand,
  getBrands,
  updateBrand,
  deleteBrand,
};
