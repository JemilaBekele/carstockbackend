const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const prisma = require('./prisma');

// Get Branch by ID
const getBranchById = async (id) => {
  const branch = await prisma.branch.findUnique({
    where: { id },
    include: {
      Shop: true,
      Store: true,
      User: true,
    },
  });
  return branch;
};

// Get Branch by Name
const getBranchByName = async (name) => {
  const branch = await prisma.branch.findFirst({
    where: { name },
  });
  return branch;
};

// Get all Branches
const getAllBranches = async () => {
  const branches = await prisma.branch.findMany({
    orderBy: {
      name: 'asc',
    },
    include: {
      Shop: true,
      Store: true,
      User: true,
    },
  });

  return {
    branches,
    count: branches.length,
  };
};

// Create Branch
const createBranch = async (branchBody) => {
  // Check if branch with same name already exists
  if (await getBranchByName(branchBody.name)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Branch name already taken');
  }

  const branch = await prisma.branch.create({
    data: branchBody,
  });
  return branch;
};

// Update Branch
const updateBranch = async (id, updateBody) => {
  const existingBranch = await getBranchById(id);
  if (!existingBranch) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Branch not found');
  }

  // Check if name is being updated to an existing branch name
  if (updateBody.name && updateBody.name !== existingBranch.name) {
    if (await getBranchByName(updateBody.name)) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Branch name already taken');
    }
  }

  const updatedBranch = await prisma.branch.update({
    where: { id },
    data: updateBody,
    include: {
      Shop: true,
      Store: true,
      User: true,
    },
  });

  return updatedBranch;
};

// Delete Branch
const deleteBranch = async (id) => {
  const existingBranch = await getBranchById(id);
  if (!existingBranch) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Branch not found');
  }

  await prisma.branch.delete({
    where: { id },
  });

  return { message: 'Branch deleted successfully' };
};

