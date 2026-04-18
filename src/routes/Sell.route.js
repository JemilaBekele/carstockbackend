// routes/sell.routes.js
const express = require('express');

const router = express.Router();
const { sellController } = require('../controllers');
const auth = require('../middlewares/auth');
const checkPermission = require('../middlewares/permission.middleware');
const { debugUploadSellFiles } = require('../utils/multer');

// Create a sell
router.post('/api/sells', auth, sellController.createSell);
router.get(
  '/api/sells/user/based',
  auth,
  // checkPermission('VIEW_SHOP'),
  sellController.getAllSellsuser,
);
router.get(
  '/api/sells/user/based/web',
  auth,
  // checkPermission('VIEW_SHOP'), getAllSellsuserweb
  sellController.getAllSellsuserweb,
);

// Get a sell by ID
router.get(
  '/api/sells/:id',
  auth,
  // checkPermission('VIEW_SELL'),
  sellController.getSell,
);

router.patch(
  '/api/sells/With/Lock/:id',
  auth,
  checkPermission('VIEW_SELL'),
  sellController.unlockSell,
);

router.get('/api/sells/:id/user/based', auth, sellController.getSellByIdByuser);

// Get all sells
router.get(
  '/api/sells',
  auth,
  checkPermission('VIEW_ALL_SELLS'),
  sellController.getSells,
);

router.get('/api/sells/store/getAll', auth, sellController.getAllSellsForStore);

router.get(
  '/api/sells/store/getAll/web',
  auth,
  sellController.getAllSellsForStoreweb,
);

// Update a sell
router.put(
  '/api/sells/:id',
  auth,
  checkPermission('UPDATE_SELL'),
  sellController.updateSell,
);

// Delete a sell
router.delete(
  '/api/sells/:id',
  auth,
  checkPermission('DELETE_SELL'),
  sellController.deleteSell,
);

// ✅ Complete Sale Delivery
router.patch(
  '/api/sells/deliver/all/:id',
  auth,
  checkPermission('DELIVER_ALL_SALE_ITEMS'),
  sellController.deliverAllSaleItems,
);

router.patch(
  '/api/sells/deliver/:id',
  auth,
  checkPermission('COMPLETE_SALE_DELIVERY'),
  sellController.completeSaleDelivery,
);

router.patch(
  '/api/sells/partial/deliver/:id',
  auth,
  checkPermission('PARTIAL_SALE_DELIVERY'),
  sellController.partialSaleDelivery,
);

// ✅ Update Sale Status
router.patch(
  '/api/sells/:id/status',
  auth,
  checkPermission('UPDATE_SELL_STATUS'),
  sellController.updateSaleStatus,
);

// ✅ Update Payment Status
router.patch(
  '/api/sells/:id/payment-status',
  auth,
  checkPermission('UPDATE_PAYMENT_STATUS'),
  sellController.updatePaymentStatus,
);

// ✅ Cancel Sale
router.patch(
  '/api/sells/:id/cancel',
  auth,
  checkPermission('CANCEL_SELL'),
  sellController.cancelSale,
);
router.put(
  '/api/sell/:id/upload/file',
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
      console.log(
        'Request ended, total size:',
        Buffer.concat(chunks).length,
        'bytes',
      );

      // Log first 500 chars to see the boundary
      const buffer = Buffer.concat(chunks);
      const preview = buffer.toString('utf8', 0, Math.min(500, buffer.length));
      console.log('First 500 chars of raw request:');
      console.log(preview);
    });

    next();
  },
  debugUploadSellFiles,
  sellController.addSellFiles,
);
module.exports = router;
