const httpStatus = require('http-status');
const { subMonths } = require('date-fns');
const { getIO } = require('../socket/s');
const ApiError = require('../utils/ApiError');
const prisma = require('./prisma');

const getSellById = async (identifier) => {
  const sell = await prisma.sell.findFirst({
    where: {
      OR: [{ id: identifier }, { invoiceNo: identifier }],
    },
    include: {
      branch: true,
      customer: true,
      createdBy: true,
      updatedBy: true,
      items: {
        include: {
          product: {
            include: {
              category: true,
            },
          },
          shop: true,
        },
      },
    },
  });
  return sell;
};
const getSellByIdByuser = async (id, userId = null) => {
  // Get the sell with all items first
  const sell = await prisma.sell.findUnique({
    where: { id },
    include: {
      branch: true,
      customer: true,
      createdBy: true,
      updatedBy: true,
      items: {
        include: {
          product: {
            include: {
              category: true,
            },
          },
          shop: true,
        },
      },
    },
  });
  const existingSell = await prisma.sell.findUnique({
    where: { id },
    select: { locked: true, lockedAt: true },
  });

  // If record is unlocked (false), check time validity
  if (existingSell && existingSell.locked === false) {
    // Case 1: lockedAt is missing → lock immediately
    if (!existingSell.lockedAt) {
      return prisma.sell.update({
        where: { id },
        data: {
          locked: true,
          lockedAt: new Date(),
        },
      });
    }

    // Case 2: lockedAt exists → check 20 minutes rule
    const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);

    if (existingSell.lockedAt < twentyMinutesAgo) {
      return prisma.sell.update({
        where: { id },
        data: {
          locked: true,
          lockedAt: new Date(),
        },
      });
    }
  }

  if (!sell) return null;

  // If userId is provided, filter items and return both versions
  if (userId) {
    const userWithShops = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        shops: {
          select: { id: true },
        },
      },
    });

    const userShopIds = userWithShops?.shops?.map((shop) => shop.id) || [];

    const filteredItems = sell.items.filter((item) =>
      userShopIds.includes(item.shopId),
    );

    return {
      ...sell,
      items: filteredItems,
      // Include metadata about the filtering
      _metadata: {
        totalItems: sell.items.length,
        accessibleItems: filteredItems.length,
        hasRestrictedAccess: filteredItems.length < sell.items.length,
      },
    };
  }

  return sell;
};

// Get Sell by invoice number
const getSellByInvoiceNo = async (invoiceNo) => {
  const sell = await prisma.sell.findFirst({
    where: { invoiceNo },
    include: {
      branch: true,
      customer: true,
      items: {
        include: {
          product: {
            include: {
              category: true,
            },
          },
          shop: true,
        },
      },
    },
  });
  return sell;
};

// Get all Sells
const getAllSells = async ({
  startDate,
  endDate,
  saleStatus,
  branchId,
} = {}) => {
  const whereClause = {};
  const twelveMonthsAgo = subMonths(new Date(), 12); // Default time range

  // Convert string dates to Date objects if they exist
  const startDateObj = startDate ? new Date(startDate) : undefined;
  const endDateObj = endDate ? new Date(endDate) : undefined;

  // Build the date filter
  if (startDateObj && endDateObj) {
    whereClause.saleDate = {
      gte: startDateObj,
      lte: endDateObj,
    };
  } else if (startDateObj) {
    whereClause.saleDate = {
      gte: startDateObj,
      lte: new Date(),
    };
  } else if (endDateObj) {
    whereClause.saleDate = {
      gte: twelveMonthsAgo,
      lte: endDateObj,
    };
  } else {
    whereClause.saleDate = {
      gte: twelveMonthsAgo,
    };
  }

  // Add sale status filter if provided
  if (saleStatus) {
    whereClause.saleStatus = saleStatus;
  }

  // Add branch filter if provided
  if (branchId) {
    whereClause.branchId = branchId;
  }

  const sells = await prisma.sell.findMany({
    where: whereClause,
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      branch: true,
      customer: true,
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      items: {
        include: {
          product: {
            include: {
              category: true,
            },
          },
          shop: true,
        },
      },
      SellStockCorrection: {
        select: {
          id: true,
          status: true, // Only including status as requested
          createdAt: true,
          isChecked: true, // Make sure this is included!
        },
      },
      _count: {
        select: { items: true },
      },
    },
  });
  return {
    sells,
    count: sells.length,
  };
};

const generateInvoiceNumber = async () => {
  try {
    // Get all invoice numbers
    const allSells = await prisma.sell.findMany({
      select: { invoiceNo: true },
    });

    let maxNumber = 0;

    if (allSells.length === 0) {
      // No invoices exist, start from 00001
      const invoiceNumber = 'INV-00001';
      return invoiceNumber;
    }

    // Find the maximum numeric invoice number
    for (const sell of allSells) {
      // Extract numeric part from any format
      const match = sell.invoiceNo.match(/INV-?(\d+)/i);
      if (match && match[1]) {
        const numericPart = parseInt(match[1], 10);
        if (!isNaN(numericPart) && numericPart > maxNumber) {
          maxNumber = numericPart;
        }
      }
    }

    const nextNumber = maxNumber === 0 ? 1 : maxNumber + 1;

    // Format: Always 5 digits
    const invoiceNumber = `INV-${nextNumber.toString().padStart(5, '0')}`;

    return invoiceNumber;
  } catch (error) {
    return `INV-${Date.now().toString().slice(-8)}`;
  }
};

