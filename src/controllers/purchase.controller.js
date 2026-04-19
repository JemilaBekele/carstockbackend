const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { purchaseService } = require('../services');
const ApiError = require('../utils/ApiError');

// Create Purchase
const createPurchase = catchAsync(async (req, res) => {
  console.log('=== CREATE PURCHASE DEBUG ===');

  const userId = req.user.id; // ✅ User ID from auth middleware

  const purchase = await purchaseService.createPurchase(req.body, userId);
  res.status(httpStatus.CREATED).send({
    success: true,
    message: 'Purchase created successfully',
    purchase,
  });
});

// Get Purchase by ID
const getPurchase = catchAsync(async (req, res) => {
  const purchase = await purchaseService.getPurchaseById(req.params.id);
  if (!purchase) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Purchase not found');
  }
  res.status(httpStatus.OK).send({
    success: true,
    purchase,
  });
});

// Get Purchase by Invoice Number
const getPurchaseByInvoice = catchAsync(async (req, res) => {
  const purchase = await purchaseService.getPurchaseByInvoiceNo(
    req.params.invoiceNo,
  );
  if (!purchase) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Purchase not found');
  }
  res.status(httpStatus.OK).send({
    success: true,
    purchase,
  });
});

// Get all Purchases
const getPurchases = catchAsync(async (req, res) => {
  const result = await purchaseService.getAllPurchases(req.query);
  res.status(httpStatus.OK).send({
    success: true,
    ...result,
  });
});

// Update Purchase
const updatePurchase = catchAsync(async (req, res) => {
  const purchase = await purchaseService.updatePurchase(
    req.params.id,
    req.body,
    req.user.id,
  );
  res.status(httpStatus.OK).send({
    success: true,
    message: 'Purchase updated successfully',
    purchase,
  });
});

const acceptPurchase = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { paymentStatus } = req.body; // ✅ Get paymentStatus from request body
  const userId = req.user.id; // ✅ User ID from auth middleware

  const result = await purchaseService.acceptPurchase(
    id,
    paymentStatus,
    userId,
  );

  res.status(httpStatus.OK).send({
    success: true,
    message: `Purchase accepted successfully with status ${paymentStatus}`,
    data: result,
  });
});

// Delete Purchase
const deletePurchase = catchAsync(async (req, res) => {
  await purchaseService.deletePurchase(req.params.id, req.user.id);
  res.status(httpStatus.OK).send({
    success: true,
    message: 'Purchase deleted successfully',
  });
});
const addPurchaseFiles = catchAsync(async (req, res) => {
  console.log('=== ADD PURCHASE FILES CONTROLLER START ===');

  // Log request details
  console.log('1. Request params:', req.params);
  console.log('2. Request headers:', {
    'content-type': req.headers['content-type'],
    'content-length': req.headers['content-length'],
  });

  // Structure files by field name with detailed logging
  const structuredFiles = {};

  if (req.files) {
    console.log('3. Files found in request');
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
    console.log('3. No files found in request');
  }

  console.log('4. Structured files keys:', Object.keys(structuredFiles));

  // Validate purchase ID
  const purchaseId = req.params.id;
  if (!purchaseId) {
    console.error('❌ Purchase ID is missing');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Purchase ID is required');
  }
  console.log('5. Purchase ID:', purchaseId);

  // Validate user is authenticated
  if (!req.user || !req.user.id) {
    console.error('❌ User not authenticated or user ID missing');
    throw new ApiError(httpStatus.UNAUTHORIZED, 'User not authenticated');
  }
  console.log('6. User ID:', req.user.id);

  // Validate at least one file is provided
  if (Object.keys(structuredFiles).length === 0) {
    console.error('❌ No files provided');
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'At least one file (image or document) is required',
    );
  }
  console.log('7. File validation passed');

  try {
    console.log('8. Calling service to add files to purchase...');
    console.log('   - Purchase ID:', purchaseId);
    console.log('   - User ID:', req.user.id);
    console.log('   - Files to add:', Object.keys(structuredFiles));

    const result = await purchaseService.addPurchaseFiles(
      purchaseId,
      req.user.id,
      structuredFiles,
    );

    console.log('9. Service call successful');
    console.log('10. Response - Success:', result.success);
    console.log('11. Response - Message:', result.message);
    console.log('12. Updated purchase ID:', result.data?.id);
    console.log('13. Invoice No:', result.data?.invoiceNo);
    console.log('14. Image URL:', result.data?.imageUrl);
    console.log('15. Document URL:', result.data?.documentUrl);

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

    console.log('16. Response sent successfully');
  } catch (error) {
    console.error('=== ERROR IN ADD PURCHASE FILES CONTROLLER ===');
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
      `Failed to add files to purchase: ${error.message}`,
    );
  }

  console.log('=== ADD PURCHASE FILES CONTROLLER END ===');
});
module.exports = {
  createPurchase,
  getPurchase,
  getPurchaseByInvoice,
  getPurchases,
  updatePurchase,
  deletePurchase,
  acceptPurchase,
  addPurchaseFiles,
};
