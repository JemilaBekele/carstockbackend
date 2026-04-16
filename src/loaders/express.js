const express = require('express');
const httpStatus = require('http-status');
const passport = require('passport');
const { xss } = require('express-xss-sanitizer');
const helmet = require('helmet');
const fileUpload = require('express-fileupload');

const mongoSanitize = require('express-mongo-sanitize');
const cors = require('cors');
const path = require('path');
const authRouter = require('../routes/auth.route');
const companyRouter = require('../routes/company.route');
const documentRouter = require('../routes/document.route');
const rolesRouter = require('../routes/role.route');
const permissionRouter = require('../routes/permission.route');
const rolePermissionRouter = require('../routes/rolePermission.route');

const MissingStockLedger = require('../routes/MissingStockLedger.route');
const CategoryRouter = require('../routes/Category.route');
const branchRouter = require('../routes/Branch.route');
const customerRouter = require('../routes/Customer.route');
const shopRouter = require('../routes/Shop.route');
const storeRouter = require('../routes/Store.route');
const ResetRouter = require('../routes/yearend.route');
const BrandRouter = require('../routes/Brand.route');
const CartRoutes = require('../routes/Cart.route');
const GeneralDashboardRouter = require('../routes/GeneralDashboard.route');
const purchaseRouter = require('../routes/purchase.route');
const UnitOfMeasureRouter = require('../routes/UnitOfMeasure.route');
const ProductRouter = require('../routes/Product.route');
const productBatchRouter = require('../routes/ProductBatch.route');
const transferRourer = require('../routes/transfer.route');
const stockcorrectionRouter = require('../routes/StockCorrection.route');
const sellRouter = require('../routes/Sell.route');
const SellStockCorrRouter = require('../routes/SellStockCorrect.route');
const ReportRouter = require('../routes/Report.route');
const InventoryDashboardRouter = require('../routes/inventorydashboard.route');
const { errorHandler, errorConverter } = require('../middlewares/error');
const ApiError = require('../utils/ApiError');
const morgan = require('../config/morgan');
const { jwtStrategy } = require('../config/passport');
const {
  cspOptions,
  env,
  cors: corsConfig,
  trustProxy,
} = require('../config/config');

module.exports = async (app) => {
  app.set('trust proxy', trustProxy);
  app.use(morgan.successHandler);
  app.use(morgan.errorHandler);
  // jwt authentication
  app.use(passport.initialize());
  passport.use('jwt', jwtStrategy);
  app.use(express.json());
  app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));
  app.use(
    '/api/document',
    fileUpload({
      useTempFiles: true,
      tempFileDir: './tmp/',
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
        files: 2,
        parts: 20,
      },
      abortOnLimit: true,
      responseOnLimit: 'File size exceeds the 10MB limit or too many files',
      debug: process.env.NODE_ENV === 'development',
      preserveExtension: true,
      safeFileNames: true,
      parseNested: true,
    }),
    documentRouter,
  );
  // security
  app.use(xss());
  app.use(
    helmet({
      contentSecurityPolicy: cspOptions,
    }),
  );
  app.use(mongoSanitize());
  if (env === 'production') {
    app.use(
      cors({
        origin: ['https://stock.ordere.net', 'http://localhost:3020'],
        credentials: true,
      }),
    );
    app.options(
      '*',
      cors({
        origin: ['https://stock.ordere.net/', 'http://localhost:3020'],
        credentials: true,
      }),
    );
  } else {
    // enabling all cors
    app.use(cors());
    app.options('*', cors());
  }
  app.use(ResetRouter);
  app.use(authRouter);
  app.use(rolesRouter);
  app.use(permissionRouter);
  app.use(rolePermissionRouter);
  app.use(companyRouter);
  app.use(GeneralDashboardRouter);
  app.use(BrandRouter);
  app.use(documentRouter);
  app.use(CategoryRouter);
  app.use(branchRouter);
  app.use(customerRouter);
  app.use(shopRouter);
  app.use(storeRouter);
  app.use(productBatchRouter);
  app.use(CartRoutes);
  app.use(MissingStockLedger);
  app.use(UnitOfMeasureRouter);
  app.use(ProductRouter);
  app.use(purchaseRouter);
  app.use(transferRourer);
  app.use(stockcorrectionRouter);
  app.use(sellRouter);
  app.use(SellStockCorrRouter);
  app.use(ReportRouter);
  app.use(InventoryDashboardRouter);
  // Error handling middleware
  // Then your 404 handler
  // 404 handler - MODIFY THIS
  app.use((req, res, next) => {
    const error = new ApiError(
      httpStatus.NOT_FOUND,
      `Not found - ${req.method} ${req.originalUrl}`,
    );
    next(error);
  });
  app.use(errorConverter);
  app.use(errorHandler);
  return app;
};
