import { localVarRequest } from "../../../tebex-request";

export * from './addPackageRequest';
export * from './address';
export * from './basket';
export * from './basketItem';
export * from './basketLinks';
export * from './basketRow';
export * from './basketRowMeta';
export * from './basketRowMetaLimits';
export * from './basketRowMetaLimitsUser';
export * from './checkoutItem';
export * from './checkoutRequest';
export * from './checkoutRequestBasket';
export * from './createBasketRequest';
export * from './errorResponse';
export * from './package';
export * from './payment';
export * from './paymentCustomer';
export * from './paymentFees';
export * from './paymentFeesGateway';
export * from './paymentFeesTax';
export * from './paymentPaymentMethod';
export * from './paymentPrice';
export * from './paymentProductsInner';
export * from './paymentProductsInnerBasePrice';
export * from './paymentProductsInnerPaidPrice';
export * from './paymentStatus';
export * from './paymentSubject';
export * from './paymentSubjectCustomer';
export * from './paymentSubjectFees';
export * from './paymentSubjectPaymentMethod';
export * from './paymentSubjectPrice';
export * from './paymentSubjectProductsInner';
export * from './priceDetails';
export * from './recurringPayment';
export * from './recurringPaymentAmount';
export * from './recurringPaymentLinks';
export * from './recurringPaymentStatus';
export * from './recurringPaymentSubject';
export * from './recurringPaymentSubjectPrice';
export * from './recurringPaymentSubjectStatus';
export * from './revenueShare';
export * from './sale';
export * from './tebexWebhook';
export * from './updateRecurringPaymentRequest';
export * from './updateSubscriptionRequest';
export * from './updateSubscriptionRequestItemsInner';

import * as fs from 'fs';

export interface RequestDetailedFile {
    value: Buffer;
    options?: {
        filename?: string;
        contentType?: string;
    }
}

export type RequestFile = string | Buffer | fs.ReadStream | RequestDetailedFile;


import { AddPackageRequest } from './addPackageRequest';
import { Address } from './address';
import { Basket } from './basket';
import { BasketItem } from './basketItem';
import { BasketLinks } from './basketLinks';
import { BasketRow } from './basketRow';
import { BasketRowMeta } from './basketRowMeta';
import { BasketRowMetaLimits } from './basketRowMetaLimits';
import { BasketRowMetaLimitsUser } from './basketRowMetaLimitsUser';
import { CheckoutItem } from './checkoutItem';
import { CheckoutRequest } from './checkoutRequest';
import { CheckoutRequestBasket } from './checkoutRequestBasket';
import { CreateBasketRequest } from './createBasketRequest';
import { ErrorResponse } from './errorResponse';
import { Package } from './package';
import { Payment } from './payment';
import { PaymentCustomer } from './paymentCustomer';
import { PaymentFees } from './paymentFees';
import { PaymentFeesGateway } from './paymentFeesGateway';
import { PaymentFeesTax } from './paymentFeesTax';
import { PaymentPaymentMethod } from './paymentPaymentMethod';
import { PaymentPrice } from './paymentPrice';
import { PaymentProductsInner } from './paymentProductsInner';
import { PaymentProductsInnerBasePrice } from './paymentProductsInnerBasePrice';
import { PaymentProductsInnerPaidPrice } from './paymentProductsInnerPaidPrice';
import { PaymentStatus } from './paymentStatus';
import { PaymentSubject } from './paymentSubject';
import { PaymentSubjectCustomer } from './paymentSubjectCustomer';
import { PaymentSubjectFees } from './paymentSubjectFees';
import { PaymentSubjectPaymentMethod } from './paymentSubjectPaymentMethod';
import { PaymentSubjectPrice } from './paymentSubjectPrice';
import { PaymentSubjectProductsInner } from './paymentSubjectProductsInner';
import { PriceDetails } from './priceDetails';
import { RecurringPayment } from './recurringPayment';
import { RecurringPaymentAmount } from './recurringPaymentAmount';
import { RecurringPaymentLinks } from './recurringPaymentLinks';
import { RecurringPaymentStatus } from './recurringPaymentStatus';
import { RecurringPaymentSubject } from './recurringPaymentSubject';
import { RecurringPaymentSubjectPrice } from './recurringPaymentSubjectPrice';
import { RecurringPaymentSubjectStatus } from './recurringPaymentSubjectStatus';
import { RevenueShare } from './revenueShare';
import { Sale } from './sale';
import { TebexWebhook } from './tebexWebhook';
import { UpdateRecurringPaymentRequest } from './updateRecurringPaymentRequest';
import { UpdateSubscriptionRequest } from './updateSubscriptionRequest';
import { UpdateSubscriptionRequestItemsInner } from './updateSubscriptionRequestItemsInner';