const createSell = async (sellBody, userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { branch: true },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const { items: itemsString, ...restSellBody } = sellBody;
  const items =
    typeof itemsString === 'string' ? JSON.parse(itemsString) : itemsString;

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Sale must have at least one item',
    );
  }

  const invoiceNo = await generateInvoiceNumber();
  const checkdiscount = restSellBody.discount || 0;
  const hasDiscount = checkdiscount > 0;

  // Extract product IDs and shop IDs from items
  const productIds = items.map((item) => item.productId).filter(Boolean);
  const shopIds = items.map((item) => item.shopId).filter(Boolean);

  if (productIds.length === 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'All items must have a productId',
    );
  }

  if (shopIds.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'All items must have a shopId');
  }

  // Fetch products with their additional prices
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: {
      AdditionalPrice: {
        where: {
          OR: [
            { shopId: null }, // Global additional prices
            { shopId: { in: shopIds } }, // Shop-specific additional prices
          ],
        },
      },
    },
  });

  // Fetch available shop stocks for validation - updated to use direct product relation
  const shopStocks = await prisma.shopStock.findMany({
    where: {
      shopId: { in: shopIds },
      status: 'Available',
      quantity: { gt: 0 },
      productId: { in: productIds },
    },
    include: {
      product: true,
      shop: true,
    },
  });

  const enhancedItems = items.map((item, index) => {
    if (!item.productId) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Item ${index + 1} is missing productId`,
      );
    }

    if (!item.shopId) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Item ${index + 1} is missing shopId`,
      );
    }

    const product = products.find((p) => p.id === item.productId);
    if (!product) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Item ${index + 1} has invalid productId`,
      );
    }

    // Calculate piece quantity based on isBox flag
    const isBox = item.isBox || false;

    // Ensure unitPrice is converted to a number
    const unitPrice = Number(item.unitPrice);
    if (
      typeof unitPrice !== 'number' ||
      Number.isNaN(unitPrice) ||
      unitPrice < 0
    ) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Item ${index + 1} has invalid unit price`,
      );
    }

    // Calculate total price - convert only if isBox is true
    let totalPrice;
    if (isBox) {
      // If it's a box, convert the total price (price * quantity * boxSize)
      totalPrice = unitPrice * item.quantity * product.boxSize;
    } else {
      // If it's not a box, keep the original calculation (price * quantity)
      totalPrice = unitPrice * item.quantity;
    }

    return {
      ...item,
      productId: item.productId,
      shopId: item.shopId,
      isBox,
      quantity: item.quantity, // Store as pieces in the database
      unitPrice, // Unit price remains unchanged
      boxSize: product.boxSize,
      totalPrice,
    };
  });

  // Calculate subtotal - convert only for box items
  const subTotal = enhancedItems.reduce((sum, item) => {
    if (item.isBox) {
      // For box items, use the converted total price
      return sum + item.unitPrice * item.quantity * item.boxSize;
    }
    // For non-box items, use regular calculation
    return sum + item.unitPrice * item.quantity;
  }, 0);

  const discount = restSellBody.discount || 0;
  const vat = restSellBody.vat || 0;
  const grandTotal = subTotal - discount + vat;

  // Determine sale status based on price validation

  // Create the sell record without stock updates
  const sell = await prisma.sell.create({
    data: {
      invoiceNo,
      customerId: restSellBody.customerId,
      totalProducts: enhancedItems.length,
      subTotal,
      discount,
      vat,
      balance: grandTotal,
      grandTotal,
      NetTotal: grandTotal,
      saleStatus: 'NOT_APPROVED',
      saleDate: restSellBody.saleDate
        ? new Date(restSellBody.saleDate)
        : new Date(),
      notes: restSellBody.notes,
      branchId: user.branchId,
      createdById: userId,
      updatedById: userId,
      items: {
        create: enhancedItems.map((item) => ({
          productId: item.productId,
          shopId: item.shopId,
          isBox: item.isBox,
          remainingQuantity: item.quantity,
          quantity: item.quantity, // Already in pieces
          unitPrice: item.unitPrice, // Unit price remains unchanged
          totalPrice: item.totalPrice, // Using the converted total price
          itemSaleStatus: 'PENDING',
        })),
      },
    },
    include: {
      branch: true,
      customer: true,
      createdBy: { select: { id: true, name: true, email: true } },
      items: {
        include: {
          product: {
            include: {
              category: true,
            },
          },
          shop: true,
        },
      },
    },
  });

  return sell;
};
// Update Sell
const updateSell = async (sellId, sellBody, userId) => {
  const existingSell = await getSellById(sellId);
  if (!existingSell) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Sale not found');
  }

  if (existingSell.locked === true) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Cannot update locked sale');
  }

  if (
    ['DELIVERED', 'PARTIALLY_DELIVERED', 'CANCELLED'].includes(
      existingSell.saleStatus,
    )
  ) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Cannot update ${existingSell.saleStatus.toLowerCase()} sale`,
    );
  }

  if (sellBody.invoiceNo && sellBody.invoiceNo !== existingSell.invoiceNo) {
    if (await getSellByInvoiceNo(sellBody.invoiceNo)) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Invoice number already taken',
      );
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { branch: true },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const { items: itemsString, ...restSellBody } = sellBody;
  const items =
    typeof itemsString === 'string' ? JSON.parse(itemsString) : itemsString;

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Sale must have at least one item',
    );
  }

  const newDiscount =
    restSellBody.discount !== undefined
      ? Number(restSellBody.discount)
      : existingSell.discount;

  const existingDiscountWasZero = existingSell.discount === 0;
  const newDiscountIsZero = newDiscount === 0;
  const discountChangedFromZeroToNonZero =
    existingDiscountWasZero && !newDiscountIsZero;
  const discountChangedFromNonZeroToZero =
    !existingDiscountWasZero && newDiscountIsZero;
  const hasDiscount = newDiscount > 0;

  const productIds = items.map((item) => item.productId).filter(Boolean);
  const shopIds = items.map((item) => item.shopId).filter(Boolean);

  if (productIds.length === 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'All items must have a productId',
    );
  }

  if (shopIds.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'All items must have a shopId');
  }

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: {
      AdditionalPrice: {
        where: {
          OR: [{ shopId: null }, { shopId: { in: shopIds } }],
        },
      },
    },
  });

  const shopStocks = await prisma.shopStock.findMany({
    where: {
      shopId: { in: shopIds },
      status: 'Available',
      quantity: { gt: 0 },
      productId: { in: productIds },
    },
    include: {
      product: true,
      shop: true,
    },
  });

  let allItemsApproved = true;
  const enhancedItems = items.map((item, index) => {
    if (!item.productId) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Item ${index + 1} is missing productId`,
      );
    }

    if (!item.shopId) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Item ${index + 1} is missing shopId`,
      );
    }

    const product = products.find((p) => p.id === item.productId);
    if (!product) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Item ${index + 1} has invalid productId`,
      );
    }

    // Calculate piece quantity based on isBox flag
    let pieceQuantity = item.quantity;
    const isBox = item.isBox || false;

    if (isBox) {
      if (!product.hasBox || !product.boxSize || product.boxSize <= 0) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          `Product "${product.name}" does not support box/packaging or has invalid box size.`,
        );
      }
      pieceQuantity = item.quantity * product.boxSize;
    }

    const availableStock = shopStocks
      .filter(
        (stock) =>
          stock.productId === item.productId && stock.shopId === item.shopId,
      )
      .reduce((sum, stock) => sum + stock.quantity, 0);

    const existingItem = existingSell.items.find(
      (existing) =>
        existing.productId === item.productId &&
        existing.shopId === item.shopId,
    );

    const adjustedAvailableStock = existingItem
      ? availableStock + existingItem.quantity
      : availableStock;

    if (pieceQuantity <= 0) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Item ${index + 1} has invalid quantity`,
      );
    }

    if (pieceQuantity > adjustedAvailableStock) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Item ${index + 1} quantity (${
          isBox
            ? `${item.quantity} box(es) = ${pieceQuantity} pieces`
            : `${pieceQuantity} pieces`
        }) exceeds available stock (${adjustedAvailableStock} pieces) in shop`,
      );
    }

    const unitPrice = Number(item.unitPrice);
    if (
      typeof unitPrice !== 'number' ||
      Number.isNaN(unitPrice) ||
      unitPrice < 0
    ) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Item ${index + 1} has invalid unit price`,
      );
    }

    const shopAdditionalPrices = product.AdditionalPrice.filter(
      (ap) => ap.shopId === null || ap.shopId === item.shopId,
    );

    const isAdditionalPrice = shopAdditionalPrices.some(
      (ap) => ap.price === unitPrice,
    );

    if (!isAdditionalPrice) {
      allItemsApproved = false;
    }

    // Calculate total price - convert only if isBox is true
    let totalPrice;
    if (isBox) {
      // If it's a box, convert the total price (price * quantity * boxSize)
      totalPrice = unitPrice * item.quantity * product.boxSize;
    } else {
      // If it's not a box, keep the original calculation (price * quantity)
      totalPrice = unitPrice * item.quantity;
    }

    return {
      ...item,
      productId: item.productId,
      shopId: item.shopId,
      isBox,
      quantity: item.quantity,
      originalQuantity: item.quantity, // Keep original quantity for reference
      unitPrice,
      totalPrice,
      isPriceValid: isAdditionalPrice,
      availableStock: adjustedAvailableStock,
      boxSize: product.boxSize,
    };
  });

  // Calculate subtotal - convert only for box items
  const subTotal = enhancedItems.reduce((sum, item) => {
    if (item.isBox) {
      // For box items, use the converted total price
      return sum + item.unitPrice * item.originalQuantity * item.boxSize;
    }
    // For non-box items, use regular calculation
    return sum + item.unitPrice * item.quantity;
  }, 0);

  const discount = newDiscount;
  const vat = restSellBody.vat || existingSell.vat || 0;
  const grandTotal = subTotal - discount + vat;

  let saleStatus;

  // Any update will set status to NOT_APPROVED unless all conditions are met
  if (discountChangedFromZeroToNonZero) {
    saleStatus = 'NOT_APPROVED';
  } else if (discountChangedFromNonZeroToZero) {
    saleStatus = allItemsApproved ? 'APPROVED' : 'NOT_APPROVED';
  } else if (hasDiscount) {
    saleStatus = 'NOT_APPROVED';
  } else {
    // If there's any update (items changed, prices changed, etc.), set to NOT_APPROVED
    // Compare if items have changed from existing sell
    const itemsChanged =
      JSON.stringify(
        enhancedItems.map((item) => ({
          productId: item.productId,
          shopId: item.shopId,
          isBox: item.isBox,
          remainingQuantity: item.quantity,

          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      ) !==
      JSON.stringify(
        existingSell.items.map((item) => ({
          productId: item.productId,
          shopId: item.shopId,
          isBox: item.isBox,
          remainingQuantity: item.quantity,

          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      );

    if (itemsChanged) {
      saleStatus = 'NOT_APPROVED';
    } else {
      saleStatus = allItemsApproved ? 'APPROVED' : 'NOT_APPROVED';
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.sellItem.deleteMany({
      where: { sellId },
    });

    const sell = await tx.sell.update({
      where: { id: sellId },
      data: {
        customerId: restSellBody.customerId || existingSell.customerId,
        totalProducts: enhancedItems.length,
        subTotal,
        discount,
        vat,
        grandTotal,
        NetTotal: grandTotal,
        saleStatus,
        saleDate: restSellBody.saleDate
          ? new Date(restSellBody.saleDate)
          : existingSell.saleDate,
        notes: restSellBody.notes || existingSell.notes,
        updatedById: userId,
        items: {
          create: enhancedItems.map((item) => ({
            productId: item.productId,
            shopId: item.shopId,
            isBox: item.isBox,
            remainingQuantity: item.quantity,

            quantity: item.quantity, // Store as pieces in the database
            unitPrice: item.unitPrice, // Unit price remains unchanged
            totalPrice: item.totalPrice, // Using the converted total price
            itemSaleStatus: 'PENDING',
          })),
        },
      },
      include: {
        branch: true,
        customer: true,
        createdBy: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            product: {
              include: {
                category: true,
              },
            },
            shop: true,
          },
        },
      },
    });
    return sell;
  });

  if (existingSell.saleStatus !== 'APPROVED' && saleStatus === 'APPROVED') {
    try {
      const uniqueShopIds = result.items
        .map((item) => item.shopId)
        .filter(Boolean)
        .filter((shopId, index, array) => array.indexOf(shopId) === index);

      const usersWithShopAccess = await prisma.user.findMany({
        where: {
          shops: { some: { id: { in: uniqueShopIds } } },
          status: 'Active',
        },
        select: {
          id: true,
          name: true,
          email: true,
          shops: {
            where: { id: { in: uniqueShopIds } },
            select: { id: true, name: true },
          },
        },
      });

      await Promise.allSettled(
        uniqueShopIds.map((shopId) =>
          prisma.notification.create({
            data: {
              shopId,
              title: 'Sale Approved - Prepare for Delivery',
              message: `Sale #${result.invoiceNo} has been approved and is ready for delivery preparation`,
              type: 'SELL_READY_FOR_DELIVERY',
              relatedEntityType: 'SELL',
            },
          }),
        ),
      );

      const io = getIO();
      const realTimeNotification = {
        title: 'Sale Updated & Approved',
        message: `Sale #${result.invoiceNo} has been updated and approved, ready for delivery preparation`,
        type: 'SELL_READY_FOR_DELIVERY',
        relatedEntityType: 'SELL',
        saleId: result.id,
        invoiceNo: result.invoiceNo,
        timestamp: new Date().toISOString(),
      };

      usersWithShopAccess.forEach((user) => {
        io.to(user.id).emit('new-notification', realTimeNotification);
        user.shops.forEach((shop) => {
          io.to(`${user.id}:${shop.id}`).emit(
            'new-notification',
            realTimeNotification,
          );
        });
      });
    } catch (notificationError) {
      console.error('❌ Error in notification process:', notificationError);
    }
  }

  return result;
};
// Delete Sell
const deleteSell = async (id, userId) => {
  const existingSell = await getSellById(id);
  if (!existingSell) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Sale not found');
  }
  if (existingSell.locked === true) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Cannot update locked sale');
  }

  // Delete the sell with stock reversal
  await prisma.$transaction(async (tx) => {
    // Get all sell items with their batches
    const sellItemsWithBatches = await tx.sellItem.findMany({
      where: { sellId: id },
      include: {
        batches: {
          include: {
            batch: true,
          },
        },
        shop: true,
      },
    });

    // Prepare operations for stock reversal
    const reversalOperations = [];

    // Reverse stock for each delivered item
    sellItemsWithBatches.forEach((sellItem) => {
      // Only reverse stock if the item was delivered (has batches)
      if (
        sellItem.batches.length > 0 &&
        sellItem.itemSaleStatus === 'DELIVERED'
      ) {
        sellItem.batches.forEach((sellItemBatch) => {
          const quantityToRestore = sellItemBatch.quantity;

          // Restore stock to shop for this specific batch
          reversalOperations.push(
            tx.shopStock.update({
              where: {
                shopId_batchId: {
                  shopId: sellItem.shopId,
                  batchId: sellItemBatch.batchId,
                },
              },
              data: {
                quantity: { increment: quantityToRestore },
              },
            }),
          );

          // Create reverse stock ledger entry (IN movement to reverse the OUT)
          reversalOperations.push(
            tx.stockLedger.create({
              data: {
                batchId: sellItemBatch.batchId,
                shopId: sellItem.shopId,
                movementType: 'IN',
                quantity: quantityToRestore,
                reference: `Sell-Delete-${existingSell.invoiceNo}`,
                userId,
                notes: `Sale deletion - Stock reversal for Item: ${sellItem.id}`,
                movementDate: new Date(),
              },
            }),
          );
        });
      }
    });

    // Delete all sell item batches first (due to foreign key constraints)
    const sellItemIds = sellItemsWithBatches.map((item) => item.id);
    if (sellItemIds.length > 0) {
      await tx.sellItemBatch.deleteMany({
        where: {
          sellItemId: { in: sellItemIds },
        },
      });
    }

    // Execute stock reversal operations if any
    if (reversalOperations.length > 0) {
      await Promise.all(reversalOperations);
    }

    // Delete all sell items
    await tx.sellItem.deleteMany({
      where: { sellId: id },
    });

    // Delete the sell
    await tx.sell.delete({
      where: { id },
    });

    // Create log entry for the deletion with stock reversal info
    const deliveredItems = sellItemsWithBatches.filter(
      (item) => item.itemSaleStatus === 'DELIVERED' && item.batches.length > 0,
    );

    let logMessage = `Sale ${existingSell.invoiceNo} deleted`;

    if (deliveredItems.length > 0) {
      const totalItemsReversed = deliveredItems.length;
      const totalBatchesReversed = deliveredItems.reduce(
        (sum, item) => sum + item.batches.length,
        0,
      );
      const totalQuantityReversed = deliveredItems.reduce(
        (sum, item) =>
          sum +
          item.batches.reduce((itemSum, batch) => itemSum + batch.quantity, 0),
        0,
      );

      logMessage += ` - Stock reversed: ${totalItemsReversed} items, ${totalBatchesReversed} batches, ${totalQuantityReversed} units`;
    }

    await tx.log.create({
      data: {
        action: logMessage,
        userId,
      },
    });
  });

  return { message: 'Sale deleted successfully with stock reversal' };
};

