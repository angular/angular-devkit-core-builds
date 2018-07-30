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
        this._ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-06.json'));
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
            const maybeFnValidate = this._ajv.compile(schema);
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
                errors: false,
                valid: true,
                compile: (schema, _parentSchema, it) => {
                    // We cheat, heavily.
                    this._smartDefaultRecord.set(
                    // tslint:disable-next-line:no-any
                    JSON.stringify(it.dataPathArr.slice(1, it.dataLevel + 1)), schema);
                    return () => true;
                },
                metaSchema: {
                    type: 'object',
                    properties: {
                        '$source': { type: 'string' },
                    },
                    additionalProperties: true,
                    required: ['$source'],
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
                let value = source ? source(schema) : rxjs_1.of(undefined);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVnaXN0cnkuanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2NvcmUvc3JjL2pzb24vc2NoZW1hL3JlZ2lzdHJ5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUE7Ozs7OztHQU1HO0FBQ0gsMkJBQTJCO0FBQzNCLDZCQUE2QjtBQUM3QiwrQkFBNEQ7QUFDNUQsOENBQWdFO0FBQ2hFLHlEQUEwRDtBQUMxRCx1Q0FBZ0U7QUFXaEUsNkNBQW9EO0FBQ3BELHVDQUFtRDtBQVduRCwrQkFBdUMsU0FBUSx5QkFBYTtJQUcxRCxZQUNFLE1BQStCLEVBQy9CLFdBQVcsR0FBRyxxREFBcUQ7UUFFbkUsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLElBQUksTUFBTSxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ25DLEtBQUssQ0FBQywyQkFBMkIsQ0FBQyxDQUFDO1lBRW5DLE1BQU0sQ0FBQztRQUNULENBQUM7UUFFRCxNQUFNLFFBQVEsR0FBRyx5QkFBeUIsQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDbEUsS0FBSyxDQUFDLEdBQUcsV0FBVyxPQUFPLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ3BELElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO0lBQ3ZCLENBQUM7SUFFTSxNQUFNLENBQUMsY0FBYyxDQUFDLE1BQStCO1FBQzFELEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxJQUFJLE1BQU0sQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNuQyxNQUFNLENBQUMsRUFBRSxDQUFDO1FBQ1osQ0FBQztRQUVELE1BQU0sUUFBUSxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRTtZQUNsQyxJQUFJLE9BQU8sR0FBRyxhQUFhLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxD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ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCAqIGFzIGFqdiBmcm9tICdhanYnO1xuaW1wb3J0ICogYXMgaHR0cCBmcm9tICdodHRwJztcbmltcG9ydCB7IE9ic2VydmFibGUsIGZyb20sIG9mIGFzIG9ic2VydmFibGVPZiB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgY29uY2F0TWFwLCBtYXAsIHN3aXRjaE1hcCwgdGFwIH0gZnJvbSAncnhqcy9vcGVyYXRvcnMnO1xuaW1wb3J0IHsgQmFzZUV4Y2VwdGlvbiB9IGZyb20gJy4uLy4uL2V4Y2VwdGlvbi9leGNlcHRpb24nO1xuaW1wb3J0IHsgUGFydGlhbGx5T3JkZXJlZFNldCwgaXNPYnNlcnZhYmxlIH0gZnJvbSAnLi4vLi4vdXRpbHMnO1xuaW1wb3J0IHsgSnNvbk9iamVjdCwgSnNvblZhbHVlIH0gZnJvbSAnLi4vaW50ZXJmYWNlJztcbmltcG9ydCB7XG4gIFNjaGVtYUZvcm1hdCxcbiAgU2NoZW1hRm9ybWF0dGVyLFxuICBTY2hlbWFSZWdpc3RyeSxcbiAgU2NoZW1hVmFsaWRhdG9yLFxuICBTY2hlbWFWYWxpZGF0b3JFcnJvcixcbiAgU2NoZW1hVmFsaWRhdG9yUmVzdWx0LFxuICBTbWFydERlZmF1bHRQcm92aWRlcixcbn0gZnJvbSAnLi9pbnRlcmZhY2UnO1xuaW1wb3J0IHsgYWRkVW5kZWZpbmVkRGVmYXVsdHMgfSBmcm9tICcuL3RyYW5zZm9ybXMnO1xuaW1wb3J0IHsgSnNvblZpc2l0b3IsIHZpc2l0SnNvbiB9IGZyb20gJy4vdmlzaXRvcic7XG5cblxuLy8gVGhpcyBpbnRlcmZhY2Ugc2hvdWxkIGJlIGV4cG9ydGVkIGZyb20gYWp2LCBidXQgdGhleSBvbmx5IGV4cG9ydCB0aGUgY2xhc3MgYW5kIG5vdCB0aGUgdHlwZS5cbmludGVyZmFjZSBBanZWYWxpZGF0aW9uRXJyb3Ige1xuICBtZXNzYWdlOiBzdHJpbmc7XG4gIGVycm9yczogQXJyYXk8YWp2LkVycm9yT2JqZWN0PjtcbiAgYWp2OiB0cnVlO1xuICB2YWxpZGF0aW9uOiB0cnVlO1xufVxuXG5leHBvcnQgY2xhc3MgU2NoZW1hVmFsaWRhdGlvbkV4Y2VwdGlvbiBleHRlbmRzIEJhc2VFeGNlcHRpb24ge1xuICBwdWJsaWMgcmVhZG9ubHkgZXJyb3JzOiBTY2hlbWFWYWxpZGF0b3JFcnJvcltdO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIGVycm9ycz86IFNjaGVtYVZhbGlkYXRvckVycm9yW10sXG4gICAgYmFzZU1lc3NhZ2UgPSAnU2NoZW1hIHZhbGlkYXRpb24gZmFpbGVkIHdpdGggdGhlIGZvbGxvd2luZyBlcnJvcnM6JyxcbiAgKSB7XG4gICAgaWYgKCFlcnJvcnMgfHwgZXJyb3JzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgc3VwZXIoJ1NjaGVtYSB2YWxpZGF0aW9uIGZhaWxlZC4nKTtcblxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IG1lc3NhZ2VzID0gU2NoZW1hVmFsaWRhdGlvbkV4Y2VwdGlvbi5jcmVhdGVNZXNzYWdlcyhlcnJvcnMpO1xuICAgIHN1cGVyKGAke2Jhc2VNZXNzYWdlfVxcbiAgJHttZXNzYWdlcy5qb2luKCdcXG4gICcpfWApO1xuICAgIHRoaXMuZXJyb3JzID0gZXJyb3JzO1xuICB9XG5cbiAgcHVibGljIHN0YXRpYyBjcmVhdGVNZXNzYWdlcyhlcnJvcnM/OiBTY2hlbWFWYWxpZGF0b3JFcnJvcltdKTogc3RyaW5nW10ge1xuICAgIGlmICghZXJyb3JzIHx8IGVycm9ycy5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICBjb25zdCBtZXNzYWdlcyA9IGVycm9ycy5tYXAoKGVycikgPT4ge1xuICAgICAgbGV0IG1lc3NhZ2UgPSBgRGF0YSBwYXRoICR7SlNPTi5zdHJpbmdpZnkoZXJyLmRhdGFQYXRoKX0gJHtlcnIubWVzc2FnZX1gO1xuICAgICAgaWYgKGVyci5rZXl3b3JkID09PSAnYWRkaXRpb25hbFByb3BlcnRpZXMnKSB7XG4gICAgICAgIG1lc3NhZ2UgKz0gYCgke2Vyci5wYXJhbXMuYWRkaXRpb25hbFByb3BlcnR5fSlgO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gbWVzc2FnZSArICcuJztcbiAgICB9KTtcblxuICAgIHJldHVybiBtZXNzYWdlcztcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgQ29yZVNjaGVtYVJlZ2lzdHJ5IGltcGxlbWVudHMgU2NoZW1hUmVnaXN0cnkge1xuICBwcml2YXRlIF9hanY6IGFqdi5BanY7XG4gIHByaXZhdGUgX3VyaUNhY2hlID0gbmV3IE1hcDxzdHJpbmcsIEpzb25PYmplY3Q+KCk7XG4gIHByaXZhdGUgX3ByZSA9IG5ldyBQYXJ0aWFsbHlPcmRlcmVkU2V0PEpzb25WaXNpdG9yPigpO1xuICBwcml2YXRlIF9wb3N0ID0gbmV3IFBhcnRpYWxseU9yZGVyZWRTZXQ8SnNvblZpc2l0b3I+KCk7XG5cbiAgcHJpdmF0ZSBfc21hcnREZWZhdWx0S2V5d29yZCA9IGZhbHNlO1xuICBwcml2YXRlIF9zb3VyY2VNYXAgPSBuZXcgTWFwPHN0cmluZywgU21hcnREZWZhdWx0UHJvdmlkZXI8e30+PigpO1xuICBwcml2YXRlIF9zbWFydERlZmF1bHRSZWNvcmQgPSBuZXcgTWFwPHN0cmluZywgSnNvbk9iamVjdD4oKTtcblxuICBjb25zdHJ1Y3Rvcihmb3JtYXRzOiBTY2hlbWFGb3JtYXRbXSA9IFtdKSB7XG4gICAgLyoqXG4gICAgICogQnVpbGQgYW4gQUpWIGluc3RhbmNlIHRoYXQgd2lsbCBiZSB1c2VkIHRvIHZhbGlkYXRlIHNjaGVtYXMuXG4gICAgICovXG5cbiAgICBjb25zdCBmb3JtYXRzT2JqOiB7IFtuYW1lOiBzdHJpbmddOiBTY2hlbWFGb3JtYXR0ZXIgfSA9IHt9O1xuXG4gICAgZm9yIChjb25zdCBmb3JtYXQgb2YgZm9ybWF0cykge1xuICAgICAgZm9ybWF0c09ialtmb3JtYXQubmFtZV0gPSBmb3JtYXQuZm9ybWF0dGVyO1xuICAgIH1cblxuICAgIHRoaXMuX2FqdiA9IGFqdih7XG4gICAgICB1c2VEZWZhdWx0czogdHJ1ZSxcbiAgICAgIGZvcm1hdHM6IGZvcm1hdHNPYmosXG4gICAgICBsb2FkU2NoZW1hOiAodXJpOiBzdHJpbmcpID0+IHRoaXMuX2ZldGNoKHVyaSksXG4gICAgICBzY2hlbWFJZDogJ2F1dG8nLFxuICAgIH0pO1xuXG4gICAgdGhpcy5fYWp2LmFkZE1ldGFTY2hlbWEocmVxdWlyZSgnYWp2L2xpYi9yZWZzL2pzb24tc2NoZW1hLWRyYWZ0LTA0Lmpzb24nKSk7XG4gICAgdGhpcy5fYWp2LmFkZE1ldGFTY2hlbWEocmVxdWlyZSgnYWp2L2xpYi9yZWZzL2pzb24tc2NoZW1hLWRyYWZ0LTA2Lmpzb24nKSk7XG5cbiAgICB0aGlzLmFkZFBvc3RUcmFuc2Zvcm0oYWRkVW5kZWZpbmVkRGVmYXVsdHMpO1xuICB9XG5cbiAgcHJpdmF0ZSBfZmV0Y2godXJpOiBzdHJpbmcpOiBQcm9taXNlPEpzb25PYmplY3Q+IHtcbiAgICBjb25zdCBtYXliZVNjaGVtYSA9IHRoaXMuX3VyaUNhY2hlLmdldCh1cmkpO1xuXG4gICAgaWYgKG1heWJlU2NoZW1hKSB7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKG1heWJlU2NoZW1hKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IFByb21pc2U8SnNvbk9iamVjdD4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgaHR0cC5nZXQodXJpLCByZXMgPT4ge1xuICAgICAgICBpZiAoIXJlcy5zdGF0dXNDb2RlIHx8IHJlcy5zdGF0dXNDb2RlID49IDMwMCkge1xuICAgICAgICAgIC8vIENvbnN1bWUgdGhlIHJlc3Qgb2YgdGhlIGRhdGEgdG8gZnJlZSBtZW1vcnkuXG4gICAgICAgICAgcmVzLnJlc3VtZSgpO1xuICAgICAgICAgIHJlamVjdChgUmVxdWVzdCBmYWlsZWQuIFN0YXR1cyBDb2RlOiAke3Jlcy5zdGF0dXNDb2RlfWApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlcy5zZXRFbmNvZGluZygndXRmOCcpO1xuICAgICAgICAgIGxldCBkYXRhID0gJyc7XG4gICAgICAgICAgcmVzLm9uKCdkYXRhJywgY2h1bmsgPT4ge1xuICAgICAgICAgICAgZGF0YSArPSBjaHVuaztcbiAgICAgICAgICB9KTtcbiAgICAgICAgICByZXMub24oJ2VuZCcsICgpID0+IHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGNvbnN0IGpzb24gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgICAgICAgICAgICB0aGlzLl91cmlDYWNoZS5zZXQodXJpLCBqc29uKTtcbiAgICAgICAgICAgICAgcmVzb2x2ZShqc29uKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQWRkIGEgdHJhbnNmb3JtYXRpb24gc3RlcCBiZWZvcmUgdGhlIHZhbGlkYXRpb24gb2YgYW55IEpzb24uXG4gICAqIEBwYXJhbSB7SnNvblZpc2l0b3J9IHZpc2l0b3IgVGhlIHZpc2l0b3IgdG8gdHJhbnNmb3JtIGV2ZXJ5IHZhbHVlLlxuICAgKiBAcGFyYW0ge0pzb25WaXNpdG9yW119IGRlcHMgQSBsaXN0IG9mIG90aGVyIHZpc2l0b3JzIHRvIHJ1biBiZWZvcmUuXG4gICAqL1xuICBhZGRQcmVUcmFuc2Zvcm0odmlzaXRvcjogSnNvblZpc2l0b3IsIGRlcHM/OiBKc29uVmlzaXRvcltdKSB7XG4gICAgdGhpcy5fcHJlLmFkZCh2aXNpdG9yLCBkZXBzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGQgYSB0cmFuc2Zvcm1hdGlvbiBzdGVwIGFmdGVyIHRoZSB2YWxpZGF0aW9uIG9mIGFueSBKc29uLiBUaGUgSlNPTiB3aWxsIG5vdCBiZSB2YWxpZGF0ZWRcbiAgICogYWZ0ZXIgdGhlIFBPU1QsIHNvIGlmIHRyYW5zZm9ybWF0aW9ucyBhcmUgbm90IGNvbXBhdGlibGUgd2l0aCB0aGUgU2NoZW1hIGl0IHdpbGwgbm90IHJlc3VsdFxuICAgKiBpbiBhbiBlcnJvci5cbiAgICogQHBhcmFtIHtKc29uVmlzaXRvcn0gdmlzaXRvciBUaGUgdmlzaXRvciB0byB0cmFuc2Zvcm0gZXZlcnkgdmFsdWUuXG4gICAqIEBwYXJhbSB7SnNvblZpc2l0b3JbXX0gZGVwcyBBIGxpc3Qgb2Ygb3RoZXIgdmlzaXRvcnMgdG8gcnVuIGJlZm9yZS5cbiAgICovXG4gIGFkZFBvc3RUcmFuc2Zvcm0odmlzaXRvcjogSnNvblZpc2l0b3IsIGRlcHM/OiBKc29uVmlzaXRvcltdKSB7XG4gICAgdGhpcy5fcG9zdC5hZGQodmlzaXRvciwgZGVwcyk7XG4gIH1cblxuICBwcm90ZWN0ZWQgX3Jlc29sdmVyKFxuICAgIHJlZjogc3RyaW5nLFxuICAgIHZhbGlkYXRlOiBhanYuVmFsaWRhdGVGdW5jdGlvbixcbiAgKTogeyBjb250ZXh0PzogYWp2LlZhbGlkYXRlRnVuY3Rpb24sIHNjaGVtYT86IEpzb25PYmplY3QgfSB7XG4gICAgaWYgKCF2YWxpZGF0ZSkge1xuICAgICAgcmV0dXJuIHt9O1xuICAgIH1cblxuICAgIGNvbnN0IHJlZkhhc2ggPSByZWYuc3BsaXQoJyMnLCAyKVsxXTtcbiAgICBjb25zdCByZWZVcmwgPSByZWYuc3RhcnRzV2l0aCgnIycpID8gcmVmIDogcmVmLnNwbGl0KCcjJywgMSk7XG5cbiAgICBpZiAoIXJlZi5zdGFydHNXaXRoKCcjJykpIHtcbiAgICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby1hbnlcbiAgICAgIHZhbGlkYXRlID0gKHZhbGlkYXRlLnJlZlZhbCBhcyBhbnkpWyh2YWxpZGF0ZS5yZWZzIGFzIGFueSlbcmVmVXJsWzBdXV07XG4gICAgfVxuICAgIGlmICh2YWxpZGF0ZSAmJiByZWZIYXNoKSB7XG4gICAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tYW55XG4gICAgICB2YWxpZGF0ZSA9ICh2YWxpZGF0ZS5yZWZWYWwgYXMgYW55KVsodmFsaWRhdGUucmVmcyBhcyBhbnkpWycjJyArIHJlZkhhc2hdXTtcbiAgICB9XG5cbiAgICByZXR1cm4geyBjb250ZXh0OiB2YWxpZGF0ZSwgc2NoZW1hOiB2YWxpZGF0ZSAmJiB2YWxpZGF0ZS5zY2hlbWEgYXMgSnNvbk9iamVjdCB9O1xuICB9XG5cbiAgY29tcGlsZShzY2hlbWE6IEpzb25PYmplY3QpOiBPYnNlcnZhYmxlPFNjaGVtYVZhbGlkYXRvcj4ge1xuICAgIC8vIFN1cHBvcnRzIGJvdGggc3luY2hyb25vdXMgYW5kIGFzeW5jaHJvbm91cyBjb21waWxhdGlvbiwgYnkgdHJ5aW5nIHRoZSBzeW5jaHJvbm91c1xuICAgIC8vIHZlcnNpb24gZmlyc3QsIHRoZW4gaWYgcmVmcyBhcmUgbWlzc2luZyB0aGlzIHdpbGwgZmFpbHMuXG4gICAgLy8gV2UgYWxzbyBhZGQgYW55IHJlZnMgZnJvbSBleHRlcm5hbCBmZXRjaGVkIHNjaGVtYXMgc28gdGhhdCB0aG9zZSB3aWxsIGFsc28gYmUgdXNlZFxuICAgIC8vIGluIHN5bmNocm9ub3VzIChpZiBhdmFpbGFibGUpLlxuICAgIGxldCB2YWxpZGF0b3I6IE9ic2VydmFibGU8YWp2LlZhbGlkYXRlRnVuY3Rpb24+O1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBtYXliZUZuVmFsaWRhdGUgPSB0aGlzLl9hanYuY29tcGlsZShzY2hlbWEpO1xuICAgICAgdmFsaWRhdG9yID0gb2JzZXJ2YWJsZU9mKG1heWJlRm5WYWxpZGF0ZSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgLy8gUHJvcGFnYXRlIHRoZSBlcnJvci5cbiAgICAgIGlmICghKGUgaW5zdGFuY2VvZiAoYWp2Lk1pc3NpbmdSZWZFcnJvciBhcyB7fSBhcyBGdW5jdGlvbikpKSB7XG4gICAgICAgIHRocm93IGU7XG4gICAgICB9XG5cbiAgICAgIHZhbGlkYXRvciA9IG5ldyBPYnNlcnZhYmxlKG9icyA9PiB7XG4gICAgICAgIHRoaXMuX2Fqdi5jb21waWxlQXN5bmMoc2NoZW1hKVxuICAgICAgICAgIC50aGVuKHZhbGlkYXRlID0+IHtcbiAgICAgICAgICAgIG9icy5uZXh0KHZhbGlkYXRlKTtcbiAgICAgICAgICAgIG9icy5jb21wbGV0ZSgpO1xuICAgICAgICAgIH0sIGVyciA9PiB7XG4gICAgICAgICAgICBvYnMuZXJyb3IoZXJyKTtcbiAgICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiB2YWxpZGF0b3JcbiAgICAgIC5waXBlKFxuICAgICAgICBtYXAodmFsaWRhdGUgPT4gKGRhdGE6IEpzb25WYWx1ZSk6IE9ic2VydmFibGU8U2NoZW1hVmFsaWRhdG9yUmVzdWx0PiA9PiB7XG4gICAgICAgICAgcmV0dXJuIG9ic2VydmFibGVPZihkYXRhKS5waXBlKFxuICAgICAgICAgICAgLi4uWy4uLnRoaXMuX3ByZV0ubWFwKHZpc2l0b3IgPT4gY29uY2F0TWFwKChkYXRhOiBKc29uVmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgcmV0dXJuIHZpc2l0SnNvbihkYXRhLCB2aXNpdG9yLCBzY2hlbWEsIHRoaXMuX3Jlc29sdmVyLCB2YWxpZGF0ZSk7XG4gICAgICAgICAgICB9KSksXG4gICAgICAgICAgKS5waXBlKFxuICAgICAgICAgICAgc3dpdGNoTWFwKHVwZGF0ZWREYXRhID0+IHtcbiAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gdmFsaWRhdGUodXBkYXRlZERhdGEpO1xuXG4gICAgICAgICAgICAgIHJldHVybiB0eXBlb2YgcmVzdWx0ID09ICdib29sZWFuJ1xuICAgICAgICAgICAgICAgID8gb2JzZXJ2YWJsZU9mKFt1cGRhdGVkRGF0YSwgcmVzdWx0XSlcbiAgICAgICAgICAgICAgICA6IGZyb20oKHJlc3VsdCBhcyBQcm9taXNlPGJvb2xlYW4+KVxuICAgICAgICAgICAgICAgICAgLnRoZW4ociA9PiBbdXBkYXRlZERhdGEsIHRydWVdKVxuICAgICAgICAgICAgICAgICAgLmNhdGNoKChlcnI6IEVycm9yIHwgQWp2VmFsaWRhdGlvbkVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmICgoZXJyIGFzIEFqdlZhbGlkYXRpb25FcnJvcikuYWp2KSB7XG4gICAgICAgICAgICAgICAgICAgICAgdmFsaWRhdGUuZXJyb3JzID0gKGVyciBhcyBBanZWYWxpZGF0aW9uRXJyb3IpLmVycm9ycztcblxuICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoW3VwZGF0ZWREYXRhLCBmYWxzZV0pO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycik7XG4gICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIHN3aXRjaE1hcCgoW2RhdGEsIHZhbGlkXSkgPT4ge1xuICAgICAgICAgICAgICBpZiAodmFsaWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fYXBwbHlTbWFydERlZmF1bHRzKGRhdGEpLnBpcGUoXG4gICAgICAgICAgICAgICAgICAuLi5bLi4udGhpcy5fcG9zdF0ubWFwKHZpc2l0b3IgPT4gY29uY2F0TWFwKGRhdGEgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdmlzaXRKc29uKGRhdGEgYXMgSnNvblZhbHVlLCB2aXNpdG9yLCBzY2hlbWEsIHRoaXMuX3Jlc29sdmVyLCB2YWxpZGF0ZSk7XG4gICAgICAgICAgICAgICAgICB9KSksXG4gICAgICAgICAgICAgICAgKS5waXBlKFxuICAgICAgICAgICAgICAgICAgbWFwKGRhdGEgPT4gW2RhdGEsIHZhbGlkXSksXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gb2JzZXJ2YWJsZU9mKFtkYXRhLCB2YWxpZF0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIG1hcCgoW2RhdGEsIHZhbGlkXSkgPT4ge1xuICAgICAgICAgICAgICBpZiAodmFsaWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBkYXRhLCBzdWNjZXNzOiB0cnVlIH0gYXMgU2NoZW1hVmFsaWRhdG9yUmVzdWx0O1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBkYXRhLFxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGVycm9yczogKHZhbGlkYXRlLmVycm9ycyB8fCBbXSksXG4gICAgICAgICAgICAgIH0gYXMgU2NoZW1hVmFsaWRhdG9yUmVzdWx0O1xuICAgICAgICAgICAgfSksXG4gICAgICAgICAgKTtcbiAgICAgICAgfSksXG4gICAgICApO1xuICB9XG5cbiAgYWRkRm9ybWF0KGZvcm1hdDogU2NoZW1hRm9ybWF0KTogdm9pZCB7XG4gICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWFueVxuICAgIGNvbnN0IHZhbGlkYXRlID0gKGRhdGE6IGFueSkgPT4ge1xuICAgICAgY29uc3QgcmVzdWx0ID0gZm9ybWF0LmZvcm1hdHRlci52YWxpZGF0ZShkYXRhKTtcblxuICAgICAgaWYgKHR5cGVvZiByZXN1bHQgPT0gJ2Jvb2xlYW4nKSB7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gcmVzdWx0LnRvUHJvbWlzZSgpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICB0aGlzLl9hanYuYWRkRm9ybWF0KGZvcm1hdC5uYW1lLCB7XG4gICAgICBhc3luYzogZm9ybWF0LmZvcm1hdHRlci5hc3luYyxcbiAgICAgIHZhbGlkYXRlLFxuICAgIC8vIEFKViB0eXBpbmdzIGxpc3QgYGNvbXBhcmVgIGFzIHJlcXVpcmVkLCBidXQgaXQgaXMgb3B0aW9uYWwuXG4gICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWFueVxuICAgIH0gYXMgYW55KTtcbiAgfVxuXG4gIGFkZFNtYXJ0RGVmYXVsdFByb3ZpZGVyPFQ+KHNvdXJjZTogc3RyaW5nLCBwcm92aWRlcjogU21hcnREZWZhdWx0UHJvdmlkZXI8VD4pIHtcbiAgICBpZiAodGhpcy5fc291cmNlTWFwLmhhcyhzb3VyY2UpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3Ioc291cmNlKTtcbiAgICB9XG5cbiAgICB0aGlzLl9zb3VyY2VNYXAuc2V0KHNvdXJjZSwgcHJvdmlkZXIpO1xuXG4gICAgaWYgKCF0aGlzLl9zbWFydERlZmF1bHRLZXl3b3JkKSB7XG4gICAgICB0aGlzLl9zbWFydERlZmF1bHRLZXl3b3JkID0gdHJ1ZTtcblxuICAgICAgdGhpcy5fYWp2LmFkZEtleXdvcmQoJyRkZWZhdWx0Jywge1xuICAgICAgICBlcnJvcnM6IGZhbHNlLFxuICAgICAgICB2YWxpZDogdHJ1ZSxcbiAgICAgICAgY29tcGlsZTogKHNjaGVtYSwgX3BhcmVudFNjaGVtYSwgaXQpID0+IHtcbiAgICAgICAgICAvLyBXZSBjaGVhdCwgaGVhdmlseS5cbiAgICAgICAgICB0aGlzLl9zbWFydERlZmF1bHRSZWNvcmQuc2V0KFxuICAgICAgICAgICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWFueVxuICAgICAgICAgICAgSlNPTi5zdHJpbmdpZnkoKGl0IGFzIGFueSkuZGF0YVBhdGhBcnIuc2xpY2UoMSwgKGl0IGFzIGFueSkuZGF0YUxldmVsICsgMSkgYXMgc3RyaW5nW10pLFxuICAgICAgICAgICAgc2NoZW1hLFxuICAgICAgICAgICk7XG5cbiAgICAgICAgICByZXR1cm4gKCkgPT4gdHJ1ZTtcbiAgICAgICAgfSxcbiAgICAgICAgbWV0YVNjaGVtYToge1xuICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICckc291cmNlJzogeyB0eXBlOiAnc3RyaW5nJyB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgYWRkaXRpb25hbFByb3BlcnRpZXM6IHRydWUsXG4gICAgICAgICAgcmVxdWlyZWQ6IFsgJyRzb3VyY2UnIF0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tYW55XG4gIHByaXZhdGUgX2FwcGx5U21hcnREZWZhdWx0cyhkYXRhOiBhbnkpOiBPYnNlcnZhYmxlPGFueT4ge1xuICAgIGZ1bmN0aW9uIF9zZXQoXG4gICAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tYW55XG4gICAgICBkYXRhOiBhbnksXG4gICAgICBmcmFnbWVudHM6IHN0cmluZ1tdLFxuICAgICAgdmFsdWU6IHt9LFxuICAgICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWFueVxuICAgICAgcGFyZW50OiBhbnkgfCBudWxsID0gbnVsbCxcbiAgICAgIHBhcmVudFByb3BlcnR5Pzogc3RyaW5nLFxuICAgICk6IHZvaWQge1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBmcmFnbWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29uc3QgZiA9IGZyYWdtZW50c1tpXTtcblxuICAgICAgICBpZiAoZlswXSA9PSAnaScpIHtcbiAgICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkoZGF0YSkpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGRhdGEubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgIF9zZXQoZGF0YVtqXSwgZnJhZ21lbnRzLnNsaWNlKGkgKyAxKSwgdmFsdWUsIGRhdGEsICcnICsgaik7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9IGVsc2UgaWYgKGYuc3RhcnRzV2l0aCgna2V5JykpIHtcbiAgICAgICAgICBpZiAodHlwZW9mIGRhdGEgIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoZGF0YSkuZm9yRWFjaChwcm9wZXJ0eSA9PiB7XG4gICAgICAgICAgICBfc2V0KGRhdGFbcHJvcGVydHldLCBmcmFnbWVudHMuc2xpY2UoaSArIDEpLCB2YWx1ZSwgZGF0YSwgcHJvcGVydHkpO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9IGVsc2UgaWYgKGYuc3RhcnRzV2l0aCgnXFwnJykgJiYgZltmLmxlbmd0aCAtIDFdID09ICdcXCcnKSB7XG4gICAgICAgICAgY29uc3QgcHJvcGVydHkgPSBmXG4gICAgICAgICAgICAuc2xpY2UoMSwgLTEpXG4gICAgICAgICAgICAucmVwbGFjZSgvXFxcXCcvZywgJ1xcJycpXG4gICAgICAgICAgICAucmVwbGFjZSgvXFxcXG4vZywgJ1xcbicpXG4gICAgICAgICAgICAucmVwbGFjZSgvXFxcXHIvZywgJ1xccicpXG4gICAgICAgICAgICAucmVwbGFjZSgvXFxcXGYvZywgJ1xcZicpXG4gICAgICAgICAgICAucmVwbGFjZSgvXFxcXHQvZywgJ1xcdCcpO1xuXG4gICAgICAgICAgLy8gV2Uga25vdyB3ZSBuZWVkIGFuIG9iamVjdCBiZWNhdXNlIHRoZSBmcmFnbWVudCBpcyBhIHByb3BlcnR5IGtleS5cbiAgICAgICAgICBpZiAoIWRhdGEgJiYgcGFyZW50ICE9PSBudWxsICYmIHBhcmVudFByb3BlcnR5KSB7XG4gICAgICAgICAgICBkYXRhID0gcGFyZW50W3BhcmVudFByb3BlcnR5XSA9IHt9O1xuICAgICAgICAgIH1cbiAgICAgICAgICBwYXJlbnQgPSBkYXRhO1xuICAgICAgICAgIHBhcmVudFByb3BlcnR5ID0gcHJvcGVydHk7XG5cbiAgICAgICAgICBkYXRhID0gZGF0YVtwcm9wZXJ0eV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChwYXJlbnQgJiYgcGFyZW50UHJvcGVydHkgJiYgcGFyZW50W3BhcmVudFByb3BlcnR5XSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHBhcmVudFtwYXJlbnRQcm9wZXJ0eV0gPSB2YWx1ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gb2JzZXJ2YWJsZU9mKGRhdGEpLnBpcGUoXG4gICAgICAuLi5bLi4udGhpcy5fc21hcnREZWZhdWx0UmVjb3JkLmVudHJpZXMoKV0ubWFwKChbcG9pbnRlciwgc2NoZW1hXSkgPT4ge1xuICAgICAgICByZXR1cm4gY29uY2F0TWFwKGRhdGEgPT4ge1xuICAgICAgICAgIGNvbnN0IGZyYWdtZW50cyA9IEpTT04ucGFyc2UocG9pbnRlcik7XG4gICAgICAgICAgY29uc3Qgc291cmNlID0gdGhpcy5fc291cmNlTWFwLmdldCgoc2NoZW1hIGFzIEpzb25PYmplY3QpLiRzb3VyY2UgYXMgc3RyaW5nKTtcblxuICAgICAgICAgIGxldCB2YWx1ZSA9IHNvdXJjZSA/IHNvdXJjZShzY2hlbWEpIDogb2JzZXJ2YWJsZU9mKHVuZGVmaW5lZCk7XG5cbiAgICAgICAgICBpZiAoIWlzT2JzZXJ2YWJsZSh2YWx1ZSkpIHtcbiAgICAgICAgICAgIHZhbHVlID0gb2JzZXJ2YWJsZU9mKHZhbHVlKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gKHZhbHVlIGFzIE9ic2VydmFibGU8e30+KS5waXBlKFxuICAgICAgICAgICAgLy8gU3luY2hyb25vdXNseSBzZXQgdGhlIG5ldyBkYXRhIGF0IHRoZSBwcm9wZXIgSnNvblNjaGVtYSBwYXRoLlxuICAgICAgICAgICAgdGFwKHggPT4gX3NldChkYXRhLCBmcmFnbWVudHMsIHgpKSxcbiAgICAgICAgICAgIC8vIEJ1dCByZXR1cm4gdGhlIGRhdGEgb2JqZWN0LlxuICAgICAgICAgICAgbWFwKCgpID0+IGRhdGEpLFxuICAgICAgICAgICk7XG4gICAgICAgIH0pO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxufVxuIl19