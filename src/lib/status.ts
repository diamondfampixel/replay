import type {
  CampaignStatus, DiscountStatus, ExperimentStatus, FulfillmentStatus,
  IntegrationStatus, PaymentStatus, ProductStatus, ReviewStatus, StoreStatus,
} from "@/generated/prisma/client";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "outline" | "solid";

export const PAYMENT_TONE: Record<PaymentStatus, Tone> = {
  PENDING: "warning",
  PAID: "success",
  REFUNDED: "danger",
  PARTIALLY_REFUNDED: "warning",
  FAILED: "danger",
};

export const FULFILLMENT_TONE: Record<FulfillmentStatus, Tone> = {
  UNFULFILLED: "warning",
  PARTIALLY_FULFILLED: "info",
  FULFILLED: "success",
  CANCELLED: "neutral",
};

export const PRODUCT_TONE: Record<ProductStatus, Tone> = {
  DRAFT: "neutral",
  ACTIVE: "success",
  ARCHIVED: "outline",
};

export const DISCOUNT_TONE: Record<DiscountStatus, Tone> = {
  DRAFT: "neutral",
  ACTIVE: "success",
  SCHEDULED: "info",
  EXPIRED: "outline",
  DISABLED: "neutral",
};

export const EXPERIMENT_TONE: Record<ExperimentStatus, Tone> = {
  DRAFT: "neutral",
  RUNNING: "success",
  PAUSED: "warning",
  COMPLETED: "info",
};

export const CAMPAIGN_TONE: Record<CampaignStatus, Tone> = {
  DRAFT: "neutral",
  SCHEDULED: "info",
  SENDING: "warning",
  SENT: "success",
  FAILED: "danger",
};

export const REVIEW_TONE: Record<ReviewStatus, Tone> = {
  PENDING: "warning",
  PUBLISHED: "success",
  HIDDEN: "neutral",
};

export const STORE_TONE: Record<StoreStatus, Tone> = {
  DRAFT: "warning",
  ACTIVE: "success",
  PAUSED: "neutral",
};

export const INTEGRATION_TONE: Record<IntegrationStatus, Tone> = {
  NOT_CONFIGURED: "outline",
  CONNECTED: "success",
  ERROR: "danger",
  DISCONNECTED: "neutral",
};

export function humanize(value: string) {
  return value.replace(/_/g, " ").toLowerCase();
}
