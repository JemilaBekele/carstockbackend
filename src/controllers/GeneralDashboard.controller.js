const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { GeneralDashboardService } = require('../services');

/**
 * Get all financial totals with items for dashboard
 */
const getAllTotalsWithItems = catchAsync(async (req, res) => {
  const result = await GeneralDashboardService.getAllTotalsWithItems();

  res.status(httpStatus.OK).send({
    success: true,
    ...result,
  });
});

/**
 * Get sell status pie chart data for dashboard
 */
const getSellStatusPieChart = catchAsync(async (req, res) => {
  const result = await GeneralDashboardService.getSellStatusPieChart();

  res.status(httpStatus.OK).send({
    success: true,
    ...result,
  });
});
const getTopProductsReportWithPrediction = async (req, res) => {
  const report =
    await GeneralDashboardService.getTopProductsReportWithPrediction();
  res.status(200).json({
    success: true,
    data: report,
  });
};
module.exports = {
  getAllTotalsWithItems,
  getSellStatusPieChart,
  getTopProductsReportWithPrediction,
};
