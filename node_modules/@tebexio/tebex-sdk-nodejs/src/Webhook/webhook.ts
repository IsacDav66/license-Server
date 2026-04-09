import {PaymentSubject} from "../Checkout/lib/model/paymentSubject";
import {RecurringPaymentSubject} from "../Checkout/lib/model/recurringPaymentSubject";
import {Tebex} from "../tebex";
import { getWebhookType, WebhookStatus, WebhookType} from "./types";

/**
 * Base class inherited by all webhooks. Create a webhook instance using `Webhook.fromJson()` with the received JSON data from Tebex.
 */
export class Webhook {
    /**
     * The JSON data provided at initialization.
     */
    protected _rawJson: string;

    /**
     * The decoded and re-encoded JSON data without unnecessary formatting.
     */
    protected _encodedJson: string;

    /**
     * The webhook's unique ID.
     */
    private _id: string;

    /**
     * The webhook's type.
     */
    private _type: WebhookType;

    /**
     * The date the webhook was sent (as a string).
     */
    private _date: string;

    /**
     * Data about the webhook's action, which is a complex object.
     */
    private _subject?: PaymentSubject | RecurringPaymentSubject | undefined;

    public constructor(rawJson: string) {
        this._rawJson = rawJson;

        const decodedJson = JSON.parse(rawJson);
        if (!decodedJson) {
            throw new Error(`Invalid or malformed webhook JSON: ${rawJson}`);
        }

        this._encodedJson = JSON.stringify(decodedJson);
        this._id = decodedJson["id"];
        this._type = decodedJson["type"];
        this._date = decodedJson["date"];

        const encodedSubject = JSON.stringify(decodedJson["subject"]);
        if (!encodedSubject) {
            throw new Error(`Invalid or malformed webhook subject: ${JSON.stringify(decodedJson["subject"])}`);
        }

        const decodedSubjectObject = JSON.parse(encodedSubject);

        // Handle empty subject objects which can be parsed as arrays
        if (Array.isArray(decodedSubjectObject) && decodedSubjectObject.length === 0) {
            this._subject = {};
        } else {
            this._subject = decodedSubjectObject;
        }

        if (this.isTypeOfPayment() || this.isTypeOfDispute()) {
            this._subject = decodedJson["subject"] as PaymentSubject;
        } else if (this.isTypeOfRecurringPayment()) {
            this._subject = decodedJson["subject"] as RecurringPaymentSubject;
        } else if (this.isType(WebhookType.VALIDATION_WEBHOOK)) {
            this._subject = {};
        }
    }

    /**
     * Parses and validates the webhook JSON payload.
     *
     * @param webhookJsonStr - The JSON-formatted webhook string payload. If null, reads from process standard input.
     * @param headers - The incoming headers from a webhook request.
     * @returns An instance of the correct Webhook class.
     * @throws ValueError When JSON is invalid, malformed, or missing required data.
     * @throws ApiException For invalid IP or signature validation errors.
     */
    public static parse(webhookJsonStr: string, headers: Record<string, string>): Webhook {
        const json = webhookJsonStr;

        const signature = headers["HTTP_X_SIGNATURE"];
        if (!signature) {
            throw new Error("X_SIGNATURE header is missing from the request");
        }

        const decodedJson = JSON.parse(json);
        if (!decodedJson) {
            throw new Error(`Invalid or malformed webhook JSON: ${json}`);
        }

        const webhookType = decodedJson["type"] ?? null;
        if (!webhookType) {
            throw new Error(`Webhook type is missing from the payload: ${json}`);
        }

        if (!decodedJson.hasOwnProperty("subject")) {
            throw new Error(`Webhook is missing subject from the payload: ${json}`);
        }

        const webhookSubject = decodedJson["subject"];
        if (webhookSubject === null) {
            throw new Error(`Webhook subject is null in payload: ${json}`);
        }

        const typeObj: WebhookType|undefined = getWebhookType(webhookType);
        if (!typeObj) {
            throw new Error(`Unrecognized webhook type: ${webhookType}`);
        }

        const webhook = new Webhook(json);
        const webhookIp = headers["HTTP_X_FORWARDED_FOR"] ?? headers["REMOTE_ADDR"];
        if (!Tebex.webhooks.validateWebhookIp(webhook, webhookIp)) {
            throw new Error(
                "Invalid webhook origin IP. Ensure client IPs are forwarded appropriately if using a proxy.",
            );
        }

        if (!Tebex.webhooks.validateWebhookSignature(webhook, signature)) {
            throw new Error("Invalid webhook signature");
        }

        return webhook;
    }

