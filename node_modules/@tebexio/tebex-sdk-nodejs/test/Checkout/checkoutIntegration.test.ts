import {Basket} from "../../src/Checkout/lib/model/basket";
import {Package} from "../../src/Checkout/lib/model/package";
import {CreateBasketRequest} from "../../src/Checkout/lib/model/createBasketRequest";
import {Checkout} from "../../src/checkout";
import {CheckoutApi} from "../../src/Checkout/lib/api/checkoutApi";
import {PaymentsApi} from "../../src/Checkout/lib/api/paymentsApi";
import {RecurringPaymentsApi} from "../../src/Checkout/lib/api/recurringPaymentsApi";
import {BasketsApi} from "../../src/Checkout/lib/api/basketsApi";
import {PackageBuilder} from "../../src/Checkout/packageBuilder";
import {BasketBuilder} from "../../src/Checkout/basketBuilder";
import {Tebex} from "../../src/tebex";
import {Sale} from "../../src/Checkout/lib/model/sale";

// Begin the test suite
describe("Checkout", () => {
    let checkout: Checkout;

    beforeEach(() => {
        // Create a new instance of Checkout before each test
        checkout = Tebex.checkout;
    });

    test("should initialize with APIs properly in the constructor", () => {
        expect(checkout.checkoutApi).toBeInstanceOf(CheckoutApi);
        expect(checkout.paymentsApi).toBeInstanceOf(PaymentsApi);
        expect(checkout.recurringPaymentsApi).toBeInstanceOf(RecurringPaymentsApi);
        expect(checkout.basketsApi).toBeInstanceOf(BasketsApi);
        expect(checkout.areApiKeysSet()).toBe(false);
    });

    test("setApiKeys() should set the API keys and initialize APIs", () => {
        const projectId = "test-project-id";
        const privateKey = "test-private-key";

        checkout.setApiKeys(projectId, privateKey);

        expect(checkout.areApiKeysSet()).toBe(true);
        expect(checkout.checkoutApi).toBeInstanceOf(CheckoutApi);
        expect(checkout.paymentsApi).toBeInstanceOf(PaymentsApi);
        expect(checkout.recurringPaymentsApi).toBeInstanceOf(RecurringPaymentsApi);
        expect(checkout.basketsApi).toBeInstanceOf(BasketsApi);
    });

    test("newBasketBuilder() should return a new instance of BasketBuilder", () => {
        const basketBuilder = checkout.newBasketBuilder();
        expect(basketBuilder).toBeInstanceOf(BasketBuilder);
    });

    test("newPackageBuilder() should return a new instance of PackageBuilder", () => {
        const packageBuilder = checkout.newPackageBuilder();
        expect(packageBuilder).toBeInstanceOf(PackageBuilder);
    });

    test("createBasket() should call BasketsApi.createBasket and return the created basket", async () => {
        const mockRequest: CreateBasketRequest = {} as CreateBasketRequest;
        const mockResponse: Basket = { ident: "mock-basket-id" } as Basket;

        // Mock the API call
        checkout.basketsApi.createBasket = jest.fn().mockResolvedValue({
            response: {},
            body: mockResponse,
        });

        const result = await checkout.createBasket(mockRequest);

        expect(checkout.basketsApi.createBasket).toHaveBeenCalledWith(mockRequest);
        expect(result).toEqual(mockResponse);
    });

    test("addPackage() should call BasketsApi.addPackage and return the updated basket", async () => {
        const mockBasket: Basket = { ident: "basket-id" } as Basket;
        const mockPackage: Package = {
            type: Package.TypeEnum.Single,
            qty: 1,
        } as Package;
        const mockResponse: Basket = { ident: "updated-basket-id" } as Basket;

        // Mock the API call
        checkout.basketsApi.addPackage = jest.fn().mockResolvedValue({
            response: {},
            body: mockResponse,
        });

        const result = await checkout.addPackage(mockBasket, mockPackage);

        expect(checkout.basketsApi.addPackage).toHaveBeenCalledWith("basket-id", {
            _package: mockPackage,
            qty: 1,
            type: "single",
        });
        expect(result).toEqual(mockResponse);
    });

    test("getBasket() should call BasketsApi.getBasketById and return the basket", async () => {
        const mockIdent = "basket-id";
        const mockResponse: Basket = { ident: "retrieved-basket-id" } as Basket;

        // Mock the API call
        checkout.basketsApi.getBasketById = jest.fn().mockResolvedValue({
            response: {},
            body: mockResponse,
        });

        const result = await checkout.getBasket(mockIdent);

        expect(checkout.basketsApi.getBasketById).toHaveBeenCalledWith(mockIdent);
        expect(result).toEqual(mockResponse);
    });

    test("checkoutRequest() should call CheckoutApi.checkout and return the resulting basket", async () => {
        const mockBasketBuilder = {
            buildCheckoutRequest: jest.fn().mockReturnValue("checkout-request"),
        } as any as BasketBuilder;
        const mockCheckoutItems = [{ id: "item1" }];
        const mockSale: Sale = { id: "sale-id" } as Sale;
        const mockResponse: Basket = { ident: "checkout-basket-id" } as Basket;

        // Mock the API call
        checkout.checkoutApi.checkout = jest.fn().mockResolvedValue({
            response: {},
            body: mockResponse,
        });

        const result = await checkout.checkoutRequest(mockBasketBuilder, mockCheckoutItems, mockSale);

        expect(checkout.checkoutApi.checkout).toHaveBeenCalledWith({
            basket: "checkout-request",
            items: mockCheckoutItems,
            sale: mockSale,
        });
        expect(result).toEqual(mockResponse);
    });

    test("refundPayment() should call PaymentsApi.refundPaymentById and return the payment", async () => {
        const mockTransactionId = "transaction-id";
        const mockResponse = { id: "refunded-payment-id" };

        // Mock the API call
        checkout.paymentsApi.refundPaymentById = jest.fn().mockResolvedValue({
            response: {},
            body: mockResponse,
        });

        const result = await checkout.refundPayment(mockTransactionId);

        expect(checkout.paymentsApi.refundPaymentById).toHaveBeenCalledWith(mockTransactionId);
        expect(result).toEqual(mockResponse);
    });

    test("pauseRecurringPayment() should call RecurringPaymentsApi.updateRecurringPayment with 'Paused' status", async () => {
        const mockReference = "recurring-id";
        const mockResponse = { id: "paused-recurring-id" };

        // Mock the API call
        checkout.recurringPaymentsApi.updateRecurringPayment = jest.fn().mockResolvedValue({
            response: {},
            body: mockResponse,
        });

        const result = await checkout.pauseRecurringPayment(mockReference);

        expect(checkout.recurringPaymentsApi.updateRecurringPayment).toHaveBeenCalledWith(mockReference, {
            status: "Paused",
        });
        expect(result).toEqual(mockResponse);
    });

    test("reactivateRecurringPayment() should call RecurringPaymentsApi.updateRecurringPayment with 'Active' status", async () => {
        const mockReference = "recurring-id";
        const mockResponse = { id: "active-recurring-id" };

        // Mock the API call
        checkout.recurringPaymentsApi.updateRecurringPayment = jest.fn().mockResolvedValue({
            response: {},
            body: mockResponse,
        });

        const result = await checkout.reactivateRecurringPayment(mockReference);

        expect(checkout.recurringPaymentsApi.updateRecurringPayment).toHaveBeenCalledWith(mockReference, {
            status: "Active",
        });
        expect(result).toEqual(mockResponse);
    });
});