const express = require('express');

const router = express.Router();
const { sellStockCorrectionController } = require('../controllers');
const auth = require('../middlewares/auth');
// const checkPermission = require('../middlewares/permission.middleware');

// const checkPermission = require('../middlewares/permission.middleware');

// Create SellStockCorrection
router.post(
  '/api/sell-stock-corrections',
  auth,
  // checkPermission('CREATE_SELL_STOCK_CORRECTION'),
  sellStockCorrectionController.createSellStockCorrection,
);

// Get Sell Stock Correction by ID
router.get(
  '/api/sell/stock/corrections/find/:id',
  auth,
  // checkPermission('VIEW_SELL_STOCK_CORRECTION'),
  sellStockCorrectionController.getSellByIdforsellcorrection,
);
router.get(
  '/api/sells/:sellId/stock/corrections/filter/stock',
  auth,
  // checkPermission('VIEW_SELL_STOCK_CORRECTION'),
  sellStockCorrectionController.getSellStockCorrectionfilterId,
);
router.patch(
  '/api/sells/:id/check/sellcorrection',
  auth,
  // checkPermission('UPDATE_SELL_STOCK_CORRECTION'), // Consider using an appropriate permission
  sellStockCorrectionController.markAsCheckedSellStockCorrection,
);
router.get(
  '/api/sell-stock-corrections/:id',
  auth,
  // checkPermission('VIEW_SELL_STOCK_CORRECTION'),
  sellStockCorrectionController.getSellStockCorrection,
);

// Get Sell Stock Correction by Reference
router.get(
  '/api/sell-stock-corrections/reference/:reference',
  auth,
  // checkPermission('VIEW_SELL_STOCK_CORRECTION'),
  sellStockCorrectionController.getSellStockCorrectionByReference,
);

// Get all Sell Stock Corrections (optional date filter)
router.get(
  '/api/sell-stock-corrections',
  auth,
  // checkPermission('VIEW_ALL_SELL_STOCK_CORRECTIONS'),
  sellStockCorrectionController.getSellStockCorrections,
);

// Get Sell Stock Corrections by Sell ID
router.get(
  '/api/sells/:sellId/stock-corrections',
  auth,
  // checkPermission('VIEW_ALL_SELL_STOCK_CORRECTIONS'),
  sellStockCorrectionController.getSellStockCorrectionsBySellId,
);

// Update Sell Stock Correction
router.put(
  '/api/sell-stock-corrections/:id',
  auth,
  // checkPermission('UPDATE_SELL_STOCK_CORRECTION'),
  sellStockCorrectionController.updateSellStockCorrection,
);

// Approve Sell Stock Correction
router.patch(
  '/api/sell-stock-corrections/:id/approve',
  auth,
  // checkPermission('APPROVE_SELL_STOCK_CORRECTION'),
  sellStockCorrectionController.approveSellStockCorrection,
);

// Reject Sell Stock Correction
router.patch(
  '/api/sell-stock-corrections/:id/reject',
  auth,
  // checkPermission('REJECT_SELL_STOCK_CORRECTION'),
  sellStockCorrectionController.rejectSellStockCorrection,
);

// Delete Sell Stock Correction
router.delete(
  '/api/sell-stock-corrections/:id',
  auth,
  // checkPermission('DELETE_SELL_STOCK_CORRECTION'),
  sellStockCorrectionController.deleteSellStockCorrection,
);

module.exports = router;
