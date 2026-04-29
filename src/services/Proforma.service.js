const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const prisma = require('./prisma');

// Get Proforma by ID
const getProformaById = async (id) => {
  const proforma = await prisma.proforma.findUnique({
    where: { id },
    include: {
      customer: true,
      shop: true,
      createdBy: true,
      updatedBy: true,
      items: {
        include: {
          product: {
            include: {
              unitOfMeasure: true,
            },
          },
        },
      },
    },
  });
  return proforma;
};

// Get Proforma by proforma number
const getProformaByNo = async (proformaNo) => {
  const proforma = await prisma.proforma.findFirst({
    where: { proformaNo },
  });
  return proforma;
};

// Get all Proformas
const getAllProformas = async (filter = {}) => {
  const { customerId, shopId, status, startDate, endDate, search } = filter;

  const where = {};

  if (customerId) {
    where.customerId = customerId;
  }

  if (shopId) {
    where.shopId = shopId;
  }

  if (status) {
    where.status = status;
  }

  if (startDate || endDate) {
    where.proformaDate = {};
    if (startDate) {
      where.proformaDate.gte = new Date(startDate);
    }
    if (endDate) {
      where.proformaDate.lte = new Date(endDate);
    }
  }

  if (search) {
    where.OR = [
      { proformaNo: { contains: search, mode: 'insensitive' } },
      { notes: { contains: search, mode: 'insensitive' } },
    ];
  }

  const proformas = await prisma.proforma.findMany({
    where,
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      customer: true,
      shop: true,
      _count: {
        select: { items: true },
      },
    },
  });

  return {
    proformas,
    count: proformas.length,
  };
};

