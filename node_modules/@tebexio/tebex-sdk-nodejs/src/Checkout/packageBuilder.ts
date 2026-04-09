import {CheckoutItem} from "./lib/model/checkoutItem";
import {Package} from "./lib/model/package";

/**
 * Builds packages for use with the Checkout API. Allows you to define the name, price, quantity, etc. of ad-hoc packages
 * that are not defined in a Tebex project.
 */
export class PackageBuilder {
    private _name: string = "";
    private _qty: number = 0;
    private _price: number = 0;
    private _type: Package.TypeEnum = Package.TypeEnum.Single;
    private _expiryPeriod: Package.ExpiryPeriodEnum|undefined;
    private _expiryLength: number|undefined;
    private _custom: object|undefined;

    /**
     * Sets the name of the package and returns the current PackageBuilder instance.
     *
     * @param {string} value - The name to be set for the package.
     * @return {PackageBuilder} The current instance of PackageBuilder.
     */
    name(value: string) : PackageBuilder {
        this._name = value;
        return this;
    }

    /**
     * Sets the quantity value for the package.
     *
     * @param {number} value - The quantity to be set.
     * @return {PackageBuilder} The updated instance of the PackageBuilder.
     */
    qty(value: number) : PackageBuilder {
        this._qty = value;
        return this;
    }

    /**
     * Sets the price for the package.
     *
     * @param {number} value - The price to be set for the package.
     * @return {PackageBuilder} The instance of the PackageBuilder for method chaining.
     */
    price(value: number) : PackageBuilder {
        this._price = value;
        return this;
    }

    /**
     * Configures the package as a one-time (single) type.
     *
     * @return {PackageBuilder} The current instance of the PackageBuilder for method chaining.
     */
    oneTime() : PackageBuilder {
        this._type = Package.TypeEnum.Single;
        return this;
    }

    /**
     * Configures the package as a subscription type. Note: You must also define the expiryPeriod() using an ExpiryPeriodEnum.
     *
     * @return {PackageBuilder} The current instance of the PackageBuilder for method chaining.
     */
    subscription() : PackageBuilder {
        this._type = Package.TypeEnum.Subscription;
        return this;
    }

    /**
     * Sets the package to a subscription that renews each month.
     *
     * @return {PackageBuilder} Returns the current instance of the PackageBuilder for method chaining.
     */
    monthly() : PackageBuilder {
        this._type = Package.TypeEnum.Subscription;
        this._expiryLength = 1;
        this._expiryPeriod = Package.ExpiryPeriodEnum.Month
        return this;
    }

    /**
     * Sets the package to a subscription that renews every 3 months.
     *
     * @return {PackageBuilder} Returns the current instance of the PackageBuilder for method chaining.
     */
    quarterly() : PackageBuilder {
        this._type = Package.TypeEnum.Subscription;
        this._expiryLength = 3;
        this._expiryPeriod = Package.ExpiryPeriodEnum.Month
        return this;
    }

    /**
     * Sets the package to a subscription that renews every 6 months.
     *
     * @return {PackageBuilder} Returns the current instance of the PackageBuilder for method chaining.
     */
    semiAnnual() : PackageBuilder {
        this._type = Package.TypeEnum.Subscription;
        this._expiryLength = 6;
        this._expiryPeriod = Package.ExpiryPeriodEnum.Month
        return this;
    }

    /**
     * Sets the package to a subscription that renews every year.
     *
     * @return {PackageBuilder} Returns the current instance of the PackageBuilder for method chaining.
     */
    yearly() : PackageBuilder {
        this._type = Package.TypeEnum.Subscription;
        this._expiryLength = 1;
        this._expiryPeriod = Package.ExpiryPeriodEnum.Year
        return this;
    }

    /**
     * Sets the expiry period for the package being built. If working with a subscription package you must define the expiry period
     * and length.
     *
     * @param {Package.ExpiryPeriodEnum} value - The expiration period to be set for the package.
     * @return {PackageBuilder} The current instance of PackageBuilder for method chaining.
     */
    expiryPeriod(value: Package.ExpiryPeriodEnum) : PackageBuilder {
        this._expiryPeriod = value;
        return this;
    }

    /**
     * Sets the expiry length for the package. The expiry length must be a non-negative number.
     *
     * @param {number} value - The expiry length in the desired units (must be non-negative).
     * @return {PackageBuilder} The instance of the PackageBuilder for method chaining.
     * @throws {Error} If the provided expiry length is negative.
     */
    expiryLength(value: number) : PackageBuilder {
        if (value < 0) {
            throw new Error("Expiry period cannot be negative");
        }

        this._expiryLength = value;
        return this;
    }

    /**
     * Assigns custom data to the package which will be attached to subsequent webhooks and API requests.
     *
     * @param {object} value - The custom value to be assigned.
     * @return {PackageBuilder} The current instance of the `PackageBuilder` for method chaining.
     */
    custom(value: object) : PackageBuilder {
        this._custom = value;
        return this;
    }

    /**
     * Builds and returns an object appropriate for using on the /checkout endpoint.
     * @return {CheckoutItem} An object representing a checkout item.
     */
    buildCheckoutItem() : CheckoutItem {
        return {
            _package: this.build()
        }
    }

    /**
     * Builds and returns a Package object with the current state of the builder's properties.
     *
     * @return {Package} A new Package object containing the name, type, quantity, price, expiry period, expiry length, and custom attributes defined in the builder.
     */
    build() : Package {
        return {
            name: this._name,
            type: this._type,
            qty: this._qty,
            price: this._price,
            expiryPeriod: this._expiryPeriod,
            expiryLength: this._expiryLength,
            custom: this._custom,
        };
    }
}