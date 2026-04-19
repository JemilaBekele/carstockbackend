const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { sellService } = require('../services');
const ApiError = require('../utils/ApiError');

// Create Sell
const createSell = catchAsync(async (req, res) => {
  const userId = req.user.id; // ✅ User ID from auth middleware

  const sell = await sellService.createSell(req.body, userId);
  res.status(httpStatus.CREATED).send({
    success: true,
    message: 'Sale created successfully',
    sell,
  });
});

// Get Sell by ID
const getSell = catchAsync(async (req, res) => {
  const sell = await sellService.getSellById(req.params.id);
  if (!sell) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Sale not found');
  }
  res.status(httpStatus.OK).send({
    success: true,
    sell,
  });
});
const getSellByIdByuser = catchAsync(async (req, res) => {
  const sell = await sellService.getSellByIdByuser(req.params.id, req.user.id);
  if (!sell) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Sale not found');
  }
  res.status(httpStatus.OK).send({
    success: true,
    sell,
  });
});

const unlockSell = catchAsync(async (req, res) => {
  const sell = await sellService.unlockSell(req.params.id);
  if (!sell) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Sale not found');
  }
  res.status(httpStatus.OK).send({
    success: true,
    sell,
  });
});

// Get all Sells
const getSells = catchAsync(async (req, res) => {
  console.log('Getting all sells with query:', req.query);
  const { startDate, endDate } = req.query;

  const result = await sellService.getAllSells({
    startDate,
    endDate,
  });

  res.status(httpStatus.OK).send({
    success: true,
    ...result,
  });
});
const getAllSellsuser = catchAsync(async (req, res) => {
  const userId = req.user.id; // ✅ User ID from auth middleware getAllSellsuserweb
  const { startDate, endDate, customerName, status } = req.query;
  const result = await sellService.getAllSellsuser({
    startDate,
    endDate,
    userId,
    customerName,
    status,
  });
  res.status(httpStatus.OK).send({
    success: true,
    ...result,
  });
});
const getAllSellsuserweb = catchAsync(async (req, res) => {
  const userId = req.user.id; // ✅ User ID from auth middleware getAllSellsuserweb
  const { startDate, endDate, customerName, status } = req.query;
  const result = await sellService.getAllSellsuserweb({
    startDate,
    endDate,
    userId,
    customerName,
    status,
  });
  res.status(httpStatus.OK).send({
    success: true,
    ...result,
  });
});
const getAllSellsForStoreweb = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { startDate, endDate, customerName, salesPersonName } = req.query;

  // Handle status parameter which can be single value or array
  let statusFilter;
  if (req.query.status) {
    if (Array.isArray(req.query.status)) {
      // If multiple status parameters are provided (e.g., ?status=APPROVED&status=PENDING)
      statusFilter = req.query.status;
    } else if (req.query.status === 'all') {
      statusFilter = 'all';
    } else if (req.query.status.includes(',')) {
      // If comma-separated values
      statusFilter = req.query.status.split(',').map((s) => s.trim());
    } else {
      // Single value
      statusFilter = req.query.status;
    }
  }

  const result = await sellService.getAllSellsForStoreweb({
    startDate,
    endDate,
    userId,
    customerName: customerName?.trim(),
    salesPersonName: salesPersonName?.trim(),
    status: statusFilter,
  });

  res.status(httpStatus.OK).send({
    success: true,
    ...result,
  });
});
const getAllSellsForStore = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { startDate, endDate, customerName, salesPersonName } = req.query;

  // Handle status parameter which can be single value or array
  let statusFilter;
  if (req.query.status) {
    if (Array.isArray(req.query.status)) {
      // If multiple status parameters are provided (e.g., ?status=APPROVED&status=PENDING)
      statusFilter = req.query.status;
    } else if (req.query.status === 'all') {
      statusFilter = 'all';
    } else if (req.query.status.includes(',')) {
      // If comma-separated values
      statusFilter = req.query.status.split(',').map((s) => s.trim());
    } else {
      // Single value
      statusFilter = req.query.status;
    }
  }

  const result = await sellService.getAllSellsForStore({
    startDate,
    endDate,
    userId,
    customerName: customerName?.trim(),
    salesPersonName: salesPersonName?.trim(),
    status: statusFilter,
  });

  res.status(httpStatus.OK).send({
    success: true,
    ...result,
  });
});
const updateSell = catchAsync(async (req, res) => {
  const userId = req.user.id; // ✅ User ID from auth middleware

  const sell = await sellService.updateSell(req.params.id, req.body, userId);
  res.status(httpStatus.OK).send({
    success: true,
    message: 'Sale updated successfully',
    sell,
  });
});