const completeSaleDelivery = async (saleId, deliveryData, userId) => {
  const sell = await getSellById(saleId);

  if (!sell) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Sale not found');
  }

  return prisma.$transaction(async (tx) => {
    // Get sell items that are being delivered
    const sellItemsToDeliver = await tx.sellItem.findMany({
      where: {
        id: { in: deliveryData.items.map((item) => item.itemId) },
        sellId: saleId,
      },
      include: {
        product: true,
        shop: true,
      },
    });

    if (sellItemsToDeliver.length === 0) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'No valid items found for delivery. Please check the provided item IDs.',
      );
    }

    // Validate delivery data structure
    if (!deliveryData.items || !Array.isArray(deliveryData.items)) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Invalid delivery data format. Expected items array.',
      );
    }

    // Process each delivery item
    const processedItems = [];

    for (const deliveryItem of deliveryData.items) {
      const sellItem = sellItemsToDeliver.find(
        (item) => item.id === deliveryItem.itemId,
      );

      if (!sellItem) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          `Item ${deliveryItem.itemId} not found in sale`,
        );
      }

      // Get the given quantity (use provided value or deliver remaining)
      const givenQty =
        deliveryItem.givenQuantity ||
        (sellItem.remainingQuantity > 0
          ? sellItem.remainingQuantity
          : sellItem.quantity);

      // Calculate new remaining quantity (simple subtraction)
      const currentRemaining =
        sellItem.remainingQuantity !== null &&
        sellItem.remainingQuantity !== undefined
          ? sellItem.remainingQuantity
          : sellItem.quantity;

      const newRemainingQuantity = currentRemaining - givenQty;

      // Calculate total given quantity so far
      const totalGivenSoFar = (sellItem.givenQuantity || 0) + givenQty;

      // Determine new item status
      let newItemStatus = sellItem.itemSaleStatus;
      if (newRemainingQuantity <= 0) {
        newItemStatus = 'DELIVERED';
      } else if (totalGivenSoFar > 0 && newRemainingQuantity > 0) {
        newItemStatus = 'PARTIALLY_DELIVERED';
      }

   

      if (givenQty <= 0) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          `Invalid quantity for product "${sellItem.product.name}". Quantity must be greater than 0.`,
        );
      }

      // Validate that given quantity doesn't exceed remaining quantity
      if (givenQty > currentRemaining) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          `Given quantity (${givenQty}) cannot exceed remaining quantity (${currentRemaining}) for item ${sellItem.product.name}`,
        );
      }

      // Validate item status transition
      const allowedItemTransitions = {
        PENDING: ['DELIVERED', 'CANCELLED', 'PARTIALLY_DELIVERED'],
        PARTIALLY_DELIVERED: ['DELIVERED', 'CANCELLED'],
        DELIVERED: ['RETURNED'],
        CANCELLED: [],
        RETURNED: [],
      };

      const currentStatus = sellItem.itemSaleStatus;
      const allowedStatuses = allowedItemTransitions[currentStatus] || [];

      if (!allowedStatuses.includes(newItemStatus)) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          `Cannot transition item from ${currentStatus} to ${newItemStatus}`,
        );
      }

      processedItems.push({
        sellItem,
        givenQty,
        totalGivenSoFar,
        newRemainingQuantity,
        newItemStatus,
      });
    }

    // Calculate piece quantities for stock removal
    const processedItemsWithPieces = processedItems.map((item) => {
      let pieceQuantity = item.givenQty;

      // If it's a box, convert to pieces for stock removal
      if (item.sellItem.isBox) {
        if (!item.sellItem.product.hasBox || !item.sellItem.product.boxSize) {
          throw new ApiError(
            httpStatus.BAD_REQUEST,
            `Product "${item.sellItem.product.name}" has invalid box configuration.`,
          );
        }
        pieceQuantity = item.givenQty * item.sellItem.product.boxSize;
      }

      return {
        ...item,
        pieceQuantity,
      };
    });

    // Validate stock availability for all items
    const stockValidationPromises = processedItemsWithPieces.map(
      async (item) => {
        const shopStock = await tx.shopStock.findUnique({
          where: {
            shopId_productId: {
              shopId: item.sellItem.shopId,
              productId: item.sellItem.productId,
            },
          },
        });

        if (!shopStock) {
          throw new ApiError(
            httpStatus.BAD_REQUEST,
            `Product "${item.sellItem.product.name}" not found in shop stock for delivery.`,
          );
        }

        if (shopStock.quantity < item.pieceQuantity) {
          throw new ApiError(
            httpStatus.BAD_REQUEST,
            `Insufficient stock for product "${item.sellItem.product.name}" in shop. Available: ${shopStock.quantity} pieces, Requested: ${item.pieceQuantity} pieces`,
          );
        }

        return item;
      },
    );

    const validatedItems = await Promise.all(stockValidationPromises);

    // Create stock operations
    const stockOperations = validatedItems.flatMap((item) => [
      tx.shopStock.update({
        where: {
          shopId_productId: {
            shopId: item.sellItem.shopId,
            productId: item.sellItem.productId,
          },
        },
        data: {
          quantity: { decrement: item.pieceQuantity },
        },
      }),
      tx.stockLedger.create({
        data: {
          productId: item.sellItem.productId,
          shopId: item.sellItem.shopId,
          movementType: 'OUT',
          pieceQuantity: item.pieceQuantity,
          boxQuantity: item.sellItem.isBox ? item.givenQty : 0,
          reference: `Sell-${sell.invoiceNo}`,
          userId,
          notes: item.sellItem.isBox
            ? `Sale delivery - ${sell.invoiceNo} (${item.givenQty} box(es) = ${item.pieceQuantity} pieces)`
            : `Sale delivery - ${sell.invoiceNo} (${item.givenQty} piece(s))`,
          movementDate: new Date(),
        },
      }),
    ]);

    // Update sell items (store quantities as-is, no conversion)
    const itemUpdatePromises = validatedItems.map((item) =>
      tx.sellItem.update({
        where: { id: item.sellItem.id },
        data: {
          givenQuantity: item.totalGivenSoFar,
          remainingQuantity: item.newRemainingQuantity,
          itemSaleStatus: item.newItemStatus,
        },
      }),
    );

    // Execute all operations
    await Promise.all([...stockOperations, ...itemUpdatePromises]);

    // Get updated items
    const updatedItems = await Promise.all(itemUpdatePromises);

    updatedItems.forEach((item, index) => {
      const processed = validatedItems[index];
    });

    // Recalculate overall sale status
    const allSaleItems = await tx.sellItem.findMany({
      where: { sellId: saleId },
    });

    const itemStatuses = allSaleItems.map((item) => item.itemSaleStatus);
    let newSaleStatus;

    if (itemStatuses.every((status) => status === 'DELIVERED')) {
      newSaleStatus = 'DELIVERED';
    } else if (itemStatuses.every((status) => status === 'CANCELLED')) {
      newSaleStatus = 'CANCELLED';
    } else if (
      itemStatuses.some((status) => status === 'DELIVERED') ||
      itemStatuses.some((status) => status === 'PARTIALLY_DELIVERED')
    ) {
      newSaleStatus = 'PARTIALLY_DELIVERED';
    } else if (itemStatuses.every((status) => status === 'PENDING')) {
      newSaleStatus = 'NOT_APPROVED';
    } else {
      newSaleStatus = 'NOT_APPROVED';
    }

    // Update the sale status
    const finalUpdatedSale = await tx.sell.update({
      where: { id: saleId },
      data: {
        saleStatus: newSaleStatus,
        updatedById: userId,
      },
      include: {
        items: {
          include: {
            shop: true,
            product: true,
          },
        },
        customer: true,
        branch: true,
      },
    });

    // Calculate total pieces delivered
    const totalPiecesDelivered = validatedItems.reduce((total, item) => {
      return total + item.pieceQuantity;
    }, 0);

    // Create log entry
    await tx.log.create({
      data: {
        action: `Sale ${sell.invoiceNo} delivered: ${validatedItems.length} items, ${totalPiecesDelivered} pieces`,
        userId,
      },
    });

    return finalUpdatedSale;
  });
};
const deliverAllSaleItems = async (saleId, deliveryData, userId) => {

  const sell = await getSellById(saleId);

  if (!sell) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Sale not found');
  }

  // Get all items that can be delivered - with proper remaining quantity calculation
  const deliverableItems = sell.items.filter((item) => {
    // Check if status allows delivery
    const isEligibleStatus =
      item.itemSaleStatus === 'PENDING' ||
      item.itemSaleStatus === 'PARTIALLY_DELIVERED';

    if (!isEligibleStatus) return false;

    // Calculate actual remaining quantity
    let actualRemaining = 0;

    // If remainingQuantity is set and > 0, use it
    if (
      item.remainingQuantity !== null &&
      item.remainingQuantity !== undefined &&
      item.remainingQuantity > 0
    ) {
      actualRemaining = item.remainingQuantity;
    }
    // If remainingQuantity is 0 but givenQuantity is less than quantity, it's incorrect
    else if (
      item.remainingQuantity === 0 &&
      (item.givenQuantity || 0) < item.quantity
    ) {
      // Calculate correct remaining quantity
      actualRemaining = item.quantity - (item.givenQuantity || 0);
      
    }
    // If remainingQuantity is null/undefined, calculate from quantity and givenQuantity
    else if (
      item.remainingQuantity === null ||
      item.remainingQuantity === undefined
    ) {
      actualRemaining = item.quantity - (item.givenQuantity || 0);
    }

    return actualRemaining > 0;
  });

  if (deliverableItems.length === 0) {
    // Check if there are any non-delivered items
    const nonDeliveredItems = sell.items.filter(
      (item) =>
        item.itemSaleStatus !== 'DELIVERED' &&
        item.itemSaleStatus !== 'CANCELLED',
    );

    if (nonDeliveredItems.length === 0) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'No items available for delivery. All items are already delivered or cancelled.',
      );
    }

    // Calculate if items have quantity remaining
    const itemsWithRemaining = nonDeliveredItems.filter((item) => {
      const remaining = item.quantity - (item.givenQuantity || 0);
      return remaining > 0;
    });

    if (itemsWithRemaining.length > 0) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Found ${
          itemsWithRemaining.length
        } item(s) with remaining quantity, but they have status ${itemsWithRemaining
          .map((i) => i.itemSaleStatus)
          .join(', ')}. Please check item statuses.`,
      );
    }

    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'No deliverable items found in this sale. All items have zero remaining quantity.',
    );
  }

  // If no deliveryData.items provided, create delivery data for all deliverable items
  if (!deliveryData.items || deliveryData.items.length === 0) {
    deliveryData.items = deliverableItems.map((item) => {
      // Calculate the correct remaining quantity
      let remainingQty = item.remainingQuantity;

      // If remainingQuantity is 0 but givenQuantity is less than quantity, correct it
      if (remainingQty === 0 && (item.givenQuantity || 0) < item.quantity) {
        remainingQty = item.quantity - (item.givenQuantity || 0);
      }
      // If remainingQuantity is null/undefined, calculate it
      else if (remainingQty === null || remainingQty === undefined) {
        remainingQty = item.quantity - (item.givenQuantity || 0);
      }

      return {
        itemId: item.id,
        givenQuantity: remainingQty, // Deliver the remaining quantity
      };
    });
    console.log('Auto-generated delivery items:', deliveryData.items);
  }

  return completeSaleDelivery(saleId, deliveryData, userId);
};

const partialSaleDelivery = async (saleId, deliveryData, userId) => {

  return completeSaleDelivery(saleId, deliveryData, userId);
};

const updateSaleStatus = async (saleId, newStatus, userId) => {
  const sale = await getSellById(saleId);

  if (!sale) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Sale not found');
  }

  // Validate status transition
  const allowedTransitions = {
    NOT_APPROVED: ['APPROVED', 'CANCELLED'],
    APPROVED: ['DELIVERED', 'CANCELLED'],
    DELIVERED: ['RETURNED'],
    CANCELLED: [],
    RETURNED: [],
  };

  if (!allowedTransitions[sale.saleStatus]?.includes(newStatus)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Cannot change status from ${sale.saleStatus} to ${newStatus}`,
    );
  }

  // Use prisma.sell.update() instead of prisma.sale.update()
  const updatedSale = await prisma.sell.update({
    where: { id: saleId },
    data: {
      saleStatus: newStatus,
      updatedById: userId,
    },
    include: {
      items: {
        include: {
          shop: true,
        },
      },
      customer: true,
    },
  });

  // Create log entry
  await prisma.log.create({
    data: {
      action: `Updated sale ${sale.invoiceNo} status from ${sale.saleStatus} to ${newStatus}`,
      userId,
    },
  });

  // ✅ ADD REAL-TIME NOTIFICATIONS HERE - For status changes to APPROVED or CANCELLED
  if (newStatus === 'APPROVED' || newStatus === 'CANCELLED') {
    try {
      const uniqueShopIds = updatedSale.items
        .map((item) => item.shopId)
        .filter(Boolean)
        .filter((shopId, index, array) => array.indexOf(shopId) === index);

      // Find users who have access to these shops
      const usersWithShopAccess = await prisma.user.findMany({
        where: {
          shops: {
            some: {
              id: { in: uniqueShopIds },
            },
          },
          status: 'Active', // Only active users
        },
        select: {
          id: true,
          name: true,
          email: true,
          shops: {
            where: {
              id: { in: uniqueShopIds },
            },
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // Determine notification type and message based on status
      const notificationConfig = {
        APPROVED: {
          type: 'SELL_READY_FOR_DELIVERY',
          title: 'Sale Approved - Prepare for Delivery',
          message: `Sale #${updatedSale.invoiceNo} has been approved and is ready for delivery preparation`,
          realTimeTitle: 'Sale Approved',
          realTimeMessage: `Sale #${updatedSale.invoiceNo} has been approved and needs delivery preparation`,
        },
        CANCELLED: {
          type: 'SELL_CANCELLED',
          title: 'Sale Cancelled',
          message: `Sale #${updatedSale.invoiceNo} has been cancelled`,
          realTimeTitle: 'Sale Cancelled',
          realTimeMessage: `Sale #${updatedSale.invoiceNo} has been cancelled`,
        },
      };

      const config = notificationConfig[newStatus];

      // Create shop notifications (store in database)
      const shopNotifications = await Promise.allSettled(
        uniqueShopIds.map((shopId) =>
          prisma.notification.create({
            data: {
              shopId,
              title: config.title,
              message: config.message,
              type: config.type,
              relatedEntityType: 'SELL',
            },
          }),
        ),
      );

      // Get the Socket.IO instance
      const io = getIO();

      // Create notification object for real-time sending
      const realTimeNotification = {
        title: config.realTimeTitle,
        message: config.realTimeMessage,
        type: config.type,
        relatedEntityType: 'SELL',
        saleId: updatedSale.id,
        invoiceNo: updatedSale.invoiceNo,
        status: newStatus,
        timestamp: new Date().toISOString(),
      };

      // ✅ FIXED: Remove prefixes to match frontend
      // Send real-time notifications to shops

      // Send real-time notifications to users with shop access
      usersWithShopAccess.forEach((user) => {
        // Send to each user individually - remove 'user:' prefix
        io.to(user.id).emit('new-notification', realTimeNotification);
      

        // Also send to user's shops for additional targeting
        user.shops.forEach((shop) => {
          // Remove prefixes to match what frontend will join
          io.to(`${user.id}:${shop.id}`).emit(
            'new-notification',
            realTimeNotification,
          );
        });
      });

      // Log statistics
      const successfulShopCount = shopNotifications.filter(
        (result) => result.status === 'fulfilled',
      ).length;

     
    } catch (notificationError) {
      console.error(
        `❌ Unexpected error in ${newStatus.toLowerCase()} notification process:`,
        notificationError,
      );
      // Don't throw error - the sale status was updated successfully
    }
  }

  return updatedSale;
};

// Update Payment Status
const updatePaymentStatus = async (saleId, newPaymentStatus, userId) => {
  const sale = await getSellById(saleId);

  if (!sale) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Sale not found');
  }

  const updatedSale = await prisma.sell.update({
    where: { id: saleId },
    data: {
      paymentStatus: newPaymentStatus,
      updatedById: userId,
    },
    include: {
      items: true,
      customer: true,
    },
  });

  // Create log entry
  await prisma.log.create({
    data: {
      action: `Updated sale ${sale.invoiceNo} payment status to ${newPaymentStatus}`,
      userId,
    },
  });

  return updatedSale;
};

// Cancel Sale (Before delivery)
const cancelSale = async (saleId, userId) => {
  const sale = await getSellById(saleId);

  if (!sale) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Sale not found');
  }

  if (sale.saleStatus === 'DELIVERED') {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Cannot cancel delivered sale. Use return instead.',
    );
  }

  const updatedSale = await prisma.sell.update({
    where: { id: saleId },
    data: {
      saleStatus: 'CANCELLED',
      updatedById: userId,
    },
    include: {
      items: {
        include: {
          shop: true,
        },
      },
      customer: true,
    },
  });

  // Create log entry
  await prisma.log.create({
    data: {
      action: `Cancelled sale ${sale.invoiceNo}`,
      userId,
    },
  });

  // ✅ ADD REAL-TIME NOTIFICATIONS HERE - Create cancellation notifications
  try {
    const uniqueShopIds = updatedSale.items
      .map((item) => item.shopId)
      .filter(Boolean)
      .filter((shopId, index, array) => array.indexOf(shopId) === index);

    // Find users who have access to these shops
    const usersWithShopAccess = await prisma.user.findMany({
      where: {
        shops: {
          some: {
            id: { in: uniqueShopIds },
          },
        },
        status: 'Active', // Only active users
      },
      select: {
        id: true,
        name: true,
        email: true,
        shops: {
          where: {
            id: { in: uniqueShopIds },
          },
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Create shop notifications (store in database)
    const shopNotifications = await Promise.allSettled(
      uniqueShopIds.map((shopId) =>
        prisma.notification.create({
          data: {
            shopId,
            title: 'Sale Cancelled',
            message: `Sale #${updatedSale.invoiceNo} has been cancelled`,
            type: 'SELL_CANCELLED',
            relatedEntityType: 'SELL',
          },
        }),
      ),
    );

    // Get the Socket.IO instance
    const io = getIO();

    // Create notification object for real-time sending
    const realTimeNotification = {
      title: 'Sale Cancelled',
      message: `Sale #${updatedSale.invoiceNo} has been cancelled`,
      type: 'SELL_CANCELLED',
      relatedEntityType: 'SELL',
      saleId: updatedSale.id,
      invoiceNo: updatedSale.invoiceNo,
      timestamp: new Date().toISOString(),
    };

    // ✅ FIXED: Remove prefixes to match frontend
    // Send real-time notifications to shops
    shopNotifications
      .filter((result, index) => result.status === 'fulfilled')
      .forEach((result, index) => {
        const shopId = uniqueShopIds[index];
        const notification = result.value;

        // Remove 'shop:' prefix to match frontend
        io.to(shopId).emit('new-notification', notification);
      });

    // Send real-time notifications to users with shop access
    usersWithShopAccess.forEach((user) => {
      // Send to each user individually - remove 'user:' prefix
      io.to(user.id).emit('new-notification', realTimeNotification);

      // Also send to user's shops for additional targeting
      user.shops.forEach((shop) => {
        // Remove prefixes to match what frontend will join
        io.to(`${user.id}:${shop.id}`).emit(
          'new-notification',
          realTimeNotification,
        );
      });
    });

    // Log statistics
    const successfulShopCount = shopNotifications.filter(
      (result) => result.status === 'fulfilled',
    ).length;

 
  } catch (notificationError) {
    console.error(
      '❌ Unexpected error in cancellation notification process:',
      notificationError,
    );
    // Don't throw error - the sale was cancelled successfully
  }

  return updatedSale;
};
const getAllSellsuser = async ({
  startDate,
  endDate,
  userId,
  customerName,
  status,
  page = 1,
  limit = 20,
}) => {
  // Validate required parameters
  if (!userId) {
    throw new Error('User ID is required');
  }

  // Initialize where clause with required condition
  const whereClause = {
    createdById: userId,
  };

  // DETECT DEFAULT VIEW: Check if any filters are applied
  const hasCustomerNameFilter = customerName && customerName.trim();
  const hasStatusFilter = status && status.trim();
  const hasDateFilter = startDate || endDate;

  const isDefaultView =
    !hasStatusFilter && !hasDateFilter && !hasCustomerNameFilter && page === 1;

  // For default view: Show all NOT_APPROVED and PARTIALLY_DELIVERED, plus last 10 DELIVERED
  if (isDefaultView) {
    // Get last 10 delivered sales
    const lastDeliveredQuery = {
      createdById: userId,
      saleStatus: 'DELIVERED',
    };

    // Add date filtering for delivered sales (last 3 months for performance)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    lastDeliveredQuery.createdAt = { gte: threeMonthsAgo };

    const [
      lastDeliveredSells,
      notApprovedSells,
      partiallyDeliveredSells,
      approvedSells,
      cancelledSells,
    ] = await Promise.all([
      // Get last 10 delivered sales
      prisma.sell.findMany({
        where: lastDeliveredQuery,
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          branch: true,
          customer: true,
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          items: {
            include: {
              product: {
                include: {
                  category: true,
                },
              },
              shop: true,
            },
          },
          SellStockCorrection: {
            select: {
              id: true,
              status: true,
              isChecked: true,
            },
          },
          _count: {
            select: { items: true },
          },
        },
      }),

      // Get all NOT_APPROVED sales
      prisma.sell.findMany({
        where: {
          createdById: userId,
          saleStatus: 'NOT_APPROVED',
        },
        orderBy: { createdAt: 'desc' },
        include: {
          branch: true,
          customer: true,
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          items: {
            include: {
              product: {
                include: {
                  category: true,
                },
              },
              shop: true,
            },
          },
          SellStockCorrection: {
            select: {
              id: true,
              status: true,
              isChecked: true,
            },
          },
          _count: {
            select: { items: true },
          },
        },
      }),

      // Get all PARTIALLY_DELIVERED sales
      prisma.sell.findMany({
        where: {
          createdById: userId,
          saleStatus: 'PARTIALLY_DELIVERED',
        },
        orderBy: { createdAt: 'desc' },
        include: {
          branch: true,
          customer: true,
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          items: {
            include: {
              product: {
                include: {
                  category: true,
                },
              },
              shop: true,
            },
          },
          SellStockCorrection: {
            select: {
              id: true,
              status: true,
              isChecked: true,
            },
          },
          _count: {
            select: { items: true },
          },
        },
      }),

      // Get all APPROVED sales
      prisma.sell.findMany({
        where: {
          createdById: userId,
          saleStatus: 'APPROVED',
        },
        orderBy: { createdAt: 'desc' },
        include: {
          branch: true,
          customer: true,
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          items: {
            include: {
              product: {
                include: {
                  category: true,
                },
              },
              shop: true,
            },
          },
          SellStockCorrection: {
            select: {
              id: true,
              status: true,
              isChecked: true,
            },
          },
          _count: {
            select: { items: true },
          },
        },
      }),

      // Get all CANCELLED sales
      prisma.sell.findMany({
        where: {
          createdById: userId,
          saleStatus: 'CANCELLED',
        },
        orderBy: { createdAt: 'desc' },
        include: {
          branch: true,
          customer: true,
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          items: {
            include: {
              product: {
                include: {
                  category: true,
                },
              },
              shop: true,
            },
          },
          SellStockCorrection: {
            select: {
              id: true,
              status: true,
              isChecked: true,
            },
          },
          _count: {
            select: { items: true },
          },
        },
      }),
    ]);

    // Combine all results
    const allSells = [
      ...notApprovedSells,
      ...partiallyDeliveredSells,
      ...approvedSells,
      ...cancelledSells,
      ...lastDeliveredSells,
    ];

    // Sort by createdAt descending
    allSells.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Apply the limit for default view
    const limitedSells = allSells.slice(0, limit);

    // Get counts for each status
    const [
      notApprovedCount,
      partiallyDeliveredCount,
      approvedCount,
      cancelledCount,
      deliveredCount,
    ] = await Promise.all([
      prisma.sell.count({
        where: {
          createdById: userId,
          saleStatus: 'NOT_APPROVED',
        },
      }),
      prisma.sell.count({
        where: {
          createdById: userId,
          saleStatus: 'PARTIALLY_DELIVERED',
        },
      }),
      prisma.sell.count({
        where: {
          createdById: userId,
          saleStatus: 'APPROVED',
        },
      }),
      prisma.sell.count({
        where: {
          createdById: userId,
          saleStatus: 'CANCELLED',
        },
      }),
      prisma.sell.count({
        where: {
          createdById: userId,
          saleStatus: 'DELIVERED',
        },
      }),
    ]);

    return {
      sells: limitedSells,
      count: limitedSells.length,
      totalCount:
        notApprovedCount +
        partiallyDeliveredCount +
        approvedCount +
        cancelledCount +
        deliveredCount,
      isDefaultView: true,
      statusCounts: {
        NOT_APPROVED: notApprovedCount,
        PARTIALLY_DELIVERED: partiallyDeliveredCount,
        APPROVED: approvedCount,
        CANCELLED: cancelledCount,
        DELIVERED: deliveredCount,
      },
    };
  }

  // REGULAR FILTERING LOGIC - NO LIMIT when filtering/searching

  // Handle status filtering
  if (status) {
    if (status.includes(',')) {
      const statuses = status
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s);
      if (statuses.length > 0) {
        whereClause.saleStatus = { in: statuses };
      }
    } else {
      whereClause.saleStatus = status;
    }
  }

  // Handle customer name filtering
  if (customerName && customerName.trim()) {
    const customerNameLower = customerName.trim().toLowerCase();
    whereClause.customer = {
      name: {
        contains: customerNameLower,
        mode: 'insensitive',
      },
    };
  }

  // Handle date filtering
  try {
    if (startDate && endDate) {
      const startOfRange = new Date(startDate);
      const endOfRange = new Date(endDate);

      if (
        Number.isNaN(startOfRange.getTime()) ||
        Number.isNaN(endOfRange.getTime())
      ) {
        throw new Error('Invalid date format');
      }

      startOfRange.setHours(0, 0, 0, 0);
      endOfRange.setHours(23, 59, 59, 999);

      whereClause.createdAt = {
        gte: startOfRange,
        lte: endOfRange,
      };
    } else if (startDate && !endDate) {
      const startOfRange = new Date(startDate);
      if (Number.isNaN(startOfRange.getTime())) {
        throw new Error('Invalid start date format');
      }
      startOfRange.setHours(0, 0, 0, 0);
      whereClause.createdAt = { gte: startOfRange };
    } else if (endDate && !startDate) {
      const endOfRange = new Date(endDate);
      if (Number.isNaN(endOfRange.getTime())) {
        throw new Error('Invalid end date format');
      }
      endOfRange.setHours(23, 59, 59, 999);
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

      whereClause.createdAt = {
        gte: twelveMonthsAgo,
        lte: endOfRange,
      };
    } else {
      // When filtering without dates, show all records (no date limit)
      // Remove this else block to show all records regardless of date when filtering
      // If you want to keep some date limit for performance, you can adjust this
    }
  } catch (error) {
    throw new Error(`Invalid date: ${error.message}`);
  }

  // Execute the query WITHOUT pagination when filtering
  const sells = await prisma.sell.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    include: {
      branch: true,
      customer: true,
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      items: {
        include: {
          product: {
            include: {
              category: true,
            },
          },
          shop: true,
        },
      },
      SellStockCorrection: {
        select: {
          id: true,
          status: true,
          isChecked: true,
        },
      },
      _count: {
        select: { items: true },
      },
    },
  });

  const totalCount = sells.length;

  return {
    sells, // NO LIMIT applied when filtering
    count: sells.length,
    totalCount,
    isDefaultView: false,
    // Note: When filtering, pagination metadata doesn't apply since we return all results
  };
};
const getAllSellsuserweb = async ({
  startDate,
  endDate,
  userId,
  customerName,
  status, // This parameter should actually be called saleStatus for clarity
  page = 1,
  limit = 2000,
}) => {
  // Validate required parameters
  if (!userId) {
    throw new Error('User ID is required');
  }

  // Initialize where clause with required condition
  const whereClause = {
    createdById: userId,
  };
  // Fix: Use saleStatus instead of status
  if (status) {
    // Handle multiple statuses (comma-separated) or single status
    if (status.includes(',')) {
      const statuses = status
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s);
      if (statuses.length > 0) {
        // Fix: Use saleStatus field name
        whereClause.saleStatus = { in: statuses };
      }
    } else {
      // Fix: Use saleStatus field name
      whereClause.saleStatus = status;
    }
  }

  // Handle date filtering
  try {
    if (startDate && endDate) {
      // Both dates provided
      const startOfRange = new Date(startDate);
      const endOfRange = new Date(endDate);

      if (
        Number.isNaN(startOfRange.getTime()) ||
        Number.isNaN(endOfRange.getTime())
      ) {
        throw new Error('Invalid date format');
      }

      // Set start to beginning of day, end to end of day
      startOfRange.setHours(0, 0, 0, 0);
      endOfRange.setHours(23, 59, 59, 999);

      whereClause.createdAt = {
        gte: startOfRange,
        lte: endOfRange,
      };
    } else if (startDate && !endDate) {
      // Only start date provided
      const startOfRange = new Date(startDate);
      if (Number.isNaN(startOfRange.getTime())) {
        throw new Error('Invalid start date format');
      }
      startOfRange.setHours(0, 0, 0, 0);
      whereClause.createdAt = { gte: startOfRange };
    } else if (endDate && !startDate) {
      // Only end date provided
      const endOfRange = new Date(endDate);
      if (Number.isNaN(endOfRange.getTime())) {
        throw new Error('Invalid end date format');
      }
      endOfRange.setHours(23, 59, 59, 999);
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

      whereClause.createdAt = {
        gte: twelveMonthsAgo,
        lte: endOfRange,
      };
    } else {
      // No dates provided, default to last 12 months
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 2);
      whereClause.createdAt = { gte: twelveMonthsAgo };
    }
  } catch (error) {
    throw new Error(`Invalid date: ${error.message}`);
  }

  // Calculate pagination
  const skip = (page - 1) * limit;

  // Check available saleStatus values in database
  try {
    // Fix: Use the correct field name and enum values
    const distinctSaleStatuses = await prisma.sell.findMany({
      where: {
        createdById: userId,
        createdAt: whereClause.createdAt,
      },
      distinct: ['saleStatus'], // Fix: Use 'saleStatus' instead of 'status'
      select: {
        saleStatus: true, // Fix: Select saleStatus field
      },
    });

    // Also check counts for each status
    const statusCounts = await Promise.all(
      distinctSaleStatuses.map(async (item) => {
        const count = await prisma.sell.count({
          where: {
            createdById: userId,
            saleStatus: item.saleStatus, // Fix: Use saleStatus
            createdAt: whereClause.createdAt,
          },
        });
        return { status: item.saleStatus, count };
      }),
    );

    // Check specifically for the requested status
    if (status) {
      const requestedStatusCount = await prisma.sell.count({
        where: {
          createdById: userId,
          saleStatus: status.includes(',')
            ? {
                in: status
                  .split(',')
                  .map((s) => s.trim())
                  .filter((s) => s),
              }
            : status,
          createdAt: whereClause.createdAt,
        },
      });
    }
  } catch (error) {
    console.log('   Error checking saleStatuses:', error.message);
  }

  // Execute the query with pagination
  const [sells, totalCount] = await Promise.all([
    prisma.sell.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        branch: true,
        customer: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        items: {
          include: {
            product: {
              include: {
                category: true,
              },
            },
            shop: true,
          },
        },
        SellStockCorrection: {
          select: {
            id: true,
            status: true,
            isChecked: true, // Make sure this is included!
          },
        },
        _count: {
          select: { items: true },
        },
      },
    }),
    prisma.sell.count({
      where: whereClause,
    }),
  ]);

  // Apply customer name filtering in memory if needed
  let filteredSells = sells;
  if (customerName && customerName.trim()) {
    const customerNameLower = customerName.trim().toLowerCase();

    const beforeFilterCount = filteredSells.length;
    filteredSells = sells.filter(
      (sell) =>
        sell.customer &&
        sell.customer.name &&
        sell.customer.name.toLowerCase().includes(customerNameLower),
    );
  }

  return {
    sells: filteredSells,
    count: filteredSells.length,
    totalCount,
  };
};
// Get all Sells filtered by user's shops
const getAllSellsForStore = async ({
  startDate,
  endDate,
  userId,
  customerName,
  salesPersonName,
  status,
} = {}) => {
  // Validate required parameters
  if (!userId) {
    throw new Error('User ID is required');
  }

  // Get user's shops
  const userWithShops = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      shops: {
        select: { id: true },
      },
    },
  });

  if (!userWithShops || userWithShops.shops.length === 0) {
    return {
      sells: [],
      count: 0,
      totalCount: 0,
      isDefaultView: false,
    };
  }

  const userShopIds = userWithShops.shops.map((shop) => shop.id);

  // DETECT DEFAULT VIEW: Check if any filters are applied
  const hasNoStatusFilter =
    !status ||
    (typeof status === 'string' && status.trim() === '') ||
    status === 'all';
  const hasNoDateFilter = !startDate && !endDate;
  const hasNoCustomerFilter = !customerName || customerName.trim() === '';
  const hasNoSalesPersonFilter =
    !salesPersonName || salesPersonName.trim() === '';

  const isDefaultView =
    hasNoStatusFilter &&
    hasNoDateFilter &&
    hasNoCustomerFilter &&
    hasNoSalesPersonFilter;

  // For default view: Show all PARTIALLY_DELIVERED and APPROVED, plus last 10 DELIVERED
  // EXCLUDE: NOT_APPROVED and CANCELLED
  if (isDefaultView) {
    try {
      // Common where clause for shop filtering
      const shopFilter = {
        some: {
          shopId: {
            in: userShopIds,
          },
        },
      };

      // Get last 10 delivered sales
      const lastDeliveredQuery = {
        saleStatus: 'DELIVERED',
        items: shopFilter,
      };

      // Add date filtering for delivered sales (last 3 months for performance)
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      lastDeliveredQuery.saleDate = { gte: threeMonthsAgo };

      const [lastDeliveredSells, partiallyDeliveredSells, approvedSells] =
        await Promise.all([
          // Get last 10 delivered sales
          prisma.sell.findMany({
            where: lastDeliveredQuery,
            orderBy: { saleDate: 'desc' },
            take: 10,
            include: {
              branch: true,
              customer: true,
              createdBy: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
              items: {
                where: {
                  shopId: {
                    in: userShopIds,
                  },
                },
                include: {
                  product: {
                    include: {
                      category: true,
                    },
                  },
                  shop: true,
                },
              },
              SellStockCorrection: {
                select: {
                  id: true,
                  status: true,
                },
              },
              _count: {
                select: { items: true },
              },
            },
          }),

          // Get all PARTIALLY_DELIVERED sales
          prisma.sell.findMany({
            where: {
              saleStatus: 'PARTIALLY_DELIVERED',
              items: shopFilter,
            },
            orderBy: { saleDate: 'desc' },
            include: {
              branch: true,
              customer: true,
              createdBy: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
              items: {
                where: {
                  shopId: {
                    in: userShopIds,
                  },
                },
                include: {
                  product: {
                    include: {
                      category: true,
                    },
                  },
                  shop: true,
                },
              },
              SellStockCorrection: {
                select: {
                  id: true,
                  status: true,
                },
              },
              _count: {
                select: { items: true },
              },
            },
          }),

          // Get all APPROVED sales
          prisma.sell.findMany({
            where: {
              saleStatus: 'APPROVED',
              items: shopFilter,
            },
            orderBy: { saleDate: 'desc' },
            include: {
              branch: true,
              customer: true,
              createdBy: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
              items: {
                where: {
                  shopId: {
                    in: userShopIds,
                  },
                },
                include: {
                  product: {
                    include: {
                      category: true,
                    },
                  },
                  shop: true,
                },
              },
              SellStockCorrection: {
                select: {
                  id: true,
                  status: true,
                },
              },
              _count: {
                select: { items: true },
              },
            },
          }),
        ]);

      // Combine all results - ONLY INCLUDING: PARTIALLY_DELIVERED, APPROVED, and last 10 DELIVERED
      const allSells = [
        ...partiallyDeliveredSells,
        ...approvedSells,
        ...lastDeliveredSells, // Last 10 delivered only
      ];

      // Sort by saleDate descending
      allSells.sort((a, b) => new Date(b.saleDate) - new Date(a.saleDate));

      // Get counts for each status with shop filtering
      const [
        partiallyDeliveredCount,
        approvedCount,
        deliveredCount,
        notApprovedCount,
        cancelledCount,
      ] = await Promise.all([
        prisma.sell.count({
          where: {
            saleStatus: 'PARTIALLY_DELIVERED',
            items: shopFilter,
          },
        }),
        prisma.sell.count({
          where: {
            saleStatus: 'APPROVED',
            items: shopFilter,
          },
        }),
        prisma.sell.count({
          where: {
            saleStatus: 'DELIVERED',
            items: shopFilter,
          },
        }),
        prisma.sell.count({
          where: {
            saleStatus: 'NOT_APPROVED',
            items: shopFilter,
          },
        }),
        prisma.sell.count({
          where: {
            saleStatus: 'CANCELLED',
            items: shopFilter,
          },
        }),
      ]);

      return {
        sells: allSells,
        count: allSells.length,
        totalCount: partiallyDeliveredCount + approvedCount + deliveredCount,
        isDefaultView: true,
        statusCounts: {
          PARTIALLY_DELIVERED: partiallyDeliveredCount,
          APPROVED: approvedCount,
          DELIVERED: deliveredCount,
          NOT_APPROVED: notApprovedCount,
          CANCELLED: cancelledCount,
        },
      };
    } catch (error) {
      console.error('Error in default view:', error);
      throw error;
    }
  }

  // REGULAR FILTERING LOGIC (when user applies any filter)
  const whereClause = {
    items: {
      some: {
        shopId: {
          in: userShopIds,
        },
      },
    },
  };

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  // Convert string dates to Date objects if they exist
  const startDateObj = startDate ? new Date(startDate) : undefined;
  const endDateObj = endDate ? new Date(endDate) : undefined;

  // Build the date filter
  if (startDateObj && endDateObj) {
    // Adjust for end date to include the entire day
    const adjustedEndDate = new Date(endDateObj);
    adjustedEndDate.setHours(23, 59, 59, 999);

    whereClause.saleDate = {
      gte: startDateObj,
      lte: adjustedEndDate,
    };
  } else if (startDateObj) {
    whereClause.saleDate = {
      gte: startDateObj,
      lte: new Date(),
    };
  } else if (endDateObj) {
    // Adjust for end date to include the entire day
    const adjustedEndDate = new Date(endDateObj);
    adjustedEndDate.setHours(23, 59, 59, 999);

    whereClause.saleDate = {
      gte: twelveMonthsAgo,
      lte: adjustedEndDate,
    };
  } else {
    whereClause.saleDate = {
      gte: twelveMonthsAgo,
    };
  }

  // Filter by status if provided
  if (status && status !== 'all') {
    if (Array.isArray(status) && status.length > 0) {
      whereClause.saleStatus = {
        in: status,
      };
    } else if (typeof status === 'string') {
      whereClause.saleStatus = status;
    }
  } else if (status === 'all') {
    // Show all statuses including NOT_APPROVED and CANCELLED when 'all' is specified
    // No saleStatus filter applied
  } else {
    // Default for filtered view: exclude NOT_APPROVED (like original)
    whereClause.saleStatus = { not: 'NOT_APPROVED' };
  }

  try {
    const sells = await prisma.sell.findMany({
      where: whereClause,
      orderBy: {
        saleDate: 'desc',
      },
      include: {
        branch: true,
        customer: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        items: {
          where: {
            shopId: {
              in: userShopIds,
            },
          },
          include: {
            product: {
              include: {
                category: true,
              },
            },
            shop: true,
          },
        },
        SellStockCorrection: {
          select: {
            id: true,
            status: true,
          },
        },
        _count: {
          select: { items: true },
        },
      },
    });

    // Apply case-insensitive filtering in memory if needed
    let filteredSells = sells;

    if (customerName && customerName.trim()) {
      const customerNameLower = customerName.trim().toLowerCase();
      filteredSells = filteredSells.filter(
        (sell) =>
          sell.customer &&
          sell.customer.name.toLowerCase().includes(customerNameLower),
      );
    }

    if (salesPersonName && salesPersonName.trim()) {
      const salesPersonNameLower = salesPersonName.trim().toLowerCase();
      filteredSells = filteredSells.filter(
        (sell) =>
          sell.createdBy &&
          sell.createdBy.name.toLowerCase().includes(salesPersonNameLower),
      );
    }

    return {
      sells: filteredSells,
      count: filteredSells.length,
      totalCount: await prisma.sell.count({ where: whereClause }),
      isDefaultView: false,
    };
  } catch (error) {
    console.error('Error fetching sells:', error);
    throw error;
  }
};

