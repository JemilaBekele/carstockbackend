/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */
const httpStatus = require('http-status');
const { subMonths } = require('date-fns');

const ApiError = require('../utils/ApiError');
const prisma = require('./prisma');

// Get SellStockCorrection by ID
const getSellStockCorrectionById = async (id) => {
  const sellStockCorrection = await prisma.sellStockCorrection.findUnique({
    where: { id },
    include: {
      sell: true,
      createdBy: true,
      updatedBy: true,
      items: {
        include: {
          product: true,
          shop: true,
         
        },
      },
    },
  });
  return sellStockCorrection;
};
const getSellStockCorrectionfilterId = async (sellId, userId) => {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }

    if (!sellId) {
      throw new Error('Sell ID is required');
    }

    // First, get the user with their assigned shops
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        shops: {
          select: { id: true },
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Get user's shop IDs for permission check
    const userShopIds = user.shops.map((shop) => shop.id);

    // Get ALL sell stock corrections for this sell ID
    const sellStockCorrections = await prisma.sellStockCorrection.findMany({
      where: { sellId },
      include: {
        sell: true,
        createdBy: true,
        updatedBy: true,
        items: {
          include: {
            product: true,
            shop: true,
            unitOfMeasure: true,
            batches: {
              include: {
                batch: true,
              },
            },
          },
        },
      },
    });

    if (!sellStockCorrections || sellStockCorrections.length === 0) {
      return [];
    }

    // If user is admin, return all corrections without filtering
    if (user.admin) {
      return sellStockCorrections;
    }

    // Filter items within each correction based on user's shop permissions
    const filteredCorrections = sellStockCorrections.map((correction) => {
      const filteredItems = correction.items.filter((item) => {
        // If item has no shop, include it
        if (!item.shopId) {
          return true;
        }

        // Check if user has permission for this shop
        return userShopIds.includes(item.shopId);
      });

      return {
        ...correction,
        items: filteredItems,
      };
    });

    return filteredCorrections;
  } catch (error) {
    throw new Error(`Failed to get sell stock corrections: ${error.message}`);
  }
};

// Get SellStockCorrection by reference
const getSellStockCorrectionByReference = async (reference) => {
  const sellStockCorrection = await prisma.sellStockCorrection.findFirst({
    where: { reference },
  });
  return sellStockCorrection;
};

// Get all SellStockCorrections
const getAllSellStockCorrections = async ({ startDate, endDate } = {}) => {
  const whereClause = {};
  const threeMonthsAgo = subMonths(new Date(), 12); // Default time range

  // Convert string dates to Date objects if they exist
  const startDateObj = startDate ? new Date(startDate) : undefined;
  const endDateObj = endDate ? new Date(endDate) : undefined;

  // Build the date filter
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
      gte: threeMonthsAgo,
      lte: endDateObj,
    };
  } else {
    whereClause.createdAt = {
      gte: threeMonthsAgo,
    };
  }

  const sellStockCorrections = await prisma.sellStockCorrection.findMany({
    where: whereClause,
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      sell: true,
      _count: {
        select: { items: true },
      },
    },
  });

  return {
    sellStockCorrections,
    count: sellStockCorrections.length,
  };
};

// Get SellStockCorrections by Sell ID
const getSellStockCorrectionsBySellId = async (sellId) => {
  const sellStockCorrections = await prisma.sellStockCorrection.findMany({
    where: {
      sellId,
    },
    include: {
      sell: true,
      createdBy: true,
      updatedBy: true,

      items: {
        include: {
          product: true,
          shop: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
  return sellStockCorrections;
};

const createSellStockCorrection = async (sellStockCorrectionBody, userId) => {
  const { items: itemsString, ...restSellStockCorrectionBody } =
    sellStockCorrectionBody;
  const items =
    typeof itemsString === 'string' ? JSON.parse(itemsString) : itemsString;

  // Validate items array exists
  if (!items || !Array.isArray(items)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Sell stock correction must have items array',
    );
  }

  // Filter out items with zero quantity
  const nonZeroItems = items.filter((item) => Number(item.quantity) !== 0);

  // Check if there are any items left after filtering
  if (nonZeroItems.length === 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Sell stock correction must have at least one item with non-zero quantity',
    );
  }

  // Validate individual item properties and calculate totals
  let totalCorrectionAmount = 0;
  const itemsWithCalculations = nonZeroItems.map((item, index) => {
    if (!item.productId) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Item ${index + 1} is missing required field (productId)`,
      );
    }
    if (!item.unitOfMeasureId) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Item ${index + 1} is missing required field (unitOfMeasureId)`,
      );
    }
    if (
      item.quantity === undefined ||
      item.quantity === null ||
      Number.isNaN(Number(item.quantity))
    ) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Item ${index + 1} has invalid quantity`,
      );
    }
    // Removed zero quantity validation since we filtered them out

    if (!item.unitPrice || item.unitPrice < 0) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Item ${index + 1} must have a valid unit price`,
      );
    }

    // Validate batches if provided
    if (item.batches && Array.isArray(item.batches)) {
      const batchQuantitySum = item.batches.reduce(
        (sum, batch) => sum + (batch.quantity || 0),
        0,
      );
      // Use the actual quantity (could be negative) for comparison
      if (batchQuantitySum !== item.quantity) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          `Item ${
            index + 1
          } batch quantities (${batchQuantitySum}) must match item quantity (${
            item.quantity
          })`,
        );
      }
    }

    // Calculate total price for the item
    const totalPrice = item.unitPrice * Math.abs(item.quantity);
    // For negative quantities, subtract from total
    totalCorrectionAmount += item.quantity >= 0 ? totalPrice : -totalPrice;

    return {
      ...item,
      totalPrice,
    };
  });

  // Clean up empty string values
  const cleanedSellStockCorrectionBody = {
    ...restSellStockCorrectionBody,
    sellId:
      restSellStockCorrectionBody.sellId === ''
        ? null
        : restSellStockCorrectionBody.sellId,
  };

  // Create the sell stock correction
  const sellStockCorrection = await prisma.sellStockCorrection.create({
    data: {
      ...cleanedSellStockCorrectionBody,
      total: totalCorrectionAmount,
      createdById: userId,
      updatedById: userId,
      items: {
        create: itemsWithCalculations.map((item) => ({
          productId: item.productId,
          shopId: item.shopId || null,
          unitOfMeasureId: item.unitOfMeasureId,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          quantity: item.quantity, // Keep the original negative/positive value
          batches:
            item.batches && item.batches.length > 0
              ? {
                  create: item.batches.map((batch) => ({
                    batchId: batch.batchId,
                    quantity: batch.quantity,
                  })),
                }
              : undefined,
        })),
      },
    },
    include: {
      items: {
        include: {
          product: true,
          unitOfMeasure: true,
          shop: true,
          batches: {
            include: {
              batch: true,
            },
          },
        },
      },
    },
  });

  return sellStockCorrection;
};

