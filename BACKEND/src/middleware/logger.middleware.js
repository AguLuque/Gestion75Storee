// src/middleware/logger.middleware.js
export const requestLogger = (req, res, next) => {
  const fecha = new Date().toISOString();
  console.log(`[${fecha}] ${req.method} ${req.originalUrl}`);
  next();
};