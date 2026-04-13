const httpStatus = require('http-status');
const { subMonths } = require('date-fns');

const ApiError = require('../utils/ApiError');
const prisma = require('./prisma');

// Get Transfer by ID
const getTransferById = async (id) => {
  const transfer = await prisma.transfer.findUnique({
    where: { id },
    include: {
      sourceStore: true,
      sourceShop: true,
      destStore: true,
      destShop: true,
      createdBy: true,
      updatedBy: true,
      items: {
        include: {
          product: true,
        },
      },
    },
  });
  return transfer;
};
// Get product batch info by transfer ID

const getTransferBatchesById = async (transferId) => {
  try {
    // Fetch transfer with batch and their additional prices
    const transfer = await prisma.transfer.findUnique({
      where: { id: transferId },
      include: {
        items: {
          select: {
            batch: {
              include: {
                AdditionalPrice: {
                  include: {
                    shop: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                  },
                },
                product: {
                  select: {
                    name: true,
                    productCode: true,
                  },
                },
                store: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
    });

    if (!transfer) {
      throw new Error('Transfer not found');
    }

    // Map batches with additional price info
    const batches = transfer.items.map((item) => {
      const { batch } = item;
      return {
        id: batch.id,
        batchNumber: batch.batchNumber,
        product: batch.product,
        store: batch.store,
        additionalPrices: batch.AdditionalPrice.map((p) => ({
          label: p.label,
          price: p.price,
          shop: {
            id: p.shop.id,
            name: p.shop.name,
          },
        })),
      };
    });

    return batches;
  } catch (error) {
    throw new Error(`Failed to get batches: ${error.message}`);
  }
};

// Get Transfer by reference
const getTransferByReference = async (reference) => {
  const transfer = await prisma.transfer.findFirst({
    where: { reference },
  });
  return transfer;
};

// Get all Transfers
const getAllTransfers = async ({ startDate, endDate } = {}) => {
  const whereClause = {};
  const threeMonthsAgo = subMonths(new Date(), 12); // Default time range

  // Convert string dates to Date objects if they exist
  const startDateObj = startDate ? new Date(startDate) : undefined;
  const endDateObj = endDate ? new Date(endDate) : undefined;

  // Build the date filter
  if (startDateObj && endDateObj) {
    whereClause.movementDate = {
      gte: startDateObj,
      lte: endDateObj,
    };
  } else if (startDateObj) {
    whereClause.movementDate = {
      gte: startDateObj,
      lte: new Date(),
    };
  } else if (endDateObj) {
    whereClause.movementDate = {
      gte: threeMonthsAgo,
      lte: endDateObj,
    };
  } else {
    whereClause.movementDate = {
      gte: threeMonthsAgo,
    };
  }

  const transfers = await prisma.transfer.findMany({
    where: whereClause,
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      sourceStore: true,
      sourceShop: true,
      destStore: true,
      destShop: true,
      createdBy: true,
      updatedBy: true,
      _count: {
        select: { items: true },
      },
    },
  });

  return {
    transfers,
    count: transfers.length,
  };
};

// Create Transfer
const generateShortCode = async () => {
  const prefix = 'TRF';
  const year = new Date().getFullYear().toString().slice(-2);
  const month = (new Date().getMonth() + 1).toString().padStart(2, '0');

  // Find the latest transfer for this month/year to get the sequence number
  const latestTransfer = await prisma.transfer.findFirst({
    where: {
      shortCode: {
        startsWith: `${prefix}${year}${month}`,
      },
    },
    orderBy: {
      shortCode: 'desc',
    },
    select: {
      shortCode: true,
    },
  });

  let sequence = 1;
  if (latestTransfer && latestTransfer.shortCode) {
    const lastCode = latestTransfer.shortCode;
    const lastSequence = parseInt(lastCode.slice(-4), 10);
    if (!Number.isNaN(lastSequence)) {
      sequence = lastSequence + 1;
    }
  }

  const sequenceStr = sequence.toString().padStart(4, '0');
  return `${prefix}${year}${month}${sequenceStr}`;
};

const createTransfer = async (transferBody, userId) => {
  // Generate short code first
  const shortCode = await generateShortCode();

  // Check if reference already exists
  if (
    transferBody.reference &&
    (await getTransferByReference(transferBody.reference))
  ) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Transfer reference already taken',
    );
  }

  // Parse items if it's a string
  const { items: itemsString, ...restTransferBody } = transferBody;
  const items =
    typeof itemsString === 'string' ? JSON.parse(itemsString) : itemsString;

  // Validate items
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Transfer must have at least one item',
    );
  }

  // Validate individual item properties
  items.forEach((item, index) => {
    if (!item.productId) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Item ${index + 1} is missing required fields (productId)`,
      );
    }
    if (item.quantity <= 0) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Item ${index + 1} has invalid quantity`,
      );
    }
    // Validate isBox if provided (should be boolean)
    if (item.isBox !== undefined && typeof item.isBox !== 'boolean') {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Item ${index + 1} has invalid isBox value (must be boolean)`,
      );
    }
  });

  // Process items with isBox and calculate piece quantities for validation
  const validatedItems = items.map((item) => ({
    ...item,
    isBox: item.isBox || false, // Default to false if not provided
  }));

  // Clean up empty string values
  const cleanedTransferBody = {
    ...restTransferBody,
    shortCode, // Add the generated short code
    sourceStoreId:
      restTransferBody.sourceStoreId === ''
        ? null
        : restTransferBody.sourceStoreId,
    sourceShopId:
      restTransferBody.sourceShopId === ''
        ? null
        : restTransferBody.sourceShopId,
    destStoreId:
      restTransferBody.destStoreId === '' ? null : restTransferBody.destStoreId,
    destShopId:
      restTransferBody.destShopId === '' ? null : restTransferBody.destShopId,
  };

  // Validate source and destination
  if (
    cleanedTransferBody.sourceType === 'STORE' &&
    !cleanedTransferBody.sourceStoreId
  ) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Source store ID is required');
  }

  if (
    cleanedTransferBody.sourceType === 'SHOP' &&
    !cleanedTransferBody.sourceShopId
  ) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Source shop ID is required');
  }

  if (
    cleanedTransferBody.destinationType === 'STORE' &&
    !cleanedTransferBody.destStoreId
  ) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Destination store ID is required',
    );
  }

  if (
    cleanedTransferBody.destinationType === 'SHOP' &&
    !cleanedTransferBody.destShopId
  ) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Destination shop ID is required',
    );
  }

  // Check if source and destination are different
  if (
    (cleanedTransferBody.sourceType === 'STORE' &&
      cleanedTransferBody.destinationType === 'STORE' &&
      cleanedTransferBody.sourceStoreId === cleanedTransferBody.destStoreId) ||
    (cleanedTransferBody.sourceType === 'SHOP' &&
      cleanedTransferBody.destinationType === 'SHOP' &&
      cleanedTransferBody.sourceShopId === cleanedTransferBody.destShopId)
  ) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Source and destination cannot be the same',
    );
  }

  // Create the transfer
  const transfer = await prisma.transfer.create({
    data: {
      ...cleanedTransferBody,
      createdById: userId,
      items: {
        create: validatedItems.map((item) => ({
          productId: item.productId,
          isBox: item.isBox, // Add isBox field
          quantity: item.quantity,
        })),
      },
    },
    include: {
      items: {
        include: {
          product: true,
        },
      },
      sourceStore: true,
      sourceShop: true,
      destStore: true,
      destShop: true,
      createdBy: true,
    },
  });

  return transfer;
};

// Update Transfer
const updateTransfer = async (transferId, transferBody, userId) => {
  // Check if transfer exists
  const existingTransfer = await getTransferById(transferId);
  if (!existingTransfer) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Transfer not found');
  }
  if (existingTransfer.createdById !== userId) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      'Only the creator can update this transfer',
    );
  }
  // Cannot update completed or cancelled transfers
  if (existingTransfer.status !== 'PENDING') {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Cannot update ${existingTransfer.status.toLowerCase()} transfer`,
    );
  }

  // Check if reference already exists (excluding current transfer)
  if (
    transferBody.reference &&
    transferBody.reference !== existingTransfer.reference
  ) {
    if (await getTransferByReference(transferBody.reference)) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Transfer reference already taken',
      );
    }
  }

  // Parse items if it's a string
  const { items: itemsString, ...restTransferBody } = transferBody;
  const items =
    typeof itemsString === 'string' ? JSON.parse(itemsString) : itemsString;

  // Validate items
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Transfer must have at least one item',
    );
  }

  // Validate individual item properties
  items.forEach((item, index) => {
    if (!item.productId) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Item ${index + 1} is missing required fields (productId)`,
      );
    }
    if (item.quantity <= 0) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Item ${index + 1} has invalid quantity`,
      );
    }
    // Validate isBox if provided (should be boolean)
    if (item.isBox !== undefined && typeof item.isBox !== 'boolean') {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Item ${index + 1} has invalid isBox value (must be boolean)`,
      );
    }
  });

  // Process items with isBox
  const validatedItems = items.map((item) => ({
    ...item,
    isBox: item.isBox || false, // Default to false if not provided
  }));

  // Clean up empty string values
  const cleanedTransferBody = {
    ...restTransferBody,
    sourceStoreId:
      restTransferBody.sourceStoreId === ''
        ? null
        : restTransferBody.sourceStoreId,
    sourceShopId:
      restTransferBody.sourceShopId === ''
        ? null
        : restTransferBody.sourceShopId,
    destStoreId:
      restTransferBody.destStoreId === '' ? null : restTransferBody.destStoreId,
    destShopId:
      restTransferBody.destShopId === '' ? null : restTransferBody.destShopId,
  };

  // Validate source and destination
  if (
    cleanedTransferBody.sourceType === 'STORE' &&
    !cleanedTransferBody.sourceStoreId
  ) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Source store ID is required');
  }

  if (
    cleanedTransferBody.sourceType === 'SHOP' &&
    !cleanedTransferBody.sourceShopId
  ) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Source shop ID is required');
  }

  if (
    cleanedTransferBody.destinationType === 'STORE' &&
    !cleanedTransferBody.destStoreId
  ) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Destination store ID is required',
    );
  }

  if (
    cleanedTransferBody.destinationType === 'SHOP' &&
    !cleanedTransferBody.destShopId
  ) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Destination shop ID is required',
    );
  }

  // Check if source and destination are different
  if (
    (cleanedTransferBody.sourceType === 'STORE' &&
      cleanedTransferBody.destinationType === 'STORE' &&
      cleanedTransferBody.sourceStoreId === cleanedTransferBody.destStoreId) ||
    (cleanedTransferBody.sourceType === 'SHOP' &&
      cleanedTransferBody.destinationType === 'SHOP' &&
      cleanedTransferBody.sourceShopId === cleanedTransferBody.destShopId)
  ) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Source and destination cannot be the same',
    );
  }

  // Update the transfer inside a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Delete all existing items
    await tx.transferItem.deleteMany({
      where: { transferId },
    });

    // Update transfer with cleaned body and new items
    const transfer = await tx.transfer.update({
      where: { id: transferId },
      data: {
        ...cleanedTransferBody,
        items: {
          create: validatedItems.map((item) => ({
            productId: item.productId,
            isBox: item.isBox, // Add isBox field
            quantity: item.quantity,
          })),
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        sourceStore: true,
        sourceShop: true,
        destStore: true,
        destShop: true,
        createdBy: true,
      },
    });

    return transfer;
  });

  return result;
};

// Delete Transfer
const deleteTransfer = async (id, userId) => {
  const existingTransfer = await getTransferById(id);
  if (!existingTransfer) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Transfer not found');
  }

  const result = await prisma.$transaction(async (tx) => {
    // Check if transfer is completed (has stock ledger entries)
    const ledgerEntries = await tx.stockLedger.findMany({
      where: {
        reference: `TRANSFER-${existingTransfer.shortCode}`,
      },
    });

    const isCompleted = ledgerEntries.length > 0;

    if (isCompleted) {
      // Reverse all stock operations for completed transfer
      await Promise.all(
        existingTransfer.items.map(async (item, index) => {
          const operations = [];
          const sourceInvoiceNo = `${existingTransfer.shortCode}-OUT-${index}`;
          const destinationInvoiceNo = `${existingTransfer.shortCode}-IN-${index}`;

          // Reverse source operations (add back stock to source)
          if (
            existingTransfer.sourceType === 'STORE' &&
            existingTransfer.sourceStoreId
          ) {
            operations.push(
              tx.storeStock.update({
                where: {
                  storeId_batchId: {
                    storeId: existingTransfer.sourceStoreId,
                    batchId: item.batchId,
                  },
                },
                data: {
                  quantity: { increment: item.quantity },
                },
              }),
              tx.stockLedger.create({
                data: {
                  storeId: existingTransfer.sourceStoreId,
                  invoiceNo: `REV-${sourceInvoiceNo}`,
                  movementType: 'IN',
                  quantity: item.quantity,

                  reference: `TRANSFER-REVERSAL-${existingTransfer.shortCode}`,
                  userId,
                  notes: `Transfer reversal - stock returned from ${existingTransfer.destinationType.toLowerCase()}`,
                  movementDate: new Date(),
                },
              }),
            );
          } else if (
            existingTransfer.sourceType === 'SHOP' &&
            existingTransfer.sourceShopId
          ) {
            operations.push(
              tx.shopStock.update({
                where: {
                  shopId_batchId: {
                    shopId: existingTransfer.sourceShopId,
                    batchId: item.batchId,
                  },
                },
                data: {
                  quantity: { increment: item.quantity },
                },
              }),
              tx.stockLedger.create({
                data: {
                  invoiceNo: `REV-${sourceInvoiceNo}`,
                  shopId: existingTransfer.sourceShopId,
                  movementType: 'IN',
                  quantity: item.quantity,
                  reference: `TRANSFER-REVERSAL-${existingTransfer.shortCode}`,
                  userId,
                  notes: `Transfer reversal - stock returned from ${existingTransfer.destinationType.toLowerCase()}`,
                  movementDate: new Date(),
                },
              }),
            );
          }

          // Reverse destination operations (remove stock from destination)
          if (
            existingTransfer.destinationType === 'STORE' &&
            existingTransfer.destStoreId
          ) {
            const existingStoreStock = await tx.storeStock.findUnique({
              where: {
                storeId_batchId: {
                  storeId: existingTransfer.destStoreId,
                  batchId: item.batchId,
                },
              },
            });

            if (existingStoreStock) {
              const newQuantity = existingStoreStock.quantity - item.quantity;

              if (newQuantity <= 0) {
                // Delete if quantity becomes 0 or negative
                operations.push(
                  tx.storeStock.delete({
                    where: {
                      storeId_batchId: {
                        storeId: existingTransfer.destStoreId,
                        batchId: item.batchId,
                      },
                    },
                  }),
                );
              } else {
                // Update quantity
                operations.push(
                  tx.storeStock.update({
                    where: {
                      storeId_batchId: {
                        storeId: existingTransfer.destStoreId,
                        batchId: item.batchId,
                      },
                    },
                    data: {
                      quantity: { decrement: item.quantity },
                    },
                  }),
                );
              }
            }

            operations.push(
              tx.stockLedger.create({
                data: {
                  invoiceNo: `REV-${destinationInvoiceNo}`,
                  storeId: existingTransfer.destStoreId,
                  movementType: 'OUT',
                  quantity: item.quantity,
                  reference: `TRANSFER-REVERSAL-${existingTransfer.shortCode}`,
                  userId,
                  notes: `Transfer reversal - stock returned to ${existingTransfer.sourceType.toLowerCase()}`,
                  movementDate: new Date(),
                },
              }),
            );
          } else if (
            existingTransfer.destinationType === 'SHOP' &&
            existingTransfer.destShopId
          ) {
            const existingShopStock = await tx.shopStock.findUnique({
              where: {
                shopId_batchId: {
                  shopId: existingTransfer.destShopId,
                  batchId: item.batchId,
                },
              },
            });

            if (existingShopStock) {
              const newQuantity = existingShopStock.quantity - item.quantity;

              if (newQuantity <= 0) {
                // Delete if quantity becomes 0 or negative
                operations.push(
                  tx.shopStock.delete({
                    where: {
                      shopId_batchId: {
                        shopId: existingTransfer.destShopId,
                        batchId: item.batchId,
                      },
                    },
                  }),
                );
              } else {
                // Update quantity
                operations.push(
                  tx.shopStock.update({
                    where: {
                      shopId_batchId: {
                        shopId: existingTransfer.destShopId,
                        batchId: item.batchId,
                      },
                    },
                    data: {
                      quantity: { decrement: item.quantity },
                    },
                  }),
                );
              }
            }

            operations.push(
              tx.stockLedger.create({
                data: {
                  invoiceNo: `REV-${destinationInvoiceNo}`,
                  shopId: existingTransfer.destShopId,
                  movementType: 'OUT',
                  quantity: item.quantity,
                  reference: `TRANSFER-REVERSAL-${existingTransfer.shortCode}`,
                  userId,
                  notes: `Transfer reversal - stock returned to ${existingTransfer.sourceType.toLowerCase()}`,
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
          reference: `TRANSFER-${existingTransfer.shortCode}`,
        },
      });
    }

    // Delete all transfer items
    await tx.transferItem.deleteMany({
      where: { transferId: id },
    });

    // Delete the transfer
    await tx.transfer.delete({
      where: { id },
    });

    // Create log entry
    await tx.log.create({
      data: {
        action: `Deleted transfer ${existingTransfer.shortCode}${
          isCompleted ? ' and reversed stock transactions' : ''
        }`,
        userId,
      },
    });

    return {
      message: `Transfer deleted successfully${
        isCompleted ? ' and stock transactions reversed' : ''
      }`,
      stockReversed: isCompleted,
    };
  });

  return result;
};

// Complete Transfer
const completeTransfer = async (transferId, userId) => {
  const transfer = await getTransferById(transferId);

  if (!transfer) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Transfer not found');
  }

  if (transfer.status !== 'PENDING') {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Transfer is already ${transfer.status.toLowerCase()}`,
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    // Get all products with their box support info
    const productIds = transfer.items.map((item) => item.productId);
    const products = await tx.product.findMany({
      where: {
        id: { in: productIds },
      },
      select: {
        id: true,
        name: true,
        hasBox: true,
        boxSize: true,
      },
    });

    const productMap = {};
    products.forEach((product) => {
      productMap[product.id] = product;
    });

    // Prepare all operations for each transfer item
    const sourceOperations = [];
    const destinationOperations = [];
    const stockLedgerOperations = [];

    for (let index = 0; index < transfer.items.length; index++) {
      const item = transfer.items[index];
      const product = productMap[item.productId];

      if (!product) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          `Product not found for item ${item.id}`,
        );
      }

      // Calculate piece quantity based on isBox flag
      let pieceQuantity = item.quantity;

      if (item.isBox) {
        // If isBox is true, convert boxes to pieces using product's boxSize
        if (!product.hasBox) {
          throw new ApiError(
            httpStatus.BAD_REQUEST,
            `Product "${product.name}" does not support box/packaging. Please enable box support for this product.`,
          );
        }

        if (!product.boxSize || product.boxSize <= 0) {
          throw new ApiError(
            httpStatus.BAD_REQUEST,
            `Product "${product.name}" has invalid box size (${product.boxSize}). Please configure box size correctly.`,
          );
        }

        pieceQuantity = item.quantity * product.boxSize;

        console.log(`📦 Product: ${product.name}`);
        console.log(`   Transfer quantity: ${item.quantity} box(es)`);
        console.log(`   Box size: ${product.boxSize} pieces/box`);
        console.log(`   Total pieces: ${pieceQuantity}`);
        console.log(
          `   Calculation: ${item.quantity} × ${product.boxSize} = ${pieceQuantity}`,
        );
      } else {
        pieceQuantity = item.quantity;
        console.log(`📦 Product: ${product.name}`);
        console.log(`   Transfer quantity: ${item.quantity} piece(s)`);
        console.log(`   Total pieces: ${pieceQuantity}`);
      }

      // Validate piece quantity is positive
      if (pieceQuantity <= 0) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          `Invalid quantity for product "${product.name}". Quantity must be greater than 0.`,
        );
      }

      // Create unique invoice numbers for each ledger entry
      const sourceInvoiceNo = `${transfer.shortCode}-OUT-${index}`;
      const destinationInvoiceNo = `${transfer.shortCode}-IN-${index}`;

      // ========== SOURCE OPERATIONS (Remove stock) ==========
      if (transfer.sourceType === 'STORE' && transfer.sourceStoreId) {
        // Get current source stock
        const sourceStock = await tx.storeStock.findUnique({
          where: {
            storeId_productId: {
              storeId: transfer.sourceStoreId,
              productId: item.productId,
            },
          },
        });

        if (!sourceStock) {
          throw new ApiError(
            httpStatus.BAD_REQUEST,
            `Product "${product.name}" not found in source store stock`,
          );
        }

        if (sourceStock.quantity < pieceQuantity) {
          throw new ApiError(
            httpStatus.BAD_REQUEST,
            `Insufficient stock for product "${product.name}". Available: ${sourceStock.quantity} pieces, Requested: ${pieceQuantity} pieces`,
          );
        }

        const newSourceQuantity = sourceStock.quantity - pieceQuantity;
        console.log(`   Source store current: ${sourceStock.quantity} pieces`);
        console.log(
          `   Source store after removal: ${newSourceQuantity} pieces`,
        );

        sourceOperations.push(
          tx.storeStock.update({
            where: {
              storeId_productId: {
                storeId: transfer.sourceStoreId,
                productId: item.productId,
              },
            },
            data: {
              quantity: { decrement: pieceQuantity },
            },
          }),
        );

        stockLedgerOperations.push(
          tx.stockLedger.create({
            data: {
              productId: item.productId,
              storeId: transfer.sourceStoreId,
              movementType: 'TRANSFER',
              pieceQuantity,
              boxQuantity: item.isBox ? item.quantity : 0,
              reference: transfer.reference || `TRANSFER-${transfer.shortCode}`,
              userId,
              notes: item.isBox
                ? `Transfer OUT - ${transfer.shortCode} (${item.quantity} box(es) × ${product.boxSize} = ${pieceQuantity} pieces)`
                : `Transfer OUT - ${transfer.shortCode} (${item.quantity} piece(s))`,
              movementDate: new Date(),
            },
          }),
        );
      } else if (transfer.sourceType === 'SHOP' && transfer.sourceShopId) {
        // Get current source stock
        const sourceStock = await tx.shopStock.findUnique({
          where: {
            shopId_productId: {
              shopId: transfer.sourceShopId,
              productId: item.productId,
            },
          },
        });

        if (!sourceStock) {
          throw new ApiError(
            httpStatus.BAD_REQUEST,
            `Product "${product.name}" not found in source shop stock`,
          );
        }

        if (sourceStock.quantity < pieceQuantity) {
          throw new ApiError(
            httpStatus.BAD_REQUEST,
            `Insufficient stock for product "${product.name}". Available: ${sourceStock.quantity} pieces, Requested: ${pieceQuantity} pieces`,
          );
        }

        const newSourceQuantity = sourceStock.quantity - pieceQuantity;
        console.log(`   Source shop current: ${sourceStock.quantity} pieces`);
        console.log(
          `   Source shop after removal: ${newSourceQuantity} pieces`,
        );

        sourceOperations.push(
          tx.shopStock.update({
            where: {
              shopId_productId: {
                shopId: transfer.sourceShopId,
                productId: item.productId,
              },
            },
            data: {
              quantity: { decrement: pieceQuantity },
            },
          }),
        );

        stockLedgerOperations.push(
          tx.stockLedger.create({
            data: {
              productId: item.productId,
              shopId: transfer.sourceShopId,
              movementType: 'TRANSFER',
              pieceQuantity,
              boxQuantity: item.isBox ? item.quantity : 0,
              reference: transfer.reference || `TRANSFER-${transfer.shortCode}`,
              userId,
              notes: item.isBox
                ? `Transfer OUT - ${transfer.shortCode} (${item.quantity} box(es) × ${product.boxSize} = ${pieceQuantity} pieces)`
                : `Transfer OUT - ${transfer.shortCode} (${item.quantity} piece(s))`,
              movementDate: new Date(),
            },
          }),
        );
      }

      // ========== DESTINATION OPERATIONS (Add stock) ==========
      if (transfer.destinationType === 'STORE' && transfer.destStoreId) {
        destinationOperations.push(
          tx.storeStock.upsert({
            where: {
              storeId_productId: {
                storeId: transfer.destStoreId,
                productId: item.productId,
              },
            },
            update: {
              quantity: { increment: pieceQuantity },
            },
            create: {
              storeId: transfer.destStoreId,
              productId: item.productId,
              quantity: pieceQuantity,
              status: 'Available',
            },
          }),
        );

        stockLedgerOperations.push(
          tx.stockLedger.create({
            data: {
              productId: item.productId,
              storeId: transfer.destStoreId,
              movementType: 'TRANSFER',
              pieceQuantity,
              boxQuantity: item.isBox ? item.quantity : 0,
              reference: transfer.reference || `TRANSFER-${transfer.shortCode}`,
              userId,
              notes: item.isBox
                ? `Transfer IN - ${transfer.shortCode} (${item.quantity} box(es) × ${product.boxSize} = ${pieceQuantity} pieces)`
                : `Transfer IN - ${transfer.shortCode} (${item.quantity} piece(s))`,
              movementDate: new Date(),
            },
          }),
        );
      } else if (transfer.destinationType === 'SHOP' && transfer.destShopId) {
        destinationOperations.push(
          tx.shopStock.upsert({
            where: {
              shopId_productId: {
                shopId: transfer.destShopId,
                productId: item.productId,
              },
            },
            update: {
              quantity: { increment: pieceQuantity },
            },
            create: {
              shopId: transfer.destShopId,
              productId: item.productId,
              quantity: pieceQuantity,
              status: 'Available',
            },
          }),
        );

        stockLedgerOperations.push(
          tx.stockLedger.create({
            data: {
              productId: item.productId,
              shopId: transfer.destShopId,
              movementType: 'TRANSFER',
              pieceQuantity,
              boxQuantity: item.isBox ? item.quantity : 0,
              reference: transfer.reference || `TRANSFER-${transfer.shortCode}`,
              userId,
              notes: item.isBox
                ? `Transfer IN - ${transfer.shortCode} (${item.quantity} box(es) × ${product.boxSize} = ${pieceQuantity} pieces)`
                : `Transfer IN - ${transfer.shortCode} (${item.quantity} piece(s))`,
              movementDate: new Date(),
            },
          }),
        );
      }

      console.log(`   ✅ Stock operations prepared`);
      console.log(`   ---`);
    }

    // Execute all operations in parallel
    await Promise.all([
      ...sourceOperations,
      ...destinationOperations,
      ...stockLedgerOperations,
    ]);

    // Calculate total pieces transferred
    let totalPiecesTransferred = 0;
    for (const item of transfer.items) {
      const product = productMap[item.productId];
      if (item.isBox) {
        totalPiecesTransferred += item.quantity * product.boxSize;
      } else {
        totalPiecesTransferred += item.quantity;
      }
    }

    console.log(`🎉 Transfer ${transfer.shortCode} completed successfully!`);
    console.log(`   Total pieces transferred: ${totalPiecesTransferred}`);

    // Update transfer status to COMPLETED
    const updatedTransfer = await tx.transfer.update({
      where: { id: transferId },
      data: {
        status: 'COMPLETED',
        updatedById: userId,
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        sourceStore: true,
        sourceShop: true,
        destStore: true,
        destShop: true,
        createdBy: true,
        updatedBy: true,
      },
    });

    // Create log entry
    await tx.log.create({
      data: {
        action: `Completed transfer ${
          transfer.reference || transfer.shortCode
        } with ${
          transfer.items.length
        } items. Total pieces transferred: ${totalPiecesTransferred}`,
        userId,
      },
    });

    return updatedTransfer;
  });

  return result;
};

