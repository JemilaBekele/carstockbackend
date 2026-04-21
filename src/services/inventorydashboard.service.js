/* eslint-disable no-underscore-dangle */
const prisma = require('./prisma');

class InventoryDashboardService {
  static async getInventoryDashboard() {
    try {
      return await prisma.$transaction(async (tx) => {
        const methods = [
          { name: '_getLowStockAlerts', method: this._getLowStockAlerts },
          { name: '_getTopItemsByValue', method: this._getTopItemsByValue },
          {
            name: '_getTopSoldItems',
            method: this._getTopSoldItems,
          },
          {
            name: '_getTopPurchasedItems',
            method: this._getTopPurchasedItems,
          },
          {
            name: '_getInventoryAgingReport',
            method: this._getInventoryAgingReport,
          },
        ];

        const results = await Promise.all(
          methods.map(async ({ name, method }) => {
            try {
              const result = await method.call(this, tx);
              return result;
            } catch (error) {
              console.error(`❌ Error in ${name}:`, error.message, error.stack);
              throw error;
            }
          }),
        );

        const [lowStockItems, topItems, topSoldItems, topPurchasedItems, agingReport] = results;

        const dashboardData = {
          alerts: {
            lowStockItems,
          },
          tables: {
            topItems,
            topSoldItems,
            topPurchasedItems,
            agingReport,
          },
          lastUpdated: new Date(),
        };

        return dashboardData;
      });
    } catch (error) {
      console.error('❌ Transaction failed:', error.message, error.stack);
      throw error;
    }
  }

  // Get products with low stock (based on warningQuantity)
  static async _getLowStockAlerts(tx) {
    try {
      const result = await tx.$queryRaw`
      SELECT 
        p._id as id,
        p.name as productName,
        p.productCode,
        p.warningQuantity,
        COALESCE(store_stock.total_qty, 0) + COALESCE(shop_stock.total_qty, 0) as currentStock,
        c.name as categoryName,
        b.name as brandName,
        CASE 
          WHEN (COALESCE(store_stock.total_qty, 0) + COALESCE(shop_stock.total_qty, 0)) = 0 THEN 'OUT_OF_STOCK'
          ELSE 'LOW_STOCK'
        END as alertType,
        ROUND(
          ((COALESCE(store_stock.total_qty, 0) + COALESCE(shop_stock.total_qty, 0)) * 100.0) / 
          NULLIF(p.warningQuantity, 0), 
          2
        ) as stockPercentage,
        p.hasBox,
        p.boxSize
      FROM products p
      INNER JOIN categories c ON p.categoryId = c._id
      LEFT JOIN brands b ON p.brandId = b._id
      LEFT JOIN (
        SELECT productId, SUM(quantity) as total_qty 
        FROM store_stocks 
        WHERE status = 'Available'
        GROUP BY productId
      ) as store_stock ON p._id = store_stock.productId
      LEFT JOIN (
        SELECT productId, SUM(quantity) as total_qty 
        FROM shop_stocks 
        WHERE status = 'Available'
        GROUP BY productId
      ) as shop_stock ON p._id = shop_stock.productId
      WHERE p.warningQuantity IS NOT NULL 
        AND p.warningQuantity > 0
        AND (
          (COALESCE(store_stock.total_qty, 0) + COALESCE(shop_stock.total_qty, 0)) <= p.warningQuantity
          OR (COALESCE(store_stock.total_qty, 0) + COALESCE(shop_stock.total_qty, 0)) = 0
        )
      GROUP BY p._id, p.name, p.productCode, p.warningQuantity, c.name, b.name, p.hasBox, p.boxSize
      ORDER BY 
        CASE 
          WHEN (COALESCE(store_stock.total_qty, 0) + COALESCE(shop_stock.total_qty, 0)) = 0 THEN 0
          ELSE (COALESCE(store_stock.total_qty, 0) + COALESCE(shop_stock.total_qty, 0)) / p.warningQuantity
        END ASC,
        p.warningQuantity DESC
      LIMIT 50
    `;

      return result;
    } catch (error) {
      console.error(
        '❌ _getLowStockAlerts failed:',
        error.message,
        error.stack,
      );
      throw error;
    }
  }

  // Get top items by inventory value
  static async _getTopItemsByValue(tx, limit = 10) {
    try {
      const result = await tx.$queryRaw`
      SELECT 
        p._id as id,
        p.name as productName,
        p.productCode,
        c.name as category,
        b.name as brand,
        COALESCE(store_stock.total_qty, 0) + COALESCE(shop_stock.total_qty, 0) as totalQuantity,
        p.sellPrice as unitPrice,
        (COALESCE(store_stock.total_qty, 0) + COALESCE(shop_stock.total_qty, 0)) * p.sellPrice as totalValue,
        p.hasBox,
        p.boxSize
      FROM products p
      INNER JOIN categories c ON p.categoryId = c._id
      LEFT JOIN brands b ON p.brandId = b._id
      LEFT JOIN (
        SELECT productId, SUM(quantity) as total_qty 
        FROM store_stocks 
        WHERE status = 'Available'
        GROUP BY productId
      ) as store_stock ON p._id = store_stock.productId
      LEFT JOIN (
        SELECT productId, SUM(quantity) as total_qty 
        FROM shop_stocks 
        WHERE status = 'Available'
        GROUP BY productId
      ) as shop_stock ON p._id = shop_stock.productId
      WHERE (COALESCE(store_stock.total_qty, 0) + COALESCE(shop_stock.total_qty, 0)) > 0
      GROUP BY p._id, p.name, p.productCode, c.name, b.name, p.sellPrice, p.hasBox, p.boxSize
      ORDER BY totalValue DESC
      LIMIT ${limit}
    `;

      return result;
    } catch (error) {
      console.error(
        '❌ _getTopItemsByValue failed:',
        error.message,
        error.stack,
      );
      throw error;
    }
  }