// Update SellStockCorrection
const updateSellStockCorrection = async (
  sellStockCorrectionId,
  sellStockCorrectionBody,
  userId,
) => {
  // Check if sell stock correction exists
  const existingSellStockCorrection = await getSellStockCorrectionById(
    sellStockCorrectionId,
  );
  if (!existingSellStockCorrection) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Sell stock correction not found');
  }

  // Cannot update approved or rejected sell stock corrections
  if (existingSellStockCorrection.status !== 'PENDING') {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Cannot update ${existingSellStockCorrection.status.toLowerCase()} sell stock correction`,
    );
  }

  // Check if reference already exists (excluding current sell stock correction)
  if (
    sellStockCorrectionBody.reference &&
    sellStockCorrectionBody.reference !== existingSellStockCorrection.reference
  ) {
    if (
      await getSellStockCorrectionByReference(sellStockCorrectionBody.reference)
    ) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Sell stock correction reference already taken',
      );
    }
  }

  // Parse items if it's a string
  const { items: itemsString, ...restSellStockCorrectionBody } =
    sellStockCorrectionBody;
  const items =
    typeof itemsString === 'string' ? JSON.parse(itemsString) : itemsString;

  // Validate items
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Sell stock correction must have at least one item',
    );
  }

  // Validate individual item properties and calculate totals
  let totalCorrectionAmount = 0;
  const itemsWithCalculations = items.map((item, index) => {
    if (!item.productId) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Item ${index + 1} is missing required field (productId)`,
      );
    }
    if (!item.unitOfMeasureId) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Item ${index + 1} is missing required field (unitOfMeasureId)`,
      );
    }
    if (
      item.quantity === undefined ||
      item.quantity === null ||
      Number.isNaN(Number(item.quantity))
    ) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Item ${index + 1} has invalid quantity`,
      );
    }
    // Accept negative numbers but not zero
    if (Number(item.quantity) === 0) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Item ${index + 1} quantity cannot be zero`,
      );
    }
    if (!item.unitPrice || item.unitPrice < 0) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Item ${index + 1} must have a valid unit price`,
      );
    }

    // Validate batches if provided
    if (item.batches && Array.isArray(item.batches)) {
      const batchQuantitySum = item.batches.reduce(
        (sum, batch) => sum + (batch.quantity || 0),
        0,
      );
      // Use the actual quantity (could be negative) for comparison
      if (batchQuantitySum !== item.quantity) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          `Item ${
            index + 1
          } batch quantities (${batchQuantitySum}) must match item quantity (${
            item.quantity
          })`,
        );
      }
    }

    // Calculate total price for the item
    const totalPrice = item.unitPrice * Math.abs(item.quantity);
    // For negative quantities, subtract from total
    totalCorrectionAmount += item.quantity >= 0 ? totalPrice : -totalPrice;

    return {
      ...item,
      totalPrice,
    };
  });

  // Clean up empty string values
  const cleanedSellStockCorrectionBody = {
    ...restSellStockCorrectionBody,
    sellId:
      restSellStockCorrectionBody.sellId === ''
        ? null
        : restSellStockCorrectionBody.sellId,
  };

  // Update the sell stock correction inside a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Delete all existing batches first
    await tx.sellStockCorrectionBatch.deleteMany({
      where: {
        correctionItem: {
          correctionId: sellStockCorrectionId,
        },
      },
    });

    // Delete all existing items
    await tx.sellStockCorrectionItem.deleteMany({
      where: { correctionId: sellStockCorrectionId },
    });

    // Update sell stock correction with cleaned body and new items
    const sellStockCorrection = await tx.sellStockCorrection.update({
      where: { id: sellStockCorrectionId },
      data: {
        ...cleanedSellStockCorrectionBody,
        total: totalCorrectionAmount,
        updatedById: userId,
        items: {
          create: itemsWithCalculations.map((item) => ({
            productId: item.productId,
            shopId: item.shopId || null,
            unitOfMeasureId: item.unitOfMeasureId,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            quantity: item.quantity, // Keep the original negative/positive value
            batches:
              item.batches && item.batches.length > 0
                ? {
                    create: item.batches.map((batch) => ({
                      batchId: batch.batchId,
                      quantity: batch.quantity,
                    })),
                  }
                : undefined,
          })),
        },
      },
      include: {
        items: {
          include: {
            product: true,
            unitOfMeasure: true,
            shop: true,
            batches: {
              include: {
                batch: true,
              },
            },
          },
        },
      },
    });

    return sellStockCorrection;
  });

  return result;
};

