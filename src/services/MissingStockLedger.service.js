const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const prisma = require('./prisma');

const createMissingStockLedgerForSale = async (saleId, userId) => {
  console.log('=== Starting Missing Stock Ledger Creation ===');
  console.log('Sale ID:', saleId);
  console.log('User ID:', userId);
  console.log('Timestamp:', new Date().toISOString());

  try {
    const sell = await prisma.sell.findUnique({
      where: { id: saleId },
      include: {
        items: {
          include: {
            batches: {
              include: {
                batch: {
                  select: {
                    id: true,
                    batchNumber: true, // Changed from batchNo to batchNumber
                    expiryDate: true,
                  },
                },
              },
            },
            product: {
              select: {
                id: true,
                name: true,
                productCode: true,
              },
            },
            unitOfMeasure: {
              select: {
                id: true,
                name: true,
              },
            },
            shop: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!sell) {
      console.error('❌ Sale not found with ID:', saleId);
      throw new ApiError(httpStatus.NOT_FOUND, 'Sale not found');
    }

    console.log('✅ Sale found:', {
      invoiceNo: sell.invoiceNo,
      status: sell.saleStatus,
      totalItems: sell.items.length,
      saleDate: sell.createdAt,
    });

    // Only process delivered or partially delivered sales
    if (!['DELIVERED', 'PARTIALLY_DELIVERED'].includes(sell.saleStatus)) {
      console.error('❌ Invalid sale status for ledger creation:', {
        saleId: sell.id,
        invoiceNo: sell.invoiceNo,
        status: sell.saleStatus,
        requiredStatuses: ['DELIVERED', 'PARTIALLY_DELIVERED'],
      });
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Cannot create stock ledger for sale with status: ${sell.saleStatus}. Only DELIVERED or PARTIALLY_DELIVERED sales are eligible.`,
      );
    }

    console.log('🔄 Starting transaction...');

    const result = await prisma.$transaction(
      async (tx) => {
        const createdLedgers = [];
        const missingLedgers = [];
        const errors = [];

        console.log('\n📦 Processing sale items...');

        // Process each sell item
        for (const sellItem of sell.items) {
          // Helper function to get batch number with fallbacks
          const getBatchNumber = (batch) => {
            if (batch?.batchNumber) return batch.batchNumber;
            if (batch?.id) return `BATCH-${batch.id.substring(0, 8)}...`;
            return 'NO_BATCH_INFO';
          };

          // Helper function to format batch info for display
          const formatBatchInfo = (sellItemBatch) => {
            const batchNo = getBatchNumber(sellItemBatch.batch);
            return {
              batchId: sellItemBatch.batchId,
              batchNumber: batchNo,
              quantity: sellItemBatch.quantity,
              expiryDate: sellItemBatch.batch?.expiryDate,
            };
          };

          console.log(`\n🔍 Processing Item ${sellItem.id}:`, {
            product: sellItem.product?.name || 'Unknown',
            productproductCode: sellItem.product?.productCode || 'Unknown',
            status: sellItem.itemSaleStatus,
            shopId: sellItem.shopId,
            shopName: sellItem.shop?.name || 'Unknown',
            quantity: sellItem.quantity,
            batchesCount: sellItem.batches?.length || 0,
            unitOfMeasure: sellItem.unitOfMeasure?.name || 'Unknown',
          });

          // Skip items that are not delivered
          if (sellItem.itemSaleStatus !== 'DELIVERED') {
            console.log(
              `⏭️ Skipping non-delivered item: ${sellItem.id} (Status: ${sellItem.itemSaleStatus})`,
            );
            continue;
          }

          // Skip items without batches
          if (!sellItem.batches || sellItem.batches.length === 0) {
            const error = {
              itemId: sellItem.id,
              productName: sellItem.product?.name,
              error: 'No batches found for this delivered item',
            };
            errors.push(error);
            console.error(`❌ ${error.error}`, {
              itemId: sellItem.id,
              productName: sellItem.product?.name,
              quantity: sellItem.quantity,
            });
            continue;
          }

          console.log(
            `✅ Item is DELIVERED with ${sellItem.batches.length} batch(es)`,
          );

          // Process each batch for this item
          for (const sellItemBatch of sellItem.batches) {
            const batchInfo = formatBatchInfo(sellItemBatch);

            console.log(`\n  📊 Processing Batch:`, batchInfo);

            try {
              // Check if stock ledger already exists for this batch and sale
              const existingLedger = await tx.stockLedger.findFirst({
                where: {
                  batchId: sellItemBatch.batchId,
                  shopId: sellItem.shopId,
                  movementType: 'OUT',
                  reference: `Sell-${sell.invoiceNo}`,
                  OR: [
                    { notes: { contains: sellItem.id } },
                    { notes: { contains: `Item: ${sellItem.id}` } },
                  ],
                },
              });

              if (existingLedger) {
                console.log(
                  `  ⏭️ Ledger already exists for batch ${batchInfo.batchNumber}:`,
                  {
                    ledgerId: existingLedger.id,
                    reference: existingLedger.reference,
                    existingQuantity: existingLedger.quantity,
                  },
                );
                // Ledger already exists, skip
                continue;
              }

              console.log(
                `  🔍 No existing ledger found, checking shop stock...`,
              );

              // Verify that shop stock was actually reduced
              const shopStock = await tx.shopStock.findUnique({
                where: {
                  shopId_batchId: {
                    shopId: sellItem.shopId,
                    batchId: sellItemBatch.batchId,
                  },
                },
                include: {
                  batch: {
                    select: {
                      batchNumber: true, // Changed from batchNo to batchNumber
                    },
                  },
                },
              });

              console.log(`  📦 Shop stock status:`, {
                exists: !!shopStock,
                currentQuantity: shopStock?.quantity || 0,
                previousStock: shopStock
                  ? shopStock.quantity + sellItemBatch.quantity
                  : 'N/A',
                batchNumber:
                  shopStock?.batch?.batchNumber || batchInfo.batchNumber,
              });

              // Create the missing stock ledger entry
              console.log(`  ✨ Creating missing ledger entry...`);

              // Set all dates to match the sale date for consistency
              const saleDate = sell.createdAt;
              const now = new Date();

              const ledgerEntry = await tx.stockLedger.create({
                data: {
                  batchId: sellItemBatch.batchId,
                  shopId: sellItem.shopId,
                  movementType: 'OUT',
                  quantity: sellItemBatch.quantity,
                  unitOfMeasureId: sellItem.unitOfMeasureId,
                  reference: `Sell-${sell.invoiceNo}`,
                  userId, // Make sure this is userId, not user
                  notes: `Sale delivery to customer - Item: ${
                    sellItem.id
                  }, Product: ${sellItem.product?.name || 'Unknown'}, Batch: ${
                    batchInfo.batchNumber
                  }`,
                  movementDate: saleDate, // Use the sell creation date for movement
                  createdAt: now, // Current timestamp for when we're creating this
                  updatedAt: now, // Set updatedAt to now as well
                },
              });

              console.log(`  ✅ Ledger created successfully:`, {
                ledgerId: ledgerEntry.id,
                quantity: ledgerEntry.quantity,
                batchId: ledgerEntry.batchId,
                batchNumber: batchInfo.batchNumber,
                movementDate: ledgerEntry.movementDate,
                createdAt: ledgerEntry.createdAt,
              });

              createdLedgers.push({
                ledgerId: ledgerEntry.id,
                batchId: sellItemBatch.batchId,
                batchNumber: batchInfo.batchNumber,
                batchExpiry: sellItemBatch.batch?.expiryDate,
                shopId: sellItem.shopId,
                shopName: sellItem.shop?.name,
                quantity: sellItemBatch.quantity,
                itemId: sellItem.id,
                productId: sellItem.productId,
                productName: sellItem.product?.name || 'Unknown',
                productproductCode: sellItem.product?.productCode,
                unitOfMeasure: sellItem.unitOfMeasure?.name,
                previousStock: shopStock
                  ? shopStock.quantity + sellItemBatch.quantity
                  : 'Unknown',
                currentStock: shopStock ? shopStock.quantity : 'Unknown',
                movementDate: saleDate,
                createdAt: now,
              });
            } catch (error) {
              console.error(
                `  ❌ Error processing batch ${batchInfo.batchNumber}:`,
                {
                  error: error.message,
                  stack: error.stack,
                  batchDetails: {
                    batchId: sellItemBatch.batchId,
                    batchNumber: batchInfo.batchNumber,
                    quantity: sellItemBatch.quantity,
                    expiryDate: sellItemBatch.batch?.expiryDate,
                  },
                  itemDetails: {
                    itemId: sellItem.id,
                    productId: sellItem.productId,
                    productName: sellItem.product?.name,
                    shopId: sellItem.shopId,
                    shopName: sellItem.shop?.name,
                  },
                },
              );

              errors.push({
                itemId: sellItem.id,
                productName: sellItem.product?.name,
                batchId: sellItemBatch.batchId,
                batchNumber: batchInfo.batchNumber,
                error: error.message,
                stack: error.stack,
              });
            }
          }
        }

        // Log summary before creating reconciliation log
        console.log('\n=== Reconciliation Summary ===');
        console.log(`Sale: ${sell.invoiceNo} (${sell.id})`);
        console.log(`Total Items: ${sell.items.length}`);
        console.log(
          `Delivered Items: ${
            sell.items.filter((i) => i.itemSaleStatus === 'DELIVERED').length
          }`,
        );
        console.log(`Ledgers Created: ${createdLedgers.length}`);
        console.log(`Errors: ${errors.length}`);

        if (createdLedgers.length > 0) {
          console.log('\n📋 Created Ledgers Details:');
          createdLedgers.forEach((ledger, index) => {
            console.log(
              `  ${index + 1}. Batch: ${ledger.batchNumber} (${
                ledger.batchId
              })`,
            );
            console.log(
              `     Product: ${ledger.productName} (${
                ledger.productproductCode || 'No productCode'
              })`,
            );
            console.log(`     Shop: ${ledger.shopName || ledger.shopId}`);
            console.log(
              `     Quantity: ${ledger.quantity} ${ledger.unitOfMeasure || ''}`,
            );
            console.log(
              `     Stock Change: ${ledger.previousStock} → ${ledger.currentStock}`,
            );
            console.log(
              `     Movement Date: ${ledger.movementDate.toISOString()}`,
            );
            console.log(`     Created At: ${ledger.createdAt.toISOString()}`);
            if (ledger.batchExpiry) {
              console.log(
                `     Expiry: ${new Date(
                  ledger.batchExpiry,
                ).toLocaleDateString()}`,
              );
            }
          });
        }

        if (errors.length > 0) {
          console.log('\n❌ Errors Details:');
          errors.forEach((error, index) => {
            console.log(`  ${index + 1}. Item: ${error.itemId}`);
            console.log(`     Product: ${error.productName || 'Unknown'}`);
            console.log(`     Batch: ${error.batchNumber} (${error.batchId})`);
            console.log(`     Error: ${error.error}`);
          });
        }

        // Create a reconciliation log
        console.log('\n📝 Creating reconciliation log...');

        console.log('✅ Reconciliation log created successfully');

        return {
          success: true,
          saleId: sell.id,
          invoiceNo: sell.invoiceNo,
          saleStatus: sell.saleStatus,
          reconciliationDate: new Date(),
          stats: {
            totalItems: sell.items.length,
            deliveredItems: sell.items.filter(
              (i) => i.itemSaleStatus === 'DELIVERED',
            ).length,
            ledgersCreated: createdLedgers.length,
            ledgersMissing: missingLedgers.length,
            errors: errors.length,
          },
          createdLedgers,
          missingLedgers:
            missingLedgers.length > 0 ? missingLedgers : undefined,
          errors: errors.length > 0 ? errors : undefined,
        };
      },
      {
        timeout: 10000, // 10 second timeout
        isolationLevel: 'Serializable', // Highest isolation level
      },
    );

    console.log('=== Transaction completed successfully ===');
    console.log('=== End of Missing Stock Ledger Creation ===\n');

    return result;
  } catch (error) {
    console.error('❌ Fatal error in createMissingStockLedgerForSale:', {
      error: error.message,
      stack: error.stack,
      saleId,
      userId,
    });
    throw error;
  }
};

// Helper function to find all missing stock ledgers for multiple sales
const findMissingStockLedgers = async () => {
  // Get ALL sales with no filters
  const sales = await prisma.sell.findMany({
    include: {
      items: {
        include: {
          batches: true,
          shop: true,
          product: true,
          unitOfMeasure: true,
        },
      },
      customer: true,
      branch: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  const missingLedgers = [];
  const stats = {
    totalSales: sales.length,
    totalItems: 0,
    deliveredItems: 0,
    itemsWithBatches: 0,
    processedBatches: 0,
  };

  for (const sell of sales) {
    let saleHasMissing = false;

    for (const sellItem of sell.items) {
      stats.totalItems++;

      // Count delivered items
      if (sellItem.itemSaleStatus === 'DELIVERED') {
        stats.deliveredItems++;
      }

      // Skip items without batches
      if (!sellItem.batches || sellItem.batches.length === 0) {
        continue;
      }

      stats.itemsWithBatches++;

      for (const sellItemBatch of sellItem.batches) {
        stats.processedBatches++;

        // Check multiple possible reference formats
        const ledgerExists = await prisma.stockLedger.findFirst({
          where: {
            batchId: sellItemBatch.batchId,
            shopId: sellItem.shopId,
            movementType: 'OUT',
            OR: [
              { reference: `Sell-${sell.invoiceNo}` },
              { reference: `Sale-${sell.invoiceNo}` },
              { reference: sell.invoiceNo },
              { notes: { contains: sellItem.id } },
              { notes: { contains: `Item: ${sellItem.id}` } },
              { notes: { contains: `Sell-${sell.invoiceNo}` } },
            ],
          },
        });

        if (!ledgerExists) {
          missingLedgers.push({
            saleId: sell.id,
            invoiceNo: sell.invoiceNo,
            saleStatus: sell.saleStatus,
            saleDate: sell.createdAt,
            itemId: sellItem.id,
            itemStatus: sellItem.itemSaleStatus,
            productId: sellItem.productId,
            productName: sellItem.product?.name || 'Unknown',
            batchId: sellItemBatch.batchId,
            batchNumber: sellItemBatch.batch?.batchNo || 'Unknown',
            shopId: sellItem.shopId,
            shopName: sellItem.shop?.name || 'Unknown',
            quantity: sellItemBatch.quantity,
            unitOfMeasureId: sellItem.unitOfMeasureId,
            unitOfMeasureName: sellItem.unitOfMeasure?.name || 'Unknown',
            expectedReference: `Sell-${sell.invoiceNo}`,
          });

          saleHasMissing = true;
        }
      }
    }

    // Log if sale has missing ledgers
    if (saleHasMissing) {
      console.log(
        `Sale ${sell.invoiceNo} (${sell.id}) has missing stock ledger entries`,
      );
    }
  }

  // Log summary statistics
  console.log('\n=== Missing Stock Ledger Scan Summary ===');
  console.log(`Total Sales Scanned: ${stats.totalSales}`);
  console.log(`Total Items: ${stats.totalItems}`);
  console.log(`Delivered Items: ${stats.deliveredItems}`);
  console.log(`Items with Batches: ${stats.itemsWithBatches}`);
  console.log(`Total Batches Processed: ${stats.processedBatches}`);
  console.log(`Missing Ledger Entries Found: ${missingLedgers.length}`);
  console.log('========================================\n');

  // Group missing ledgers by sale for better reporting
  const groupedBySale = missingLedgers.reduce((acc, item) => {
    if (!acc[item.saleId]) {
      acc[item.saleId] = {
        saleId: item.saleId,
        invoiceNo: item.invoiceNo,
        saleStatus: item.saleStatus,
        saleDate: item.saleDate,
        items: [],
        totalMissing: 0,
      };
    }
    acc[item.saleId].items.push(item);
    acc[item.saleId].totalMissing++;
    return acc;
  }, {});

  return {
    summary: stats,
    missingLedgers,
    groupedBySale: Object.values(groupedBySale),
    totalMissing: missingLedgers.length,
    totalAffectedSales: Object.keys(groupedBySale).length,
  };
};

// Get all unique products from SellStockCorrections
const getAllProductsFromSellCorrections = async () => {
  const sellStockCorrections = await prisma.sellStockCorrection.findMany({
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
  });

  // Extract unique products from all correction items
  const productsMap = new Map();

  sellStockCorrections.forEach((correction) => {
    correction.items.forEach((item) => {
      if (item.product && !productsMap.has(item.product.id)) {
        productsMap.set(item.product.id, item.product);
      }
    });
  });

  // Convert map values to array
  const uniqueProducts = Array.from(productsMap.values());

  return {
    products: uniqueProducts,
    count: uniqueProducts.length,
  };
};
module.exports = {
  findMissingStockLedgers,
  createMissingStockLedgerForSale,
  getAllProductsFromSellCorrections,
};
