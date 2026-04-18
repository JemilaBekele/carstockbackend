const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const prisma = require('./prisma');

// Get Purchase by ID
const getPurchaseById = async (id) => {
  const purchase = await prisma.purchase.findUnique({
    where: { id },
    include: {
      supplier: true,
      store: true,
      shop: true,
      createdBy: true,
      updatedBy: true,
      items: {
        include: {
          product: true,
        },
      },
    },
  });
  return purchase;
};

// Get Purchase by invoice number
const getPurchaseByInvoiceNo = async (invoiceNo) => {
  const purchase = await prisma.purchase.findFirst({
    where: { invoiceNo },
  });
  return purchase;
};

// Get all Purchases
const getAllPurchases = async (filter = {}) => {
  const { supplierId, storeId, paymentStatus, startDate, endDate, search } =
    filter;

  const where = {};

  if (supplierId) {
    where.supplierId = supplierId;
  }

  if (storeId) {
    where.storeId = storeId;
  }

  if (paymentStatus) {
    where.paymentStatus = paymentStatus;
  }

  if (startDate || endDate) {
    where.purchaseDate = {};
    if (startDate) {
      where.purchaseDate.gte = new Date(startDate);
    }
    if (endDate) {
      where.purchaseDate.lte = new Date(endDate);
    }
  }

  if (search) {
    where.OR = [
      { invoiceNo: { contains: search, mode: 'insensitive' } },
      { notes: { contains: search, mode: 'insensitive' } },
    ];
  }

  const purchases = await prisma.purchase.findMany({
    where,
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      supplier: true,
      store: true,
      _count: {
        select: { items: true },
      },
    },
  });

  return {
    purchases,
    count: purchases.length,
  };
};

// Create Purchase
const createPurchase = async (purchaseBody, userId) => {
  // If purchaseBody is a string, try to parse it as JSON
  const parsedBody = purchaseBody;

  // Now use parsedBody instead of purchaseBody
  const { items, ...restPurchaseBody } = parsedBody;

  // Check if invoice number already exists
  if (await getPurchaseByInvoiceNo(restPurchaseBody.invoiceNo)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invoice number already taken');
  }

  // Validate items
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Purchase must have at least one item',
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
    if (item.unitPrice < 0) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Item ${index + 1} has invalid unit price`,
      );
    }
    if (item.isBox !== undefined && typeof item.isBox !== 'boolean') {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Item ${index + 1} has invalid isBox value (must be boolean)`,
      );
    }
  });

  // Recalculate totalPrice
  const validatedItems = items.map((item) => ({
    ...item,
    isBox: item.isBox || false,
    totalPrice: item.quantity * item.unitPrice,
  }));

  // Convert purchaseDate
  const purchaseDate = new Date(restPurchaseBody.purchaseDate);
  if (Number.isNaN(purchaseDate.getTime())) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid purchase date');
  }

  // Calculate totals
  const totalProducts = validatedItems.length;
  const subTotal = validatedItems.reduce(
    (sum, item) => sum + item.totalPrice,
    0,
  );
  const grandTotal = subTotal;

  // Prepare data for creation
  const createData = {
    ...restPurchaseBody,
    purchaseDate,
    totalProducts,
    subTotal,
    grandTotal,
    createdById: userId,
    shopId: restPurchaseBody.shopId || null,
    storeId: restPurchaseBody.storeId || null,
  };

  // Create the purchase transaction
  const result = await prisma.$transaction(async (tx) => {
    const purchase = await tx.purchase.create({
      data: {
        ...createData,
        items: {
          create: validatedItems.map((item) => ({
            productId: item.productId,
            isBox: item.isBox,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          })),
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        supplier: true,
        store: true,
        shop: true,
        createdBy: true,
      },
    });

    return purchase;
  });

  return result;
};

