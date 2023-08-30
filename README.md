# Read me
This is a testing problem to generate SQL requests using TypeScript.

## To complile ts file:
Run `npx tsc index`.

This will generate `index.js` file.

## To run `index.js` file:
Run `node index.js`. 

### The valid result should look like:

```
Successfully generated: 'SELECT * FROM data WHERE name = 'cam';'
Successfully generated: 'SELECT * FROM data WHERE name = 'cam' LIMIT 10;'
Successfully generated: 'SELECT * FROM data LIMIT 20;'
Successfully generated: 'SELECT TOP 20 * FROM data;'
Successfully generated: 'SELECT * FROM data WHERE date_joined IS NULL;'
Successfully generated: 'SELECT * FROM data WHERE age > 35;'
Successfully generated: 'SELECT * FROM data WHERE id < 5 AND name = 'joe';'
Successfully generated: 'SELECT * FROM data WHERE date_joined <> '2015-11-01' OR id = 456;'
Successfully generated: 'SELECT * FROM data WHERE date_joined IS NOT NULL AND (age > 25 OR name = 'Jerry');'
Successfully generated: 'SELECT * FROM data WHERE age IN (25, 26, 27);'
Successfully generated: 'SELECT * FROM data WHERE name = 'cam';'
Successfully generated: 'SELECT * FROM data WHERE name = 'cam' LIMIT 10;'
Successfully generated: 'SELECT * FROM data LIMIT 20;'
Successfully generated: 'SELECT TOP 20 * FROM data;'
Successfully generated: 'SELECT * FROM data WHERE id < 5 AND name = 'joe';'
Successfully generated: 'SELECT * FROM data WHERE id < 5 AND name = 'joe' AND age > 18;'
```

## How to test the solution:
To run new test case you should use `testSQLGeneration` function with take the result generated by `generateSql` and the expected result as the second argument.

`testSQLGeneration` is case sensetive, so both arguments should be identical.

`generateSql` will return a string.

The solution supports arguments listed in the `Operator` enum and macro.

The solution is writter using pure functions. To extend the solution to use more Dialect's, new filter clause types, or new literal types the new functions should be written and put in the code. Code is written to make that extension simple.