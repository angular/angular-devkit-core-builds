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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVnaXN0cnkuanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2NvcmUvc3JjL2pzb24vc2NoZW1hL3JlZ2lzdHJ5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUE7Ozs7OztHQU1HO0FBQ0gsMkJBQTJCO0FBQzNCLDZCQUE2QjtBQUM3QiwrQkFBNEQ7QUFDNUQsOENBQWdFO0FBQ2hFLHlEQUEwRDtBQUMxRCx1Q0FBZ0U7QUFXaEUsNkNBQW9EO0FBQ3BELHVDQUFtRDtBQVduRCwrQkFBdUMsU0FBUSx5QkFBYTtJQUcxRCxZQUNFLE1BQStCLEVBQy9CLFdBQVcsR0FBRyxxREFBcUQ7UUFFbkUsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLElBQUksTUFBTSxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ25DLEtBQUssQ0FBQywyQkFBMkIsQ0FBQyxDQUFDO1lBRW5DLE1BQU0sQ0FBQztRQUNULENBQUM7UUFFRCxNQUFNLFFBQVEsR0FBRyx5QkFBeUIsQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDbEUsS0FBSyxDQUFDLEdBQUcsV0FBVyxPQUFPLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ3BELElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO0lBQ3ZCLENBQUM7SUFFTSxNQUFNLENBQUMsY0FBYyxDQUFDLE1BQStCO1FBQzFELEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxJQUFJLE1BQU0sQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNuQyxNQUFNLENBQUMsRUFBRSxDQUFDO1FBQ1osQ0FBQztRQUVELE1BQU0sUUFBUSxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRTtZQUNsQyxJQUFJLE9BQU8sR0FBRyxhQUFhLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxD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Q0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FDaEIsQ0FBQztZQUNKLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDLENBQ0gsQ0FBQztJQUNKLENBQUM7Q0FDRjtBQTVVRCxnREE0VUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQgKiBhcyBhanYgZnJvbSAnYWp2JztcbmltcG9ydCAqIGFzIGh0dHAgZnJvbSAnaHR0cCc7XG5pbXBvcnQgeyBPYnNlcnZhYmxlLCBmcm9tLCBvZiBhcyBvYnNlcnZhYmxlT2YgfSBmcm9tICdyeGpzJztcbmltcG9ydCB7IGNvbmNhdE1hcCwgbWFwLCBzd2l0Y2hNYXAsIHRhcCB9IGZyb20gJ3J4anMvb3BlcmF0b3JzJztcbmltcG9ydCB7IEJhc2VFeGNlcHRpb24gfSBmcm9tICcuLi8uLi9leGNlcHRpb24vZXhjZXB0aW9uJztcbmltcG9ydCB7IFBhcnRpYWxseU9yZGVyZWRTZXQsIGlzT2JzZXJ2YWJsZSB9IGZyb20gJy4uLy4uL3V0aWxzJztcbmltcG9ydCB7IEpzb25PYmplY3QsIEpzb25WYWx1ZSB9IGZyb20gJy4uL2ludGVyZmFjZSc7XG5pbXBvcnQge1xuICBTY2hlbWFGb3JtYXQsXG4gIFNjaGVtYUZvcm1hdHRlcixcbiAgU2NoZW1hUmVnaXN0cnksXG4gIFNjaGVtYVZhbGlkYXRvcixcbiAgU2NoZW1hVmFsaWRhdG9yRXJyb3IsXG4gIFNjaGVtYVZhbGlkYXRvclJlc3VsdCxcbiAgU21hcnREZWZhdWx0UHJvdmlkZXIsXG59IGZyb20gJy4vaW50ZXJmYWNlJztcbmltcG9ydCB7IGFkZFVuZGVmaW5lZERlZmF1bHRzIH0gZnJvbSAnLi90cmFuc2Zvcm1zJztcbmltcG9ydCB7IEpzb25WaXNpdG9yLCB2aXNpdEpzb24gfSBmcm9tICcuL3Zpc2l0b3InO1xuXG5cbi8vIFRoaXMgaW50ZXJmYWNlIHNob3VsZCBiZSBleHBvcnRlZCBmcm9tIGFqdiwgYnV0IHRoZXkgb25seSBleHBvcnQgdGhlIGNsYXNzIGFuZCBub3QgdGhlIHR5cGUuXG5pbnRlcmZhY2UgQWp2VmFsaWRhdGlvbkVycm9yIHtcbiAgbWVzc2FnZTogc3RyaW5nO1xuICBlcnJvcnM6IEFycmF5PGFqdi5FcnJvck9iamVjdD47XG4gIGFqdjogdHJ1ZTtcbiAgdmFsaWRhdGlvbjogdHJ1ZTtcbn1cblxuZXhwb3J0IGNsYXNzIFNjaGVtYVZhbGlkYXRpb25FeGNlcHRpb24gZXh0ZW5kcyBCYXNlRXhjZXB0aW9uIHtcbiAgcHVibGljIHJlYWRvbmx5IGVycm9yczogU2NoZW1hVmFsaWRhdG9yRXJyb3JbXTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBlcnJvcnM/OiBTY2hlbWFWYWxpZGF0b3JFcnJvcltdLFxuICAgIGJhc2VNZXNzYWdlID0gJ1NjaGVtYSB2YWxpZGF0aW9uIGZhaWxlZCB3aXRoIHRoZSBmb2xsb3dpbmcgZXJyb3JzOicsXG4gICkge1xuICAgIGlmICghZXJyb3JzIHx8IGVycm9ycy5sZW5ndGggPT09IDApIHtcbiAgICAgIHN1cGVyKCdTY2hlbWEgdmFsaWRhdGlvbiBmYWlsZWQuJyk7XG5cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBtZXNzYWdlcyA9IFNjaGVtYVZhbGlkYXRpb25FeGNlcHRpb24uY3JlYXRlTWVzc2FnZXMoZXJyb3JzKTtcbiAgICBzdXBlcihgJHtiYXNlTWVzc2FnZX1cXG4gICR7bWVzc2FnZXMuam9pbignXFxuICAnKX1gKTtcbiAgICB0aGlzLmVycm9ycyA9IGVycm9ycztcbiAgfVxuXG4gIHB1YmxpYyBzdGF0aWMgY3JlYXRlTWVzc2FnZXMoZXJyb3JzPzogU2NoZW1hVmFsaWRhdG9yRXJyb3JbXSk6IHN0cmluZ1tdIHtcbiAgICBpZiAoIWVycm9ycyB8fCBlcnJvcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuXG4gICAgY29uc3QgbWVzc2FnZXMgPSBlcnJvcnMubWFwKChlcnIpID0+IHtcbiAgICAgIGxldCBtZXNzYWdlID0gYERhdGEgcGF0aCAke0pTT04uc3RyaW5naWZ5KGVyci5kYXRhUGF0aCl9ICR7ZXJyLm1lc3NhZ2V9YDtcbiAgICAgIGlmIChlcnIua2V5d29yZCA9PT0gJ2FkZGl0aW9uYWxQcm9wZXJ0aWVzJykge1xuICAgICAgICBtZXNzYWdlICs9IGAoJHtlcnIucGFyYW1zLmFkZGl0aW9uYWxQcm9wZXJ0eX0pYDtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIG1lc3NhZ2UgKyAnLic7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gbWVzc2FnZXM7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIENvcmVTY2hlbWFSZWdpc3RyeSBpbXBsZW1lbnRzIFNjaGVtYVJlZ2lzdHJ5IHtcbiAgcHJpdmF0ZSBfYWp2OiBhanYuQWp2O1xuICBwcml2YXRlIF91cmlDYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCBKc29uT2JqZWN0PigpO1xuICBwcml2YXRlIF9wcmUgPSBuZXcgUGFydGlhbGx5T3JkZXJlZFNldDxKc29uVmlzaXRvcj4oKTtcbiAgcHJpdmF0ZSBfcG9zdCA9IG5ldyBQYXJ0aWFsbHlPcmRlcmVkU2V0PEpzb25WaXNpdG9yPigpO1xuXG4gIHByaXZhdGUgX3NtYXJ0RGVmYXVsdEtleXdvcmQgPSBmYWxzZTtcbiAgcHJpdmF0ZSBfc291cmNlTWFwID0gbmV3IE1hcDxzdHJpbmcsIFNtYXJ0RGVmYXVsdFByb3ZpZGVyPHt9Pj4oKTtcbiAgcHJpdmF0ZSBfc21hcnREZWZhdWx0UmVjb3JkID0gbmV3IE1hcDxzdHJpbmcsIEpzb25PYmplY3Q+KCk7XG5cbiAgY29uc3RydWN0b3IoZm9ybWF0czogU2NoZW1hRm9ybWF0W10gPSBbXSkge1xuICAgIC8qKlxuICAgICAqIEJ1aWxkIGFuIEFKViBpbnN0YW5jZSB0aGF0IHdpbGwgYmUgdXNlZCB0byB2YWxpZGF0ZSBzY2hlbWFzLlxuICAgICAqL1xuXG4gICAgY29uc3QgZm9ybWF0c09iajogeyBbbmFtZTogc3RyaW5nXTogU2NoZW1hRm9ybWF0dGVyIH0gPSB7fTtcblxuICAgIGZvciAoY29uc3QgZm9ybWF0IG9mIGZvcm1hdHMpIHtcbiAgICAgIGZvcm1hdHNPYmpbZm9ybWF0Lm5hbWVdID0gZm9ybWF0LmZvcm1hdHRlcjtcbiAgICB9XG5cbiAgICB0aGlzLl9hanYgPSBhanYoe1xuICAgICAgdXNlRGVmYXVsdHM6IHRydWUsXG4gICAgICBmb3JtYXRzOiBmb3JtYXRzT2JqLFxuICAgICAgbG9hZFNjaGVtYTogKHVyaTogc3RyaW5nKSA9PiB0aGlzLl9mZXRjaCh1cmkpIGFzIGFqdi5UaGVuYWJsZTxvYmplY3Q+LFxuICAgIH0pO1xuXG4gICAgdGhpcy5fYWp2LmFkZE1ldGFTY2hlbWEocmVxdWlyZSgnYWp2L2xpYi9yZWZzL2pzb24tc2NoZW1hLWRyYWZ0LTA0Lmpzb24nKSk7XG5cbiAgICB0aGlzLmFkZFBvc3RUcmFuc2Zvcm0oYWRkVW5kZWZpbmVkRGVmYXVsdHMpO1xuICB9XG5cbiAgcHJpdmF0ZSBfZmV0Y2godXJpOiBzdHJpbmcpOiBQcm9taXNlPEpzb25PYmplY3Q+IHtcbiAgICBjb25zdCBtYXliZVNjaGVtYSA9IHRoaXMuX3VyaUNhY2hlLmdldCh1cmkpO1xuXG4gICAgaWYgKG1heWJlU2NoZW1hKSB7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKG1heWJlU2NoZW1hKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IFByb21pc2U8SnNvbk9iamVjdD4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgaHR0cC5nZXQodXJpLCByZXMgPT4ge1xuICAgICAgICBpZiAoIXJlcy5zdGF0dXNDb2RlIHx8IHJlcy5zdGF0dXNDb2RlID49IDMwMCkge1xuICAgICAgICAgIC8vIENvbnN1bWUgdGhlIHJlc3Qgb2YgdGhlIGRhdGEgdG8gZnJlZSBtZW1vcnkuXG4gICAgICAgICAgcmVzLnJlc3VtZSgpO1xuICAgICAgICAgIHJlamVjdChgUmVxdWVzdCBmYWlsZWQuIFN0YXR1cyBDb2RlOiAke3Jlcy5zdGF0dXNDb2RlfWApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlcy5zZXRFbmNvZGluZygndXRmOCcpO1xuICAgICAgICAgIGxldCBkYXRhID0gJyc7XG4gICAgICAgICAgcmVzLm9uKCdkYXRhJywgY2h1bmsgPT4ge1xuICAgICAgICAgICAgZGF0YSArPSBjaHVuaztcbiAgICAgICAgICB9KTtcbiAgICAgICAgICByZXMub24oJ2VuZCcsICgpID0+IHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGNvbnN0IGpzb24gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgICAgICAgICAgICB0aGlzLl91cmlDYWNoZS5zZXQodXJpLCBqc29uKTtcbiAgICAgICAgICAgICAgcmVzb2x2ZShqc29uKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQWRkIGEgdHJhbnNmb3JtYXRpb24gc3RlcCBiZWZvcmUgdGhlIHZhbGlkYXRpb24gb2YgYW55IEpzb24uXG4gICAqIEBwYXJhbSB7SnNvblZpc2l0b3J9IHZpc2l0b3IgVGhlIHZpc2l0b3IgdG8gdHJhbnNmb3JtIGV2ZXJ5IHZhbHVlLlxuICAgKiBAcGFyYW0ge0pzb25WaXNpdG9yW119IGRlcHMgQSBsaXN0IG9mIG90aGVyIHZpc2l0b3JzIHRvIHJ1biBiZWZvcmUuXG4gICAqL1xuICBhZGRQcmVUcmFuc2Zvcm0odmlzaXRvcjogSnNvblZpc2l0b3IsIGRlcHM/OiBKc29uVmlzaXRvcltdKSB7XG4gICAgdGhpcy5fcHJlLmFkZCh2aXNpdG9yLCBkZXBzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGQgYSB0cmFuc2Zvcm1hdGlvbiBzdGVwIGFmdGVyIHRoZSB2YWxpZGF0aW9uIG9mIGFueSBKc29uLiBUaGUgSlNPTiB3aWxsIG5vdCBiZSB2YWxpZGF0ZWRcbiAgICogYWZ0ZXIgdGhlIFBPU1QsIHNvIGlmIHRyYW5zZm9ybWF0aW9ucyBhcmUgbm90IGNvbXBhdGlibGUgd2l0aCB0aGUgU2NoZW1hIGl0IHdpbGwgbm90IHJlc3VsdFxuICAgKiBpbiBhbiBlcnJvci5cbiAgICogQHBhcmFtIHtKc29uVmlzaXRvcn0gdmlzaXRvciBUaGUgdmlzaXRvciB0byB0cmFuc2Zvcm0gZXZlcnkgdmFsdWUuXG4gICAqIEBwYXJhbSB7SnNvblZpc2l0b3JbXX0gZGVwcyBBIGxpc3Qgb2Ygb3RoZXIgdmlzaXRvcnMgdG8gcnVuIGJlZm9yZS5cbiAgICovXG4gIGFkZFBvc3RUcmFuc2Zvcm0odmlzaXRvcjogSnNvblZpc2l0b3IsIGRlcHM/OiBKc29uVmlzaXRvcltdKSB7XG4gICAgdGhpcy5fcG9zdC5hZGQodmlzaXRvciwgZGVwcyk7XG4gIH1cblxuICBwcm90ZWN0ZWQgX3Jlc29sdmVyKFxuICAgIHJlZjogc3RyaW5nLFxuICAgIHZhbGlkYXRlOiBhanYuVmFsaWRhdGVGdW5jdGlvbixcbiAgKTogeyBjb250ZXh0PzogYWp2LlZhbGlkYXRlRnVuY3Rpb24sIHNjaGVtYT86IEpzb25PYmplY3QgfSB7XG4gICAgaWYgKCF2YWxpZGF0ZSkge1xuICAgICAgcmV0dXJuIHt9O1xuICAgIH1cblxuICAgIGNvbnN0IHJlZkhhc2ggPSByZWYuc3BsaXQoJyMnLCAyKVsxXTtcbiAgICBjb25zdCByZWZVcmwgPSByZWYuc3RhcnRzV2l0aCgnIycpID8gcmVmIDogcmVmLnNwbGl0KCcjJywgMSk7XG5cbiAgICBpZiAoIXJlZi5zdGFydHNXaXRoKCcjJykpIHtcbiAgICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby1hbnlcbiAgICAgIHZhbGlkYXRlID0gKHZhbGlkYXRlLnJlZlZhbCBhcyBhbnkpWyh2YWxpZGF0ZS5yZWZzIGFzIGFueSlbcmVmVXJsWzBdXV07XG4gICAgfVxuICAgIGlmICh2YWxpZGF0ZSAmJiByZWZIYXNoKSB7XG4gICAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tYW55XG4gICAgICB2YWxpZGF0ZSA9ICh2YWxpZGF0ZS5yZWZWYWwgYXMgYW55KVsodmFsaWRhdGUucmVmcyBhcyBhbnkpWycjJyArIHJlZkhhc2hdXTtcbiAgICB9XG5cbiAgICByZXR1cm4geyBjb250ZXh0OiB2YWxpZGF0ZSwgc2NoZW1hOiB2YWxpZGF0ZSAmJiB2YWxpZGF0ZS5zY2hlbWEgYXMgSnNvbk9iamVjdCB9O1xuICB9XG5cbiAgY29tcGlsZShzY2hlbWE6IEpzb25PYmplY3QpOiBPYnNlcnZhYmxlPFNjaGVtYVZhbGlkYXRvcj4ge1xuICAgIC8vIFN1cHBvcnRzIGJvdGggc3luY2hyb25vdXMgYW5kIGFzeW5jaHJvbm91cyBjb21waWxhdGlvbiwgYnkgdHJ5aW5nIHRoZSBzeW5jaHJvbm91c1xuICAgIC8vIHZlcnNpb24gZmlyc3QsIHRoZW4gaWYgcmVmcyBhcmUgbWlzc2luZyB0aGlzIHdpbGwgZmFpbHMuXG4gICAgLy8gV2UgYWxzbyBhZGQgYW55IHJlZnMgZnJvbSBleHRlcm5hbCBmZXRjaGVkIHNjaGVtYXMgc28gdGhhdCB0aG9zZSB3aWxsIGFsc28gYmUgdXNlZFxuICAgIC8vIGluIHN5bmNocm9ub3VzIChpZiBhdmFpbGFibGUpLlxuICAgIGxldCB2YWxpZGF0b3I6IE9ic2VydmFibGU8YWp2LlZhbGlkYXRlRnVuY3Rpb24+O1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBtYXliZUZuVmFsaWRhdGUgPSB0aGlzLl9hanYuY29tcGlsZSh7XG4gICAgICAgICRhc3luYzogdGhpcy5fc21hcnREZWZhdWx0S2V5d29yZCA/IHRydWUgOiB1bmRlZmluZWQsXG4gICAgICAgIC4uLnNjaGVtYSxcbiAgICAgIH0pO1xuICAgICAgdmFsaWRhdG9yID0gb2JzZXJ2YWJsZU9mKG1heWJlRm5WYWxpZGF0ZSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgLy8gUHJvcGFnYXRlIHRoZSBlcnJvci5cbiAgICAgIGlmICghKGUgaW5zdGFuY2VvZiAoYWp2Lk1pc3NpbmdSZWZFcnJvciBhcyB7fSBhcyBGdW5jdGlvbikpKSB7XG4gICAgICAgIHRocm93IGU7XG4gICAgICB9XG5cbiAgICAgIHZhbGlkYXRvciA9IG5ldyBPYnNlcnZhYmxlKG9icyA9PiB7XG4gICAgICAgIHRoaXMuX2Fqdi5jb21waWxlQXN5bmMoc2NoZW1hKVxuICAgICAgICAgIC50aGVuKHZhbGlkYXRlID0+IHtcbiAgICAgICAgICAgIG9icy5uZXh0KHZhbGlkYXRlKTtcbiAgICAgICAgICAgIG9icy5jb21wbGV0ZSgpO1xuICAgICAgICAgIH0sIGVyciA9PiB7XG4gICAgICAgICAgICBvYnMuZXJyb3IoZXJyKTtcbiAgICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiB2YWxpZGF0b3JcbiAgICAgIC5waXBlKFxuICAgICAgICBtYXAodmFsaWRhdGUgPT4gKGRhdGE6IEpzb25WYWx1ZSk6IE9ic2VydmFibGU8U2NoZW1hVmFsaWRhdG9yUmVzdWx0PiA9PiB7XG4gICAgICAgICAgcmV0dXJuIG9ic2VydmFibGVPZihkYXRhKS5waXBlKFxuICAgICAgICAgICAgLi4uWy4uLnRoaXMuX3ByZV0ubWFwKHZpc2l0b3IgPT4gY29uY2F0TWFwKChkYXRhOiBKc29uVmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgcmV0dXJuIHZpc2l0SnNvbihkYXRhLCB2aXNpdG9yLCBzY2hlbWEsIHRoaXMuX3Jlc29sdmVyLCB2YWxpZGF0ZSk7XG4gICAgICAgICAgICB9KSksXG4gICAgICAgICAgKS5waXBlKFxuICAgICAgICAgICAgc3dpdGNoTWFwKHVwZGF0ZWREYXRhID0+IHtcbiAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gdmFsaWRhdGUodXBkYXRlZERhdGEpO1xuXG4gICAgICAgICAgICAgIHJldHVybiB0eXBlb2YgcmVzdWx0ID09ICdib29sZWFuJ1xuICAgICAgICAgICAgICAgID8gb2JzZXJ2YWJsZU9mKFt1cGRhdGVkRGF0YSwgcmVzdWx0XSlcbiAgICAgICAgICAgICAgICA6IGZyb20oKHJlc3VsdCBhcyBQcm9taXNlPGJvb2xlYW4+KVxuICAgICAgICAgICAgICAgICAgLnRoZW4ociA9PiBbdXBkYXRlZERhdGEsIHRydWVdKVxuICAgICAgICAgICAgICAgICAgLmNhdGNoKChlcnI6IEVycm9yIHwgQWp2VmFsaWRhdGlvbkVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmICgoZXJyIGFzIEFqdlZhbGlkYXRpb25FcnJvcikuYWp2KSB7XG4gICAgICAgICAgICAgICAgICAgICAgdmFsaWRhdGUuZXJyb3JzID0gKGVyciBhcyBBanZWYWxpZGF0aW9uRXJyb3IpLmVycm9ycztcblxuICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoW3VwZGF0ZWREYXRhLCBmYWxzZV0pO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycik7XG4gICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIHN3aXRjaE1hcCgoW2RhdGEsIHZhbGlkXSkgPT4ge1xuICAgICAgICAgICAgICBpZiAodmFsaWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fYXBwbHlTbWFydERlZmF1bHRzKGRhdGEpLnBpcGUoXG4gICAgICAgICAgICAgICAgICAuLi5bLi4udGhpcy5fcG9zdF0ubWFwKHZpc2l0b3IgPT4gY29uY2F0TWFwKGRhdGEgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdmlzaXRKc29uKGRhdGEgYXMgSnNvblZhbHVlLCB2aXNpdG9yLCBzY2hlbWEsIHRoaXMuX3Jlc29sdmVyLCB2YWxpZGF0ZSk7XG4gICAgICAgICAgICAgICAgICB9KSksXG4gICAgICAgICAgICAgICAgKS5waXBlKFxuICAgICAgICAgICAgICAgICAgbWFwKGRhdGEgPT4gW2RhdGEsIHZhbGlkXSksXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gb2JzZXJ2YWJsZU9mKFtkYXRhLCB2YWxpZF0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIG1hcCgoW2RhdGEsIHZhbGlkXSkgPT4ge1xuICAgICAgICAgICAgICBpZiAodmFsaWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBkYXRhLCBzdWNjZXNzOiB0cnVlIH0gYXMgU2NoZW1hVmFsaWRhdG9yUmVzdWx0O1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBkYXRhLFxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGVycm9yczogKHZhbGlkYXRlLmVycm9ycyB8fCBbXSksXG4gICAgICAgICAgICAgIH0gYXMgU2NoZW1hVmFsaWRhdG9yUmVzdWx0O1xuICAgICAgICAgICAgfSksXG4gICAgICAgICAgKTtcbiAgICAgICAgfSksXG4gICAgICApO1xuICB9XG5cbiAgYWRkRm9ybWF0KGZvcm1hdDogU2NoZW1hRm9ybWF0KTogdm9pZCB7XG4gICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWFueVxuICAgIGNvbnN0IHZhbGlkYXRlID0gKGRhdGE6IGFueSkgPT4ge1xuICAgICAgY29uc3QgcmVzdWx0ID0gZm9ybWF0LmZvcm1hdHRlci52YWxpZGF0ZShkYXRhKTtcblxuICAgICAgaWYgKHR5cGVvZiByZXN1bHQgPT0gJ2Jvb2xlYW4nKSB7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gcmVzdWx0LnRvUHJvbWlzZSgpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICB0aGlzLl9hanYuYWRkRm9ybWF0KGZvcm1hdC5uYW1lLCB7XG4gICAgICBhc3luYzogZm9ybWF0LmZvcm1hdHRlci5hc3luYyxcbiAgICAgIHZhbGlkYXRlLFxuICAgIC8vIEFKViB0eXBpbmdzIGxpc3QgYGNvbXBhcmVgIGFzIHJlcXVpcmVkLCBidXQgaXQgaXMgb3B0aW9uYWwuXG4gICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWFueVxuICAgIH0gYXMgYW55KTtcbiAgfVxuXG4gIGFkZFNtYXJ0RGVmYXVsdFByb3ZpZGVyPFQ+KHNvdXJjZTogc3RyaW5nLCBwcm92aWRlcjogU21hcnREZWZhdWx0UHJvdmlkZXI8VD4pIHtcbiAgICBpZiAodGhpcy5fc291cmNlTWFwLmhhcyhzb3VyY2UpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3Ioc291cmNlKTtcbiAgICB9XG5cbiAgICB0aGlzLl9zb3VyY2VNYXAuc2V0KHNvdXJjZSwgcHJvdmlkZXIpO1xuXG4gICAgaWYgKCF0aGlzLl9zbWFydERlZmF1bHRLZXl3b3JkKSB7XG4gICAgICB0aGlzLl9zbWFydERlZmF1bHRLZXl3b3JkID0gdHJ1ZTtcblxuICAgICAgdGhpcy5fYWp2LmFkZEtleXdvcmQoJyRkZWZhdWx0Jywge1xuICAgICAgICBtb2RpZnlpbmc6IHRydWUsXG4gICAgICAgIGFzeW5jOiB0cnVlLFxuICAgICAgICBjb21waWxlOiAoc2NoZW1hLCBfcGFyZW50U2NoZW1hLCBpdCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHNvdXJjZSA9IHRoaXMuX3NvdXJjZU1hcC5nZXQoKHNjaGVtYSBhcyBKc29uT2JqZWN0KS4kc291cmNlIGFzIHN0cmluZyk7XG5cbiAgICAgICAgICBpZiAoIXNvdXJjZSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIHNvdXJjZTogJHtKU09OLnN0cmluZ2lmeShzb3VyY2UpfS5gKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBXZSBjaGVhdCwgaGVhdmlseS5cbiAgICAgICAgICB0aGlzLl9zbWFydERlZmF1bHRSZWNvcmQuc2V0KFxuICAgICAgICAgICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWFueVxuICAgICAgICAgICAgSlNPTi5zdHJpbmdpZnkoKGl0IGFzIGFueSkuZGF0YVBhdGhBcnIuc2xpY2UoMSwgKGl0IGFzIGFueSkuZGF0YUxldmVsICsgMSkgYXMgc3RyaW5nW10pLFxuICAgICAgICAgICAgc2NoZW1hLFxuICAgICAgICAgICk7XG5cbiAgICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICByZXR1cm4gPGFqdi5UaGVuYWJsZTxib29sZWFuPj4gUHJvbWlzZS5yZXNvbHZlKHRydWUpO1xuICAgICAgICAgIH07XG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tYW55XG4gIHByaXZhdGUgX2FwcGx5U21hcnREZWZhdWx0cyhkYXRhOiBhbnkpOiBPYnNlcnZhYmxlPGFueT4ge1xuICAgIGZ1bmN0aW9uIF9zZXQoXG4gICAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tYW55XG4gICAgICBkYXRhOiBhbnksXG4gICAgICBmcmFnbWVudHM6IHN0cmluZ1tdLFxuICAgICAgdmFsdWU6IHt9LFxuICAgICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWFueVxuICAgICAgcGFyZW50OiBhbnkgfCBudWxsID0gbnVsbCxcbiAgICAgIHBhcmVudFByb3BlcnR5Pzogc3RyaW5nLFxuICAgICk6IHZvaWQge1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBmcmFnbWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29uc3QgZiA9IGZyYWdtZW50c1tpXTtcblxuICAgICAgICBpZiAoZlswXSA9PSAnaScpIHtcbiAgICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkoZGF0YSkpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGRhdGEubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgIF9zZXQoZGF0YVtqXSwgZnJhZ21lbnRzLnNsaWNlKGkgKyAxKSwgdmFsdWUsIGRhdGEsICcnICsgaik7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9IGVsc2UgaWYgKGYuc3RhcnRzV2l0aCgna2V5JykpIHtcbiAgICAgICAgICBpZiAodHlwZW9mIGRhdGEgIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoZGF0YSkuZm9yRWFjaChwcm9wZXJ0eSA9PiB7XG4gICAgICAgICAgICBfc2V0KGRhdGFbcHJvcGVydHldLCBmcmFnbWVudHMuc2xpY2UoaSArIDEpLCB2YWx1ZSwgZGF0YSwgcHJvcGVydHkpO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9IGVsc2UgaWYgKGYuc3RhcnRzV2l0aCgnXFwnJykgJiYgZltmLmxlbmd0aCAtIDFdID09ICdcXCcnKSB7XG4gICAgICAgICAgY29uc3QgcHJvcGVydHkgPSBmXG4gICAgICAgICAgICAuc2xpY2UoMSwgLTEpXG4gICAgICAgICAgICAucmVwbGFjZSgvXFxcXCcvZywgJ1xcJycpXG4gICAgICAgICAgICAucmVwbGFjZSgvXFxcXG4vZywgJ1xcbicpXG4gICAgICAgICAgICAucmVwbGFjZSgvXFxcXHIvZywgJ1xccicpXG4gICAgICAgICAgICAucmVwbGFjZSgvXFxcXGYvZywgJ1xcZicpXG4gICAgICAgICAgICAucmVwbGFjZSgvXFxcXHQvZywgJ1xcdCcpO1xuXG4gICAgICAgICAgLy8gV2Uga25vdyB3ZSBuZWVkIGFuIG9iamVjdCBiZWNhdXNlIHRoZSBmcmFnbWVudCBpcyBhIHByb3BlcnR5IGtleS5cbiAgICAgICAgICBpZiAoIWRhdGEgJiYgcGFyZW50ICE9PSBudWxsICYmIHBhcmVudFByb3BlcnR5KSB7XG4gICAgICAgICAgICBkYXRhID0gcGFyZW50W3BhcmVudFByb3BlcnR5XSA9IHt9O1xuICAgICAgICAgIH1cbiAgICAgICAgICBwYXJlbnQgPSBkYXRhO1xuICAgICAgICAgIHBhcmVudFByb3BlcnR5ID0gcHJvcGVydHk7XG5cbiAgICAgICAgICBkYXRhID0gZGF0YVtwcm9wZXJ0eV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChwYXJlbnQgJiYgcGFyZW50UHJvcGVydHkgJiYgcGFyZW50W3BhcmVudFByb3BlcnR5XSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHBhcmVudFtwYXJlbnRQcm9wZXJ0eV0gPSB2YWx1ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gb2JzZXJ2YWJsZU9mKGRhdGEpLnBpcGUoXG4gICAgICAuLi5bLi4udGhpcy5fc21hcnREZWZhdWx0UmVjb3JkLmVudHJpZXMoKV0ubWFwKChbcG9pbnRlciwgc2NoZW1hXSkgPT4ge1xuICAgICAgICByZXR1cm4gY29uY2F0TWFwKGRhdGEgPT4ge1xuICAgICAgICAgIGNvbnN0IGZyYWdtZW50cyA9IEpTT04ucGFyc2UocG9pbnRlcik7XG4gICAgICAgICAgY29uc3Qgc291cmNlID0gdGhpcy5fc291cmNlTWFwLmdldCgoc2NoZW1hIGFzIEpzb25PYmplY3QpLiRzb3VyY2UgYXMgc3RyaW5nKTtcblxuICAgICAgICAgIGlmICghc291cmNlKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgc291cmNlLicpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGxldCB2YWx1ZSA9IHNvdXJjZShzY2hlbWEpO1xuICAgICAgICAgIGlmICghaXNPYnNlcnZhYmxlKHZhbHVlKSkge1xuICAgICAgICAgICAgdmFsdWUgPSBvYnNlcnZhYmxlT2YodmFsdWUpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiAodmFsdWUgYXMgT2JzZXJ2YWJsZTx7fT4pLnBpcGUoXG4gICAgICAgICAgICAvLyBTeW5jaHJvbm91c2x5IHNldCB0aGUgbmV3IGRhdGEgYXQgdGhlIHByb3BlciBKc29uU2NoZW1hIHBhdGguXG4gICAgICAgICAgICB0YXAoeCA9PiBfc2V0KGRhdGEsIGZyYWdtZW50cywgeCkpLFxuICAgICAgICAgICAgLy8gQnV0IHJldHVybiB0aGUgZGF0YSBvYmplY3QuXG4gICAgICAgICAgICBtYXAoKCkgPT4gZGF0YSksXG4gICAgICAgICAgKTtcbiAgICAgICAgfSk7XG4gICAgICB9KSxcbiAgICApO1xuICB9XG59XG4iXX0=