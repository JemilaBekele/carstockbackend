/* eslint-disable no-restricted-syntax */
const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { productService } = require('../services');
const ApiError = require('../utils/ApiError');

// Create Product
const createProduct = catchAsync(async (req, res) => {
  // Structure files by field name
  const structuredFiles = {};

  if (Array.isArray(req.files)) {
    req.files.forEach((file) => {
      if (!structuredFiles[file.fieldname]) {
        structuredFiles[file.fieldname] = [];
      }
      structuredFiles[file.fieldname].push(file);
    });
  } else if (req.files) {
    for (const [fieldname, files] of Object.entries(req.files)) {
      structuredFiles[fieldname] = Array.isArray(files) ? files : [files];
    }
  }

  // Ensure image field exists even if no file was uploaded
  structuredFiles.image = structuredFiles.image || undefined;

  const product = await productService.createProduct(req.body, structuredFiles);

  res.status(httpStatus.CREATED).send({
    success: true,
    message: 'Product created successfully',
    product,
  });
});
const createProductBatch = catchAsync(async (req, res) => {
  const { productId } = req.params;
  const batchData = req.body;
  const userId = req.user.id; // Assuming user is attached to request during authentication

  const productBatch = await productService.createProductBatch(
    productId,
    batchData,
    userId,
  );

  res.status(httpStatus.CREATED).send({
    success: true,
    message: 'Product batch created successfully',
    productBatch,
  });
});
// Update Product
const updateProduct = catchAsync(async (req, res) => {
  // Structure files by field name
  const structuredFiles = {};

  if (Array.isArray(req.files)) {
    req.files.forEach((file) => {
      if (!structuredFiles[file.fieldname]) {
        structuredFiles[file.fieldname] = [];
      }
      structuredFiles[file.fieldname].push(file);
    });
  } else if (req.files) {
    for (const [fieldname, files] of Object.entries(req.files)) {
      structuredFiles[fieldname] = Array.isArray(files) ? files : [files];
    }
  }

  // Ensure image field exists even if no file was uploaded
  structuredFiles.image = structuredFiles.image || undefined;

  const product = await productService.updateProduct(
    req.params.id,
    req.body,
    structuredFiles,
  );

  res.status(httpStatus.OK).send({
    success: true,
    message: 'Product updated successfully',
    product,
  });
});
// Get Product by ID
const getProduct = catchAsync(async (req, res) => {
  const product = await productService.getProductById(req.params.id);
  if (!product) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Product not found');
  }
  res.status(httpStatus.OK).send({
    success: true,
    product,
  });
});

const getBatchesByProduct = catchAsync(async (req, res) => {
  const { productId } = req.params;
  const result = await productService.getBatchesByProduct(productId);
  res.status(httpStatus.OK).send({
    success: true,
    ...result,
  });
});
// Get Product by Code
const getProductByCode = catchAsync(async (req, res) => {
  const product = await productService.getProductByCode(req.params.code);
  if (!product) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Product not found');
  }
  res.status(httpStatus.OK).send({
    success: true,
    product,
  });
});

// Get all Products
const getActiveAllProducts = catchAsync(async (req, res) => {
  const result = await productService.getActiveAllProducts();
  res.status(httpStatus.OK).send({
    success: true,
    ...result,
  });
});

const getProducts = catchAsync(async (req, res) => {
  const userId = req.user.id;
  console.log('Fetching products for user ID:', userId);

  const result = await productService.getAllProducts(userId);
  res.status(httpStatus.OK).send({
    success: true,
    ...result,
  });
});
const getTopSellingProducts = catchAsync(async (req, res) => {
  const { searchTerm, categoryName, subCategoryName } = req.query;
  const userId = req.user.id;

  // Convert empty strings to null and ensure proper parameter assignment
  const processedSearchTerm =
    searchTerm && searchTerm.trim() !== '' ? searchTerm.trim() : null;
  const processedCategoryName =
    categoryName && categoryName.trim() !== '' ? categoryName.trim() : null;
  const processedSubCategoryName =
    subCategoryName && subCategoryName.trim() !== ''
      ? subCategoryName.trim()
      : null;

  // DEBUG: Check if parameters are being mixed up
  if (processedSearchTerm && isValidUUID(processedSearchTerm)) {
    console.warn(
      '⚠️ WARNING: searchTerm looks like a UUID, might be parameter mixup',
    );
  }

  // DEBUG: Check if category/subcategory names look like UUIDs
  if (processedCategoryName && isValidUUID(processedCategoryName)) {
    console.warn(
      '⚠️ WARNING: categoryName looks like a UUID, did you mean to use the name?',
    );
  }

  if (processedSubCategoryName && isValidUUID(processedSubCategoryName)) {
    console.warn(
      '⚠️ WARNING: subCategoryName looks like a UUID, did you mean to use the name?',
    );
  }

  const result = await productService.getTopSellingProducts(
    userId,
    processedSearchTerm, // This should be the text search
    processedCategoryName, // This should be the category name
    processedSubCategoryName, // This should be the subcategory name
  );

  res.status(httpStatus.OK).send({
    success: true,
    ...result,
  });
});

// Helper function to check if string is a valid UUID
function isValidUUID(str) {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}
const getRandomProductsWithShopStocks = catchAsync(async (req, res) => {
  const result = await productService.getRandomProductsWithShopStocks();

  res.status(httpStatus.OK).send({
    success: true,
    ...result,
  });
});
// Delete Product
const deleteProduct = catchAsync(async (req, res) => {
  await productService.deleteProduct(req.params.id);
  res.status(httpStatus.OK).send({
    success: true,
    message: 'Product deleted successfully',
  });
});
const createProductBatchsingle = catchAsync(async (req, res) => {
  const productBatch = await productService.createProductBatchsingle(req.body);
  res.status(httpStatus.CREATED).send({
    success: true,
    message: 'Product batch created successfully',
    data: productBatch,
  });
});
const getProductById = catchAsync(async (req, res) => {
  const { productId } = req.params;
  const userId = req.user.id;
  const productDetails = await productService.getProductDetails(
    productId,
    userId,
  );

  if (!productDetails) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Product not found');
  }

  res.status(httpStatus.OK).send({ product: productDetails });
});
const getProductBatchesByShopsController = catchAsync(async (req, res) => {
  const { productId } = req.params;

  const batches = await productService.getProductBatchesByShops(productId);

  if (!batches || batches.length === 0) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      'No available batches found for this product',
    );
  }
  res.status(httpStatus.OK).send({ batches });
});
// getProductBatchesByShopsForUser
const getProductBatchesByShopsForUser = catchAsync(async (req, res) => {
  const { productId } = req.params;
  const userId = req.user.id;
  const batches = await productService.getProductBatchesByShopsForUser(
    productId,
    userId,
  );

  if (!batches || batches.length === 0) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      'No available batches found for this product',
    );
  }

  res.status(httpStatus.OK).send({ batches });
});

module.exports = {
  createProductBatch,
  createProduct,
  getProduct,
  getProductByCode,
  getProducts,
  updateProduct,
  deleteProduct,
  getBatchesByProduct,
  createProductBatchsingle,
  getProductById,
  getProductBatchesByShopsController,
  getTopSellingProducts,
  getActiveAllProducts,
  getRandomProductsWithShopStocks,
  getProductBatchesByShopsForUser,
};
