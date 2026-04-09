import {Checkout} from "./checkout";
import {Headless} from "./headless";
import {Webhooks} from "./webhooks";

/**
 * Main entry point for accessing the various Tebex APIs. Per each API, set your keys before use.
 */
export class Tebex {
    public static readonly checkout: Checkout = new Checkout();
    public static readonly headless: Headless = new Headless();
    public static readonly webhooks: Webhooks = new Webhooks();
}