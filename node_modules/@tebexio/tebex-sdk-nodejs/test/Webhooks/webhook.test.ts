import { Webhook } from "../../src/Webhook/webhook";
import { WebhookType, WebhookStatus } from "../../src/Webhook/types";
import { PaymentSubject } from "../../src/Checkout/lib/model/paymentSubject";
import { RecurringPaymentSubject } from "../../src/Checkout/lib/model/recurringPaymentSubject";

describe("Webhook", () => {
    describe("constructor", () => {
        test("should initialize a valid Webhook instance with correct properties", () => {
            const rawJson = JSON.stringify({
                id: "123",
                type: WebhookType.PAYMENT_COMPLETED,
                date: "2023-10-10",
                subject: {
                    data: "Some data",
                },
            });

            const webhook = new Webhook(rawJson);

            expect(webhook.getId()).toBe("123");
            expect(webhook.getType()).toBe(WebhookType.PAYMENT_COMPLETED);
            expect(webhook.getDate()).toBe("2023-10-10");
            expect(webhook.getSubject()).toEqual({ data: "Some data" });
            expect(webhook.getRawJson()).toBe(rawJson);
        });

        test("should throw an error for invalid JSON", () => {
            const invalidJson = '{"id":123,"type:"INVALID';

            expect(() => new Webhook(invalidJson)).toThrow(
                "Expected ':' after property name in JSON at position 17 (line 1 column 18)"
            );
        });

        test("should throw an error when subject is malformed", () => {
            const rawJson = JSON.stringify({
                id: "123",
                type: WebhookType.PAYMENT_COMPLETED,
                date: "2023-10-10",
                subject: undefined,
            });

            expect(() => new Webhook(rawJson)).toThrow(
                "Invalid or malformed webhook subject"
            );
        });

        test("should handle empty array subjects correctly", () => {
            const rawJson = JSON.stringify({
                id: "123",
                type: WebhookType.PAYMENT_COMPLETED,
                date: "2023-10-10",
                subject: [],
            });

            const webhook = new Webhook(rawJson);

            expect(webhook.getSubject()).toEqual([]);
        });
    });

    describe("getId", () => {
        test("should return the webhook ID", () => {
            const rawJson = JSON.stringify({
                id: "1234",
                type: WebhookType.PAYMENT_DISPUTE_OPENED,
                date: "2023-10-11",
                subject: {},
            });

            const webhook = new Webhook(rawJson);

            expect(webhook.getId()).toBe("1234");
        });
    });

    describe("getDate", () => {
        test("should return the date sent in the webhook", () => {
            const rawJson = JSON.stringify({
                id: "5678",
                type: WebhookType.RECURRING_PAYMENT_STARTED,
                date: "2023-09-30",
                subject: {},
            });

            const webhook = new Webhook(rawJson);

            expect(webhook.getDate()).toBe("2023-09-30");
        });
    });

    describe("getSubject", () => {
        test("should return the subject of the webhook", () => {
            const rawJson = JSON.stringify({
                id: "91011",
                type: WebhookType.PAYMENT_COMPLETED,
                date: "2023-08-15",
                subject: { details: "Payment details" },
            });

            const webhook = new Webhook(rawJson);

            expect(webhook.getSubject()).toEqual({ details: "Payment details" });
        });
    });

    describe("getType", () => {
        test("should return the type of the webhook", () => {
            const rawJson = JSON.stringify({
                id: "121314",
                type: WebhookType.PAYMENT_COMPLETED,
                date: "2023-07-20",
                subject: {},
            });

            const webhook = new Webhook(rawJson);

            expect(webhook.getType()).toBe(WebhookType.PAYMENT_COMPLETED);
        });
    });

    describe("isTypeOfPayment", () => {
        test("should return true for payment type webhook", () => {
            const rawJson = JSON.stringify({
                id: "151617",
                type: WebhookType.PAYMENT_COMPLETED,
                date: "2023-06-10",
                subject: {},
            });

            const webhook = new Webhook(rawJson);

            expect(webhook.isTypeOfPayment()).toBe(true);
        });

        test("should return false for recurring payment type webhook", () => {
            const rawJson = JSON.stringify({
                id: "181920",
                type: WebhookType.RECURRING_PAYMENT_STARTED,
                date: "2023-05-15",
                subject: {},
            });

            const webhook = new Webhook(rawJson);

            expect(webhook.isTypeOfPayment()).toBe(false);
        });
    });

    describe("isTypeOfDispute", () => {
        test("should return true for dispute type webhook", () => {
            const rawJson = JSON.stringify({
                id: "212223",
                type: WebhookType.PAYMENT_DISPUTE_OPENED,
                date: "2023-04-10",
                subject: {},
            });

            const webhook = new Webhook(rawJson);

            expect(webhook.isTypeOfDispute()).toBe(true);
        });

        test("should return false for non-dispute type webhook", () => {
            const rawJson = JSON.stringify({
                id: "242526",
                type: WebhookType.PAYMENT_COMPLETED,
                date: "2023-03-05",
                subject: {},
            });

            const webhook = new Webhook(rawJson);

            expect(webhook.isTypeOfDispute()).toBe(false);
        });
    });

    describe("isTypeOfRecurringPayment", () => {
        test("should return true for recurring payment type webhook", () => {
            const rawJson = JSON.stringify({
                id: "272829",
                type: WebhookType.RECURRING_PAYMENT_STARTED,
                date: "2023-02-20",
                subject: {},
            });

            const webhook = new Webhook(rawJson);

            expect(webhook.isTypeOfRecurringPayment()).toBe(true);
        });

        test("should return false for non-recurring payment type webhook", () => {
            const rawJson = JSON.stringify({
                id: "303132",
                type: WebhookType.PAYMENT_DISPUTE_OPENED,
                date: "2023-01-18",
                subject: {},
            });

            const webhook = new Webhook(rawJson);

            expect(webhook.isTypeOfRecurringPayment()).toBe(false);
        });
    });

    describe("isStatusComplete", () => {
        test("should return true when the status is 'Complete'", () => {
            const rawJson = JSON.stringify({
                id: "123",
                type: WebhookType.PAYMENT_COMPLETED,
                date: "2023-10-10",
                subject: {
                    status: { id: WebhookStatus.COMPLETE },
                },
            });

            const webhook = new Webhook(rawJson);

            expect(webhook.isStatusComplete()).toBe(true);
        });

        test("should return false when the status is not 'Complete'", () => {
            const rawJson = JSON.stringify({
                id: "123",
                type: WebhookType.PAYMENT_COMPLETED,
                date: "2023-10-10",
                subject: {
                    status: { id: "Pending" },
                },
            });

            const webhook = new Webhook(rawJson);

            expect(webhook.isStatusComplete()).toBe(false);
        });

        test("should return false when status is missing", () => {
            const rawJson = JSON.stringify({
                id: "123",
                type: WebhookType.PAYMENT_COMPLETED,
                date: "2023-10-10",
                subject: {},
            });

            const webhook = new Webhook(rawJson);

            expect(webhook.isStatusComplete()).toBe(false);
        });
    });

    describe("validateIp", () => {
        test("should return true for valid IPs", () => {
            const rawJson = JSON.stringify({
                id: "123",
                type: WebhookType.PAYMENT_COMPLETED,
                date: "2023-10-10",
                subject: {},
            });

            const webhook = new Webhook(rawJson);

            expect(webhook.validateIp("18.209.80.3")).toBe(true);
            expect(webhook.validateIp("54.87.231.232")).toBe(true);
        });

        test("should return false for invalid IPs", () => {
            const rawJson = JSON.stringify({
                id: "123",
                type: WebhookType.PAYMENT_COMPLETED,
                date: "2023-10-10",
                subject: {},
            });

            const webhook = new Webhook(rawJson);

            expect(webhook.validateIp("192.168.1.1")).toBe(false);
        });
    });

    describe("validateSignature", () => {
        test("should return true for valid signatures", () => {
            const rawJson = JSON.stringify({
                id: "123",
                type: WebhookType.PAYMENT_COMPLETED,
                date: "2023-10-10",
                subject: {},
            });

            const webhook = new Webhook(rawJson);

            const webhookSecret = "secretKey";
            const expectedSignature = require("crypto")
                .createHmac("sha256", webhookSecret)
                .update(require("crypto").createHash("sha256").update(rawJson).digest("hex"))
                .digest("hex");

            expect(webhook.validateSignature(expectedSignature, webhookSecret)).toBe(true);
        });

        test("should return false for invalid signatures", () => {
            const rawJson = JSON.stringify({
                id: "123",
                type: WebhookType.PAYMENT_COMPLETED,
                date: "2023-10-10",
                subject: {},
            });

            const webhook = new Webhook(rawJson);

            const webhookSecret = "secretKey";
            const invalidSignature = "invalidSignature";

            expect(webhook.validateSignature(invalidSignature, webhookSecret)).toBe(false);
        });
    });
});