// Update Purchase
// Update Purchase
const updatePurchase = async (purchaseId, purchaseBody, userId) => {
  try {
    // Auto-detect and fix swapped parameters if needed
    // Check if purchaseId is actually an object (purchaseBody) and purchaseBody is a string (userId)
    if (
      typeof purchaseId === 'object' &&
      purchaseId !== null &&
      purchaseId.invoiceNo
    ) {
      // If purchaseId is an object with invoiceNo, it's actually the purchaseBody
      // and purchaseBody might be the userId
      const temp = purchaseId;
      purchaseId = purchaseBody; // This might be the actual purchaseId
      purchaseBody = temp; // This is the actual purchaseBody
    }

    // Ensure purchaseId is a string
    if (typeof purchaseId !== 'string') {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid purchase ID format');
    }

    // Check if purchase exists
    const existingPurchase = await getPurchaseById(purchaseId);
    if (!existingPurchase) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Purchase not found');
    }

    // Check if current user is the creator of this purchase
    if (existingPurchase.createdById !== userId) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        'Only the creator can update this purchase',
      );
    }

    // Check if invoice number already exists (excluding current purchase)
    if (
      purchaseBody.invoiceNo &&
      purchaseBody.invoiceNo !== existingPurchase.invoiceNo
    ) {
      if (await getPurchaseByInvoiceNo(purchaseBody.invoiceNo)) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          'Invoice number already taken',
        );
      }
    }

    // Parse items if it's a string
    const { items: itemsString, ...restPurchaseBody } = purchaseBody;
    const items =
      typeof itemsString === 'string' ? JSON.parse(itemsString) : itemsString;

    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Purchase must have at least one item',
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
      if (item.unitPrice < 0) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          `Item ${index + 1} has invalid unit price`,
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

    // Recalculate totalPrice for security and process isBox
    const validatedItems = items.map((item) => ({
      ...item,
      isBox: item.isBox || false, // Default to false if not provided
      totalPrice: item.quantity * item.unitPrice,
    }));

    // Convert purchaseDate to DateTime object if provided
    let { purchaseDate } = existingPurchase;
    if (restPurchaseBody.purchaseDate) {
      purchaseDate = new Date(restPurchaseBody.purchaseDate);
      if (Number.isNaN(purchaseDate.getTime())) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid purchase date');
      }
    }

    // Calculate totals
    const totalProducts = validatedItems.length;
    const subTotal = validatedItems.reduce(
      (sum, item) => sum + item.totalPrice,
      0,
    );
    const grandTotal = subTotal;

    // Validate that either store OR shop is selected, but not both
    const hasStore =
      restPurchaseBody.storeId && restPurchaseBody.storeId.trim() !== '';
    const hasShop =
      restPurchaseBody.shopId && restPurchaseBody.shopId.trim() !== '';

    // Use existing values if not provided in update
    const finalStoreId = hasStore
      ? restPurchaseBody.storeId
      : existingPurchase.storeId;
    const finalShopId = hasShop
      ? restPurchaseBody.shopId
      : existingPurchase.shopId;

    if (
      (!finalStoreId || finalStoreId === '') &&
      (!finalShopId || finalShopId === '')
    ) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Either Store or Shop must be selected',
      );
    }

    if (
      finalStoreId &&
      finalStoreId !== '' &&
      finalShopId &&
      finalShopId !== ''
    ) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Cannot select both Store and Shop. Please choose only one.',
      );
    }

    // Update the purchase transaction
    const result = await prisma.$transaction(async (tx) => {
      // First delete all existing items
      await tx.purchaseItem.deleteMany({
        where: {
          purchaseId,
        },
      });

      // Prepare update data
      const updateData = {
        ...restPurchaseBody,
        purchaseDate,
        totalProducts,
        subTotal,
        grandTotal,
        storeId: finalStoreId || null,
        shopId: finalShopId || null,
        items: {
          create: validatedItems.map((item) => ({
            productId: item.productId,
            isBox: item.isBox,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          })),
        },
      };

      // Remove items from the main data object (it's handled separately)
      delete updateData.items;

      // Update the purchase
      const purchase = await tx.purchase.update({
        where: {
          id: purchaseId,
        },
        data: updateData,
        include: {
          items: {
            include: {
              product: true,
            },
          },
          supplier: true,
          store: true,
          shop: true,
        },
      });

      return purchase;
    });

    return result;
  } catch (error) {
    // Log validation errors
    if (error instanceof ApiError) {
      throw error;
    }

    // Throw generic error for other cases
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Error updating purchase',
    );
  }
};
// Delete Purchase
const deletePurchase = async (id, userId) => {
  const existingPurchase = await getPurchaseById(id);
  if (!existingPurchase) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Purchase not found');
  }

  await prisma.$transaction(async (tx) => {
    // Check if this purchase was approved (has stock ledger entries)
    const existingLedgerEntries = await tx.stockLedger.count({
      where: {
        reference: existingPurchase.invoiceNo,
        movementType: 'IN',
      },
    });

    const wasApproved = existingLedgerEntries > 0;

    // Process all items in parallel
    await Promise.all(
      existingPurchase.items.map(async (item) => {
        const operations = [];

        // Only reverse stock operations if purchase was approved
        if (wasApproved) {
          // 1. Update ProductBatch stock
          operations.push(
            tx.productBatch.update({
              where: { id: item.batchId },
              data: {
                stock: {
                  decrement: item.quantity,
                },
              },
            }),
          );

          // 2. Create reversal stock ledger entry
          operations.push(
            tx.stockLedger.create({
              data: {
                storeId: existingPurchase.storeId,
                movementType: 'OUT',
                quantity: item.quantity,

                reference: `PURCHASE-DELETE-${existingPurchase.invoiceNo}`,
                userId,
                notes: `Stock reversed from deleted purchase ${existingPurchase.invoiceNo}`,
                movementDate: new Date(),
              },
            }),
          );

          // 3. Update StoreStock
          const existingStoreStock = await tx.storeStock.findUnique({
            where: {
              storeId_batchId: {
                storeId: existingPurchase.storeId,
                batchId: item.batchId,
              },
            },
          });

          if (existingStoreStock) {
            const newQuantity = existingStoreStock.quantity - item.quantity;

            if (newQuantity <= 0) {
              // Delete the store stock if quantity becomes 0 or negative
              operations.push(
                tx.storeStock.delete({
                  where: {
                    storeId_batchId: {
                      storeId: existingPurchase.storeId,
                      batchId: item.batchId,
                    },
                  },
                }),
              );
            } else {
              // Update the store stock quantity
              operations.push(
                tx.storeStock.update({
                  where: {
                    storeId_batchId: {
                      storeId: existingPurchase.storeId,
                      batchId: item.batchId,
                    },
                  },
                  data: {
                    quantity: {
                      decrement: item.quantity,
                    },
                  },
                }),
              );
            }
          }
        }

        // Execute all operations for this item
        if (operations.length > 0) {
          await Promise.all(operations);
        }
      }),
    );

    // Delete all purchase items
    await tx.purchaseItem.deleteMany({
      where: { purchaseId: id },
    });

    // Delete the purchase
    await tx.purchase.delete({
      where: { id },
    });

    // Create log entry
    await tx.log.create({
      data: {
        action: `Deleted purchase ${existingPurchase.invoiceNo}${
          wasApproved ? ' and reversed stock' : ''
        }`,
        userId,
      },
    });
  });

  return { message: 'Purchase deleted successfully' };
};
const acceptPurchase = async (purchaseId, paymentStatus, userId) => {
  try {
    const purchase = await prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: {
        items: {
          include: {
            product: true, // Include product to access boxSize and hasBox
          },
        },
        store: true,
        shop: true,
      },
    });

    if (!purchase) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Purchase not found');
    }

    // Validate that either store or shop exists
    if (!purchase.storeId && !purchase.shopId) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Purchase must be associated with either a store or a shop'
      );
    }

    if (purchase.storeId && purchase.shopId) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Purchase cannot be associated with both a store and a shop'
      );
    }

    // Determine the location type and ID
    const isStore = !!purchase.storeId;
    const locationId = isStore ? purchase.storeId : purchase.shopId;
    const locationType = isStore ? 'store' : 'shop';

    // Check if purchase is already accepted (has stock ledger entries)
    const existingLedgerEntries = await prisma.stockLedger.count({
      where: {
        reference: purchase.invoiceNo,
        movementType: 'IN',
      },
    });

    if (existingLedgerEntries > 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Purchase already accepted');
    }

    // Update payment status
    const updatedPurchase = await prisma.purchase.update({
      where: { id: purchaseId },
      data: {
        paymentStatus,
        updatedById: userId,
      },
    });

    // Only create stock for fully paid purchases
    if (paymentStatus === 'APPROVED') {
      const result = await prisma.$transaction(async (tx) => {
        // Get all existing stocks in one query based on location type
        const productIds = purchase.items.map((item) => item.productId);
        
        let existingStocks = [];
        let existingStockMap = {};

        if (isStore) {
          // Get existing store stocks
          existingStocks = await tx.storeStock.findMany({
            where: {
              storeId: locationId,
              productId: { in: productIds },
            },
          });
          
          existingStockMap = existingStocks.reduce((acc, stock) => {
            acc[stock.productId] = stock;
            return acc;
          }, {});
        } else {
          // Get existing shop stocks
          existingStocks = await tx.shopStock.findMany({
            where: {
              shopId: locationId,
              productId: { in: productIds },
            },
          });
          
          existingStockMap = existingStocks.reduce((acc, stock) => {
            acc[stock.productId] = stock;
            return acc;
          }, {});
        }

        // Prepare all operations
        const stockOperations = [];
        const stockLedgerOperations = [];

        for (const item of purchase.items) {
          const { quantity, product, isBox } = item;

          // Calculate piece quantity based on isBox flag
          let pieceQuantity = quantity;

          if (isBox) {
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

            pieceQuantity = quantity * product.boxSize;
          }

          // Validate piece quantity is positive
          if (pieceQuantity <= 0) {
            throw new ApiError(
              httpStatus.BAD_REQUEST,
              `Invalid quantity for product "${product.name}". Quantity must be greater than 0.`,
            );
          }

          // Stock operations (store or shop)
          const existingStock = existingStockMap[product.id];
          
          if (isStore) {
            // Handle store stock
            if (existingStock) {
              // Update existing store stock
              stockOperations.push(
                tx.storeStock.update({
                  where: { id: existingStock.id },
                  data: {
                    quantity: { increment: pieceQuantity },
                    status: 'Available',
                  },
                }),
              );
            } else {
              // Create new store stock
              stockOperations.push(
                tx.storeStock.create({
                  data: {
                    storeId: locationId,
                    productId: product.id,
                    quantity: pieceQuantity,
                    status: 'Available',
                  },
                }),
              );
            }
          } else {
            // Handle shop stock
            if (existingStock) {
              // Update existing shop stock
              stockOperations.push(
                tx.shopStock.update({
                  where: { id: existingStock.id },
                  data: {
                    quantity: { increment: pieceQuantity },
                    status: 'Available',
                  },
                }),
              );
            } else {
              // Create new shop stock
              stockOperations.push(
                tx.shopStock.create({
                  data: {
                    shopId: locationId,
                    productId: product.id,
                    quantity: pieceQuantity,
                    status: 'Available',
                  },
                }),
              );
            }
          }

          // Stock ledger operations - record based on location type
          stockLedgerOperations.push(
            tx.stockLedger.create({
              data: {
                productId: product.id,
                storeId: isStore ? locationId : null,
                shopId: !isStore ? locationId : null,
                movementType: 'IN',
                pieceQuantity,
                boxQuantity: isBox ? quantity : 0,
                reference: purchase.invoiceNo,
                userId,
                notes: isBox
                  ? `Purchase acceptance - ${purchase.invoiceNo} (${quantity} box(es) × ${product.boxSize} = ${pieceQuantity} pieces) - ${locationType}: ${isStore ? purchase.store?.name : purchase.shop?.name}`
                  : `Purchase acceptance - ${purchase.invoiceNo} (${quantity} piece(s)) - ${locationType}: ${isStore ? purchase.store?.name : purchase.shop?.name}`,
                movementDate: purchase.purchaseDate,
              },
            }),
          );
        }

        // Execute all operations in parallel
        const [stockUpdates, stockLedgerEntries] = await Promise.all([
          Promise.all(stockOperations),
          Promise.all(stockLedgerOperations),
        ]);

        // Calculate total pieces added
        const totalPiecesAdded = purchase.items.reduce((total, item) => {
          const { quantity, product, isBox } = item;
          if (isBox) {
            return total + quantity * product.boxSize;
          }
          return total + quantity;
        }, 0);

        // Create log entry
        await tx.log.create({
          data: {
            action: `Accepted purchase ${purchase.invoiceNo} with ${purchase.items.length} items. Total pieces added: ${totalPiecesAdded} to ${locationType}: ${isStore ? purchase.store?.name : purchase.shop?.name}`,
            userId,
          },
        });

        return {
          purchase: updatedPurchase,
          stockLedgerEntries,
          stockUpdates,
          totalPiecesAdded,
          locationType,
          locationName: isStore ? purchase.store?.name : purchase.shop?.name,
        };
      });

      return result;
    }

    // For non-APPROVED status, just update the payment status and return
    await prisma.log.create({
      data: {
        action: `Updated payment status of purchase ${purchase.invoiceNo} to ${paymentStatus}`,
        userId,
      },
    });

    return {
      purchase: updatedPurchase,
      message: `Payment status updated to ${paymentStatus}. No stock created as purchase is not fully approved.`,
    };
  } catch (error) {
    console.error('❌ Error in acceptPurchase:', error);

    // Handle transaction errors specifically
    if (error.code === 'P2025') {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        'Related record not found during transaction',
      );
    }

    // Re-throw ApiError as is
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to accept purchase: ${error.message}`,
    );
  }
};
module.exports = {
  getPurchaseById,
  getPurchaseByInvoiceNo,
  getAllPurchases,
  createPurchase,
  updatePurchase,
  deletePurchase,
  acceptPurchase,
};