// Create Proforma
const createProforma = async (proformaBody, userId) => {
  console.log(
    '🔵 [BACKEND] createProforma called with body:',
    JSON.stringify(proformaBody, null, 2),
  );

  const parsedBody = proformaBody;
  const { items, ...restProformaBody } = parsedBody;

  // Log items before processing
  console.log('📦 [BACKEND] Raw items received:', items);

  // Check if proforma number already exists
  if (await getProformaByNo(restProformaBody.proformaNo)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Proforma number already taken');
  }

  // Validate items
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Proforma must have at least one item',
    );
  }

  // Validate individual item properties with detailed logging
  items.forEach((item, index) => {
    console.log(`🔍 [BACKEND] Item ${index + 1} validation:`, {
      productId: item.productId,
      isBox: item.isBox,
      isBoxType: typeof item.isBox,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    });

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
      console.error(
        `❌ [BACKEND] Item ${index + 1} invalid isBox type:`,
        typeof item.isBox,
        item.isBox,
      );
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Item ${index + 1} has invalid isBox value (must be boolean)`,
      );
    }
  });

  // Recalculate totals with isBox logging
  const validatedItems = items.map((item) => {
    const processedItem = {
      ...item,
      isBox: item.isBox === true, // Ensure boolean
      totalPrice: item.quantity * item.unitPrice,
    };
    console.log(`✅ [BACKEND] Processed item:`, {
      originalIsBox: item.isBox,
      processedIsBox: processedItem.isBox,
      quantity: processedItem.quantity,
      unitPrice: processedItem.unitPrice,
      totalPrice: processedItem.totalPrice,
    });
    return processedItem;
  });

  // Convert proformaDate
  const proformaDate = new Date(restProformaBody.proformaDate || new Date());
  if (Number.isNaN(proformaDate.getTime())) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid proforma date');
  }

  // Convert validUntil if provided
  let validUntil = null;
  if (restProformaBody.validUntil) {
    validUntil = new Date(restProformaBody.validUntil);
    if (Number.isNaN(validUntil.getTime())) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid valid until date');
    }
  }

  // Calculate totals
  const totalProducts = validatedItems.length;
  const subTotal = validatedItems.reduce(
    (sum, item) => sum + item.totalPrice,
    0,
  );
  const discount = restProformaBody.discount || 0;
  const tax = restProformaBody.tax || 0;
  const grandTotal = subTotal - discount + tax;

  // Validate shop selection
  if (!restProformaBody.shopId || restProformaBody.shopId.trim() === '') {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Shop must be selected for proforma',
    );
  }

  console.log('💾 [BACKEND] Final data to save:', {
    proformaNo: restProformaBody.proformaNo,
    customerId: restProformaBody.customerId,
    shopId: restProformaBody.shopId,
    discount,
    tax,
    grandTotal,
    itemsCount: validatedItems.length,
    items: validatedItems.map((i) => ({
      isBox: i.isBox,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    })),
  });

  // Create the proforma transaction
  const result = await prisma.$transaction(async (tx) => {
    const proforma = await tx.proforma.create({
      data: {
        ...restProformaBody,
        proformaDate,
        validUntil,
        totalProducts,
        subTotal,
        discount,
        tax,
        grandTotal,
        status: 'PENDING',
        createdById: userId,
        items: {
          create: validatedItems.map((item) => {
            console.log(`📝 [BACKEND] Creating item with isBox:`, item.isBox);
            return {
              productId: item.productId,
              isBox: item.isBox, // Make sure this is boolean
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              discount: item.discount || 0,
            };
          }),
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        customer: true,
        shop: true,
        createdBy: true,
      },
    });

    // Log created items to verify
    console.log(
      '✅ [BACKEND] Created proforma items:',
      proforma.items.map((i) => ({
        id: i.id,
        isBox: i.isBox,
        quantity: i.quantity,
        productName: i.product?.name,
      })),
    );

    // Create log entry
    await tx.log.create({
      data: {
        action: `Created proforma ${proforma.proformaNo} with ${totalProducts} items`,
        userId,
      },
    });

    return proforma;
  });

  return result;
};

// Update Proforma
// Update Proforma
const updateProforma = async (proformaId, proformaBody, userId) => {
  try {
    console.log(
      '🔵 [BACKEND] updateProforma called with body:',
      JSON.stringify(proformaBody, null, 2),
    );

    // Auto-detect and fix swapped parameters if needed
    if (
      typeof proformaId === 'object' &&
      proformaId !== null &&
      proformaId.proformaNo
    ) {
      const temp = proformaId;
      proformaId = proformaBody;
      proformaBody = temp;
    }

    // Ensure proformaId is a string
    if (typeof proformaId !== 'string') {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid proforma ID format');
    }

    // Check if proforma exists
    const existingProforma = await getProformaById(proformaId);
    if (!existingProforma) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Proforma not found');
    }

    // Check if proforma can be updated (only PENDING status can be edited)
    if (existingProforma.status !== 'PENDING') {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Cannot update proforma with status: ${existingProforma.status}. Only PENDING proformas can be edited.`,
      );
    }

    // Check if current user is the creator
    if (existingProforma.createdById !== userId) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        'Only the creator can update this proforma',
      );
    }

    // Check if proforma number already exists (excluding current)
    if (
      proformaBody.proformaNo &&
      proformaBody.proformaNo !== existingProforma.proformaNo
    ) {
      if (await getProformaByNo(proformaBody.proformaNo)) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          'Proforma number already taken',
        );
      }
    }

    // Parse items - handle both string and object
    let { items } = proformaBody;
    if (typeof items === 'string') {
      items = JSON.parse(items);
    }

    // Remove items from proformaBody to avoid conflicts
    const { items: _, ...restProformaBody } = proformaBody;

    console.log('📦 [BACKEND] Raw items for update:', items);
    console.log('📦 [BACKEND] Items count:', items?.length);
    console.log('📦 [BACKEND] Items type:', typeof items);
    console.log('📦 [BACKEND] Is array:', Array.isArray(items));

    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Proforma must have at least one item',
      );
    }

    // Validate individual item properties
    items.forEach((item, index) => {
      console.log(`🔍 [BACKEND] Update Item ${index + 1}:`, {
        productId: item.productId,
        isBox: item.isBox,
        isBoxType: typeof item.isBox,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      });

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
        console.error(
          `❌ [BACKEND] Update Item ${index + 1} invalid isBox type:`,
          typeof item.isBox,
          item.isBox,
        );
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          `Item ${index + 1} has invalid isBox value`,
        );
      }
    });

    // Recalculate totals
    const validatedItems = items.map((item) => ({
      productId: item.productId,
      isBox: item.isBox === true, // Ensure boolean
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      totalPrice: Number(item.quantity) * Number(item.unitPrice),
      discount: Number(item.discount) || 0,
    }));

    console.log('✅ [BACKEND] Processed update items:', validatedItems);
    console.log('✅ [BACKEND] Validated items count:', validatedItems.length);

    // Convert dates
    let { proformaDate } = existingProforma;
    if (restProformaBody.proformaDate) {
      proformaDate = new Date(restProformaBody.proformaDate);
      if (Number.isNaN(proformaDate.getTime())) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid proforma date');
      }
    }

    let { validUntil } = existingProforma;
    if (restProformaBody.validUntil !== undefined) {
      validUntil = restProformaBody.validUntil
        ? new Date(restProformaBody.validUntil)
        : null;
      if (validUntil && Number.isNaN(validUntil.getTime())) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid valid until date');
      }
    }

    // Calculate totals
    const totalProducts = validatedItems.length;
    const subTotal = validatedItems.reduce(
      (sum, item) => sum + item.totalPrice,
      0,
    );
    const discount =
      restProformaBody.discount !== undefined
        ? restProformaBody.discount
        : existingProforma.discount;
    const tax =
      restProformaBody.tax !== undefined
        ? restProformaBody.tax
        : existingProforma.tax;
    const grandTotal = subTotal - discount + tax;

    console.log('💰 [BACKEND] Calculated totals:', {
      totalProducts,
      subTotal,
      discount,
      tax,
      grandTotal,
    });

    // Validate shop
    const finalShopId = restProformaBody.shopId || existingProforma.shopId;
    if (!finalShopId || finalShopId.trim() === '') {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Shop must be selected for proforma',
      );
    }

    // Update the proforma
    const result = await prisma.$transaction(async (tx) => {
      // First, delete all existing items
      const deleted = await tx.proformaItem.deleteMany({
        where: { proformaId },
      });
      console.log('🗑️ [BACKEND] Deleted items count:', deleted.count);

      // Prepare update data without items
      const updateData = {
        proformaNo: restProformaBody.proformaNo || existingProforma.proformaNo,
        customerId: restProformaBody.customerId || existingProforma.customerId,
        shopId: finalShopId,
        proformaDate,
        validUntil,
        totalProducts,
        subTotal,
        discount,
        tax,
        grandTotal,
        notes:
          restProformaBody.notes !== undefined
            ? restProformaBody.notes
            : existingProforma.notes,
        updatedById: userId,
      };

      console.log('📝 [BACKEND] Update data:', updateData);

      // Update the proforma
      const proforma = await tx.proforma.update({
        where: { id: proformaId },
        data: updateData,
      });

      console.log('✅ [BACKEND] Proforma updated, now creating items...');

      // Create new items
      const createdItems = [];
      for (const item of validatedItems) {
        console.log(`📝 [BACKEND] Creating item with isBox:`, item.isBox);
        const createdItem = await tx.proformaItem.create({
          data: {
            proformaId,
            productId: item.productId,
            isBox: item.isBox,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            discount: item.discount,
          },
        });
        createdItems.push(createdItem);
        console.log(`✅ [BACKEND] Created item ${createdItem.id}:`, {
          isBox: createdItem.isBox,
          quantity: createdItem.quantity,
        });
      }

      console.log(`✅ [BACKEND] Created ${createdItems.length} items`);

      // Fetch the complete proforma with items
      const completeProforma = await tx.proforma.findUnique({
        where: { id: proformaId },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          customer: true,
          shop: true,
        },
      });

      // Create log entry
      await tx.log.create({
        data: {
          action: `Updated proforma ${completeProforma.proformaNo} with ${totalProducts} items`,
          userId,
        },
      });

      return completeProforma;
    });

    console.log('🎉 [BACKEND] Update completed successfully');
    return result;
  } catch (error) {
    console.error('❌ [BACKEND] Update error:', error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Error updating proforma: ${error.message}`,
    );
  }
};

// Delete Proforma
const deleteProforma = async (id, userId) => {
  const existingProforma = await getProformaById(id);
  if (!existingProforma) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Proforma not found');
  }

  // Check if proforma can be deleted (only PENDING or REJECTED status can be deleted)
  if (!['PENDING', 'REJECTED'].includes(existingProforma.status)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Cannot delete proforma with status: ${existingProforma.status}. Only PENDING or REJECTED proformas can be deleted.`,
    );
  }

  await prisma.$transaction(async (tx) => {
    // Delete all proforma items
    await tx.proformaItem.deleteMany({
      where: { proformaId: id },
    });

    // Delete the proforma
    await tx.proforma.delete({
      where: { id },
    });

    // Create log entry
    await tx.log.create({
      data: {
        action: `Deleted proforma ${existingProforma.proformaNo}`,
        userId,
      },
    });
  });

  return { message: 'Proforma deleted successfully' };
};

