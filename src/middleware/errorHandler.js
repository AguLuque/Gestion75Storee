// src/middlewares/errorHandler.js
// Middleware centralizado para capturar y formatear todos los errores del sistema

/**
 * Middleware de manejo de errores global.
 * Se registra al final de todos los middlewares en server.js
 * Captura errores lanzados con next(err) o throw desde los controllers
 */
const errorHandler = (err, req, res, next) => {
  // Log del error para debugging en servidor
  console.error(`[ERROR] ${req.method} ${req.originalUrl} →`, err.message || err);

  // Si el error tiene un status custom (lanzado desde services/models), usarlo
  const status = err.status || 500;
  const message = err.message || "Error interno del servidor";

  res.status(status).json({
    success: false,
    error: message,
  });
};

export default errorHandler;