/* tslint:disable:no-unused-variable */
let primitives = [
                    "string",
                    "boolean",
                    "double",
                    "integer",
                    "long",
                    "float",
                    "number",
                    "any"
                 ];

let enumsMap: {[index: string]: any} = {
        "AddPackageRequest.TypeEnum": AddPackageRequest.TypeEnum,
        "BasketItem.TypeEnum": BasketItem.TypeEnum,
        "Package.TypeEnum": Package.TypeEnum,
        "Package.ExpiryPeriodEnum": Package.ExpiryPeriodEnum,
        "Sale.DiscountTypeEnum": Sale.DiscountTypeEnum,
        "UpdateRecurringPaymentRequest.StatusEnum": UpdateRecurringPaymentRequest.StatusEnum,
        "UpdateSubscriptionRequestItemsInner.TypeEnum": UpdateSubscriptionRequestItemsInner.TypeEnum,
}

let typeMap: {[index: string]: any} = {
    "AddPackageRequest": AddPackageRequest,
    "Address": Address,
    "Basket": Basket,
    "BasketItem": BasketItem,
    "BasketLinks": BasketLinks,
    "BasketRow": BasketRow,
    "BasketRowMeta": BasketRowMeta,
    "BasketRowMetaLimits": BasketRowMetaLimits,
    "BasketRowMetaLimitsUser": BasketRowMetaLimitsUser,
    "CheckoutItem": CheckoutItem,
    "CheckoutRequest": CheckoutRequest,
    "CheckoutRequestBasket": CheckoutRequestBasket,
    "CreateBasketRequest": CreateBasketRequest,
    "ErrorResponse": ErrorResponse,
    "Package": Package,
    "Payment": Payment,
    "PaymentCustomer": PaymentCustomer,
    "PaymentFees": PaymentFees,
    "PaymentFeesGateway": PaymentFeesGateway,
    "PaymentFeesTax": PaymentFeesTax,
    "PaymentPaymentMethod": PaymentPaymentMethod,
    "PaymentPrice": PaymentPrice,
    "PaymentProductsInner": PaymentProductsInner,
    "PaymentProductsInnerBasePrice": PaymentProductsInnerBasePrice,
    "PaymentProductsInnerPaidPrice": PaymentProductsInnerPaidPrice,
    "PaymentStatus": PaymentStatus,
    "PaymentSubject": PaymentSubject,
    "PaymentSubjectCustomer": PaymentSubjectCustomer,
    "PaymentSubjectFees": PaymentSubjectFees,
    "PaymentSubjectPaymentMethod": PaymentSubjectPaymentMethod,
    "PaymentSubjectPrice": PaymentSubjectPrice,
    "PaymentSubjectProductsInner": PaymentSubjectProductsInner,
    "PriceDetails": PriceDetails,
    "RecurringPayment": RecurringPayment,
    "RecurringPaymentAmount": RecurringPaymentAmount,
    "RecurringPaymentLinks": RecurringPaymentLinks,
    "RecurringPaymentStatus": RecurringPaymentStatus,
    "RecurringPaymentSubject": RecurringPaymentSubject,
    "RecurringPaymentSubjectPrice": RecurringPaymentSubjectPrice,
    "RecurringPaymentSubjectStatus": RecurringPaymentSubjectStatus,
    "RevenueShare": RevenueShare,
    "Sale": Sale,
    "TebexWebhook": TebexWebhook,
    "UpdateRecurringPaymentRequest": UpdateRecurringPaymentRequest,
    "UpdateSubscriptionRequest": UpdateSubscriptionRequest,
    "UpdateSubscriptionRequestItemsInner": UpdateSubscriptionRequestItemsInner,
}

