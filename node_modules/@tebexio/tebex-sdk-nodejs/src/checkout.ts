import {BasketBuilder} from "./Checkout/basketBuilder";
import {PackageBuilder} from "./Checkout/packageBuilder";
import {CheckoutApi} from "./Checkout/lib/api/checkoutApi";
import {PaymentsApi} from "./Checkout/lib/api/paymentsApi";
import {RecurringPaymentsApi} from "./Checkout/lib/api/recurringPaymentsApi";
import {BasketsApi} from "./Checkout/lib/api/basketsApi";
import {CreateBasketRequest} from "./Checkout/lib/model/createBasketRequest";
import {Basket} from "./Checkout/lib/model/basket";
import {Package} from "./Checkout/lib/model/package";
import {AddPackageRequest} from "./Checkout/lib/model/addPackageRequest";
import {Sale} from "./Checkout/lib/model/sale";
import {Payment} from "./Checkout/lib/model/payment";
import {RecurringPayment} from "./Checkout/lib/model/recurringPayment";
import {UpdateSubscriptionRequestItemsInner} from "./Checkout/lib/model/updateSubscriptionRequestItemsInner";
import {UpdateRecurringPaymentRequest} from "./Checkout/lib/model/updateRecurringPaymentRequest";

/**
 * TebexCheckout allows creating and transacting with ad-hoc packages that are not pre-defined in a Tebex project.
 * 
 * NOTE: This API requires prior approval. Please contact Tebex to enable on your account.
 * 
 * This provides an interface to the underlying OpenAPI implementation. If your desired functionality is not here, you may
 * retrieve the OpenAPI objects for manual API interaction.
 */
export class Checkout {
    //Underlying OpenAPI objects
    private _checkoutApi: CheckoutApi;
    private _paymentsApi: PaymentsApi;
    private _recurringPaymentsApi: RecurringPaymentsApi;
    private _basketsApi: BasketsApi;

    private _areApiKeysSet: boolean = false;

    public get checkoutApi(): CheckoutApi {
        return this._checkoutApi;
    }

    public get paymentsApi(): PaymentsApi {
        return this._paymentsApi;
    }

    public get recurringPaymentsApi(): RecurringPaymentsApi {
        return this._recurringPaymentsApi;
    }

    public get basketsApi(): BasketsApi {
        return this._basketsApi;
    }

    public constructor() {
        this._checkoutApi = new CheckoutApi("", "");
        this._paymentsApi = new PaymentsApi("", "");
        this._recurringPaymentsApi = new RecurringPaymentsApi("", "");
        this._basketsApi = new BasketsApi("", "");
    }

    areApiKeysSet(): boolean {
        return this._areApiKeysSet;
    }

    /**
     * Sets the API keys for the Checkout instance and initializes the required API services.
     *
     * @param {string} projectId - The unique identifier for the project.
     * @param {string} privateKey - The private key associated with the project for authentication.
     * @return {Checkout} The current instance of the Checkout object.
     */
    setApiKeys(projectId: string, privateKey: string) : Checkout {
        this._checkoutApi = new CheckoutApi(projectId, privateKey);
        this._paymentsApi = new PaymentsApi(projectId, privateKey);
        this._recurringPaymentsApi = new RecurringPaymentsApi(projectId, privateKey);
        this._basketsApi = new BasketsApi(projectId, privateKey);
        this._areApiKeysSet = true;
        return this;
    }

    /**
     * Creates and returns a new instance of BasketBuilder.
     *
     * @return {BasketBuilder} A new instance of BasketBuilder to construct and customize a basket.
     */
    newBasketBuilder() : BasketBuilder {
        return new BasketBuilder();
    }

    /**
     * Creates and returns a new instance of the PackageBuilder.
     *
     * @return {PackageBuilder} A new instance of PackageBuilder.
     */
    newPackageBuilder() : PackageBuilder {
        return new PackageBuilder();
    }

    /**
     * Creates a new basket using the provided create request. Use the BasketBuilder to make a CreateBasketRequest.
     *
     * @param {CreateBasketRequest} createRequest - The request object containing details required to create a basket.
     * @return {Promise<Basket>} A promise that resolves to the created basket object.
     */
    public async createBasket(createRequest: CreateBasketRequest) : Promise<Basket> {
        const {response, body} = await this._basketsApi.createBasket(createRequest);
        return body;
    }

    /**
     * Adds a package to the specified basket.
     *
     * @param {Basket} basket - The basket to which the package will be added.
     * @param {Package} pack - The package to add, including its type and quantity.
     * @return {Promise<Basket>} A promise that resolves to the updated basket.
     */
    public async addPackage(basket: Basket, pack: Package) : Promise<Basket> {
        const {response, body} = await this._basketsApi.addPackage(basket.ident!, {
            _package: pack,
            qty: pack.qty,
            type: pack.type == Package.TypeEnum.Single ? AddPackageRequest.TypeEnum.Single : AddPackageRequest.TypeEnum.Subscription
        })
        return body;
    }

    /**
     * Processes a checkout request.
     *
     * @param {BasketBuilder} basketBuilder - The builder used to construct the checkout request payload.
     * @param {any[]} checkoutItems - The items to be included in the checkout request.
     * @param {Sale|undefined} sale - Optional sale details to include in the checkout request. Defaults to undefined.
     * @return {Promise<Basket>} A promise that resolves to the resulting Basket object returned by the API.
     */
    public async checkoutRequest(basketBuilder: BasketBuilder, checkoutItems: any[], sale: Sale|undefined=undefined): Promise<Basket> {
        const {response, body} = await this._checkoutApi.checkout({
            basket: basketBuilder.buildCheckoutRequest(),
            items: checkoutItems,
            sale: sale
        })
        return body;
    }

