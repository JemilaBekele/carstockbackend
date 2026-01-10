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
      subCategory: true,
      batches: true,
      unitOfMeasure: true,
      AdditionalPrice: {
        // ✅ Include additional prices
        include: {
          shop: true,
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

  // Create maps for shop and store branch info
  // const shopBranchMap = Object.fromEntries(
  //   shops.map((shop) => [
  //     shop.id,
  //     {
  //       branchId: shop.branch?.id,
  //       branchName: shop.branch?.name,
  //     },
  //   ]),
  // );

  // const storeBranchMap = Object.fromEntries(
  //   stores.map((store) => [
  //     store.id,
  //     {
  //       branchId: store.branch?.id,
  //       branchName: store.branch?.name,
  //     },
  //   ]),
  // );

  // Get all products with their stock information
  const products = await prisma.product.findMany({
    orderBy: {
      name: 'asc',
    },
    include: {
      category: true,
      subCategory: true,
      unitOfMeasure: true,
      AdditionalPrice: {
        include: {
          shop: true,
        },
      },
      batches: {
        include: {
          ShopStock: {
            where: {
              status: 'Available',
              shopId: { in: accessibleShopIds }, // Filter by accessible shops
            },
            include: {
              shop: {
                select: { id: true, name: true },
              },
            },
          },
          StoreStock: {
            where: {
              status: 'Available',
              storeId: { in: accessibleStoreIds }, // Filter by accessible stores
            },
            include: {
              store: {
                select: { id: true, name: true },
              },
            },
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

    // Calculate stock from all batches
    product.batches.forEach((batch) => {
      // Process shop stock
      batch.ShopStock.forEach((shopStock) => {
        const shopName = shopMap[shopStock.shopId];
        if (shopName) {
          // Only count if shop is accessible
          shopStocks[shopName] =
            (shopStocks[shopName] || 0) + shopStock.quantity;
          totalShopStock += shopStock.quantity;
        }
      });

      // Process store stock
      batch.StoreStock.forEach((storeStock) => {
        const storeName = storeMap[storeStock.storeId];
        if (storeName) {
          // Only count if store is accessible
          storeStocks[storeName] =
            (storeStocks[storeName] || 0) + storeStock.quantity;
          totalStoreStock += storeStock.quantity;
        }
      });
    });

    // Convert shopStocks to include branch info
    const shopStocksWithBranch = {};
    Object.entries(shopStocks).forEach(([shopName, quantity]) => {
      // Find the shop to get branch info
      const shop = shops.find((s) => s.name === shopName);
      if (shop) {
        shopStocksWithBranch[shopName] = {
          quantity,
          branchId: shop.branch?.id,
          branchName: shop.branch?.name,
        };
      }
    });

    // Convert storeStocks to include branch info
    const storeStocksWithBranch = {};
    Object.entries(storeStocks).forEach(([storeName, quantity]) => {
      // Find the store to get branch info
      const store = stores.find((s) => s.name === storeName);
      if (store) {
        storeStocksWithBranch[storeName] = {
          quantity,
          branchId: store.branch?.id,
          branchName: store.branch?.name,
        };
      }
    });

    const totalStock = totalShopStock + totalStoreStock;

    return {
      ...product,
      stockSummary: {
        shopStocks: shopStocksWithBranch, // Object with shop names as keys and { quantity, branchId, branchName } as values
        storeStocks: storeStocksWithBranch, // Object with store names as keys and { quantity, branchId, branchName } as values
        totalShopStock,
        totalStoreStock,
        totalStock,
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
      subCategory: true,
      unitOfMeasure: true,
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

const getBatchesByProduct = async (productId) => {
  const batches = await prisma.productBatch.findMany({
    where: {
      productId, // Filter by the provided productId
    },
    orderBy: [
      { expiryDate: 'asc' }, // Sort by expiry date (earliest first)
      { batchNumber: 'asc' },
    ],
    include: {
      product: true,
      store: true,
    },
  });
  return {
    batches,
    count: batches.length,
  };
};

const generateBatchNumber = () => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const random = Math.floor(1000 + Math.random() * 9000);
  return `BATCH-${year}${month}${day}-${random}`;
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

  return parsed;
};
const generateUniqueProductCode = async () => {
  const prefix = 'PROD'; // You can customize this prefix
  const maxAttempts = 10;
  let productCode;

  // Generate multiple codes at once and check them in a single query
  const codeAttempts = Array.from({ length: maxAttempts }, () => {
    const randomNumber = Math.floor(10000 + Math.random() * 90000); // 5-digit random number
    return `${prefix}-${randomNumber}`;
  });

  // Check all codes at once
  const existingProducts = await Promise.all(
    codeAttempts.map((code) => getProductByCode(code)),
  );

  // Find the first unique code
  const uniqueCodeIndex = existingProducts.findIndex((product) => !product);

  if (uniqueCodeIndex !== -1) {
    productCode = codeAttempts[uniqueCodeIndex];
  } else {
    // Fallback: use timestamp for uniqueness
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
const createProduct = async (productBody, files) => {
  // Generate product code if not provided
  let { productCode } = productBody;
  const { name } = productBody;

  if (!productCode || productCode.trim() === '') {
    productCode = await generateUniqueProductCode();
  }

  // Check if product with same code already exists
  if (await getProductByCode(productCode)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Product code already taken');
  }
  if (await getProductByName(name)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Product name already exists');
  }
  const parsedData = parseFormData(productBody);
  parsedData.productCode = productCode; // Add generated code to parsed data

  let imageUrl = null;

  // Process the product image if provided
  const imageFile = Array.isArray(files?.image) ? files.image[0] : files?.image;

  if (imageFile) {
    try {
      imageUrl = await uploadImage(imageFile, 'product_images');
    } catch (err) {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        'Product image processing failed',
      );
    }
  }
  const { additionalPrices, ...productData } = parsedData;

  // Create product
  const product = await prisma.product.create({
    data: {
      ...productData,
      imageUrl: imageUrl || parsedData.imageUrl || '',
      AdditionalPrice:
        additionalPrices && additionalPrices.length > 0
          ? {
              create: additionalPrices.map((price) => ({
                label: price.label,
                price: parseFloat(price.price),
                shopId: price.shopId || null,
              })),
            }
          : undefined,
    },
    include: {
      unitOfMeasure: true, // ✅ Added unit of measure
    },
  });

  return product;
};
const generateUniqueBatchNumber = async () => {
  const maxAttempts = 10;

  // Generate multiple batch numbers at once
  const batchNumbers = Array.from({ length: maxAttempts }, () =>
    generateBatchNumber(),
  );

  // Check which batch numbers already exist
  const existingBatches = await prisma.productBatch.findMany({
    where: {
      batchNumber: {
        in: batchNumbers,
      },
    },
    select: {
      batchNumber: true,
    },
  });

  const existingBatchNumbers = new Set(
    existingBatches.map((batch) => batch.batchNumber),
  );

  // Find the first unique batch number
  const uniqueBatchNumber = batchNumbers.find(
    (number) => !existingBatchNumbers.has(number),
  );

  if (!uniqueBatchNumber) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to generate unique batch number after multiple attempts',
    );
  }

  return uniqueBatchNumber;
};
const createProductBatch = async (productId, batchesData, userId) => {
  // Validate input
  if (!productId || !batchesData || !Array.isArray(batchesData)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Product ID and batches data array are required',
    );
  }

  if (batchesData.length === 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'At least one batch data is required',
    );
  }

  // Get the product with its unit of measure
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      unitOfMeasure: true,
    },
  });

  if (!product) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Product not found');
  }

  // Use the product's unit of measure ID
  const { unitOfMeasureId } = product;

  // Verify the product's unit of measure exists
  const unitOfMeasure = await prisma.unitOfMeasure.findUnique({
    where: { id: unitOfMeasureId },
  });

  if (!unitOfMeasure) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Invalid unit of measure for this product',
    );
  }

  // Check for duplicate batch numbers in the request
  const batchNumbersInRequest = batchesData
    .filter((batch) => batch.batchNumber)
    .map((batch) => batch.batchNumber);

  const uniqueBatchNumbers = [...new Set(batchNumbersInRequest)];
  if (batchNumbersInRequest.length !== uniqueBatchNumbers.length) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Duplicate batch numbers found in the request',
    );
  }

  // Check for existing batch numbers in the database
  const existingBatches = await prisma.productBatch.findMany({
    where: {
      batchNumber: {
        in: batchNumbersInRequest,
      },
    },
    select: {
      batchNumber: true,
    },
  });

  if (existingBatches.length > 0) {
    const existingBatchNumbers = existingBatches.map(
      (batch) => batch.batchNumber,
    );
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Batch numbers already exist: ${existingBatchNumbers.join(', ')}`,
    );
  }

  // Process all batches in parallel
  const createdBatches = await Promise.all(
    batchesData.map(async (batchData) => {
      // Validate individual batch data
      if (!batchData) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          'Each batch data object is required',
        );
      }

      // Generate batch number if not provided
      const batchNumber =
        batchData.batchNumber || (await generateUniqueBatchNumber());

      // Create the product batch
      const productBatch = await prisma.productBatch.create({
        data: {
          batchNumber,
          expiryDate: batchData.expiryDate
            ? new Date(batchData.expiryDate).toISOString()
            : null,
          price: batchData.price || 0,
          stock: batchData.stock || 0,
          warningQuantity: batchData.warningQuantity || 0,
          productId,
          storeId: batchData.storeId,
        },
        include: {
          product: {
            include: {
              unitOfMeasure: true,
            },
          },
        },
      });

      // Create stock operations for batches with stock
      const stockOperations = [];

      if (batchData.stock > 0) {
        // Stock ledger entry
        stockOperations.push(
          prisma.stockLedger.create({
            data: {
              batchId: productBatch.id,
              storeId: batchData.storeId,
              movementType: 'IN',
              quantity: batchData.stock,
              unitOfMeasureId,
              reference:
                batchData.reference || `BATCH-${productBatch.batchNumber}`,
              userId,
              notes: `Initial stock creation for batch ${productBatch.batchNumber}`,
              movementDate: new Date(),
            },
          }),
        );

        // Store stock operation if storeId is provided
        if (batchData.storeId) {
          stockOperations.push(
            prisma.storeStock.upsert({
              where: {
                storeId_batchId: {
                  storeId: batchData.storeId,
                  batchId: productBatch.id,
                },
              },
              create: {
                storeId: batchData.storeId,
                batchId: productBatch.id,
                quantity: batchData.stock,
                status: 'Available',
                unitOfMeasureId,
              },
              update: {
                quantity: {
                  increment: batchData.stock,
                },
              },
            }),
          );
        }
      }

      // Execute all stock operations in parallel
      if (stockOperations.length > 0) {
        await Promise.all(stockOperations);
      }

      return productBatch;
    }),
  );

  return createdBatches;
};

const updateProduct = async (id, updateBody, files) => {
  const existingProduct = await getProductById(id);
  if (!existingProduct) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Product not found');
  }

  // Check if product code is being updated to an existing product code
  if (
    updateBody.productCode &&
    updateBody.productCode !== existingProduct.productCode
  ) {
    if (await getProductByCode(updateBody.productCode)) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Product code already taken');
    }
  }

  const parsedData = parseFormData(updateBody);
  let { imageUrl } = existingProduct;

  // Process the product image if provided
  const imageFile = Array.isArray(files?.image) ? files.image[0] : files?.image;

  if (imageFile) {
    try {
      imageUrl = await uploadImage(imageFile, 'product_images');
    } catch (err) {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        'Product image processing failed',
      );
    }
  }

  const { additionalPrices, ...productData } = parsedData;

  // Prepare the update data
  const updateData = {
    ...productData,
    imageUrl,
    // Convert string 'true'/'false' to boolean
    isActive: productData.isActive === 'true' || productData.isActive === true,
    // Convert sellPrice from string to number if needed
    sellPrice: productData.sellPrice ? parseFloat(productData.sellPrice) : null,
  };

  // Handle additional prices update
  if (additionalPrices !== undefined) {
    // First, delete existing additional prices for this product
    await prisma.additionalPrice.deleteMany({
      where: { productId: id },
    });

    // Then create new ones if provided
    if (additionalPrices && additionalPrices.length > 0) {
      updateData.AdditionalPrice = {
        create: additionalPrices.map((price) => ({
          label: price.label,
          price: parseFloat(price.price),
          shopId: price.shopId || null,
        })),
      };
    }
  }

  const updatedProduct = await prisma.product.update({
    where: { id },
    data: updateData,
    include: {
      category: true,
      subCategory: true,
      unitOfMeasure: true,
      AdditionalPrice: true, // ✅ Include additional prices in response
    },
  });

  return updatedProduct;
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

  await prisma.productBatch.deleteMany({
    where: { productId: id },
  });

  // Then delete the product
  await prisma.product.delete({
    where: { id },
  });

  return { message: 'Product deleted successfully' };
};
const getProductBatchByBatchNumber = async (batchNumber) => {
  const batch = await prisma.productBatch.findFirst({
    where: {
      batchNumber,
    },
  });
  return !!batch;
};
const createProductBatchsingle = async (productBatchBody) => {
  // Check if product batch with same batch number already exists
  if (await getProductBatchByBatchNumber(productBatchBody.batchNumber)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Batch number already exists');
  }

  // Optional: Validate that the product exists
  const product = await prisma.product.findUnique({
    where: {
      id: productBatchBody.productId,
    },
  });

  if (!product) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Product does not exist');
  }

  // Format the expiryDate if provided
  const formattedData = {
    ...productBatchBody,
    expiryDate: productBatchBody.expiryDate
      ? new Date(productBatchBody.expiryDate).toISOString()
      : undefined,
  };

  const productBatch = await prisma.productBatch.create({
    data: formattedData,
  });

  return productBatch;
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

    // If user has no shops or stores, return empty arrays
    if (accessibleShopIds.length === 0 && accessibleStoreIds.length === 0) {
      throw new Error('User has no shop or store access');
    }

    const shopStockWhere =
      accessibleShopIds.length > 0
        ? { status: 'Available', shopId: { in: accessibleShopIds } }
        : { status: 'Available', shopId: { in: [] } };

    const storeStockWhere =
      accessibleStoreIds.length > 0
        ? { status: 'Available', storeId: { in: accessibleStoreIds } }
        : { status: 'Available', storeId: { in: [] } };

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
        subCategory: {
          select: {
            id: true,
            name: true,
          },
        },
        unitOfMeasure: true,
        AdditionalPrice: {
          where: {
            OR: [
              { shopId: null }, // Global additional prices
              { shopId: { in: accessibleShopIds } }, // Shop-specific prices
            ],
          },
          include: {
            shop: {
              include: {
                branch: true,
              },
            },
          },
        },
        batches: {
          include: {
            store: {
              include: {
                branch: true,
              },
            },
            ShopStock: {
              where: shopStockWhere,
              include: {
                shop: {
                  include: {
                    branch: true,
                  },
                },
                unitOfMeasure: true,
              },
            },
            StoreStock: {
              where: storeStockWhere,
              include: {
                store: {
                  include: {
                    branch: true,
                  },
                },
                unitOfMeasure: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!product) {
      throw new Error('Product not found');
    }
    const additionalPrices = await prisma.additionalPrice.findMany({
      where: {
        productId,
        OR: [
          { shopId: null }, // Global additional prices
          { shopId: { in: accessibleShopIds } }, // Shop-specific prices
        ],
      },
      include: {
        shop: {
          include: {
            branch: true,
          },
        },
      },
    });
    // Get stock ledger entries for this product (filtered by accessible shops/stores)
    const stockLedgers = await prisma.stockLedger.findMany({
      where: {
        batch: {
          productId,
        },
        OR: [
          { storeId: { in: accessibleStoreIds } },
          { shopId: { in: accessibleShopIds } },
        ],
      },
      include: {
        batch: true,
        unitOfMeasure: true,
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

    // Calculate total quantities across accessible stores and shops
    const storeStocks = await prisma.storeStock.groupBy({
      by: ['storeId'],
      where: {
        batch: {
          productId,
        },
        status: 'Available',
        storeId: { in: accessibleStoreIds },
      },
      _sum: {
        quantity: true,
      },
    });

    const shopStocks = await prisma.shopStock.groupBy({
      by: ['shopId'],
      where: {
        batch: {
          productId,
        },
        status: 'Available',
        shopId: { in: accessibleShopIds },
      },
      _sum: {
        quantity: true,
      },
    });

    // Get store and shop details (only accessible ones)
    const storeIds = storeStocks.map((stock) => stock.storeId);
    const shopIds = shopStocks.map((stock) => stock.shopId);

    const stores = await prisma.store.findMany({
      where: {
        id: {
          in: storeIds.length > 0 ? storeIds : [],
        },
      },
      include: { branch: true },
    });

    const shops = await prisma.shop.findMany({
      where: {
        id: {
          in: shopIds.length > 0 ? shopIds : [],
        },
      },
      include: { branch: true },
    });

    // Create location stock details
    const storeStockDetails = storeStocks.map((stock) => {
      const store = stores.find((s) => s.id === stock.storeId);
      return {
        storeId: stock.storeId,
        storeName: store?.name || 'Unknown Store',
        branchId: store?.branch?.id,
        branchName: store?.branch?.name,
        quantity: stock._sum.quantity || 0,
        type: 'store',
        additionalPrice: null, // Stores don't have additional prices
      };
    });

    const shopStockDetails = shopStocks.map((stock) => {
      const shop = shops.find((s) => s.id === stock.shopId);
      // Find additional price for this shop
      const additionalPrice = additionalPrices.find(
        (price) => price.shopId === stock.shopId,
      );
      // Find global additional price (shopId = null)
      const globalAdditionalPrice = additionalPrices.find(
        (price) => price.shopId === null,
      );

      return {
        shopId: stock.shopId,
        shopName: shop?.name || 'Unknown Shop',
        branchId: shop?.branch?.id,
        branchName: shop?.branch?.name,
        quantity: stock._sum.quantity || 0,
        type: 'shop',
        additionalPrice: additionalPrice || globalAdditionalPrice, // Shop-specific or global
      };
    });

    // Process batches with detailed information
    const processedBatches = product.batches.map((batch) => {
      const batchStoreQuantity = batch.StoreStock.filter(
        (stock) => stock.status === 'Available',
      ).reduce((total, stock) => total + stock.quantity, 0);

      const batchShopQuantity = batch.ShopStock.filter(
        (stock) => stock.status === 'Available',
      ).reduce((total, stock) => total + stock.quantity, 0);

      const batchTotalQuantity = batchStoreQuantity + batchShopQuantity;

      return {
        id: batch.id,
        batchNumber: batch.batchNumber,
        expiryDate: batch.expiryDate,
        price: batch.price,
        stock: batch.stock,
        warningQuantity: batch.warningQuantity,
        storeId: batch.storeId,
        store:
          batch.store && accessibleStoreIds.includes(batch.storeId)
            ? {
                id: batch.store.id,
                name: batch.store.name,
                branch: batch.store.branch,
              }
            : null,
        shopStocks: batch.ShopStock.map((stock) => ({
          id: stock.id,
          shopId: stock.shopId,
          shopName: stock.shop?.name,
          branchId: stock.shop?.branch?.id,
          branchName: stock.shop?.branch?.name,
          quantity: stock.quantity,
          status: stock.status,
          unitOfMeasure: stock.unitOfMeasure,
        })),
        storeStocks: batch.StoreStock.map((stock) => ({
          id: stock.id,
          storeId: stock.storeId,
          storeName: stock.store?.name,
          branchId: stock.store?.branch?.id,
          branchName: stock.store?.branch?.name,
          quantity: stock.quantity,
          status: stock.status,
          unitOfMeasure: stock.unitOfMeasure,
        })),
        batchStoreQuantity,
        batchShopQuantity,
        batchTotalQuantity,
        createdAt: batch.createdAt,
        updatedAt: batch.updatedAt,
      };
    });

    // Process additional prices (filtered by accessible shops)
    const processedAdditionalPrices = product.AdditionalPrice.filter(
      (price) => !price.shopId || accessibleShopIds.includes(price.shopId),
    ).map((price) => ({
      id: price.id,
      label: price.label,
      price: price.price,
      shopId: price.shopId,
      shopName: price.shop?.name,
      branchId: price.shop?.branch?.id,
      branchName: price.shop?.branch?.name,
    }));

    // Process stock ledger entries (already filtered)
    const processedStockLedgers = stockLedgers.map((ledger) => ({
      id: ledger.id,
      invoiceNo: ledger.invoiceNo,
      movementType: ledger.movementType,
      quantity: ledger.quantity,
      unitOfMeasure: ledger.unitOfMeasure,
      reference: ledger.reference,
      userId: ledger.userId,
      user: ledger.user,
      store:
        ledger.store && accessibleStoreIds.includes(ledger.store.id)
          ? {
              id: ledger.store.id,
              name: ledger.store.name,
              branch: ledger.store.branch,
            }
          : null,
      shop:
        ledger.shop && accessibleShopIds.includes(ledger.shop.id)
          ? {
              id: ledger.shop.id,
              name: ledger.shop.name,
              branch: ledger.shop.branch,
            }
          : null,
      batch: ledger.batch
        ? {
            id: ledger.batch.id,
            batchNumber: ledger.batch.batchNumber,
          }
        : null,
      notes: ledger.notes,
      movementDate: ledger.movementDate,
      createdAt: ledger.createdAt,
      updatedAt: ledger.updatedAt,
    }));

    // Calculate total quantities (only from accessible locations)
    const totalStoreQuantity = storeStockDetails.reduce(
      (total, store) => total + store.quantity,
      0,
    );
    const totalShopQuantity = shopStockDetails.reduce(
      (total, shop) => total + shop.quantity,
      0,
    );
    const overallTotalQuantity = totalStoreQuantity + totalShopQuantity;

    return {
      product: {
        id: product.id,
        productCode: product.productCode,
        name: product.name,
        generic: product.generic,
        description: product.description,
        sellPrice: product.sellPrice,
        imageUrl: product.imageUrl,
        category: product.category,
        subCategory: product.subCategory,
        unitOfMeasure: product.unitOfMeasure,
        isActive: product.isActive,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      },
      batches: processedBatches,
      additionalPrices: processedAdditionalPrices,
      stockLedgers: processedStockLedgers,
      locationStocks: [...storeStockDetails, ...shopStockDetails],
      summary: {
        totalStoreQuantity,
        totalShopQuantity,
        overallTotalQuantity,
        batchCount: processedBatches.length,
        storeCount: storeStockDetails.length,
        shopCount: shopStockDetails.length,
        ledgerCount: processedStockLedgers.length,
        additionalPriceCount: processedAdditionalPrices.length,
      },
    };
  } catch (error) {
    console.error('Error in getProductDetails:', error);
    throw error;
  }
};
const getProductBatchesByShops = async (productId) => {
  // Get all available shop stocks for the product
  const shopStocks = await prisma.shopStock.findMany({
    where: {
      batch: {
        productId,
      },
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
      batch: {
        include: {
          product: {
            include: {
              AdditionalPrice: {
                where: {
                  OR: [
                    { shopId: null }, // Global additional prices
                    { shopId: { not: null } }, // Shop-specific additional prices
                  ],
                },
              },
            },
          },
        },
      },
    },
  });

  if (!shopStocks || shopStocks.length === 0) {
    throw new Error('No available stock found for this product in any shop');
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
        in: ['APPROVED', 'PARTIALLY_DELIVERED'], // Only consider approved and partially delivered sells
      },
    },
    include: {
      items: {
        where: {
          productId,
          itemSaleStatus: 'PENDING', // Only consider pending items (not yet delivered)
        },
        include: {
          shop: true,
        },
      },
    },
  });

  // Calculate reserved quantities by shop
  const reservedQuantitiesByShop = new Map();

  pendingSells.forEach((sell) => {
    sell.items.forEach((item) => {
      if (item.productId === productId && item.itemSaleStatus === 'PENDING') {
        const currentReserved = reservedQuantitiesByShop.get(item.shopId) || 0;
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
    const netAvailableQuantity = Math.max(0, stock.quantity - reservedQuantity);

    totalAvailableQuantity += netAvailableQuantity;

    if (shopsMap.has(stock.shop.id)) {
      const existingShop = shopsMap.get(stock.shop.id);
      existingShop.quantity += netAvailableQuantity;
    } else {
      // Get base product price
      const basePrice = stock.batch.product.sellPrice;

      // Filter additional prices for this specific shop
      const shopAdditionalPrices = stock.batch.product.AdditionalPrice.filter(
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

      shopsMap.set(stock.shop.id, {
        shopId: stock.shop.id,
        shopName: stock.shop.name,
        branchName: stock.shop.branch?.name,
        quantity: netAvailableQuantity, // Only net available quantity
        basePrice,
        additionalPrices: shopAdditionalPrices.map((ap) => ({
          id: ap.id,
          label: ap.label,
          price: ap.price,
          isGlobal: ap.shopId === null,
        })),
        totalPrice,
      });
    }
  });

  return {
    totalAvailableQuantity,
    shops: Array.from(shopsMap.values()),
    hasStock: totalAvailableQuantity > 0,
  };
};

const getRandomProductsWithShopStocks = async (userId = null) => {
  // Get user's accessible shops if userId is provided
  let userAccessibleShopIds = [];

  if (userId) {
    const userWithShops = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        shops: {
          select: { id: true },
        },
      },
    });
    userAccessibleShopIds = userWithShops?.shops.map((shop) => shop.id) || [];
  }

  // Build the shop filter condition
  const shopFilterCondition = userId
    ? {
        shopId:
          userAccessibleShopIds.length > 0
            ? { in: userAccessibleShopIds }
            : { in: [] }, // Empty array returns no results
      }
    : {}; // No user ID = show all shops

  // Get random products that have batches in shops with available stock
  const productsWithShopStocks = await prisma.product.findMany({
    where: {
      isActive: true,
      batches: {
        some: {
          ShopStock: {
            some: {
              quantity: { gt: 0 },
              ...shopFilterCondition,
            },
          },
        },
      },
    },
    include: {
      category: true,
      subCategory: true,
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
      batches: {
        where: {
          ShopStock: {
            some: {
              quantity: { gt: 0 },
              ...shopFilterCondition,
            },
          },
        },
        select: {
          ShopStock: {
            where: {
              quantity: { gt: 0 },
              ...shopFilterCondition,
            },
            select: {
              quantity: true,
              shop: {
                include: {
                  branch: true,
                },
              },
              unitOfMeasure: true,
            },
          },
        },
      },
    },
    take: 20,
  });

  // Format the response...
  const formattedProducts = productsWithShopStocks.map((product) => {
    // Calculate total available quantity across all batches and shops
    // Filter additional prices based on user shop access
    const additionalPrices = product.AdditionalPrice.filter(
      (price) =>
        !userId || // No user = show all
        (userAccessibleShopIds.length > 0 &&
          userAccessibleShopIds.includes(price.shopId)), // User with shops = only assigned shops
      // If userAccessibleShopIds is empty, no additional prices will be shown
    ).map((price) => ({
      id: price.id,
      label: price.label,
      price: price.price,
      shopId: price.shopId,
      shop: price.shop
        ? {
            id: price.shop.id,
            name: price.shop.name,
            branch: price.shop.branch
              ? {
                  id: price.shop.branch.id,
                  name: price.shop.branch.name,
                }
              : null,
          }
        : null,
      createdAt: price.createdAt,
      updatedAt: price.updatedAt,
    }));

    // Create the final product object
    const finalProduct = {
      id: product.id,
      productCode: product.productCode,
      name: product.name,
      generic: product.generic,
      description: product.description,
      sellPrice: product.sellPrice,
      imageUrl: product.imageUrl,
      category: product.category,
      subCategory: product.subCategory,
      unitOfMeasure: product.unitOfMeasure,
      isActive: product.isActive,
      additionalPrices,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };

    return {
      product: finalProduct,
    };
  });

  return {
    products: formattedProducts,
    count: formattedProducts.length,
    note: 'Random products with available shop stock (no top-selling products found)',
  };
};
function processProductResults(products) {
  const productResults = products.map((product) => {
    // Filter out batches that have no shop stocks after the query

    // Process additional prices
    const additionalPrices = product.AdditionalPrice.map((price) => ({
      id: price.id,
      label: price.label,
      price: price.price,
      shopId: price.shopId,
      shop: price.shop
        ? {
            id: price.shop.id,
            name: price.shop.name,
            branch: price.shop.branch
              ? {
                  id: price.shop.branch.id,
                  name: price.shop.branch.name,
                }
              : null,
          }
        : null,
      createdAt: price.createdAt,
      updatedAt: price.updatedAt,
    }));

    return {
      product: {
        id: product.id,
        productCode: product.productCode,
        name: product.name,
        generic: product.generic,
        description: product.description,
        category: product.category,
        subCategory: product.subCategory,
        unitOfMeasure: product.unitOfMeasure,
        sellPrice: product.sellPrice,
        imageUrl: product.imageUrl,
        isActive: product.isActive,
        additionalPrices,
      },
      // Removed batches array from here
    };
  });

  return {
    products: productResults,
    count: productResults.length,
  };
}

// Helper function to check if string is a valid UUID
function isValidUUID(str) {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

const searchProducts = async (
  searchTerm,
  categoryFilter = null,
  subCategoryFilter = null,
) => {
  let categoryId = null;
  let subCategoryIds = []; // Changed to array to handle multiple subcategories with same name

  // Handle category filter (could be ID or name)
  if (categoryFilter) {
    if (isValidUUID(categoryFilter)) {
      // It's a UUID, use as ID
      categoryId = categoryFilter;
    } else {
      // It's a name, look up the ID
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

  // Handle subcategory filter (could be ID or name)
  if (subCategoryFilter) {
    if (isValidUUID(subCategoryFilter)) {
      // It's a UUID, use as ID
      subCategoryIds = [subCategoryFilter];
    } else {
      // It's a name, look up ALL subcategories with this name
      const subCategoryWhere = {
        name: subCategoryFilter,
      };

      // Only filter by category if category is specified
      if (categoryId) {
        subCategoryWhere.categoryId = categoryId;
      }

      const subCategories = await prisma.subCategory.findMany({
        where: subCategoryWhere,
        select: { id: true },
      });

      if (subCategories.length > 0) {
        subCategoryIds = subCategories.map((subCat) => subCat.id);
      } else {
        return {
          products: [],
          count: 0,
          note: 'Subcategory not found',
        };
      }
    }
  }

  // Add debug logging to see what's being searched
  // First, get all products and filter manually for case-insensitive search
  const allProducts = await prisma.product.findMany({
    where: {
      isActive: true,
      // Apply category filter if provided
      ...(categoryId && { categoryId }),
      // Apply subcategory filter if provided - now can be multiple IDs
      ...(subCategoryIds.length > 0 && {
        subCategoryId: { in: subCategoryIds },
      }),
    },
    include: {
      category: true,
      subCategory: true,
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
      batches: {
        where: {
          ShopStock: {
            some: {
              quantity: { gt: 0 },
            },
          },
        },
        include: {
          ShopStock: {
            where: {
              quantity: { gt: 0 },
            },
            include: {
              shop: {
                include: {
                  branch: true,
                },
              },
              unitOfMeasure: true,
            },
          },
        },
      },
    },
  });

  // If no search term, return all filtered products
  if (!searchTerm) {
    return processProductResults(allProducts);
  }

  // Manual case-insensitive filtering with multiple field support
  const searchTermLower = searchTerm.toLowerCase().trim();

  const filteredProducts = allProducts.filter((product) => {
    // Check product name
    const nameMatch = product.name.toLowerCase().includes(searchTermLower);

    // Check generic name - handle comma-separated values
    let genericMatch = false;
    if (product.generic) {
      // Split by commas and check each generic term
      const genericTerms = product.generic
        .toLowerCase()
        .split(',')
        .map((term) => term.trim());
      genericMatch = genericTerms.some((term) =>
        term.includes(searchTermLower),
      );
    }

    // Check product code
    const codeMatch = product.productCode
      .toLowerCase()
      .includes(searchTermLower);

    // Check category name (case-insensitive)
    const categoryMatch = product.category?.name
      .toLowerCase()
      .includes(searchTermLower);

    // Check subcategory name (case-insensitive)
    const subCategoryMatch = product.subCategory?.name
      .toLowerCase()
      .includes(searchTermLower);

    const matches =
      nameMatch ||
      genericMatch ||
      codeMatch ||
      categoryMatch ||
      subCategoryMatch;

    return matches;
  });

  return processProductResults(filteredProducts);
};

const getTopSellingProducts = async (
  userId = null,
  searchTerm = null,
  categoryName = null,
  subCategoryName = null,
) => {
  let categoryId = null;
  let subCategoryIds = []; // Changed to array for multiple matches

  // If category name is provided, find the category ID
  if (categoryName) {
    const category = await prisma.category.findFirst({
      where: {
        name: categoryName,
      },
      select: { id: true },
    });
    if (category) {
      categoryId = category.id;
    } else {
      // Category not found, return empty or handle as needed
      return {
        products: [],
        count: 0,
        note: 'Category not found',
      };
    }
  }

  // If subcategory name is provided, find ALL subcategory IDs with that name
  if (subCategoryName) {
    const subCategoryWhere = {
      name: subCategoryName,
    };

    // Only filter by category if category is also specified
    if (categoryId) {
      subCategoryWhere.categoryId = categoryId;
    }

    const subCategories = await prisma.subCategory.findMany({
      where: subCategoryWhere,
      select: { id: true },
    });

    if (subCategories.length > 0) {
      subCategoryIds = subCategories.map((subCat) => subCat.id);
    } else {
      // Subcategory not found, return empty or handle as needed
      return {
        products: [],
        count: 0,
        note: 'Subcategory not found',
      };
    }
  }

  // If search term is provided, use search functionality
  if (searchTerm) {
    return searchProducts(searchTerm, categoryId, subCategoryName);
  }

  // Get user's accessible shops if userId is provided
  let userAccessibleShopIds = [];
  if (userId) {
    const userWithShops = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        shops: {
          select: { id: true },
        },
      },
    });
    userAccessibleShopIds = userWithShops?.shops.map((shop) => shop.id) || [];
  }

  // Build the shop filter condition
  const shopFilterCondition = userId
    ? {
        shopId:
          userAccessibleShopIds.length > 0
            ? { in: userAccessibleShopIds }
            : { in: [] },
      }
    : {};

  // Get top selling products by aggregating sell items
  const topSellingProducts = await prisma.sellItem.groupBy({
    by: ['productId'],
    where: {
      // Only include completed/delivered sales
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
    _sum: {
      quantity: true,
      totalPrice: true,
    },
    _count: {
      id: true,
    },
    orderBy: {
      _sum: {
        quantity: 'desc',
      },
    },
    take: 20,
  });

  // If no top selling products found, get random 20 products with shop stocks
  if (topSellingProducts.length === 0) {
    return getRandomProductsWithShopStocks(userId);
  }

  // Get product IDs from top selling products
  const productIds = topSellingProducts.map((item) => item.productId);

  // Build where clause for products with optional category/subcategory filters
  const productWhereClause = {
    id: { in: productIds },
    isActive: true,
  };

  // Add category filter if found
  if (categoryId) {
    productWhereClause.categoryId = categoryId;
  }

  // Add subcategory filter if found - now can be multiple IDs
  if (subCategoryIds.length > 0) {
    productWhereClause.subCategoryId = { in: subCategoryIds };
  }

  // Get products with their additional prices and shop availability
  const productsWithDetails = await prisma.product.findMany({
    where: productWhereClause,
    include: {
      category: true,
      subCategory: true,
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
      batches: {
        where: {
          ShopStock: {
            some: {
              quantity: { gt: 0 },
              ...shopFilterCondition,
            },
          },
        },
        select: {
          ShopStock: {
            where: {
              quantity: { gt: 0 },
              ...shopFilterCondition,
            },
            select: {
              quantity: true,
              shop: {
                include: {
                  branch: true,
                },
              },
              unitOfMeasure: true,
            },
          },
        },
      },
    },
  });

  // Format the response...
  const formattedProducts = productsWithDetails.map((product) => {
    // Filter additional prices based on user shop access
    const additionalPrices = product.AdditionalPrice.filter(
      (price) =>
        !userId || // No user = show all
        (userAccessibleShopIds.length > 0 &&
          userAccessibleShopIds.includes(price.shopId)), // User with shops = only assigned shops
    ).map((price) => ({
      id: price.id,
      label: price.label,
      price: price.price,
      shopId: price.shopId,
      shop: price.shop
        ? {
            id: price.shop.id,
            name: price.shop.name,
            branch: price.shop.branch
              ? {
                  id: price.shop.branch.id,
                  name: price.shop.branch.name,
                }
              : null,
          }
        : null,
      createdAt: price.createdAt,
      updatedAt: price.updatedAt,
    }));

    // Create the final product object
    const finalProduct = {
      id: product.id,
      productCode: product.productCode,
      name: product.name,
      generic: product.generic,
      description: product.description,
      sellPrice: product.sellPrice,
      imageUrl: product.imageUrl,
      category: product.category,
      subCategory: product.subCategory,
      unitOfMeasure: product.unitOfMeasure,
      isActive: product.isActive,
      additionalPrices,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };

    return {
      product: finalProduct,
    };
  });

  // Sort by sales quantity and take top 20
  const topProducts = formattedProducts
    .sort(
      (a, b) =>
        (b.salesData?.totalQuantitySold || 0) -
        (a.salesData?.totalQuantitySold || 0),
    )
    .slice(0, 20);

  return {
    products: topProducts,
    count: topProducts.length,
    note: 'Top selling products with available shop stock',
  };
};

const getProductBatchesByShopsUser = async (productId, userId = null) => {
  // If userId is provided, get user's accessible shops first
  let userShopIds = [];
  if (userId) {
    const userWithShops = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        shops: {
          select: { id: true },
        },
      },
    });

    if (!userWithShops) {
      throw new Error('User not found');
    }

    userShopIds = userWithShops.shops.map((shop) => shop.id);

    // If user has no shop access, return empty result
    if (userShopIds.length === 0) {
      return {
        totalAvailableQuantity: 0,
        shops: [],
        hasStock: false,
        _metadata: {
          totalShops: 0,
          accessibleShops: 0,
          hasRestrictedAccess: false,
          message: 'User has no shop access',
        },
      };
    }
  }

  // Build where clause for shop stocks
  const shopStockWhere = {
    batch: {
      productId,
    },
    status: 'Available',
    quantity: {
      gt: 0,
    },
  };

  // If userId is provided, filter by user's accessible shops
  if (userId && userShopIds.length > 0) {
    shopStockWhere.shopId = {
      in: userShopIds,
    };
  }

  // Get all available shop stocks for the product
  const shopStocks = await prisma.shopStock.findMany({
    where: shopStockWhere,
    include: {
      shop: {
        include: {
          branch: true,
        },
      },
      batch: {
        include: {
          product: {
            include: {
              AdditionalPrice: {
                where: {
                  OR: [
                    { shopId: null }, // Global additional prices
                    { shopId: { not: null } }, // Shop-specific additional prices
                  ],
                },
              },
            },
          },
        },
      },
    },
  });

  if (!shopStocks || shopStocks.length === 0) {
    return {
      totalAvailableQuantity: 0,
      shops: [],
      hasStock: false,
      _metadata: {
        totalShops: 0,
        accessibleShops: 0,
        hasRestrictedAccess: false,
        message:
          'No available stock found for this product in accessible shops',
      },
    };
  }

  // Get shop IDs from the fetched stocks for reservation calculation
  const stockShopIds = [...new Set(shopStocks.map((stock) => stock.shopId))];

  // Get all pending/approved sells that affect stock availability in accessible shops
  const pendingSells = await prisma.sell.findMany({
    where: {
      items: {
        some: {
          productId,
          shopId: {
            in: stockShopIds,
          },
        },
      },
      saleStatus: {
        in: ['APPROVED', 'PARTIALLY_DELIVERED'], // Only consider approved and partially delivered sells
      },
    },
    include: {
      items: {
        where: {
          productId,
          shopId: {
            in: stockShopIds,
          },
          itemSaleStatus: 'PENDING', // Only consider pending items (not yet delivered)
        },
        include: {
          shop: true,
        },
      },
    },
  });

  // Calculate reserved quantities by shop (only for accessible shops)
  const reservedQuantitiesByShop = new Map();

  pendingSells.forEach((sell) => {
    sell.items.forEach((item) => {
      if (
        item.productId === productId &&
        item.itemSaleStatus === 'PENDING' &&
        stockShopIds.includes(item.shopId)
      ) {
        const currentReserved = reservedQuantitiesByShop.get(item.shopId) || 0;
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
    const netAvailableQuantity = Math.max(0, stock.quantity - reservedQuantity);

    totalAvailableQuantity += netAvailableQuantity;

    if (shopsMap.has(stock.shop.id)) {
      const existingShop = shopsMap.get(stock.shop.id);
      existingShop.quantity += netAvailableQuantity;
    } else {
      // Get base product price
      const basePrice = stock.batch.product.sellPrice;

      // Filter additional prices for this specific shop
      const shopAdditionalPrices = stock.batch.product.AdditionalPrice.filter(
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

      shopsMap.set(stock.shop.id, {
        shopId: stock.shop.id,
        shopName: stock.shop.name,
        branchName: stock.shop.branch?.name,
        quantity: netAvailableQuantity, // Only net available quantity
        basePrice,
        additionalPrices: shopAdditionalPrices.map((ap) => ({
          id: ap.id,
          label: ap.label,
          price: ap.price,
          isGlobal: ap.shopId === null,
        })),
        totalPrice,
      });
    }
  });

  const shopsArray = Array.from(shopsMap.values());

  // Calculate metadata
  let totalShopsInSystem = 0;
  if (userId) {
    // Count total shops that have this product in stock (regardless of user access)
    const allShopsWithStock = await prisma.shopStock.findMany({
      where: {
        batch: {
          productId,
        },
        status: 'Available',
        quantity: {
          gt: 0,
        },
      },
      select: {
        shopId: true,
      },
      distinct: ['shopId'],
    });
    totalShopsInSystem = allShopsWithStock.length;
  }

  return {
    totalAvailableQuantity,
    shops: shopsArray,
    hasStock: totalAvailableQuantity > 0,
    _metadata: {
      totalShops: userId ? totalShopsInSystem : shopsArray.length,
      accessibleShops: shopsArray.length,
      hasRestrictedAccess: userId
        ? shopsArray.length < totalShopsInSystem
        : false,
      userHasAccess: userId ? userShopIds.length > 0 : null,
      message: userId
        ? `Showing ${shopsArray.length} of ${totalShopsInSystem} shops with available stock`
        : 'Showing all shops with available stock',
    },
  };
};

// Alternative function that explicitly requires userId
const getProductBatchesByShopsForUser = async (productId, userId) => {
  if (!userId) {
    throw new Error('User ID is required for this function');
  }

  return getProductBatchesByShopsUser(productId, userId);
};

module.exports = {
  createProductBatch,
  getProductById,
  getProductByCode,
  getAllProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getBatchesByProduct,
  getActiveAllProducts,
  createProductBatchsingle,
  getProductDetails,
  getProductBatchesByShops,
  getTopSellingProducts,
  getRandomProductsWithShopStocks,
  getProductBatchesByShopsForUser,
};
