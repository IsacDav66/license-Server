import {Basket} from "../../src/Headless/lib/model/basket";
import {TebexProject} from "../../src/Headless/projects/tebexProject";
import {BasketFacade} from "../../src/Headless/basketFacade";
import {BasketLinks} from "../../src/Headless/lib/model/basketLinks";

describe('BasketFacade', () => {
    let basket: Basket;
    let project: TebexProject;
    let basketFacade: BasketFacade;

    beforeEach(() => {
        basket = {
            username: 'TebexDev',
            basePrice: 100
        } as Basket;

        project = {
            getRequiredBasketParams: jest.fn().mockReturnValue(['username']),
        } as unknown as TebexProject;

        basketFacade = new BasketFacade(basket, project);
    });

    test('getBasket() should return the basket instance', () => {
        expect(basketFacade.getBasket()).toBe(basket);
    });

    test('getLinks() should return the basket links', () => {
        expect(basketFacade.getLinks()).toEqual(basket.links as BasketLinks);
    });

    test('getBasePrice() should return the base price of the basket', () => {
        expect(basketFacade.getBasePrice()).toBe(100);
    });

    test('isAuthed() should return true if the user is authenticated', () => {
        expect(basketFacade.isAuthed()).toBe(true);
    });

    test('isAuthed() should return false if the username is null', () => {
        basket.username = null;
        expect(basketFacade.isAuthed()).toBe(false);
    });

    test('isAuthed() should return false if required basket params are absent', () => {
        jest.spyOn(project, 'getRequiredBasketParams').mockReturnValue([]);
        expect(basketFacade.isAuthed()).toBe(false);
    });
});