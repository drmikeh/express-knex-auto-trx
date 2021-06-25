/* eslint-disable func-names */
const onFinished = require('on-finished');

// Use `cls-hooked` to add Continuation-Local Storage of a knex transaction object
// CLS is similar to thread-local storage for multi-threaded languages, but for
// JavaScript it provides local storage for sync and async operations across a
// single request.
const { createNamespace } = require('cls-hooked');

const knexNameSpace = createNamespace('trx');

/**
 *
 * @param {object} knex an instance of Knex.Client
 * @param {function} logger a function that logs a message
 * @returns an Express middleware function
 */
function knexAutoTrx(knex, logger = null) {
    if (typeof knex !== 'function' || typeof knex.transaction !== 'function') {
        throw new TypeError(
            `Parameter "knex" must be an instance of Knex.Client. Got ${typeof knex}`
        );
    }

    // define middleware that starts a transaction and makes the `trx` object
    // available via CLS. This middleware also configures an event listener that
    // will automatically commit or rollback the transaction depending on the
    // response statusCode.
    return function (req, res, next) {
        // use `knex` to start a transaction and get a `trx` object
        knex.transaction(trx => {
            const requestSignature = `${req.method} ${req.originalUrl}`;
            if (logger) {
                logger(`TX: starting transaction for ${requestSignature}`);
            }

            // listen for the `end` event on the response object and either
            // rollback or commit the knex transaction based on the value of
            // the response.statusCode:
            //   - rollback if statusCode >= 400
            //   - commit otherwise
            // eslint-disable-next-line no-shadow
            onFinished(res, (err, res) => {
                if (err || (res.statusCode && res.statusCode >= 400)) {
                    if (logger) {
                        logger(
                            `TX: rolling back transaction for ${requestSignature} : statusCode=${res.statusCode}`
                        );
                    }
                    trx.rollback();
                } else {
                    if (logger) {
                        logger(
                            `TX: committing transaction for ${requestSignature}`
                        );
                    }
                    trx.commit();
                }
            });

            knexNameSpace.run(() => {
                knexNameSpace.set('trx', trx);
                next();
            });
        }).catch(err => {
            next(err);
        });
    };
}

/**
 * If tableName is provided, use it; otherwise just return the `trx` object.
 * This is to keep parity with the underlying `knex` / `trx` API.
 *
 * @param {string} tableName an optional name of a database table
 * @returns the local database transaction
 */
function getTrx(tableName) {
    return tableName
        ? knexNameSpace.get('trx')(tableName)
        : knexNameSpace.get('trx');
}

module.exports = {
    knexAutoTrx,
    getTrx
};
