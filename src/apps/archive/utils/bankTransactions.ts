// Dummy bank transaction data for payment verification
export interface BankTransaction {
  id: string;
  amount: number;
  currency: string;
  description: string;
  date: string;
  type: "incoming" | "outgoing";
  status: "pending" | "completed" | "failed";
  reference?: string;
}

// Simulate checking for incoming payment (project payment)
export async function checkIncomingPayment(
  projectId: string,
  expectedAmount: string
): Promise<BankTransaction | null> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 500));
  
  // Return dummy transaction data
  // In a real implementation, this would call the bank API
  const amount = parseFloat(expectedAmount.replace(/[^0-9.]/g, ""));
  if (isNaN(amount)) return null;
  
  // Randomly return a transaction or null (simulating payment received or not)
  if (Math.random() > 0.5) {
    return {
      id: `txn-${projectId}-${Date.now()}`,
      amount,
      currency: "GBP",
      description: `Payment for project: ${projectId}`,
      date: new Date().toISOString(),
      type: "incoming",
      status: "completed",
      reference: `PROJ-${projectId}`,
    };
  }
  
  return null;
}

// Simulate checking for outgoing payment (lineup/artist payment)
export async function checkOutgoingPayment(
  artistId: string,
  expectedAmount: string
): Promise<BankTransaction | null> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 500));
  
  // Return dummy transaction data
  const amount = parseFloat(expectedAmount.replace(/[^0-9.]/g, ""));
  if (isNaN(amount)) return null;
  
  // Randomly return a transaction or null
  if (Math.random() > 0.5) {
    return {
      id: `txn-out-${artistId}-${Date.now()}`,
      amount,
      currency: "GBP",
      description: `Payment to artist: ${artistId}`,
      date: new Date().toISOString(),
      type: "outgoing",
      status: "completed",
      reference: `ARTIST-${artistId}`,
    };
  }
  
  return null;
}
