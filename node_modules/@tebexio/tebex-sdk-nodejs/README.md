# Tebex NodeJS SDK

This SDK provides access to Tebex APIs through server-side applications running Node.

## Requirements
- Node 22 or higher

## NPM
Install the SDK via [NPM](https://npmjs.com/) with the following command:

```bash
npm install tebexio/tebex-sdk-nodejs
```

## Examples

### Headless API
Headless allows interaction with your Tebex project using pre-defined packages and is available for all stores.

```javascript
// Initialize connection to Tebex by setting the public key. Use the returned project instance to
// interact with the store.
Tebex.headless.setProject("your-public-key").then(project => {
    project.listCategories().then(categories => {
        // loops through all categories
    });

    project.listPackages().then(packages => {
        // loop through all packages
    });

    project.getCategory(12345).then(category => {
        //use specific category
    });

    // Create baskets by providing a completion and cancellation url
    project.createBasket("https://tebex.io/completed", "https://tebex.io/cancelled").then(basket => {

        // If the project requires a user to auth, direct them to the auth url. On return the user's basket will
        // contain their authorized username.
        // NOTE: Most stores require the user to be authed before you are able to add packages.
        if (project.requiresUserAuth()) {
            let authUrl = project.getUserAuthUrl(basket, "https://tebex.io/auth-return");
            console.log("User auth required at: " + authUrl + ".");
        }

        // Add packages after auth
        project.getPackage(67890).then(pack => {
            // Various helper functions are provided for special actions such as gifting or gift card deliverables.
            basket.addPackage(pack);
            basket.addGiftedPackage(pack, "Username");
            basket.addGiftCardPackage(pack, "tebex-integrations@overwolf.com");

            // You may also provide custom variable data as needed
            basket.addPackage(pack, {
                "server_id":"127244",
            });
        });

        // Each function returns the remote basket after completion, but you can always refresh your current
        // basket instance from the API.
        basket.refreshBasket().then(b => {
            //use new basket
        });

        // Query the basket variable for any information
        console.log("Price $: " + basket.getBasket().basePrice);

        // Go to checkout
        let checkoutLink = basket.getLinks().checkout;
        console.log("Checkout at: " + checkoutLink);
    })
});
```

### Webhooks
Webhooks are sent to authorized endpoints configured within your Tebex creator panel. They contain information about events that occur in your project such as payments, refunds, and disputes.

Note: The secret key must be your webhook key provided at [https://creator.tebex.io/webhooks/endpoints](https://creator.tebex.io/webhooks/endpoints)

```javascript
Tebex.webhooks.setSecretKey("your-webhook-secret-key");

let webhook = Webhook.parse("your-received-webhook-json", {
    "HTTP-X-SIGNATURE": "your-received-signature",
    "REMOTE_ADDR": "webhook-originating-ip"
});

// You can check for specific webhook types
if (webhook.isType(WebhookType.VALIDATION_WEBHOOK)) {
    // respond to validation webhooks by returning their id
    let response = {"id": webhook.getId()}
}

// You can quickly check for types of webhooks with helper functions
else if (webhook.isTypeOfPayment() || webhook.isTypeOfDispute()) {
    // subject contains data about the webhook action
    let subject = webhook.getSubject() as PaymentSubject;
}

else if (webhook.isTypeOfRecurringPayment()) {
    let subject = webhook.getSubject() as RecurringPaymentSubject;
    // etc...
}
```

### Checkout API
The Checkout API allows collecting payment for ad-hoc products not defined in a Tebex project.

This API requires prior approval. Please contact Tebex support to enable on your account.

```javascript
let checkout = Tebex.checkout.setApiKeys("project-id", "private-key");

// Use a BasketBuilder to create your basket
let basketBuilder = checkout.newBasketBuilder()
    .email("tebex-integrations@overwolf.com")
    .firstname("Tebex")
    .lastname("Integrations")
    .returnUrl("https://tebex.io/")
    .completeUrl("https://tebex.io/");

// Use a Package builder to define packages
let package1 = checkout.newPackageBuilder()
    .name("100 Gold")
    .qty(1)
    .price(1.27)
    .oneTime()

let package2 = checkout.newPackageBuilder()
    .name("1 Month Sub")
    .qty(1)
    .price(2.44)
    .subscription()
    .monthly()

// Recommended: Create a single checkout request containing basket info, all packages, and any sales.
let checkoutItems = [
    package1.buildCheckoutItem(),
    package2.buildCheckoutItem()
];

checkout.checkoutRequest(basketBuilder, checkoutItems, undefined).then(
    (checkoutBasket) => {
        console.log("Checkout at: " + checkoutBasket.links!.checkout);
    }
).catch(console.error);

// Alternatively, you can add, remove, or change packages as needed after building the basket.
basketBuilder.build().then((basket) => {
    Tebex.checkout.addPackage(basket, package1.build()).then((currentBasket) => {
        // The basket object contains all property getters
        let checkoutLink = currentBasket.links?.checkout;
        console.log("Checkout at: " + checkoutLink);
    })
}).catch(console.error);
```
### ❓ API Documentation

Our APIs are fully documented at https://docs.tebex.io/developers as a resource for all options, events, and advanced functionality possible through Tebex.

## 🔗 Useful Links

- [Tebex API Documentation](https://docs.tebex.io/developers)
- [Headless API Documentation](https://docs.tebex.io/developers/headless-api/overview)
- [Checkout API Documentation](https://docs.tebex.io/developers/checkout-api/overview)

## Contributions

This SDK is open source and we welcome contributions from the community. If you wish to make a contribution, please review **CONTRIBUTING.md** for guidelines and things to know before making your contribution.

## 🙋‍♂️ Support

For issues relating to this library, please raise an issue in its repository. Otherwise you may also contact [tebex-integrations@tebex.io](mailto:tebex-integrations@tebex.io).