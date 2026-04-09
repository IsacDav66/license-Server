import {BasketBuilder} from '../../src/Checkout/basketBuilder';
import {Tebex} from "../../src/tebex";

describe('BasketBuilder', () => {
    it('should set email correctly', () => {
        const builder = new BasketBuilder();
        builder.email('test@example.com');
        const result = builder.buildCheckoutRequest();

        expect(result.email).toBe('test@example.com');
    });

    it('should set first name correctly', () => {
        const builder = new BasketBuilder();
        builder.firstname('John');
        const result = builder.buildCheckoutRequest();

        expect(result.firstName).toBe('John');
    });

    it('should set last name correctly', () => {
        const builder = new BasketBuilder();
        builder.lastname('Doe');
        const result = builder.buildCheckoutRequest();

        expect(result.lastName).toBe('Doe');
    });

    it('should set return URL correctly', () => {
        const builder = new BasketBuilder();
        builder.returnUrl('https://example.com/return');
        const result = builder.buildCheckoutRequest();

        expect(result.returnUrl).toBe('https://example.com/return');
    });

    it('should set complete URL correctly', () => {
        const builder = new BasketBuilder();
        builder.completeUrl('https://example.com/complete');
        const result = builder.buildCheckoutRequest();

        expect(result.completeUrl).toBe('https://example.com/complete');
    });

    it('should set custom values correctly', () => {
        const builder = new BasketBuilder();
        const customData = {key: 'value'};
        builder.custom(customData);
        const result = builder.buildCheckoutRequest();

        expect(result.custom).toEqual(customData);
    });

    it('should set IP address correctly', () => {
        const builder = new BasketBuilder();
        builder.ip('192.168.0.1');
        const result = builder.buildCheckoutRequest();

        expect(builder['_ip']).toBe('192.168.0.1');
    });

    it('should set creator code correctly', () => {
        const builder = new BasketBuilder();
        builder.creatorCode('creator123');
        const result = builder.buildCheckoutRequest();

        expect(builder['_creatorCode']).toBe('creator123');
    });

    it('should correctly build a checkout request', () => {
        const builder = new BasketBuilder();
        builder
            .email('test@example.com')
            .firstname('John')
            .lastname('Doe')
            .returnUrl('https://example.com/return')
            .completeUrl('https://example.com/complete')
            .custom({key: 'value'});

        const result = builder.buildCheckoutRequest();

        expect(result).toEqual({
            email: 'test@example.com',
            firstName: 'John',
            lastName: 'Doe',
            returnUrl: 'https://example.com/return',
            completeUrl: 'https://example.com/complete',
            custom: {key: 'value'},
        });
    });

    it('should correctly build a basket', async () => {
        const builder = new BasketBuilder();
        builder
            .email('test@example.com')
            .firstname('John')
            .lastname('Doe')
            .returnUrl('https://example.com/return')
            .completeUrl('https://example.com/complete');

        jest.spyOn(Tebex.checkout, 'createBasket').mockResolvedValue({
            returnUrl: "https://example.com/return",
        });

        const result = await builder.build();

        expect(result).toEqual({
            returnUrl: 'https://example.com/return',
        });
    });
});