// Approve Proforma
const approveProforma = async (proformaId, userId) => {
  try {
    const proforma = await prisma.proforma.findUnique({
      where: { id: proformaId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        customer: true,
        shop: true,
      },
    });

    if (!proforma) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Proforma not found');
    }

    // Check if proforma is in PENDING status
    if (proforma.status !== 'PENDING') {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Cannot approve proforma with status: ${proforma.status}. Only PENDING proformas can be approved.`,
      );
    }

    // Check if validUntil has expired
    if (proforma.validUntil && new Date() > proforma.validUntil) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Cannot approve expired proforma',
      );
    }

    // Update proforma status to APPROVED
    const updatedProforma = await prisma.$transaction(async (tx) => {
      const result = await tx.proforma.update({
        where: { id: proformaId },
        data: {
          status: 'APPROVED',
          updatedById: userId,
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          customer: true,
          shop: true,
        },
      });

      // Create log entry
      await tx.log.create({
        data: {
          action: `Approved proforma ${proforma.proformaNo}`,
          userId,
        },
      });

      return result;
    });

    return {
      proforma: updatedProforma,
      message: 'Proforma approved successfully',
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to approve proforma: ${error.message}`,
    );
  }
};

// Reject Proforma
const rejectProforma = async (proformaId, userId, reason = null) => {
  try {
    const proforma = await prisma.proforma.findUnique({
      where: { id: proformaId },
      include: {
        customer: true,
        shop: true,
      },
    });

    if (!proforma) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Proforma not found');
    }

    // Check if proforma is in PENDING status
    if (proforma.status !== 'PENDING') {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Cannot reject proforma with status: ${proforma.status}. Only PENDING proformas can be rejected.`,
      );
    }

    // Update proforma status to REJECTED
    const updatedProforma = await prisma.$transaction(async (tx) => {
      const result = await tx.proforma.update({
        where: { id: proformaId },
        data: {
          status: 'REJECTED',
          updatedById: userId,
          notes: reason
            ? `${proforma.notes || ''}\nRejection reason: ${reason}`.trim()
            : proforma.notes,
        },
      });

      // Create log entry
      await tx.log.create({
        data: {
          action: `Rejected proforma ${proforma.proformaNo}${
            reason ? ` - Reason: ${reason}` : ''
          }`,
          userId,
        },
      });

      return result;
    });

    return {
      proforma: updatedProforma,
      message: 'Proforma rejected successfully',
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to reject proforma: ${error.message}`,
    );
  }
};

