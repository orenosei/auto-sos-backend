import { sql } from "../config/db.js";

export const findPaymentRequest = async (requestId) => {
  const rows = await sql.query(
    `
      SELECT request_id, user_id, company_id, request_status, final_price,
             payment_method, payment_status, paid_at
      FROM requests
      WHERE request_id = $1
      LIMIT 1
    `,
    [requestId]
  );
  return rows[0] ?? null;
};

export const insertPaymentTransaction = async ({
  requestId,
  provider,
  transactionRef,
  amount,
}) => {
  const rows = await sql.query(
    `
      INSERT INTO payment_transactions (
        request_id, provider, transaction_ref, amount
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
    [requestId, provider, transactionRef, amount]
  );
  return rows[0];
};

export const findPaymentTransactionByRef = async (transactionRef) => {
  const rows = await sql.query(
    "SELECT * FROM payment_transactions WHERE transaction_ref = $1 LIMIT 1",
    [transactionRef]
  );
  return rows[0] ?? null;
};

export const findLatestPaymentByRequest = async (requestId) => {
  const rows = await sql.query(
    `
      SELECT *
      FROM payment_transactions
      WHERE request_id = $1
      ORDER BY created_at DESC, transaction_id DESC
      LIMIT 1
    `,
    [requestId]
  );
  return rows[0] ?? null;
};

export const setRequestPaymentState = async ({
  requestId,
  method,
  status,
  paidAt,
}) => {
  const rows = await sql.query(
    `
      UPDATE requests
      SET payment_method = $1, payment_status = $2, paid_at = $3
      WHERE request_id = $4
      RETURNING request_id, payment_method, payment_status, paid_at
    `,
    [method, status, paidAt ?? null, requestId]
  );
  return rows[0] ?? null;
};

export const updatePaymentTransaction = async ({
  transactionRef,
  status,
  providerTransactionNo,
  responseCode,
  bankCode,
  payload,
}) => {
  const rows = await sql.query(
    `
      UPDATE payment_transactions
      SET status = $1,
          provider_transaction_no = COALESCE($2, provider_transaction_no),
          response_code = COALESCE($3, response_code),
          bank_code = COALESCE($4, bank_code),
          provider_payload = COALESCE($5::jsonb, provider_payload),
          updated_at = CURRENT_TIMESTAMP
      WHERE transaction_ref = $6
      RETURNING *
    `,
    [
      status,
      providerTransactionNo ?? null,
      responseCode ?? null,
      bankCode ?? null,
      payload ? JSON.stringify(payload) : null,
      transactionRef,
    ]
  );
  return rows[0] ?? null;
};
