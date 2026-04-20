/* eslint-disable no-underscore-dangle */
const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const prisma = require('./prisma');

// Get all totals with items
const getAllTotalsWithItems = async () => {
  try {
    // Purchase Counts by Status
    const purchaseCounts = await prisma.purchase.groupBy({
      by: ['paymentStatus'],
      _count: {
        id: true,
      },
    });

    const totalApprovedPurchases =
      purchaseCounts.find((p) => p.paymentStatus === 'APPROVED')?._count.id ||
      0;
    const totalCancelledPurchases =
      purchaseCounts.find((p) => p.paymentStatus === 'REJECTED')?._count.id ||
      0;
    const totalPendingPurchases =
      purchaseCounts.find((p) => p.paymentStatus === 'PENDING')?._count.id || 0;
    const totalPurchaseCount = purchaseCounts.reduce(
      (sum, p) => sum + p._count.id,
      0,
    );

    // Transfer Counts by Status
    const transferCounts = await prisma.transfer.groupBy({
      by: ['status'],
      _count: {
        id: true,
      },
    });

    const totalCompletedTransfers =
      transferCounts.find((t) => t.status === 'COMPLETED')?._count.id || 0;
    const totalCancelledTransfers =
      transferCounts.find((t) => t.status === 'CANCELLED')?._count.id || 0;
    const totalPendingTransfers =
      transferCounts.find((t) => t.status === 'PENDING')?._count.id || 0;
    const totalTransferCount = transferCounts.reduce(
      (sum, t) => sum + t._count.id,
      0,
    );

    // Sell Counts by Status
    const sellCounts = await prisma.sell.groupBy({
      by: ['saleStatus'],
      _count: {
        id: true,
      },
    });

    const totalNotApprovedSells =
      sellCounts.find((s) => s.saleStatus === 'NOT_APPROVED')?._count.id || 0;
    const totalPartiallyDeliveredSells =
      sellCounts.find((s) => s.saleStatus === 'PARTIALLY_DELIVERED')?._count
        .id || 0;
    const totalApprovedSells =
      sellCounts.find((s) => s.saleStatus === 'APPROVED')?._count.id || 0;
    const totalDeliveredSells =
      sellCounts.find((s) => s.saleStatus === 'DELIVERED')?._count.id || 0;
    const totalCancelledSells =
      sellCounts.find((s) => s.saleStatus === 'CANCELLED')?._count.id || 0;
    const totalSellCount = sellCounts.reduce((sum, s) => sum + s._count.id, 0);

    // Stock Correction Counts by Status
    const stockCorrectionCounts = await prisma.stockCorrection.groupBy({
      by: ['status'],
      _count: {
        id: true,
      },
    });

    const totalApprovedStockCorrections =
      stockCorrectionCounts.find((sc) => sc.status === 'APPROVED')?._count.id ||
      0;
    const totalRejectedStockCorrections =
      stockCorrectionCounts.find((sc) => sc.status === 'REJECTED')?._count.id ||
      0;
    const totalPendingStockCorrections =
      stockCorrectionCounts.find((sc) => sc.status === 'PENDING')?._count.id ||
      0;
    const totalStockCorrectionCount = stockCorrectionCounts.reduce(
      (sum, sc) => sum + sc._count.id,
      0,
    );

    // Sell Stock Correction Counts by Status
    const sellStockCorrectionCounts = await prisma.sellStockCorrection.groupBy({
      by: ['status'],
      _count: {
        id: true,
      },
    });

    const totalApprovedSellCorrections =
      sellStockCorrectionCounts.find((ssc) => ssc.status === 'APPROVED')?._count
        .id || 0;
    const totalRejectedSellCorrections =
      sellStockCorrectionCounts.find((ssc) => ssc.status === 'REJECTED')?._count
        .id || 0;
    const totalPendingSellCorrections =
      sellStockCorrectionCounts.find((ssc) => ssc.status === 'PENDING')?._count
        .id || 0;
    const totalSellStockCorrectionCount = sellStockCorrectionCounts.reduce(
      (sum, ssc) => sum + ssc._count.id,
      0,
    );

    // Financial totals (if still needed for some calculations)
    const approvedPurchasesFinancial = await prisma.purchase.aggregate({
      where: { paymentStatus: 'APPROVED' },
      _sum: { grandTotal: true },
    });

    const approvedSellsFinancial = await prisma.sell.aggregate({
      where: { saleStatus: 'APPROVED' },
      _sum: { NetTotal: true },
    });

    const grandTotalCount =
      totalPurchaseCount +
      totalTransferCount +
      totalSellCount +
      totalStockCorrectionCount +
      totalSellStockCorrectionCount;

    return {
      // Purchase counts
      purchase: {
        approved: totalApprovedPurchases,
        cancelled: totalCancelledPurchases,
        pending: totalPendingPurchases,
        total: totalPurchaseCount,
        financialTotal: approvedPurchasesFinancial._sum.grandTotal || 0,
      },

      // Transfer counts
      transfer: {
        completed: totalCompletedTransfers,
        cancelled: totalCancelledTransfers,
        pending: totalPendingTransfers,
        total: totalTransferCount,
      },

      // Sell counts
      sell: {
        notApproved: totalNotApprovedSells,
        partiallyDelivered: totalPartiallyDeliveredSells,
        approved: totalApprovedSells,
        delivered: totalDeliveredSells,
        cancelled: totalCancelledSells,
        total: totalSellCount,
        financialTotal: approvedSellsFinancial._sum.NetTotal || 0,
      },

      // Stock Correction counts
      stockCorrection: {
        approved: totalApprovedStockCorrections,
        rejected: totalRejectedStockCorrections,
        pending: totalPendingStockCorrections,
        total: totalStockCorrectionCount,
      },

      // Sell Stock Correction counts
      sellStockCorrection: {
        approved: totalApprovedSellCorrections,
        rejected: totalRejectedSellCorrections,
        pending: totalPendingSellCorrections,
        total: totalSellStockCorrectionCount,
      },

      // Overall totals
      grandTotalCount,
      totalFinancial:
        (approvedPurchasesFinancial._sum.grandTotal || 0) +
        (approvedSellsFinancial._sum.NetTotal || 0),
    };
  } catch (error) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Error fetching dashboard totals data',
    );
  }
};
// Get sell status pie chart data
const getSellStatusPieChart = async () => {
  try {
    // Aggregate total NetTotal for each sale status
    const sellStatusAggregation = await prisma.sell.groupBy({
      by: ['saleStatus'],
      _sum: {
        NetTotal: true,
      },
      _count: {
        id: true,
      },
    });

    // Calculate total for percentage calculations
    const totalNetTotal = sellStatusAggregation.reduce(
      (sum, item) => sum + (item._sum.NetTotal || 0),
      0,
    );

    const totalCount = sellStatusAggregation.reduce(
      (sum, item) => sum + (item._count.id || 0),
      0,
    );

    // Define status labels and colors for the chart
    const statusConfig = {
      NOT_APPROVED: { label: 'Not Approved', color: 'var(--chart-1)' },
      PARTIALLY_DELIVERED: {
        label: 'Partially Delivered',
        color: 'var(--chart-2)',
      },
      APPROVED: { label: 'Approved', color: 'var(--chart-3)' },
      DELIVERED: { label: 'Delivered', color: 'var(--chart-4)' },
      CANCELLED: { label: 'Cancelled', color: 'var(--chart-5)' },
    };

    // Transform data for pie chart in Recharts format
    const chartData = Object.keys(statusConfig).map((status) => {
      const aggregationItem = sellStatusAggregation.find(
        (item) => item.saleStatus === status,
      );
      const amount = aggregationItem?._sum.NetTotal || 0;

      return {
        status,
        label: statusConfig[status].label,
        amount,
        count: aggregationItem?._count.id || 0,
        fill: statusConfig[status].color,
        percentage: totalNetTotal > 0 ? (amount / totalNetTotal) * 100 : 0,
      };
    });

    // Create chart config for Recharts
    const chartConfig = {
      amount: {
        label: 'Sales Amount',
      },
      ...Object.fromEntries(
        Object.entries(statusConfig).map(([status, config]) => [
          status.toLowerCase(),
          {
            label: config.label,
            color: config.color,
          },
        ]),
      ),
    };

    return {
      summary: {
        totalNetTotal,
        totalCount,
        data: chartData,
      },
      chartData: chartData.map((item) => ({
        status: item.status.toLowerCase(),
        amount: item.amount,
        fill: item.fill,
        label: item.label,
        count: item.count,
        percentage: item.percentage,
      })),
      chartConfig,
      totalAmount: totalNetTotal,
      totalTransactions: totalCount,
    };
  } catch (error) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Error fetching pie chart data',
    );
  }
};
const predictNextTopProduct = async (monthlyData) => {
  try {
    const months = Array.from(monthlyData.keys()).sort();

    if (months.length === 0) {
      return {
        topPredictedProduct: null,
        alternativeProducts: [],
      };
    }

    // Build product performance data
    const productPerformance = new Map();

    months.forEach((monthKey, monthIndex) => {
      const productMap = monthlyData.get(monthKey);

      productMap.forEach((stats, productId) => {
        if (!productPerformance.has(productId)) {
          productPerformance.set(productId, {
            productId,
            productName: stats.productName,
            productCode: stats.productCode,
            categoryName: stats.categoryName,
            brandName: stats.brandName,
            monthlyQuantities: new Array(months.length).fill(0),
            monthlyRevenues: new Array(months.length).fill(0),
            averageQuantity: 0,
            averageRevenue: 0,
            trend: 'stable',
          });
        }

        const perf = productPerformance.get(productId);
        perf.monthlyQuantities[monthIndex] = stats.totalQuantity;
        perf.monthlyRevenues[monthIndex] = stats.totalRevenue;
      });
    });


    if (productPerformance.size === 0) {
      return {
        topPredictedProduct: null,
        alternativeProducts: [],
      };
    }

    // Calculate predictions for each product
    const predictions = Array.from(productPerformance.values())
      .map((perf) => {
        const nonZeroQuantities = perf.monthlyQuantities.filter((q) => q > 0);
        const nonZeroRevenues = perf.monthlyRevenues.filter((r) => r > 0);

        if (nonZeroQuantities.length === 0) return null;

        perf.averageQuantity =
          nonZeroQuantities.reduce((a, b) => a + b, 0) /
          nonZeroQuantities.length;
        perf.averageRevenue =
          nonZeroRevenues.reduce((a, b) => a + b, 0) / nonZeroRevenues.length;

        const recentMonths = perf.monthlyQuantities.slice(-3);

        if (recentMonths.length >= 2 && recentMonths.every((q) => q > 0)) {
          const x = [0, 1, 2];
          const n = recentMonths.length;
          const sumX = x.reduce((a, b) => a + b, 0);
          const sumY = recentMonths.reduce((a, b) => a + b, 0);
          const sumXY = x.reduce(
            (sum, xi, idx) => sum + xi * recentMonths[idx],
            0,
          );
          const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

          const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

          let trend = 'stable';
          if (slope > 0.1) trend = 'increasing';
          else if (slope < -0.1) trend = 'decreasing';

          const lastMonthIndex = recentMonths.length - 1;
          const predictedQuantity = Math.max(
            0,
            Math.round(recentMonths[lastMonthIndex] + slope),
          );
          const predictedRevenue =
            predictedQuantity * (perf.averageRevenue / perf.averageQuantity);

          const variance =
            recentMonths.reduce(
              (sum, q) => sum + (q - perf.averageQuantity) ** 2,
              0,
            ) / recentMonths.length;
          const confidence = Math.min(
            95,
            Math.max(
              50,
              70 +
                Math.abs(slope) * 10 -
                (variance / perf.averageQuantity) * 10,
            ),
          );

          return {
            productId: perf.productId,
            productName: perf.productName,
            productCode: perf.productCode,
            categoryName: perf.categoryName,
            brandName: perf.brandName,
            predictedRank: 0,
            predictedRevenue,
            predictedQuantity,
            confidence: Math.round(confidence),
          };
        }

        return {
          productId: perf.productId,
          productName: perf.productName,
          productCode: perf.productCode,
          categoryName: perf.categoryName,
          brandName: perf.brandName,
          predictedRank: 0,
          predictedRevenue: perf.averageRevenue,
          predictedQuantity: Math.round(perf.averageQuantity),
          confidence: 50,
        };
      })
      .filter(Boolean);


    if (predictions.length === 0) {
      return {
        topPredictedProduct: null,
        alternativeProducts: [],
      };
    }

    // Sort by weighted score
    predictions.sort((a, b) => {
      const scoreA = a.predictedRevenue * 0.6 + a.predictedQuantity * 0.4;
      const scoreB = b.predictedRevenue * 0.6 + b.predictedQuantity * 0.4;
      return scoreB - scoreA;
    });

    // Assign ranks
    predictions.forEach((pred, idx) => {
      pred.predictedRank = idx + 1;
    });
    return {
      topPredictedProduct: predictions[0],
      alternativeProducts: predictions.slice(1, 6),
    };
  } catch (error) {
    return {
      topPredictedProduct: null,
      alternativeProducts: [],
    };
  }
};