// Delete Sell
const deleteSell = catchAsync(async (req, res) => {
  await sellService.deleteSell(req.params.id);
  res.status(httpStatus.OK).send({
    success: true,
    message: 'Sale deleted successfully',
  });
});
// Complete delivery for all deliverable items
// Deliver all sale items with batch data
const deliverAllSaleItems = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params; // saleId
  const { deliveryData } = req.body; // batch delivery data
  if (
    !deliveryData ||
    !deliveryData.items ||
    !Array.isArray(deliveryData.items)
  ) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Please provide valid delivery data with batch information',
    );
  }

  const sale = await sellService.deliverAllSaleItems(id, deliveryData, userId);
  res.status(httpStatus.OK).send({
    success: true,
    message:
      'All deliverable items delivered successfully with batch assignment',
    sale,
  });
});

// Complete delivery for specific items with batch data (partial delivery)
const completeSaleDelivery = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params; // saleId
  const { deliveryData } = req.body; // batch delivery data

  if (
    !deliveryData ||
    !deliveryData.items ||
    !Array.isArray(deliveryData.items)
  ) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Please provide valid delivery data with batch information',
    );
  }

  // Validate that each item has batches
  deliveryData.items.forEach((item, index) => {
    if (!item.itemId) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Item at index ${index} is missing itemId`,
      );
    }
    if (
      !item.batches ||
      !Array.isArray(item.batches) ||
      item.batches.length === 0
    ) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Item ${item.itemId} must have at least one batch with quantity`,
      );
    }
  });

  const sale = await sellService.completeSaleDelivery(id, deliveryData, userId);
  res.status(httpStatus.OK).send({
    success: true,
    message: 'Selected items delivered successfully with batch assignment',
    sale,
  });
});

// Partial delivery endpoint with batch data
const partialSaleDelivery = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params; // saleId
  const { deliveryData } = req.body; // batch delivery data

  if (
    !deliveryData ||
    !deliveryData.items ||
    !Array.isArray(deliveryData.items)
  ) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Please provide valid delivery data with batch information',
    );
  }

  // Validate that each item has batches
  deliveryData.items.forEach((item, index) => {
    if (!item.itemId) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Item at index ${index} is missing itemId`,
      );
    }
    if (
      !item.batches ||
      !Array.isArray(item.batches) ||
      item.batches.length === 0
    ) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Item ${item.itemId} must have at least one batch with quantity`,
      );
    }
  });

  const sale = await sellService.partialSaleDelivery(id, deliveryData, userId);
  res.status(httpStatus.OK).send({
    success: true,
    message: 'Partial delivery completed successfully with batch assignment',
    sale,
  });
});

// ✅ Update Sale Status
const updateSaleStatus = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params; // saleId
  const { newStatus } = req.body;

  const sale = await sellService.updateSaleStatus(id, newStatus, userId);
  res.status(httpStatus.OK).send({
    success: true,
    message: `Sale status updated to ${newStatus}`,
    sale,
  });
});

// ✅ Update Payment Status
const updatePaymentStatus = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params; // saleId
  const { newPaymentStatus } = req.body;

  const sale = await sellService.updatePaymentStatus(
    id,
    newPaymentStatus,
    userId,
  );
  res.status(httpStatus.OK).send({
    success: true,
    message: `Sale payment status updated to ${newPaymentStatus}`,
    sale,
  });
});

// ✅ Cancel Sal
const cancelSale = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params; // saleId

  const sale = await sellService.cancelSale(id, userId);
  res.status(httpStatus.OK).send({
    success: true,
    message: 'Sale cancelled successfully',
    sale,
  });
});

