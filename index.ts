enum Dialect {
  SQLServer = "sqlserver",
  Postgres = "postgres",
  MySQL = "mysql",
}

enum Operator {
  AND = "and",
  OR = "or",
  NOT = "not",
  GREATER = "<",
  LOWER = ">",
  EQUAL = "=",
  NOT_EQUAL = "!=",
  IS_EMPTY = "is-empty",
  NOT_EMPTY = "not-empty",
}

type Fields = {
  [id: number]: string;
};

type WhereClause =
  | AndOperator
  | OrOperator
  | NotOperator
  | GreaterOperator
  | LowerOperator
  | EqualSignOperator
  | NotEqualSignOperator
  | IsEmptyOperator
  | NotEmptyOperator;

type FieldValueExtractor = ["field", number];
type ValueExtractor = FieldValueExtractor | string | number | null;

type MacroOperator = [(Operator | "macro"), ...(WhereClause | ["macro", string] | string)[]];
type AndOperator = [Operator.AND, ...WhereClause[]];
type OrOperator = [Operator.OR, ...WhereClause[]];
type NotOperator = [Operator.NOT, WhereClause];
type GreaterOperator = [Operator.GREATER, ValueExtractor, ValueExtractor];
type LowerOperator = [Operator.LOWER, ValueExtractor, ValueExtractor];
type EqualSignOperator = [Operator.EQUAL, ...ValueExtractor[]];
type NotEqualSignOperator = [Operator.NOT_EQUAL, ...ValueExtractor[]];
type IsEmptyOperator = [Operator.IS_EMPTY, ValueExtractor];
type NotEmptyOperator = [Operator.NOT_EMPTY, ValueExtractor];

type Query = {
  limit?: number;
  where?: WhereClause | MacroOperator;
};

// Can be extended to support more formats. The example was taken from:
// https://stackoverflow.com/questions/18758772/how-do-i-validate-a-date-in-this-format-yyyy-mm-dd-using-jquery.
// But I would prefer to use spefic library to delegate handling all the edge cases.
const isValidDate = (dateString: string): boolean => {
  if(!dateString.match(/^\d{4}-\d{2}-\d{2}$/)) return false;

  const d = new Date(dateString);
  const dNum = d.getTime();
  if(!dNum && dNum !== 0) return false;

  return d.toISOString().slice(0,10) === dateString;
}

const extractValue = (
  valueExtractor: ValueExtractor,
  fields: Fields,
  operator: WhereClause
): {value: string; isCustomSignUsed: boolean;} => {
  switch (typeof valueExtractor) {
    case "string":
      if(isValidDate(valueExtractor)) {
        return {
          value: ` <> '${valueExtractor}'`,
          isCustomSignUsed: true
        }
      }
      return {
        value: `'${valueExtractor}'`,
        isCustomSignUsed: false,
      };
    case "number":
      return {
        value: `${valueExtractor}`,
        isCustomSignUsed: false,
      };
    case "object":
      if (!valueExtractor) {
        switch (operator[0]) {
          case Operator.NOT:
          case Operator.NOT_EQUAL:
            return {
              value: " IS NOT NULL",
              isCustomSignUsed: true
            }
          default: 
            return {
              value: " IS NULL",
              isCustomSignUsed: true
            }
        }
      }

      return {
        value: fields[valueExtractor[1]],
        isCustomSignUsed: false
      };
  }
};

const extractNotEmptyClause = (
  operator: NotEmptyOperator,
  fields: Fields
): string => {
  return `${extractValue(operator[1], fields, operator).value} IS NOT NULL`;
};

const extractEmptyClause = (
  operator: IsEmptyOperator,
  fields: Fields
): string => {
  return `${extractValue(operator[1], fields, operator).value} IS NULL`;
};

// This can be refactored to a list of extracted values, and called with join(", ") function.
const getExtractedRange = (
  operator: NotEqualSignOperator | EqualSignOperator,
  fields: Fields
): string => {
  return operator.reduce((res, currentExtractor, index) => {
    if (index < 2) {
      return res;
    }

    const currentValue = extractValue(currentExtractor, fields, operator).value;

    if (index === 2) {
      return `(${res}${currentValue}`;
    }

    if (index === operator.length - 1) {
      return `${res}, ${currentValue})`;
    }

    return `${res}, ${currentValue}`;
  }, "") as string;
};

const extractEqualClause = (
  operator: EqualSignOperator,
  fields: Fields
): string => {
  if (operator.length === 3) {
    const xValue = extractValue(operator[1], fields, operator).value;
    const {value: yValue, isCustomSignUsed} = extractValue(operator[2], fields, operator);
    if (isCustomSignUsed) {
      return `${xValue}${yValue}`
    }
    return `${xValue} = ${yValue}`;
  }

  const xValue = extractValue(operator[1], fields, operator).value;
  const rangeValues = getExtractedRange(operator, fields);

  return `${xValue} IN ${rangeValues}`;
};