const getAllSellsForStoreweb = async ({
  startDate,
  endDate,
  userId,
  customerName,
  salesPersonName,
  status,
} = {}) => {
  const whereClause = { saleStatus: { not: 'NOT_APPROVED' } };
  const twelveMonthsAgo = subMonths(new Date(), 12);

  // Convert string dates to Date objects if they exist
  const startDateObj = startDate ? new Date(startDate) : undefined;
  const endDateObj = endDate ? new Date(endDate) : undefined;

  // Build the date filter
  if (startDateObj && endDateObj) {
    // Adjust for end date to include the entire day
    const adjustedEndDate = new Date(endDateObj);
    adjustedEndDate.setHours(23, 59, 59, 999);

    whereClause.saleDate = {
      gte: startDateObj,
      lte: adjustedEndDate,
    };
  } else if (startDateObj) {
    whereClause.saleDate = {
      gte: startDateObj,
      lte: new Date(),
    };
  } else if (endDateObj) {
    // Adjust for end date to include the entire day
    const adjustedEndDate = new Date(endDateObj);
    adjustedEndDate.setHours(23, 59, 59, 999);

    whereClause.saleDate = {
      gte: twelveMonthsAgo,
      lte: adjustedEndDate,
    };
  } else {
    whereClause.saleDate = {
      gte: twelveMonthsAgo,
    };
  }

  // Filter by status if provided
  if (status) {
    if (Array.isArray(status) && status.length > 0) {
      whereClause.saleStatus = {
        in: status,
      };
    } else if (typeof status === 'string') {
      whereClause.saleStatus = status;
    } else if (status === 'all') {
      delete whereClause.saleStatus;
    }
  }

  // If userId is provided, get user's shops and filter sells by those shops
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

    if (userWithShops && userWithShops.shops.length > 0) {
      userShopIds = userWithShops.shops.map((shop) => shop.id);

      // Check if there are any SellItems with these shop IDs
      const sellItemsCount = await prisma.sellItem.count({
        where: {
          shopId: {
            in: userShopIds,
          },
        },
      });

      // Check which sells have items with these shop IDs
      if (sellItemsCount > 0) {
        const sellsWithShopItems = await prisma.sell.findMany({
          where: {
            saleStatus: { not: 'NOT_APPROVED' },
            items: {
              some: {
                shopId: {
                  in: userShopIds,
                },
              },
            },
          },
          take: 5,
          select: {
            id: true,
            invoiceNo: true,
            saleDate: true,
            items: {
              select: {
                id: true,
                shopId: true,
              },
            },
          },
        });
      }

      whereClause.items = {
        some: {
          shopId: {
            in: userShopIds,
          },
        },
      };
    } else {
      return {
        sells: [],
        count: 0,
      };
    }
  }

  try {
    const sells = await prisma.sell.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        branch: true,
        customer: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        items: {
          include: {
            product: {
              include: {
                category: true,
              },
            },
            shop: true,
          },
        },
        SellStockCorrection: {
          select: {
            id: true,
            status: true, // Only including status as requested
          },
        },
        _count: {
          select: { items: true },
        },
      },
    });
    // If we're using case-insensitive filtering in memory
    let filteredSells = sells;

    // Apply case-insensitive filtering in memory if needed
    if (customerName && customerName.trim()) {
      const customerNameLower = customerName.trim().toLowerCase();
      filteredSells = filteredSells.filter(
        (sell) =>
          sell.customer &&
          sell.customer.name.toLowerCase().includes(customerNameLower),
      );
    }

    if (salesPersonName && salesPersonName.trim()) {
      const salesPersonNameLower = salesPersonName.trim().toLowerCase();
      filteredSells = filteredSells.filter(
        (sell) =>
          sell.createdBy &&
          sell.createdBy.name.toLowerCase().includes(salesPersonNameLower),
      );
    }

    return {
      sells: filteredSells,
      count: filteredSells.length,
    };
  } catch (error) {
    console.error('Error fetching sells:', error);
    throw error;
  }
};

