import {Tebex} from "../tebex";
import {CheckoutRequestBasket} from "./lib/model/checkoutRequestBasket";
import {Basket} from "./lib/model/basket";

/**
 * Builds baskets for use with the Checkout API. This should be used to create, validate, and manage your baskets.
 */
export class BasketBuilder {
    private _email: string = "";
    private _firstName: string = "";
    private _lastName: string = "";
    private _returnUrl: string = "";
    private _completeUrl: string = "";

    // Optional or filled by api
    private _custom: object|undefined;
    private _ip?: string|undefined;
    private _completeAutoRedirect: boolean=true;
    private _creatorCode?: string|undefined;

    /**
     * Sets the email address for the basket and returns the BasketBuilder instance.
     *
     * @param {string} value - The email address to be set.
     * @return {BasketBuilder} The instance of BasketBuilder for chained method calls.
     */
    email(value: string) : BasketBuilder {
        this._email = value;
        return this;
    }

    /**
     * Sets the customer's first name for the basket.
     *
     * @param {string} value - The customer's first name to be set.
     * @return {BasketBuilder} The instance of the BasketBuilder to allow method chaining.
     */
    firstname(value: string) : BasketBuilder {
        this._firstName = value;
        return this;
    }

    /**
     * Sets the customer's last name for the basket.
     *
     * @param {string} value - The customer's last name to be set.
     * @return {BasketBuilder} The current instance of the BasketBuilder for method chaining.
     */
    lastname(value: string) : BasketBuilder {
        this._lastName = value;
        return this;
    }

    /**
     * Sets the user's IP address for the basket. The provided IP address will be geolocated such that the origin country will be
     * present on the remote basket.
     *
     * NOTE: If no IP is provided with the basket, we will use the request IP. If running code on your backend server,
     * ensure you provide the customer's IP to allow for fraud protection.
     *
     * @param {string} value - The IP address to be set.
     * @return {BasketBuilder} Returns the instance of BasketBuilder for method chaining.
     */
    ip(value: string) : BasketBuilder {
        this._ip = value;
        return this;
    }

    /**
     * Sets the creator code for the basket and returns the instance of the BasketBuilder.
     *
     * @param {string} value - The creator code to be assigned.
     * @return {BasketBuilder} The current instance of the BasketBuilder.
     */
    creatorCode(value: string) : BasketBuilder {
        this._creatorCode = value;
        return this;
    }

    /**
     * Sets the return URL for the basket.
     *
     * @param {string} value - The URL to which the user will be redirected if they cancel their payment
     * @return {BasketBuilder} The current instance of the BasketBuilder to allow method chaining.
     */
    returnUrl(value: string) : BasketBuilder {
        this._returnUrl = value;
        return this;
    }

    /**
     * Sets the completion URL for the basket.
     *
     * @param {string} value - The URL to be used as the complete URL, where the user will be taken after payment is completed
     * @return {BasketBuilder} The current instance of the BasketBuilder to allow method chaining.
     */
    completeUrl(value: string) : BasketBuilder {
        this._completeUrl = value;
        return this;
    }

    /**
     * Sets a custom value to be tracked with the basket builder instance. These will be present on the remote basket for reference later.
     *
     * @param {object} value - The custom values to be tracked.
     * @return {BasketBuilder} The updated BasketBuilder instance with the custom value set.
     */
    custom(value: object) : BasketBuilder {
        this._custom = value;
        return this;
    }

    /**
     * Constructs and returns a basket formatted appropriately for making a /checkout request.
     *
     * @return {CheckoutRequestBasket}
     */
    public buildCheckoutRequest() : CheckoutRequestBasket {
        return {
            email: this._email,
            firstName: this._firstName,
            lastName: this._lastName,
            returnUrl: this._returnUrl,
            completeUrl: this._completeUrl,
            custom: this._custom,
        }
    }

    /**
     * Constructs and creates a basket on the remote API using the provided user details and returns it.
     *
     * @return {Promise<Basket>} A promise that resolves to a Basket object after it has been successfully created.
     */
    public async build() : Promise<Basket> {
        return Tebex.checkout.createBasket({
            email: this._email,
            firstName: this._firstName,
            lastName: this._lastName,
            returnUrl: this._returnUrl,
            completeUrl: this._completeUrl,
            ip: this._ip,
            custom: this._custom,
            completeAutoRedirect: this._completeAutoRedirect,
            creatorCode: this._creatorCode,
        })
    }
}