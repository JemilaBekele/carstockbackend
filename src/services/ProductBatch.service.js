const httpStatus = require('http-status');
const { subMonths } = require('date-fns');

const ApiError = require('../utils/ApiError');
const prisma = require('./prisma');

const getProductBatchById = async (batchId) => {
  if (!batchId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Batch ID is required');
  }

  const productBatch = await prisma.productBatch.findUnique({
    where: { id: batchId },
    include: {
      product: {},
      StockLedger: {
        orderBy: {
          movementDate: 'desc',
        },
        take: 10,
      },
      StoreStock: true,
    },
  });

  if (!productBatch) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Product batch not found');
  }

  return productBatch;
};

const getAllProductBatches = async ({ startDate, endDate } = {}) => {
  const whereClause = {};
  const twelveMonthsAgo = subMonths(new Date(), 12); // Default to last 12 months

  // Convert string dates to Date objects if they exist
  const startDateObj = startDate ? new Date(startDate) : undefined;
  const endDateObj = endDate ? new Date(endDate) : undefined;

  // Filter by createdAt (batch creation date)
  if (startDateObj && endDateObj) {
    whereClause.createdAt = {
      gte: startDateObj,
      lte: endDateObj,
    };
  } else if (startDateObj) {
    whereClause.createdAt = {
      gte: startDateObj,
      lte: new Date(),
    };
  } else if (endDateObj) {
    whereClause.createdAt = {
      gte: twelveMonthsAgo,
      lte: endDateObj,
    };
  } else {
    whereClause.createdAt = {
      gte: twelveMonthsAgo,
    };
  }

  const productBatches = await prisma.productBatch.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    include: {
      product: {
        select: {
          name: true,
          productCode: true,
        },
      },
      store: {
        select: {
          name: true,
        },
      },
      StoreStock: true,
      ShopStock: true,
    },
  });

  return {
    productBatches,
    count: productBatches.length,
  };
};
const getProductBatches = async (productId, shopId) => {
  const productBatches = await prisma.productBatch.findMany({
    where: {
      productId,
      ShopStock: {
        some: {
          shopId,
          quantity: {
            gt: 0, // Stock not zero
          },
          status: 'Available', // Only available stock
          batch: {
            expiryDate: {
              gt: new Date(), // Not expired (expiry date greater than current date)
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      product: {
        select: {
          name: true,
          productCode: true,
          unitOfMeasure: true,
          sellPrice: true,
        },
      },
      ShopStock: {
        where: {
          shopId,
          quantity: { gt: 0 },
          status: 'Available',
        },
        include: {
          unitOfMeasure: true,
        },
      },
    },
  });

  return {
    productBatches,
    count: productBatches.length,
  };
};

const deleteProductBatch = async (batchId, userId) => {
  if (!batchId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Batch ID is required');
  }

  // Check if batch exists and get current stock
  const existingBatch = await prisma.productBatch.findUnique({
    where: { id: batchId },
    include: {
      StoreStock: true,
    },
  });

  if (!existingBatch) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Product batch not found');
  }

  // Check if batch has any stock transactions or is referenced elsewhere
  const hasTransactions = await prisma.stockLedger.count({
    where: { batchId },
  });

  if (hasTransactions > 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Cannot delete batch with existing stock transactions',
    );
  }

  // Use transaction to ensure all related data is deleted
  return prisma.$transaction(async (tx) => {
    // Delete additional prices

    // Delete store stock entries
    await tx.storeStock.deleteMany({
      where: { batchId },
    });

    // Delete the batch
    const deletedBatch = await tx.productBatch.delete({
      where: { id: batchId },
    });

    // Create audit log entry
    await tx.auditLog.create({
      data: {
        action: 'DELETE',
        entity: 'ProductBatch',
        entityId: batchId,
        userId,
        details: `Deleted batch ${deletedBatch.batchNumber} with stock: ${deletedBatch.stock}`,
      },
    });

    return deletedBatch;
  });
};
const getProductBatchByBatchNumber = async (batchNumber) => {
  const batch = await prisma.productBatch.findFirst({
    where: {
      batchNumber,
    },
  });
  return !!batch;
};
const createProductBatchWithAdditionalPrices = async (productBatchBody) => {
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

  // Format the expiryDate if provided and create a copy without additionalPrices
  const { ...batchData } = productBatchBody;

  const formattedData = {
    ...batchData,
    expiryDate: batchData.expiryDate
      ? new Date(batchData.expiryDate).toISOString()
      : undefined,
  };

  // Create product batch with additional prices
  const productBatch = await prisma.productBatch.create({
    data: {
      ...formattedData,
      // Include additional prices if provided - use AdditionalPrice instead of additionalPrices
    },
  });

  return productBatch;
};

const updateProductBatchWithAdditionalPrices = async (batchId, updateBody) => {
  // Check if product batch exists
  const existingBatch = await prisma.productBatch.findUnique({
    where: { id: batchId },
  });

  if (!existingBatch) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Product batch not found');
  }

  // Separate additionalPrices from the rest of the update data
  const { ...batchData } = updateBody;

  // Format the expiryDate if provided
  const formattedData = {
    ...batchData,
    expiryDate: batchData.expiryDate
      ? new Date(batchData.expiryDate).toISOString()
      : undefined,
  };

  // Handle additional prices update

  const updatedBatch = await prisma.productBatch.update({
    where: { id: batchId },
    data: {
      ...formattedData,
    },
  });

  return updatedBatch;
};

// Get product by store ID and stock ID
// Get product by store ID
const getProductByStoreStock = async (storeId) => {
  try {
    const storeStocks = await prisma.storeStock.findMany({
      where: {
        storeId,
      },
      include: {
        product: {
          include: {
            category: true,
            brand: true,
          },
        },
        store: true,
      },
    });

    if (!storeStocks || storeStocks.length === 0) {
      throw new Error(`No store stocks found for storeId: ${storeId}`);
    }

    // Filter out any stocks without product
    const validStocks = storeStocks.filter((stock) => {
      if (!stock.product) {
        console.warn(`Stock ${stock.id} has no product associated`);
        return false;
      }
      return true;
    });

    // Return enriched data with all necessary information
    const result = validStocks.map((storeStock) => {
      const { product } = storeStock;

      return {
        id: storeStock.id,
        storeId: storeStock.storeId,
        productId: storeStock.productId,
        quantity: storeStock.quantity,
        status: storeStock.status,
        createdAt: storeStock.createdAt,
        updatedAt: storeStock.updatedAt,

        // Store information
        store: storeStock.store
          ? {
              id: storeStock.store.id,
              name: storeStock.store.name,
              branchId: storeStock.store.branchId,
            }
          : null,

        // Product information with all details
        product: {
          id: product.id,
          productCode: product.productCode,
          name: product.name,
          generic: product.generic,
          description: product.description,
          sellPrice: product.sellPrice,
          imageUrl: product.imageUrl,
          isActive: product.isActive,
          hasBox: product.hasBox,
          boxSize: product.boxSize,
          UnitOfMeasure: product.UnitOfMeasure,

          // Category and brand
          category: product.category,
          brand: product.brand,
        },

        // Helper fields for frontend
        availableQuantity: storeStock.quantity,
      };
    });

    return result;
  } catch (error) {
    console.error('Error in getProductByStoreStock:', error);
    throw error;
  }
};

// Get product by shop ID
const getProductByShopStock = async (shopId) => {
  try {
    const shopStocks = await prisma.shopStock.findMany({
      where: {
        shopId,
      },
      include: {
        product: {
          include: {
            category: true,
            brand: true,
          },
        },
        shop: true,
      },
    });

    if (!shopStocks || shopStocks.length === 0) {
      throw new Error(`No shop stocks found for shopId: ${shopId}`);
    }

    // Filter out any stocks without product
    const validStocks = shopStocks.filter((stock) => {
      if (!stock.product) {
        console.warn(`Stock ${stock.id} has no product associated`);
        return false;
      }
      return true;
    });

    // Return enriched data with all necessary information
    const result = validStocks.map((shopStock) => {
      const { product } = shopStock;

      return {
        id: shopStock.id,
        shopId: shopStock.shopId,
        productId: shopStock.productId,
        quantity: shopStock.quantity,
        status: shopStock.status,
        createdAt: shopStock.createdAt,
        updatedAt: shopStock.updatedAt,

        // Shop information
        shop: shopStock.shop
          ? {
              id: shopStock.shop.id,
              name: shopStock.shop.name,
              branchId: shopStock.shop.branchId,
            }
          : null,

        // Product information with all details
        product: {
          id: product.id,
          productCode: product.productCode,
          name: product.name,
          generic: product.generic,
          description: product.description,
          sellPrice: product.sellPrice,
          imageUrl: product.imageUrl,
          isActive: product.isActive,
          hasBox: product.hasBox,
          boxSize: product.boxSize,
          UnitOfMeasure: product.UnitOfMeasure,

          // Category and brand
          category: product.category,
          brand: product.brand,
        },

        // Helper fields for frontend
        availableQuantity: shopStock.quantity,
      };
    });

    return result;
  } catch (error) {
    console.error('Error in getProductByShopStock:', error);
    throw error;
  }
};

const getProductInfoByBatchId = async (batchId) => {
  const batch = await prisma.productBatch.findUnique({
    where: { id: batchId },
    select: {
      product: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!batch || !batch.product) return null;

  return { id: batch.product.id, name: batch.product.name };
};
const addOrUpdateShopStock = async (shopId, batchId, quantity) => {
  try {
    // Validate required fields
    if (!shopId || !batchId || quantity === undefined) {
      throw new Error('shopId, batchId, and quantity are required');
    }

    // Check if the batch exists and get the product with its unit of measure
    const batch = await prisma.productBatch.findUnique({
      where: { id: batchId },
      include: {
        product: {
          include: {
            unitOfMeasure: true, // Get unit of measure from product
          },
        },
      },
    });

    if (!batch) {
      throw new Error(`Batch with ID ${batchId} not found`);
    }

    // Get unitOfMeasureId from the product (since batch doesn't have it directly)
    const { unitOfMeasureId } = batch.product;

    if (!unitOfMeasureId) {
      throw new Error(
        `Product associated with batch ${batchId} does not have a unit of measure`,
      );
    }

    // For negative quantities, check if we have enough stock
    if (quantity < 0) {
      const currentStock = await prisma.shopStock.findUnique({
        where: {
          shopId_batchId: {
            shopId,
            batchId,
          },
        },
        select: { quantity: true },
      });

      if (!currentStock) {
        throw new Error('Cannot decrease stock: Shop stock not found');
      }

      if (currentStock.quantity + quantity < 0) {
        throw new Error('Insufficient stock in shop');
      }

      // Update existing stock
      const result = await prisma.shopStock.update({
        where: {
          shopId_batchId: {
            shopId,
            batchId,
          },
        },
        data: {
          quantity: {
            decrement: Math.abs(quantity),
          },
          updatedAt: new Date(),
        },
        include: {
          batch: {
            include: {
              product: {
                include: {
                  unitOfMeasure: true,
                },
              },
            },
          },
          shop: true,
          unitOfMeasure: true, // Include unitOfMeasure in the result
        },
      });

      return result;
    }

    // For positive or zero quantities, use upsert
    const result = await prisma.shopStock.upsert({
      where: {
        shopId_batchId: {
          shopId,
          batchId,
        },
      },
      update: {
        quantity: {
          increment: quantity,
        },
        updatedAt: new Date(),
      },
      create: {
        shopId,
        batchId,
        quantity,
        unitOfMeasureId, // Use the unitOfMeasureId from the product
      },
      include: {
        batch: {
          include: {
            product: {
              include: {
                unitOfMeasure: true,
              },
            },
          },
        },
        shop: true,
        unitOfMeasure: true, // Include unitOfMeasure in the result
      },
    });

    return result;
  } catch (error) {
    console.error('Error in addOrUpdateShopStock:', error);
    throw error;
  }
};
module.exports = {
  getProductBatchById,
  getAllProductBatches,
  deleteProductBatch,
  createProductBatchWithAdditionalPrices,
  updateProductBatchWithAdditionalPrices,
  getProductByStoreStock,
  getProductByShopStock,
  getProductInfoByBatchId,
  getProductBatches,
  addOrUpdateShopStock,
};
