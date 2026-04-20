const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const prisma = require('./prisma');

// Customer Services

const getCustomerById = async (id) => {
  return prisma.customer.findUnique({ where: { id } });
};

const getCustomerByEmail = async (email) => {
  return prisma.customer.findFirst({ where: { email } });
};

// ✅ Get customer by either phone1 or phone2
const getCustomerByPhone = async (phone) => {
  return prisma.customer.findFirst({
    where: {
      OR: [{ phone1: phone }, { phone2: phone }],
    },
  });
};

const getCustomerByTin = async (tinNumber) => {
  return prisma.customer.findFirst({ where: { tinNumber } });
};

const getAllCustomers = async (filter = {}) => {
  const customers = await prisma.customer.findMany({
    where: filter,
    orderBy: { name: 'asc' }, // ✅ updated since "first_name" is mapped to `name`
  });

  return { customers, count: customers.length };
};

const createCustomer = async (customerBody) => {
  // Check if customer with same email already exists
  if (customerBody.email && (await getCustomerByEmail(customerBody.email))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }

  // Check if customer with same phone1 already exists
  if (customerBody.phone1 && (await getCustomerByPhone(customerBody.phone1))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Phone1 already taken');
  }

  // Check if customer with same phone2 already exists
  if (customerBody.phone2 && (await getCustomerByPhone(customerBody.phone2))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Phone2 already taken');
  }

  // Check if customer with same TIN already exists
  if (
    customerBody.tinNumber &&
    (await getCustomerByTin(customerBody.tinNumber))
  ) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'TIN already registered');
  }

  return prisma.customer.create({ data: customerBody });
};

const updateCustomer = async (id, updateBody) => {
  const existingCustomer = await getCustomerById(id);
  if (!existingCustomer) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Customer not found');
  }

  // Validate email uniqueness
  if (updateBody.email && updateBody.email !== existingCustomer.email) {
    if (await getCustomerByEmail(updateBody.email)) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
    }
  }

  // Validate phone1 uniqueness
  if (updateBody.phone1 && updateBody.phone1 !== existingCustomer.phone1) {
    if (await getCustomerByPhone(updateBody.phone1)) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Phone1 already taken');
    }
  }

  // Validate phone2 uniqueness
  if (updateBody.phone2 && updateBody.phone2 !== existingCustomer.phone2) {
    if (await getCustomerByPhone(updateBody.phone2)) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Phone2 already taken');
    }
  }

  // Validate TIN uniqueness
  if (
    updateBody.tinNumber &&
    updateBody.tinNumber !== existingCustomer.tinNumber
  ) {
    if (await getCustomerByTin(updateBody.tinNumber)) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'TIN already registered');
    }
  }

  return prisma.customer.update({
    where: { id },
    data: updateBody,
  });
};
const getCustomersWithFallback = async (search = '') => {
  try {
    if (search.trim()) {
      const searchLower = search.toLowerCase();

      const customers = await prisma.customer.findMany({
        where: {
          OR: [
            { name: { contains: search } },
            { companyName: { contains: search } },
            { phone1: { contains: search } },
            { phone2: { contains: search } },
          ],
        },
        orderBy: { name: 'asc' },
        take: 50,
      });
      const filteredCustomers = search.trim()
        ? customers.filter(
            (customer) =>
              customer.name?.toLowerCase().includes(searchLower) ||
              customer.companyName?.toLowerCase().includes(searchLower) ||
              customer.phone1?.includes(search) || // phone numbers are usually case-insensitive
              customer.phone2?.includes(search),
          )
        : customers;
      return {
        customers: filteredCustomers,
        count: filteredCustomers.length,
        isSearchResults: true,
      };
    }
    try {
      const topCustomers = await prisma.$queryRaw`
        SELECT c.*
        FROM Customer c
        LEFT JOIN Sell s ON c.id = s.customerId
        GROUP BY c.id
        ORDER BY COALESCE(SUM(s.grandTotal), 0) DESC
        LIMIT 10
      `;
      if (
        topCustomers &&
        Array.isArray(topCustomers) &&
        topCustomers.length > 0
      ) {
        const mappedCustomers = topCustomers.map((customer) => ({
          id: customer.id || customer._id,
          name: customer.name,
          companyName: customer.companyName || customer.companyname,
          phone1: customer.phone1,
          phone2: customer.phone2,
          tinNumber: customer.tinNumber || customer.tinnumber,
          address: customer.address,
          createdAt: customer.createdAt || customer.createdat,
          updatedAt: customer.updatedAt || customer.updatedat,
        }));
        return {
          customers: mappedCustomers,
          count: mappedCustomers.length,
          isTopCustomers: true,
        };
      }
    } catch (error) {
      console.error('❌ Error fetching top customers:', error.message);
      console.error('❌ Error details:', error);
      // Continue to fallback
    }

    // Fallback: get first 10 customers alphabetically
    const defaultCustomers = await prisma.customer.findMany({
      orderBy: { name: 'asc' },
      take: 10,
    });
    return {
      customers: defaultCustomers,
      count: defaultCustomers.length,
      isDefaultCustomers: true,
    };
  } catch (error) {
    return {
      customers: [],
      count: 0,
      error: error.message,
    };
  }
};
const deleteCustomer = async (id) => {
  const existingCustomer = await getCustomerById(id);
  if (!existingCustomer) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Customer not found');
  }

  await prisma.customer.delete({ where: { id } });
  return { message: 'Customer deleted successfully' };
}; // Supplier Services

