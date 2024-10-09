// src/middlewares/errorHandling.js

export const notFoundHandler = (req, res) => {
    console.log('Not Found Handler Called');
    res.status(404).json({ status: 'error', statusCode: 404, message: 'Not Found' });
  };
  
  export const errorHandler = (err, req, res, next) => {
      const statusCode = err.status || 500;
      res.status(statusCode).json({
        status: 'error',
        statusCode,
        message: err.message || 'Internal Server Error',
      });
    };
    