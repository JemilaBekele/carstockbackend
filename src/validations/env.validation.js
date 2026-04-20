const joi = require('joi');

const envVarSchema = joi
  .object({
    NODE_ENV: joi
      .string()
      .valid('production', 'development', 'test')
      .default('development'),
    DATABASE_URL: joi.string().uri().required(),
    PORT: joi.number().positive().default(3000),
    JWT_SECRET: joi.string().min(16).required(),
    JWT_ACCESS_EXPIRATION_MINUTES: joi.number().positive().default(15),
    JWT_REFRESH_EXPIRATION_DAYS: joi.number().positive().default(1),
    MAX_ATTEMPTS_PER_DAY: joi.number().integer().positive().default(100),
    MAX_ATTEMPTS_BY_IP_USERNAME: joi.number().integer().positive().default(10),
    MAX_ATTEMPTS_PER_EMAIL: joi.number().integer().positive().default(5),
    CORS_ALLOWED_ORIGINS: joi.string().allow('').default(''),
    TRUST_PROXY: joi
      .alternatives()
      .try(joi.boolean(), joi.string())
      .default(false),
  })
  .unknown();
module.exports = envVarSchema;
