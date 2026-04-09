import {BasketFacade} from "../basketFacade";
import {Package} from "../lib/model/package";
import {Tebex} from "../../tebex";
import {Category} from "../lib/model/category";
import {Webstore} from "../lib/model/webstore";

/**
 * Base class representing a Tebex store/project.
 * Each inheriting store type defines its required basket parameters and username parameters.
 */
export class TebexProject {
    private readonly _webstore: Webstore;

    constructor(webstore: Webstore) {
        this._webstore = webstore;
    }

    /**
     * Creates a basket for use on this project.
     *
     * @param completeUrl - The URL to send the user to after completion.
     * @param cancelUrl - The URL to send the user if they cancel the transaction.
     * @param userIdentifier - Optional username, email, etc. as required by the store type.
     * @param includedCreationData - Optional data to include with the basket creation request.
     * @throws ApiException
     */
    public async createBasket(
        completeUrl: string,
        cancelUrl: string,
        userIdentifier: string = '',
        includedCreationData: Record<string, any> = {}
    ): Promise<BasketFacade> {
        const createBasketData: Record<string, any> = {
            complete_url: completeUrl,
            cancel_url: cancelUrl,
        };

        if (this.getUserIdentifierParameter()) {
            if (!userIdentifier) {
                throw new Error(
                    `User identifier is required for this store type as: '${this.getUserIdentifierParameter()}'`
                );
            }

            // Set the user id to the one provided.
            createBasketData[this.getUserIdentifierParameter()] = userIdentifier;
        }

        // Confirm all required parameters for the store are present.
        for (const requiredParam of this.getRequiredBasketParams()) {
            if (!requiredParam) {
                continue;
            }

            if (!createBasketData[requiredParam]) {
                throw new Error(
                    `Required parameter '${requiredParam}' is missing from the basket creation data.`
                );
            }
        }

        // Add any other data provided, such as custom.
        for (const [key, value] of Object.entries(includedCreationData)) {
            if (!createBasketData[key]) {
                createBasketData[key] = value;
            } else {
                throw new Error(
                    `The key '${key}' is already set in the basket creation data.`
                );
            }
        }

        // Set redirect if not provided.
        if (!Object.prototype.hasOwnProperty.call(createBasketData, 'complete_auto_redirect')) {
            createBasketData['complete_auto_redirect'] = true;
        }

        // Create the remote basket and return it wrapped in the facade class.
        let basket = await Tebex.headless.createBasket(createBasketData);
        return new BasketFacade(basket, this);
    }

    /**
     * Returns an array of parameters that are required in order to create the basket,
     * in addition to the default required parameters.
     */
    public getRequiredBasketParams(): string[] {
        const userIdentifierParam = this.getUserIdentifierParameter();
        if (!userIdentifierParam) {
            return [];
        }
        return [userIdentifierParam];
    }

    /**
     * Gets the name of the user identifier, such as username, username_id, etc., required by this store type.
     */
    public getUserIdentifierParameter(): string {
        return this.getUsernameFieldId(this._webstore.platformType!);
    }

    /**
     * Determines and returns the appropriate field identifier for the username based on the platform type of the webstore.
     *
     * @return {string} The field identifier, such as "username", "user_id", "discord_id", or an empty string for unsupported or no-auth systems.
     *                  Throws an error if the platform type is unsupported.
     */
    getUsernameFieldId(platformType: string) : string {
        switch (platformType) {
            // Minecraft and Overwolf require username
            case "Overwolf":
            case "Minecraft (Offline/Geyser)":
            case "Minecraft (Bedrock)":
            case "Minecraft: Java Edition":
                return "username"

            // Steam stores require the steam_id
            case "Conan Exiles":
            case "LEAP":
            case "CREY":
            case "Onset":
            case "RedM":
            case "FiveM":
            case "GTA V":
            case "ATLAS":
            case "Space Engineers":
            case "ARK: Survival Evolved":
            case "Hurtworld":
            case "Team Fortress 2":
            case "Counter-Strike: Global Offensive":
            case "Garry's Mod":
            case "7 Days to Die":
            case "Rust":
            case "Unturned":
                return "user_id";

            // Other specific apps
            case "Discord":
                return "discord_id"

            case "Universal (No Auth)":
                return "";

            // Handle unsupported platforms
            default:
                throw new Error(`The webstore you are trying to access is not supported by this library: ${platformType}`);
        }
    }

    /**
     * Gets the URL for a user to authorize their account. Baskets must be authorized
     * before adding packages if required by the store. After successfully authorizing,
     * they will be directed to the provided returnUrl.
     *
     * @param wrapper - Wrapped basket.
     * @param returnUrl - The URL the user should return to after auth is completed.
     * @throws ApiException
     */
    public async getUserAuthUrl(wrapper: BasketFacade, returnUrl: string): Promise<string> {
        return Tebex.headless.getUserAuthUrl(wrapper.getBasket(), returnUrl);
    }

    /**
     * Returns a list of all packages in the store.
     * @throws ApiException
     */
    public async listPackages(): Promise<Package[]> {
        return await Tebex.headless.getAllPackages();
    }

    /**
     * Returns a list of all categories in the store.
     * @throws ApiException
     */
    public async listCategories(): Promise<Category[]> {
        return await Tebex.headless.getAllCategories();
    }

    /**
     * Gets the underlying name of the store's platform.
     */
    public getPlatformName(): string {
        return this._webstore.platformType!;
    }

    /**
     * Returns `true` if the store requires the user to be authed before adding packages.
     */
    public requiresUserAuth(): boolean {
        return this.getRequiredBasketParams().length > 0;
    }

    /**
     * Gets a category from the API by its ID.
     *
     * @param categoryId - ID of the category.
     * @throws ApiException
     */
    public async getCategory(categoryId: number): Promise<Category> {
        return await Tebex.headless.getCategory(categoryId);
    }

    /**
     * Gets a package from the API by its ID.
     *
     * @param packageId - ID of the package.
     * @throws ApiException
     */
    public async getPackage(packageId: number): Promise<Package> {
        return await Tebex.headless.getPackage(packageId);
    }
}