const getProductStockStatus = async (productId) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        warningQuantity: true,
        name: true,
      },
    });

    if (!product) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        `Product not found: ${productId}`,
      );
    }

    const storeStocks = await prisma.storeStock.findMany({
      where: { productId },
      select: { quantity: true },
    });

    const shopStocks = await prisma.shopStock.findMany({
      where: { productId },
      select: { quantity: true },
    });

    const totalStoreStock = storeStocks.reduce(
      (sum, stock) => sum + stock.quantity,
      0,
    );
    const totalShopStock = shopStocks.reduce(
      (sum, stock) => sum + stock.quantity,
      0,
    );
    const totalStock = totalStoreStock + totalShopStock;


    const warningQuantity = product.warningQuantity || 10;

    let stockLevel;
    let recommendation;

    if (totalStock <= 0) {
      stockLevel = 'CRITICAL';
      recommendation =
        'URGENT: Product is out of stock. Immediate replenishment required.';
    } else if (totalStock <= warningQuantity) {
      stockLevel = 'CRITICAL';
      recommendation = `Stock is critically low (${totalStock} units). Below warning threshold of ${warningQuantity}. Reorder immediately.`;
    } else if (totalStock <= warningQuantity * 2) {
      stockLevel = 'LOW';
      recommendation = `Stock is low (${totalStock} units). Consider reordering soon to avoid stockouts.`;
    } else if (totalStock <= warningQuantity * 5) {
      stockLevel = 'ADEQUATE';
      recommendation = `Stock levels are adequate (${totalStock} units). Monitor sales velocity.`;
    } else {
      stockLevel = 'HIGH';
      recommendation = `Stock levels are high (${totalStock} units). Ensure proper inventory turnover.`;
    }

    return {
      currentStock: {
        storeStock: totalStoreStock,
        shopStock: totalShopStock,
        totalStock,
      },
      stockLevel,
      warningQuantity: warningQuantity || 10,
      recommendation,
    };
  } catch (error) {
    console.error('    === ERROR in getProductStockStatus ===');
    console.error('    Error message:', error.message);
    console.error('    Error stack:', error.stack);
    throw error;
  }
};

