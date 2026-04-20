const logger = require('../config/logger');

const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  // Store original res.json and res.send methods
  const originalJson = res.json;
  const originalSend = res.send;

  // Override res.json to capture response data
  res.json = function (data) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    const responseTimestamp = new Date().toISOString();

    return originalJson.call(this, data);
  };

  // Override res.send to capture response data
  res.send = function (data) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    const responseTimestamp = new Date().toISOString();

    return originalSend.call(this, data);
  };

  // Also log response finish event
  res.on('finish', () => {
    const endTime = Date.now();
    const duration = endTime - startTime;

    logger.info(
      `${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`,
    );
  });

  next();
};

module.exports = requestLogger;
