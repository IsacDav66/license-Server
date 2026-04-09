

import {BasketFacade} from "./Headless/basketFacade";
import {HeadlessApi} from "./Headless/lib/api/headlessApi";
import {Webstore} from "./Headless/lib/model/webstore";
import {CreateBasketRequest} from "./Headless/lib/model/createBasketRequest";
import {Basket} from "./Headless/lib/model/basket";
import {BasketLinks} from "./Headless/lib/model/basketLinks";
import {Coupon} from "./Headless/lib/model/coupon";
import http from "http";
import {TebexProject} from "./Headless/projects/tebexProject";
import {WebstoreResponse} from "./Headless/lib/model/webstoreResponse";
import {IncomingMessage} from "node:http";
import {BasketAuthResponseInner} from "./Headless/lib/model/basketAuthResponseInner";
import {Package} from "./Headless/lib/model/package";
import {Category} from "./Headless/lib/model/category";

/**
 * TebexHeadless allows you to access and create baskets for your Tebex project using pre-defined packages.
 */
export class Headless {
    // OpenAPI headless service
    private _headlessApi: HeadlessApi;

    // The underlying webstore project
    private _webstore: Webstore;

    private _publicToken: string = "";

    constructor() {
        this._headlessApi = new HeadlessApi();
        this._webstore = new Webstore();
    }

    public getHeadlessApi() : HeadlessApi {
        return this._headlessApi;
    }

    /**
     * Sets the current project using the provided public token and retrieves relevant project data.
     *
     * @param {string} publicToken - The public token used to identify and authenticate the project.
     * @return {Promise<TebexProject>} A promise that resolves to an instance of the TebexProject.
     */
    async setProject(publicToken: string) : Promise<TebexProject> {
        this._publicToken = publicToken;
        this._headlessApi = new HeadlessApi("https://headless.tebex.io/api");
        return this._headlessApi.getWebstoreById(this._publicToken).then(({ body }: { response: IncomingMessage; body: WebstoreResponse }):TebexProject => {
            this._webstore = body.data?.schema!;
            return new TebexProject(this._webstore);
        })
    }

    /**
     * Creates a new basket using the provided basket data.
     *
     * @param {CreateBasketRequest} basketData - The data required to create a new basket.
     * @return {Promise<Basket>} A promise that resolves to the created basket.
     */
    async createBasket(basketData: CreateBasketRequest) : Promise<Basket> {
        const {body} = await this._headlessApi.createBasket(this._publicToken, basketData);
        return body.data!;
    }

    /**
     * Retrieves the authentication URL for the specified basket.
     *
     * @param {Basket} basket - The basket object containing the necessary identification information.
     * @param {string} returnUrl - The URL to which the user is redirected after authentication.
     * @return {Promise<string>} A promise resolving to the authentication URL as a string, or an empty string if the URL cannot be retrieved.
     */
    async getUserAuthUrl(basket: Basket, returnUrl: string) : Promise<string> {
        return this._headlessApi.getBasketAuthUrl(this._publicToken, basket.ident!, returnUrl).then(({ body }: { response: IncomingMessage; body: BasketAuthResponseInner[] }):string => {
            if (body.length == 0) {
                return "";
            }
            return body[0].url!;
        });
    }

    /**
     * Retrieves the checkout-related links from the provided basket object.
     *
     * @param {Basket} basket - The basket object containing checkout-related links.
     * @return {BasketLinks} The collection of checkout-related links associated with the basket.
     */
    getCheckoutLinks(basket: Basket) : BasketLinks {
        return basket.links!;
    }

    /**
     * Retrieves a basket by its identifier.
     *
     * @param {string} ident - The unique identifier for the basket.
     * @return {Promise<Basket>} A promise that resolves to the basket data associated with the given identifier.
     */
    async getBasketByIdent(ident: string) : Promise<Basket> {
        const { body } = await this._headlessApi.getBasketById(this._publicToken, ident);
        return body.data!;
    }

    /**
     * Retrieves all categories available from the API.
     *
     * @return {Promise<Category[]>} A promise that resolves to an array of Category objects.
     */
    async getAllCategories() : Promise<Category[]> {
        const { body } = await this._headlessApi.getAllCategories(this._publicToken);
        return body.data!;
    }

    /**
     * Retrieves all packages available via the headless API.
     *
     * @return {Promise<Package[]>} A promise that resolves to an array of Package objects.
     */
    async getAllPackages() : Promise<Package[]> {
        const { body } = await this._headlessApi.getAllPackages(this._publicToken);
        return body.data!;
    }

