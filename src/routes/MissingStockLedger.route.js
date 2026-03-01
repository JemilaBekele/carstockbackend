const express = require('express');

const router = express.Router();
const { stockLedgerReconciliationController } = require('../controllers');
const auth = require('../middlewares/auth');

// Find all missing stock ledgers across all sales
router.get(
  '/api/stock-ledger-reconciliation/missing',
  auth,
  // checkPermission('VIEW_STOCK_LEDGER_RECONCILIATION'),
  stockLedgerReconciliationController.findMissingStockLedgers,
);

// Create missing stock ledger entries for a specific sale
router.post(
  '/api/stock-ledger-reconciliation/create/:saleId',
  auth,
  // checkPermission('CREATE_STOCK_LEDGER_RECONCILIATION'),
  stockLedgerReconciliationController.createMissingStockLedgerForSale,
);
// Get all unique products from sell corrections
router.get(
  '/api/sell-corrections/products',
  auth,
  // checkPermission('VIEW_SELL_CORRECTION_PRODUCTS'),
  stockLedgerReconciliationController.getProductsFromSellCorrections,
);
router.delete(
  '/api/delete/stockLedger/:id',
  auth,
  //   checkPermission('DELETE_CUSTOMER'),
  stockLedgerReconciliationController.deleteStockLedgerByIds,
);
module.exports = router;