// Check if a string starts with another string without using es6 features
function startsWith(str: string, match: string): boolean {
    return str.substring(0, match.length) === match;
}

// Check if a string ends with another string without using es6 features
function endsWith(str: string, match: string): boolean {
    return str.length >= match.length && str.substring(str.length - match.length) === match;
}

const nullableSuffix = " | null";
const optionalSuffix = " | undefined";
const arrayPrefix = "Array<";
const arraySuffix = ">";
const mapPrefix = "{ [key: string]: ";
const mapSuffix = "; }";

export class ObjectSerializer {
    public static findCorrectType(data: any, expectedType: string) {
        if (data == undefined) {
            return expectedType;
        } else if (primitives.indexOf(expectedType.toLowerCase()) !== -1) {
            return expectedType;
        } else if (expectedType === "Date") {
            return expectedType;
        } else {
            if (enumsMap[expectedType]) {
                return expectedType;
            }

            if (!typeMap[expectedType]) {
                return expectedType; // w/e we don't know the type
            }

            // Check the discriminator
            let discriminatorProperty = typeMap[expectedType].discriminator;
            if (discriminatorProperty == null) {
                return expectedType; // the type does not have a discriminator. use it.
            } else {
                if (data[discriminatorProperty]) {
                    var discriminatorType = data[discriminatorProperty];
                    if(typeMap[discriminatorType]){
                        return discriminatorType; // use the type given in the discriminator
                    } else {
                        return expectedType; // discriminator did not map to a type
                    }
                } else {
                    return expectedType; // discriminator was not present (or an empty string)
                }
            }
        }
    }

    public static serialize(data: any, type: string): any {
        if (data == undefined) {
            return data;
        } else if (primitives.indexOf(type.toLowerCase()) !== -1) {
            return data;
        } else if (endsWith(type, nullableSuffix)) {
            let subType: string = type.slice(0, -nullableSuffix.length); // Type | null => Type
            return ObjectSerializer.serialize(data, subType);
        } else if (endsWith(type, optionalSuffix)) {
            let subType: string = type.slice(0, -optionalSuffix.length); // Type | undefined => Type
            return ObjectSerializer.serialize(data, subType);
        } else if (startsWith(type, arrayPrefix)) {
            let subType: string = type.slice(arrayPrefix.length, -arraySuffix.length); // Array<Type> => Type
            let transformedData: any[] = [];
            for (let index = 0; index < data.length; index++) {
                let datum = data[index];
                transformedData.push(ObjectSerializer.serialize(datum, subType));
            }
            return transformedData;
        } else if (startsWith(type, mapPrefix)) {
            let subType: string = type.slice(mapPrefix.length, -mapSuffix.length); // { [key: string]: Type; } => Type
            let transformedData: { [key: string]: any } = {};
            for (let key in data) {
                transformedData[key] = ObjectSerializer.serialize(
                    data[key],
                    subType,
                );
            }
            return transformedData;
        } else if (type === "Date") {
            return data.toISOString();
        } else {
            if (enumsMap[type]) {
                return data;
            }
            if (!typeMap[type]) { // in case we dont know the type
                return data;
            }

            // Get the actual type of this object
            type = this.findCorrectType(data, type);

            // get the map for the correct type.
            let attributeTypes = typeMap[type].getAttributeTypeMap();
            let instance: {[index: string]: any} = {};
            for (let index = 0; index < attributeTypes.length; index++) {
                let attributeType = attributeTypes[index];
                instance[attributeType.baseName] = ObjectSerializer.serialize(data[attributeType.name], attributeType.type);
            }
            return instance;
        }
    }