    /**
     * Retrieves the category information for the specified category ID.
     *
     * @param {number} categoryId - The unique identifier of the category to retrieve.
     * @return {Promise<Category>} A Promise that resolves to the category data.
     */
    async getCategory(categoryId: number) : Promise<Category> {
        const { body } = await this._headlessApi.getCategoryById(this._publicToken, categoryId.toString());
        return body.data![0];
    }

    /**
     * Retrieves the package details based on the provided package ID.
     *
     * @param {number} packageId - The unique identifier of the package to retrieve.
     * @return {Promise<Package>} A promise that resolves to the package details.
     */
    async getPackage(packageId: number) : Promise<Package> {
        const { body } = await this._headlessApi.getPackageById(this._publicToken, packageId);
        return body.data![0];
    }

    /**
     * Applies a coupon to the given basket using the provided basket facade.
     *
     * @param {BasketFacade} basketFacade - The facade representing the basket to which the coupon will be applied.
     * @param {Coupon} coupon - The coupon to be applied to the basket.
     * @return {Promise<Basket>} A promise resolving to the updated basket after the coupon is applied.
     */
    async applyCoupon(basketFacade: BasketFacade, coupon: Coupon) : Promise<Basket> {
        const { body } = await this._headlessApi.applyCoupon(this._publicToken, basketFacade.getIdent(), coupon);
        return body.data!;
    }

    /**
     * Removes a coupon from the basket.
     *
     * @param {BasketFacade} basketFacade - The basket facade instance that provides the identifier of the basket from which the coupon should be removed.
     * @return {Promise<{ response: http.IncomingMessage; body?: any }>} A promise that resolves with the HTTP response and optionally the response body.
     */
    async removeCoupon(basketFacade: BasketFacade) : Promise<{ response: http.IncomingMessage; body?: any }> {
        return this._headlessApi.removeCoupon(this._publicToken, basketFacade.getIdent());
    }

    /**
     * Adds a creator code to the specified basket.
     *
     * @param {BasketFacade} basketFacade - The facade object representing the basket.
     * @param {string} code - The creator code to be added to the basket.
     * @return {Promise<Basket>} A promise that resolves to the updated basket.
     */
    async addCreatorCode(basketFacade: BasketFacade, code: string): Promise<Basket> {
        const {body} = await this._headlessApi.applyCreatorCode(this._publicToken, basketFacade.getIdent(), {
            creatorCode: code
        });
        return body.data!;
    }

    /**
     * Removes the creator code associated with the provided BasketFacade instance.
     *
     * @param {BasketFacade} basketFacade - The instance of BasketFacade whose creator code is to be removed.
     * @return {Promise<Basket>} A promise that resolves with the updated Basket after the creator code has been removed.
     */
    async removeCreatorCode(basketFacade: BasketFacade): Promise<Basket> {
        const {body} = await this._headlessApi.removeCreatorCode(this._publicToken, basketFacade.getIdent());
        return body.data!;
    }

    /**
     * Adds a gift card to the provided basket.
     *
     * @param {BasketFacade} basketFacade - The basket facade instance representing the current basket.
     * @param {string} cardNumber - The gift card number to be applied to the basket.
     * @return {Promise<Basket>} A promise that resolves to the updated basket after the gift card has been applied.
     */
    async addGiftCard(basketFacade: BasketFacade, cardNumber: string): Promise<Basket> {
        const {body} = await this._headlessApi.applyGiftCard(this._publicToken, basketFacade.getIdent(), {
            cardNumber: cardNumber
        });
        return body.data!;
    }

    /**
     * Removes a gift card from the specified basket.
     *
     * @param basketFacade - The basketFacade object that provides access to the basket's identity and details.
     * @param cardNumber - The unique number of the gift card to be removed.
     * @return A promise that resolves to the updated basket object.
     */
    async removeGiftCard(basketFacade: BasketFacade, cardNumber: string): Promise<Basket> {
        const {body} = await this._headlessApi.removeGiftCard(this._publicToken, basketFacade.getIdent(), {
            cardNumber: cardNumber
        });
        return body.data!;
    }

    /**
     * Retrieves the webstore instance.
     *
     * @return {Object} The webstore object associated with this instance.
     */
    getWebstore(): object {
        return this._webstore;
    }
}