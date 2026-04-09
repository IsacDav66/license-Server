import { Headless } from "../../src/Headless";
import { HeadlessApi } from "../../src/Headless/lib/api/headlessApi";
import { Basket } from "../../src/Headless/lib/model/basket";
import { WebstoreResponse } from "../../src/Headless/lib/model/webstoreResponse";
import { CreateBasketRequest } from "../../src/Headless/lib/model/createBasketRequest";
import { Package } from "../../src/Headless/lib/model/package";
import { Category } from "../../src/Headless/lib/model/category";
import { BasketLinks } from "../../src/Headless/lib/model/basketLinks";
import { Coupon } from "../../src/Headless/lib/model/coupon";
import { TebexProject } from "../../src/Headless/projects/tebexProject";
import {Tebex} from "../../src/tebex";
import http from "http";

// Begin the test suite
describe("Headless", () => {
    let headless: Headless;

    beforeEach(() => {
        headless = Tebex.headless;
    });

    test("should initialize with proper internal objects", () => {
        expect(headless.getHeadlessApi()).toBeInstanceOf(HeadlessApi);
        expect(headless.getWebstore()).toEqual(expect.any(Object));
    });

    test("setProject() should set the project and return TebexProject", async () => {
        const mockPublicToken = "test-public-token";
        const mockWebstoreResponse: WebstoreResponse = {
            data: { schema: {} },
        } as WebstoreResponse;

        // Mock HeadlessApi method
        jest.spyOn(HeadlessApi.prototype, "getWebstoreById").mockResolvedValue({
            response: { statusCode: 200 } as unknown as http.IncomingMessage,
            body: mockWebstoreResponse,
        });

        const result = await headless.setProject(mockPublicToken);

        expect(result).toBeInstanceOf(TebexProject);
        expect(headless.getHeadlessApi().getWebstoreById).toHaveBeenCalledWith(mockPublicToken);
    });

    test("createBasket() should return the created basket", async () => {
        const mockPublicToken = "test-public-token";
        const mockBasketData: CreateBasketRequest = { currency: "USD" } as CreateBasketRequest;
        const mockResponse: Basket = { ident: "basket-id" } as Basket;

        jest
            .spyOn(HeadlessApi.prototype, "createBasket")
            .mockResolvedValue({ response: { statusCode: 200 } as unknown as http.IncomingMessage, body: { data: mockResponse } });

        headless.setProject(mockPublicToken); // Set the publicToken

        const result = await headless.createBasket(mockBasketData);

        expect(result).toEqual(mockResponse);
        expect(headless.getHeadlessApi().createBasket).toHaveBeenCalledWith(mockPublicToken, mockBasketData);
    });

    test("getUserAuthUrl() should return the authentication URL for the basket", async () => {
        const mockBasket: Basket = { ident: "basket-id" } as Basket;
        const mockReturnUrl = "https://example.com/return";
        const mockAuthResponse = [{ url: "https://auth-url.com" }];

        jest
            .spyOn(HeadlessApi.prototype, "getBasketAuthUrl")
            .mockResolvedValue({ response: { statusCode: 200 } as http.IncomingMessage, body: mockAuthResponse });

        const result = await headless.getUserAuthUrl(mockBasket, mockReturnUrl);

        expect(result).toBe("https://auth-url.com");
        expect(headless.getHeadlessApi().getBasketAuthUrl).toHaveBeenCalledWith(
            "test-public-token",
            mockBasket.ident,
            mockReturnUrl
        );
    });

    test("getCheckoutLinks() should return links from a basket", () => {
        const mockBasket: Basket = { links: { checkout: "https://checkout.com" } as BasketLinks } as Basket;

        const result = headless.getCheckoutLinks(mockBasket);

        expect(result).toEqual(mockBasket.links);
    });

    test("getBasketByIdent() should return a basket by its identifier", async () => {
        const mockIdent = "basket-id";
        const mockResponse: Basket = { ident: mockIdent } as Basket;

        jest
            .spyOn(HeadlessApi.prototype, "getBasketById")
            .mockResolvedValue({ response: { statusCode: 200 } as http.IncomingMessage, body: { data: mockResponse } });

        const result = await headless.getBasketByIdent(mockIdent);

        expect(result).toEqual(mockResponse);
        expect(headless.getHeadlessApi().getBasketById).toHaveBeenCalledWith("test-public-token", mockIdent);
    });

    test("getAllCategories() should return all categories", async () => {
        const mockResponse: Category[] = [{ id: 1, name: "Category 1" }] as Category[];

        jest
            .spyOn(HeadlessApi.prototype, "getAllCategories")
            .mockResolvedValue({ response: { statusCode: 200 } as http.IncomingMessage, body: { data: mockResponse } });

        const result = await headless.getAllCategories();

        expect(result).toEqual(mockResponse);
        expect(headless.getHeadlessApi().getAllCategories).toHaveBeenCalledWith("test-public-token");
    });

    test("getAllPackages() should return all packages", async () => {
        const mockResponse: Package[] = [{ id: 1, name: "Package 1" }] as Package[];

        jest
            .spyOn(HeadlessApi.prototype, "getAllPackages")
            .mockResolvedValue({ response: { statusCode: 200 } as http.IncomingMessage, body: { data: mockResponse } });

        const result = await headless.getAllPackages();

        expect(result).toEqual(mockResponse);
        expect(headless.getHeadlessApi().getAllPackages).toHaveBeenCalledWith("test-public-token");
    });

    test("getCategory() should return the category details", async () => {
        const mockCategoryId = 1;
        const mockResponse: Category = { id: mockCategoryId, name: "Test Category" } as Category;

        jest
            .spyOn(HeadlessApi.prototype, "getCategoryById")
            .mockResolvedValue({ response: { statusCode: 200 } as http.IncomingMessage, body: { data: [mockResponse] } });

        const result = await headless.getCategory(mockCategoryId);

        expect(result).toEqual(mockResponse);
        expect(headless.getHeadlessApi().getCategoryById).toHaveBeenCalledWith("test-public-token", mockCategoryId.toString());
    });

    test("getPackage() should return the package details", async () => {
        const mockPackageId = 1;
        const mockResponse: Package = { id: mockPackageId, name: "Test Package" } as Package;

        jest
            .spyOn(HeadlessApi.prototype, "getPackageById")
            .mockResolvedValue({ response: { statusCode: 200 } as http.IncomingMessage, body: { data: [mockResponse] } });

        const result = await headless.getPackage(mockPackageId);

        expect(result).toEqual(mockResponse);
        expect(headless.getHeadlessApi().getPackageById).toHaveBeenCalledWith("test-public-token", mockPackageId);
    });

    test("applyCoupon() should apply a coupon to the basket and return the updated basket", async () => {
        const mockBasketFacade = { getIdent: jest.fn().mockReturnValue("basket-id") } as any;
        const mockCoupon: Coupon = { code: "SAVE10" } as Coupon;
        const mockResponse: Basket = { ident: "basket-id" } as Basket;

        jest
            .spyOn(HeadlessApi.prototype, "applyCoupon")
            .mockResolvedValue({ response: { statusCode: 200 } as http.IncomingMessage, body: { data: mockResponse } });

        const result = await headless.applyCoupon(mockBasketFacade, mockCoupon);

        expect(result).toEqual(mockResponse);
        expect(headless.getHeadlessApi().applyCoupon).toHaveBeenCalledWith("test-public-token", "basket-id", mockCoupon);
    });

    test("addCreatorCode() should add a creator code to the basket", async () => {
        const mockBasketFacade = { getIdent: jest.fn().mockReturnValue("basket-id") } as any;
        const mockCreatorCode = "CREATOR123";
        const mockResponse: Basket = { ident: "basket-id" } as Basket;

        jest
            .spyOn(HeadlessApi.prototype, "applyCreatorCode")
            .mockResolvedValue({ response: { statusCode: 200 } as http.IncomingMessage, body: { data: mockResponse } });

        const result = await headless.addCreatorCode(mockBasketFacade, mockCreatorCode);

        expect(result).toEqual(mockResponse);
        expect(headless.getHeadlessApi().applyCreatorCode).toHaveBeenCalledWith(
            "test-public-token",
            mockBasketFacade.getIdent(),
            { creatorCode: mockCreatorCode }
        );
    });

    test("removeGiftCard() should remove a gift card from the basket", async () => {
        const mockBasketFacade = { getIdent: jest.fn().mockReturnValue("basket-id") } as any;
        const mockCardNumber = "CARD123";
        const mockResponse: Basket = { ident: "basket-id" } as Basket;

        jest
            .spyOn(HeadlessApi.prototype, "removeGiftCard")
            .mockResolvedValue({ response: { statusCode: 200 } as http.IncomingMessage, body: { data: mockResponse } });

        const result = await headless.removeGiftCard(mockBasketFacade, mockCardNumber);

        expect(result).toEqual(mockResponse);
        expect(headless.getHeadlessApi().removeGiftCard).toHaveBeenCalledWith(
            "test-public-token",
            mockBasketFacade.getIdent(),
            { cardNumber: mockCardNumber }
        );
    });
});