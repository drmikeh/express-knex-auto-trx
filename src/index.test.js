/* eslint-disable no-console */
require('jest-extended');
const knex = require('knex');
const httpMocks = require('node-mocks-http');
const eventEmitter = require('events').EventEmitter;
const onFinished = require('on-finished');
const mockDB = require('mock-knex');
const { knexAutoTrx, getTrx } = require('./index');

function onFinishedVerifier(res, commitOrRollback, done) {
    const trx = getTrx();
    expect(trx).toBeFunction();

    const spy = jest.spyOn(trx, commitOrRollback);

    onFinished(res, err => {
        if (err) return done(err);
        try {
            expect(spy).toHaveBeenCalled();
            spy.mockRestore();
            return done();
        } catch (e) {
            return done(e);
        }
    });
}

describe('express-knex-auto-trx', () => {
    let mockKnex;
    beforeAll(() => {
        mockKnex = knex({
            client: 'pg'
        });
        mockDB.mock(mockKnex);
    });

    describe('knexAutoTrx', () => {
        let mockRequest = null;
        let mockResponse = null;
        beforeEach(async () => {
            mockRequest = httpMocks.createRequest();
            mockResponse = httpMocks.createResponse({ eventEmitter });
        });

        it('should throw a TypeError when parameter is not an instance of Knex.Client', () => {
            expect(() => {
                knexAutoTrx(null);
            }).toThrowWithMessage(
                TypeError,
                `Parameter "knex" must be an instance of Knex.Client. Got ${typeof null}`
            );
        });

        it('should return a function', () => {
            expect(knexAutoTrx(mockKnex)).toBeFunction();
        });

        it('should call `commit` on success', done => {
            const next = error => {
                if (error) return done(error);
                try {
                    const r = onFinishedVerifier(mockResponse, 'commit', done);
                    mockResponse.status(200).end();
                    return r;
                } catch (e) {
                    return done(e);
                }
            };
            knexAutoTrx(mockKnex)(mockRequest, mockResponse, next);
        });

        it('should call `rollback` on failure', done => {
            const next = error => {
                if (error) return done(error);
                try {
                    const r = onFinishedVerifier(
                        mockResponse,
                        'rollback',
                        done
                    );
                    mockResponse.status(500).end();
                    return r;
                } catch (e) {
                    return done(e);
                }
            };
            knexAutoTrx(mockKnex)(mockRequest, mockResponse, next);
        });
    });
});