    public static deserialize(data: any, type: string): any {
        // polymorphism may change the actual type.
        type = ObjectSerializer.findCorrectType(data, type);
        if (data == undefined) {
            return data;
        } else if (primitives.indexOf(type.toLowerCase()) !== -1) {
            return data;
        } else if (endsWith(type, nullableSuffix)) {
            let subType: string = type.slice(0, -nullableSuffix.length); // Type | null => Type
            return ObjectSerializer.deserialize(data, subType);
        } else if (endsWith(type, optionalSuffix)) {
            let subType: string = type.slice(0, -optionalSuffix.length); // Type | undefined => Type
            return ObjectSerializer.deserialize(data, subType);
        } else if (startsWith(type, arrayPrefix)) {
            let subType: string = type.slice(arrayPrefix.length, -arraySuffix.length); // Array<Type> => Type
            let transformedData: any[] = [];
            for (let index = 0; index < data.length; index++) {
                let datum = data[index];
                transformedData.push(ObjectSerializer.deserialize(datum, subType));
            }
            return transformedData;
        } else if (startsWith(type, mapPrefix)) {
            let subType: string = type.slice(mapPrefix.length, -mapSuffix.length); // { [key: string]: Type; } => Type
            let transformedData: { [key: string]: any } = {};
            for (let key in data) {
                transformedData[key] = ObjectSerializer.deserialize(
                    data[key],
                    subType,
                );
            }
            return transformedData;
        } else if (type === "Date") {
            return new Date(data);
        } else {
            if (enumsMap[type]) {// is Enum
                return data;
            }

            if (!typeMap[type]) { // dont know the type
                return data;
            }
            let instance = new typeMap[type]();
            let attributeTypes = typeMap[type].getAttributeTypeMap();
            for (let index = 0; index < attributeTypes.length; index++) {
                let attributeType = attributeTypes[index];
                instance[attributeType.name] = ObjectSerializer.deserialize(data[attributeType.baseName], attributeType.type);
            }
            return instance;
        }
    }
}

export interface Authentication {
    /**
    * Apply authentication settings to header and query params.
    */
    applyToRequest(requestOptions: any): Promise<void> | void;
}

export class HttpBasicAuth implements Authentication {
    public username: string = '';
    public password: string = '';

    applyToRequest(requestOptions: any): void {
        requestOptions.auth = {
            username: this.username, password: this.password
        }
    }
}

export class HttpBearerAuth implements Authentication {
    public accessToken: string | (() => string) = '';

    applyToRequest(requestOptions: any): void {
        if (requestOptions && requestOptions.headers) {
            const accessToken = typeof this.accessToken === 'function'
                            ? this.accessToken()
                            : this.accessToken;
            requestOptions.headers["Authorization"] = "Bearer " + accessToken;
        }
    }
}

export class ApiKeyAuth implements Authentication {
    public apiKey: string = '';

    constructor(private location: string, private paramName: string) {
    }

    applyToRequest(requestOptions: any): void {
        if (this.location == "query") {
            (<any>requestOptions.qs)[this.paramName] = this.apiKey;
        } else if (this.location == "header" && requestOptions && requestOptions.headers) {
            requestOptions.headers[this.paramName] = this.apiKey;
        } else if (this.location == 'cookie' && requestOptions && requestOptions.headers) {
            if (requestOptions.headers['Cookie']) {
                requestOptions.headers['Cookie'] += '; ' + this.paramName + '=' + encodeURIComponent(this.apiKey);
            }
            else {
                requestOptions.headers['Cookie'] = this.paramName + '=' + encodeURIComponent(this.apiKey);
            }
        }
    }
}

export class OAuth implements Authentication {
    public accessToken: string = '';

    applyToRequest(requestOptions: any): void {
        if (requestOptions && requestOptions.headers) {
            requestOptions.headers["Authorization"] = "Bearer " + this.accessToken;
        }
    }
}

export class VoidAuth implements Authentication {
    public username: string = '';
    public password: string = '';

    applyToRequest(_: any): void {
        // Do nothing
    }
}

export type Interceptor = (requestOptions: any) => (Promise<void> | void);
