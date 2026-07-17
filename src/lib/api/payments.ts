import { GREENROOM_API_BASE } from "@/config/greenroomApi";
import { greenroomFetch } from "@/lib/api/client";

export type PaymentStatus =
  | "pending"
  | "issued"
  | "paid"
  | "overdue"
  | "cancelled"
  | string;

export interface Payment {
  id: number;
  artist_id: number;
  artist_name: string;
  booking_id: number | null;
  project_id: number | null;
  amount: string;
  currency: string;
  status: PaymentStatus;
  invoice_number: string | null;
  issue_date: string | null;
  due_date: string | null;
  paid_date: string | null;
  notes: string | null;
}

export interface CreatePaymentPayload {
  artist_id: number;
  amount: string | number;
  status: PaymentStatus;
  booking_id?: number | null;
  project_id?: number | null;
  currency?: string;
  invoice_number?: string;
  issue_date?: string;
  due_date?: string;
  paid_date?: string;
  notes?: string;
  updated_by_user_id?: number;
}

export interface UpdatePaymentPayload {
  artist_id?: number;
  booking_id?: number | null;
  project_id?: number | null;
  amount?: string | number;
  currency?: string;
  status?: PaymentStatus;
  invoice_number?: string;
  issue_date?: string;
  due_date?: string;
  paid_date?: string;
  notes?: string;
  updated_by_user_id?: number;
}

export interface GetPaymentsParams {
  artist_id?: number;
  project_id?: number;
}

interface PaymentsListResponse {
  payments: Payment[];
}

async function parseError(response: Response, fallback: string): Promise<string> {
  const error = await response
    .json()
    .catch(() => ({ error: response.statusText }));
  return error.error || fallback;
}

export async function getPayments(
  params?: GetPaymentsParams
): Promise<Payment[]> {
  const query = new URLSearchParams();
  if (params?.artist_id !== undefined) {
    query.set("artist_id", String(params.artist_id));
  }
  if (params?.project_id !== undefined) {
    query.set("project_id", String(params.project_id));
  }
  const queryString = query.toString();
  const url = queryString
    ? `${GREENROOM_API_BASE}/payments/?${queryString}`
    : `${GREENROOM_API_BASE}/payments/`;
  const response = await greenroomFetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch payments: ${response.statusText}`);
  }
  const data: PaymentsListResponse = await response.json();
  return data.payments;
}

export async function getPaymentById(id: number): Promise<Payment> {
  const response = await greenroomFetch(`${GREENROOM_API_BASE}/payments/${id}/`);
  if (!response.ok) {
    throw new Error(`Failed to fetch payment ${id}: ${response.statusText}`);
  }
  return await response.json();
}

export async function createPayment(
  payload: CreatePaymentPayload
): Promise<{ id: number; message: string }> {
  const response = await greenroomFetch(`${GREENROOM_API_BASE}/payments/create/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to create payment"));
  }
  return await response.json();
}

export async function updatePayment(
  id: number,
  payload: UpdatePaymentPayload
): Promise<{ message: string; payment_id: number }> {
  const response = await greenroomFetch(
    `${GREENROOM_API_BASE}/payments/${id}/update/`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to update payment"));
  }
  return await response.json();
}
