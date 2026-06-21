import crypto from "node:crypto";
import qs from "qs";

const sortObject = (params) => {
  const sorted = {};
  Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== "")
    .map(encodeURIComponent)
    .sort()
    .forEach((key) => {
      sorted[key] = encodeURIComponent(String(params[key])).replace(/%20/g, "+");
    });
  return sorted;
};

const sortedQuery = (params) =>
  qs.stringify(sortObject(params), { encode: false });

export const formatVnPayDate = (date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}${value.month}${value.day}${value.hour}${value.minute}${value.second}`;
};

export const signVnPayParams = (params, secret) =>
  crypto.createHmac("sha512", secret).update(sortedQuery(params), "utf8").digest("hex");

export const buildVnPayPaymentUrl = ({ baseUrl, secret, params }) => {
  const query = sortedQuery(params);
  const secureHash = crypto.createHmac("sha512", secret).update(query, "utf8").digest("hex");
  return `${baseUrl}?${query}&vnp_SecureHash=${secureHash}`;
};

export const verifyVnPaySignature = (query, secret) => {
  const params = Object.fromEntries(
    Object.entries(query).filter(
      ([key]) => key.startsWith("vnp_") && !["vnp_SecureHash", "vnp_SecureHashType"].includes(key)
    )
  );
  const expected = signVnPayParams(params, secret);
  const received = String(query.vnp_SecureHash ?? "").toLowerCase();
  if (!received || received.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
};
