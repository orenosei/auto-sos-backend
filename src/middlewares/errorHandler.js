export const errorHandler = (error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  const statusCode = error.statusCode || error.status || 500;
  const message = statusCode === 500 ? "Internal Server Error" : error.message;

  if (statusCode >= 500) {
    console.error("Unhandled request error:", error);
  }

  return res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV !== "production" && {
      details: error.message,
    }),
  });
};
