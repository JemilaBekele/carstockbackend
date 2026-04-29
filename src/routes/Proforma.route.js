const express = require('express');

const router = express.Router();
const { proformaController } = require('../controllers');
const auth = require('../middlewares/auth');
const checkPermission = require('../middlewares/permission.middleware');
const { debugUploadSellFiles } = require('../utils/multer');

// Create a proforma
router.post(
  '/api/proformas',
  auth,
  //   checkPermission('CREATE_PROFORMA'),
  proformaController.createProforma,
);

// Get a proforma by ID
router.get(
  '/api/proformas/:id',
  auth,
  // checkPermission('VIEW_PROFORMA'),
  proformaController.getProforma,
);

// Get a proforma by proforma number
router.get(
  '/api/proformas/number/:proformaNo',
  auth,
  // checkPermission('VIEW_PROFORMA'),
  proformaController.getProformaByNumber,
);

// Get all proformas
router.get(
  '/api/proformas',
  auth,
  // checkPermission('VIEW_ALL_PROFORMAS'),
  proformaController.getProformas,
);

// Update a proforma
router.put(
  '/api/proformas/:id',
  auth,
  // checkPermission('UPDATE_PROFORMA'),
  proformaController.updateProforma,
);

// Approve a proforma
router.put(
  '/api/proformas/approve/:id',
  auth,
  //   checkPermission('APPROVE_PROFORMA'),
  proformaController.approveProforma,
);

// Reject a proforma
router.put(
  '/api/proformas/reject/:id',
  auth,
  //   checkPermission('REJECT_PROFORMA'),
  proformaController.rejectProforma,
);

// Convert proforma to sale
router.post(
  '/api/proformas/:id/convert-to-sale',
  auth,
  //   checkPermission('CONVERT_PROFORMA_TO_SALE'),
  proformaController.convertProformaToSale,
);

// Delete a proforma
router.delete(
  '/api/proformas/:id',
  auth,
  //   checkPermission('DELETE_PROFORMA'),
  proformaController.deleteProforma,
);

// Upload files to proforma (image/document)
router.put(
  '/api/proformas/:id/upload/file',
  auth,
  (req, res, next) => {
    // Log raw chunks as they come in
    const oldWrite = res.write;
    const oldEnd = res.end;
    const chunks = [];

    req.on('data', (chunk) => {
      chunks.push(chunk);
    });

    req.on('end', () => {
      // Log first 500 chars to see the boundary
      const buffer = Buffer.concat(chunks);
      const preview = buffer.toString('utf8', 0, Math.min(500, buffer.length));
      // Optional: log preview for debugging
      // console.log('Upload preview:', preview);
    });

    next();
  },
  debugUploadSellFiles,
  proformaController.addProformaFiles,
);

// Update expired proformas (can be called by cron job or admin)
router.post(
  '/api/proformas/update-expired',
  auth,
  //   checkPermission('UPDATE_EXPIRED_PROFORMAS'),
  proformaController.updateExpiredProformas,
);

// Get proforma statistics
router.get(
  '/api/proformas/stats/overview',
  auth,
  //   checkPermission('VIEW_PROFORMA_STATS'),
  proformaController.getProformaStats,
);

module.exports = router;
