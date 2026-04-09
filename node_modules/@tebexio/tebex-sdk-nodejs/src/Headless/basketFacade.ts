import {Basket} from "./lib/model/basket";
import {BasketLinks} from "./lib/model/basketLinks";
import {Package} from "./lib/model/package";
import {TebexProject} from "./projects/tebexProject";
import {Tebex} from "../tebex";

/**
 * Provides functionality for accessing and managing baskets via the Headless API. If your desired functionality is not
 * present, you can access the full basket object via getBasket().
 */
export class BasketFacade {
    // The underlying OpenAPI basket
    private readonly _basket: Basket;
    private readonly _project: TebexProject;

    constructor(basket: Basket, project: TebexProject) {
        this._basket = basket;
        this._project = project;
    }

    /**
     * Retrieves the OpenAPI basket instance associated with the current object.
     *
     * @return {Basket} The current basket object.
     */
    public getBasket(): Basket {
        return this._basket;
    }

    /**
     * Retrieves the unique identifier associated with the basket.
     *
     * @return {string} The identifier string of the basket.
     */
    public getIdent(): string {
        return this._basket.ident!;
    }

    /**
     * Retrieves the basket links.
     *
     * @return {BasketLinks} The links associated with the basket.
     */
    public getLinks(): BasketLinks {
        return this._basket.links!;
    }

    /**
     * Retrieves the base price of the basket.
     *
     * @return {number} The base price of the basket.
     */
    public getBasePrice(): number {
        return this._basket.basePrice!;
    }

    /**
     * Checks if the user is authenticated against the current basket.
     *
     * @return {boolean} Returns true if the user meets authentication criteria, otherwise false.
     */
    public isAuthed(): boolean {
        return this._project.getRequiredBasketParams().length > 0 && this._basket.username !== null;
    }

    /**
     * Adds a package to the basket with optional variable data and quantity.
     *
     * @param {Package} packageItem - The package item to be added to the basket.
     * @param {Record<string, string> | null} [variableData=null] - Optional variable data associated with the package.
     * @param {number} [qty=1] - The quantity of the package to be added.
     * @return {Promise<BasketFacade>} A promise resolving to the updated basket facade instance.
     */
    public addPackage(packageItem: Package, variableData: Record<string, string> | null = null, qty: number = 1): Promise<BasketFacade> {
        const addBasketPackageRequest = {
            _package: packageItem,
            quantity: qty,
            variable_data: variableData,
        };

        return this._addPackage(addBasketPackageRequest);
    }

    /**
     * Adds a gift card package to the basket.
     *
     * @param {Package} packageItem - The package item representing the gift card package to be added.
     * @param {string} giftcardToEmail - The email address to which the gift card will be sent.
     * @param {number} [qty=1] - The quantity of the gift card package to add (default is 1).
     * @return {Promise<BasketFacade>} A promise that resolves with an updated basket facade after the gift card package is added.
     */
    public addGiftCardPackage(packageItem: Package, giftcardToEmail: string, qty: number = 1): Promise<BasketFacade> {
        const addBasketPackageRequest = {
            _package: packageItem,
            quantity: qty,
            variable_data: {
                giftcard_to: giftcardToEmail,
            },
        };
        return this._addPackage(addBasketPackageRequest);
    }

    /**
     * Adds a package to the basket with Discord deliverable information.
     *
     * @param {Package} packageItem - The package object to be added to the basket.
     * @param {string} discordId - The Discord ID associated with the deliverable.
     * @param {number} [qty=1] - The quantity of the package being added, default is 1.
     * @return {Promise<BasketFacade>} A promise that resolves to the updated basket facade after the package is added.
     */
    public addPackageWithDiscordDeliverable(packageItem: Package, discordId: string, qty: number = 1): Promise<BasketFacade> {
        const addBasketPackageRequest = {
            _package: packageItem,
            quantity: qty,
            variable_data: {
                discord_id: discordId,
            },
        };
        return this._addPackage(addBasketPackageRequest);
    }