const getAllProducts = async (userId) => {
  // First, get user with shop and store access if userId is provided
  let userShops = [];
  let userStores = [];

  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        shops: {
          include: {
            branch: {
              select: { id: true, name: true },
            },
          },
        },
        stores: {
          include: {
            branch: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });
    userShops = user?.shops || [];
    userStores = user?.stores || [];
  }

  // Get all branches, shops, and stores with their relationships
  const [branches, shops, stores] = await Promise.all([
    prisma.branch.findMany({
      select: { id: true, name: true },
    }),
    prisma.shop.findMany({
      include: {
        branch: {
          select: { id: true, name: true },
        },
      },
    }),
    prisma.store.findMany({
      include: {
        branch: {
          select: { id: true, name: true },
        },
      },
    }),
  ]);

  // Create maps for easy lookup
  const branchMap = Object.fromEntries(
    branches.map((branch) => [branch.id, branch.name]),
  );
  const shopMap = Object.fromEntries(shops.map((shop) => [shop.id, shop]));
  const storeMap = Object.fromEntries(stores.map((store) => [store.id, store]));

  // Get user's accessible shop and store IDs
  const userShopIds = userShops.map((shop) => shop.id);
  const userStoreIds = userStores.map((store) => store.id);

  // Build where clause based on user shop AND store access
  const whereClause =
    userId && (userShopIds.length > 0 || userStoreIds.length > 0)
      ? {
          OR: [
            // Include products that have stock in user's accessible shops
            {
              batches: {
                some: {
                  OR: [
                    {
                      ShopStock: {
                        some: {
                          shopId: { in: userShopIds },
                          status: 'Available',
                        },
                      },
                    },
                    {
                      StoreStock: {
                        some: {
                          storeId: { in: userStoreIds },
                          status: 'Available',
                        },
                      },
                    },
                  ],
                },
              },
            },
            // Also include products with additional prices in user's shops
            {
              AdditionalPrice: {
                some: {
                  shopId: { in: userShopIds },
                },
              },
            },
            // Include products that are in batches assigned to user's accessible stores
            {
              batches: {
                some: {
                  storeId: { in: userStoreIds },
                },
              },
            },
          ],
        }
      : {};

  // Get all products with their stock information
  const products = await prisma.product.findMany({
    where: whereClause,
    orderBy: {
      name: 'asc',
    },
    include: {
      category: true,
      subCategory: true,
      unitOfMeasure: true,
      AdditionalPrice: {
        include: {
          shop: {
            include: {
              branch: {
                select: { id: true, name: true },
              },
            },
          },
        },
      },
      batches: {
        where:
          userId && (userShopIds.length > 0 || userStoreIds.length > 0)
            ? {
                OR: [
                  { storeId: { in: userStoreIds } },
                  {
                    ShopStock: {
                      some: {
                        shopId: { in: userShopIds },
                      },
                    },
                  },
                  {
                    StoreStock: {
                      some: {
                        storeId: { in: userStoreIds },
                      },
                    },
                  },
                ],
              }
            : {},
        include: {
          ShopStock: {
            where: { status: 'Available' },
            include: {
              shop: {
                include: {
                  branch: {
                    select: { id: true, name: true },
                  },
                },
              },
            },
          },
          StoreStock: {
            where: { status: 'Available' },
            include: {
              store: {
                include: {
                  branch: {
                    select: { id: true, name: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  // Calculate detailed stock information for each product organized by branch
  const productsWithDetailedStock = products.map((product) => {
    const branchStocks = {};
    const batchStockDetails = [];

    let totalShopStock = 0;
    let totalStoreStock = 0;

    // Initialize all branches with empty shop and store structures
    branches.forEach((branch) => {
      branchStocks[branch.name] = {
        branchId: branch.id,
        shops: {},
        stores: {},
        totalShopStock: 0,
        totalStoreStock: 0,
        totalBranchStock: 0,
      };

      // Initialize shops for this branch (filtered by user access if applicable)
      shops
        .filter((shop) => shop.branchId === branch.id)
        .forEach((shop) => {
          if (userId && userShopIds.length > 0) {
            // Only include shops accessible to user
            if (userShopIds.includes(shop.id)) {
              branchStocks[branch.name].shops[shop.name] = 0;
            }
          } else {
            branchStocks[branch.name].shops[shop.name] = 0;
          }
        });

      // Initialize stores for this branch (filtered by user access if applicable)
      stores
        .filter((store) => store.branchId === branch.id)
        .forEach((store) => {
          if (userId && userStoreIds.length > 0) {
            // Only include stores accessible to user
            if (userStoreIds.includes(store.id)) {
              branchStocks[branch.name].stores[store.name] = 0;
            }
          } else {
            branchStocks[branch.name].stores[store.name] = 0;
          }
        });
    });

    // Calculate stock from all batches (filtered by user access)
    product.batches.forEach((batch) => {
      const batchBranchStocks = {};
      let batchTotalStock = 0;

      // Initialize branch structure for this batch
      branches.forEach((branch) => {
        batchBranchStocks[branch.name] = {
          shops: {},
          stores: {},
          totalStock: 0,
        };
      });

      // Process shop stock for this batch (filtered by user access)
      batch.ShopStock.forEach((shopStock) => {
        const { shop } = shopStock;
        const branchName = shop.branch.name;
        const { quantity } = shopStock;

        // Only include if user has access to this shop
        if (
          userId &&
          userShopIds.length > 0 &&
          !userShopIds.includes(shop.id)
        ) {
          return;
        }

        // Update main branch stocks
        branchStocks[branchName].shops[shop.name] =
          (branchStocks[branchName].shops[shop.name] || 0) + quantity;
        branchStocks[branchName].totalShopStock += quantity;
        branchStocks[branchName].totalBranchStock += quantity;

        // Update batch branch stocks
        batchBranchStocks[branchName].shops[shop.name] =
          (batchBranchStocks[branchName].shops[shop.name] || 0) + quantity;
        batchBranchStocks[branchName].totalStock += quantity;

        totalShopStock += quantity;
        batchTotalStock += quantity;
      });

      // Process store stock for this batch (filtered by user access)
      batch.StoreStock.forEach((storeStock) => {
        const { store } = storeStock;
        const branchName = store.branch.name;
        const { quantity } = storeStock;

        // Only include if user has access to this store
        if (
          userId &&
          userStoreIds.length > 0 &&
          !userStoreIds.includes(store.id)
        ) {
          return;
        }

        // Update main branch stocks
        branchStocks[branchName].stores[store.name] =
          (branchStocks[branchName].stores[store.name] || 0) + quantity;
        branchStocks[branchName].totalStoreStock += quantity;
        branchStocks[branchName].totalBranchStock += quantity;

        // Update batch branch stocks
        batchBranchStocks[branchName].stores[store.name] =
          (batchBranchStocks[branchName].stores[store.name] || 0) + quantity;
        batchBranchStocks[branchName].totalStock += quantity;

        totalStoreStock += quantity;
        batchTotalStock += quantity;
      });

      // Only add batch stock details if there's actual stock in accessible locations
      if (batchTotalStock > 0) {
        batchStockDetails.push({
          batchId: batch.id,
          batchNumber: batch.batchNumber,
          expiryDate: batch.expiryDate,
          price: batch.price,
          branchStocks: batchBranchStocks,
          totalStock: batchTotalStock,
        });
      }
    });

    const totalStock = totalShopStock + totalStoreStock;

    // Filter additional prices based on user shop access
    const filteredAdditionalPrices =
      userId && userShopIds.length > 0
        ? product.AdditionalPrice.filter(
            (price) => !price.shopId || userShopIds.includes(price.shopId),
          )
        : product.AdditionalPrice;

    return {
      ...product,
      AdditionalPrice: filteredAdditionalPrices,
      stockSummary: {
        branchStocks, // Organized by branch -> shops/stores
        totalShopStock,
        totalStoreStock,
        totalStock,
        batchStockDetails, // Detailed stock information per batch
      },
    };
  });

  // Calculate overall totals across all products organized by branch
  const overallTotals = {
    branchTotals: {},
    totalShopStock: 0,
    totalStoreStock: 0,
    totalAllStock: 0,
  };

  // Initialize branch totals structure (filtered by user access)
  branches.forEach((branch) => {
    overallTotals.branchTotals[branch.name] = {
      branchId: branch.id,
      shops: {},
      stores: {},
      totalShopStock: 0,
      totalStoreStock: 0,
      totalBranchStock: 0,
    };

    // Initialize shop totals for this branch (filtered by user access)
    shops
      .filter((shop) => shop.branchId === branch.id)
      .forEach((shop) => {
        if (userId && userShopIds.length > 0) {
          if (userShopIds.includes(shop.id)) {
            overallTotals.branchTotals[branch.name].shops[shop.name] = 0;
          }
        } else {
          overallTotals.branchTotals[branch.name].shops[shop.name] = 0;
        }
      });

    // Initialize store totals for this branch (filtered by user access)
    stores
      .filter((store) => store.branchId === branch.id)
      .forEach((store) => {
        if (userId && userStoreIds.length > 0) {
          if (userStoreIds.includes(store.id)) {
            overallTotals.branchTotals[branch.name].stores[store.name] = 0;
          }
        } else {
          overallTotals.branchTotals[branch.name].stores[store.name] = 0;
        }
      });
  });

  // Calculate totals across all products (filtered by user access)
  productsWithDetailedStock.forEach((product) => {
    Object.entries(product.stockSummary.branchStocks).forEach(
      ([branchName, branchData]) => {
        // Calculate shop-wise totals (filtered by user access)
        Object.entries(branchData.shops).forEach(([shopName, quantity]) => {
          // Find the shop ID for this shop name
          const shop = shops.find(
            (s) => s.name === shopName && s.branch.name === branchName,
          );

          if (shop) {
            if (userId && userShopIds.length > 0) {
              // Check if this shop is accessible to user
              if (userShopIds.includes(shop.id)) {
                overallTotals.branchTotals[branchName].shops[shopName] =
                  (overallTotals.branchTotals[branchName].shops[shopName] ||
                    0) + quantity;
                overallTotals.branchTotals[branchName].totalShopStock +=
                  quantity;
                overallTotals.branchTotals[branchName].totalBranchStock +=
                  quantity;
                overallTotals.totalShopStock += quantity;
                overallTotals.totalAllStock += quantity;
              }
            } else {
              overallTotals.branchTotals[branchName].shops[shopName] =
                (overallTotals.branchTotals[branchName].shops[shopName] || 0) +
                quantity;
              overallTotals.branchTotals[branchName].totalShopStock += quantity;
              overallTotals.branchTotals[branchName].totalBranchStock +=
                quantity;
              overallTotals.totalShopStock += quantity;
              overallTotals.totalAllStock += quantity;
            }
          }
        });

        // Calculate store-wise totals (filtered by user access)
        Object.entries(branchData.stores).forEach(([storeName, quantity]) => {
          // Find the store ID for this store name
          const store = stores.find(
            (s) => s.name === storeName && s.branch.name === branchName,
          );

          if (store) {
            if (userId && userStoreIds.length > 0) {
              // Check if this store is accessible to user
              if (userStoreIds.includes(store.id)) {
                overallTotals.branchTotals[branchName].stores[storeName] =
                  (overallTotals.branchTotals[branchName].stores[storeName] ||
                    0) + quantity;
                overallTotals.branchTotals[branchName].totalStoreStock +=
                  quantity;
                overallTotals.branchTotals[branchName].totalBranchStock +=
                  quantity;
                overallTotals.totalStoreStock += quantity;
                overallTotals.totalAllStock += quantity;
              }
            } else {
              overallTotals.branchTotals[branchName].stores[storeName] =
                (overallTotals.branchTotals[branchName].stores[storeName] ||
                  0) + quantity;
              overallTotals.branchTotals[branchName].totalStoreStock +=
                quantity;
              overallTotals.branchTotals[branchName].totalBranchStock +=
                quantity;
              overallTotals.totalStoreStock += quantity;
              overallTotals.totalAllStock += quantity;
            }
          }
        });
      },
    );
  });

  // Add overallTotals to each product
  const productsWithTotals = productsWithDetailedStock.map((product) => ({
    ...product,
    overallTotals,
  }));

  return {
    products: productsWithTotals,
    count: products.length,
    userAccessibleShops: userShops.map((shop) => ({
      id: shop.id,
      name: shop.name,
      branch: {
        id: shop.branch.id,
        name: shop.branch.name,
      },
    })),
    userAccessibleStores: userStores.map((store) => ({
      id: store.id,
      name: store.name,
      branch: {
        id: store.branch.id,
        name: store.branch.name,
      },
    })),
  };
};
const generateUniqueReferenceNumber = async (prefix) => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
  return `${prefix}-${timestamp}${random}`;
};

const createProductStock = async (productId, stocksData, userId) => {
  try {
    // stocksData can be an array or single object
    const stocks = Array.isArray(stocksData) ? stocksData : [stocksData];

    // Validate all stocks first
    const validationErrors = [];

    stocks.forEach((stockData, index) => {
      const { pieceQuantity, boxQuantity, storeId, shopId } = stockData;

      if (!productId) {
        validationErrors.push(`Stock ${index + 1}: Product ID is required`);
      }

      // Validate either storeId or shopId is provided
      if (!storeId && !shopId) {
        validationErrors.push(
          `Stock ${index + 1}: Either Store ID or Shop ID is required`,
        );
      }

      // Validate quantity (either pieceQuantity or boxQuantity must be provided)
      const hasPieceQuantity =
        pieceQuantity !== undefined &&
        pieceQuantity !== null &&
        pieceQuantity > 0;
      const hasBoxQuantity =
        boxQuantity !== undefined && boxQuantity !== null && boxQuantity > 0;

      if (!hasPieceQuantity && !hasBoxQuantity) {
        validationErrors.push(
          `Stock ${index + 1}: Either piece quantity or box quantity must be provided and greater than 0`,
        );
      }
    });

    if (validationErrors.length > 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, validationErrors.join('; '));
    }

    // Get all unique store IDs and shop IDs for batch fetching
    const storeIds = [
      ...new Set(stocks.filter((s) => s.storeId).map((stock) => stock.storeId)),
    ];
    const shopIds = [
      ...new Set(stocks.filter((s) => s.shopId).map((stock) => stock.shopId)),
    ];

    // Fetch product
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
        brand: true,
      },
    });

    if (!product) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Product not found');
    }

    // Fetch all stores in one query
    const stores =
      storeIds.length > 0
        ? await prisma.store.findMany({
            where: { id: { in: storeIds } },
            include: { branch: true },
          })
        : [];

    // Fetch all shops in one query
    const shops =
      shopIds.length > 0
        ? await prisma.shop.findMany({
            where: { id: { in: shopIds } },
            include: { branch: true },
          })
        : [];

    // Create maps for quick lookup
    const storeMap = Object.fromEntries(
      stores.map((store) => [store.id, store]),
    );
    const shopMap = Object.fromEntries(shops.map((shop) => [shop.id, shop]));

    // Check if all stores exist
    const missingStoreIds = storeIds.filter((id) => !storeMap[id]);
    if (missingStoreIds.length > 0) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        `Stores not found: ${missingStoreIds.join(', ')}`,
      );
    }

    // Check if all shops exist
    const missingShopIds = shopIds.filter((id) => !shopMap[id]);
    if (missingShopIds.length > 0) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        `Shops not found: ${missingShopIds.join(', ')}`,
      );
    }

    // Prepare results array
    const results = await Promise.all(
      stocks.map(async (stockData, index) => {
        const { pieceQuantity, boxQuantity, storeId, shopId, notes } =
          stockData;
        const store = storeId ? storeMap[storeId] : null;
        const shop = shopId ? shopMap[shopId] : null;
        const locationType = storeId ? 'store' : 'shop';
        const locationName = storeId ? store?.name : shop?.name;
        const locationId = storeId || shopId;

        try {
          // Generate reference number for each stock
          const reference = await generateUniqueReferenceNumber('STK-INIT');

          // Calculate total piece quantity (convert boxes to pieces if product has box support)
          let totalPieceQuantity = 0;
          let finalBoxQuantity = 0;
          let finalPieceQuantity = 0;

          // Handle box quantity - must be converted to pieces if product supports boxes
          if (boxQuantity && boxQuantity > 0) {
            if (product.hasBox && product.boxSize) {
              // Convert boxes to pieces
              totalPieceQuantity += boxQuantity * product.boxSize;
              finalBoxQuantity = boxQuantity;
            } else {
              // If product doesn't support boxes, treat boxQuantity as pieceQuantity
              throw new ApiError(
                httpStatus.BAD_REQUEST,
                `Product "${product.name}" does not support box/packaging. Please enable box support for this product to add stock in boxes.`
              );
            }
          }

          // Handle piece quantity (always added as pieces)
          if (pieceQuantity && pieceQuantity > 0) {
            totalPieceQuantity += pieceQuantity;
            finalPieceQuantity = pieceQuantity;
          }

          // Validate total quantity is positive
          if (totalPieceQuantity <= 0) {
            throw new ApiError(
              httpStatus.BAD_REQUEST,
              `Invalid total quantity for product "${product.name}". Total pieces must be greater than 0.`
            );
          }

          // Use transaction for each stock entry
          const result = await prisma.$transaction(async (tx) => {
            let stockRecord;
            let stockLedger;

            if (storeId) {
              // Handle Store Stock
              stockRecord = await tx.storeStock.upsert({
                where: {
                  storeId_productId: {
                    storeId,
                    productId,
                  },
                },
                create: {
                  storeId,
                  productId,
                  quantity: totalPieceQuantity,
                  status: 'Available',
                },
                update: {
                  quantity: {
                    increment: totalPieceQuantity,
                  },
                  updatedAt: new Date(),
                },
                include: {
                  product: {
                    include: {
                      category: true,
                      brand: true,
                    },
                  },
                  store: {
                    include: {
                      branch: true,
                    },
                  },
                },
              });

              // Create stock ledger entry for store
              const ledgerNotes = [];
              if (finalBoxQuantity > 0 && finalPieceQuantity > 0) {
                ledgerNotes.push(
                  `Initial stock insertion - ${finalBoxQuantity} box(es) × ${product.boxSize} = ${finalBoxQuantity * product.boxSize} pieces + ${finalPieceQuantity} piece(s) = ${totalPieceQuantity} total pieces`
                );
              } else if (finalBoxQuantity > 0) {
                ledgerNotes.push(
                  `Initial stock insertion - ${finalBoxQuantity} box(es) × ${product.boxSize} = ${totalPieceQuantity} pieces`
                );
              } else {
                ledgerNotes.push(
                  `Initial stock insertion - ${finalPieceQuantity} piece(s)`
                );
              }
              ledgerNotes.push(`for product ${product.productCode} at store ${store.name}`);

              stockLedger = await tx.stockLedger.create({
                data: {
                  productId,
                  movementType: 'IN',
                  pieceQuantity: totalPieceQuantity,
                  boxQuantity: finalBoxQuantity,
                  reference,
                  userId,
                  notes: notes || ledgerNotes.join(' '),
                  movementDate: new Date(),
                  storeId,
                },
                include: {
                  product: {
                    include: {
                      category: true,
                      brand: true,
                    },
                  },
                  store: {
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
              });
            } else if (shopId) {
              // Handle Shop Stock
              stockRecord = await tx.shopStock.upsert({
                where: {
                  shopId_productId: {
                    shopId,
                    productId,
                  },
                },
                create: {
                  shopId,
                  productId,
                  quantity: totalPieceQuantity,
                  status: 'Available',
                },
                update: {
                  quantity: {
                    increment: totalPieceQuantity,
                  },
                  updatedAt: new Date(),
                },
                include: {
                  product: {
                    include: {
                      category: true,
                      brand: true,
                    },
                  },
                  shop: {
                    include: {
                      branch: true,
                    },
                  },
                },
              });

              // Create stock ledger entry for shop
              const ledgerNotes = [];
              if (finalBoxQuantity > 0 && finalPieceQuantity > 0) {
                ledgerNotes.push(
                  `Initial stock insertion - ${finalBoxQuantity} box(es) × ${product.boxSize} = ${finalBoxQuantity * product.boxSize} pieces + ${finalPieceQuantity} piece(s) = ${totalPieceQuantity} total pieces`
                );
              } else if (finalBoxQuantity > 0) {
                ledgerNotes.push(
                  `Initial stock insertion - ${finalBoxQuantity} box(es) × ${product.boxSize} = ${totalPieceQuantity} pieces`
                );
              } else {
                ledgerNotes.push(
                  `Initial stock insertion - ${finalPieceQuantity} piece(s)`
                );
              }
              ledgerNotes.push(`for product ${product.productCode} at shop ${shop.name}`);

              stockLedger = await tx.stockLedger.create({
                data: {
                  productId,
                  movementType: 'IN',
                  pieceQuantity: totalPieceQuantity,
                  boxQuantity: finalBoxQuantity,
                  reference,
                  userId,
                  notes: notes || ledgerNotes.join(' '),
                  movementDate: new Date(),
                  shopId,
                },
                include: {
                  product: {
                    include: {
                      category: true,
                      brand: true,
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
              });
            }

            // Create log entry
            const quantityMessage = [];
            if (finalBoxQuantity > 0) {
              quantityMessage.push(`${finalBoxQuantity} box(es)`);
            }
            if (finalPieceQuantity > 0) {
              quantityMessage.push(`${finalPieceQuantity} piece(s)`);
            }

            const actionMessage = 
              `Initial stock insertion: Added ${quantityMessage.join(' and ')} ` +
              `(${totalPieceQuantity} total pieces) of ${product.name} (${product.productCode}) ` +
              `to ${locationType} ${locationName}`;

            await tx.log.create({
              data: {
                action: actionMessage,
                userId,
              },
            });

            return {
              stockRecord,
              stockLedger,
              product,
              location: store || shop,
              locationType,
              reference,
              totalPieceQuantity,
              boxQuantity: finalBoxQuantity,
              pieceQuantity: finalPieceQuantity,
            };
          });

          const quantityMessage = [];
          if (result.boxQuantity > 0) {
            quantityMessage.push(`${result.boxQuantity} box(es)`);
          }
          if (result.pieceQuantity > 0) {
            quantityMessage.push(`${result.pieceQuantity} piece(s)`);
          }

          return {
            message: `Successfully added initial stock of ${quantityMessage.join(
              ' and ',
            )} (${result.totalPieceQuantity} total pieces) for ${product.name} to ${
              result.locationType
            } ${result.location.name}`,
            reference: result.reference,
            stockRecord: result.stockRecord,
            stockLedger: result.stockLedger,
            product: result.product,
            location: result.location,
            locationType: result.locationType,
            totalPieceQuantity: result.totalPieceQuantity,
            boxQuantity: result.boxQuantity,
            pieceQuantity: result.pieceQuantity,
          };
        } catch (error) {
          console.error(`Error processing stock ${index + 1}:`, error);
          throw error;
        }
      }),
    );

    return results;
  } catch (error) {
    console.error('Error stack:', error.stack);
    throw error;
  }
};
module.exports = {
  getBranchById,
  getBranchByName,
  getAllBranches,
  createBranch,
  updateBranch,
  deleteBranch,
  getAllProducts,
  createProductStock,
};
