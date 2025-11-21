const logger = require('../utils/logger');

class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }
}

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.stack = err.stack;

  // Log error
  logger.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    statusCode: err.statusCode || 500
  });

  // Tableau REST API errors
  if (err.response && err.response.data) {
    const tableauError = err.response.data;
    return res.status(err.response.status || 500).json({
      success: false,
      error: 'Tableau API Error',
      message: tableauError.error?.summary || tableauError.error?.detail || err.message,
      code: tableauError.error?.code,
      timestamp: new Date().toISOString()
    });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      message: err.message,
      details: err.details || {},
      timestamp: new Date().toISOString()
    });
  }

  // XML parsing errors
  if (err.name === 'XMLParsingError') {
    return res.status(422).json({
      success: false,
      error: 'XML Parsing Error',
      message: err.message,
      timestamp: new Date().toISOString()
    });
  }

  // File system errors
  if (err.code === 'ENOENT') {
    return res.status(404).json({
      success: false,
      error: 'File Not Found',
      message: 'The requested file does not exist',
      timestamp: new Date().toISOString()
    });
  }

  // Default error response
  const statusCode = err.statusCode || 500;
  const message = err.isOperational ? err.message : 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    error: err.name || 'Error',
    message: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    timestamp: new Date().toISOString()
  });
};

module.exports = errorHandler;
module.exports.AppError = AppError;