    /**
     * Adds a package to the basket to be executed on a specific game server.
     *
     * @param {Package} packageItem - The package information to be added to the basket.
     * @param {string} usernameId - The unique identifier for the username associated with the game server command.
     * @param {number} [qty=1] - The quantity of the package to be added to the basket. Defaults to 1 if not provided.
     * @return {Promise<BasketFacade>} A promise that resolves with the updated basket facade after the package is added.
     */
    public addPackageWithGameServerCommand(packageItem: Package, usernameId: string, qty: number = 1): Promise<BasketFacade> {
        const addBasketPackageRequest = {
            _package: packageItem,
            quantity: qty,
            variable_data: {
                username_id: usernameId,
            },
        };
        return this._addPackage(addBasketPackageRequest);
    }

    /**
     * Adds a package with custom data and specified quantity to the basket.
     *
     * @param {Package} packageItem - The package object to be added.
     * @param {object} variableData - Variable data associated with the package.
     * @param {object} customData - Custom data provided for the package.
     * @param {number} [qty=1] - The quantity of the package to add. Default is 1.
     * @return {Promise<BasketFacade>} A promise that resolves to the updated BasketFacade instance after the package is added.
     */
    public addPackageWithCustomData(packageItem: Package, variableData: Record<string, string> | null, customData: object, qty: number = 1
    ): Promise<BasketFacade> {
        const addBasketPackageRequest = {
            _package: packageItem,
            quantity: qty,
            variable_data: variableData,
            custom: customData,
        };
        return this._addPackage(addBasketPackageRequest);
    }

    /**
     * Adds a package to the basket which is a gift for another player.
     *
     * @param {Package} packageItem - The package item to be added.
     * @param {string} targetUsernameId - The identifier of the target user who will receive the gifted package.
     * @param {Record<string, string> | null} variableData - The variable data associated with the package, or null if not applicable.
     * @param {number} [qty=1] - The quantity of the package to add. Defaults to 1 if not specified.
     * @return {Promise<BasketFacade>} Returns a promise that resolves to an instance of BasketFacade representing the updated basket state.
     */
    public async addGiftedPackage(packageItem: Package, targetUsernameId: string, variableData: Record<string, string> | null=null, qty: number = 1): Promise<BasketFacade> {
        const addGiftedPackageRequest = {
            _package: packageItem,
            quantity: qty,
            variable_data: variableData,
            target_username_id: targetUsernameId,
        };
        return this._addPackage(addGiftedPackageRequest);
    }

    /**
     * Adds a package for a specific target game server.
     *
     * @param {Package} packageItem - The package to be added.
     * @param {number} serverId - The ID of the target game server where the package will be added.
     * @param {number} [qty=1] - The quantity of the package being added. Defaults to 1.
     *
     * @return {Promise<BasketFacade>} A promise that resolves to a BasketFacade instance representing the updated package state.
     */
    public async addPackageForTargetGameServer(packageItem: Package, serverId: number, qty: number = 1): Promise<BasketFacade> {
        const targetGameServerPackageRequest = {
            _package: packageItem,
            quantity: qty,
            variable_data: {
                server_id: serverId,
            },
        };
        return this._addPackage(targetGameServerPackageRequest);
    }

    /**
     * Adds a package to the basket using the provided package request and returns a BasketFacade instance.
     *
     * @param {object} addPackageRequest - The request object containing package information to be added to the basket.
     * @return {Promise<BasketFacade>} A promise that resolves to the BasketFacade instance with the updated basket details.
     */
    private async _addPackage(addPackageRequest: object) : Promise<BasketFacade> {
        let {body} = await Tebex.headless.getHeadlessApi().addBasketPackage(
            this.getIdent(),
            addPackageRequest);

        return new BasketFacade(body!, this._project);
    }

    /**
     * Refreshes and retrieves the current state of the remote basket associated with this facade's ident.
     *
     * @return {Promise<BasketFacade>} A promise that resolves to a `BasketFacade` instance representing the updated basket.
     */
    public async refreshBasket() : Promise<BasketFacade> {
        let basket = await Tebex.headless.getBasketByIdent(this.getIdent());
        return new BasketFacade(basket, this._project);
    }
}