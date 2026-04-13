const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { categoryService } = require('../services');
const ApiError = require('../utils/ApiError');

// Create Category
const createCategory = catchAsync(async (req, res) => {
  const category = await categoryService.createCategory(req.body);
  res.status(httpStatus.CREATED).send({
    success: true,
    message: 'Category created successfully',
    category,
  });
});

// Get Category by ID
const getCategory = catchAsync(async (req, res) => {
  const category = await categoryService.getCategoryById(req.params.id);
  if (!category) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Category not found');
  }
  res.status(httpStatus.OK).send({
    success: true,
    category,
  });
});

// Get all Categories
const getCategories = catchAsync(async (req, res) => {
  const result = await categoryService.getAllCategories();
  res.status(httpStatus.OK).send({
    success: true,
    ...result,
  });
});
// Update Category
const updateCategory = catchAsync(async (req, res) => {
  const category = await categoryService.updateCategory(
    req.params.id,
    req.body,
  );
  res.status(httpStatus.OK).send({
    success: true,
    message: 'Category updated successfully',
    category,
  });
});

// Delete Category
const deleteCategory = catchAsync(async (req, res) => {
  await categoryService.deleteCategory(req.params.id);
  res.status(httpStatus.OK).send({
    success: true,
    message: 'Category deleted successfully',
  });
});

module.exports = {
  createCategory,
  getCategory,
  getCategories,
  updateCategory,
  deleteCategory,
};
