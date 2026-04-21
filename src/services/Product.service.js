/* eslint-disable no-underscore-dangle */
const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const prisma = require('./prisma');
const { uploadImage } = require('../utils/upload.util');

// Get Product by ID
const getProductById = async (id) => {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
      brand: true,
      unitOfMeasure: true,

      AdditionalPrice: {
        include: {
          shop: {
            include: {
              branch: true,
            },
          },
        },
      },
    },
  });
  return product;
};

const getAllProducts = async (userId) => {
  // First, get the user with their accessible shops and stores
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      shops: {
        select: { id: true },
      },
      stores: {
        select: { id: true },
      },
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Get only the shops and stores the user has access to
  const accessibleShopIds = user.shops.map((shop) => shop.id);
  const accessibleStoreIds = user.stores.map((store) => store.id);

  // Get shops and stores the user can access with branch information
  const [shops, stores] = await Promise.all([
    prisma.shop.findMany({
      where: {
        id: { in: accessibleShopIds },
      },
      select: {
        id: true,
        name: true,
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    prisma.store.findMany({
      where: {
        id: { in: accessibleStoreIds },
      },
      select: {
        id: true,
        name: true,
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
  ]);

  // Create maps for shop and store names including branch info
  const shopMap = Object.fromEntries(shops.map((shop) => [shop.id, shop.name]));
  const storeMap = Object.fromEntries(
    stores.map((store) => [store.id, store.name]),
  );

  // Get all products with their stock information
  const products = await prisma.product.findMany({
    orderBy: {
      name: 'asc',
    },
    include: {
      category: true,
      brand: true,
      AdditionalPrice: {
        include: {
          shop: true,
        },
      },
      shopStocks: {
        where: {
          status: 'Available',
          shopId: { in: accessibleShopIds },
        },
        include: {
          shop: {
            select: { id: true, name: true, branch: true },
          },
        },
      },
      storeStocks: {
        where: {
          status: 'Available',
          storeId: { in: accessibleStoreIds },
        },
        include: {
          store: {
            select: { id: true, name: true, branch: true },
          },
        },
      },
    },
  });

  // Calculate detailed stock information for each product
  const productsWithDetailedStock = products.map((product) => {
    const shopStocks = {};
    const storeStocks = {};

    let totalShopStock = 0;
    let totalStoreStock = 0;

    // Initialize only accessible shops with 0 quantity
    shops.forEach((shop) => {
      shopStocks[shop.name] = 0;
    });

    // Initialize only accessible stores with 0 quantity
    stores.forEach((store) => {
      storeStocks[store.name] = 0;
    });

    // Process shop stock - Convert box quantity to pieces if product has box
    product.shopStocks.forEach((stock) => {
      const shopName = shopMap[stock.shopId];
      if (shopName) {
        let quantityInPieces = stock.quantity;

        // If product has box, convert the stock quantity (which is stored in pieces) to pieces
        // The stock.quantity is already stored in pieces in the database
        quantityInPieces = stock.quantity;

        shopStocks[shopName] = (shopStocks[shopName] || 0) + quantityInPieces;
        totalShopStock += quantityInPieces;
      }
    });

    // Process store stock - Convert box quantity to pieces if product has box
    product.storeStocks.forEach((stock) => {
      const storeName = storeMap[stock.storeId];
      if (storeName) {
        let quantityInPieces = stock.quantity;

        // If product has box, convert the stock quantity (which is stored in pieces) to pieces
        quantityInPieces = stock.quantity;

        storeStocks[storeName] =
          (storeStocks[storeName] || 0) + quantityInPieces;
        totalStoreStock += quantityInPieces;
      }
    });

    // Convert shopStocks to include branch info and also provide box/piece breakdown
    const shopStocksWithBranch = {};
    Object.entries(shopStocks).forEach(([shopName, quantityInPieces]) => {
      const shop = shops.find((s) => s.name === shopName);
      if (shop) {
        // Calculate box and piece breakdown
        let boxQuantity = 0;
        let pieceQuantity = quantityInPieces;
        let remainingPieces = quantityInPieces;

        if (product.hasBox && product.boxSize && product.boxSize > 0) {
          boxQuantity = Math.floor(quantityInPieces / product.boxSize);
          pieceQuantity = quantityInPieces % product.boxSize;
          remainingPieces = pieceQuantity;
        }

        shopStocksWithBranch[shopName] = {
          quantity: quantityInPieces, // Total quantity in pieces
          boxQuantity, // Number of full boxes
          pieceQuantity, // Remaining pieces
          boxSize: product.boxSize || 0, // Box size for reference
          hasBox: product.hasBox,
          branchId: shop.branch?.id,
          branchName: shop.branch?.name,
          displayText:
            product.hasBox && product.boxSize
              ? `${boxQuantity} box${boxQuantity !== 1 ? 'es' : ''}${
                  pieceQuantity > 0
                    ? ` + ${pieceQuantity} piece${
                        pieceQuantity !== 1 ? 's' : ''
                      }`
                    : ''
                }`
              : `${quantityInPieces} piece${quantityInPieces !== 1 ? 's' : ''}`,
        };
      }
    });

    // Convert storeStocks to include branch info and also provide box/piece breakdown
    const storeStocksWithBranch = {};
    Object.entries(storeStocks).forEach(([storeName, quantityInPieces]) => {
      const store = stores.find((s) => s.name === storeName);
      if (store) {
        // Calculate box and piece breakdown
        let boxQuantity = 0;
        let pieceQuantity = quantityInPieces;
        let remainingPieces = quantityInPieces;

        if (product.hasBox && product.boxSize && product.boxSize > 0) {
          boxQuantity = Math.floor(quantityInPieces / product.boxSize);
          pieceQuantity = quantityInPieces % product.boxSize;
          remainingPieces = pieceQuantity;
        }

        storeStocksWithBranch[storeName] = {
          quantity: quantityInPieces, // Total quantity in pieces
          boxQuantity, // Number of full boxes
          pieceQuantity, // Remaining pieces
          boxSize: product.boxSize || 0, // Box size for reference
          hasBox: product.hasBox,
          branchId: store.branch?.id,
          branchName: store.branch?.name,
          displayText:
            product.hasBox && product.boxSize
              ? `${boxQuantity} box${boxQuantity !== 1 ? 'es' : ''}${
                  pieceQuantity > 0
                    ? ` + ${pieceQuantity} piece${
                        pieceQuantity !== 1 ? 's' : ''
                      }`
                    : ''
                }`
              : `${quantityInPieces} piece${quantityInPieces !== 1 ? 's' : ''}`,
        };
      }
    });

    const totalStock = totalShopStock + totalStoreStock;

    // Calculate total in boxes and pieces for display
    let totalBoxes = 0;
    let totalPieces = totalStock;
    if (product.hasBox && product.boxSize && product.boxSize > 0) {
      totalBoxes = Math.floor(totalStock / product.boxSize);
      totalPieces = totalStock % product.boxSize;
    }

    return {
      ...product,
      stockSummary: {
        shopStocks: shopStocksWithBranch,
        storeStocks: storeStocksWithBranch,
        totalShopStock,
        totalStoreStock,
        totalStock,
        totalBoxes,
        totalPieces,
        displayTotal:
          product.hasBox && product.boxSize
            ? `${totalBoxes} box${totalBoxes !== 1 ? 'es' : ''}${
                totalPieces > 0
                  ? ` + ${totalPieces} piece${totalPieces !== 1 ? 's' : ''}`
                  : ''
              }`
            : `${totalStock} piece${totalStock !== 1 ? 's' : ''}`,
      },
    };
  });

  // Calculate overall totals across all products
  const overallTotals = productsWithDetailedStock.reduce(
    (totals, product) => {
      // Calculate shop-wise totals
      const shopTotals = { ...totals.shopTotals };
      Object.entries(product.stockSummary.shopStocks).forEach(
        ([shopName, stockInfo]) => {
          shopTotals[shopName] =
            (shopTotals[shopName] || 0) + stockInfo.quantity;
        },
      );

      // Calculate store-wise totals
      const storeTotals = { ...totals.storeTotals };
      Object.entries(product.stockSummary.storeStocks).forEach(
        ([storeName, stockInfo]) => {
          storeTotals[storeName] =
            (storeTotals[storeName] || 0) + stockInfo.quantity;
        },
      );

      return {
        totalShopStock:
          totals.totalShopStock + product.stockSummary.totalShopStock,
        totalStoreStock:
          totals.totalStoreStock + product.stockSummary.totalStoreStock,
        totalAllStock: totals.totalAllStock + product.stockSummary.totalStock,
        shopTotals,
        storeTotals,
      };
    },
    {
      totalShopStock: 0,
      totalStoreStock: 0,
      totalAllStock: 0,
      shopTotals: Object.fromEntries(shops.map((shop) => [shop.name, 0])),
      storeTotals: Object.fromEntries(stores.map((store) => [store.name, 0])),
    },
  );

  // Add overallTotals to each product
  const productsWithTotals = productsWithDetailedStock.map((product) => ({
    ...product,
    overallTotals,
  }));

  return {
    products: productsWithTotals,
    count: products.length,
  };
};

const getActiveAllProducts = async (filter = {}, includeInactive = false) => {
  const whereClause = includeInactive ? filter : { ...filter, isActive: true };

  const products = await prisma.product.findMany({
    where: whereClause,
    orderBy: { name: 'asc' },
    include: {
      category: true,
      brand: true,
    },
  });

  return {
    products,
    count: products.length,
  };
};

// Get Product by Product Code
const getProductByCode = async (productCode) => {
  const product = await prisma.product.findFirst({
    where: { productCode },
  });
  return product;
};

// Note: ProductBatch doesn't exist in your schema, so this function is removed
// const getBatchesByProduct = async (productId) => { ... };

const generateUniqueProductCode = async () => {
  const prefix = 'PROD';
  const maxAttempts = 10;
  let productCode;

  const codeAttempts = Array.from({ length: maxAttempts }, () => {
    const randomNumber = Math.floor(10000 + Math.random() * 90000);
    return `${prefix}-${randomNumber}`;
  });

  const existingProducts = await Promise.all(
    codeAttempts.map((code) => getProductByCode(code)),
  );

  const uniqueCodeIndex = existingProducts.findIndex((product) => !product);

  if (uniqueCodeIndex !== -1) {
    productCode = codeAttempts[uniqueCodeIndex];
  } else {
    const timestamp = Date.now();
    productCode = `${prefix}-${timestamp}`;
  }

  return productCode;
};

const getProductByName = async (productName) => {
  if (!productName || productName.trim() === '') {
    return null;
  }

  return prisma.product.findFirst({
    where: {
      name: {
        equals: productName,
      },
    },
  });
};

const parseFormData = (data) => {
  const parsed = { ...data };

  // Boolean fields
  if (parsed.isActive !== undefined) {
    parsed.isActive = parsed.isActive === 'true' || parsed.isActive === true;
  }

  // Number fields
  if (
    parsed.sellPrice !== undefined &&
    parsed.sellPrice !== null &&
    parsed.sellPrice !== ''
  ) {
    parsed.sellPrice = parseFloat(parsed.sellPrice);
  } else if (parsed.sellPrice === '') {
    parsed.sellPrice = null;
  }

  // Handle boxSize
  if (parsed.boxSize !== undefined && parsed.boxSize !== '') {
    parsed.boxSize = parseInt(parsed.boxSize, 10);
  } else if (parsed.boxSize === '') {
    parsed.boxSize = null;
  }

  return parsed;
};

const createProduct = async (productBody, files) => {
  try {
    // Generate product code if not provided
    let { productCode } = productBody;
    const { name } = productBody;

    if (!productCode || productCode.trim() === '') {
      productCode = await generateUniqueProductCode();
    }

    // Check if product with same code already exists
    const existingProductByCode = await getProductByCode(productCode);
    if (existingProductByCode) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Product code already taken');
    }

    // Check if product with same name already exists
    const existingProductByName = await getProductByName(name);
    if (existingProductByName) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Product name already exists');
    }

    const parsedData = parseFormData(productBody);

    // Convert string boolean values to actual booleans
    if (parsedData.hasBox !== undefined) {
      parsedData.hasBox =
        parsedData.hasBox === 'true' || parsedData.hasBox === true;
    }

    if (parsedData.isActive !== undefined) {
      parsedData.isActive =
        parsedData.isActive === 'true' || parsedData.isActive === true;
    }

    // Convert numeric strings to numbers
    if (
      parsedData.boxSize !== undefined &&
      parsedData.boxSize !== null &&
      parsedData.boxSize !== ''
    ) {
      parsedData.boxSize = parseInt(parsedData.boxSize);
    }

    if (
      parsedData.sellPrice !== undefined &&
      parsedData.sellPrice !== null &&
      parsedData.sellPrice !== ''
    ) {
      parsedData.sellPrice = parseFloat(parsedData.sellPrice);
    }

    // Convert numberunitOfMeasure to integer
    if (
      parsedData.numberunitOfMeasure !== undefined &&
      parsedData.numberunitOfMeasure !== null &&
      parsedData.numberunitOfMeasure !== ''
    ) {
      parsedData.numberunitOfMeasure = parseInt(parsedData.numberunitOfMeasure);
    }

    parsedData.productCode = productCode;

    let imageUrl = '';

    // Process the product image if provided
    const imageFile = Array.isArray(files?.image)
      ? files.image[0]
      : files?.image;

    if (imageFile) {
      try {
        imageUrl = await uploadImage(imageFile, 'product_images');
      } catch (err) {
        throw new ApiError(
          httpStatus.INTERNAL_SERVER_ERROR,
          'Product image processing failed',
        );
      }
    } else {
      console.log('No image file provided');
    }

    const { additionalPrices, ...productData } = parsedData;

    // Validate required fields
    if (!productData.unitOfMeasureId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Unit of measure is required');
    }

    // Prepare additional prices data
    let additionalPricesData;
    if (additionalPrices && additionalPrices.length > 0) {
      additionalPricesData = {
        create: additionalPrices.map((price, index) => {
          const priceData = {
            label: price.label,
            price:
              typeof price.price === 'string'
                ? parseFloat(price.price)
                : price.price,
            shopId: price.shopId || null,
            isBox: price.isBox === 'true' || price.isBox === true || false,
          };
          return priceData;
        }),
      };
    }

    // Create product
    const product = await prisma.product.create({
      data: {
        ...productData,
        imageUrl: imageUrl || parsedData.imageUrl || '',
        AdditionalPrice: additionalPricesData,
      },
      include: {
        category: true,
        brand: true,
        unitOfMeasure: true,
        AdditionalPrice: true,
      },
    });

    return product;
  } catch (error) {
    // Log Prisma-specific error details
    if (error.code) {
      console.error('Prisma error code:', error.code);
    }
    if (error.meta) {
      console.error('Prisma error meta:', error.meta);
    }

    // Log validation errors
    if (error.name === 'ValidationError') {
      console.error('Validation errors:', error.errors);
    }

    // Re-throw the error if it's already an ApiError
    if (error instanceof ApiError) {
      throw error;
    }

    // Throw a generic error for unexpected errors
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to create product: ${error.message}`,
    );
  }
};

const updateProduct = async (id, updateBody, files) => {
  try {
    const existingProduct = await getProductById(id);

    if (!existingProduct) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Product not found');
    }

    // Check if product code is being updated to an existing product code
    if (
      updateBody.productCode &&
      updateBody.productCode !== existingProduct.productCode
    ) {
      const existingProductByCode = await getProductByCode(
        updateBody.productCode,
      );
      if (existingProductByCode) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          'Product code already taken',
        );
      }
    }

    const parsedData = parseFormData(updateBody);

    let { imageUrl } = existingProduct;

    // Process the product image if provided
    const imageFile = Array.isArray(files?.image)
      ? files.image[0]
      : files?.image;

    if (imageFile) {
      try {
        imageUrl = await uploadImage(imageFile, 'product_images');
      } catch (err) {
        throw new ApiError(
          httpStatus.INTERNAL_SERVER_ERROR,
          'Product image processing failed',
        );
      }
    } else {
      console.log('No new image file provided, keeping existing image');
    }

    const { additionalPrices, ...productData } = parsedData;

    // Prepare the update data
    const updateData = {
      ...productData,
      imageUrl,
      isActive:
        productData.isActive === 'true' || productData.isActive === true,
      sellPrice: productData.sellPrice
        ? parseFloat(productData.sellPrice)
        : null,
    };

    // Handle hasBox and boxSize conversion
    if (productData.hasBox !== undefined) {
      updateData.hasBox =
        productData.hasBox === 'true' || productData.hasBox === true;
    }

    if (
      productData.boxSize !== undefined &&
      productData.boxSize !== null &&
      productData.boxSize !== ''
    ) {
      updateData.boxSize = parseInt(productData.boxSize);
    }

    // Handle numberunitOfMeasure conversion
    if (
      productData.numberunitOfMeasure !== undefined &&
      productData.numberunitOfMeasure !== null &&
      productData.numberunitOfMeasure !== ''
    ) {
      updateData.numberunitOfMeasure = parseInt(
        productData.numberunitOfMeasure,
      );
    }

    // Handle additional prices update
    if (additionalPrices !== undefined) {
      // First, delete existing additional prices for this product
      await prisma.additionalPrice.deleteMany({
        where: { productId: id },
      });

      // Then create new ones if provided
      if (additionalPrices && additionalPrices.length > 0) {
        const processedPrices = additionalPrices.map((price, index) => {
          const priceData = {
            label: price.label,
            price: parseFloat(price.price),
            shopId: price.shopId || null,
            isBox: price.isBox === 'true' || price.isBox === true || false,
          };
          return priceData;
        });

        updateData.AdditionalPrice = {
          create: processedPrices,
        };
      } else {
        console.log('No additional prices to create');
      }
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
        brand: true,
        unitOfMeasure: true,
        AdditionalPrice: true,
      },
    });

    return updatedProduct;
  } catch (error) {
    // Log Prisma-specific error details
    if (error.code) {
      console.error('Prisma error code:', error.code);
    }
    if (error.meta) {
      console.error('Prisma error meta:', error.meta);
    }

    // Log validation errors
    if (error.name === 'ValidationError') {
      console.error('Validation errors:', error.errors);
    }

    // Re-throw the error if it's already an ApiError
    if (error instanceof ApiError) {
      throw error;
    }

    // Throw a generic error for unexpected errors
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to update product: ${error.message}`,
    );
  }
};

const deleteProduct = async (id) => {
  const existingProduct = await getProductById(id);
  if (!existingProduct) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Product not found');
  }

  // First delete related records
  await prisma.additionalPrice.deleteMany({
    where: { productId: id },
  });

  // Note: Stock records (shopStocks, storeStocks) might need to be handled
  // You may want to delete or transfer these stocks before deleting the product

  // Then delete the product
  await prisma.product.delete({
    where: { id },
  });

  return { message: 'Product deleted successfully' };
};

const getProductDetails = async (productId, userId) => {
  try {
    // Get the user's accessible shops and stores
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        shops: { select: { id: true } },
        stores: { select: { id: true } },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const accessibleShopIds = user.shops.map((shop) => shop.id);
    const accessibleStoreIds = user.stores.map((store) => store.id);

    // Get the product with related data
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        brand: {
          select: {
            id: true,
            name: true,
          },
        },
        unitOfMeasure: {
          select: {
            id: true,
            name: true,
            symbol: true,
          },
        },
        AdditionalPrice: {
          where: {
            OR: [{ shopId: null }, { shopId: { in: accessibleShopIds } }],
          },
          include: {
            shop: {
              include: {
                branch: true,
              },
            },
          },
        },
        shopStocks: {
          where: {
            status: 'Available',
            shopId: { in: accessibleShopIds },
          },
          include: {
            shop: {
              include: {
                branch: true,
              },
            },
          },
        },
        storeStocks: {
          where: {
            status: 'Available',
            storeId: { in: accessibleStoreIds },
          },
          include: {
            store: {
              include: {
                branch: true,
              },
            },
          },
        },
      },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    // Get stock ledger entries for this product
    const stockLedgers = await prisma.stockLedger.findMany({
      where: {
        productId,
        OR: [
          { storeId: { in: accessibleStoreIds } },
          { shopId: { in: accessibleShopIds } },
        ],
      },
      include: {
        store: {
          include: {
            branch: true,
          },
        },
        shop: {
          include: {
            branch: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        movementDate: 'desc',
      },
    });

    // Process location stocks
    const locationStocks = [
      ...product.shopStocks.map((stock) => ({
        shopId: stock.shopId,
        shopName: stock.shop?.name,
        branchId: stock.shop?.branch?.id,
        branchName: stock.shop?.branch?.name,
        quantity: stock.quantity,
        type: 'shop',
        status: stock.status,
      })),
      ...product.storeStocks.map((stock) => ({
        storeId: stock.storeId,
        storeName: stock.store?.name,
        branchId: stock.store?.branch?.id,
        branchName: stock.store?.branch?.name,
        quantity: stock.quantity,
        type: 'store',
        status: stock.status,
      })),
    ];

    // Calculate totals
    const totalShopQuantity = product.shopStocks.reduce(
      (total, stock) => total + stock.quantity,
      0,
    );
    const totalStoreQuantity = product.storeStocks.reduce(
      (total, stock) => total + stock.quantity,
      0,
    );
    const overallTotalQuantity = totalShopQuantity + totalStoreQuantity;

    // Format unit display
    const unitDisplay =
      product.numberunitOfMeasure && product.unitOfMeasure?.symbol
        ? `${product.numberunitOfMeasure} ${product.unitOfMeasure.symbol}`
        : product.unitOfMeasure?.symbol ||
          product.unitOfMeasure?.name ||
          'unit';

    return {
      product: {
        id: product.id,
        productCode: product.productCode,
        name: product.name,
        generic: product.generic,
        description: product.description,
        sellPrice: product.sellPrice,
        imageUrl: product.imageUrl,
        hasBox: product.hasBox,
        boxSize: product.boxSize,
        unitOfMeasureId: product.unitOfMeasureId,
        numberunitOfMeasure: product.numberunitOfMeasure,
        unitOfMeasure: product.unitOfMeasure,
        unitDisplay,
        isActive: product.isActive,
        category: product.category,
        viscosity: product.viscosity,
        oilType: product.oilType,
        additiveType: product.additiveType,
        warningQuantity: product.warningQuantity,
        brand: product.brand,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      },
      additionalPrices: product.AdditionalPrice,
      stockLedgers,
      locationStocks,
      summary: {
        totalStoreQuantity,
        totalShopQuantity,
        overallTotalQuantity,
        shopCount: product.shopStocks.length,
        storeCount: product.storeStocks.length,
        ledgerCount: stockLedgers.length,
        additionalPriceCount: product.AdditionalPrice.length,
      },
    };
  } catch (error) {
    console.error('Error in getProductDetails:', error);
    throw error;
  }
};

// Helper function to check if string is a valid UUID
function isValidUUID(str) {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

const searchProducts = async (
  searchTerm,
  categoryFilter = null,
  brandFilter = null,
) => {
  try {
    let categoryId = null;
    let brandId = null;

    // Handle category filter
    if (categoryFilter) {
      if (isValidUUID(categoryFilter)) {
        categoryId = categoryFilter;
      } else {
        const category = await prisma.category.findFirst({
          where: { name: categoryFilter },
          select: { id: true },
        });
        if (category) {
          categoryId = category.id;
        } else {
          return {
            products: [],
            count: 0,
            note: 'Category not found',
          };
        }
      }
    }

    // Handle brand filter
    if (brandFilter) {
      if (isValidUUID(brandFilter)) {
        brandId = brandFilter;
      } else {
        const brand = await prisma.brand.findFirst({
          where: { name: brandFilter },
          select: { id: true },
        });
        if (brand) {
          brandId = brand.id;
        } else {
          return {
            products: [],
            count: 0,
            note: 'Brand not found',
          };
        }
      }
    }

    // Build where clause for search - NO LIMIT on results
    const whereClause = {
      isActive: true,
      ...(categoryId && { categoryId }),
      ...(brandId && { brandId }),
      ...(searchTerm &&
        searchTerm.trim() !== '' && {
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { productCode: { contains: searchTerm, mode: 'insensitive' } },
            { generic: { contains: searchTerm, mode: 'insensitive' } },
            { viscosity: { contains: searchTerm, mode: 'insensitive' } },
            { oilType: { contains: searchTerm, mode: 'insensitive' } },
            { additiveType: { contains: searchTerm, mode: 'insensitive' } },
            {
              category: {
                name: { contains: searchTerm, mode: 'insensitive' },
              },
            },
            {
              brand: {
                name: { contains: searchTerm, mode: 'insensitive' },
              },
            },
          ],
        }),
    };

    // Get ALL products that match the search criteria (no take/limit)
    const matchedProducts = await prisma.product.findMany({
      where: whereClause,
      include: {
        category: true,
        brand: true,
        AdditionalPrice: {
          include: {
            shop: {
              include: {
                branch: true,
              },
            },
          },
        },
      },
      // Remove any orderBy that might limit results
      orderBy: {
        name: 'asc', // Optional: sort alphabetically
      },
    });
    return {
      products: matchedProducts.map((product) => ({ product })),
      count: matchedProducts.length,
      note: searchTerm ? 'Search results' : 'Filtered products',
    };
  } catch (error) {
    console.error('=== searchProducts ERROR ===');
    console.error('Error:', error);
    throw error;
  }
};

const getTopSellingProducts = async (
  userId = null,
  searchTerm = null,
  categoryName = null,
  brandName = null,
) => {
  try {
    let categoryId = null;
    let brandId = null;

    // Resolve category ID if provided
    if (categoryName) {
      const category = await prisma.category.findFirst({
        where: { name: categoryName },
        select: { id: true },
      });
      if (category) {
        categoryId = category.id;
      } else {
        return { products: [], count: 0, note: 'Category not found' };
      }
    }

    // Resolve brand ID if provided
    if (brandName) {
      const brand = await prisma.brand.findFirst({
        where: { name: brandName },
        select: { id: true },
      });
      if (brand) {
        brandId = brand.id;
      } else {
        return { products: [], count: 0, note: 'Brand not found' };
      }
    }

    // If search term provided, use searchProducts
    if (searchTerm && searchTerm.trim() !== '') {
      const searchResult = await searchProducts(
        searchTerm,
        categoryId,
        brandId,
      );
      return searchResult;
    }

    // No search term - get products with filters

    // Get ALL eligible products that match the filters
    const allEligibleProducts = await prisma.product.findMany({
      where: {
        isActive: true,
        ...(categoryId && { categoryId }),
        ...(brandId && { brandId }),
      },
      include: {
        category: true,
        brand: true,
        unitOfMeasure: true,
        AdditionalPrice: {
          include: {
            shop: {
              include: {
                branch: true,
              },
            },
          },
        },
      },
    });

    if (allEligibleProducts.length === 0) {
      return {
        products: [],
        count: 0,
        note: 'No products found with selected filters',
      };
    }

    // Get product IDs that have sales (top sellers)
    const productsWithSales = await prisma.sellItem.groupBy({
      by: ['productId'],
      where: {
        productId: { in: allEligibleProducts.map((p) => p.id) },
        OR: [
          { itemSaleStatus: 'DELIVERED' },
          {
            sell: {
              saleStatus: {
                in: ['DELIVERED', 'APPROVED', 'PARTIALLY_DELIVERED'],
              },
            },
          },
        ],
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
    });

    const productIdsWithSales = productsWithSales.map((item) => item.productId);

    // Separate products into those with sales and those without
    const productsWithSalesData = allEligibleProducts.filter((p) =>
      productIdsWithSales.includes(p.id),
    );
    const productsWithoutSales = allEligibleProducts.filter(
      (p) => !productIdsWithSales.includes(p.id),
    );

    // Sort products with sales by their sales quantity
    productsWithSalesData.sort((a, b) => {
      const salesA =
        productsWithSales.find((item) => item.productId === a.id)?._sum
          .quantity || 0;
      const salesB =
        productsWithSales.find((item) => item.productId === b.id)?._sum
          .quantity || 0;
      return salesB - salesA;
    });

    // Combine: First show top sellers, then fill with random products up to 20
    const MAX_PRODUCTS = 20;
    const finalProducts = [...productsWithSalesData];

    if (
      finalProducts.length < MAX_PRODUCTS &&
      productsWithoutSales.length > 0
    ) {
      // Shuffle products without sales to get random order
      const shuffledWithoutSales = [...productsWithoutSales];
      for (let i = shuffledWithoutSales.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledWithoutSales[i], shuffledWithoutSales[j]] = [
          shuffledWithoutSales[j],
          shuffledWithoutSales[i],
        ];
      }

      const needed = MAX_PRODUCTS - finalProducts.length;
      finalProducts.push(...shuffledWithoutSales.slice(0, needed));
    }

    return {
      products: finalProducts.map((product) => ({ product })),
      count: finalProducts.length,
      note:
        productsWithSalesData.length > 0
          ? `${productsWithSalesData.length} top selling products + ${
              finalProducts.length - productsWithSalesData.length
            } other products`
          : 'Random products from selected filters',
    };
  } catch (error) {
    console.error('=== getTopSellingProducts ERROR ===');
    console.error('Error:', error);
    throw error;
  }
};
const getRandomProductsWithShopStocks = async (userId = null) => {
  // Get user's accessible shops if userId is provided
  let userAccessibleShopIds = [];

  if (userId) {
    const userWithShops = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        shops: { select: { id: true } },
      },
    });
    userAccessibleShopIds = userWithShops?.shops.map((shop) => shop.id) || [];
  }

  // Get random products that have shop stocks
  const productsWithShopStocks = await prisma.product.findMany({
    where: {
      isActive: true,
      shopStocks: {
        some: {
          quantity: { gt: 0 },
          ...(userAccessibleShopIds.length > 0 && {
            shopId: { in: userAccessibleShopIds },
          }),
        },
      },
    },
    include: {
      category: true,
      brand: true,
      AdditionalPrice: {
        include: {
          shop: {
            include: {
              branch: true,
            },
          },
        },
      },
      shopStocks: {
        where: {
          quantity: { gt: 0 },
          ...(userAccessibleShopIds.length > 0 && {
            shopId: { in: userAccessibleShopIds },
          }),
        },
        include: {
          shop: {
            include: {
              branch: true,
            },
          },
        },
      },
    },
    take: 20,
  });

  return {
    products: productsWithShopStocks.map((product) => ({ product })),
    count: productsWithShopStocks.length,
    note: 'Random products with available shop stock',
  };
};
const getProductByShops = async (productId) => {
  try {
    // Get all available shop stocks for the product
    const shopStocks = await prisma.shopStock.findMany({
      where: {
        productId,
        status: 'Available',
        quantity: {
          gt: 0,
        },
      },
      include: {
        shop: {
          include: {
            branch: true,
          },
        },
        product: {
          include: {
            AdditionalPrice: {
              where: {
                OR: [{ shopId: null }, { shopId: { not: null } }],
              },
            },
            unitOfMeasure: true, // Include unitOfMeasure relation
          },
        },
      },
    });

    // If no shop stocks found, return empty response instead of throwing error
    if (!shopStocks || shopStocks.length === 0) {
      // Get product details even if no stock
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: {
          hasBox: true,
          boxSize: true,
          unitOfMeasureId: true,
          numberunitOfMeasure: true,
          name: true,
          productCode: true,
          unitOfMeasure: {
            select: {
              name: true,
              symbol: true,
            },
          },
        },
      });

      // Format unit of measure display string
      const unitDisplay =
        product?.numberunitOfMeasure && product?.unitOfMeasure
          ? `${product.numberunitOfMeasure} ${
              product.unitOfMeasure.symbol || product.unitOfMeasure.name
            }`
          : product?.unitOfMeasure?.symbol ||
            product?.unitOfMeasure?.name ||
            'unit';

      return {
        totalAvailableQuantity: 0,
        shops: [],
        hasStock: false,
        product: {
          hasBox: product?.hasBox || false,
          boxSize: product?.boxSize || null,
          unitOfMeasureId: product?.unitOfMeasureId,
          numberunitOfMeasure: product?.numberunitOfMeasure,
          unitDisplay,
          unitSymbol: product?.unitOfMeasure?.symbol,
          unitName: product?.unitOfMeasure?.name,
          name: product?.name,
          productCode: product?.productCode,
        },
      };
    }

    // Get all pending/approved sells that affect stock availability
    const pendingSells = await prisma.sell.findMany({
      where: {
        items: {
          some: {
            productId,
          },
        },
        saleStatus: {
          in: ['APPROVED', 'PARTIALLY_DELIVERED'],
        },
      },
      include: {
        items: {
          where: {
            productId,
            itemSaleStatus: 'PENDING',
          },
          include: {
            shop: true,
          },
        },
      },
    });

    // Calculate reserved quantities by shop (in pieces)
    const reservedQuantitiesByShop = new Map();

    pendingSells.forEach((sell) => {
      sell.items.forEach((item) => {
        if (item.productId === productId && item.itemSaleStatus === 'PENDING') {
          const currentReserved =
            reservedQuantitiesByShop.get(item.shopId) || 0;
          reservedQuantitiesByShop.set(
            item.shopId,
            currentReserved + item.quantity,
          );
        }
      });
    });

    // Aggregate quantities by shop and collect additional prices
    const shopsMap = new Map();
    let totalAvailableQuantity = 0;

    shopStocks.forEach((stock) => {
      const reservedQuantity = reservedQuantitiesByShop.get(stock.shopId) || 0;
      const netAvailableQuantity = Math.max(
        0,
        stock.quantity - reservedQuantity,
      );
      totalAvailableQuantity += netAvailableQuantity;

      // Get unit display for this product
      const unitDisplay =
        stock.product.numberunitOfMeasure && stock.product.unitOfMeasure
          ? `${stock.product.numberunitOfMeasure} ${
              stock.product.unitOfMeasure.symbol ||
              stock.product.unitOfMeasure.name
            }`
          : stock.product.unitOfMeasure?.symbol ||
            stock.product.unitOfMeasure?.name ||
            'unit';

      if (shopsMap.has(stock.shop.id)) {
        const existingShop = shopsMap.get(stock.shop.id);
        existingShop.quantity += netAvailableQuantity;

        // Update box calculations if needed
        if (
          existingShop.hasBox &&
          existingShop.boxSize &&
          existingShop.boxSize > 0
        ) {
          existingShop.availableBoxes = Math.floor(
            existingShop.quantity / existingShop.boxSize,
          );
          existingShop.remainingPieces =
            existingShop.quantity % existingShop.boxSize;
        }
      } else {
        // Get base product price
        const basePrice = stock.product.sellPrice;

        // Filter additional prices for this specific shop
        const shopAdditionalPrices = stock.product.AdditionalPrice.filter(
          (ap) => ap.shopId === null || ap.shopId === stock.shop.id,
        );

        // Calculate total price (base + sum of additional prices)
        let totalPrice = null;
        if (basePrice) {
          const base = parseFloat(basePrice.toString());
          const additionalTotal = shopAdditionalPrices.reduce(
            (sum, ap) => sum + ap.price,
            0,
          );
          totalPrice = base + additionalTotal;
        }

        // Calculate box availability if product supports boxes
        let availableBoxes = 0;
        let remainingPieces = netAvailableQuantity;
        let boxSize = null;

        if (
          stock.product.hasBox &&
          stock.product.boxSize &&
          stock.product.boxSize > 0
        ) {
          boxSize = stock.product.boxSize;
          availableBoxes = Math.floor(netAvailableQuantity / boxSize);
          remainingPieces = netAvailableQuantity % boxSize;
        }

        const shopData = {
          shopId: stock.shop.id,
          shopName: stock.shop.name,
          branchName: stock.shop.branch?.name,
          quantity: netAvailableQuantity,
          availableBoxes,
          remainingPieces,
          boxSize,
          hasBox: stock.product.hasBox,
          basePrice,
          additionalPrices: shopAdditionalPrices.map((ap) => ({
            id: ap.id,
            label: ap.label,
            price: ap.price,
            isBox: ap.isBox,
          })),
          totalPrice,
          unitDisplay,
          unitSymbol: stock.product.unitOfMeasure?.symbol,
          unitName: stock.product.unitOfMeasure?.name,
          numberunitOfMeasure: stock.product.numberunitOfMeasure,
          unitOfMeasureId: stock.product.unitOfMeasureId,
        };

        shopsMap.set(stock.shop.id, shopData);
      }
    });

    // Get product details for box support info
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        hasBox: true,
        boxSize: true,
        unitOfMeasureId: true,
        numberunitOfMeasure: true,
        name: true,
        productCode: true,
        unitOfMeasure: {
          select: {
            name: true,
            symbol: true,
          },
        },
      },
    });

    // Format unit of measure display string
    const unitDisplay =
      product?.numberunitOfMeasure && product?.unitOfMeasure
        ? `${product.numberunitOfMeasure} ${
            product.unitOfMeasure.symbol || product.unitOfMeasure.name
          }`
        : product?.unitOfMeasure?.symbol ||
          product?.unitOfMeasure?.name ||
          'unit';

    const result = {
      totalAvailableQuantity,
      shops: Array.from(shopsMap.values()),
      hasStock: totalAvailableQuantity > 0,
      product: {
        hasBox: product?.hasBox || false,
        boxSize: product?.boxSize || null,
        unitOfMeasureId: product?.unitOfMeasureId,
        numberunitOfMeasure: product?.numberunitOfMeasure,
        unitDisplay,
        unitSymbol: product?.unitOfMeasure?.symbol,
        unitName: product?.unitOfMeasure?.name,
        name: product?.name,
        productCode: product?.productCode,
      },
    };

    return result;
  } catch (error) {
    if (error.code) {
      console.error('Prisma error code:', error.code);
    }
    if (error.meta) {
      console.error('Prisma error meta:', error.meta);
    }

    throw error;
  }
};
module.exports = {
  getProductById,
  getProductByCode,
  getAllProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getActiveAllProducts,
  getProductDetails,
  getTopSellingProducts,
  getRandomProductsWithShopStocks,
  getProductByShops,
};
