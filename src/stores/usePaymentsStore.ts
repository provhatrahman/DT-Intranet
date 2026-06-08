import { create } from "zustand";
import {
  Payment,
  UpdatePaymentPayload,
  CreatePaymentPayload,
  getPayments as apiGetPayments,
  updatePayment as apiUpdatePayment,
  createPayment as apiCreatePayment,
} from "@/lib/api/payments";

interface PaymentsState {
  // Payments cached per project id.
  paymentsByProject: Record<number, Payment[]>;
  isLoading: boolean;
  error: string | null;

  fetchPaymentsForProject: (projectId: number) => Promise<Payment[]>;
  updatePayment: (
    paymentId: number,
    projectId: number,
    payload: UpdatePaymentPayload
  ) => Promise<void>;
  createPayment: (
    projectId: number,
    payload: CreatePaymentPayload
  ) => Promise<void>;
  clearError: () => void;
}

export const usePaymentsStore = create<PaymentsState>((set, get) => ({
  paymentsByProject: {},
  isLoading: false,
  error: null,

  fetchPaymentsForProject: async (projectId: number) => {
    set({ isLoading: true, error: null });
    try {
      const payments = await apiGetPayments({ project_id: projectId });
      set((state) => ({
        paymentsByProject: {
          ...state.paymentsByProject,
          [projectId]: payments,
        },
        isLoading: false,
      }));
      return payments;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch payments";
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  updatePayment: async (
    paymentId: number,
    projectId: number,
    payload: UpdatePaymentPayload
  ) => {
    try {
      await apiUpdatePayment(paymentId, payload);
      await get().fetchPaymentsForProject(projectId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update payment";
      set({ error: message });
      throw error;
    }
  },

  createPayment: async (
    projectId: number,
    payload: CreatePaymentPayload
  ) => {
    try {
      await apiCreatePayment(payload);
      await get().fetchPaymentsForProject(projectId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create payment";
      set({ error: message });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