const unlockSell = async (id) => {
  const currentSell = await prisma.sell.findUnique({
    where: { id },
  });

  if (!currentSell) {
    throw new Error(`Sell with id ${id} not found`);
  }

  const newLockedState = !currentSell.locked;

  // Always set lockedAt to current time when changing state
  const sell = await prisma.sell.update({
    where: { id },
    data: {
      locked: newLockedState,
      lockedAt: new Date(), // Always set to current time
    },
  });

  return sell;
};
// Helper function to save file
const addSellFiles = async (sellId, userId, structuredFiles = {}) => {
  // Validate userId
  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'User ID is required');
  }

  // Check if sell exists
  const existingSell = await prisma.sell.findUnique({
    where: { id: sellId },
    select: {
      id: true,
      invoiceNo: true,
      imageUrl: true,
      documentUrl: true,
    },
  });

  if (!existingSell) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Sale not found');
  }

  try {
    let { imageUrl } = existingSell;
    let { documentUrl } = existingSell;

    // Handle image upload from structuredFiles
    if (structuredFiles.image && structuredFiles.image.length > 0) {
      const imageFile = structuredFiles.image[0];
      let fileUrl = imageFile.path;

      // Convert Windows path to URL format
      fileUrl = fileUrl.replace(/\\/g, '/');
      // Extract the path after 'uploads'
      const uploadsIndex = fileUrl.indexOf('/uploads/');
      if (uploadsIndex !== -1) {
        fileUrl = fileUrl.substring(uploadsIndex);
      } else {
        // If no 'uploads' in path, just use the filename
        fileUrl = `/uploads/sell/images/${imageFile.filename}`;
      }

      imageUrl = fileUrl;
    }

    // Handle document upload from structuredFiles
    if (structuredFiles.document && structuredFiles.document.length > 0) {
      const documentFile = structuredFiles.document[0];
      let fileUrl = documentFile.path;

      // Convert Windows path to URL format
      fileUrl = fileUrl.replace(/\\/g, '/');
      // Extract the path after 'uploads'
      const uploadsIndex = fileUrl.indexOf('/uploads/');
      if (uploadsIndex !== -1) {
        fileUrl = fileUrl.substring(uploadsIndex);
      } else {
        // If no 'uploads' in path, just use the filename
        fileUrl = `/uploads/sell/documents/${documentFile.filename}`;
      }

      documentUrl = fileUrl;
    }

    // Update sell record with both files
    const updatedSell = await prisma.$transaction(async (prismaTx) => {
      const sell = await prismaTx.sell.update({
        where: { id: sellId },
        data: {
          imageUrl,
          documentUrl,
        },
      });

      // Create log entry
      const addedFiles = [];
      if (structuredFiles.image && structuredFiles.image.length > 0)
        addedFiles.push('image');
      if (structuredFiles.document && structuredFiles.document.length > 0)
        addedFiles.push('document');

      if (addedFiles.length > 0) {
        await prismaTx.log.create({
          data: {
            action: `Added/Updated ${addedFiles.join(' and ')} for sale ${
              existingSell.invoiceNo
            }`,
            userId,
          },
        });
      }

      return sell;
    });

    return {
      success: true,
      message: `${structuredFiles.image ? 'Image' : ''}${
        structuredFiles.image && structuredFiles.document ? ' and ' : ''
      }${
        structuredFiles.document ? 'Document' : ''
      } added/updated successfully`,
      data: updatedSell,
    };
  } catch (error) {
    if (error.code) {
      console.error('Prisma error code:', error.code);
    }

    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to add files to sale: ${error.message}`,
    );
  }
};
const addSellPayment = async (sellId, paymentData, userId) => {
  const { amount } = paymentData;

  try {
    // Validate amount
    if (!amount || amount <= 0) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Payment amount must be greater than 0',
      );
    }

    // Get the sell with current status
    const sell = await prisma.sell.findUnique({
      where: { id: sellId },
      include: {
        items: true,
        sellPayments: {
          // ✅ Changed from 'payments' to 'sellPayments'
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!sell) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Sell not found');
    }

    // Check if sell is cancelled
    if (sell.saleStatus === 'CANCELLED') {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Cannot add payment to cancelled sale',
      );
    }

    // Calculate current total paid
    const currentTotalPaid = sell.sellPayments.reduce(
      // ✅ Changed from 'payments' to 'sellPayments'
      (sum, payment) => sum + payment.amount,
      0,
    );
    const newTotalPaid = currentTotalPaid + amount;

    // Check if payment exceeds grand total
    if (newTotalPaid > sell.grandTotal) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Payment amount (${amount}) exceeds remaining balance (${
          sell.grandTotal - currentTotalPaid
        })`,
      );
    }

    // Determine new payment status
    let paymentStatus;
    if (newTotalPaid >= sell.grandTotal) {
      paymentStatus = 'PAID';
    } else if (newTotalPaid > 0 && newTotalPaid < sell.grandTotal) {
      paymentStatus = 'PARTIAL';
    } else {
      paymentStatus = 'PENDING';
    }

    // Calculate new balance (remaining amount to pay)
    const newBalance = sell.grandTotal - newTotalPaid;
    // Create payment and update sell in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create payment record
      const payment = await tx.sellPayment.create({
        data: {
          sellId,
          amount,
          createdById: userId,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      // Update sell with new totals and status
      const updatedSell = await tx.sell.update({
        where: { id: sellId },
        data: {
          totalPaid: newTotalPaid,
          balance: newBalance,
          paymentStatus,
        },
        include: {
          customer: true,
          branch: true,
          sellPayments: {
            // ✅ Changed from 'payments' to 'sellPayments'
            orderBy: { createdAt: 'desc' },
            include: {
              createdBy: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      return { payment, sell: updatedSell };
    });

  

    return result;
  } catch (error) {
    console.error('=== addSellPayment ERROR ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);

    // Log Prisma-specific error details
    if (error.code) {
      console.error('Prisma error code:', error.code);
      console.error('Prisma error meta:', error.meta);
    }

    // Log any response data if it's an API error
    if (error.response) {
      console.error('Error response:', error.response.data);
    }

    console.error('=== addSellPayment ERROR END ===');
    throw error;
  }
};
const getSellPaymentHistory = async (sellId) => {
  const sell = await prisma.sell.findUnique({
    where: { id: sellId },
    include: {
      sellPayments: {
        // ✅ Changed from 'payments' to 'sellPayments'
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
      customer: true,
    },
  });

  if (!sell) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Sell not found');
  }
  return {
    sell: {
      id: sell.id,
      invoiceNo: sell.invoiceNo,
      grandTotal: sell.grandTotal,
      totalPaid: sell.totalPaid,
      balance: sell.balance,
      paymentStatus: sell.paymentStatus,
      customer: sell.customer,
    },
    payments: sell.sellPayments, // ✅ Changed from 'payments' to 'sellPayments'
    summary: {
      totalPayments: sell.sellPayments.length, // ✅ Changed from 'payments' to 'sellPayments'
      totalAmountPaid: sell.totalPaid,
      remainingBalance: sell.balance,
      isFullyPaid: sell.paymentStatus === 'PAID',
    },
  };
};

module.exports = {
  unlockSell,
  getSellById,
  getSellByInvoiceNo,
  getAllSells,
  createSell,
  updateSell,
  deleteSell,
  deliverAllSaleItems,
  completeSaleDelivery,
  updateSaleStatus,
  updatePaymentStatus,
  cancelSale,
  partialSaleDelivery,
  getAllSellsuser,
  getAllSellsuserweb,
  getAllSellsForStore,
  getAllSellsForStoreweb,
  getSellByIdByuser,
  addSellFiles,
  addSellPayment,
  getSellPaymentHistory,
};