const getSupplierById = async (id) => {
  const supplier = await prisma.supplier.findUnique({
    where: { id },
  });
  return supplier;
};

const getSupplierByName = async (name) => {
  const supplier = await prisma.supplier.findFirst({
    where: { name },
  });
  return supplier;
};

const getSupplierByEmail = async (email) => {
  const supplier = await prisma.supplier.findFirst({
    where: { email },
  });
  return supplier;
};

const getSupplierByPhone = async (phone) => {
  const supplier = await prisma.supplier.findFirst({
    where: { phone },
  });
  return supplier;
};

const getSupplierByTin = async (tinNumber) => {
  const supplier = await prisma.supplier.findFirst({
    where: { tinNumber },
  });
  return supplier;
};

const getAllSuppliers = async (filter = {}) => {
  const suppliers = await prisma.supplier.findMany({
    where: filter,
    orderBy: {
      name: 'asc',
    },
  });

  return {
    suppliers,
    count: suppliers.length,
  };
};

const createSupplier = async (supplierBody) => {
  // Check if supplier with same name already exists
  if (await getSupplierByName(supplierBody.name)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Supplier name already taken');
  }

  // Check if supplier with same email already exists
  if (supplierBody.email && (await getSupplierByEmail(supplierBody.email))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }

  // Check if supplier with same phone already exists
  if (supplierBody.phone && (await getSupplierByPhone(supplierBody.phone))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Phone already taken');
  }

  // Check if supplier with same tinNumber already exists - FIXED
  if (
    supplierBody.tinNumber &&
    (await getSupplierByTin(supplierBody.tinNumber))
  ) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'TIN already registered');
  }

  const supplier = await prisma.supplier.create({
    data: supplierBody,
  });
  return supplier;
};

const updateSupplier = async (id, updateBody) => {
  const existingSupplier = await getSupplierById(id);
  if (!existingSupplier) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Supplier not found');
  }

  // Check if name is being updated to an existing name
  if (updateBody.name && updateBody.name !== existingSupplier.name) {
    if (await getSupplierByName(updateBody.name)) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Supplier name already taken');
    }
  }

  // Check if email is being updated to an existing email
  if (updateBody.email && updateBody.email !== existingSupplier.email) {
    if (await getSupplierByEmail(updateBody.email)) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
    }
  }

  // Check if phone is being updated to an existing phone
  if (updateBody.phone && updateBody.phone !== existingSupplier.phone) {
    if (await getSupplierByPhone(updateBody.phone)) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Phone already taken');
    }
  }

  // Check if TIN is being updated to an existing TIN
  if (updateBody.tin && updateBody.tin !== existingSupplier.tin) {
    if (await getSupplierByTin(updateBody.tin)) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'TIN already registered');
    }
  }

  const updatedSupplier = await prisma.supplier.update({
    where: { id },
    data: updateBody,
  });

  return updatedSupplier;
};

const deleteSupplier = async (id) => {
  const existingSupplier = await getSupplierById(id);
  if (!existingSupplier) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Supplier not found');
  }

  await prisma.supplier.delete({
    where: { id },
  });

  return { message: 'Supplier deleted successfully' };
};

