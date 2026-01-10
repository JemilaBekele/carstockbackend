const httpStatus = require('http-status');
const { subMonths } = require('date-fns');

const ApiError = require('../utils/ApiError');
const prisma = require('./prisma');

// Get StockCorrection by ID
const getStockCorrectionById = async (id) => {
  console.log('=== getStockCorrectionById START ===');
  console.log('Looking for stock correction with ID:', id);
  
  try {
    // Validate ID
    if (!id || typeof id !== 'string') {
      console.error('Invalid ID provided:', id);
      throw new Error('Invalid stock correction ID');
    }
    
    console.log('Executing Prisma query...');
    
    const stockCorrection = await prisma.stockCorrection.findUnique({
      where: { id },
      include: {
        store: true,
        shop: true,
        purchase: true,
        transfer: true,
        createdBy: true,
        updatedBy: true,
        items: {
          include: {
            product: true,
            batch: true,
            unitOfMeasure: true,
          },
        },
      },
    });
    
    console.log('Query completed successfully');
    
    if (!stockCorrection) {
      console.log('Stock correction not found with ID:', id);
    } else {
      console.log('Stock correction found:', {
        id: stockCorrection.id,
        reference: stockCorrection.reference,
        reason: stockCorrection.reason,
        status: stockCorrection.status,
        itemsCount: stockCorrection.items?.length || 0,
        store: stockCorrection.store?.name || 'No store',
        shop: stockCorrection.shop?.name || 'No shop',
      });
    }
    
    console.log('=== getStockCorrectionById END ===');
    
    return stockCorrection;
  } catch (error) {
    console.error('=== getStockCorrectionById ERROR ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    // Check if it's a Prisma error
    if (error.code) {
      console.error('Prisma error code:', error.code);
    }
    
    // Check database connection
    if (error.message.includes('connect') || error.message.includes('connection')) {
      console.error('Database connection error');
    }
    
    // Check for invalid ID format
    if (error.message.includes('Invalid value') || error.message.includes('malformed')) {
      console.error('Invalid ID format');
    }
    
    throw error;
  }
};

const getStockCorrectionsByPurchaseId = async (purchaseId) => {
  const stockCorrections = await prisma.stockCorrection.findMany({
    where: {
      purchaseId,
    },
    include: {
      store: true,
      shop: true,
      purchase: true,
      transfer: true,
      createdBy: true,
      updatedBy: true,
      items: {
        include: {
          product: true,
          batch: true,
          unitOfMeasure: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc', // Optional: order by creation date, newest first
    },
  });
  return stockCorrections;
};
// Get StockCorrection by reference
const getStockCorrectionByReference = async (reference) => {
  const stockCorrection = await prisma.stockCorrection.findFirst({
    where: { reference },
  });
  return stockCorrection;
};

// Get all StockCorrections
const getAllStockCorrections = async ({ startDate, endDate } = {}) => {
  const whereClause = {};
  const threeMonthsAgo = subMonths(new Date(), 12);

  // Convert and validate dates
  const startDateObj = startDate ? new Date(startDate) : undefined;
  const endDateObj = endDate ? new Date(endDate) : undefined;

  if (startDateObj && isNaN(startDateObj.getTime())) {
    throw new Error('Invalid startDate format');
  }
  if (endDateObj && isNaN(endDateObj.getTime())) {
    throw new Error('Invalid endDate format');
  }

  // Date filtering logic
  if (startDateObj && endDateObj) {
    whereClause.createdAt = { gte: startDateObj, lte: endDateObj };
  } else if (startDateObj) {
    whereClause.createdAt = { gte: startDateObj, lte: new Date() };
  } else if (endDateObj) {
    whereClause.createdAt = { gte: threeMonthsAgo, lte: endDateObj };
  } else {
    whereClause.createdAt = { gte: threeMonthsAgo };
  }

  const stockCorrections = await prisma.stockCorrection.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      reference: true,
      reason: true,
      status: true,
      notes: true,
      createdAt: true,
      shortCode: true,
    },
  });

  return {
    stockCorrections,
    count: stockCorrections.length,
  };
};
const generateShortCode = async () => {
  try {
    // Find the highest existing SC number
    const result = await prisma.$queryRaw`
      SELECT MAX(CAST(SUBSTRING("shortCode" FROM 4) AS INTEGER)) as maxNumber
      FROM "StockCorrection"
      WHERE "shortCode" LIKE 'SC-%'
    `;

    const maxNumber = result[0]?.maxNumber || 0;
    const nextNumber = maxNumber + 1;

    return `SC-${String(nextNumber).padStart(6, '0')}`;
  } catch (error) {
    // Fallback: Use timestamp
    const timestamp = Date.now();
    return `SC-EMG-${timestamp.toString().slice(-8)}`;
  }
};
// Create StockCorrection
const createStockCorrection = async (stockCorrectionBody, userId) => {
  // Check if reference already exists
  const shortCode = await generateShortCode();

  // if (
  //   stockCorrectionBody.reference &&
  //   (await getStockCorrectionByReference(stockCorrectionBody.reference))
  // ) {
  //   throw new ApiError(
  //     httpStatus.BAD_REQUEST,
  //     'Stock correction reference already taken',
  //   );
  // }

  // Parse items if it's a string
  const { items: itemsString, ...restStockCorrectionBody } =
    stockCorrectionBody;
  const items =
    typeof itemsString === 'string' ? JSON.parse(itemsString) : itemsString;

  // Validate items
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Stock correction must have at least one item',
    );
  }

  // Validate individual item properties
  items.forEach((item, index) => {
    if (!item.productId || !item.unitOfMeasureId) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Item ${
          index + 1
        } is missing required fields (productId or unitOfMeasureId)`,
      );
    }
    if (
      item.quantity === undefined ||
      item.quantity === null ||
      Number.isNaN(item.quantity)
    ) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Item ${index + 1} has invalid quantity`,
      );
    }
    if (item.quantity === 0) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Item ${index + 1} quantity cannot be zero`,
      );
    }
  });

  // Clean up empty string values
  const cleanedStockCorrectionBody = {
    ...restStockCorrectionBody,
    storeId:
      restStockCorrectionBody.storeId === ''
        ? null
        : restStockCorrectionBody.storeId,
    shopId:
      restStockCorrectionBody.shopId === ''
        ? null
        : restStockCorrectionBody.shopId,
    purchaseId:
      restStockCorrectionBody.purchaseId === ''
        ? null
        : restStockCorrectionBody.purchaseId,
    transferId:
      restStockCorrectionBody.transferId === ''
        ? null
        : restStockCorrectionBody.transferId,
  };

  // Validate location
  if (
    !cleanedStockCorrectionBody.storeId &&
    !cleanedStockCorrectionBody.shopId
  ) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Either store or shop must be specified',
    );
  }

  // Create the stock correction
  const stockCorrection = await prisma.stockCorrection.create({
    data: {
      ...cleanedStockCorrectionBody,
      shortCode, // Add this field
      createdById: userId,
      updatedById: userId,
      items: {
        create: items.map((item) => ({
          productId: item.productId,
          batchId: item.batchId || null,
          unitOfMeasureId: item.unitOfMeasureId,
          quantity: item.quantity,
        })),
      },
    },
    include: {
      items: {
        include: {
          unitOfMeasure: true,
          product: true,
          batch: true,
        },
      },
    },
  });

  return stockCorrection;
};

// Update StockCorrection
const updateStockCorrection = async (
  stockCorrectionId,
  stockCorrectionBody,
  userId,
) => {
  // Check if stock correction exists
  const existingStockCorrection = await getStockCorrectionById(
    stockCorrectionId,
  );
  if (!existingStockCorrection) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Stock correction not found');
  }

  // Cannot update approved or rejected stock corrections
  if (existingStockCorrection.status !== 'PENDING') {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Cannot update ${existingStockCorrection.status.toLowerCase()} stock correction`,
    );
  }

  // Check if reference already exists (excluding current stock correction)
  if (
    stockCorrectionBody.reference &&
    stockCorrectionBody.reference !== existingStockCorrection.reference
  ) {
    if (await getStockCorrectionByReference(stockCorrectionBody.reference)) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Stock correction reference already taken',
      );
    }
  }

  // Parse items if it's a string
  const { items: itemsString, ...restStockCorrectionBody } =
    stockCorrectionBody;
  const items =
    typeof itemsString === 'string' ? JSON.parse(itemsString) : itemsString;

  // Validate items
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Stock correction must have at least one item',
    );
  }

  // Validate individual item properties
  items.forEach((item, index) => {
    if (!item.productId || !item.unitOfMeasureId) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Item ${
          index + 1
        } is missing required fields (productId or unitOfMeasureId)`,
      );
    }
  });

  // Clean up empty string values
  const cleanedStockCorrectionBody = {
    ...restStockCorrectionBody,
    storeId:
      restStockCorrectionBody.storeId === ''
        ? null
        : restStockCorrectionBody.storeId,
    shopId:
      restStockCorrectionBody.shopId === ''
        ? null
        : restStockCorrectionBody.shopId,
    purchaseId:
      restStockCorrectionBody.purchaseId === ''
        ? null
        : restStockCorrectionBody.purchaseId,
    transferId:
      restStockCorrectionBody.transferId === ''
        ? null
        : restStockCorrectionBody.transferId,
  };

  // Validate location
  if (
    !cleanedStockCorrectionBody.storeId &&
    !cleanedStockCorrectionBody.shopId
  ) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Either store or shop must be specified',
    );
  }

  // Update the stock correction inside a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Delete all existing items
    await tx.stockCorrectionItem.deleteMany({
      where: { correctionId: stockCorrectionId },
    });

    // Update stock correction with cleaned body and new items
    const stockCorrection = await tx.stockCorrection.update({
      where: { id: stockCorrectionId },
      data: {
        ...cleanedStockCorrectionBody,
        updatedById: userId,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            batchId: item.batchId || null,
            unitOfMeasureId: item.unitOfMeasureId,
            quantity: item.quantity,
          })),
        },
      },
      include: {
        items: {
          include: {
            unitOfMeasure: true,
          },
        },
      },
    });

    return stockCorrection;
  });

  return result;
};

// Delete StockCorrection
const deleteStockCorrection = async (id, userId) => {
  const existingStockCorrection = await getStockCorrectionById(id);
  if (!existingStockCorrection) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Stock correction not found');
  }

  const result = await prisma.$transaction(async (tx) => {
    // Check if stock correction is approved (has stock ledger entries)
    const ledgerEntries = await tx.stockLedger.findMany({
      where: {
        invoiceNo: existingStockCorrection.shortCode,
      },
    });

    const isApproved = ledgerEntries.length > 0;

    if (isApproved) {
      // Reverse all stock operations for approved stock correction
      await Promise.all(
        existingStockCorrection.items.map(async (item) => {
          const operations = [];
          const originalQuantity = item.quantity;
          const isAddition = originalQuantity > 0;
          const absoluteQuantity = Math.abs(originalQuantity);

          // Reverse the stock adjustment (opposite operation)
          if (existingStockCorrection.storeId) {
            const existingStoreStock = await tx.storeStock.findUnique({
              where: {
                storeId_batchId: {
                  storeId: existingStockCorrection.storeId,
                  batchId: item.batchId || 'no-batch',
                },
              },
            });

            if (existingStoreStock) {
              const newQuantity = isAddition
                ? existingStoreStock.quantity - absoluteQuantity // Was addition, now subtract
                : existingStoreStock.quantity + absoluteQuantity; // Was subtraction, now add

              if (newQuantity <= 0) {
                // Delete if quantity becomes 0 or negative
                operations.push(
                  tx.storeStock.delete({
                    where: {
                      storeId_batchId: {
                        storeId: existingStockCorrection.storeId,
                        batchId: item.batchId || 'no-batch',
                      },
                    },
                  }),
                );
              } else {
                // Update quantity with reverse operation
                operations.push(
                  tx.storeStock.update({
                    where: {
                      storeId_batchId: {
                        storeId: existingStockCorrection.storeId,
                        batchId: item.batchId || 'no-batch',
                      },
                    },
                    data: {
                      quantity: isAddition
                        ? { decrement: absoluteQuantity }
                        : { increment: absoluteQuantity },
                    },
                  }),
                );
              }
            }
          } else if (existingStockCorrection.shopId) {
            const existingShopStock = await tx.shopStock.findUnique({
              where: {
                shopId_batchId: {
                  shopId: existingStockCorrection.shopId,
                  batchId: item.batchId || 'no-batch',
                },
              },
            });

            if (existingShopStock) {
              const newQuantity = isAddition
                ? existingShopStock.quantity - absoluteQuantity // Was addition, now subtract
                : existingShopStock.quantity + absoluteQuantity; // Was subtraction, now add

              if (newQuantity <= 0) {
                // Delete if quantity becomes 0 or negative
                operations.push(
                  tx.shopStock.delete({
                    where: {
                      shopId_batchId: {
                        shopId: existingStockCorrection.shopId,
                        batchId: item.batchId || 'no-batch',
                      },
                    },
                  }),
                );
              } else {
                // Update quantity with reverse operation
                operations.push(
                  tx.shopStock.update({
                    where: {
                      shopId_batchId: {
                        shopId: existingStockCorrection.shopId,
                        batchId: item.batchId || 'no-batch',
                      },
                    },
                    data: {
                      quantity: isAddition
                        ? { decrement: absoluteQuantity }
                        : { increment: absoluteQuantity },
                    },
                  }),
                );
              }
            }
          }

          // Create reversal stock ledger entry (opposite movement type)
          const reversalMovementType = isAddition ? 'OUT' : 'IN';
          const reversalNotes = `Stock correction reversal: ${existingStockCorrection.reason.toLowerCase()}`;

          if (existingStockCorrection.storeId) {
            operations.push(
              tx.stockLedger.create({
                data: {
                  batchId: item.batchId,
                  storeId: existingStockCorrection.storeId,
                  invoiceNo: `REV-${existingStockCorrection.shortCode}`,
                  movementType: reversalMovementType,
                  quantity: absoluteQuantity,
                  unitOfMeasureId: item.unitOfMeasureId,
                  reference: `STOCK-CORRECTION-REVERSAL-${existingStockCorrection.reason}`,
                  userId,
                  notes: reversalNotes,
                  movementDate: new Date(),
                },
              }),
            );
          } else if (existingStockCorrection.shopId) {
            operations.push(
              tx.stockLedger.create({
                data: {
                  batchId: item.batchId,
                  invoiceNo: `REV-${existingStockCorrection.shortCode}`,
                  shopId: existingStockCorrection.shopId,
                  movementType: reversalMovementType,
                  quantity: absoluteQuantity,
                  unitOfMeasureId: item.unitOfMeasureId,
                  reference: `SHOP-CORRECTION-REVERSAL-${existingStockCorrection.reason}`,
                  userId,
                  notes: reversalNotes,
                  movementDate: new Date(),
                },
              }),
            );
          }

          // Execute all operations for this item
          if (operations.length > 0) {
            await Promise.all(operations);
          }
        }),
      );

      // Delete the original stock ledger entries
      await tx.stockLedger.deleteMany({
        where: {
          invoiceNo: existingStockCorrection.shortCode,
        },
      });
    }

    // Delete all stock correction items
    await tx.stockCorrectionItem.deleteMany({
      where: { correctionId: id },
    });

    // Delete the stock correction
    await tx.stockCorrection.delete({
      where: { id },
    });

    // Create log entry
    await tx.log.create({
      data: {
        action: `Deleted stock correction ${existingStockCorrection.shortCode}${
          isApproved ? ' and reversed stock transactions' : ''
        }`,
        userId,
      },
    });

    return {
      message: `Stock correction deleted successfully${
        isApproved ? ' and stock transactions reversed' : ''
      }`,
      stockReversed: isApproved,
    };
  });

  return result;
};

// Approve StockCorrection
const approveStockCorrection = async (stockCorrectionId, userId) => {
  console.log('Starting approveStockCorrection:', {
    stockCorrectionId,
    userId,
  });

  // Fetch stock correction with product details
  const stockCorrection = await prisma.stockCorrection.findUnique({
    where: { id: stockCorrectionId },
    include: {
      items: {
        include: {
          product: {
            // Include product to get name
            select: {
              id: true,
              name: true,
              productCode: true,
            },
          },
        },
      },
      store: true,
      shop: true,
    },
  });

  console.log('Retrieved stock correction:', {
    id: stockCorrection?.id,
    status: stockCorrection?.status,
    storeId: stockCorrection?.storeId,
    shopId: stockCorrection?.shopId,
    itemsCount: stockCorrection?.items?.length,
    productNames: stockCorrection?.items?.map((item) => item.product?.name),
  });

  if (!stockCorrection) {
    console.error('Stock correction not found');
    throw new ApiError(httpStatus.NOT_FOUND, 'Stock correction not found');
  }

  if (stockCorrection.status !== 'PENDING') {
    console.error(
      'Stock correction already processed:',
      stockCorrection.status,
    );
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Stock correction is already ${stockCorrection.status.toLowerCase()}`,
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    console.log('Transaction started');

    // Get all unit of measures for the stock correction items
    const unitOfMeasureIds = stockCorrection.items.map(
      (item) => item.unitOfMeasureId,
    );
    console.log('Unit of measure IDs:', unitOfMeasureIds);

    const unitOfMeasures = await tx.unitOfMeasure.findMany({
      where: { id: { in: unitOfMeasureIds } },
    });
    console.log('Found unit of measures:', unitOfMeasures.length);

    const unitOfMeasureMap = unitOfMeasures.reduce((acc, uom) => {
      acc[uom.id] = uom;
      return acc;
    }, {});
    console.log(
      'Unit of measure map created:',
      Object.keys(unitOfMeasureMap).length,
    );

    // Check for negative stock BEFORE processing
    const insufficientStockItems = [];

    console.log('Starting stock availability check...');

    // Get all product details for better error messages
    const productIds = stockCorrection.items.map((item) => item.productId);
    const products = await tx.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, productCode: true },
    });

    const productMap = products.reduce((acc, product) => {
      acc[product.id] = product;
      return acc;
    }, {});

    // For each item, check if there's enough stock for subtractions
    for (const item of stockCorrection.items) {
      const product = productMap[item.productId];
      const productName = product?.name || `Product ID: ${item.productId}`;
      const productCode = product?.productCode
        ? ` (${product.productCode})`
        : '';

      console.log('Checking item:', {
        itemId: item.id,
        productId: item.productId,
        productName,
        batchId: item.batchId,
        quantity: item.quantity,
      });

      const quantityToUse = item.quantity;

      // Only need to check for negative quantities (subtractions)
      if (quantityToUse < 0) {
        const absoluteQuantity = Math.abs(quantityToUse);
        console.log(
          `Item "${productName}" requires subtraction, checking stock availability. Required:`,
          absoluteQuantity,
        );

        if (stockCorrection.storeId) {
          console.log(
            'Checking store stock for store:',
            stockCorrection.storeId,
          );

          const storeStock = await tx.storeStock.findFirst({
            where: {
              storeId: stockCorrection.storeId,
              batchId: item.batchId || 'no-batch',
            },
            include: {
              batch: {
                include: {
                  product: {
                    select: { name: true, productCode: true },
                  },
                },
              },
            },
          });

          console.log('Store stock query result:', storeStock);

          const currentStock = storeStock?.quantity || 0;
          console.log(
            `Current stock for "${productName}":`,
            currentStock,
            'Required:',
            absoluteQuantity,
          );

          if (currentStock < absoluteQuantity) {
            console.error(`Insufficient store stock for "${productName}"!`);
            insufficientStockItems.push({
              productId: item.productId,
              productName,
              productCode: product?.productCode,
              batchId: item.batchId,
              required: absoluteQuantity,
              available: currentStock,
              location: 'store',
              locationId: stockCorrection.storeId,
              locationName: stockCorrection.store?.name || 'Store',
            });
          }
        } else if (stockCorrection.shopId) {
          console.log('Checking shop stock for shop:', stockCorrection.shopId);

          const shopStock = await tx.shopStock.findFirst({
            where: {
              shopId: stockCorrection.shopId,
              batchId: item.batchId || 'no-batch',
            },
            include: {
              batch: {
                include: {
                  product: {
                    select: { name: true, productCode: true },
                  },
                },
              },
            },
          });

          console.log('Shop stock query result:', shopStock);

          const currentStock = shopStock?.quantity || 0;
          console.log(
            `Current stock for "${productName}":`,
            currentStock,
            'Required:',
            absoluteQuantity,
          );

          if (currentStock < absoluteQuantity) {
            console.error(`Insufficient shop stock for "${productName}"!`);
            insufficientStockItems.push({
              productId: item.productId,
              productName,
              productCode: product?.productCode,
              batchId: item.batchId,
              required: absoluteQuantity,
              available: currentStock,
              location: 'shop',
              locationId: stockCorrection.shopId,
              locationName: stockCorrection.shop?.name || 'Shop',
            });
          }
        }
      } else {
        console.log(
          `Item "${productName}" is addition or zero, no stock check needed`,
        );
      }
    }

    // If there are insufficient stock items, throw an error with product names
    if (insufficientStockItems.length > 0) {
      console.error('Insufficient stock items found:', insufficientStockItems);

      // Create detailed error message with product names
      const errorDetails = insufficientStockItems
        .map((item) => {
          const location =
            item.location === 'store'
              ? stockCorrection.store?.name || 'Store'
              : stockCorrection.shop?.name || 'Shop';

          const batchInfo = item.batchId ? `Batch: ${item.batchId}` : '';
          const productInfo = `${item.productName}${
            item.productCode ? ` (${item.productCode})` : ''
          }`;

          return `${productInfo} at ${location}: Required ${item.required}, Available ${item.available} ${batchInfo}`;
        })
        .join('; ');

      const errorMessage =
        insufficientStockItems.length === 1
          ? `Insufficient stock: ${errorDetails}`
          : `Insufficient stock for multiple items: ${errorDetails}`;

      throw new ApiError(httpStatus.BAD_REQUEST, errorMessage);
    }

    console.log(
      'Stock availability check passed, proceeding with operations...',
    );

    // Prepare all operations for each stock correction item
    const operations = stockCorrection.items.map((item, index) => {
      const product = productMap[item.productId];
      const productName = product?.name || `Product ID: ${item.productId}`;

      console.log(
        `Preparing operations for item ${index + 1} - "${productName}":`,
        {
          productId: item.productId,
          batchId: item.batchId,
          quantity: item.quantity,
        },
      );

      const unitOfMeasure = unitOfMeasureMap[item.unitOfMeasureId];

      if (!unitOfMeasure) {
        console.error(
          `Unit of measure not found for item ${item.id}:`,
          item.unitOfMeasureId,
        );
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          `Unit of measure not found for "${productName}"`,
        );
      }

      const quantityToUse = item.quantity;
      const isAddition = quantityToUse > 0;
      const movementType = isAddition ? 'IN' : 'OUT';
      const absoluteQuantity = Math.abs(quantityToUse);
      const notes = isAddition
        ? `Stock addition for "${productName}": ${stockCorrection.reason.toLowerCase()}`
        : `Stock subtraction for "${productName}": ${stockCorrection.reason.toLowerCase()}`;

      console.log(`Item "${productName}" operation details:`, {
        isAddition,
        movementType,
        absoluteQuantity,
        notes,
      });

      const itemOperations = [];

      // Update stock based on location (store or shop)
      if (stockCorrection.storeId) {
        console.log(
          `Creating store stock operation for "${productName}" at store: ${stockCorrection.storeId}`,
        );
        itemOperations.push(
          tx.storeStock.upsert({
            where: {
              storeId_batchId: {
                storeId: stockCorrection.storeId,
                batchId: item.batchId || 'no-batch',
              },
            },
            update: {
              quantity: isAddition
                ? { increment: absoluteQuantity }
                : { decrement: absoluteQuantity },
            },
            create: {
              storeId: stockCorrection.storeId,
              batchId: item.batchId || 'no-batch',
              quantity: isAddition ? absoluteQuantity : -absoluteQuantity,
              unitOfMeasureId: item.unitOfMeasureId,
              status: 'Available',
            },
          }),
        );
      } else if (stockCorrection.shopId) {
        console.log(
          `Creating shop stock operation for "${productName}" at shop: ${stockCorrection.shopId}`,
        );
        itemOperations.push(
          tx.shopStock.upsert({
            where: {
              shopId_batchId: {
                shopId: stockCorrection.shopId,
                batchId: item.batchId || 'no-batch',
              },
            },
            update: {
              quantity: isAddition
                ? { increment: absoluteQuantity }
                : { decrement: absoluteQuantity },
            },
            create: {
              shopId: stockCorrection.shopId,
              batchId: item.batchId || 'no-batch',
              quantity: isAddition ? absoluteQuantity : -absoluteQuantity,
              unitOfMeasureId: item.unitOfMeasureId,
              status: 'Available',
            },
          }),
        );
      }

      // Create stock ledger entry with product context
      if (stockCorrection.storeId) {
        console.log(
          `Creating stock ledger for "${productName}" at store: ${stockCorrection.storeId}`,
        );

        // Generate unique invoice number with timestamp and index
        const now = new Date();
        const timestamp = now.getTime(); // Unix timestamp
        const dateStr = now.toISOString().replace(/[-:]/g, '').split('.')[0]; // YYYYMMDDTHHMMSS format
        const uniqueInvoiceNo = `${
          stockCorrection.shortCode || 'SC'
        }-${dateStr}-${index + 1}`;

        itemOperations.push(
          tx.stockLedger.create({
            data: {
              batchId: item.batchId,
              storeId: stockCorrection.storeId,
              invoiceNo: uniqueInvoiceNo,
              movementType,
              quantity: absoluteQuantity,
              unitOfMeasureId: item.unitOfMeasureId,
              reference:
                stockCorrection.reference ||
                `STOCK-CORRECTION-${stockCorrection.reason}`,
              userId,
              notes: `${notes} (${productName})`,
              movementDate: now,
            },
          }),
        );
      } else if (stockCorrection.shopId) {
        // Generate unique invoice number with timestamp and index
        const now = new Date();
        const dateStr = now.toISOString().replace(/[-:]/g, '').split('.')[0]; // YYYYMMDDTHHMMSS format
        const uniqueInvoiceNo = `${
          stockCorrection.shortCode || 'SC'
        }-${dateStr}-${index + 1}`;

        itemOperations.push(
          tx.stockLedger.create({
            data: {
              batchId: item.batchId,
              invoiceNo: uniqueInvoiceNo,
              shopId: stockCorrection.shopId,
              movementType,
              quantity: absoluteQuantity,
              unitOfMeasureId: item.unitOfMeasureId,
              reference:
                stockCorrection.reference ||
                `SHOP-CORRECTION-${stockCorrection.reason}`,
              userId,
              notes: `${notes} (${productName})`,
              movementDate: now,
            },
          }),
        );
      }

      console.log(
        `Item "${productName}" operations prepared:`,
        itemOperations.length,
      );
      return itemOperations;
    });

    // Flatten all operations and execute them in parallel
    const allOperations = operations.flat();
    console.log(`Executing ${allOperations.length} operations in parallel...`);

    try {
      const operationResults = await Promise.all(allOperations);
      console.log(
        'All operations completed successfully:',
        operationResults.length,
      );
    } catch (error) {
      console.error('Error executing operations:', error);
      throw error;
    }

    // Update stock correction status to APPROVED
    console.log('Updating stock correction status to APPROVED...');
    const updatedStockCorrection = await tx.stockCorrection.update({
      where: { id: stockCorrectionId },
      data: {
        status: 'APPROVED',
        updatedById: userId,
      },
    });

    // Create log entry with product details
    const productNames = stockCorrection.items
      .map((item) => {
        const product = productMap[item.productId];
        return product?.name || `Product ID: ${item.productId}`;
      })
      .join(', ');

    console.log('Creating log entry...');
    await tx.log.create({
      data: {
        action: `Approved stock correction ${
          stockCorrection.reference || stockCorrection.id
        } for products: ${productNames}`,
        userId,
      },
    });

    console.log('Transaction completed successfully');
    return updatedStockCorrection;
  });

  console.log('Stock correction approved successfully');
  return result;
};

// Reject StockCorrection
const rejectStockCorrection = async (stockCorrectionId, userId) => {
  const stockCorrection = await getStockCorrectionById(stockCorrectionId);

  if (!stockCorrection) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Stock correction not found');
  }

  if (stockCorrection.status !== 'PENDING') {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Cannot reject ${stockCorrection.status.toLowerCase()} stock correction`,
    );
  }

  const updatedStockCorrection = await prisma.stockCorrection.update({
    where: { id: stockCorrectionId },
    data: {
      status: 'REJECTED',
      updatedById: userId,
    },
  });

  // Create log entry
  await prisma.log.create({
    data: {
      action: `Rejected stock correction ${
        stockCorrection.reference || stockCorrection.id
      }`,
      userId,
    },
  });

  return updatedStockCorrection;
};

module.exports = {
  getStockCorrectionById,
  getStockCorrectionByReference,
  getAllStockCorrections,
  createStockCorrection,
  updateStockCorrection,
  deleteStockCorrection,
  approveStockCorrection,
  rejectStockCorrection,
  getStockCorrectionsByPurchaseId,
};
