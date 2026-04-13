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
  const { searchTerm, categoryName, brandName } = req.query;
  const userId = req.user.id;

  // Convert empty strings to null and ensure proper parameter assignment
  const processedSearchTerm =
    searchTerm && searchTerm.trim() !== '' ? searchTerm.trim() : null;
  const processedCategoryName =
    categoryName && categoryName.trim() !== '' ? categoryName.trim() : null;
  const processedBrandName =
    brandName && brandName.trim() !== '' ? brandName.trim() : null;

  // DEBUG: Check if parameters are being mixed up
  if (processedSearchTerm && isValidUUID(processedSearchTerm)) {
    console.warn(
      '⚠️ WARNING: searchTerm looks like a UUID, might be parameter mixup',
    );
  }

  // DEBUG: Check if category name looks like UUID
  if (processedCategoryName && isValidUUID(processedCategoryName)) {
    console.warn(
      '⚠️ WARNING: categoryName looks like a UUID, did you mean to use the name?',
    );
  }

  // DEBUG: Check if brand name looks like UUID
  if (processedBrandName && isValidUUID(processedBrandName)) {
    console.warn(
      '⚠️ WARNING: brandName looks like a UUID, did you mean to use the name?',
    );
  }

  console.log('getTopSellingProducts params:', {
    userId,
    searchTerm: processedSearchTerm,
    categoryName: processedCategoryName,
    brandName: processedBrandName,
  });

  const result = await productService.getTopSellingProducts(
    userId,
    processedSearchTerm,
    processedCategoryName,
    processedBrandName,
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

const getProductByShops = catchAsync(async (req, res) => {
  const { productId } = req.params;
  const userId = req.user.id;
  const products = await productService.getProductByShops(productId, userId);

  if (!products || products.length === 0) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      'No available products found for this product',
    );
  }

  res.status(httpStatus.OK).send({ products });
});
module.exports = {
  createProduct,
  getProduct,
  getProductByCode,
  getProducts,
  updateProduct,
  deleteProduct,
  getProductById,
  getTopSellingProducts,
  getActiveAllProducts,
  getRandomProductsWithShopStocks,
  getProductByShops,
};