// Convert Proforma to Sale/Invoice
// Convert Proforma to Sale/Invoice
// Helper function to generate next invoice number

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

// Convert Proforma to Sale/Invoice
const convertToSale = async (proformaId, userId, saleData = {}) => {
  try {
    const proforma = await prisma.proforma.findUnique({
      where: { id: proformaId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        customer: true,
        shop: true,
      },
    });

    if (!proforma) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Proforma not found');
    }

    // Check if proforma has a shop (required for Sell)
    if (!proforma.shopId) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Proforma must have a shop associated to convert to sale',
      );
    }

    // Check if proforma can be converted (only APPROVED status)
    if (proforma.status !== 'APPROVED') {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Cannot convert proforma with status: ${proforma.status}. Only APPROVED proformas can be converted to sale.`,
      );
    }

    // Check if already converted by looking for proformaId in sell record
    const alreadyConverted = await prisma.sell.findFirst({
      where: {
        notes: {
          contains: `Converted from proforma ${proforma.proformaNo}`,
        },
      },
    });

    if (alreadyConverted) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'This proforma has already been converted to a sale',
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // Generate sequential invoice number
      let invoiceNo;

      if (saleData.invoiceNo) {
        // Use custom invoice number if provided
        invoiceNo = saleData.invoiceNo;

        // Check if custom invoice number already exists
        const existingInvoice = await tx.sell.findUnique({
          where: { invoiceNo },
        });

        if (existingInvoice) {
          throw new ApiError(
            httpStatus.BAD_REQUEST,
            `Invoice number ${invoiceNo} already exists`,
          );
        }
      } else {
        // Generate next sequential invoice number
        invoiceNo = await generateInvoiceNumber(tx);
      }

      // Calculate NetTotal (Grand Total after all calculations)
      const netTotal = proforma.grandTotal;

      // Create sale from proforma
      const sale = await tx.sell.create({
        data: {
          invoiceNo,
          paymentStatus: saleData.paymentStatus || 'PENDING',
          grandTotal: proforma.grandTotal,
          balance: proforma.grandTotal, // Initially balance equals grand total (not paid yet)
          totalPaid: 0,
          imageUrl: proforma.imageUrl || null,
          documentUrl: proforma.documentUrl || null,
          saleStatus: 'NOT_APPROVED', // Default status
          locked: false,
          customerId: proforma.customerId,
          totalProducts: proforma.totalProducts,
          subTotal: proforma.subTotal,
          discount: proforma.discount,
          vat: proforma.tax, // Map tax to vat field
          notes:
            saleData.notes || `Converted from proforma ${proforma.proformaNo}`,
          saleDate: saleData.saleDate || proforma.proformaDate || new Date(),
          NetTotal: netTotal,
          createdById: userId,
          items: {
            create: proforma.items.map((item) => ({
              productId: item.productId,
              shopId: proforma.shopId, // Required field in SellItem
              isBox: item.isBox,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              itemSaleStatus: 'PENDING', // Default status
              givenQuantity: 0,
              remainingQuantity: item.quantity,
            })),
          },
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          customer: true,
        },
      });

      // Update proforma status to CONVERTED
      await tx.proforma.update({
        where: { id: proformaId },
        data: {
          status: 'CONVERTED',
          updatedById: userId,
        },
      });

      // Create log entry
      await tx.log.create({
        data: {
          action: `Converted proforma ${proforma.proformaNo} to sale ${sale.invoiceNo}`,
          userId,
        },
      });

      return {
        sale,
        proformaId: proforma.id,
        proformaNo: proforma.proformaNo,
        message: `Proforma ${proforma.proformaNo} successfully converted to sale ${sale.invoiceNo}`,
      };
    });

    return result;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('Convert to sale error:', error);
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to convert proforma to sale: ${error.message}`,
    );
  }
};

