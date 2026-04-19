const logger = require('../config/logger');

const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  // Log request details
  console.log('====================================');
  console.log('====================================');
  console.log('====================================');
  console.log(`[${timestamp}] 📤 REQUEST:`);
  console.log(`  Method: ${req.method}`);
  console.log(`  Endpoint: ${req.originalUrl}`);
  console.log(`  Headers:`, JSON.stringify(req.headers, null, 2));
  console.log(`  Body:`, JSON.stringify(req.body, null, 2));
  console.log(`  Query Params:`, JSON.stringify(req.query, null, 2));
  console.log(`  Params:`, JSON.stringify(req.params, null, 2));
  console.log('---');

  // Store original res.json and res.send methods
  const originalJson = res.json;
  const originalSend = res.send;

  // Override res.json to capture response data
  res.json = function (data) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    const responseTimestamp = new Date().toISOString();

    console.log(`[${responseTimestamp}] 📥 RESPONSE:`);
    console.log(`  Status: ${res.statusCode}`);
    console.log(`  Duration: ${duration}ms`);
    console.log(`  Data:`, JSON.stringify(data, null, 2));
    console.log('---');

    return originalJson.call(this, data);
  };

  // Override res.send to capture response data
  res.send = function (data) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    const responseTimestamp = new Date().toISOString();

    console.log(`[${responseTimestamp}] 📥 RESPONSE:`);
    console.log(`  Status: ${res.statusCode}`);
    console.log(`  Duration: ${duration}ms`);
    console.log(
      `  Data:`,
      typeof data === 'object' ? JSON.stringify(data, null, 2) : data,
    );
    console.log('---');

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
