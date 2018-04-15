"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const ajv = require("ajv");
const http = require("http");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const exception_1 = require("../../exception/exception");
const utils_1 = require("../../utils");
const transforms_1 = require("./transforms");
const visitor_1 = require("./visitor");
class SchemaValidationException extends exception_1.BaseException {
    constructor(errors, baseMessage = 'Schema validation failed with the following errors:') {
        if (!errors || errors.length === 0) {
            super('Schema validation failed.');
            return;
        }
        const messages = SchemaValidationException.createMessages(errors);
        super(`${baseMessage}\n  ${messages.join('\n  ')}`);
        this.errors = errors;
    }
    static createMessages(errors) {
        if (!errors || errors.length === 0) {
            return [];
        }
        const messages = errors.map((err) => {
            let message = `Data path ${JSON.stringify(err.dataPath)} ${err.message}`;
            if (err.keyword === 'additionalProperties') {
                message += `(${err.params.additionalProperty})`;
            }
            return message + '.';
        });
        return messages;
    }
}
exports.SchemaValidationException = SchemaValidationException;
class CoreSchemaRegistry {
    constructor(formats = []) {
        /**
         * Build an AJV instance that will be used to validate schemas.
         */
        this._uriCache = new Map();
        this._pre = new utils_1.PartiallyOrderedSet();
        this._post = new utils_1.PartiallyOrderedSet();
        this._smartDefaultKeyword = false;
        this._sourceMap = new Map();
        this._smartDefaultRecord = new Map();
        const formatsObj = {};
        for (const format of formats) {
            formatsObj[format.name] = format.formatter;
        }
        this._ajv = ajv({
            useDefaults: true,
            formats: formatsObj,
            loadSchema: (uri) => this._fetch(uri),
            schemaId: 'auto',
        });
        this._ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-04.json'));
        this.addPostTransform(transforms_1.addUndefinedDefaults);
    }
    _fetch(uri) {
        const maybeSchema = this._uriCache.get(uri);
        if (maybeSchema) {
            return Promise.resolve(maybeSchema);
        }
        return new Promise((resolve, reject) => {
            http.get(uri, res => {
                if (!res.statusCode || res.statusCode >= 300) {
                    // Consume the rest of the data to free memory.
                    res.resume();
                    reject(`Request failed. Status Code: ${res.statusCode}`);
                }
                else {
                    res.setEncoding('utf8');
                    let data = '';
                    res.on('data', chunk => {
                        data += chunk;
                    });
                    res.on('end', () => {
                        try {
                            const json = JSON.parse(data);
                            this._uriCache.set(uri, json);
                            resolve(json);
                        }
                        catch (err) {
                            reject(err);
                        }
                    });
                }
            });
        });
    }
    /**
     * Add a transformation step before the validation of any Json.
     * @param {JsonVisitor} visitor The visitor to transform every value.
     * @param {JsonVisitor[]} deps A list of other visitors to run before.
     */
    addPreTransform(visitor, deps) {
        this._pre.add(visitor, deps);
    }
    /**
     * Add a transformation step after the validation of any Json. The JSON will not be validated
     * after the POST, so if transformations are not compatible with the Schema it will not result
     * in an error.
     * @param {JsonVisitor} visitor The visitor to transform every value.
     * @param {JsonVisitor[]} deps A list of other visitors to run before.
     */
    addPostTransform(visitor, deps) {
        this._post.add(visitor, deps);
    }
    _resolver(ref, validate) {
        if (!validate) {
            return {};
        }
        const refHash = ref.split('#', 2)[1];
        const refUrl = ref.startsWith('#') ? ref : ref.split('#', 1);
        if (!ref.startsWith('#')) {
            // tslint:disable-next-line:no-any
            validate = validate.refVal[validate.refs[refUrl[0]]];
        }
        if (validate && refHash) {
            // tslint:disable-next-line:no-any
            validate = validate.refVal[validate.refs['#' + refHash]];
        }
        return { context: validate, schema: validate && validate.schema };
    }
    compile(schema) {
        // Supports both synchronous and asynchronous compilation, by trying the synchronous
        // version first, then if refs are missing this will fails.
        // We also add any refs from external fetched schemas so that those will also be used
        // in synchronous (if available).
        let validator;
        try {
            const maybeFnValidate = this._ajv.compile(Object.assign({ $async: this._smartDefaultKeyword ? true : undefined }, schema));
            validator = rxjs_1.of(maybeFnValidate);
        }
        catch (e) {
            // Propagate the error.
            if (!(e instanceof ajv.MissingRefError)) {
                throw e;
            }
            validator = new rxjs_1.Observable(obs => {
                this._ajv.compileAsync(schema)
                    .then(validate => {
                    obs.next(validate);
                    obs.complete();
                }, err => {
                    obs.error(err);
                });
            });
        }
        return validator
            .pipe(operators_1.map(validate => (data) => {
            return rxjs_1.of(data).pipe(...[...this._pre].map(visitor => operators_1.concatMap((data) => {
                return visitor_1.visitJson(data, visitor, schema, this._resolver, validate);
            }))).pipe(operators_1.switchMap(updatedData => {
                const result = validate(updatedData);
                return typeof result == 'boolean'
                    ? rxjs_1.of([updatedData, result])
                    : rxjs_1.from(result
                        .then(r => [updatedData, true])
                        .catch((err) => {
                        if (err.ajv) {
                            validate.errors = err.errors;
                            return Promise.resolve([updatedData, false]);
                        }
                        return Promise.reject(err);
                    }));
            }), operators_1.switchMap(([data, valid]) => {
                if (valid) {
                    return this._applySmartDefaults(data).pipe(...[...this._post].map(visitor => operators_1.concatMap(data => {
                        return visitor_1.visitJson(data, visitor, schema, this._resolver, validate);
                    }))).pipe(operators_1.map(data => [data, valid]));
                }
                else {
                    return rxjs_1.of([data, valid]);
                }
            }), operators_1.map(([data, valid]) => {
                if (valid) {
                    return { data, success: true };
                }
                return {
                    data,
                    success: false,
                    errors: (validate.errors || []),
                };
            }));
        }));
    }
    addFormat(format) {
        // tslint:disable-next-line:no-any
        const validate = (data) => {
            const result = format.formatter.validate(data);
            if (typeof result == 'boolean') {
                return result;
            }
            else {
                return result.toPromise();
            }
        };
        this._ajv.addFormat(format.name, {
            async: format.formatter.async,
            validate,
        });
    }
    addSmartDefaultProvider(source, provider) {
        if (this._sourceMap.has(source)) {
            throw new Error(source);
        }
        this._sourceMap.set(source, provider);
        if (!this._smartDefaultKeyword) {
            this._smartDefaultKeyword = true;
            this._ajv.addKeyword('$default', {
                modifying: true,
                async: true,
                compile: (schema, _parentSchema, it) => {
                    const source = this._sourceMap.get(schema.$source);
                    if (!source) {
                        throw new Error(`Invalid source: ${JSON.stringify(source)}.`);
                    }
                    // We cheat, heavily.
                    this._smartDefaultRecord.set(
                    // tslint:disable-next-line:no-any
                    JSON.stringify(it.dataPathArr.slice(1, it.dataLevel + 1)), schema);
                    return function () {
                        return Promise.resolve(true);
                    };
                },
            });
        }
    }
    // tslint:disable-next-line:no-any
    _applySmartDefaults(data) {
        function _set(
        // tslint:disable-next-line:no-any
        data, fragments, value, 
        // tslint:disable-next-line:no-any
        parent = null, parentProperty) {
            for (let i = 0; i < fragments.length; i++) {
                const f = fragments[i];
                if (f[0] == 'i') {
                    if (!Array.isArray(data)) {
                        return;
                    }
                    for (let j = 0; j < data.length; j++) {
                        _set(data[j], fragments.slice(i + 1), value, data, '' + j);
                    }
                    return;
                }
                else if (f.startsWith('key')) {
                    if (typeof data !== 'object') {
                        return;
                    }
                    Object.getOwnPropertyNames(data).forEach(property => {
                        _set(data[property], fragments.slice(i + 1), value, data, property);
                    });
                    return;
                }
                else if (f.startsWith('\'') && f[f.length - 1] == '\'') {
                    const property = f
                        .slice(1, -1)
                        .replace(/\\'/g, '\'')
                        .replace(/\\n/g, '\n')
                        .replace(/\\r/g, '\r')
                        .replace(/\\f/g, '\f')
                        .replace(/\\t/g, '\t');
                    // We know we need an object because the fragment is a property key.
                    if (!data && parent !== null && parentProperty) {
                        data = parent[parentProperty] = {};
                    }
                    parent = data;
                    parentProperty = property;
                    data = data[property];
                }
                else {
                    return;
                }
            }
            if (parent && parentProperty && parent[parentProperty] === undefined) {
                parent[parentProperty] = value;
            }
        }
        return rxjs_1.of(data).pipe(...[...this._smartDefaultRecord.entries()].map(([pointer, schema]) => {
            return operators_1.concatMap(data => {
                const fragments = JSON.parse(pointer);
                const source = this._sourceMap.get(schema.$source);
                if (!source) {
                    throw new Error('Invalid source.');
                }
                let value = source(schema);
                if (!utils_1.isObservable(value)) {
                    value = rxjs_1.of(value);
                }
                return value.pipe(
                // Synchronously set the new data at the proper JsonSchema path.
                operators_1.tap(x => _set(data, fragments, x)), 
                // But return the data object.
                operators_1.map(() => data));
            });
        }));
    }
}
exports.CoreSchemaRegistry = CoreSchemaRegistry;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVnaXN0cnkuanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2NvcmUvc3JjL2pzb24vc2NoZW1hL3JlZ2lzdHJ5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUE7Ozs7OztHQU1HO0FBQ0gsMkJBQTJCO0FBQzNCLDZCQUE2QjtBQUM3QiwrQkFBNEQ7QUFDNUQsOENBQWdFO0FBQ2hFLHlEQUEwRDtBQUMxRCx1Q0FBZ0U7QUFXaEUsNkNBQW9EO0FBQ3BELHVDQUFtRDtBQVduRCwrQkFBdUMsU0FBUSx5QkFBYTtJQUcxRCxZQUNFLE1BQStCLEVBQy9CLFdBQVcsR0FBRyxxREFBcUQ7UUFFbkUsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLElBQUksTUFBTSxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ25DLEtBQUssQ0FBQywyQkFBMkIsQ0FBQyxDQUFDO1lBRW5DLE1BQU0sQ0FBQztRQUNULENBQUM7UUFFRCxNQUFNLFFBQVEsR0FBRyx5QkFBeUIsQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDbEUsS0FBSyxDQUFDLEdBQUcsV0FBVyxPQUFPLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ3BELElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO0lBQ3ZCLENBQUM7SUFFTSxNQUFNLENBQUMsY0FBYyxDQUFDLE1BQStCO1FBQzFELEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxJQUFJLE1BQU0sQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNuQyxNQUFNLENBQUMsRUFBRSxDQUFDO1FBQ1osQ0FBQztRQUVELE1BQU0sUUFBUSxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRTtZQUNsQyxJQUFJLE9BQU8sR0FBRyxhQUFhLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUN6RSxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxLQUFLLHNCQUFzQixDQUFDLENBQUMsQ0FBQztnQkFDM0MsT0FBTyxJQUFJLElBQUksR0FBRyxDQUFDLE1BQU0sQ0FBQyxrQkFBa0IsR0FBRyxDQUFDO1lBQ2xELENBQUM7WUFFRCxNQUFNLENBQUMsT0FBTyxHQUFHLEdBQUcsQ0FBQztRQUN2QixDQUFDLENBQUMsQ0FBQztRQUVILE1BQU0sQ0FBQyxRQUFRLENBQUM7SUFDbEIsQ0FBQztDQUNGO0FBbENELDhEQWtDQztBQUVEO0lBVUUsWUFBWSxVQUEwQixFQUFFO1FBQ3RDOztXQUVHO1FBWEcsY0FBUyxHQUFHLElBQUksR0FBRyxFQUFzQixDQUFDO1FBQzFDLFNBQUksR0FBRyxJQUFJLDJCQUFtQixFQUFlLENBQUM7UUFDOUMsVUFBSyxHQUFHLElBQUksMkJBQW1CLEVBQWUsQ0FBQztRQUUvQyx5QkFBb0IsR0FBRyxLQUFLLENBQUM7UUFDN0IsZUFBVSxHQUFHLElBQUksR0FBRyxFQUFvQyxDQUFDO1FBQ3pELHdCQUFtQixHQUFHLElBQUksR0FBRyxFQUFzQixDQUFDO1FBTzFELE1BQU0sVUFBVSxHQUF3QyxFQUFFLENBQUM7UUFFM0QsR0FBRyxDQUFDLENBQUMsTUFBTSxNQUFNLElBQUksT0FBTyxDQUFDLENBQUMsQ0FBQztZQUM3QixVQUFVLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLE1BQU0sQ0FBQyxTQUFTLENBQUM7UUFDN0MsQ0FBQztRQUVELElBQUksQ0FBQyxJQUFJLEdBQUcsR0FBRyxDQUFDO1lBQ2QsV0FBVyxFQUFFLElBQUk7WUFDakIsT0FBTyxFQUFFLFVBQVU7WUFDbkIsVUFBVSxFQUFFLENBQUMsR0FBVyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQztZQUM3QyxRQUFRLEVBQUUsTUFBTTtTQUNqQixDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsd0NBQXdDLENBQUMsQ0FBQyxDQUFDO1FBRTNFLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxpQ0FBb0IsQ0FBQyxDQUFDO0lBQzlDLENBQUM7SUFFTyxNQUFNLENBQUMsR0FBVztRQUN4QixNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUU1QyxFQUFFLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO1lBQ2hCLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQ3RDLENBQUM7UUFFRCxNQUFNLENBQUMsSUFBSSxPQUFPLENBQWEsQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUU7WUFDakQsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLEVBQUU7Z0JBQ2xCLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFVBQVUsSUFBSSxHQUFHLENBQUMsVUFBVSxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUM7b0JBQzdDLCtDQUErQztvQkFDL0MsR0FBRyxDQUFDLE1BQU0sRUFBRSxDQUFDO29CQUNiLE1BQU0sQ0FBQyxnQ0FBZ0MsR0FBRyxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUM7Z0JBQzNELENBQUM7Z0JBQUMsSUFBSSxDQUFDLENBQUM7b0JBQ04sR0FBRyxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQztvQkFDeEIsSUFBSSxJQUFJLEdBQUcsRUFBRSxDQUFDO29CQUNkLEdBQUcsQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxFQUFFO3dCQUNyQixJQUFJLElBQUksS0FBSyxDQUFDO29CQUNoQixDQUFDLENBQUMsQ0FBQztvQkFDSCxHQUFHLENBQUMsRUFBRSxDQUFDLEtBQUssRUFBRSxHQUFHLEVBQUU7d0JBQ2pCLElBQUksQ0FBQzs0QkFDSCxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDOzRCQUM5QixJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUM7NEJBQzlCLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQzt3QkFDaEIsQ0FBQzt3QkFBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDOzRCQUNiLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQzt3QkFDZCxDQUFDO29CQUNILENBQUMsQ0FBQyxDQUFDO2dCQUNMLENBQUM7WUFDSCxDQUFDLENBQUMsQ0FBQztRQUNMLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVEOzs7O09BSUc7SUFDSCxlQUFlLENBQUMsT0FBb0IsRUFBRSxJQUFvQjtRQUN4RCxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDL0IsQ0FBQztJQUVEOzs7Ozs7T0FNRztJQUNILGdCQUFnQixDQUFDLE9BQW9CLEVBQUUsSUFBb0I7UUFDekQsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ2hDLENBQUM7SUFFUyxTQUFTLENBQ2pCLEdBQVcsRUFDWCxRQUE4QjtRQUU5QixFQUFFLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7WUFDZCxNQUFNLENBQUMsRUFBRSxDQUFDO1FBQ1osQ0FBQztRQUVELE1BQU0sT0FBTyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3JDLE1BQU0sTUFBTSxHQUFHLEdBQUcsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFFN0QsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN6QixrQ0FBa0M7WUFDbEMsUUFBUSxHQUFJLFFBQVEsQ0FBQyxNQUFjLENBQUUsUUFBUSxDQUFDLElBQVksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3pFLENBQUM7UUFDRCxFQUFFLENBQUMsQ0FBQyxRQUFRLElBQUksT0FBTyxDQUFDLENBQUMsQ0FBQztZQUN4QixrQ0FBa0M7WUFDbEMsUUFBUSxHQUFJLFFBQVEsQ0FBQyxNQUFjLENBQUUsUUFBUSxDQUFDLElBQVksQ0FBQyxHQUFHLEdBQUcsT0FBTyxDQUFDLENBQUMsQ0FBQztRQUM3RSxDQUFDO1FBRUQsTUFBTSxDQUFDLEVBQUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsUUFBUSxJQUFJLFFBQVEsQ0FBQyxNQUFvQixFQUFFLENBQUM7SUFDbEYsQ0FBQztJQUVELE9BQU8sQ0FBQyxNQUFrQjtRQUN4QixvRkFBb0Y7UUFDcEYsMkRBQTJEO1FBQzNELHFGQUFxRjtRQUNyRixpQ0FBaUM7UUFDakMsSUFBSSxTQUEyQyxDQUFDO1FBQ2hELElBQUksQ0FBQztZQUNILE1BQU0sZUFBZSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxpQkFDdkMsTUFBTSxFQUFFLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxTQUFTLElBQ2pELE1BQU0sRUFDVCxDQUFDO1lBQ0gsU0FBUyxHQUFHLFNBQVksQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUM1QyxDQUFDO1FBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNYLHVCQUF1QjtZQUN2QixFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFhLEdBQUcsQ0FBQyxlQUFrQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUM1RCxNQUFNLENBQUMsQ0FBQztZQUNWLENBQUM7WUFFRCxTQUFTLEdBQUcsSUFBSSxpQkFBVSxDQUFDLEdBQUcsQ0FBQyxFQUFFO2dCQUMvQixJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUM7cUJBQzNCLElBQUksQ0FBQyxRQUFRLENBQUMsRUFBRTtvQkFDZixHQUFHLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO29CQUNuQixHQUFHLENBQUMsUUFBUSxFQUFFLENBQUM7Z0JBQ2pCLENBQUMsRUFBRSxHQUFHLENBQUMsRUFBRTtvQkFDUCxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUNqQixDQUFDLENBQUMsQ0FBQztZQUNQLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUVELE1BQU0sQ0FBQyxTQUFTO2FBQ2IsSUFBSSxDQUNILGVBQUcsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBZSxFQUFxQyxFQUFFO1lBQ3JFLE1BQU0sQ0FBQyxTQUFZLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUM1QixHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMscUJBQVMsQ0FBQyxDQUFDLElBQWUsRUFBRSxFQUFFO2dCQUM3RCxNQUFNLENBQUMsbUJBQVMsQ0FBQyxJQUFJLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxJQUFJLENBQUMsU0FBUyxFQUFFLFFBQVEsQ0FBQyxDQUFDO1lBQ3BFLENBQUMsQ0FBQyxDQUFDLENBQ0osQ0FBQyxJQUFJLENBQ0oscUJBQVMsQ0FBQyxXQUFXLENBQUMsRUFBRTtnQkFDdEIsTUFBTSxNQUFNLEdBQUcsUUFBUSxDQUFDLFdBQVcsQ0FBQyxDQUFDO2dCQUVyQyxNQUFNLENBQUMsT0FBTyxNQUFNLElBQUksU0FBUztvQkFDL0IsQ0FBQyxDQUFDLFNBQVksQ0FBQyxDQUFDLFdBQVcsRUFBRSxNQUFNLENBQUMsQ0FBQztvQkFDckMsQ0FBQyxDQUFDLFdBQUksQ0FBRSxNQUEyQjt5QkFDaEMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLENBQUM7eUJBQzlCLEtBQUssQ0FBQyxDQUFDLEdBQStCLEVBQUUsRUFBRTt3QkFDekMsRUFBRSxDQUFDLENBQUUsR0FBMEIsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDOzRCQUNwQyxRQUFRLENBQUMsTUFBTSxHQUFJLEdBQTBCLENBQUMsTUFBTSxDQUFDOzRCQUVyRCxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDLFdBQVcsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDO3dCQUMvQyxDQUFDO3dCQUVELE1BQU0sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO29CQUM3QixDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ1YsQ0FBQyxDQUFDLEVBQ0YscUJBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxFQUFFLEVBQUU7Z0JBQzFCLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7b0JBQ1YsTUFBTSxDQUFDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQ3hDLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxxQkFBUyxDQUFDLElBQUksQ0FBQyxFQUFFO3dCQUNqRCxNQUFNLENBQUMsbUJBQVMsQ0FBQyxJQUFpQixFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsSUFBSSxDQUFDLFNBQVMsRUFBRSxRQUFRLENBQUMsQ0FBQztvQkFDakYsQ0FBQyxDQUFDLENBQUMsQ0FDSixDQUFDLElBQUksQ0FDSixlQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUMzQixDQUFDO2dCQUNKLENBQUM7Z0JBQUMsSUFBSSxDQUFDLENBQUM7b0JBQ04sTUFBTSxDQUFDLFNBQVksQ0FBQyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDO2dCQUNyQyxDQUFDO1lBQ0gsQ0FBQyxDQUFDLEVBQ0YsZUFBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLEVBQUUsRUFBRTtnQkFDcEIsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztvQkFDVixNQUFNLENBQUMsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBMkIsQ0FBQztnQkFDMUQsQ0FBQztnQkFFRCxNQUFNLENBQUM7b0JBQ0wsSUFBSTtvQkFDSixPQUFPLEVBQUUsS0FBSztvQkFDZCxNQUFNLEVBQUUsQ0FBQyxRQUFRLENBQUMsTUFBTSxJQUFJLEVBQUUsQ0FBQztpQkFDUCxDQUFDO1lBQzdCLENBQUMsQ0FBQyxDQUNILENBQUM7UUFDSixDQUFDLENBQUMsQ0FDSCxDQUFDO0lBQ04sQ0FBQztJQUVELFNBQVMsQ0FBQyxNQUFvQjtRQUM1QixrQ0FBa0M7UUFDbEMsTUFBTSxRQUFRLEdBQUcsQ0FBQyxJQUFTLEVBQUUsRUFBRTtZQUM3QixNQUFNLE1BQU0sR0FBRyxNQUFNLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUUvQyxFQUFFLENBQUMsQ0FBQyxPQUFPLE1BQU0sSUFBSSxTQUFTLENBQUMsQ0FBQyxDQUFDO2dCQUMvQixNQUFNLENBQUMsTUFBTSxDQUFDO1lBQ2hCLENBQUM7WUFBQyxJQUFJLENBQUMsQ0FBQztnQkFDTixNQUFNLENBQUMsTUFBTSxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQzVCLENBQUM7UUFDSCxDQUFDLENBQUM7UUFFRixJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFO1lBQy9CLEtBQUssRUFBRSxNQUFNLENBQUMsU0FBUyxDQUFDLEtBQUs7WUFDN0IsUUFBUTtTQUdGLENBQUMsQ0FBQztJQUNaLENBQUM7SUFFRCx1QkFBdUIsQ0FBSSxNQUFjLEVBQUUsUUFBaUM7UUFDMUUsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2hDLE1BQU0sSUFBSSxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDMUIsQ0FBQztRQUVELElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxRQUFRLENBQUMsQ0FBQztRQUV0QyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUM7WUFDL0IsSUFBSSxDQUFDLG9CQUFvQixHQUFHLElBQUksQ0FBQztZQUVqQyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxVQUFVLEVBQUU7Z0JBQy9CLFNBQVMsRUFBRSxJQUFJO2dCQUNmLEtBQUssRUFBRSxJQUFJO2dCQUNYLE9BQU8sRUFBRSxDQUFDLE1BQU0sRUFBRSxhQUFhLEVBQUUsRUFBRSxFQUFFLEVBQUU7b0JBQ3JDLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFFLE1BQXFCLENBQUMsT0FBaUIsQ0FBQyxDQUFDO29CQUU3RSxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7d0JBQ1osTUFBTSxJQUFJLEtBQUssQ0FBQyxtQkFBbUIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7b0JBQ2hFLENBQUM7b0JBRUQscUJBQXFCO29CQUNyQixJQUFJLENBQUMsbUJBQW1CLENBQUMsR0FBRztvQkFDMUIsa0NBQWtDO29CQUNsQyxJQUFJLENBQUMsU0FBUyxDQUFFLEVBQVUsQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRyxFQUFVLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBYSxDQUFDLEVBQ3ZGLE1BQU0sQ0FDUCxDQUFDO29CQUVGLE1BQU0sQ0FBQzt3QkFDTCxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztvQkFDL0IsQ0FBQyxDQUFDO2dCQUNKLENBQUM7YUFDRixDQUFDLENBQUM7UUFDTCxDQUFDO0lBQ0gsQ0FBQztJQUVELGtDQUFrQztJQUMxQixtQkFBbUIsQ0FBQyxJQUFTO1FBQ25DO1FBQ0Usa0NBQWtDO1FBQ2xDLElBQVMsRUFDVCxTQUFtQixFQUNuQixLQUFTO1FBQ1Qsa0NBQWtDO1FBQ2xDLFNBQXFCLElBQUksRUFDekIsY0FBdUI7WUFFdkIsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxTQUFTLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7Z0JBQzFDLE1BQU0sQ0FBQyxHQUFHLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFFdkIsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUM7b0JBQ2hCLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7d0JBQ3pCLE1BQU0sQ0FBQztvQkFDVCxDQUFDO29CQUVELEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO3dCQUNyQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO29CQUM3RCxDQUFDO29CQUVELE1BQU0sQ0FBQztnQkFDVCxDQUFDO2dCQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDL0IsRUFBRSxDQUFDLENBQUMsT0FBTyxJQUFJLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQzt3QkFDN0IsTUFBTSxDQUFDO29CQUNULENBQUM7b0JBRUQsTUFBTSxDQUFDLG1CQUFtQixDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsRUFBRTt3QkFDbEQsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsRUFBRSxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDO29CQUN0RSxDQUFDLENBQUMsQ0FBQztvQkFFSCxNQUFNLENBQUM7Z0JBQ1QsQ0FBQztnQkFBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDO29CQUN6RCxNQUFNLFFBQVEsR0FBRyxDQUFDO3lCQUNmLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7eUJBQ1osT0FBTyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUM7eUJBQ3JCLE9BQU8sQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDO3lCQUNyQixPQUFPLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQzt5QkFDckIsT0FBTyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUM7eUJBQ3JCLE9BQU8sQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7b0JBRXpCLG9FQUFvRTtvQkFDcEUsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksTUFBTSxLQUFLLElBQUksSUFBSSxjQUFjLENBQUMsQ0FBQyxDQUFDO3dCQUMvQyxJQUFJLEdBQUcsTUFBTSxDQUFDLGNBQWMsQ0FBQyxHQUFHLEVBQUUsQ0FBQztvQkFDckMsQ0FBQztvQkFDRCxNQUFNLEdBQUcsSUFBSSxDQUFDO29CQUNkLGNBQWMsR0FBRyxRQUFRLENBQUM7b0JBRTFCLElBQUksR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBQ3hCLENBQUM7Z0JBQUMsSUFBSSxDQUFDLENBQUM7b0JBQ04sTUFBTSxDQUFDO2dCQUNULENBQUM7WUFDSCxDQUFDO1lBRUQsRUFBRSxDQUFDLENBQUMsTUFBTSxJQUFJLGNBQWMsSUFBSSxNQUFNLENBQUMsY0FBYyxDQUFDLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQztnQkFDckUsTUFBTSxDQUFDLGNBQWMsQ0FBQyxHQUFHLEtBQUssQ0FBQztZQUNqQyxDQUFDO1FBQ0gsQ0FBQztRQUVELE1BQU0sQ0FBQyxTQUFZLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUM1QixHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsbUJBQW1CLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLE9BQU8sRUFBRSxNQUFNLENBQUMsRUFBRSxFQUFFO1lBQ25FLE1BQU0sQ0FBQyxxQkFBUyxDQUFDLElBQUksQ0FBQyxFQUFFO2dCQUN0QixNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUN0QyxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBRSxNQUFxQixDQUFDLE9BQWlCLENBQUMsQ0FBQztnQkFFN0UsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO29CQUNaLE1BQU0sSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUMsQ0FBQztnQkFDckMsQ0FBQztnQkFFRCxJQUFJLEtBQUssR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBQzNCLEVBQUUsQ0FBQyxDQUFDLENBQUMsb0JBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQ3pCLEtBQUssR0FBRyxTQUFZLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQzlCLENBQUM7Z0JBRUQsTUFBTSxDQUFFLEtBQXdCLENBQUMsSUFBSTtnQkFDbkMsZ0VBQWdFO2dCQUNoRSxlQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDbEMsOEJBQThCO2dCQUM5QixlQUFHLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQ2hCLENBQUM7WUFDSixDQUFDLENBQUMsQ0FBQztRQUNMLENBQUMsQ0FBQyxDQUNILENBQUM7SUFDSixDQUFDO0NBQ0Y7QUE3VUQsZ0RBNlVDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0ICogYXMgYWp2IGZyb20gJ2Fqdic7XG5pbXBvcnQgKiBhcyBodHRwIGZyb20gJ2h0dHAnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZSwgZnJvbSwgb2YgYXMgb2JzZXJ2YWJsZU9mIH0gZnJvbSAncnhqcyc7XG5pbXBvcnQgeyBjb25jYXRNYXAsIG1hcCwgc3dpdGNoTWFwLCB0YXAgfSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XG5pbXBvcnQgeyBCYXNlRXhjZXB0aW9uIH0gZnJvbSAnLi4vLi4vZXhjZXB0aW9uL2V4Y2VwdGlvbic7XG5pbXBvcnQgeyBQYXJ0aWFsbHlPcmRlcmVkU2V0LCBpc09ic2VydmFibGUgfSBmcm9tICcuLi8uLi91dGlscyc7XG5pbXBvcnQgeyBKc29uT2JqZWN0LCBKc29uVmFsdWUgfSBmcm9tICcuLi9pbnRlcmZhY2UnO1xuaW1wb3J0IHtcbiAgU2NoZW1hRm9ybWF0LFxuICBTY2hlbWFGb3JtYXR0ZXIsXG4gIFNjaGVtYVJlZ2lzdHJ5LFxuICBTY2hlbWFWYWxpZGF0b3IsXG4gIFNjaGVtYVZhbGlkYXRvckVycm9yLFxuICBTY2hlbWFWYWxpZGF0b3JSZXN1bHQsXG4gIFNtYXJ0RGVmYXVsdFByb3ZpZGVyLFxufSBmcm9tICcuL2ludGVyZmFjZSc7XG5pbXBvcnQgeyBhZGRVbmRlZmluZWREZWZhdWx0cyB9IGZyb20gJy4vdHJhbnNmb3Jtcyc7XG5pbXBvcnQgeyBKc29uVmlzaXRvciwgdmlzaXRKc29uIH0gZnJvbSAnLi92aXNpdG9yJztcblxuXG4vLyBUaGlzIGludGVyZmFjZSBzaG91bGQgYmUgZXhwb3J0ZWQgZnJvbSBhanYsIGJ1dCB0aGV5IG9ubHkgZXhwb3J0IHRoZSBjbGFzcyBhbmQgbm90IHRoZSB0eXBlLlxuaW50ZXJmYWNlIEFqdlZhbGlkYXRpb25FcnJvciB7XG4gIG1lc3NhZ2U6IHN0cmluZztcbiAgZXJyb3JzOiBBcnJheTxhanYuRXJyb3JPYmplY3Q+O1xuICBhanY6IHRydWU7XG4gIHZhbGlkYXRpb246IHRydWU7XG59XG5cbmV4cG9ydCBjbGFzcyBTY2hlbWFWYWxpZGF0aW9uRXhjZXB0aW9uIGV4dGVuZHMgQmFzZUV4Y2VwdGlvbiB7XG4gIHB1YmxpYyByZWFkb25seSBlcnJvcnM6IFNjaGVtYVZhbGlkYXRvckVycm9yW107XG5cbiAgY29uc3RydWN0b3IoXG4gICAgZXJyb3JzPzogU2NoZW1hVmFsaWRhdG9yRXJyb3JbXSxcbiAgICBiYXNlTWVzc2FnZSA9ICdTY2hlbWEgdmFsaWRhdGlvbiBmYWlsZWQgd2l0aCB0aGUgZm9sbG93aW5nIGVycm9yczonLFxuICApIHtcbiAgICBpZiAoIWVycm9ycyB8fCBlcnJvcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICBzdXBlcignU2NoZW1hIHZhbGlkYXRpb24gZmFpbGVkLicpO1xuXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgbWVzc2FnZXMgPSBTY2hlbWFWYWxpZGF0aW9uRXhjZXB0aW9uLmNyZWF0ZU1lc3NhZ2VzKGVycm9ycyk7XG4gICAgc3VwZXIoYCR7YmFzZU1lc3NhZ2V9XFxuICAke21lc3NhZ2VzLmpvaW4oJ1xcbiAgJyl9YCk7XG4gICAgdGhpcy5lcnJvcnMgPSBlcnJvcnM7XG4gIH1cblxuICBwdWJsaWMgc3RhdGljIGNyZWF0ZU1lc3NhZ2VzKGVycm9ycz86IFNjaGVtYVZhbGlkYXRvckVycm9yW10pOiBzdHJpbmdbXSB7XG4gICAgaWYgKCFlcnJvcnMgfHwgZXJyb3JzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIGNvbnN0IG1lc3NhZ2VzID0gZXJyb3JzLm1hcCgoZXJyKSA9PiB7XG4gICAgICBsZXQgbWVzc2FnZSA9IGBEYXRhIHBhdGggJHtKU09OLnN0cmluZ2lmeShlcnIuZGF0YVBhdGgpfSAke2Vyci5tZXNzYWdlfWA7XG4gICAgICBpZiAoZXJyLmtleXdvcmQgPT09ICdhZGRpdGlvbmFsUHJvcGVydGllcycpIHtcbiAgICAgICAgbWVzc2FnZSArPSBgKCR7ZXJyLnBhcmFtcy5hZGRpdGlvbmFsUHJvcGVydHl9KWA7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBtZXNzYWdlICsgJy4nO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIG1lc3NhZ2VzO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBDb3JlU2NoZW1hUmVnaXN0cnkgaW1wbGVtZW50cyBTY2hlbWFSZWdpc3RyeSB7XG4gIHByaXZhdGUgX2FqdjogYWp2LkFqdjtcbiAgcHJpdmF0ZSBfdXJpQ2FjaGUgPSBuZXcgTWFwPHN0cmluZywgSnNvbk9iamVjdD4oKTtcbiAgcHJpdmF0ZSBfcHJlID0gbmV3IFBhcnRpYWxseU9yZGVyZWRTZXQ8SnNvblZpc2l0b3I+KCk7XG4gIHByaXZhdGUgX3Bvc3QgPSBuZXcgUGFydGlhbGx5T3JkZXJlZFNldDxKc29uVmlzaXRvcj4oKTtcblxuICBwcml2YXRlIF9zbWFydERlZmF1bHRLZXl3b3JkID0gZmFsc2U7XG4gIHByaXZhdGUgX3NvdXJjZU1hcCA9IG5ldyBNYXA8c3RyaW5nLCBTbWFydERlZmF1bHRQcm92aWRlcjx7fT4+KCk7XG4gIHByaXZhdGUgX3NtYXJ0RGVmYXVsdFJlY29yZCA9IG5ldyBNYXA8c3RyaW5nLCBKc29uT2JqZWN0PigpO1xuXG4gIGNvbnN0cnVjdG9yKGZvcm1hdHM6IFNjaGVtYUZvcm1hdFtdID0gW10pIHtcbiAgICAvKipcbiAgICAgKiBCdWlsZCBhbiBBSlYgaW5zdGFuY2UgdGhhdCB3aWxsIGJlIHVzZWQgdG8gdmFsaWRhdGUgc2NoZW1hcy5cbiAgICAgKi9cblxuICAgIGNvbnN0IGZvcm1hdHNPYmo6IHsgW25hbWU6IHN0cmluZ106IFNjaGVtYUZvcm1hdHRlciB9ID0ge307XG5cbiAgICBmb3IgKGNvbnN0IGZvcm1hdCBvZiBmb3JtYXRzKSB7XG4gICAgICBmb3JtYXRzT2JqW2Zvcm1hdC5uYW1lXSA9IGZvcm1hdC5mb3JtYXR0ZXI7XG4gICAgfVxuXG4gICAgdGhpcy5fYWp2ID0gYWp2KHtcbiAgICAgIHVzZURlZmF1bHRzOiB0cnVlLFxuICAgICAgZm9ybWF0czogZm9ybWF0c09iaixcbiAgICAgIGxvYWRTY2hlbWE6ICh1cmk6IHN0cmluZykgPT4gdGhpcy5fZmV0Y2godXJpKSxcbiAgICAgIHNjaGVtYUlkOiAnYXV0bycsXG4gICAgfSk7XG5cbiAgICB0aGlzLl9hanYuYWRkTWV0YVNjaGVtYShyZXF1aXJlKCdhanYvbGliL3JlZnMvanNvbi1zY2hlbWEtZHJhZnQtMDQuanNvbicpKTtcblxuICAgIHRoaXMuYWRkUG9zdFRyYW5zZm9ybShhZGRVbmRlZmluZWREZWZhdWx0cyk7XG4gIH1cblxuICBwcml2YXRlIF9mZXRjaCh1cmk6IHN0cmluZyk6IFByb21pc2U8SnNvbk9iamVjdD4ge1xuICAgIGNvbnN0IG1heWJlU2NoZW1hID0gdGhpcy5fdXJpQ2FjaGUuZ2V0KHVyaSk7XG5cbiAgICBpZiAobWF5YmVTY2hlbWEpIHtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUobWF5YmVTY2hlbWEpO1xuICAgIH1cblxuICAgIHJldHVybiBuZXcgUHJvbWlzZTxKc29uT2JqZWN0PigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBodHRwLmdldCh1cmksIHJlcyA9PiB7XG4gICAgICAgIGlmICghcmVzLnN0YXR1c0NvZGUgfHwgcmVzLnN0YXR1c0NvZGUgPj0gMzAwKSB7XG4gICAgICAgICAgLy8gQ29uc3VtZSB0aGUgcmVzdCBvZiB0aGUgZGF0YSB0byBmcmVlIG1lbW9yeS5cbiAgICAgICAgICByZXMucmVzdW1lKCk7XG4gICAgICAgICAgcmVqZWN0KGBSZXF1ZXN0IGZhaWxlZC4gU3RhdHVzIENvZGU6ICR7cmVzLnN0YXR1c0NvZGV9YCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVzLnNldEVuY29kaW5nKCd1dGY4Jyk7XG4gICAgICAgICAgbGV0IGRhdGEgPSAnJztcbiAgICAgICAgICByZXMub24oJ2RhdGEnLCBjaHVuayA9PiB7XG4gICAgICAgICAgICBkYXRhICs9IGNodW5rO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIHJlcy5vbignZW5kJywgKCkgPT4ge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgY29uc3QganNvbiA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICAgICAgICAgIHRoaXMuX3VyaUNhY2hlLnNldCh1cmksIGpzb24pO1xuICAgICAgICAgICAgICByZXNvbHZlKGpzb24pO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGQgYSB0cmFuc2Zvcm1hdGlvbiBzdGVwIGJlZm9yZSB0aGUgdmFsaWRhdGlvbiBvZiBhbnkgSnNvbi5cbiAgICogQHBhcmFtIHtKc29uVmlzaXRvcn0gdmlzaXRvciBUaGUgdmlzaXRvciB0byB0cmFuc2Zvcm0gZXZlcnkgdmFsdWUuXG4gICAqIEBwYXJhbSB7SnNvblZpc2l0b3JbXX0gZGVwcyBBIGxpc3Qgb2Ygb3RoZXIgdmlzaXRvcnMgdG8gcnVuIGJlZm9yZS5cbiAgICovXG4gIGFkZFByZVRyYW5zZm9ybSh2aXNpdG9yOiBKc29uVmlzaXRvciwgZGVwcz86IEpzb25WaXNpdG9yW10pIHtcbiAgICB0aGlzLl9wcmUuYWRkKHZpc2l0b3IsIGRlcHMpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZCBhIHRyYW5zZm9ybWF0aW9uIHN0ZXAgYWZ0ZXIgdGhlIHZhbGlkYXRpb24gb2YgYW55IEpzb24uIFRoZSBKU09OIHdpbGwgbm90IGJlIHZhbGlkYXRlZFxuICAgKiBhZnRlciB0aGUgUE9TVCwgc28gaWYgdHJhbnNmb3JtYXRpb25zIGFyZSBub3QgY29tcGF0aWJsZSB3aXRoIHRoZSBTY2hlbWEgaXQgd2lsbCBub3QgcmVzdWx0XG4gICAqIGluIGFuIGVycm9yLlxuICAgKiBAcGFyYW0ge0pzb25WaXNpdG9yfSB2aXNpdG9yIFRoZSB2aXNpdG9yIHRvIHRyYW5zZm9ybSBldmVyeSB2YWx1ZS5cbiAgICogQHBhcmFtIHtKc29uVmlzaXRvcltdfSBkZXBzIEEgbGlzdCBvZiBvdGhlciB2aXNpdG9ycyB0byBydW4gYmVmb3JlLlxuICAgKi9cbiAgYWRkUG9zdFRyYW5zZm9ybSh2aXNpdG9yOiBKc29uVmlzaXRvciwgZGVwcz86IEpzb25WaXNpdG9yW10pIHtcbiAgICB0aGlzLl9wb3N0LmFkZCh2aXNpdG9yLCBkZXBzKTtcbiAgfVxuXG4gIHByb3RlY3RlZCBfcmVzb2x2ZXIoXG4gICAgcmVmOiBzdHJpbmcsXG4gICAgdmFsaWRhdGU6IGFqdi5WYWxpZGF0ZUZ1bmN0aW9uLFxuICApOiB7IGNvbnRleHQ/OiBhanYuVmFsaWRhdGVGdW5jdGlvbiwgc2NoZW1hPzogSnNvbk9iamVjdCB9IHtcbiAgICBpZiAoIXZhbGlkYXRlKSB7XG4gICAgICByZXR1cm4ge307XG4gICAgfVxuXG4gICAgY29uc3QgcmVmSGFzaCA9IHJlZi5zcGxpdCgnIycsIDIpWzFdO1xuICAgIGNvbnN0IHJlZlVybCA9IHJlZi5zdGFydHNXaXRoKCcjJykgPyByZWYgOiByZWYuc3BsaXQoJyMnLCAxKTtcblxuICAgIGlmICghcmVmLnN0YXJ0c1dpdGgoJyMnKSkge1xuICAgICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWFueVxuICAgICAgdmFsaWRhdGUgPSAodmFsaWRhdGUucmVmVmFsIGFzIGFueSlbKHZhbGlkYXRlLnJlZnMgYXMgYW55KVtyZWZVcmxbMF1dXTtcbiAgICB9XG4gICAgaWYgKHZhbGlkYXRlICYmIHJlZkhhc2gpIHtcbiAgICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby1hbnlcbiAgICAgIHZhbGlkYXRlID0gKHZhbGlkYXRlLnJlZlZhbCBhcyBhbnkpWyh2YWxpZGF0ZS5yZWZzIGFzIGFueSlbJyMnICsgcmVmSGFzaF1dO1xuICAgIH1cblxuICAgIHJldHVybiB7IGNvbnRleHQ6IHZhbGlkYXRlLCBzY2hlbWE6IHZhbGlkYXRlICYmIHZhbGlkYXRlLnNjaGVtYSBhcyBKc29uT2JqZWN0IH07XG4gIH1cblxuICBjb21waWxlKHNjaGVtYTogSnNvbk9iamVjdCk6IE9ic2VydmFibGU8U2NoZW1hVmFsaWRhdG9yPiB7XG4gICAgLy8gU3VwcG9ydHMgYm90aCBzeW5jaHJvbm91cyBhbmQgYXN5bmNocm9ub3VzIGNvbXBpbGF0aW9uLCBieSB0cnlpbmcgdGhlIHN5bmNocm9ub3VzXG4gICAgLy8gdmVyc2lvbiBmaXJzdCwgdGhlbiBpZiByZWZzIGFyZSBtaXNzaW5nIHRoaXMgd2lsbCBmYWlscy5cbiAgICAvLyBXZSBhbHNvIGFkZCBhbnkgcmVmcyBmcm9tIGV4dGVybmFsIGZldGNoZWQgc2NoZW1hcyBzbyB0aGF0IHRob3NlIHdpbGwgYWxzbyBiZSB1c2VkXG4gICAgLy8gaW4gc3luY2hyb25vdXMgKGlmIGF2YWlsYWJsZSkuXG4gICAgbGV0IHZhbGlkYXRvcjogT2JzZXJ2YWJsZTxhanYuVmFsaWRhdGVGdW5jdGlvbj47XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IG1heWJlRm5WYWxpZGF0ZSA9IHRoaXMuX2Fqdi5jb21waWxlKHtcbiAgICAgICAgJGFzeW5jOiB0aGlzLl9zbWFydERlZmF1bHRLZXl3b3JkID8gdHJ1ZSA6IHVuZGVmaW5lZCxcbiAgICAgICAgLi4uc2NoZW1hLFxuICAgICAgfSk7XG4gICAgICB2YWxpZGF0b3IgPSBvYnNlcnZhYmxlT2YobWF5YmVGblZhbGlkYXRlKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAvLyBQcm9wYWdhdGUgdGhlIGVycm9yLlxuICAgICAgaWYgKCEoZSBpbnN0YW5jZW9mIChhanYuTWlzc2luZ1JlZkVycm9yIGFzIHt9IGFzIEZ1bmN0aW9uKSkpIHtcbiAgICAgICAgdGhyb3cgZTtcbiAgICAgIH1cblxuICAgICAgdmFsaWRhdG9yID0gbmV3IE9ic2VydmFibGUob2JzID0+IHtcbiAgICAgICAgdGhpcy5fYWp2LmNvbXBpbGVBc3luYyhzY2hlbWEpXG4gICAgICAgICAgLnRoZW4odmFsaWRhdGUgPT4ge1xuICAgICAgICAgICAgb2JzLm5leHQodmFsaWRhdGUpO1xuICAgICAgICAgICAgb2JzLmNvbXBsZXRlKCk7XG4gICAgICAgICAgfSwgZXJyID0+IHtcbiAgICAgICAgICAgIG9icy5lcnJvcihlcnIpO1xuICAgICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHZhbGlkYXRvclxuICAgICAgLnBpcGUoXG4gICAgICAgIG1hcCh2YWxpZGF0ZSA9PiAoZGF0YTogSnNvblZhbHVlKTogT2JzZXJ2YWJsZTxTY2hlbWFWYWxpZGF0b3JSZXN1bHQ+ID0+IHtcbiAgICAgICAgICByZXR1cm4gb2JzZXJ2YWJsZU9mKGRhdGEpLnBpcGUoXG4gICAgICAgICAgICAuLi5bLi4udGhpcy5fcHJlXS5tYXAodmlzaXRvciA9PiBjb25jYXRNYXAoKGRhdGE6IEpzb25WYWx1ZSkgPT4ge1xuICAgICAgICAgICAgICByZXR1cm4gdmlzaXRKc29uKGRhdGEsIHZpc2l0b3IsIHNjaGVtYSwgdGhpcy5fcmVzb2x2ZXIsIHZhbGlkYXRlKTtcbiAgICAgICAgICAgIH0pKSxcbiAgICAgICAgICApLnBpcGUoXG4gICAgICAgICAgICBzd2l0Y2hNYXAodXBkYXRlZERhdGEgPT4ge1xuICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSB2YWxpZGF0ZSh1cGRhdGVkRGF0YSk7XG5cbiAgICAgICAgICAgICAgcmV0dXJuIHR5cGVvZiByZXN1bHQgPT0gJ2Jvb2xlYW4nXG4gICAgICAgICAgICAgICAgPyBvYnNlcnZhYmxlT2YoW3VwZGF0ZWREYXRhLCByZXN1bHRdKVxuICAgICAgICAgICAgICAgIDogZnJvbSgocmVzdWx0IGFzIFByb21pc2U8Ym9vbGVhbj4pXG4gICAgICAgICAgICAgICAgICAudGhlbihyID0+IFt1cGRhdGVkRGF0YSwgdHJ1ZV0pXG4gICAgICAgICAgICAgICAgICAuY2F0Y2goKGVycjogRXJyb3IgfCBBanZWYWxpZGF0aW9uRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKChlcnIgYXMgQWp2VmFsaWRhdGlvbkVycm9yKS5hanYpIHtcbiAgICAgICAgICAgICAgICAgICAgICB2YWxpZGF0ZS5lcnJvcnMgPSAoZXJyIGFzIEFqdlZhbGlkYXRpb25FcnJvcikuZXJyb3JzO1xuXG4gICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShbdXBkYXRlZERhdGEsIGZhbHNlXSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgc3dpdGNoTWFwKChbZGF0YSwgdmFsaWRdKSA9PiB7XG4gICAgICAgICAgICAgIGlmICh2YWxpZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9hcHBseVNtYXJ0RGVmYXVsdHMoZGF0YSkucGlwZShcbiAgICAgICAgICAgICAgICAgIC4uLlsuLi50aGlzLl9wb3N0XS5tYXAodmlzaXRvciA9PiBjb25jYXRNYXAoZGF0YSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB2aXNpdEpzb24oZGF0YSBhcyBKc29uVmFsdWUsIHZpc2l0b3IsIHNjaGVtYSwgdGhpcy5fcmVzb2x2ZXIsIHZhbGlkYXRlKTtcbiAgICAgICAgICAgICAgICAgIH0pKSxcbiAgICAgICAgICAgICAgICApLnBpcGUoXG4gICAgICAgICAgICAgICAgICBtYXAoZGF0YSA9PiBbZGF0YSwgdmFsaWRdKSxcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBvYnNlcnZhYmxlT2YoW2RhdGEsIHZhbGlkXSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgbWFwKChbZGF0YSwgdmFsaWRdKSA9PiB7XG4gICAgICAgICAgICAgIGlmICh2YWxpZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IGRhdGEsIHN1Y2Nlc3M6IHRydWUgfSBhcyBTY2hlbWFWYWxpZGF0b3JSZXN1bHQ7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIGRhdGEsXG4gICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgZXJyb3JzOiAodmFsaWRhdGUuZXJyb3JzIHx8IFtdKSxcbiAgICAgICAgICAgICAgfSBhcyBTY2hlbWFWYWxpZGF0b3JSZXN1bHQ7XG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICApO1xuICAgICAgICB9KSxcbiAgICAgICk7XG4gIH1cblxuICBhZGRGb3JtYXQoZm9ybWF0OiBTY2hlbWFGb3JtYXQpOiB2b2lkIHtcbiAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tYW55XG4gICAgY29uc3QgdmFsaWRhdGUgPSAoZGF0YTogYW55KSA9PiB7XG4gICAgICBjb25zdCByZXN1bHQgPSBmb3JtYXQuZm9ybWF0dGVyLnZhbGlkYXRlKGRhdGEpO1xuXG4gICAgICBpZiAodHlwZW9mIHJlc3VsdCA9PSAnYm9vbGVhbicpIHtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiByZXN1bHQudG9Qcm9taXNlKCk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIHRoaXMuX2Fqdi5hZGRGb3JtYXQoZm9ybWF0Lm5hbWUsIHtcbiAgICAgIGFzeW5jOiBmb3JtYXQuZm9ybWF0dGVyLmFzeW5jLFxuICAgICAgdmFsaWRhdGUsXG4gICAgLy8gQUpWIHR5cGluZ3MgbGlzdCBgY29tcGFyZWAgYXMgcmVxdWlyZWQsIGJ1dCBpdCBpcyBvcHRpb25hbC5cbiAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tYW55XG4gICAgfSBhcyBhbnkpO1xuICB9XG5cbiAgYWRkU21hcnREZWZhdWx0UHJvdmlkZXI8VD4oc291cmNlOiBzdHJpbmcsIHByb3ZpZGVyOiBTbWFydERlZmF1bHRQcm92aWRlcjxUPikge1xuICAgIGlmICh0aGlzLl9zb3VyY2VNYXAuaGFzKHNvdXJjZSkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihzb3VyY2UpO1xuICAgIH1cblxuICAgIHRoaXMuX3NvdXJjZU1hcC5zZXQoc291cmNlLCBwcm92aWRlcik7XG5cbiAgICBpZiAoIXRoaXMuX3NtYXJ0RGVmYXVsdEtleXdvcmQpIHtcbiAgICAgIHRoaXMuX3NtYXJ0RGVmYXVsdEtleXdvcmQgPSB0cnVlO1xuXG4gICAgICB0aGlzLl9hanYuYWRkS2V5d29yZCgnJGRlZmF1bHQnLCB7XG4gICAgICAgIG1vZGlmeWluZzogdHJ1ZSxcbiAgICAgICAgYXN5bmM6IHRydWUsXG4gICAgICAgIGNvbXBpbGU6IChzY2hlbWEsIF9wYXJlbnRTY2hlbWEsIGl0KSA9PiB7XG4gICAgICAgICAgY29uc3Qgc291cmNlID0gdGhpcy5fc291cmNlTWFwLmdldCgoc2NoZW1hIGFzIEpzb25PYmplY3QpLiRzb3VyY2UgYXMgc3RyaW5nKTtcblxuICAgICAgICAgIGlmICghc291cmNlKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgc291cmNlOiAke0pTT04uc3RyaW5naWZ5KHNvdXJjZSl9LmApO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIFdlIGNoZWF0LCBoZWF2aWx5LlxuICAgICAgICAgIHRoaXMuX3NtYXJ0RGVmYXVsdFJlY29yZC5zZXQoXG4gICAgICAgICAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tYW55XG4gICAgICAgICAgICBKU09OLnN0cmluZ2lmeSgoaXQgYXMgYW55KS5kYXRhUGF0aEFyci5zbGljZSgxLCAoaXQgYXMgYW55KS5kYXRhTGV2ZWwgKyAxKSBhcyBzdHJpbmdbXSksXG4gICAgICAgICAgICBzY2hlbWEsXG4gICAgICAgICAgKTtcblxuICAgICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUodHJ1ZSk7XG4gICAgICAgICAgfTtcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby1hbnlcbiAgcHJpdmF0ZSBfYXBwbHlTbWFydERlZmF1bHRzKGRhdGE6IGFueSk6IE9ic2VydmFibGU8YW55PiB7XG4gICAgZnVuY3Rpb24gX3NldChcbiAgICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby1hbnlcbiAgICAgIGRhdGE6IGFueSxcbiAgICAgIGZyYWdtZW50czogc3RyaW5nW10sXG4gICAgICB2YWx1ZToge30sXG4gICAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tYW55XG4gICAgICBwYXJlbnQ6IGFueSB8IG51bGwgPSBudWxsLFxuICAgICAgcGFyZW50UHJvcGVydHk/OiBzdHJpbmcsXG4gICAgKTogdm9pZCB7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGZyYWdtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBmID0gZnJhZ21lbnRzW2ldO1xuXG4gICAgICAgIGlmIChmWzBdID09ICdpJykge1xuICAgICAgICAgIGlmICghQXJyYXkuaXNBcnJheShkYXRhKSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgZGF0YS5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgX3NldChkYXRhW2pdLCBmcmFnbWVudHMuc2xpY2UoaSArIDEpLCB2YWx1ZSwgZGF0YSwgJycgKyBqKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH0gZWxzZSBpZiAoZi5zdGFydHNXaXRoKCdrZXknKSkge1xuICAgICAgICAgIGlmICh0eXBlb2YgZGF0YSAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhkYXRhKS5mb3JFYWNoKHByb3BlcnR5ID0+IHtcbiAgICAgICAgICAgIF9zZXQoZGF0YVtwcm9wZXJ0eV0sIGZyYWdtZW50cy5zbGljZShpICsgMSksIHZhbHVlLCBkYXRhLCBwcm9wZXJ0eSk7XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH0gZWxzZSBpZiAoZi5zdGFydHNXaXRoKCdcXCcnKSAmJiBmW2YubGVuZ3RoIC0gMV0gPT0gJ1xcJycpIHtcbiAgICAgICAgICBjb25zdCBwcm9wZXJ0eSA9IGZcbiAgICAgICAgICAgIC5zbGljZSgxLCAtMSlcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cXFxcJy9nLCAnXFwnJylcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cXFxcbi9nLCAnXFxuJylcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cXFxcci9nLCAnXFxyJylcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cXFxcZi9nLCAnXFxmJylcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cXFxcdC9nLCAnXFx0Jyk7XG5cbiAgICAgICAgICAvLyBXZSBrbm93IHdlIG5lZWQgYW4gb2JqZWN0IGJlY2F1c2UgdGhlIGZyYWdtZW50IGlzIGEgcHJvcGVydHkga2V5LlxuICAgICAgICAgIGlmICghZGF0YSAmJiBwYXJlbnQgIT09IG51bGwgJiYgcGFyZW50UHJvcGVydHkpIHtcbiAgICAgICAgICAgIGRhdGEgPSBwYXJlbnRbcGFyZW50UHJvcGVydHldID0ge307XG4gICAgICAgICAgfVxuICAgICAgICAgIHBhcmVudCA9IGRhdGE7XG4gICAgICAgICAgcGFyZW50UHJvcGVydHkgPSBwcm9wZXJ0eTtcblxuICAgICAgICAgIGRhdGEgPSBkYXRhW3Byb3BlcnR5XTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKHBhcmVudCAmJiBwYXJlbnRQcm9wZXJ0eSAmJiBwYXJlbnRbcGFyZW50UHJvcGVydHldID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcGFyZW50W3BhcmVudFByb3BlcnR5XSA9IHZhbHVlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBvYnNlcnZhYmxlT2YoZGF0YSkucGlwZShcbiAgICAgIC4uLlsuLi50aGlzLl9zbWFydERlZmF1bHRSZWNvcmQuZW50cmllcygpXS5tYXAoKFtwb2ludGVyLCBzY2hlbWFdKSA9PiB7XG4gICAgICAgIHJldHVybiBjb25jYXRNYXAoZGF0YSA9PiB7XG4gICAgICAgICAgY29uc3QgZnJhZ21lbnRzID0gSlNPTi5wYXJzZShwb2ludGVyKTtcbiAgICAgICAgICBjb25zdCBzb3VyY2UgPSB0aGlzLl9zb3VyY2VNYXAuZ2V0KChzY2hlbWEgYXMgSnNvbk9iamVjdCkuJHNvdXJjZSBhcyBzdHJpbmcpO1xuXG4gICAgICAgICAgaWYgKCFzb3VyY2UpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBzb3VyY2UuJyk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgbGV0IHZhbHVlID0gc291cmNlKHNjaGVtYSk7XG4gICAgICAgICAgaWYgKCFpc09ic2VydmFibGUodmFsdWUpKSB7XG4gICAgICAgICAgICB2YWx1ZSA9IG9ic2VydmFibGVPZih2YWx1ZSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmV0dXJuICh2YWx1ZSBhcyBPYnNlcnZhYmxlPHt9PikucGlwZShcbiAgICAgICAgICAgIC8vIFN5bmNocm9ub3VzbHkgc2V0IHRoZSBuZXcgZGF0YSBhdCB0aGUgcHJvcGVyIEpzb25TY2hlbWEgcGF0aC5cbiAgICAgICAgICAgIHRhcCh4ID0+IF9zZXQoZGF0YSwgZnJhZ21lbnRzLCB4KSksXG4gICAgICAgICAgICAvLyBCdXQgcmV0dXJuIHRoZSBkYXRhIG9iamVjdC5cbiAgICAgICAgICAgIG1hcCgoKSA9PiBkYXRhKSxcbiAgICAgICAgICApO1xuICAgICAgICB9KTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cbn1cbiJdfQ==