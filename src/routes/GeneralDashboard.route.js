const express = require('express');
const { GeneralDashboardController } = require('../controllers');
const auth = require('../middlewares/auth');

const router = express.Router();

/**
 * General Dashboard Routes
 */
router.get(
  '/api/dashboard/financial-totals',
  // auth,
  GeneralDashboardController.getAllTotalsWithItems,
);
router.get(
  '/api/dashboard/top-products-report',
  // auth,
  GeneralDashboardController.getTopProductsReportWithPrediction,
);
router.get(
  '/api/dashboard/sell-status-chart',
  // auth,
  GeneralDashboardController.getSellStatusPieChart,
);

module.exports = router;