const getCustomerSells = async (customerId, filters = {}) => {
  // Validate customer exists
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      name: true,
      companyName: true,
      phone1: true,
      phone2: true,
      tinNumber: true,
      address: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!customer) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Customer not found');
  }

  const {
    page = 1,
    limit = 10,
    saleStatus,
    paymentStatus,
    startDate,
    endDate,
    minAmount,
    maxAmount,
    invoiceNo,
    sortBy = 'saleDate',
    sortOrder = 'desc',
  } = filters;

  // Build where clause
  const where = {
    customerId,
  };

  // Add filters
  if (saleStatus) {
    where.saleStatus = saleStatus;
  }

  if (paymentStatus) {
    where.paymentStatus = paymentStatus;
  }

  if (invoiceNo) {
    where.invoiceNo = { contains: invoiceNo, mode: 'insensitive' };
  }

  if (startDate || endDate) {
    where.saleDate = {};
    if (startDate) {
      where.saleDate.gte = new Date(startDate);
    }
    if (endDate) {
      where.saleDate.lte = new Date(endDate);
    }
  }

  if (minAmount || maxAmount) {
    where.grandTotal = {};
    if (minAmount) {
      where.grandTotal.gte = parseFloat(minAmount);
    }
    if (maxAmount) {
      where.grandTotal.lte = parseFloat(maxAmount);
    }
  }

  // Calculate pagination
  const skip = (page - 1) * limit;
  const take = parseInt(limit);

  // Get sells with pagination and all related data
  const [sells, total] = await Promise.all([
    prisma.sell.findMany({
      where,
      skip,
      take,
      orderBy: {
        [sortBy]: sortOrder,
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            address: true,
            phone: true,
            email: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                productCode: true,
                name: true,
                generic: true,
                description: true,
                sellPrice: true,
                hasBox: true,
                boxSize: true,
                UnitOfMeasure: true,
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
              },
            },
            shop: {
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
            },
          },
        },
        sellPayments: {
          orderBy: {
            createdAt: 'desc',
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
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        updatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
    prisma.sell.count({ where }),
  ]);

  // Calculate summary statistics for customer
  const summary = await prisma.sell.aggregate({
    where: {
      customerId,
    },
    _sum: {
      grandTotal: true,
      totalPaid: true,
      balance: true,
      discount: true,
      vat: true,
      subTotal: true,
      totalProducts: true,
    },
    _count: {
      id: true,
    },
    _avg: {
      grandTotal: true,
    },
    _min: {
      saleDate: true,
    },
    _max: {
      saleDate: true,
    },
  });

  // Get status breakdown
  const saleStatusBreakdown = await prisma.sell.groupBy({
    by: ['saleStatus'],
    where: {
      customerId,
    },
    _count: {
      id: true,
    },
    _sum: {
      grandTotal: true,
    },
  });

  const paymentStatusBreakdown = await prisma.sell.groupBy({
    by: ['paymentStatus'],
    where: {
      customerId,
    },
    _count: {
      id: true,
    },
    _sum: {
      grandTotal: true,
      totalPaid: true,
      balance: true,
    },
  });

  // Get recent payments
  const recentPayments = await prisma.sellPayment.findMany({
    where: {
      sell: {
        customerId,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 5,
    include: {
      sell: {
        select: {
          invoiceNo: true,
          grandTotal: true,
        },
      },
      createdBy: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  return {
    customer: {
      id: customer.id,
      name: customer.name,
      companyName: customer.companyName,
      phone1: customer.phone1,
      phone2: customer.phone2,
      tinNumber: customer.tinNumber,
      address: customer.address,
      registeredAt: customer.createdAt,
    },
    sells: sells.map((sell) => ({
      ...sell,
      itemsCount: sell.items.length,
      items: sell.items.map((item) => ({
        id: item.id,
        productName: item.product.name,
        productCode: item.product.productCode,
        isBox: item.isBox,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        shopName: item.shop.name,
        boxInfo: item.product.hasBox
          ? {
              hasBox: true,
              boxSize: item.product.boxSize,
              boxQuantity: item.isBox
                ? item.quantity / item.product.boxSize
                : null,
              pieceQuantity: item.isBox ? item.quantity : item.quantity,
            }
          : null,
      })),
      paymentSummary: {
        totalPaid: sell.totalPaid,
        balance: sell.balance,
        paymentStatus: sell.paymentStatus,
        paymentPercentage:
          sell.grandTotal > 0 ? (sell.totalPaid / sell.grandTotal) * 100 : 0,
        paymentsCount: sell.sellPayments.length,
        lastPayment: sell.sellPayments[0] || null,
      },
    })),
    pagination: {
      currentPage: parseInt(page),
      pageSize: take,
      totalRecords: total,
      totalPages: Math.ceil(total / take),
      hasNextPage: page < Math.ceil(total / take),
      hasPrevPage: page > 1,
    },
    summary: {
      totalSells: summary._count.id || 0,
      totalGrandAmount: summary._sum.grandTotal || 0,
      totalPaidAmount: summary._sum.totalPaid || 0,
      totalBalance: summary._sum.balance || 0,
      totalDiscount: summary._sum.discount || 0,
      totalVat: summary._sum.vat || 0,
      totalSubTotal: summary._sum.subTotal || 0,
      totalProductsSold: summary._sum.totalProducts || 0,
      averageSaleAmount: summary._avg.grandTotal || 0,
      firstSaleDate: summary._min.saleDate,
      lastSaleDate: summary._max.saleDate,
      collectionRate:
        summary._sum.grandTotal > 0
          ? ((summary._sum.totalPaid / summary._sum.grandTotal) * 100).toFixed(
              2,
            )
          : 0,
    },
    breakdown: {
      bySaleStatus: saleStatusBreakdown.map((status) => ({
        status: status.saleStatus,
        count: status._count.id,
        totalAmount: status._sum.grandTotal || 0,
        percentage:
          summary._sum.grandTotal > 0
            ? (
                (status._sum.grandTotal / summary._sum.grandTotal) *
                100
              ).toFixed(2)
            : 0,
      })),
      byPaymentStatus: paymentStatusBreakdown.map((status) => ({
        status: status.paymentStatus,
        count: status._count.id,
        totalAmount: status._sum.grandTotal || 0,
        totalPaid: status._sum.totalPaid || 0,
        totalBalance: status._sum.balance || 0,
        percentage:
          summary._sum.grandTotal > 0
            ? (
                (status._sum.grandTotal / summary._sum.grandTotal) *
                100
              ).toFixed(2)
            : 0,
      })),
    },
    recentPayments: recentPayments.map((payment) => ({
      id: payment.id,
      amount: payment.amount,
      invoiceNo: payment.sell.invoiceNo,
      grandTotal: payment.sell.grandTotal,
      createdAt: payment.createdAt,
      createdBy: payment.createdBy?.name || 'System',
    })),
  };
};

/**
 * Get customer payment summary only
 */
const getCustomerPaymentSummary = async (customerId) => {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, name: true, phone1: true },
  });

  if (!customer) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Customer not found');
  }

  const summary = await prisma.sell.aggregate({
    where: {
      customerId,
    },
    _sum: {
      grandTotal: true,
      totalPaid: true,
      balance: true,
    },
  });

  const unpaidSells = await prisma.sell.findMany({
    where: {
      customerId,
      balance: { gt: 0 },
    },
    select: {
      id: true,
      invoiceNo: true,
      grandTotal: true,
      totalPaid: true,
      balance: true,
      saleDate: true,
      paymentStatus: true,
    },
    orderBy: {
      saleDate: 'asc',
    },
  });

  return {
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone1,
    },
    summary: {
      totalPurchases: summary._sum.grandTotal || 0,
      totalPaid: summary._sum.totalPaid || 0,
      totalBalance: summary._sum.balance || 0,
      paymentCompliance:
        summary._sum.grandTotal > 0
          ? ((summary._sum.totalPaid / summary._sum.grandTotal) * 100).toFixed(
              2,
            )
          : 100,
    },
    outstandingInvoices: unpaidSells.map((sell) => ({
      invoiceNo: sell.invoiceNo,
      date: sell.saleDate,
      totalAmount: sell.grandTotal,
      paidAmount: sell.totalPaid,
      balance: sell.balance,
      paymentStatus: sell.paymentStatus,
    })),
    totalOutstanding: unpaidSells.reduce((sum, sell) => sum + sell.balance, 0),
    outstandingCount: unpaidSells.length,
  };
};
const getSupplierPurchases = async (supplierId, filters = {}) => {
  // Validate supplier exists
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    select: {
      id: true,
      name: true,
      contactName: true,
      phone: true,
      email: true,
      address: true,
      city: true,
      country: true,
      tinNumber: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!supplier) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Supplier not found');
  }

  const {
    page = 1,
    limit = 10,
    paymentStatus,
    startDate,
    endDate,
    minAmount,
    maxAmount,
    invoiceNo,
    sortBy = 'purchaseDate',
    sortOrder = 'desc',
  } = filters;

  // Build where clause
  const where = {
    supplierId,
  };

  // Add filters
  if (paymentStatus) {
    where.paymentStatus = paymentStatus;
  }

  if (invoiceNo) {
    where.invoiceNo = { contains: invoiceNo, mode: 'insensitive' };
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

  if (minAmount || maxAmount) {
    where.grandTotal = {};
    if (minAmount) {
      where.grandTotal.gte = parseFloat(minAmount);
    }
    if (maxAmount) {
      where.grandTotal.lte = parseFloat(maxAmount);
    }
  }

  // Calculate pagination
  const skip = (page - 1) * limit;
  const take = parseInt(limit);

  // Get purchases with pagination and all related data
  const [purchases, total] = await Promise.all([
    prisma.purchase.findMany({
      where,
      skip,
      take,
      orderBy: {
        [sortBy]: sortOrder,
      },
      include: {
        store: {
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
        },
        shop: {
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
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                productCode: true,
                name: true,
                generic: true,
                description: true,
                sellPrice: true,
                hasBox: true,
                boxSize: true,
                UnitOfMeasure: true,
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
              },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        updatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
    prisma.purchase.count({ where }),
  ]);

  // Calculate summary statistics for supplier
  const summary = await prisma.purchase.aggregate({
    where: {
      supplierId,
    },
    _sum: {
      grandTotal: true,
      subTotal: true,
      totalProducts: true,
    },
    _count: {
      id: true,
    },
    _avg: {
      grandTotal: true,
    },
    _min: {
      purchaseDate: true,
    },
    _max: {
      purchaseDate: true,
    },
  });

  // Get status breakdown
  const paymentStatusBreakdown = await prisma.purchase.groupBy({
    by: ['paymentStatus'],
    where: {
      supplierId,
    },
    _count: {
      id: true,
    },
    _sum: {
      grandTotal: true,
    },
  });

  // Get recent purchases
  const recentPurchases = await prisma.purchase.findMany({
    where: {
      supplierId,
    },
    orderBy: {
      purchaseDate: 'desc',
    },
    take: 5,
    select: {
      id: true,
      invoiceNo: true,
      grandTotal: true,
      purchaseDate: true,
      paymentStatus: true,
    },
  });

  return {
    supplier: {
      id: supplier.id,
      name: supplier.name,
      contactName: supplier.contactName,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
      city: supplier.city,
      country: supplier.country,
      tinNumber: supplier.tinNumber,
      notes: supplier.notes,
      registeredAt: supplier.createdAt,
    },
    purchases: purchases.map((purchase) => ({
      ...purchase,
      itemsCount: purchase.items.length,
      items: purchase.items.map((item) => ({
        id: item.id,
        productName: item.product.name,
        productCode: item.product.productCode,
        isBox: item.isBox,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        boxInfo: item.product.hasBox
          ? {
              hasBox: true,
              boxSize: item.product.boxSize,
              boxQuantity: item.isBox
                ? item.quantity / item.product.boxSize
                : null,
              pieceQuantity: item.isBox ? item.quantity : item.quantity,
            }
          : null,
      })),
      location: purchase.store
        ? { type: 'store', name: purchase.store.name }
        : purchase.shop
        ? { type: 'shop', name: purchase.shop.name }
        : null,
    })),
    pagination: {
      currentPage: parseInt(page),
      pageSize: take,
      totalRecords: total,
      totalPages: Math.ceil(total / take),
      hasNextPage: page < Math.ceil(total / take),
      hasPrevPage: page > 1,
    },
    summary: {
      totalPurchases: summary._count.id || 0,
      totalGrandAmount: summary._sum.grandTotal || 0,
      totalSubTotal: summary._sum.subTotal || 0,
      totalProductsPurchased: summary._sum.totalProducts || 0,
      averagePurchaseAmount: summary._avg.grandTotal || 0,
      firstPurchaseDate: summary._min.purchaseDate,
      lastPurchaseDate: summary._max.purchaseDate,
    },
    breakdown: {
      byPaymentStatus: paymentStatusBreakdown.map((status) => ({
        status: status.paymentStatus,
        count: status._count.id,
        totalAmount: status._sum.grandTotal || 0,
        percentage:
          summary._sum.grandTotal > 0
            ? (
                (status._sum.grandTotal / summary._sum.grandTotal) *
                100
              ).toFixed(2)
            : 0,
      })),
    },
    recentPurchases: recentPurchases.map((purchase) => ({
      id: purchase.id,
      invoiceNo: purchase.invoiceNo,
      grandTotal: purchase.grandTotal,
      purchaseDate: purchase.purchaseDate,
      paymentStatus: purchase.paymentStatus,
    })),
  };
};
module.exports = {
  // Customer exports
  getCustomersWithFallback,
  getCustomerById,
  getCustomerByEmail,
  getCustomerByPhone,
  getCustomerByTin,
  getAllCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerSells,
  getCustomerPaymentSummary,
  // Supplier exports
  getSupplierById,
  getSupplierByName,
  getSupplierByEmail,
  getSupplierByPhone,
  getSupplierByTin,
  getAllSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getSupplierPurchases,
};
