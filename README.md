# express-knex-auto-trx

Express middleware for automatically managing Knex.js database transactions.

## Motivation

This middleware will automatically:

- Start a `knex` database transaction for each inbound request.
- Provide a `getTrx()` function that can be `required` by your Express route handlers.
  - Your code can get the current transaction without needing the `req` object, which is helpful when using data service layers that are decoupled from Express.
- Automatically `commit` or `rollback` each transaction based on the HTTP response status code:
  - responses with a `400` or above will `rollback`
  - all other responses will `commit`.

## How It Works

- Uses [cls-hooked](https://www.npmjs.com/package/cls-hooked) to assign a unique transaction to each request
- Uses [on-finished](https://www.npmjs.com/package/on-finished) to inspect the response `statusCode` and either `commit` or `rollback` the transaction

## Usage

Connect the Middleware:

```js
const express = require('express');
const { knexAutoTrx } = require('./middleware/express-knex-auto-trx');
const knex = require('knex')(
  require('knexfile')[process.env.NODE_ENV || 'development']
);

app.use(knexAutoTrx(knex));
```

Then use the `getTrx` function as a replacement for the `knex` object/function:

```js
const { getTrx } = require('../middleware/express-knex-auto-trx');
const express = require('express');
const router = express.Router();

router.post('/users', (req, res, next) => {
  try {
    const [savedUser] = await getTrx() // each request will get its own transaction
      .insert(userData)
      .into('users')
      .returning('*');
    res.status(200).json(savedUser);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
```