const generateRecommendations = (prediction, stockStatus) => {
  const recommendations = [];

  // Stock-related recommendations
  if (stockStatus.stockLevel === 'CRITICAL') {
    recommendations.push(
      `🔴 ${stockStatus.recommendation} Expected demand: ${prediction.topPredictedProduct.predictedQuantity} units next month.`,
    );
    recommendations.push(
      `📦 Priority purchase order needed for ${prediction.topPredictedProduct.productName} - at least ${prediction.topPredictedProduct.predictedQuantity} units.`,
    );
    recommendations.push(
      `⚡ Consider splitting order: 60% now, 40% in 2 weeks to manage cash flow.`,
    );
  } else if (stockStatus.stockLevel === 'LOW') {
    recommendations.push(`🟡 ${stockStatus.recommendation}`);
    recommendations.push(
      `📊 Based on predicted demand (${
        prediction.topPredictedProduct.predictedQuantity
      } units), place order for ${Math.max(
        0,
        prediction.topPredictedProduct.predictedQuantity -
          stockStatus.currentStock.totalStock,
      )} units.`,
    );
    recommendations.push(
      `🎯 Set reorder point at ${Math.round(
        prediction.topPredictedProduct.predictedQuantity * 0.3,
      )} units for this product.`,
    );
  } else if (stockStatus.stockLevel === 'ADEQUATE') {
    recommendations.push(`🟢 ${stockStatus.recommendation}`);
    recommendations.push(
      `📈 Current stock (${
        stockStatus.currentStock.totalStock
      } units) can cover ${Math.floor(
        (stockStatus.currentStock.totalStock /
          prediction.topPredictedProduct.predictedQuantity) *
          100,
      )}% of predicted demand.`,
    );
    recommendations.push(
      `🔄 Monitor weekly sales velocity and reorder when stock reaches ${Math.round(
        prediction.topPredictedProduct.predictedQuantity * 0.3,
      )} units.`,
    );
  } else {
    recommendations.push(`✅ ${stockStatus.recommendation}`);
    recommendations.push(
      `💰 Consider running promotions or bundle deals to increase turnover of ${prediction.topPredictedProduct.productName}.`,
    );
    recommendations.push(
      `📦 High stock levels (${stockStatus.currentStock.totalStock} units) - avoid new purchases for 4-6 weeks.`,
    );
  }

  // Marketing recommendations based on confidence
  if (prediction.topPredictedProduct.confidence > 80) {
    recommendations.push(
      `🎯 High confidence prediction (${prediction.topPredictedProduct.confidence}%) - Prepare marketing campaign for ${prediction.topPredictedProduct.productName}.`,
    );
    recommendations.push(
      `📢 Create bundle offers with complementary products to increase average order value.`,
    );
  }

  // Alternative products recommendation
  recommendations.push(
    `🔄 Backup options: If ${prediction.topPredictedProduct.productName} faces stock issues, promote these alternatives:`,
  );
  prediction.alternativeProducts.slice(0, 3).forEach((alt) => {
    recommendations.push(
      `   • ${alt.productName} (${alt.categoryName}) - Confidence: ${alt.confidence}%`,
    );
  });

  // Operational recommendations
  recommendations.push(
    `📊 Increase safety stock for ${
      prediction.topPredictedProduct.productName
    } to ${Math.round(
      prediction.topPredictedProduct.predictedQuantity * 0.5,
    )} units based on predicted demand.`,
  );
  recommendations.push(
    `🔍 Review supplier lead times and consider backup suppliers for top predicted products.`,
  );

  return recommendations;
};
const getTopProductsReportWithPrediction = async () => {
  try {

    // Calculate date range for past 7 months
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(endDate.getMonth() - 7);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);


   

    // Get all sales in the date range (not just APPROVED)
    // Include DELIVERED, APPROVED, and PARTIALLY_DELIVERED
    const sales = await prisma.sell.findMany({
      where: {
        saleStatus: {
          in: ['APPROVED', 'DELIVERED', 'PARTIALLY_DELIVERED'], // Include multiple statuses
        },
        saleDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                category: true,
                brand: true,
              },
            },
          },
        },
      },
      orderBy: {
        saleDate: 'asc',
      },
    });

 

    // If no sales found, try to get all sales without date filter to debug
    if (sales.length === 0) {
      const allSales = await prisma.sell.findMany({
        take: 5,
        include: {
          items: true,
        },
      });
    
    }

    // If still no sales, return empty report with helpful message
    if (sales.length === 0) {

      return {
        period: {
          startDate,
          endDate,
          monthsCovered: 7,
        },
        monthlyReports: [],
        prediction: {
          topPredictedProduct: null,
          stockStatus: null,
          recommendations: [
            'No sales data found for the selected period. Please ensure there are approved or delivered sales in the database.',
          ],
          alternativeProducts: [],
        },
        summary: {
          totalRevenue: 0,
          totalQuantity: 0,
          uniqueProductsSold: 0,
          averageMonthlyRevenue: 0,
        },
        message: 'No sales data available for the past 7 months',
      };
    }

    // Group sales by month using reduce
    const monthlyData = sales.reduce((acc, sale) => {
      const saleDate = new Date(sale.saleDate);
      const monthKey = `${saleDate.getFullYear()}-${String(
        saleDate.getMonth() + 1,
      ).padStart(2, '0')}`;

      if (!acc.has(monthKey)) {
        acc.set(monthKey, new Map());
      }

      const productMap = acc.get(monthKey);

      sale.items.forEach((item) => {
        if (!productMap.has(item.productId)) {
          productMap.set(item.productId, {
            productId: item.productId,
            productName: item.product.name,
            productCode: item.product.productCode,
            categoryName: item.product.category?.name || 'Uncategorized',
            brandName: item.product.brand?.name || 'No Brand',
            totalQuantity: 0,
            totalRevenue: 0,
            averagePrice: 0,
          });
        }

        const stats = productMap.get(item.productId);
        stats.totalQuantity += item.quantity;
        stats.totalRevenue += item.totalPrice;
        stats.averagePrice = stats.totalRevenue / stats.totalQuantity;
      });

      return acc;
    }, new Map());

  
    // Prepare monthly reports with top 50 by revenue and quantity
    const monthlyReports = [];
    let totalRevenueAllMonths = 0;
    let totalQuantityAllMonths = 0;
    const allProductsSold = new Set();

    monthlyData.forEach((productMap, monthKey) => {
      const [year, month] = monthKey.split('-');
      const products = Array.from(productMap.values());


      // Update totals
      products.forEach((product) => {
        totalRevenueAllMonths += product.totalRevenue;
        totalQuantityAllMonths += product.totalQuantity;
        allProductsSold.add(product.productId);
      });

      // Sort and get top 50 by revenue
      const topByRevenue = [...products]
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, 50);

      // Sort and get top 50 by quantity
      const topByQuantity = [...products]
        .sort((a, b) => b.totalQuantity - a.totalQuantity)
        .slice(0, 50);

      monthlyReports.push({
        month: new Date(parseInt(year), parseInt(month) - 1).toLocaleString(
          'default',
          { month: 'long' },
        ),
        year: parseInt(year),
        topByRevenue,
        topByQuantity,
      });
    });

    // Sort monthly reports chronologically
    monthlyReports.sort((a, b) => {
      const dateA = new Date(`${a.month} ${a.year}`);
      const dateB = new Date(`${b.month} ${b.year}`);
      return dateA - dateB;
    });

  

    // Predict next month's top product (only if we have data)
    let prediction = {
      topPredictedProduct: null,
      alternativeProducts: [],
    };

    if (monthlyData.size > 0) {
      prediction = await predictNextTopProduct(monthlyData);
     
    }

    // Get stock status for predicted product (only if we have a prediction)
    let stockStatus = null;
    if (prediction.topPredictedProduct) {
     
      stockStatus = await getProductStockStatus(
        prediction.topPredictedProduct.productId,
      );
    }

    // Generate recommendations
    let recommendations = [];
    if (prediction.topPredictedProduct && stockStatus) {
      recommendations = generateRecommendations(prediction, stockStatus);
    } else {
      recommendations = [
        'Not enough sales data to generate predictions. Continue recording sales to enable predictive analytics.',
      ];
    }


    return {
      period: {
        startDate,
        endDate,
        monthsCovered: 7,
      },
      monthlyReports,
      prediction: {
        topPredictedProduct: prediction.topPredictedProduct,
        stockStatus,
        recommendations,
        alternativeProducts: prediction.alternativeProducts,
      },
      summary: {
        totalRevenue: totalRevenueAllMonths,
        totalQuantity: totalQuantityAllMonths,
        uniqueProductsSold: allProductsSold.size,
        averageMonthlyRevenue: totalRevenueAllMonths / 7,
      },
    };
  } catch (error) {
 
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Error generating top products report: ${error.message}`,
    );
  }
};



module.exports = {
  getAllTotalsWithItems,
  getSellStatusPieChart,
  getTopProductsReportWithPrediction,
};