const addSellFiles = catchAsync(async (req, res) => {
  // Log body fields

  // Structure files by field name with detailed logging
  const structuredFiles = {};

  if (req.files) {
    console.log('   - Files found');
    for (const [fieldname, files] of Object.entries(req.files)) {
      console.log(`   - Field: "${fieldname}"`);
      console.log(`     Count: ${files.length}`);

      structuredFiles[fieldname] = files;

      files.forEach((file, index) => {
        console.log(`     [${index}] File details:`, {
          fieldname: file.fieldname,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          path: file.path,
          destination: file.destination,
          filename: file.filename,
        });
      });
    }
  } else {
    console.log('   - No files found in request');
  }

  console.log('9. Structured files keys:', Object.keys(structuredFiles));

  // Validate sell ID
  const sellId = req.params.id;
  if (!sellId) {
    console.error('❌ Sell ID is missing');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Sell ID is required');
  }

  // Validate user is authenticated
  if (!req.user || !req.user.id) {
    console.error('❌ User not authenticated or user ID missing');
    throw new ApiError(httpStatus.UNAUTHORIZED, 'User not authenticated');
  }

  // Validate at least one file is provided
  if (Object.keys(structuredFiles).length === 0) {
    console.error('❌ No files provided');
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'At least one file (image or document) is required',
    );
  }

  try {
    console.log('10. Calling service to add files to sell...');
    console.log('   - Sell ID:', sellId);
    console.log('   - User ID:', req.user.id);
    console.log('   - Files to add:', Object.keys(structuredFiles));

    const result = await sellService.addSellFiles(
      sellId,
      req.user.id,
      structuredFiles,
    );

    console.log('11. Service call successful');
    console.log('12. Response - Success:', result.success);
    console.log('13. Response - Message:', result.message);
    console.log('14. Updated sell ID:', result.data?.id);
    console.log('15. Invoice No:', result.data?.invoiceNo);
    console.log('16. Image URL:', result.data?.imageUrl);
    console.log('17. Document URL:', result.data?.documentUrl);

    res.status(httpStatus.OK).send({
      success: true,
      message: result.message,
      data: {
        id: result.data.id,
        invoiceNo: result.data.invoiceNo,
        imageUrl: result.data.imageUrl,
        documentUrl: result.data.documentUrl,
      },
    });

    console.log('18. Response sent successfully');
  } catch (error) {
    console.error('=== ERROR IN ADD SELL FILES CONTROLLER ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);

    // Check if it's already an ApiError
    if (error instanceof ApiError) {
      throw error;
    }

    // Convert to ApiError if not
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to add files to sell: ${error.message}`,
    );
  }

  console.log('=== ADD SELL FILES CONTROLLER END ===');
});
const addSellPayment = catchAsync(async (req, res) => {
  const userId = req.user?.id;
  const { sellId } = req.params;

  // Validate sellId
  if (!sellId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Sell ID is required');
  }

  // Call service
  const result = await sellService.addSellPayment(sellId, req.body, userId);

  // Response
  res.status(httpStatus.CREATED).send({
    success: true,
    message: 'Payment added successfully',
    data: result,
  });
});
const getSellPaymentHistory = catchAsync(async (req, res) => {
  const { sellId } = req.params;

  if (!sellId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Sell ID is required');
  }

  const result = await sellService.getSellPaymentHistory(sellId);

  res.status(httpStatus.OK).send({
    success: true,
    message: 'Payment history fetched successfully',
    data: result,
  });
});
module.exports = {
  createSell,
  getSell,
  getSells,
  updateSell,
  deleteSell,
  completeSaleDelivery,
  updateSaleStatus,
  updatePaymentStatus,
  cancelSale,
  deliverAllSaleItems,
  partialSaleDelivery,
  getAllSellsuser,
  getAllSellsuserweb,
  getAllSellsForStore,
  getAllSellsForStoreweb,
  getSellByIdByuser,
  unlockSell,
  addSellFiles,
  addSellPayment,
  getSellPaymentHistory,
};
