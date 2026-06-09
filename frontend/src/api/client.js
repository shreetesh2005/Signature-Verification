import axios from 'axios';

// CRA's proxy setting in package.json forwards /api/* to http://127.0.0.1:8000
// We hit the FastAPI routes directly (no /api prefix needed since proxy is root-level)
const client = axios.create({
  baseURL: '/',
  timeout: 30000,
});

/** GET /customers — list all enrolled customers */
export async function getCustomers() {
  const { data } = await client.get('/customers');
  return data; // { customers: [...], total: N }
}

/** GET /customers/:id — get specimen list for a customer */
export async function getCustomer(customerId) {
  const { data } = await client.get(`/customers/${customerId}`);
  return data; // { customer_id, specimen_count, specimens: [...] }
}

/**
 * POST /verify — verify a signature against a customer's stored specimens
 * @param {string} customerId
 * @param {File}   signatureFile
 * @param {number} [threshold]
 * @param {number} [reviewBand]
 */
export async function verifySignature(customerId, signatureFile, threshold, reviewBand) {
  const form = new FormData();
  form.append('customer_id', customerId);
  form.append('signature', signatureFile);
  if (threshold  !== undefined) form.append('threshold',   String(threshold));
  if (reviewBand !== undefined) form.append('review_band', String(reviewBand));

  const { data } = await client.post('/verify', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
  /*
  Returns:
  {
    customer_id, decision, average_score, max_score, min_score,
    threshold, review_band_lower,
    case1_individual, case2_average,
    per_specimen_scores: { filename: score, ... }
  }
  */
}

/** GET / — health check */
export async function healthCheck() {
  const { data } = await client.get('/');
  return data; // { status: "ok", message: "..." }
}
