import {Webhook} from "./Webhook/webhook";

/**
 * The Webhooks class is responsible for managing and validating Tebex webhook operations.
 */
export class Webhooks {
    private _webhookSecret: string = "";

    public constructor() {
    }

    /**
     * Sets the secret key used for webhook authentication. Get this from your Tebex panel under Webhooks.
     *
     * @param {string} secretKey - The secret key to set.
     * @return {void} This method does not return a value.
     */
    public setSecretKey(secretKey: string) {
        this._webhookSecret = secretKey;
    }

    /**
     * Checks whether the secret key has been set by verifying if the webhook secret is non-empty.
     *
     * @return {boolean} True if the secret key is set, otherwise false.
     */
    public isSecretKeySet() : boolean {
        return this._webhookSecret !== "";
    }

    /**
     * Validates the signature of a webhook payload to ensure its authenticity.
     *
     * @param {Webhook} webhook - The webhook object containing the payload and signature.
     * @param {string} expectedSignature - The expected signature to validate against.
     * @return {boolean} Returns true if the webhook signature matches the expected signature; otherwise, false.
     */
    public validateWebhookSignature(webhook: Webhook, expectedSignature: string) : boolean {
        return webhook.validateSignature(expectedSignature, this._webhookSecret);
    }

    /**
     * Validates whether the incoming request's IP matches the allowed IPs for the provided webhook.
     *
     * @param {Webhook} webhook - The webhook instance containing the allowed IPs and validation logic.
     * @param {string} incomingRequestIp - The IP address of the incoming request to validate.
     * @return {boolean} Returns true if the incoming IP address is valid for the webhook, false otherwise.
     */
    public validateWebhookIp(webhook: Webhook, incomingRequestIp: string) : boolean {
        return webhook.validateIp(incomingRequestIp);
    }
}