const extractNotEqualClause = (
  operator: NotEqualSignOperator,
  fields: Fields
): string => {
  if (operator.length === 3) {
    const xValue = extractValue(operator[1], fields, operator).value;
    const {value: yValue, isCustomSignUsed} = extractValue(operator[2], fields, operator);
    if (isCustomSignUsed) {
      return `${xValue}${yValue}`
    }
    return `${xValue} != ${yValue}`;
  }

  const xValue = extractValue(operator[1], fields, operator).value;
  const rangeValues = getExtractedRange(operator, fields);

  return `${xValue} NOT IN ${rangeValues}`;
};

const extractGreaterClause = (
  operator: GreaterOperator,
  fields: Fields
): string => {
  const xValue = extractValue(operator[1], fields, operator).value;
  const yValue = extractValue(operator[2], fields, operator).value;

  return `${xValue} > ${yValue}`;
};

const extractLowerClause = (
  operator: LowerOperator,
  fields: Fields
): string => {
  const xValue = extractValue(operator[1], fields, operator).value;
  const yValue = extractValue(operator[2], fields, operator).value;

  return `${xValue} < ${yValue}`;
};

const extractNotClause = (operator: NotOperator, fields: Fields): string => {
  return `NOT ${extractClause(operator[1], fields, false)}`;
};

const extractAndClause = (operator: AndOperator, fields: Fields): string => {
  if (operator.length === 2) {
    return extractClause(operator[1], fields, false);
  }

  return operator
    .filter((_, index) => index !== 0)
    .map(clause => extractClause(clause as WhereClause, fields, true))
    .join(" AND ");
};

const extractORClause = (operator: OrOperator, fields: Fields): string => {
  if (operator.length === 2) {
    return extractClause(operator[1], fields, false);
  }

  return operator
    .filter((_, index) => index !== 0)
    .map(clause => extractClause(clause as WhereClause, fields, true))
    .join(" OR ");
};

type Macros = {
  [name: string]: WhereClause | MacroOperator;
}

const macros = {
  "is_joe": [Operator.EQUAL, ["field", 2], "joe"],
  "is_old": [Operator.GREATER, ["field", 4], 18],
  "is__old_joe": [Operator.AND, ["macro", "is_joe"], ["macro", "is_old"]],
};

const extractMacroClause = (operator: MacroOperator, fields: Fields): string => {
  if(operator[0] === "macro") {
    // Typecasting for the code simplication and time saving. Should be refactored.
    const selectedMacro = macros[operator[1] as string] as MacroOperator;
    return extractClause(selectedMacro as WhereClause, fields, false);
  }

  const selectedMacro = macros[operator[0]];

  if(!selectedMacro) {
    throw Error(`Invalid macro was passes: ${operator[0]}`);
  }

  return extractClause(selectedMacro, fields, false);
}

function extractClause(
  operator: WhereClause,
  fields: Fields,
  isCalledBefore: boolean
): string {
  switch (operator[0]) {
    case Operator.AND:
      if (isCalledBefore) {
        return `(${extractClause(operator, fields, false)})`;
      }
      return extractAndClause(operator, fields);
    case Operator.OR:
      if (isCalledBefore) {
        return `(${extractClause(operator, fields, false)})`;
      }
      return extractORClause(operator, fields);
    case Operator.NOT:
      // Can be extended to count the depth. if ["not", ["not", ["not", condition]]] => NOT condition
      if (operator[1][0] === Operator.NOT) {
        return extractClause(operator[1][1], fields, false);
      }
      return extractNotClause(operator, fields);
    case Operator.GREATER:
      return extractGreaterClause(operator, fields);
    case Operator.LOWER:
      return extractLowerClause(operator, fields);
    case Operator.EQUAL:
      return extractEqualClause(operator, fields);
    case Operator.NOT_EQUAL:
      return extractNotEqualClause(operator, fields);
    case Operator.IS_EMPTY:
      return extractEmptyClause(operator, fields);
    case Operator.NOT_EMPTY:
      return extractNotEmptyClause(operator, fields);

    default:
      return extractMacroClause(operator, fields);
  }
}

const getLimitRequest = (dialect: Dialect, limit: number) => {
  switch (dialect) {
    case Dialect.Postgres:
    case Dialect.MySQL:
      return `LIMIT ${limit}`
    case Dialect.SQLServer:
      return `TOP ${limit}`
  }
}