    /**
     * Retrieves the id of the webhook.
     *
     * @return {string} The unique identifier.
     */
    public getId(): string {
        return this._id;
    }

    /**
     * Retrieves the current date value.
     *
     * @return {string} The date represented as a string.
     */
    public getDate(): string {
        return this._date;
    }

    /**
     * Retrieves the subject associated with the webhook. The subject contains data about the webhook operation.
     *
     * @return {object} The subject object.
     */
    public getSubject(): object|undefined {
        return this._subject;
    }

    /**
     * Retrieves the type of the current webhook.
     *
     * @return {string} The type as a string.
     */
    public getType(): string {
        return this._type;
    }

    /**
     * Retrieves the raw JSON string associated with this instance.
     *
     * @return {string} The raw JSON as a string.
     */
    public getRawJson(): string {
        return this._rawJson;
    }

    /**
     * Helper function to determine if the webhook is a type of single payment.
     *
     * @return {boolean} Returns true if the webhook type is regarding a single (one time) payment.
     */
    public isTypeOfPayment(): boolean {
        return this._type.includes("payment") && !this._type.includes("recurring");
    }

    /**
     * Helper function to determine if the webhook is a type of dispute.
     *
     * @return {boolean} Returns true if the webhook is a dispute.
     */
    public isTypeOfDispute(): boolean {
        return this._type.includes("dispute");
    }

    /**
     * Determines if the current type indicates a recurring payment.
     *
     * @return {boolean} True if the webhook is regarding a recurring payment.
     */
    public isTypeOfRecurringPayment(): boolean {
        return this._type.includes("recurring-payment");
    }

    /**
     * Determines if the current instance's type matches the specified type.
     *
     * @param {WebhookType} type - The type to compare against the instance's type.
     * @return {boolean} True if the instance's type matches the specified type; otherwise, false.
     */
    public isType(type: WebhookType): boolean {
        return this._type === type;
    }

    /**
     * Validates whether the provided IP address matches a predefined set of allowed IP addresses.
     *
     * @param {string} incomingRequestIp - The IP address of the incoming request to validate.
     * @return {boolean} Returns true if the IP address is allowed, otherwise false.
     */
    public validateIp(incomingRequestIp : string): boolean {
        return incomingRequestIp === "18.209.80.3" || incomingRequestIp === "54.87.231.232";
    }

    /**
     * Validates whether the provided signature matches the calculated HMAC signature.
     *
     * @param {string} expectedSignature - The signature expected from the request for authentication. This is provided in the headers of each webhook.
     * @param {string} webhookSecret - The secret key used in the HMAC calculation for verification. This should be configured from your Tebex panel.
     * @return {boolean} Returns true if the calculated signature matches the expected signature, otherwise false.
     */
    public validateSignature(expectedSignature: string, webhookSecret: string): boolean {
        const calculatedSignature = require("crypto")
            .createHmac("sha256", webhookSecret)
            .update(require("crypto").createHash("sha256").update(this._encodedJson).digest("hex"))
            .digest("hex");

        return calculatedSignature === expectedSignature;
    }

    /**
     * Checks if the status of the subject is marked as "Complete" based on the status ID.
     *
     * @return {boolean} Returns true if the status is "Complete", otherwise false.
     */
    public isStatusComplete(): boolean {
        const statusId = this._subject!.status?.id;
        if (!statusId) {
            return false;
        }
        return statusId === WebhookStatus.COMPLETE;
    }
}