  // Get top sold items (from completed deliveries)
  static async _getTopSoldItems(tx, limit = 10) {
    try {
      const result = await tx.$queryRaw`
      SELECT 
        p._id as productId,
        p.name as productName,
        p.productCode,
        c.name as category,
        b.name as brand,
        SUM(si.quantity) as totalQuantitySold,
        SUM(si.totalPrice) as totalRevenue,
        AVG(si.unitPrice) as avgPrice,
        COUNT(DISTINCT si.sellId) as numberOfSales,
        p.hasBox,
        p.boxSize
      FROM sell_items si
      INNER JOIN products p ON si.productId = p._id
      INNER JOIN categories c ON p.categoryId = c._id
      LEFT JOIN brands b ON p.brandId = b._id
      WHERE si.itemSaleStatus = 'DELIVERED'
      GROUP BY p._id, p.name, p.productCode, c.name, b.name, p.hasBox, p.boxSize
      ORDER BY totalQuantitySold DESC
      LIMIT ${limit}
    `;

      return result;
    } catch (error) {
      console.error(
        '❌ _getTopSoldItems failed:',
        error.message,
        error.stack,
      );
      throw error;
    }
  }

  // Get top purchased items (from approved purchases)
  static async _getTopPurchasedItems(tx, limit = 10) {
    try {
      const result = await tx.$queryRaw`
      SELECT 
        p._id as productId,
        p.name as productName,
        p.productCode,
        c.name as category,
        b.name as brand,
        SUM(pi.quantity) as totalQuantityPurchased,
        SUM(pi.totalPrice) as totalCost,
        AVG(pi.unitPrice) as avgCost,
        COUNT(DISTINCT pi.purchaseId) as numberOfPurchases,
        p.hasBox,
        p.boxSize
      FROM purchase_items pi
      INNER JOIN purchases pu ON pi.purchaseId = pu._id
      INNER JOIN products p ON pi.productId = p._id
      INNER JOIN categories c ON p.categoryId = c._id
      LEFT JOIN brands b ON p.brandId = b._id
      WHERE pu.paymentStatus = 'APPROVED'
      GROUP BY p._id, p.name, p.productCode, c.name, b.name, p.hasBox, p.boxSize
      ORDER BY totalQuantityPurchased DESC
      LIMIT ${limit}
    `;

      return result;
    } catch (error) {
      console.error(
        '❌ _getTopPurchasedItems failed:',
        error.message,
        error.stack,
      );
      throw error;
    }
  }

  // Get inventory aging report (oldest stock first)
  static async _getInventoryAgingReport(tx, limit = 50) {
    try {
      const result = await tx.$queryRaw`
      SELECT 
        p._id as id,
        p.name as productName,
        p.productCode,
        p.created_at as productCreatedDate,
        COALESCE(store_stock.total_qty, 0) + COALESCE(shop_stock.total_qty, 0) as quantity,
        DATEDIFF(NOW(), p.created_at) as daysInInventory,
        (COALESCE(store_stock.total_qty, 0) + COALESCE(shop_stock.total_qty, 0)) * p.sellPrice as inventoryValue,
        c.name as categoryName,
        b.name as brandName,
        p.hasBox,
        p.boxSize,
        p.sellPrice as unitPrice
      FROM products p
      INNER JOIN categories c ON p.categoryId = c._id
      LEFT JOIN brands b ON p.brandId = b._id
      LEFT JOIN (
        SELECT productId, SUM(quantity) as total_qty 
        FROM store_stocks 
        WHERE status = 'Available'
        GROUP BY productId
      ) as store_stock ON p._id = store_stock.productId
      LEFT JOIN (
        SELECT productId, SUM(quantity) as total_qty 
        FROM shop_stocks 
        WHERE status = 'Available'
        GROUP BY productId
      ) as shop_stock ON p._id = shop_stock.productId
      WHERE (COALESCE(store_stock.total_qty, 0) + COALESCE(shop_stock.total_qty, 0)) > 0
      GROUP BY p._id, p.name, p.productCode, p.created_at, c.name, b.name, p.sellPrice, p.hasBox, p.boxSize
      ORDER BY daysInInventory DESC
      LIMIT ${limit}
    `;

      return result;
    } catch (error) {
      console.error(
        '❌ _getInventoryAgingReport failed:',
        error.message,
        error.stack,
      );
      throw error;
    }
  }
}

module.exports = InventoryDashboardService;