// Cancel Transfer
const cancelTransfer = async (transferId, userId) => {
  const transfer = await getTransferById(transferId);

  if (!transfer) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Transfer not found');
  }

  if (transfer.status !== 'PENDING') {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Cannot cancel ${transfer.status.toLowerCase()} transfer`,
    );
  }

  const updatedTransfer = await prisma.transfer.update({
    where: { id: transferId },
    data: {
      status: 'CANCELLED',
      updatedById: userId,
    },
  });

  // Create log entry
  await prisma.log.create({
    data: {
      action: `Cancelled transfer ${transfer.reference || transfer.id}`,
      userId,
    },
  });

  return updatedTransfer;
};

const bulkUpdateAdditionalPrices = async (batchUpdates) => {
  try {
    const results = await prisma.$transaction(async (tx) => {
      // Process all additional prices in parallel
      const allResults = await Promise.all(
        batchUpdates.flatMap((item) =>
          item.additionalPrices.map(async (price) => {
            // First try to find if this price already exists
            const existingPrice = await tx.additionalPrice.findFirst({
              where: {
                batchId: item.batchId,
                label: price.label,
              },
            });

            if (existingPrice) {
              // Update existing price
              return tx.additionalPrice.update({
                where: { id: existingPrice.id },
                data: { price: price.price },
              });
            }
            // Create new price
            return tx.additionalPrice.create({
              data: {
                batchId: item.batchId,
                label: price.label,
                price: price.price,
              },
            });
          }),
        ),
      );

      // Fetch updated batches
      const updatedBatches = await tx.productBatch.findMany({
        where: {
          id: { in: batchUpdates.map((b) => b.batchId) },
        },
        include: {
          AdditionalPrice: true,
        },
      });

      return {
        totalProcessed: allResults.length,
        batches: updatedBatches,
      };
    });

    return results;
  } catch (error) {
    throw new Error(`Bulk update failed: ${error.message}`);
  }
};

module.exports = {
  getTransferById,
  getTransferByReference,
  getAllTransfers,
  createTransfer,
  updateTransfer,
  deleteTransfer,
  completeTransfer,
  cancelTransfer,
  bulkUpdateAdditionalPrices,
  getTransferBatchesById,
};
