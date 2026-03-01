/* eslint-disable no-restricted-syntax */
const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { stockLedgerReconciliationService } = require('../services');

/**
 * Find all missing stock ledgers across all sales
 */
const findMissingStockLedgers = catchAsync(async (req, res) => {
  const result =
    await stockLedgerReconciliationService.findMissingStockLedgers();

  res.status(httpStatus.OK).send({
    success: true,
    message:
      result.totalMissing === 0
        ? 'No missing stock ledgers found'
        : `Found ${result.totalMissing} missing stock ledger entries across ${result.totalAffectedSales} sales`,
    data: result,
  });
});
const deleteStockLedgerByIds = catchAsync(async (req, res) => {
  await stockLedgerReconciliationService.deleteStockLedgerByIds(req.params.id);
  res.status(httpStatus.OK).send({
    success: true,
    message: 'Customer deleted successfully',
  });
});
/**
 * Create missing stock ledger entries for a specific sale
 */
const createMissingStockLedgerForSale = catchAsync(async (req, res) => {
  const { saleId } = req.params;
  const userId = '0d0f65fe-d2c2-46f9-b787-e2164f8a773c'; // Assuming user is attached to request by auth middleware

  const result =
    await stockLedgerReconciliationService.createMissingStockLedgerForSale(
      saleId,
      userId,
    );

  res.status(httpStatus.CREATED).send({
    success: true,
    message:
      result.createdLedgers.length > 0
        ? `Successfully created ${result.createdLedgers.length} missing stock ledger entries for sale ${result.invoiceNo}`
        : 'No missing stock ledger entries needed to be created',
    data: result,
  });
});
// Get all products from sell corrections
const getProductsFromSellCorrections = catchAsync(async (req, res) => {
  const result =
    await stockLedgerReconciliationService.getAllProductsFromSellCorrections();

  res.status(httpStatus.OK).send({
    success: true,
    products: result.products,
    count: result.count,
  });
});
module.exports = {
  findMissingStockLedgers,
  createMissingStockLedgerForSale,
  getProductsFromSellCorrections,
  deleteStockLedgerByIds,
};