// Add files to Proforma (image and document)
const addProformaFiles = async (proformaId, userId, structuredFiles = {}) => {
  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'User ID is required');
  }

  const existingProforma = await prisma.proforma.findUnique({
    where: { id: proformaId },
    select: {
      id: true,
      proformaNo: true,
      imageUrl: true,
      documentUrl: true,
      status: true,
    },
  });

  if (!existingProforma) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Proforma not found');
  }

  // Only allow file uploads for PENDING and APPROVED proformas
  if (!['PENDING', 'APPROVED'].includes(existingProforma.status)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Cannot add files to proforma with status: ${existingProforma.status}`,
    );
  }

  try {
    let { imageUrl } = existingProforma;
    let { documentUrl } = existingProforma;

    // Handle image upload
    if (structuredFiles.image && structuredFiles.image.length > 0) {
      const imageFile = structuredFiles.image[0];
      let fileUrl = imageFile.path;
      fileUrl = fileUrl.replace(/\\/g, '/');
      const uploadsIndex = fileUrl.indexOf('/uploads/');
      if (uploadsIndex !== -1) {
        fileUrl = fileUrl.substring(uploadsIndex);
      } else {
        fileUrl = `/uploads/proforma/images/${imageFile.filename}`;
      }
      imageUrl = fileUrl;
    }

    // Handle document upload
    if (structuredFiles.document && structuredFiles.document.length > 0) {
      const documentFile = structuredFiles.document[0];
      let fileUrl = documentFile.path;
      fileUrl = fileUrl.replace(/\\/g, '/');
      const uploadsIndex = fileUrl.indexOf('/uploads/');
      if (uploadsIndex !== -1) {
        fileUrl = fileUrl.substring(uploadsIndex);
      } else {
        fileUrl = `/uploads/proforma/documents/${documentFile.filename}`;
      }
      documentUrl = fileUrl;
    }

    const updatedProforma = await prisma.$transaction(async (tx) => {
      const proforma = await tx.proforma.update({
        where: { id: proformaId },
        data: {
          imageUrl,
          documentUrl,
        },
      });

      const addedFiles = [];
      if (structuredFiles.image && structuredFiles.image.length > 0)
        addedFiles.push('image');
      if (structuredFiles.document && structuredFiles.document.length > 0)
        addedFiles.push('document');

      if (addedFiles.length > 0) {
        await tx.log.create({
          data: {
            action: `Added/Updated ${addedFiles.join(' and ')} for proforma ${
              existingProforma.proformaNo
            }`,
            userId,
          },
        });
      }

      return proforma;
    });

    return {
      success: true,
      message: `${structuredFiles.image ? 'Image' : ''}${
        structuredFiles.image && structuredFiles.document ? ' and ' : ''
      }${
        structuredFiles.document ? 'Document' : ''
      } added/updated successfully`,
      data: updatedProforma,
    };
  } catch (error) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to add files to proforma: ${error.message}`,
    );
  }
};

