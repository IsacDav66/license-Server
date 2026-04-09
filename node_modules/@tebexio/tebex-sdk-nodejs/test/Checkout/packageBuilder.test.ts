import {PackageBuilder} from "../../src/Checkout/packageBuilder";
import {Package} from "../../src/Checkout/lib/model/package";

describe('PackageBuilder', () => {
    it('should set the name of the package', () => {
        const builder = new PackageBuilder();
        builder.name('Test Package');
        const result = builder.build();
        expect(result.name).toBe('Test Package');
    });

    it('should set the quantity of the package', () => {
        const builder = new PackageBuilder();
        builder.qty(5);
        const result = builder.build();
        expect(result.qty).toBe(5);
    });

    it('should set the price of the package', () => {
        const builder = new PackageBuilder();
        builder.price(250);
        const result = builder.build();
        expect(result.price).toBe(250);
    });

    it('should configure the package as one-time', () => {
        const builder = new PackageBuilder();
        builder.oneTime();
        const result = builder.build();
        expect(result.type).toBe('single');
    });

    it('should configure the package as a subscription', () => {
        const builder = new PackageBuilder();
        builder.subscription();
        const result = builder.build();
        expect(result.type).toBe('subscription');
    });

    it('should configure the package as monthly subscription', () => {
        const builder = new PackageBuilder();
        builder.monthly();
        const result = builder.build();
        expect(result.type).toBe('subscription');
        expect(result.expiryPeriod).toBe(Package.ExpiryPeriodEnum.Month);
        expect(result.expiryLength).toBe(1);
    });

    it('should configure the package as quarterly subscription', () => {
        const builder = new PackageBuilder();
        builder.quarterly();
        const result = builder.build();
        expect(result.type).toBe('subscription');
        expect(result.expiryPeriod).toBe(Package.ExpiryPeriodEnum.Month);
        expect(result.expiryLength).toBe(3);
    });

    it('should configure the package as semi-annual subscription', () => {
        const builder = new PackageBuilder();
        builder.semiAnnual();
        const result = builder.build();
        expect(result.type).toBe('subscription');
        expect(result.expiryPeriod).toBe(Package.ExpiryPeriodEnum.Month);
        expect(result.expiryLength).toBe(6);
    });

    it('should configure the package as yearly subscription', () => {
        const builder = new PackageBuilder();
        builder.yearly();
        const result = builder.build();
        expect(result.type).toBe('subscription');
        expect(result.expiryPeriod).toBe(Package.ExpiryPeriodEnum.Year);
        expect(result.expiryLength).toBe(1);
    });

    it('should set the expiry period of the package', () => {
        const builder = new PackageBuilder();
        builder.expiryPeriod(Package.ExpiryPeriodEnum.Year);
        const result = builder.build();
        expect(result.expiryPeriod).toBe(Package.ExpiryPeriodEnum.Year);
    });

    it('should set the expiry length of the package', () => {
        const builder = new PackageBuilder();
        builder.expiryLength(12);
        const result = builder.build();
        expect(result.expiryLength).toBe(12);
    });

    it('should throw an error if expiry length is negative', () => {
        const builder = new PackageBuilder();
        expect(() => builder.expiryLength(-1)).toThrowError("Expiry period cannot be negative");
    });

    it('should set custom data for the package', () => {
        const builder = new PackageBuilder();
        const customData = {key: 'value'};
        builder.custom(customData);
        const result = builder.build();
        expect(result.custom).toEqual(customData);
    });

    it('should build a checkout item', () => {
        const builder = new PackageBuilder();
        builder.name('Checkout Package').price(100);
        const checkoutItem = builder.buildCheckoutItem();
        expect(checkoutItem._package?.name).toBe('Checkout Package');
        expect(checkoutItem._package?.price).toBe(100);
    });
});