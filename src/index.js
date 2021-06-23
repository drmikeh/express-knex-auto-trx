/* eslint-disable func-names */
const onFinished = require('on-finished');

// Use `cls-hooked` to add Continuation-Local Storage of a knex transaction object
// CLS is similar to thread-local storage for multi-threaded languages, but for
// JavaScript it provides local storage for sync and async operations across a
// single request.
const { createNamespace } = require('cls-hooked');

const knexNameSpace = createNamespace('trx');

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

            // TODO: Using `onFinished` with transactions may introduce a slight race condition
            // when testing because the message may be sent to the client concurrently with the tx
            // being committed or rolled back.
            // To remove the race condition, we could use an interceptor, such as https://github.com/axiomzen/express-interceptor,
            // so that we can `await` on the commit/rollback, but it looks hairy as that interceptor does monkey patching and
            // the code hasn't been updated in 5 years.

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

function getTrx(tableName) {
    // If tableName is provided, use it; otherwise just return the `trx` object.
    // This is to keep parity with the underlying `knex` / `trx` API.
    return tableName
        ? knexNameSpace.get('trx')(tableName)
        : knexNameSpace.get('trx');
}

module.exports = {
    knexAutoTrx,
    getTrx
};