// Bulk update proforma status (for expiration)
const updateExpiredProformas = async () => {
  try {
    const result = await prisma.proforma.updateMany({
      where: {
        status: 'PENDING',
        validUntil: {
          lt: new Date(),
        },
      },
      data: {
        status: 'EXPIRED',
      },
    });

    return {
      updatedCount: result.count,
      message: `${result.count} expired proformas updated`,
    };
  } catch (error) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to update expired proformas: ${error.message}`,
    );
  }
};

// Get proforma statistics
const getProformaStats = async (filter = {}) => {
  const { startDate, endDate, shopId } = filter;

  const where = {};

  if (startDate || endDate) {
    where.proformaDate = {};
    if (startDate) {
      where.proformaDate.gte = new Date(startDate);
    }
    if (endDate) {
      where.proformaDate.lte = new Date(endDate);
    }
  }

  if (shopId) {
    where.shopId = shopId;
  }

  const [totalProformas, statusCounts, totalValue] = await Promise.all([
    prisma.proforma.count({ where }),
    prisma.proforma.groupBy({
      by: ['status'],
      where,
      _count: true,
      _sum: {
        grandTotal: true,
      },
    }),
    prisma.proforma.aggregate({
      where,
      _sum: {
        grandTotal: true,
      },
    }),
  ]);

  return {
    totalProformas,
    statusBreakdown: statusCounts.map((item) => ({
      status: item.status,
      count: item._count,
      totalValue: item._sum.grandTotal || 0,
    })),
    totalValue: totalValue._sum.grandTotal || 0,
  };
};

module.exports = {
  getProformaById,
  getProformaByNo,
  getAllProformas,
  createProforma,
  updateProforma,
  deleteProforma,
  approveProforma,
  rejectProforma,
  convertToSale,
  addProformaFiles,
  updateExpiredProformas,
  getProformaStats,
};
