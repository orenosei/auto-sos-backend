export const isUniqueViolation = (error) => {
  return error && typeof error === "object" && error.code === "23505";
};

export const isDbTimeoutError = (error) => {
  return (
    error?.code === "UND_ERR_CONNECT_TIMEOUT" ||
    error?.cause?.code === "UND_ERR_CONNECT_TIMEOUT" ||
    String(error?.message ?? "").includes("fetch failed")
  );
};