function generateSql(dialect: Dialect, fields: Fields, query: Query): string {
  if (!query.where && !query.limit) return "SELECT * FROM data;";

  let limitRequest = query.limit ? ` ${getLimitRequest(dialect, query.limit)}` : "";
  // Typecasting for the code simplication and time saving. Should be refactored.
  const whereRequest = query.where ? ` WHERE ${extractClause(query.where as WhereClause, fields, false)}` : "";

  switch (dialect) {
    case Dialect.Postgres:
    case Dialect.MySQL:
      return `SELECT * FROM data${whereRequest}${limitRequest};`;
    case Dialect.SQLServer:
      return `SELECT${limitRequest} * FROM data${whereRequest};`;
  }
}

const testSQLGeneration = (generatedResult: string, expectedResult: string) => {
  if (generatedResult !== expectedResult) {
    console.error(`Failed to generate: '${expectedResult}'. The generated result is: '${generatedResult}'`);
    return;
  }

  return console.info(`Successfully generated: '${generatedResult}'`);
};

const fields: Fields = {
  1: "id",
  2: "name",
  3: "date_joined",
  4: "age",
};

testSQLGeneration(
  generateSql(Dialect.Postgres, fields, {
    where: [Operator.EQUAL, ["field", 2], "cam"],
  }),
  "SELECT * FROM data WHERE name = 'cam';"
);

testSQLGeneration(
  generateSql(Dialect.MySQL, fields, {
    where: [Operator.EQUAL, ["field", 2], "cam"],
    limit: 10,
  }),
  "SELECT * FROM data WHERE name = 'cam' LIMIT 10;"
);

testSQLGeneration(
  generateSql(Dialect.Postgres, fields, { limit: 20 }),
  "SELECT * FROM data LIMIT 20;"
);

testSQLGeneration(
  generateSql(Dialect.SQLServer, fields, { limit: 20 }),
  "SELECT TOP 20 * FROM data;"
);

testSQLGeneration(
  generateSql(Dialect.Postgres, fields, {
    where: [Operator.EQUAL, ["field", 3], null],
  }),
  "SELECT * FROM data WHERE date_joined IS NULL;"
);

testSQLGeneration(
  generateSql(Dialect.Postgres, fields, {
    where: [Operator.GREATER, ["field", 4], 35],
  }),
  "SELECT * FROM data WHERE age > 35;"
);

testSQLGeneration(
  generateSql(Dialect.Postgres, fields, {
    where: [
      Operator.AND,
      [Operator.LOWER, ["field", 1], 5],
      [Operator.EQUAL, ["field", 2], "joe"],
    ],
  }),
  "SELECT * FROM data WHERE id < 5 AND name = 'joe';"
);

testSQLGeneration(
  generateSql(Dialect.Postgres, fields, {
    where: [
      Operator.OR,
      [Operator.NOT_EQUAL, ["field", 3], "2015-11-01"],
      [Operator.EQUAL, ["field", 1], 456],
    ],
  }),
  "SELECT * FROM data WHERE date_joined <> '2015-11-01' OR id = 456;"
);

testSQLGeneration(
  generateSql(Dialect.Postgres, fields, {
    where: [
      Operator.AND,
      [Operator.NOT_EQUAL, ["field", 3], null],
      [
        Operator.OR,
        [Operator.GREATER, ["field", 4], 25],
        [Operator.EQUAL, ["field", 2], "Jerry"],
      ],
    ],
  }),
  "SELECT * FROM data WHERE date_joined IS NOT NULL AND (age > 25 OR name = 'Jerry');"
);

testSQLGeneration(
  generateSql(Dialect.Postgres, fields, {
    where: [Operator.EQUAL, ["field", 4], 25, 26, 27],
  }),
  "SELECT * FROM data WHERE age IN (25, 26, 27);"
);

testSQLGeneration(
  generateSql(Dialect.Postgres, fields, {
    where: [Operator.EQUAL, ["field", 2], "cam"],
  }),
  "SELECT * FROM data WHERE name = 'cam';"
);

testSQLGeneration(
  generateSql(Dialect.MySQL, fields, {
    where: [Operator.EQUAL, ["field", 2], "cam"],
    limit: 10,
  }),
  "SELECT * FROM data WHERE name = 'cam' LIMIT 10;"
);

testSQLGeneration(
  generateSql(Dialect.Postgres, fields, { limit: 20 }),
  "SELECT * FROM data LIMIT 20;"
);

testSQLGeneration(
  generateSql(Dialect.SQLServer, fields, { limit: 20 }),
  "SELECT TOP 20 * FROM data;"
);

testSQLGeneration(
  generateSql(Dialect.Postgres, fields, {
    where: [Operator.AND, [Operator.LOWER, ["field", 1], 5], ["macro", "is_joe"]],
  }),
  "SELECT * FROM data WHERE id < 5 AND name = 'joe';"
);

testSQLGeneration(
  generateSql(Dialect.Postgres, fields, {
    where: [Operator.AND, [Operator.LOWER, ["field", 1], 5], ["macro", "is__old_joe"]],
  }),
  "SELECT * FROM data WHERE id < 5 AND name = 'joe' AND age > 18;"
);
