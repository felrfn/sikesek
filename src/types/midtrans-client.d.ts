declare module "midtrans-client" {
  interface SnapConfig {
    isProduction: boolean;
    serverKey: string;
    clientKey?: string;
  }

  interface SnapTransactionParams {
    transaction_details: {
      order_id: string;
      gross_amount: number;
    };
    customer_details?: {
      first_name?: string;
      email?: string;
      phone?: string;
    };
    item_details?: Array<{
      id: string;
      price: number;
      quantity: number;
      name: string;
    }>;
    callbacks?: {
      finish?: string;
    };
  }

  interface SnapTransactionResult {
    token: string;
    redirect_url: string;
  }

  /** Response shape of the Get Status API (`GET /v2/{order_id}/status`). */
  interface TransactionStatusResult {
    status_code: string;
    status_message: string;
    transaction_id: string;
    order_id: string;
    gross_amount: string;
    payment_type: string;
    transaction_time: string;
    transaction_status: string;
    fraud_status?: string;
    settlement_time?: string;
  }

  class TransactionApi {
    status(orderId: string): Promise<TransactionStatusResult>;
  }

  export class Snap {
    constructor(config: SnapConfig);
    transaction: TransactionApi;
    createTransaction(
      params: SnapTransactionParams,
    ): Promise<SnapTransactionResult>;
  }
}
