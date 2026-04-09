import { Webhooks } from "../../src/Webhooks";
import { Webhook } from "../../src/Webhook/webhook";

describe("Webhooks", () => {
    let webhooks: Webhooks;

    beforeEach(() => {
        webhooks = new Webhooks();
    });

    describe("setSecretKey", () => {
        test("should set the webhook secret key", () => {
            const secretKey = "test-secret-key";
            expect(webhooks.isSecretKeySet()).toBe(false);

            webhooks.setSecretKey(secretKey);

            expect(webhooks.isSecretKeySet()).toBe(true);
        });
    });

    describe("isSecretKeySet", () => {
        test("should return false when secret key is not set", () => {
            expect(webhooks.isSecretKeySet()).toBe(false);
        });

        test("should return true when secret key is set", () => {
            const secretKey = "test-secret-key";
            webhooks.setSecretKey(secretKey);

            expect(webhooks.isSecretKeySet()).toBe(true);
        });
    });

    describe("validateWebhookSignature", () => {
        test("should return true when the webhook signature is valid", () => {
            const mockWebhook = {
                validateSignature: jest.fn().mockReturnValue(true),
            } as unknown as Webhook;

            const expectedSignature = "test-signature";
            const secretKey = "test-secret-key";

            webhooks.setSecretKey(secretKey);

            const result = webhooks.validateWebhookSignature(mockWebhook, expectedSignature);

            expect(result).toBe(true);
            expect(mockWebhook.validateSignature).toHaveBeenCalledWith(expectedSignature, secretKey);
        });

        test("should return false when the webhook signature is invalid", () => {
            const mockWebhook = {
                validateSignature: jest.fn().mockReturnValue(false),
            } as unknown as Webhook;

            const expectedSignature = "invalid-signature";
            const secretKey = "test-secret-key";

            webhooks.setSecretKey(secretKey);

            const result = webhooks.validateWebhookSignature(mockWebhook, expectedSignature);

            expect(result).toBe(false);
            expect(mockWebhook.validateSignature).toHaveBeenCalledWith(expectedSignature, secretKey);
        });
    });

    describe("validateWebhookIp", () => {
        test("should return true when the incoming IP is valid", () => {
            const mockIncomingRequestIp = "192.168.1.1";
            const mockWebhook = {
                validateIp: jest.fn().mockReturnValue(true),
            } as unknown as Webhook;

            const result = webhooks.validateWebhookIp(mockWebhook, mockIncomingRequestIp);

            expect(result).toBe(true);
            expect(mockWebhook.validateIp).toHaveBeenCalledWith(mockIncomingRequestIp);
        });

        test("should return false when the incoming IP is invalid", () => {
            const mockIncomingRequestIp = "192.168.1.1";
            const mockWebhook = {
                validateIp: jest.fn().mockReturnValue(false),
            } as unknown as Webhook;

            const result = webhooks.validateWebhookIp(mockWebhook, mockIncomingRequestIp);

            expect(result).toBe(false);
            expect(mockWebhook.validateIp).toHaveBeenCalledWith(mockIncomingRequestIp);
        });
    });
});