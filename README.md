
# Snapshot build of @angular-devkit/core

This repository is a snapshot of a commit on the original repository. The original code used to
generate this is located at http://github.com/angular/angular-cli.

We do not accept PRs or Issues opened on this repository. You should not use this over a tested and
released version of this package.

To test this snapshot in your own project, use

```bash
npm install github.com/angular/angular-devkit-core-builds
```

----
# Core
> Shared utilities for Angular DevKit.

# Exception

# Json

## Schema

### SchemaValidatorResult
```
export interface SchemaValidatorResult {
  success: boolean;
  errors?: string[];
}
```

### SchemaValidator

```
export interface SchemaValidator {
  (data: any): Observable<SchemaValidatorResult>;
}
```

### SchemaFormatter

```
export interface SchemaFormatter {
  readonly async: boolean;
  validate(data: any): boolean | Observable<boolean>;
}
```

### SchemaRegistry

```
export interface SchemaRegistry {
  compile(schema: Object): Observable<SchemaValidator>;
  addFormat(name: string, formatter: SchemaFormatter): void;
}
```

### CoreSchemaRegistry

`SchemaRegistry` implementation using https://github.com/epoberezkin/ajv.
Constructor accepts object containing `SchemaFormatter` that will be added automatically.

```
export class CoreSchemaRegistry implements SchemaRegistry {
  constructor(formats: { [name: string]: SchemaFormatter} = {}) {}
}
```

# Logger

# Utils

# Virtual FS