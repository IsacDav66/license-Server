// Constant values for webhook types
import {Webhook} from "./webhook";

export enum WebhookType {
    PAYMENT_COMPLETED = "payment.completed",
    PAYMENT_DECLINED = "payment.declined",
    PAYMENT_REFUNDED = "payment.refunded",
    PAYMENT_DISPUTE_OPENED = "payment.dispute.opened",
    PAYMENT_DISPUTE_WON = "payment.dispute.won",
    PAYMENT_DISPUTE_LOST = "payment.dispute.lost",
    PAYMENT_DISPUTE_CLOSED = "payment.dispute.closed",
    RECURRING_PAYMENT_STARTED = "recurring-payment.started",
    RECURRING_PAYMENT_RENEWED = "recurring-payment.renewed",
    RECURRING_PAYMENT_STATUS_CHANGED = "recurring-payment.status-changed",
    RECURRING_PAYMENT_ENDED = "recurring-payment.ended",
    RECURRING_PAYMENT_CANCELLATION_REQUESTED = "recurring-payment.cancellation.requested",
    RECURRING_PAYMENT_CANCELLATION_ABORTED = "recurring-payment.cancellation.aborted",
    BASKET_ABANDONED = "basket.abandoned",
    VALIDATION_WEBHOOK = "validation.webhook",
}

export function getWebhookType(input: string): WebhookType | undefined {
    return Object.values(WebhookType).find((type) => type === input);
}

// Possible webhook statuses
export enum WebhookStatus {
    COMPLETE = 1,
    REFUND = 2,
    CHARGEBACK = 3,
    DECLINED = 18,
    PENDING_CHECKOUT = 19,
    REFUND_PENDING = 21,
}