    /**
     * Retrieves a basket by its identifier.
     *
     * @param {string} ident - The unique identifier of the basket to retrieve.
     * @return {Promise<Basket>} A promise that resolves to the retrieved basket object.
     */
    public async getBasket(ident: string): Promise<Basket> {
        const {response, body} = await this._basketsApi.getBasketById(ident);
        return body;
    }

    /**
     * Removes a specific row from the provided basket.
     *
     * @param {Basket} basket - The basket object from which the row needs to be removed.
     * @param {number} rowId - The unique identifier of the row to remove.
     * @return {Promise<any>} A promise resolving to the response body of the removal operation.
     */
    public async removeBasketRow(basket: Basket, rowId: number) : Promise<any> {
        const {response, body} = await this._basketsApi.removeRowFromBasket(basket.ident!, rowId);
        return body;
    }

    /**
     * Adds a sale to the given basket with the specified details.
     *
     * @param {Basket} basket - The basket to which the sale will be added.
     * @param {string} saleName - The name of the sale.
     * @param {Sale.DiscountTypeEnum} saleType - The type of discount being applied.
     * @param {number} saleAmount - The amount or value of the discount.
     * @return {Promise<Basket>} A promise that resolves to the updated basket with the applied sale.
     */
    public async addSaleToBasket(basket: Basket, saleName: string, saleType: Sale.DiscountTypeEnum, saleAmount: number) : Promise<Basket> {
        const {response, body} = await this._basketsApi.addSaleToBasket(basket.ident!, {
            name: saleName,
            discountType: saleType,
            amount: saleAmount,
        })
        return body;
    }

    /**
     * Retrieves payment details using the specified identifier.
     *
     * @param {string} identifier - The unique identifier of the payment to retrieve.
     * @return {Promise<Payment>} A promise that resolves to the payment details.
     */
    public async getPayment(identifier: string) : Promise<Payment> {
        const {response, body} = await this._paymentsApi.getPaymentById(identifier);
        return body;
    }

    /**
     * Processes a refund for a given payment transaction.
     *
     * @param {string} transactionId - The unique identifier of the transaction to be refunded.
     * @return {Promise<Payment>} A promise that resolves to the refunded payment details.
     */
    public async refundPayment(transactionId: string) : Promise<Payment> {
        const {response, body} = await this._paymentsApi.refundPaymentById(transactionId);
        return body;
    }

    /**
     * Retrieves a recurring payment using the specified transaction ID.
     *
     * @param {string} transactionId - The unique identifier for the transaction
     *                                  associated with the recurring payment.
     * @return {Promise<RecurringPayment>} A promise that resolves to the details
     *                                      of the recurring payment.
     */
    public async getRecurringPayment(transactionId: string) : Promise<RecurringPayment> {
        const { response, body } = await this._recurringPaymentsApi.getRecurringPayment(transactionId)
        return body;
    }

    /**
     * Updates the subscription product associated with the given recurring payment reference.
     *
     * @param {string} recurringPaymentReference - The unique reference identifier for the recurring payment.
     * @param {Package[]} packages - An array of packages to be updated in the subscription. Each package includes details about the product, quantity, and type.
     * @return {Promise<RecurringPayment>} A promise resolving to the updated recurring payment object.
     */
    public async updateSubscriptionProduct(recurringPaymentReference: string, packages: Package[]) : Promise<RecurringPayment> {
        let items : UpdateSubscriptionRequestItemsInner[] = [];
        packages.forEach(p => {
            items.push({
                type: p.type == Package.TypeEnum.Single ? UpdateSubscriptionRequestItemsInner.TypeEnum.Single : UpdateSubscriptionRequestItemsInner.TypeEnum.Subscription,
                qty: p.qty,
                _package: p,
            });
        })

        const {response, body} = await this._recurringPaymentsApi.updateSubscription(recurringPaymentReference, {
            items: items
        })

        return body;
    }

    /**
     * Cancels a recurring payment using the provided recurring payment reference.
     *
     * @param {string} recurringPaymentReference - The unique identifier for the recurring payment to be canceled.
     * @return {Promise<RecurringPayment>} A promise that resolves to the details of the canceled recurring payment.
     */
    public async cancelRecurringPayment(recurringPaymentReference: string) : Promise<RecurringPayment> {
        const { response, body } = await this._recurringPaymentsApi.cancelRecurringPayment(recurringPaymentReference);
        return body;
    }

    /**
     * Pauses a recurring payment by updating the payment's status to "Paused".
     *
     * @param {string} recurringPaymentReference - The unique reference identifier for the recurring payment to be paused.
     * @return {Promise<RecurringPayment>} A promise that resolves to the updated RecurringPayment object.
     */
    public async pauseRecurringPayment(recurringPaymentReference: string) : Promise<RecurringPayment> {
        const { response, body} = await this._recurringPaymentsApi.updateRecurringPayment(recurringPaymentReference, {
            status: UpdateRecurringPaymentRequest.StatusEnum.Paused
        });
        return body;
    }

    /**
     * Reactivates a recurring payment that is currently inactive.
     *
     * @param {string} recurringPaymentReference - The unique reference identifier for the recurring payment to be reactivated.
     * @return {Promise<RecurringPayment>} A promise that resolves with the reactivated recurring payment details.
     */
    public async reactivateRecurringPayment(recurringPaymentReference: string) : Promise<RecurringPayment> {
        const { response, body } = await this._recurringPaymentsApi.updateRecurringPayment(recurringPaymentReference, {
            status: UpdateRecurringPaymentRequest.StatusEnum.Active
        });
        return body;
    }
}