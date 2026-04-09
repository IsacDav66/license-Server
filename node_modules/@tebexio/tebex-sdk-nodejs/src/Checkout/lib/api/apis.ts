export * from './basketsApi';
import { BasketsApi } from './basketsApi';
export * from './checkoutApi';
import { CheckoutApi } from './checkoutApi';
export * from './paymentsApi';
import { PaymentsApi } from './paymentsApi';
export * from './recurringPaymentsApi';
import { RecurringPaymentsApi } from './recurringPaymentsApi';
import * as http from 'http';

export class HttpError extends Error {
    constructor (public response: http.IncomingMessage, public body: any, public statusCode?: number) {
        super('HTTP request failed');
        this.name = 'HttpError';
    }
}

export { RequestFile } from '../model/models';

export const APIS = [BasketsApi, CheckoutApi, PaymentsApi, RecurringPaymentsApi];