const approveSellStockCorrection = async (
  sellStockCorrectionId,
  userId,
  deliveredItemIds = [],
) => {
  console.log('=== Starting approveSellStockCorrection ===');
  console.log('Input params:', {
    sellStockCorrectionId,
    userId,
    deliveredItemIds,
  });

  const sellStockCorrection = await getSellStockCorrectionById(
    sellStockCorrectionId,
  );

  console.log('Retrieved sellStockCorrection:', {
    id: sellStockCorrection?.id,
    status: sellStockCorrection?.status,
    sellId: sellStockCorrection?.sellId,
    reference: sellStockCorrection?.reference,
    notes: sellStockCorrection?.notes,
  });

  if (!sellStockCorrection) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Sell stock correction not found');
  }

  if (sellStockCorrection.status === 'APPROVED') {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Sell stock correction is already ${sellStockCorrection.status.toLowerCase()}`,
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    // First, update the itemSaleStatus for the delivered items
    if (deliveredItemIds.length > 0) {
      console.log('Updating delivered items:', deliveredItemIds);

      const updateResult = await tx.sellStockCorrectionItem.updateMany({
        where: {
          id: { in: deliveredItemIds },
          correctionId: sellStockCorrectionId,
        },
        data: {
          itemSaleStatus: 'DELIVERED',
          updatedAt: new Date(),
        },
      });

      console.log('Update result:', updateResult);
    }

    // Fetch updated sell stock correction with items
    const updatedSellStockCorrection = await tx.sellStockCorrection.findUnique({
      where: { id: sellStockCorrectionId },
      include: {
        items: {
          include: {
            batches: true,
            unitOfMeasure: true,
          },
        },
      },
    });

    console.log('Updated sellStockCorrection with items:', {
      id: updatedSellStockCorrection?.id,
      status: updatedSellStockCorrection?.status,
      itemsCount: updatedSellStockCorrection?.items?.length,
      items: updatedSellStockCorrection?.items?.map((item) => ({
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        unitOfMeasureId: item.unitOfMeasureId,
        itemSaleStatus: item.itemSaleStatus,
        shopId: item.shopId,
        batches: item.batches?.map((b) => ({
          batchId: b.batchId,
          quantity: b.quantity,
        })),
      })),
    });

    if (!updatedSellStockCorrection) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        'Sell stock correction not found after update',
      );
    }

    // Determine the final status based on delivered items
    const allItemsCount = updatedSellStockCorrection.items.length;
    const deliveredItemsCount = updatedSellStockCorrection.items.filter(
      (item) => item.itemSaleStatus === 'DELIVERED',
    ).length;

    console.log('Status calculation:', {
      allItemsCount,
      deliveredItemsCount,
      itemsStatuses: updatedSellStockCorrection.items.map(
        (i) => i.itemSaleStatus,
      ),
    });

    let finalStatus = 'APPROVED';
    if (deliveredItemsCount === 0) {
      finalStatus = 'PENDING';
    } else if (deliveredItemsCount > 0 && deliveredItemsCount < allItemsCount) {
      finalStatus = 'PARTIAL';
    }

    console.log('Final status determined:', finalStatus);

    // Get unit of measures
    const unitOfMeasureIds = updatedSellStockCorrection.items
      .map((item) => item.unitOfMeasureId)
      .filter((id) => id);

    const unitOfMeasures = await tx.unitOfMeasure.findMany({
      where: { id: { in: unitOfMeasureIds } },
    });

    const unitOfMeasureMap = unitOfMeasures.reduce((acc, uom) => {
      acc[uom.id] = uom;
      return acc;
    }, {});

    console.log('Unit of measure map:', Object.keys(unitOfMeasureMap));

    // Get the associated sell with its items to calculate net total
    let sell = null;
    let netTotalAdjustment = 0;

    if (updatedSellStockCorrection.sellId) {
      console.log(
        'Fetching associated sell:',
        updatedSellStockCorrection.sellId,
      );

      sell = await tx.sell.findUnique({
        where: { id: updatedSellStockCorrection.sellId },
        include: {
          items: {
            include: {
              batches: {
                include: {
                  batch: true,
                },
              },
              unitOfMeasure: true,
            },
          },
        },
      });

      console.log('Retrieved sell:', {
        id: sell?.id,
        NetTotal: sell?.NetTotal,
        itemsCount: sell?.items?.length,
      });

      if (!sell) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Associated sell not found');
      }

      // Calculate net total adjustment based on DELIVERED stock correction items only
      console.log('Calculating net total adjustment for delivered items:');

      netTotalAdjustment = updatedSellStockCorrection.items.reduce(
        (adjustment, correctionItem) => {
          // Only include delivered items in the adjustment
          if (correctionItem.itemSaleStatus !== 'DELIVERED') {
            console.log(
              `Skipping item ${correctionItem.id} - status: ${correctionItem.itemSaleStatus}`,
            );
            return adjustment;
          }

          const unitOfMeasure =
            unitOfMeasureMap[correctionItem.unitOfMeasureId];

          if (!unitOfMeasure) {
            throw new ApiError(
              httpStatus.BAD_REQUEST,
              `Unit of measure not found for item ${correctionItem.id}`,
            );
          }

          console.log(`Processing correction item:`, {
            id: correctionItem.id,
            productId: correctionItem.productId,
            quantity: correctionItem.quantity,
            unitPrice: correctionItem.unitPrice,
            status: correctionItem.itemSaleStatus,
            isAddition: correctionItem.quantity < 0,
            isRemoval: correctionItem.quantity > 0,
          });

          // Calculate adjustment: quantity × unitPrice
          // Negative quantity = negative adjustment (customer pays less)
          // Positive quantity = positive adjustment (customer pays more)
          const itemAdjustment =
            correctionItem.quantity * correctionItem.unitPrice;
          console.log(
            `Item adjustment: ${correctionItem.quantity} × ${correctionItem.unitPrice} = ${itemAdjustment}`,
          );

          return adjustment + itemAdjustment;
        },
        0,
      );

      console.log('Final netTotalAdjustment:', netTotalAdjustment);
      console.log('Original sell NetTotal:', sell.NetTotal);
      console.log('New NetTotal would be:', sell.NetTotal + netTotalAdjustment);
    }

    // Prepare all operations for each DELIVERED sell stock correction item
    console.log('Preparing stock operations for delivered items:');

    const operationsPromises = updatedSellStockCorrection.items.map(
      async (item) => {
        // Only process delivered items
        if (item.itemSaleStatus !== 'DELIVERED') {
          console.log(
            `Skipping stock update for item ${item.id} - status: ${item.itemSaleStatus}`,
          );
          return [];
        }

        const unitOfMeasure = unitOfMeasureMap[item.unitOfMeasureId];

        if (!unitOfMeasure) {
          throw new ApiError(
            httpStatus.BAD_REQUEST,
            `Unit of measure not found for item ${item.id}`,
          );
        }

        const itemOperations = [];

        // Define variables for clarity
        const quantityToUse = item.quantity;
        const isAddition = quantityToUse < 0; // Negative quantity = add to stock
        const isRemoval = quantityToUse > 0; // Positive quantity = remove from stock
        const movementType = isAddition ? 'IN' : 'OUT'; // IN for additions, OUT for removals
        const absoluteQuantity = Math.abs(quantityToUse);
        const notes = isAddition
          ? `Sell stock addition: ${
              updatedSellStockCorrection.notes || 'correction'
            }`
          : `Sell stock subtraction: ${
              updatedSellStockCorrection.notes || 'correction'
            }`;

        console.log(`Processing item ${item.id}:`, {
          quantityToUse,
          isAddition,
          isRemoval,
          movementType,
          absoluteQuantity,
          notes,
          hasBatches: item.batches && item.batches.length > 0,
          shopId: item.shopId,
        });

        // Handle batch-level stock updates if batches are specified
        // Handle batch-level stock updates if batches are specified
        if (item.batches && item.batches.length > 0) {
          console.log(
            `Item ${item.id} has ${item.batches.length} batches:`,
            item.batches.map((b) => ({
              batchId: b.batchId,
              quantity: b.quantity,
            })),
          );

          // Check stock availability before processing (only for removals)
          if (isRemoval) {
            console.log(
              `Checking stock availability for removal of ${absoluteQuantity} units`,
            );

            for (const correctionBatch of item.batches) {
              const batchQuantity = Math.abs(correctionBatch.quantity);
              const { batchId } = correctionBatch;

              if (item.shopId) {
                // Check current stock for this batch
                const currentStock = await tx.shopStock.findUnique({
                  where: {
                    shopId_batchId: {
                      shopId: item.shopId,
                      batchId,
                    },
                  },
                });

                console.log(
                  `Batch ${batchId} current stock:`,
                  currentStock?.quantity || 0,
                );

                if (!currentStock || currentStock.quantity < batchQuantity) {
                  throw new ApiError(
                    httpStatus.BAD_REQUEST,
                    `Insufficient stock for batch ${batchId}. Available: ${
                      currentStock?.quantity || 0
                    }, Required: ${batchQuantity}`,
                  );
                }
              }
            }
          }

          // Process each batch (ONCE, using absolute values)
          for (const correctionBatch of item.batches) {
            const batchQuantity = Math.abs(correctionBatch.quantity); // ALWAYS use absolute value
            const { batchId } = correctionBatch;

            if (item.shopId) {
              console.log(`Creating batch operations for batch ${batchId}:`, {
                action: isAddition ? 'increment' : 'decrement',
                quantity: batchQuantity, // Using absolute value
              });

              itemOperations.push(
                tx.shopStock.upsert({
                  where: {
                    shopId_batchId: {
                      shopId: item.shopId,
                      batchId,
                    },
                  },
                  update: {
                    quantity: isAddition
                      ? { increment: batchQuantity } // Add to stock
                      : { decrement: batchQuantity }, // Remove from stock
                  },
                  create: {
                    shopId: item.shopId,
                    batchId,
                    quantity: isAddition ? batchQuantity : -batchQuantity,
                    unitOfMeasureId: item.unitOfMeasureId,
                    status: 'Available',
                  },
                }),
              );

              // Create stock ledger entry for each batch
              itemOperations.push(
                tx.stockLedger.create({
                  data: {
                    batchId,
                    shopId: item.shopId,
                    movementType,
                    quantity: batchQuantity, // Using absolute value for ledger
                    unitOfMeasureId: item.unitOfMeasureId,
                    reference:
                      updatedSellStockCorrection.reference ||
                      `SELL-CORRECTION-${updatedSellStockCorrection.id}`,
                    userId,
                    notes: `${notes} (Batch: ${batchId})`,
                    movementDate: new Date(),
                  },
                }),
              );
            }
          }
        }

        console.log(
          `Item ${item.id} generated ${itemOperations.length} operations`,
        );
        return itemOperations;
      },
    );

    // Wait for all promises to resolve and flatten the results
    const operationsArrays = await Promise.all(operationsPromises);
    const allOperations = operationsArrays.flat();

    console.log(`Total operations to execute: ${allOperations.length}`);

    // Execute all operations
    if (allOperations.length > 0) {
      console.log('Executing all operations...');
      await Promise.all(allOperations);
      console.log('All operations completed successfully');
    } else {
      console.log('No operations to execute');
    }

    // Update sell's net total if there's an associated sell and netTotalAdjustment is not zero
    if (sell && netTotalAdjustment !== 0) {
      const newNetTotal = sell.NetTotal + netTotalAdjustment;

      // Ensure net total doesn't go negative
      const finalNetTotal = Math.max(0, newNetTotal);

      console.log(
        `Updating sell NetTotal: ${sell.NetTotal} + ${netTotalAdjustment} = ${newNetTotal}`,
      );
      console.log(`Final NetTotal: ${finalNetTotal}`);

      await tx.sell.update({
        where: { id: sell.id },
        data: {
          NetTotal: finalNetTotal,
          updatedById: userId,
          updatedAt: new Date(),
        },
      });

      console.log('Sell NetTotal updated successfully');
    } else {
      console.log('No net total update needed:', {
        hasSell: !!sell,
        netTotalAdjustment,
        sellNetTotal: sell?.NetTotal,
      });
    }

    // Update sell stock correction status based on delivery status
    console.log(`Updating sell stock correction status to: ${finalStatus}`);

    const finalSellStockCorrection = await tx.sellStockCorrection.update({
      where: { id: sellStockCorrectionId },
      data: {
        status: finalStatus,
        updatedById: userId,
        updatedAt: new Date(),
      },
      include: {
        items: {
          select: {
            id: true,
            itemSaleStatus: true,
            productId: true,
            quantity: true,
          },
        },
      },
    });

    console.log('Final sell stock correction:', {
      id: finalSellStockCorrection.id,
      status: finalSellStockCorrection.status,
      items: finalSellStockCorrection.items,
    });

    // Create log entry
    const deliveredItemsText =
      deliveredItemIds.length > 0
        ? `Marked ${deliveredItemIds.length} items as delivered`
        : 'No items marked as delivered';

    await tx.log.create({
      data: {
        action: `Updated sell stock correction ${
          updatedSellStockCorrection.reference || updatedSellStockCorrection.id
        }. Status: ${finalStatus}. ${deliveredItemsText}. ${
          sell && netTotalAdjustment !== 0
            ? `Net total adjusted by ${netTotalAdjustment}`
            : 'No net total adjustment'
        }`,
        userId,
      },
    });

    console.log('=== Transaction completed successfully ===');

    return {
      ...finalSellStockCorrection,
      netTotalAdjustment: netTotalAdjustment || 0,
      previousNetTotal: sell ? sell.NetTotal : null,
      newNetTotal:
        sell && netTotalAdjustment !== 0
          ? Math.max(0, sell.NetTotal + netTotalAdjustment)
          : sell
          ? sell.NetTotal
          : null,
      deliveredItemsCount,
      totalItemsCount: allItemsCount,
    };
  });

  console.log('=== Function returning result ===');
  return result;
};

// const deleteSellStockCorrection = async (id, userId) => {
//   console.log('=== Starting deleteSellStockCorrection ===');
//   console.log('Correction ID:', id);
//   console.log('User ID:', userId);

//   const existingSellStockCorrection = await getSellStockCorrectionById(id);
//   if (!existingSellStockCorrection) {
//     console.error('❌ Sell stock correction not found:', id);
//     throw new ApiError(httpStatus.NOT_FOUND, 'Sell stock correction not found');
//   }

//   console.log('✅ Found sell stock correction:', {
//     id: existingSellStockCorrection.id,
//     status: existingSellStockCorrection.status,
//     reference: existingSellStockCorrection.reference,
//     sellId: existingSellStockCorrection.sellId,
//     notes: existingSellStockCorrection.notes,
//   });

//   return prisma.$transaction(async (tx) => {
//     // Get all sell stock correction items with their batches for reversal
//     const correctionItemsWithBatches =
//       await tx.sellStockCorrectionItem.findMany({
//         where: { correctionId: id },
//         include: {
//           batches: {
//             include: {
//               batch: true,
//             },
//           },
//           shop: true,
//           unitOfMeasure: true,
//           product: true,
//         },
//       });

//     console.log(
//       `📦 Found ${correctionItemsWithBatches.length} correction items`,
//     );

//     // Get the batch ID from the correction item for precise matching
//     const correctionItem = correctionItemsWithBatches[0];
//     const targetBatchId = correctionItem?.batches[0]?.batchId;
//     const targetReference = existingSellStockCorrection.reference;

//     console.log(`🎯 Looking for ledger with:`);
//     console.log(`   - Reference: ${targetReference}`);
//     console.log(`   - Batch ID: ${targetBatchId}`);
//     console.log(`   - Correction notes: ${correctionItem?.notes || 'N/A'}`);

//     // Prepare operations for stock reversal
//     const reversalOperations = [];
//     let netTotalAdjustment = 0;

//     // If the correction was approved or partially approved, reverse the stock movements
//     if (['APPROVED', 'PARTIAL'].includes(existingSellStockCorrection.status)) {
//       console.log(
//         '🔄 Reversing stock movements for approved/partial correction',
//       );

//       // Get the associated sell
//       let sell = null;
//       if (existingSellStockCorrection.sellId) {
//         sell = await tx.sell.findUnique({
//           where: { id: existingSellStockCorrection.sellId },
//           include: {
//             items: {
//               include: {
//                 unitOfMeasure: true,
//               },
//             },
//           },
//         });
//         console.log('✅ Found associated sell:', sell?.invoiceNo);
//       }

//       // Find potential stock ledger entries
//       console.log('\n🔍 Searching for stock ledger entries...');

//       const potentialLedgers = await tx.stockLedger.findMany({
//         where: {
//           OR: [
//             // Match by reference
//             {
//               reference: targetReference,
//             },
//             // Match by notes containing batch ID
//             {
//               notes: {
//                 contains: targetBatchId,
//               },
//             },
//             // Match by notes containing correction patterns
//             {
//               OR: [
//                 {
//                   notes: {
//                     contains: 'Sell stock addition',
//                   },
//                 },
//                 {
//                   notes: {
//                     contains: 'Sell stock subtraction',
//                   },
//                 },
//               ],
//             },
//           ],
//         },
//       });

//       console.log(
//         `Found ${potentialLedgers.length} potential stock ledger entries:`,
//       );
//       potentialLedgers.forEach((ledger, index) => {
//         console.log(`\n  ${index + 1}. ID: ${ledger.id}`);
//         console.log(`     Reference: ${ledger.reference}`);
//         console.log(`     Notes: ${ledger.notes}`);
//         console.log(`     Movement: ${ledger.movementType}`);
//         console.log(`     Quantity: ${ledger.quantity}`);
//       });

//       // Find the SPECIFIC correction ledger using multiple criteria
//       let correctionLedgerId = null;
//       let matchedLedger = null;

//       for (const ledger of potentialLedgers) {
//         // Check if this ledger matches our correction
//         const matchesReference = ledger.reference === targetReference;
//         const matchesBatch = ledger.notes.includes(targetBatchId);
//         const isCorrectionNote =
//           ledger.notes.includes('Sell stock addition') ||
//           ledger.notes.includes('Sell stock subtraction');
//         const isNotReconciliation = !ledger.notes.includes(
//           'Sale delivery to customer',
//         );

//         // Score the match (higher is better)
//         let matchScore = 0;
//         if (matchesReference) matchScore += 3;
//         if (matchesBatch) matchScore += 3;
//         if (isCorrectionNote) matchScore += 2;
//         if (isNotReconciliation) matchScore += 1;

//         console.log(`\n  Evaluating ledger ${ledger.id}:`);
//         console.log(
//           `     - Matches reference (${targetReference}): ${matchesReference}`,
//         );
//         console.log(`     - Contains batch ${targetBatchId}: ${matchesBatch}`);
//         console.log(`     - Is correction note: ${isCorrectionNote}`);
//         console.log(`     - Not reconciliation: ${isNotReconciliation}`);
//         console.log(`     - Match score: ${matchScore}/9`);

//         // If we find a perfect match (reference + batch + correction note)
//         if (
//           matchesReference &&
//           matchesBatch &&
//           isCorrectionNote &&
//           isNotReconciliation
//         ) {
//           correctionLedgerId = ledger.id;
//           matchedLedger = ledger;
//           console.log(`   ⭐ PERFECT MATCH FOUND!`);
//           break;
//         }

//         // Otherwise track the best match
//         if (matchScore > 5 && !correctionLedgerId) {
//           correctionLedgerId = ledger.id;
//           matchedLedger = ledger;
//           console.log(`   📍 Good match found (score: ${matchScore})`);
//         }
//       }

//       // Delete the matched ledger if found
//       if (correctionLedgerId && matchedLedger) {
//         console.log(`\n✅ Found matching correction ledger:`);
//         console.log(`   ID: ${correctionLedgerId}`);
//         console.log(`   Notes: ${matchedLedger.notes}`);
//         console.log(`   Reference: ${matchedLedger.reference}`);

//         await tx.stockLedger.delete({
//           where: { id: correctionLedgerId },
//         });
//         console.log(`✅ Deleted correction ledger: ${correctionLedgerId}`);
//       } else {
//         console.log('⚠️ No matching correction ledger found to delete');

//         // Debug: Show all ledgers that might be related
//         console.log('\n🔍 Debug: All ledgers with reference', targetReference);
//         const refLedgers = potentialLedgers.filter(
//           (l) => l.reference === targetReference,
//         );
//         refLedgers.forEach((ledger, i) => {
//           console.log(
//             `  ${i + 1}. ${ledger.id}: ${ledger.notes.substring(0, 60)}...`,
//           );
//         });
//       }

//       // Process each correction item for stock reversal
//       correctionItemsWithBatches.forEach((item) => {
//         if (
//           existingSellStockCorrection.status === 'PARTIAL' &&
//           item.itemSaleStatus !== 'DELIVERED'
//         ) {
//           console.log(
//             `⏭️ Skipping non-delivered item ${item.id} for partial correction`,
//           );
//           return;
//         }

//         const originalQuantity = item.quantity;
//         const isAddition = originalQuantity > 0;
//         const absoluteQuantity = Math.abs(originalQuantity);

//         console.log(`\n  📊 Processing item ${item.id}:`, {
//           originalQuantity,
//           isAddition,
//           absoluteQuantity,
//           shopId: item.shopId,
//           itemSaleStatus: item.itemSaleStatus,
//         });

//         if (sell) {
//           if (isAddition) {
//             const itemValueAdjustment = absoluteQuantity * item.unitPrice;
//             netTotalAdjustment -= itemValueAdjustment;
//             console.log(
//               `    Net total adjustment: -${itemValueAdjustment} (reverse addition)`,
//             );
//           } else {
//             const sellItem = sell.items.find(
//               (s) => s.productId === item.productId && s.shopId === item.shopId,
//             );
//             const priceToUse = sellItem?.unitPrice || item.unitPrice;
//             const itemValueAdjustment = absoluteQuantity * priceToUse;
//             netTotalAdjustment += itemValueAdjustment;
//             console.log(
//               `    Net total adjustment: +${itemValueAdjustment} (reverse subtraction)`,
//             );
//           }
//         }

//         if (item.batches && item.batches.length > 0) {
//           console.log(`    Item has ${item.batches.length} batches`);

//           item.batches.forEach((correctionBatch) => {
//             const batchQuantity = Math.abs(correctionBatch.quantity);
//             const { batchId } = correctionBatch;

//             if (item.shopId) {
//               console.log(`    Reversing batch ${batchId}:`, {
//                 action: isAddition ? 'decrement' : 'increment',
//                 quantity: batchQuantity,
//               });

//               reversalOperations.push(
//                 tx.shopStock.update({
//                   where: {
//                     shopId_batchId: {
//                       shopId: item.shopId,
//                       batchId,
//                     },
//                   },
//                   data: {
//                     quantity: isAddition
//                       ? { decrement: batchQuantity }
//                       : { increment: batchQuantity },
//                   },
//                 }),
//               );
//             }
//           });
//         }
//       });

//       // Reverse net total adjustment
//       if (sell && netTotalAdjustment !== 0) {
//         const newNetTotal = sell.NetTotal + netTotalAdjustment;
//         const finalNetTotal = Math.max(0, newNetTotal);

//         console.log(`\n💰 Adjusting sell NetTotal:`, {
//           original: sell.NetTotal,
//           adjustment: netTotalAdjustment,
//           new: newNetTotal,
//           final: finalNetTotal,
//         });

//         reversalOperations.push(
//           tx.sell.update({
//             where: { id: sell.id },
//             data: {
//               NetTotal: finalNetTotal,
//               grandTotal: finalNetTotal,
//               updatedById: userId,
//               updatedAt: new Date(),
//             },
//           }),
//         );
//       }

//       // Execute all reversal operations
//       if (reversalOperations.length > 0) {
//         console.log(
//           `\n⚡ Executing ${reversalOperations.length} reversal operations...`,
//         );
//         await Promise.all(reversalOperations);
//         console.log('✅ All reversal operations completed');
//       }
//     }

//     // Delete correction batches, items, and the correction itself
//     console.log('\n🗑️ Deleting sell stock correction batches...');
//     const deletedBatches = await tx.sellStockCorrectionBatch.deleteMany({
//       where: {
//         correctionItem: {
//           correctionId: id,
//         },
//       },
//     });
//     console.log(`✅ Deleted ${deletedBatches.count} batches`);

//     console.log('🗑️ Deleting sell stock correction items...');
//     const deletedItems = await tx.sellStockCorrectionItem.deleteMany({
//       where: { correctionId: id },
//     });
//     console.log(`✅ Deleted ${deletedItems.count} items`);

//     console.log('🗑️ Deleting sell stock correction...');
//     await tx.sellStockCorrection.delete({
//       where: { id },
//     });
//     console.log('✅ Sell stock correction deleted');

//     // Create log entry
//     let logMessage = `Sell stock correction ${
//       existingSellStockCorrection.reference || id
//     } deleted`;

//     if (['APPROVED', 'PARTIAL'].includes(existingSellStockCorrection.status)) {
//       logMessage += ` - Stock reversal completed`;
//       if (netTotalAdjustment !== 0) {
//         logMessage += `, Net total adjusted by ${netTotalAdjustment}`;
//       }
//     }

//     console.log('\n📝 Creating log entry...');
//     await tx.log.create({
//       data: {
//         action: logMessage,
//         userId,
//       },
//     });

//     console.log('\n=== Delete operation completed successfully ===');

//     return {
//       message: `Sell stock correction deleted successfully`,
//       reversalPerformed: ['APPROVED', 'PARTIAL'].includes(
//         existingSellStockCorrection.status,
//       ),
//       netTotalAdjustment: netTotalAdjustment || 0,
//     };
//   });
// };
// Reject SellStockCorrection

const deleteSellStockCorrection = async (id, userId) => {
  console.log('=== Starting deleteSellStockCorrection ===');
  console.log('Correction ID:', id);
  console.log('User ID:', userId);

  const existingSellStockCorrection = await getSellStockCorrectionById(id);
  if (!existingSellStockCorrection) {
    console.error('❌ Sell stock correction not found:', id);
    throw new ApiError(httpStatus.NOT_FOUND, 'Sell stock correction not found');
  }

  console.log('✅ Found sell stock correction:', {
    id: existingSellStockCorrection.id,
    status: existingSellStockCorrection.status,
    reference: existingSellStockCorrection.reference,
    sellId: existingSellStockCorrection.sellId,
    notes: existingSellStockCorrection.notes,
  });

  return prisma.$transaction(async (tx) => {
    // Get all sell stock correction items for net total calculation
    const correctionItems = await tx.sellStockCorrectionItem.findMany({
      where: { correctionId: id },
    });

    console.log(`📦 Found ${correctionItems.length} correction items`);

    let netTotalAdjustment = 0;

    // If the correction was approved or partially approved, update the net total
    if (['APPROVED', 'PARTIAL'].includes(existingSellStockCorrection.status)) {
      console.log('💰 Calculating net total adjustment');

      // Get the associated sell
      let sell = null;
      if (existingSellStockCorrection.sellId) {
        sell = await tx.sell.findUnique({
          where: { id: existingSellStockCorrection.sellId },
          include: {
            items: {
              include: {
                unitOfMeasure: true,
              },
            },
          },
        });
        console.log('✅ Found associated sell:', sell?.invoiceNo);
      }

      // Calculate net total adjustment
      correctionItems.forEach((item) => {
        const originalQuantity = item.quantity;
        const isAddition = originalQuantity > 0;
        const absoluteQuantity = Math.abs(originalQuantity);

        if (sell) {
          if (isAddition) {
            const itemValueAdjustment = absoluteQuantity * item.unitPrice;
            netTotalAdjustment -= itemValueAdjustment;
            console.log(
              `  Item ${item.id}: -${itemValueAdjustment} (reverse addition)`,
            );
          } else {
            const sellItem = sell.items.find(
              (s) => s.productId === item.productId && s.shopId === item.shopId,
            );
            const priceToUse = sellItem?.unitPrice || item.unitPrice;
            const itemValueAdjustment = absoluteQuantity * priceToUse;
            netTotalAdjustment += itemValueAdjustment;
            console.log(
              `  Item ${item.id}: +${itemValueAdjustment} (reverse subtraction)`,
            );
          }
        }
      });

      // Update sell net total
      if (sell && netTotalAdjustment !== 0) {
        const newNetTotal = sell.NetTotal + netTotalAdjustment;
        const finalNetTotal = Math.max(0, newNetTotal);

        console.log(`\n💰 Adjusting sell NetTotal:`, {
          original: sell.NetTotal,
          adjustment: netTotalAdjustment,
          new: newNetTotal,
          final: finalNetTotal,
        });

        await tx.sell.update({
          where: { id: sell.id },
          data: {
            NetTotal: finalNetTotal,
            grandTotal: finalNetTotal,
            updatedById: userId,
            updatedAt: new Date(),
          },
        });
        console.log('✅ Sell net total updated');
      }
    }

    // Delete correction batches, items, and the correction itself
    console.log('\n🗑️ Deleting sell stock correction batches...');
    const deletedBatches = await tx.sellStockCorrectionBatch.deleteMany({
      where: {
        correctionItem: {
          correctionId: id,
        },
      },
    });
    console.log(`✅ Deleted ${deletedBatches.count} batches`);

    console.log('🗑️ Deleting sell stock correction items...');
    const deletedItems = await tx.sellStockCorrectionItem.deleteMany({
      where: { correctionId: id },
    });
    console.log(`✅ Deleted ${deletedItems.count} items`);

    console.log('🗑️ Deleting sell stock correction...');
    await tx.sellStockCorrection.delete({
      where: { id },
    });
    console.log('✅ Sell stock correction deleted');

    // Create log entry
    let logMessage = `Sell stock correction ${
      existingSellStockCorrection.reference || id
    } deleted`;

    if (['APPROVED', 'PARTIAL'].includes(existingSellStockCorrection.status)) {
      logMessage += ` - Net total adjustment completed`;
      if (netTotalAdjustment !== 0) {
        logMessage += `, Net total adjusted by ${netTotalAdjustment}`;
      }
    }

    console.log('\n📝 Creating log entry...');
    await tx.log.create({
      data: {
        action: logMessage,
        userId,
      },
    });

    console.log('\n=== Delete operation completed successfully ===');

    return {
      message: `Sell stock correction deleted successfully`,
      adjustmentPerformed: ['APPROVED', 'PARTIAL'].includes(
        existingSellStockCorrection.status,
      ),
      netTotalAdjustment: netTotalAdjustment || 0,
    };
  });
};
const rejectSellStockCorrection = async (sellStockCorrectionId, userId) => {
  const sellStockCorrection = await getSellStockCorrectionById(
    sellStockCorrectionId,
  );

  if (!sellStockCorrection) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Sell stock correction not found');
  }

  if (sellStockCorrection.status !== 'PENDING') {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Cannot reject ${sellStockCorrection.status.toLowerCase()} sell stock correction`,
    );
  }

  const updatedSellStockCorrection = await prisma.sellStockCorrection.update({
    where: { id: sellStockCorrectionId },
    data: {
      status: 'REJECTED',
      updatedById: userId,
    },
  });

  // Create log entry
  await prisma.log.create({
    data: {
      action: `Rejected sell stock correction ${
        sellStockCorrection.reference || sellStockCorrection.id
      }`,
      userId,
    },
  });

  return updatedSellStockCorrection;
};
const getSellByIdforsellcorrection = async (id) => {
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
              unitOfMeasure: true,
              category: true,
            },
          },
          shop: true,
          unitOfMeasure: true,
          batches: {
            include: {
              batch: {
                include: {
                  product: {
                    include: {
                      unitOfMeasure: true,
                      category: true,
                      subCategory: true,
                    },
                  },
                  store: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!sell) {
    return null;
  }

  // Collect all batch IDs and shop IDs to query shop stock in one go
  const batchIds = [];
  const shopBatchPairs = [];

  sell.items.forEach((item) => {
    item.batches.forEach((sellBatch) => {
      batchIds.push(sellBatch.batchId);
      shopBatchPairs.push({
        batchId: sellBatch.batchId,
        shopId: item.shopId,
      });
    });
  });

  // Get all relevant shop stock records in one query
  const shopStocks = await prisma.shopStock.findMany({
    where: {
      OR: shopBatchPairs.map((pair) => ({
        batchId: pair.batchId,
        shopId: pair.shopId,
        status: 'Available',
      })),
    },
    include: {
      unitOfMeasure: true,
      shop: true,
    },
  });

  // Create a map for quick lookup: { `${batchId}-${shopId}`: shopStock }
  const shopStockMap = new Map();
  shopStocks.forEach((stock) => {
    const key = `${stock.batchId}-${stock.shopId}`;
    shopStockMap.set(key, stock);
  });

  // Enhance items with batch availability
  const enhancedItems = sell.items.map((item) => {
    const batchesWithAvailability = item.batches.map((sellBatch) => {
      const key = `${sellBatch.batchId}-${item.shopId}`;
      const shopStock = shopStockMap.get(key);

      return {
        ...sellBatch,
        batch: {
          ...sellBatch.batch,
          availableQuantity: shopStock ? shopStock.quantity : 0,
          availableShopStock: shopStock || null,
        },
      };
    });

    return {
      ...item,
      batches: batchesWithAvailability,
    };
  });

  return {
    ...sell,
    items: enhancedItems,
  };
};
const markAsCheckedSellStockCorrection = async (
  sellStockCorrectionId,
  userId,
) => {
  const sellStockCorrection = await getSellStockCorrectionById(
    sellStockCorrectionId,
  );

  if (!sellStockCorrection) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Sell stock correction not found');
  }

  // Optional: Add validation based on your business logic
  // For example, you might want to ensure it's only checked when in a specific status
  if (sellStockCorrection.isChecked) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Sell stock correction is already checked',
    );
  }

  const updatedSellStockCorrection = await prisma.sellStockCorrection.update({
    where: { id: sellStockCorrectionId },
    data: {
      isChecked: true,
    },
  });

  // Create log entry
  await prisma.log.create({
    data: {
      action: `Marked sell stock correction ${
        sellStockCorrection.reference || sellStockCorrection.id
      } as checked`,
      userId,
    },
  });

  return updatedSellStockCorrection;
};
module.exports = {
  getSellStockCorrectionById,
  getSellStockCorrectionByReference,
  getAllSellStockCorrections,
  getSellStockCorrectionsBySellId,
  createSellStockCorrection,
  updateSellStockCorrection,
  deleteSellStockCorrection,
  approveSellStockCorrection,
  rejectSellStockCorrection,
  getSellByIdforsellcorrection,
  getSellStockCorrectionfilterId,
  markAsCheckedSellStockCorrection,
};
