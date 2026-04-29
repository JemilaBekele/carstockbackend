const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { proformaService } = require('../services');
const ApiError = require('../utils/ApiError');

// Create Proforma
const createProforma = catchAsync(async (req, res) => {
  const userId = req.user.id; // User ID from auth middleware

  const proforma = await proformaService.createProforma(req.body, userId);
  res.status(httpStatus.CREATED).send({
    success: true,
    message: 'Proforma created successfully',
    proforma,
  });
});

// Get Proforma by ID
const getProforma = catchAsync(async (req, res) => {
  const proforma = await proformaService.getProformaById(req.params.id);
  if (!proforma) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Proforma not found');
  }
  res.status(httpStatus.OK).send({
    success: true,
    proforma,
  });
});

// Get Proforma by Proforma Number
const getProformaByNumber = catchAsync(async (req, res) => {
  const proforma = await proformaService.getProformaByNo(req.params.proformaNo);
  if (!proforma) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Proforma not found');
  }
  res.status(httpStatus.OK).send({
    success: true,
    proforma,
  });
});

// Get all Proformas
const getProformas = catchAsync(async (req, res) => {
  const result = await proformaService.getAllProformas(req.query);
  res.status(httpStatus.OK).send({
    success: true,
    ...result,
  });
});

// Update Proforma
const updateProforma = catchAsync(async (req, res) => {
  const proforma = await proformaService.updateProforma(
    req.params.id,
    req.body,
    req.user.id,
  );
  res.status(httpStatus.OK).send({
    success: true,
    message: 'Proforma updated successfully',
    proforma,
  });
});

// Approve Proforma
const approveProforma = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const result = await proformaService.approveProforma(id, userId);

  res.status(httpStatus.OK).send({
    success: true,
    message: 'Proforma approved successfully',
    data: result,
  });
});

// Reject Proforma
const rejectProforma = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const userId = req.user.id;

  const result = await proformaService.rejectProforma(id, userId, reason);

  res.status(httpStatus.OK).send({
    success: true,
    message: 'Proforma rejected successfully',
    data: result,
  });
});

// Convert Proforma to Sale
const convertProformaToSale = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const saleData = req.body;

  const result = await proformaService.convertToSale(id, userId, saleData);

  res.status(httpStatus.OK).send({
    success: true,
    message: result.message,
    data: {
      sale: result.sale,
      proformaId: result.proformaId,
    },
  });
});

// Delete Proforma
const deleteProforma = catchAsync(async (req, res) => {
  await proformaService.deleteProforma(req.params.id, req.user.id);
  res.status(httpStatus.OK).send({
    success: true,
    message: 'Proforma deleted successfully',
  });
});

// Add files to Proforma (image and document)
const addProformaFiles = catchAsync(async (req, res) => {
  // Structure files by field name with detailed logging
  const structuredFiles = {};

  if (req.files) {
    for (const [fieldname, files] of Object.entries(req.files)) {
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
    console.log('No files found in request');
  }

  // Validate proforma ID
  const proformaId = req.params.id;
  if (!proformaId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Proforma ID is required');
  }

  // Validate user is authenticated
  if (!req.user || !req.user.id) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'User not authenticated');
  }

  // Validate at least one file is provided
  if (Object.keys(structuredFiles).length === 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'At least one file (image or document) is required',
    );
  }

  try {
    const result = await proformaService.addProformaFiles(
      proformaId,
      req.user.id,
      structuredFiles,
    );

    res.status(httpStatus.OK).send({
      success: true,
      message: result.message,
      data: {
        id: result.data.id,
        proformaNo: result.data.proformaNo,
        imageUrl: result.data.imageUrl,
        documentUrl: result.data.documentUrl,
      },
    });
  } catch (error) {
    // Check if it's already an ApiError
    if (error instanceof ApiError) {
      throw error;
    }

    // Convert to ApiError if not
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to add files to proforma: ${error.message}`,
    );
  }
});

// Update expired proformas (can be called by cron job)
const updateExpiredProformas = catchAsync(async (req, res) => {
  const result = await proformaService.updateExpiredProformas();

  res.status(httpStatus.OK).send({
    success: true,
    message: result.message,
    updatedCount: result.updatedCount,
  });
});

// Get proforma statistics
const getProformaStats = catchAsync(async (req, res) => {
  const stats = await proformaService.getProformaStats(req.query);

  res.status(httpStatus.OK).send({
    success: true,
    data: stats,
  });
});

module.exports = {
  createProforma,
  getProforma,
  getProformaByNumber,
  getProformas,
  updateProforma,
  approveProforma,
  rejectProforma,
  convertProformaToSale,
  deleteProforma,
  addProformaFiles,
  updateExpiredProformas,
  getProformaStats,
};