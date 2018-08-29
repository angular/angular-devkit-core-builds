"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
const serialize = require('fast-json-stable-stringify');
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
        this._validatorCache = new Map();
        this._smartDefaultKeyword = false;
        this._sourceMap = new Map();
        const formatsObj = {};
        for (const format of formats) {
            formatsObj[format.name] = format.formatter;
        }
        this._ajv = ajv({
            formats: formatsObj,
            loadSchema: (uri) => this._fetch(uri),
            schemaId: 'auto',
            passContext: true,
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
        if (!validate || !validate.refs || !validate.refVal || !ref) {
            return {};
        }
        // tslint:disable-next-line:no-any
        const id = validate.schema.$id || validate.schema.id;
        let fullReference = (ref[0] === '#' && id) ? id + ref : ref;
        if (fullReference.endsWith('#')) {
            fullReference = fullReference.slice(0, -1);
        }
        // tslint:disable-next-line:no-any
        const context = validate.refVal[validate.refs[fullReference]];
        return { context, schema: context && context.schema };
    }
    compile(schema) {
        const schemaKey = serialize(schema);
        const existingValidator = this._validatorCache.get(schemaKey);
        if (existingValidator) {
            return rxjs_1.of(existingValidator);
        }
        const schemaInfo = {
            smartDefaultRecord: new Map(),
            promptDefinitions: [],
        };
        // Supports both synchronous and asynchronous compilation, by trying the synchronous
        // version first, then if refs are missing this will fails.
        // We also add any refs from external fetched schemas so that those will also be used
        // in synchronous (if available).
        let validator;
        try {
            this._currentCompilationSchemaInfo = schemaInfo;
            validator = rxjs_1.of(this._ajv.compile(schema));
        }
        catch (e) {
            // Propagate the error.
            if (!(e instanceof ajv.MissingRefError)) {
                return rxjs_1.throwError(e);
            }
            try {
                validator = rxjs_1.from(this._ajv.compileAsync(schema));
            }
            catch (e) {
                return rxjs_1.throwError(e);
            }
        }
        return validator
            .pipe(operators_1.map(validate => (data, options) => {
            const validationOptions = Object.assign({ withPrompts: true }, options);
            const validationContext = {
                promptFieldsWithValue: new Set(),
            };
            return rxjs_1.of(data).pipe(...[...this._pre].map(visitor => operators_1.concatMap((data) => {
                return visitor_1.visitJson(data, visitor, schema, this._resolver, validate);
            }))).pipe(operators_1.switchMap(updateData => this._applySmartDefaults(updateData, schemaInfo.smartDefaultRecord)), operators_1.switchMap((updatedData) => {
                const result = validate.call(validationContext, updatedData);
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
                if (!validationOptions.withPrompts) {
                    return rxjs_1.of([data, valid]);
                }
                const definitions = schemaInfo.promptDefinitions
                    .filter(def => !validationContext.promptFieldsWithValue.has(def.id));
                if (valid && this._promptProvider && definitions.length > 0) {
                    return rxjs_1.from(this._applyPrompts(data, definitions)).pipe(operators_1.map(data => [data, valid]));
                }
                else {
                    return rxjs_1.of([data, valid]);
                }
            }), operators_1.switchMap(([data, valid]) => {
                if (valid) {
                    return rxjs_1.of(data).pipe(...[...this._post].map(visitor => operators_1.concatMap((data) => {
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
        }), operators_1.tap(v => this._validatorCache.set(schemaKey, v)));
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
                    const compilationSchemInfo = this._currentCompilationSchemaInfo;
                    if (!compilationSchemInfo) {
                        throw new Error('Invalid JSON schema compilation state');
                    }
                    // We cheat, heavily.
                    compilationSchemInfo.smartDefaultRecord.set(
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
    usePromptProvider(provider) {
        const isSetup = !!this._promptProvider;
        this._promptProvider = provider;
        if (isSetup) {
            return;
        }
        this._ajv.addKeyword('x-prompt', {
            errors: false,
            valid: true,
            compile: (schema, parentSchema, it) => {
                const compilationSchemInfo = this._currentCompilationSchemaInfo;
                if (!compilationSchemInfo) {
                    throw new Error('Invalid JSON schema compilation state');
                }
                // tslint:disable-next-line:no-any
                const pathArray = it.dataPathArr.slice(1, it.dataLevel + 1);
                const path = pathArray.join('/');
                let type;
                let items;
                let message;
                if (typeof schema == 'string') {
                    message = schema;
                }
                else {
                    message = schema.message;
                    type = schema.type;
                    items = schema.items;
                }
                if (!type) {
                    if (parentSchema.type === 'boolean') {
                        type = 'confirmation';
                    }
                    else if (Array.isArray(parentSchema.enum)) {
                        type = 'list';
                    }
                    else {
                        type = 'input';
                    }
                }
                if (type === 'list' && !items) {
                    if (Array.isArray(parentSchema.enum)) {
                        type = 'list';
                        items = [];
                        for (const value of parentSchema.enum) {
                            if (typeof value == 'string') {
                                items.push(value);
                            }
                            else if (typeof value == 'object') {
                                // Invalid
                            }
                            else {
                                items.push({ label: value.toString(), value });
                            }
                        }
                    }
                }
                const definition = {
                    id: path,
                    type,
                    message,
                    priority: 0,
                    raw: schema,
                    items,
                    default: typeof parentSchema.default == 'object' ? undefined : parentSchema.default,
                    validator(data) {
                        return __awaiter(this, void 0, void 0, function* () {
                            const result = it.self.validate(parentSchema, data);
                            if (typeof result === 'boolean') {
                                return result;
                            }
                            else {
                                try {
                                    yield result;
                                    return true;
                                }
                                catch (_a) {
                                    return false;
                                }
                            }
                        });
                    },
                };
                compilationSchemInfo.promptDefinitions.push(definition);
                return function () {
                    if (this) {
                        this.promptFieldsWithValue.add(path);
                    }
                    return true;
                };
            },
            metaSchema: {
                oneOf: [
                    { type: 'string' },
                    {
                        type: 'object',
                        properties: {
                            'type': { type: 'string' },
                            'message': { type: 'string' },
                        },
                        additionalProperties: true,
                        required: ['message'],
                    },
                ],
            },
        });
    }
    _applyPrompts(data, prompts) {
        const provider = this._promptProvider;
        if (!provider) {
            return rxjs_1.of(data);
        }
        prompts.sort((a, b) => b.priority - a.priority);
        return rxjs_1.from(provider(prompts)).pipe(operators_1.map(answers => {
            for (const path in answers) {
                CoreSchemaRegistry._set(data, path.split('/'), answers[path], null, undefined, true);
            }
            return data;
        }));
    }
    static _set(
    // tslint:disable-next-line:no-any
    data, fragments, value, 
    // tslint:disable-next-line:no-any
    parent = null, parentProperty, force) {
        for (let i = 0; i < fragments.length; i++) {
            const f = fragments[i];
            if (f[0] == 'i') {
                if (!Array.isArray(data)) {
                    return;
                }
                for (let j = 0; j < data.length; j++) {
                    CoreSchemaRegistry._set(data[j], fragments.slice(i + 1), value, data, '' + j);
                }
                return;
            }
            else if (f.startsWith('key')) {
                if (typeof data !== 'object') {
                    return;
                }
                Object.getOwnPropertyNames(data).forEach(property => {
                    CoreSchemaRegistry._set(data[property], fragments.slice(i + 1), value, data, property);
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
        if (parent && parentProperty && (force || parent[parentProperty] === undefined)) {
            parent[parentProperty] = value;
        }
    }
    _applySmartDefaults(data, smartDefaults) {
        return rxjs_1.of(data).pipe(...[...smartDefaults.entries()].map(([pointer, schema]) => {
            return operators_1.concatMap(data => {
                const fragments = JSON.parse(pointer);
                const source = this._sourceMap.get(schema.$source);
                let value = source ? source(schema) : rxjs_1.of(undefined);
                if (!utils_1.isObservable(value)) {
                    value = rxjs_1.of(value);
                }
                return value.pipe(
                // Synchronously set the new data at the proper JsonSchema path.
                operators_1.tap(x => CoreSchemaRegistry._set(data, fragments, x)), 
                // But return the data object.
                operators_1.map(() => data));
            });
        }));
    }
}
exports.CoreSchemaRegistry = CoreSchemaRegistry;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVnaXN0cnkuanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2NvcmUvc3JjL2pzb24vc2NoZW1hL3JlZ2lzdHJ5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQTs7Ozs7O0dBTUc7QUFDSCwyQkFBMkI7QUFDM0IsNkJBQTZCO0FBQzdCLCtCQUF3RTtBQUN4RSw4Q0FBZ0U7QUFDaEUseURBQTBEO0FBQzFELHVDQUFnRTtBQWNoRSw2Q0FBb0Q7QUFDcEQsdUNBQW1EO0FBRW5ELE1BQU0sU0FBUyxHQUFHLE9BQU8sQ0FBQyw0QkFBNEIsQ0FBQyxDQUFDO0FBVXhELCtCQUF1QyxTQUFRLHlCQUFhO0lBRzFELFlBQ0UsTUFBK0IsRUFDL0IsV0FBVyxHQUFHLHFEQUFxRDtRQUVuRSxJQUFJLENBQUMsTUFBTSxJQUFJLE1BQU0sQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1lBQ2xDLEtBQUssQ0FBQywyQkFBMkIsQ0FBQyxDQUFDO1lBRW5DLE9BQU87U0FDUjtRQUVELE1BQU0sUUFBUSxHQUFHLHlCQUF5QixDQUFDLGNBQWMsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNsRSxLQUFLLENBQUMsR0FBRyxXQUFXLE9BQU8sUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDcEQsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7SUFDdkIsQ0FBQztJQUVNLE1BQU0sQ0FBQyxjQUFjLENBQUMsTUFBK0I7UUFDMUQsSUFBSSxDQUFDLE1BQU0sSUFBSSxNQUFNLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtZQUNsQyxPQUFPLEVBQUUsQ0FBQztTQUNYO1FBRUQsTUFBTSxRQUFRLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFO1lBQ2xDLElBQUksT0FBTyxHQUFHLGFBQWEsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMs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QUFDLElBQUksQ0FDNUIsR0FBRyxDQUFDLEdBQUcsYUFBYSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxPQUFPLEVBQUUsTUFBTSxDQUFDLEVBQUUsRUFBRTtZQUN4RCxPQUFPLHFCQUFTLENBQU8sSUFBSSxDQUFDLEVBQUU7Z0JBQzVCLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7Z0JBQ3RDLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFFLE1BQXFCLENBQUMsT0FBaUIsQ0FBQyxDQUFDO2dCQUU3RSxJQUFJLEtBQUssR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBWSxDQUFDLFNBQVMsQ0FBQyxDQUFDO2dCQUU5RCxJQUFJLENBQUMsb0JBQVksQ0FBQyxLQUFLLENBQUMsRUFBRTtvQkFDeEIsS0FBSyxHQUFHLFNBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQztpQkFDN0I7Z0JBRUQsT0FBUSxLQUF3QixDQUFDLElBQUk7Z0JBQ25DLGdFQUFnRTtnQkFDaEUsZUFBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBQ3JELDhCQUE4QjtnQkFDOUIsZUFBRyxDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUNoQixDQUFDO1lBQ0osQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDLENBQUMsQ0FDSCxDQUFDO0lBQ0osQ0FBQztDQUNGO0FBNWZELGdEQTRmQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCAqIGFzIGFqdiBmcm9tICdhanYnO1xuaW1wb3J0ICogYXMgaHR0cCBmcm9tICdodHRwJztcbmltcG9ydCB7IE9ic2VydmFibGUsIGZyb20sIG9mIGFzIG9ic2VydmFibGVPZiwgdGhyb3dFcnJvciB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgY29uY2F0TWFwLCBtYXAsIHN3aXRjaE1hcCwgdGFwIH0gZnJvbSAncnhqcy9vcGVyYXRvcnMnO1xuaW1wb3J0IHsgQmFzZUV4Y2VwdGlvbiB9IGZyb20gJy4uLy4uL2V4Y2VwdGlvbi9leGNlcHRpb24nO1xuaW1wb3J0IHsgUGFydGlhbGx5T3JkZXJlZFNldCwgaXNPYnNlcnZhYmxlIH0gZnJvbSAnLi4vLi4vdXRpbHMnO1xuaW1wb3J0IHsgSnNvbk9iamVjdCwgSnNvblZhbHVlIH0gZnJvbSAnLi4vaW50ZXJmYWNlJztcbmltcG9ydCB7XG4gIFByb21wdERlZmluaXRpb24sXG4gIFByb21wdFByb3ZpZGVyLFxuICBTY2hlbWFGb3JtYXQsXG4gIFNjaGVtYUZvcm1hdHRlcixcbiAgU2NoZW1hUmVnaXN0cnksXG4gIFNjaGVtYVZhbGlkYXRvcixcbiAgU2NoZW1hVmFsaWRhdG9yRXJyb3IsXG4gIFNjaGVtYVZhbGlkYXRvck9wdGlvbnMsXG4gIFNjaGVtYVZhbGlkYXRvclJlc3VsdCxcbiAgU21hcnREZWZhdWx0UHJvdmlkZXIsXG59IGZyb20gJy4vaW50ZXJmYWNlJztcbmltcG9ydCB7IGFkZFVuZGVmaW5lZERlZmF1bHRzIH0gZnJvbSAnLi90cmFuc2Zvcm1zJztcbmltcG9ydCB7IEpzb25WaXNpdG9yLCB2aXNpdEpzb24gfSBmcm9tICcuL3Zpc2l0b3InO1xuXG5jb25zdCBzZXJpYWxpemUgPSByZXF1aXJlKCdmYXN0LWpzb24tc3RhYmxlLXN0cmluZ2lmeScpO1xuXG4vLyBUaGlzIGludGVyZmFjZSBzaG91bGQgYmUgZXhwb3J0ZWQgZnJvbSBhanYsIGJ1dCB0aGV5IG9ubHkgZXhwb3J0IHRoZSBjbGFzcyBhbmQgbm90IHRoZSB0eXBlLlxuaW50ZXJmYWNlIEFqdlZhbGlkYXRpb25FcnJvciB7XG4gIG1lc3NhZ2U6IHN0cmluZztcbiAgZXJyb3JzOiBBcnJheTxhanYuRXJyb3JPYmplY3Q+O1xuICBhanY6IHRydWU7XG4gIHZhbGlkYXRpb246IHRydWU7XG59XG5cbmV4cG9ydCBjbGFzcyBTY2hlbWFWYWxpZGF0aW9uRXhjZXB0aW9uIGV4dGVuZHMgQmFzZUV4Y2VwdGlvbiB7XG4gIHB1YmxpYyByZWFkb25seSBlcnJvcnM6IFNjaGVtYVZhbGlkYXRvckVycm9yW107XG5cbiAgY29uc3RydWN0b3IoXG4gICAgZXJyb3JzPzogU2NoZW1hVmFsaWRhdG9yRXJyb3JbXSxcbiAgICBiYXNlTWVzc2FnZSA9ICdTY2hlbWEgdmFsaWRhdGlvbiBmYWlsZWQgd2l0aCB0aGUgZm9sbG93aW5nIGVycm9yczonLFxuICApIHtcbiAgICBpZiAoIWVycm9ycyB8fCBlcnJvcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICBzdXBlcignU2NoZW1hIHZhbGlkYXRpb24gZmFpbGVkLicpO1xuXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgbWVzc2FnZXMgPSBTY2hlbWFWYWxpZGF0aW9uRXhjZXB0aW9uLmNyZWF0ZU1lc3NhZ2VzKGVycm9ycyk7XG4gICAgc3VwZXIoYCR7YmFzZU1lc3NhZ2V9XFxuICAke21lc3NhZ2VzLmpvaW4oJ1xcbiAgJyl9YCk7XG4gICAgdGhpcy5lcnJvcnMgPSBlcnJvcnM7XG4gIH1cblxuICBwdWJsaWMgc3RhdGljIGNyZWF0ZU1lc3NhZ2VzKGVycm9ycz86IFNjaGVtYVZhbGlkYXRvckVycm9yW10pOiBzdHJpbmdbXSB7XG4gICAgaWYgKCFlcnJvcnMgfHwgZXJyb3JzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIGNvbnN0IG1lc3NhZ2VzID0gZXJyb3JzLm1hcCgoZXJyKSA9PiB7XG4gICAgICBsZXQgbWVzc2FnZSA9IGBEYXRhIHBhdGggJHtKU09OLnN0cmluZ2lmeShlcnIuZGF0YVBhdGgpfSAke2Vyci5tZXNzYWdlfWA7XG4gICAgICBpZiAoZXJyLmtleXdvcmQgPT09ICdhZGRpdGlvbmFsUHJvcGVydGllcycpIHtcbiAgICAgICAgbWVzc2FnZSArPSBgKCR7ZXJyLnBhcmFtcy5hZGRpdGlvbmFsUHJvcGVydHl9KWA7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBtZXNzYWdlICsgJy4nO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIG1lc3NhZ2VzO1xuICB9XG59XG5cbmludGVyZmFjZSBTY2hlbWFJbmZvIHtcbiAgc21hcnREZWZhdWx0UmVjb3JkOiBNYXA8c3RyaW5nLCBKc29uT2JqZWN0PjtcbiAgcHJvbXB0RGVmaW5pdGlvbnM6IEFycmF5PFByb21wdERlZmluaXRpb24+O1xufVxuXG5leHBvcnQgY2xhc3MgQ29yZVNjaGVtYVJlZ2lzdHJ5IGltcGxlbWVudHMgU2NoZW1hUmVnaXN0cnkge1xuICBwcml2YXRlIF9hanY6IGFqdi5BanY7XG4gIHByaXZhdGUgX3VyaUNhY2hlID0gbmV3IE1hcDxzdHJpbmcsIEpzb25PYmplY3Q+KCk7XG4gIHByaXZhdGUgX3ByZSA9IG5ldyBQYXJ0aWFsbHlPcmRlcmVkU2V0PEpzb25WaXNpdG9yPigpO1xuICBwcml2YXRlIF9wb3N0ID0gbmV3IFBhcnRpYWxseU9yZGVyZWRTZXQ8SnNvblZpc2l0b3I+KCk7XG4gIHByaXZhdGUgX2N1cnJlbnRDb21waWxhdGlvblNjaGVtYUluZm8/OiBTY2hlbWFJbmZvO1xuICBwcml2YXRlIF92YWxpZGF0b3JDYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCBTY2hlbWFWYWxpZGF0b3I+KCk7XG5cbiAgcHJpdmF0ZSBfc21hcnREZWZhdWx0S2V5d29yZCA9IGZhbHNlO1xuICBwcml2YXRlIF9wcm9tcHRQcm92aWRlcj86IFByb21wdFByb3ZpZGVyO1xuICBwcml2YXRlIF9zb3VyY2VNYXAgPSBuZXcgTWFwPHN0cmluZywgU21hcnREZWZhdWx0UHJvdmlkZXI8e30+PigpO1xuXG4gIGNvbnN0cnVjdG9yKGZvcm1hdHM6IFNjaGVtYUZvcm1hdFtdID0gW10pIHtcbiAgICAvKipcbiAgICAgKiBCdWlsZCBhbiBBSlYgaW5zdGFuY2UgdGhhdCB3aWxsIGJlIHVzZWQgdG8gdmFsaWRhdGUgc2NoZW1hcy5cbiAgICAgKi9cblxuICAgIGNvbnN0IGZvcm1hdHNPYmo6IHsgW25hbWU6IHN0cmluZ106IFNjaGVtYUZvcm1hdHRlciB9ID0ge307XG5cbiAgICBmb3IgKGNvbnN0IGZvcm1hdCBvZiBmb3JtYXRzKSB7XG4gICAgICBmb3JtYXRzT2JqW2Zvcm1hdC5uYW1lXSA9IGZvcm1hdC5mb3JtYXR0ZXI7XG4gICAgfVxuXG4gICAgdGhpcy5fYWp2ID0gYWp2KHtcbiAgICAgIGZvcm1hdHM6IGZvcm1hdHNPYmosXG4gICAgICBsb2FkU2NoZW1hOiAodXJpOiBzdHJpbmcpID0+IHRoaXMuX2ZldGNoKHVyaSksXG4gICAgICBzY2hlbWFJZDogJ2F1dG8nLFxuICAgICAgcGFzc0NvbnRleHQ6IHRydWUsXG4gICAgfSk7XG5cbiAgICB0aGlzLl9hanYuYWRkTWV0YVNjaGVtYShyZXF1aXJlKCdhanYvbGliL3JlZnMvanNvbi1zY2hlbWEtZHJhZnQtMDQuanNvbicpKTtcbiAgICB0aGlzLl9hanYuYWRkTWV0YVNjaGVtYShyZXF1aXJlKCdhanYvbGliL3JlZnMvanNvbi1zY2hlbWEtZHJhZnQtMDYuanNvbicpKTtcblxuICAgIHRoaXMuYWRkUG9zdFRyYW5zZm9ybShhZGRVbmRlZmluZWREZWZhdWx0cyk7XG4gIH1cblxuICBwcml2YXRlIF9mZXRjaCh1cmk6IHN0cmluZyk6IFByb21pc2U8SnNvbk9iamVjdD4ge1xuICAgIGNvbnN0IG1heWJlU2NoZW1hID0gdGhpcy5fdXJpQ2FjaGUuZ2V0KHVyaSk7XG5cbiAgICBpZiAobWF5YmVTY2hlbWEpIHtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUobWF5YmVTY2hlbWEpO1xuICAgIH1cblxuICAgIHJldHVybiBuZXcgUHJvbWlzZTxKc29uT2JqZWN0PigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBodHRwLmdldCh1cmksIHJlcyA9PiB7XG4gICAgICAgIGlmICghcmVzLnN0YXR1c0NvZGUgfHwgcmVzLnN0YXR1c0NvZGUgPj0gMzAwKSB7XG4gICAgICAgICAgLy8gQ29uc3VtZSB0aGUgcmVzdCBvZiB0aGUgZGF0YSB0byBmcmVlIG1lbW9yeS5cbiAgICAgICAgICByZXMucmVzdW1lKCk7XG4gICAgICAgICAgcmVqZWN0KGBSZXF1ZXN0IGZhaWxlZC4gU3RhdHVzIENvZGU6ICR7cmVzLnN0YXR1c0NvZGV9YCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVzLnNldEVuY29kaW5nKCd1dGY4Jyk7XG4gICAgICAgICAgbGV0IGRhdGEgPSAnJztcbiAgICAgICAgICByZXMub24oJ2RhdGEnLCBjaHVuayA9PiB7XG4gICAgICAgICAgICBkYXRhICs9IGNodW5rO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIHJlcy5vbignZW5kJywgKCkgPT4ge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgY29uc3QganNvbiA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICAgICAgICAgIHRoaXMuX3VyaUNhY2hlLnNldCh1cmksIGpzb24pO1xuICAgICAgICAgICAgICByZXNvbHZlKGpzb24pO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGQgYSB0cmFuc2Zvcm1hdGlvbiBzdGVwIGJlZm9yZSB0aGUgdmFsaWRhdGlvbiBvZiBhbnkgSnNvbi5cbiAgICogQHBhcmFtIHtKc29uVmlzaXRvcn0gdmlzaXRvciBUaGUgdmlzaXRvciB0byB0cmFuc2Zvcm0gZXZlcnkgdmFsdWUuXG4gICAqIEBwYXJhbSB7SnNvblZpc2l0b3JbXX0gZGVwcyBBIGxpc3Qgb2Ygb3RoZXIgdmlzaXRvcnMgdG8gcnVuIGJlZm9yZS5cbiAgICovXG4gIGFkZFByZVRyYW5zZm9ybSh2aXNpdG9yOiBKc29uVmlzaXRvciwgZGVwcz86IEpzb25WaXNpdG9yW10pIHtcbiAgICB0aGlzLl9wcmUuYWRkKHZpc2l0b3IsIGRlcHMpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZCBhIHRyYW5zZm9ybWF0aW9uIHN0ZXAgYWZ0ZXIgdGhlIHZhbGlkYXRpb24gb2YgYW55IEpzb24uIFRoZSBKU09OIHdpbGwgbm90IGJlIHZhbGlkYXRlZFxuICAgKiBhZnRlciB0aGUgUE9TVCwgc28gaWYgdHJhbnNmb3JtYXRpb25zIGFyZSBub3QgY29tcGF0aWJsZSB3aXRoIHRoZSBTY2hlbWEgaXQgd2lsbCBub3QgcmVzdWx0XG4gICAqIGluIGFuIGVycm9yLlxuICAgKiBAcGFyYW0ge0pzb25WaXNpdG9yfSB2aXNpdG9yIFRoZSB2aXNpdG9yIHRvIHRyYW5zZm9ybSBldmVyeSB2YWx1ZS5cbiAgICogQHBhcmFtIHtKc29uVmlzaXRvcltdfSBkZXBzIEEgbGlzdCBvZiBvdGhlciB2aXNpdG9ycyB0byBydW4gYmVmb3JlLlxuICAgKi9cbiAgYWRkUG9zdFRyYW5zZm9ybSh2aXNpdG9yOiBKc29uVmlzaXRvciwgZGVwcz86IEpzb25WaXNpdG9yW10pIHtcbiAgICB0aGlzLl9wb3N0LmFkZCh2aXNpdG9yLCBkZXBzKTtcbiAgfVxuXG4gIHByb3RlY3RlZCBfcmVzb2x2ZXIoXG4gICAgcmVmOiBzdHJpbmcsXG4gICAgdmFsaWRhdGU6IGFqdi5WYWxpZGF0ZUZ1bmN0aW9uLFxuICApOiB7IGNvbnRleHQ/OiBhanYuVmFsaWRhdGVGdW5jdGlvbiwgc2NoZW1hPzogSnNvbk9iamVjdCB9IHtcbiAgICBpZiAoIXZhbGlkYXRlIHx8ICF2YWxpZGF0ZS5yZWZzIHx8ICF2YWxpZGF0ZS5yZWZWYWwgfHwgIXJlZikge1xuICAgICAgcmV0dXJuIHt9O1xuICAgIH1cblxuICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby1hbnlcbiAgICBjb25zdCBpZCA9ICh2YWxpZGF0ZS5zY2hlbWEgYXMgYW55KS4kaWQgfHwgKHZhbGlkYXRlLnNjaGVtYSBhcyBhbnkpLmlkO1xuICAgIGxldCBmdWxsUmVmZXJlbmNlID0gKHJlZlswXSA9PT0gJyMnICYmIGlkKSA/IGlkICsgcmVmIDogcmVmO1xuICAgIGlmIChmdWxsUmVmZXJlbmNlLmVuZHNXaXRoKCcjJykpIHtcbiAgICAgIGZ1bGxSZWZlcmVuY2UgPSBmdWxsUmVmZXJlbmNlLnNsaWNlKDAsIC0xKTtcbiAgICB9XG5cbiAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tYW55XG4gICAgY29uc3QgY29udGV4dCA9IHZhbGlkYXRlLnJlZlZhbFsodmFsaWRhdGUucmVmcyBhcyBhbnkpW2Z1bGxSZWZlcmVuY2VdXTtcblxuICAgIHJldHVybiB7IGNvbnRleHQsIHNjaGVtYTogY29udGV4dCAmJiBjb250ZXh0LnNjaGVtYSBhcyBKc29uT2JqZWN0IH07XG4gIH1cblxuICBjb21waWxlKHNjaGVtYTogSnNvbk9iamVjdCk6IE9ic2VydmFibGU8U2NoZW1hVmFsaWRhdG9yPiB7XG4gICAgY29uc3Qgc2NoZW1hS2V5ID0gc2VyaWFsaXplKHNjaGVtYSk7XG4gICAgY29uc3QgZXhpc3RpbmdWYWxpZGF0b3IgPSB0aGlzLl92YWxpZGF0b3JDYWNoZS5nZXQoc2NoZW1hS2V5KTtcbiAgICBpZiAoZXhpc3RpbmdWYWxpZGF0b3IpIHtcbiAgICAgIHJldHVybiBvYnNlcnZhYmxlT2YoZXhpc3RpbmdWYWxpZGF0b3IpO1xuICAgIH1cblxuICAgIGNvbnN0IHNjaGVtYUluZm86IFNjaGVtYUluZm8gPSB7XG4gICAgICBzbWFydERlZmF1bHRSZWNvcmQ6IG5ldyBNYXA8c3RyaW5nLCBKc29uT2JqZWN0PigpLFxuICAgICAgcHJvbXB0RGVmaW5pdGlvbnM6IFtdLFxuICAgIH07XG5cbiAgICAvLyBTdXBwb3J0cyBib3RoIHN5bmNocm9ub3VzIGFuZCBhc3luY2hyb25vdXMgY29tcGlsYXRpb24sIGJ5IHRyeWluZyB0aGUgc3luY2hyb25vdXNcbiAgICAvLyB2ZXJzaW9uIGZpcnN0LCB0aGVuIGlmIHJlZnMgYXJlIG1pc3NpbmcgdGhpcyB3aWxsIGZhaWxzLlxuICAgIC8vIFdlIGFsc28gYWRkIGFueSByZWZzIGZyb20gZXh0ZXJuYWwgZmV0Y2hlZCBzY2hlbWFzIHNvIHRoYXQgdGhvc2Ugd2lsbCBhbHNvIGJlIHVzZWRcbiAgICAvLyBpbiBzeW5jaHJvbm91cyAoaWYgYXZhaWxhYmxlKS5cbiAgICBsZXQgdmFsaWRhdG9yOiBPYnNlcnZhYmxlPGFqdi5WYWxpZGF0ZUZ1bmN0aW9uPjtcbiAgICB0cnkge1xuICAgICAgdGhpcy5fY3VycmVudENvbXBpbGF0aW9uU2NoZW1hSW5mbyA9IHNjaGVtYUluZm87XG4gICAgICB2YWxpZGF0b3IgPSBvYnNlcnZhYmxlT2YodGhpcy5fYWp2LmNvbXBpbGUoc2NoZW1hKSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgLy8gUHJvcGFnYXRlIHRoZSBlcnJvci5cbiAgICAgIGlmICghKGUgaW5zdGFuY2VvZiAoYWp2Lk1pc3NpbmdSZWZFcnJvciBhcyB7fSBhcyBGdW5jdGlvbikpKSB7XG4gICAgICAgIHJldHVybiB0aHJvd0Vycm9yKGUpO1xuICAgICAgfVxuXG4gICAgICB0cnkge1xuICAgICAgICB2YWxpZGF0b3IgPSBmcm9tKHRoaXMuX2Fqdi5jb21waWxlQXN5bmMoc2NoZW1hKSk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHJldHVybiB0aHJvd0Vycm9yKGUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB2YWxpZGF0b3JcbiAgICAgIC5waXBlKFxuICAgICAgICBtYXA8YWp2LlZhbGlkYXRlRnVuY3Rpb24sIFNjaGVtYVZhbGlkYXRvcj4odmFsaWRhdGUgPT4gKGRhdGEsIG9wdGlvbnMpID0+IHtcbiAgICAgICAgICBjb25zdCB2YWxpZGF0aW9uT3B0aW9uczogU2NoZW1hVmFsaWRhdG9yT3B0aW9ucyA9IHtcbiAgICAgICAgICAgIHdpdGhQcm9tcHRzOiB0cnVlLFxuICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICB9O1xuICAgICAgICAgIGNvbnN0IHZhbGlkYXRpb25Db250ZXh0ID0ge1xuICAgICAgICAgICAgcHJvbXB0RmllbGRzV2l0aFZhbHVlOiBuZXcgU2V0PHN0cmluZz4oKSxcbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgcmV0dXJuIG9ic2VydmFibGVPZihkYXRhKS5waXBlKFxuICAgICAgICAgICAgLi4uWy4uLnRoaXMuX3ByZV0ubWFwKHZpc2l0b3IgPT4gY29uY2F0TWFwKChkYXRhOiBKc29uVmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgcmV0dXJuIHZpc2l0SnNvbihkYXRhLCB2aXNpdG9yLCBzY2hlbWEsIHRoaXMuX3Jlc29sdmVyLCB2YWxpZGF0ZSk7XG4gICAgICAgICAgICB9KSksXG4gICAgICAgICAgKS5waXBlKFxuICAgICAgICAgICAgc3dpdGNoTWFwKHVwZGF0ZURhdGEgPT4gdGhpcy5fYXBwbHlTbWFydERlZmF1bHRzKFxuICAgICAgICAgICAgICB1cGRhdGVEYXRhLFxuICAgICAgICAgICAgICBzY2hlbWFJbmZvLnNtYXJ0RGVmYXVsdFJlY29yZCxcbiAgICAgICAgICAgICkpLFxuICAgICAgICAgICAgc3dpdGNoTWFwKCh1cGRhdGVkRGF0YTogSnNvblZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IHZhbGlkYXRlLmNhbGwodmFsaWRhdGlvbkNvbnRleHQsIHVwZGF0ZWREYXRhKTtcblxuICAgICAgICAgICAgICByZXR1cm4gdHlwZW9mIHJlc3VsdCA9PSAnYm9vbGVhbidcbiAgICAgICAgICAgICAgICA/IG9ic2VydmFibGVPZihbdXBkYXRlZERhdGEsIHJlc3VsdF0pXG4gICAgICAgICAgICAgICAgOiBmcm9tKChyZXN1bHQgYXMgUHJvbWlzZTxib29sZWFuPilcbiAgICAgICAgICAgICAgICAgIC50aGVuKHIgPT4gW3VwZGF0ZWREYXRhLCB0cnVlXSlcbiAgICAgICAgICAgICAgICAgIC5jYXRjaCgoZXJyOiBFcnJvciB8IEFqdlZhbGlkYXRpb25FcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoKGVyciBhcyBBanZWYWxpZGF0aW9uRXJyb3IpLmFqdikge1xuICAgICAgICAgICAgICAgICAgICAgIHZhbGlkYXRlLmVycm9ycyA9IChlcnIgYXMgQWp2VmFsaWRhdGlvbkVycm9yKS5lcnJvcnM7XG5cbiAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKFt1cGRhdGVkRGF0YSwgZmFsc2VdKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChlcnIpO1xuICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgfSksXG4gICAgICAgICAgICBzd2l0Y2hNYXAoKFtkYXRhLCB2YWxpZF0pID0+IHtcbiAgICAgICAgICAgICAgaWYgKCF2YWxpZGF0aW9uT3B0aW9ucy53aXRoUHJvbXB0cykge1xuICAgICAgICAgICAgICAgIHJldHVybiBvYnNlcnZhYmxlT2YoW2RhdGEsIHZhbGlkXSk7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBjb25zdCBkZWZpbml0aW9ucyA9IHNjaGVtYUluZm8ucHJvbXB0RGVmaW5pdGlvbnNcbiAgICAgICAgICAgICAgICAuZmlsdGVyKGRlZiA9PiAhdmFsaWRhdGlvbkNvbnRleHQucHJvbXB0RmllbGRzV2l0aFZhbHVlLmhhcyhkZWYuaWQpKTtcblxuICAgICAgICAgICAgICBpZiAodmFsaWQgJiYgdGhpcy5fcHJvbXB0UHJvdmlkZXIgJiYgZGVmaW5pdGlvbnMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmcm9tKHRoaXMuX2FwcGx5UHJvbXB0cyhkYXRhLCBkZWZpbml0aW9ucykpLnBpcGUoXG4gICAgICAgICAgICAgICAgICBtYXAoZGF0YSA9PiBbZGF0YSwgdmFsaWRdKSxcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBvYnNlcnZhYmxlT2YoW2RhdGEsIHZhbGlkXSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgc3dpdGNoTWFwKChbZGF0YSwgdmFsaWRdKSA9PiB7XG4gICAgICAgICAgICAgIGlmICh2YWxpZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBvYnNlcnZhYmxlT2YoZGF0YSkucGlwZShcbiAgICAgICAgICAgICAgICAgIC4uLlsuLi50aGlzLl9wb3N0XS5tYXAodmlzaXRvciA9PiBjb25jYXRNYXAoKGRhdGE6IEpzb25WYWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdmlzaXRKc29uKGRhdGEgYXMgSnNvblZhbHVlLCB2aXNpdG9yLCBzY2hlbWEsIHRoaXMuX3Jlc29sdmVyLCB2YWxpZGF0ZSk7XG4gICAgICAgICAgICAgICAgICB9KSksXG4gICAgICAgICAgICAgICAgKS5waXBlKFxuICAgICAgICAgICAgICAgICAgbWFwKGRhdGEgPT4gW2RhdGEsIHZhbGlkXSksXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gb2JzZXJ2YWJsZU9mKFtkYXRhLCB2YWxpZF0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIG1hcCgoW2RhdGEsIHZhbGlkXSkgPT4ge1xuICAgICAgICAgICAgICBpZiAodmFsaWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBkYXRhLCBzdWNjZXNzOiB0cnVlIH0gYXMgU2NoZW1hVmFsaWRhdG9yUmVzdWx0O1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBkYXRhLFxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGVycm9yczogKHZhbGlkYXRlLmVycm9ycyB8fCBbXSksXG4gICAgICAgICAgICAgIH0gYXMgU2NoZW1hVmFsaWRhdG9yUmVzdWx0O1xuICAgICAgICAgICAgfSksXG4gICAgICAgICAgKTtcbiAgICAgICAgfSksXG4gICAgICAgIHRhcCh2ID0+IHRoaXMuX3ZhbGlkYXRvckNhY2hlLnNldChzY2hlbWFLZXksIHYpKSxcbiAgICAgICk7XG4gIH1cblxuICBhZGRGb3JtYXQoZm9ybWF0OiBTY2hlbWFGb3JtYXQpOiB2b2lkIHtcbiAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tYW55XG4gICAgY29uc3QgdmFsaWRhdGUgPSAoZGF0YTogYW55KSA9PiB7XG4gICAgICBjb25zdCByZXN1bHQgPSBmb3JtYXQuZm9ybWF0dGVyLnZhbGlkYXRlKGRhdGEpO1xuXG4gICAgICBpZiAodHlwZW9mIHJlc3VsdCA9PSAnYm9vbGVhbicpIHtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiByZXN1bHQudG9Qcm9taXNlKCk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIHRoaXMuX2Fqdi5hZGRGb3JtYXQoZm9ybWF0Lm5hbWUsIHtcbiAgICAgIGFzeW5jOiBmb3JtYXQuZm9ybWF0dGVyLmFzeW5jLFxuICAgICAgdmFsaWRhdGUsXG4gICAgLy8gQUpWIHR5cGluZ3MgbGlzdCBgY29tcGFyZWAgYXMgcmVxdWlyZWQsIGJ1dCBpdCBpcyBvcHRpb25hbC5cbiAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tYW55XG4gICAgfSBhcyBhbnkpO1xuICB9XG5cbiAgYWRkU21hcnREZWZhdWx0UHJvdmlkZXI8VD4oc291cmNlOiBzdHJpbmcsIHByb3ZpZGVyOiBTbWFydERlZmF1bHRQcm92aWRlcjxUPikge1xuICAgIGlmICh0aGlzLl9zb3VyY2VNYXAuaGFzKHNvdXJjZSkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihzb3VyY2UpO1xuICAgIH1cblxuICAgIHRoaXMuX3NvdXJjZU1hcC5zZXQoc291cmNlLCBwcm92aWRlcik7XG5cbiAgICBpZiAoIXRoaXMuX3NtYXJ0RGVmYXVsdEtleXdvcmQpIHtcbiAgICAgIHRoaXMuX3NtYXJ0RGVmYXVsdEtleXdvcmQgPSB0cnVlO1xuXG4gICAgICB0aGlzLl9hanYuYWRkS2V5d29yZCgnJGRlZmF1bHQnLCB7XG4gICAgICAgIGVycm9yczogZmFsc2UsXG4gICAgICAgIHZhbGlkOiB0cnVlLFxuICAgICAgICBjb21waWxlOiAoc2NoZW1hLCBfcGFyZW50U2NoZW1hLCBpdCkgPT4ge1xuICAgICAgICAgIGNvbnN0IGNvbXBpbGF0aW9uU2NoZW1JbmZvID0gdGhpcy5fY3VycmVudENvbXBpbGF0aW9uU2NoZW1hSW5mbztcbiAgICAgICAgICBpZiAoIWNvbXBpbGF0aW9uU2NoZW1JbmZvKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgSlNPTiBzY2hlbWEgY29tcGlsYXRpb24gc3RhdGUnKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBXZSBjaGVhdCwgaGVhdmlseS5cbiAgICAgICAgICBjb21waWxhdGlvblNjaGVtSW5mby5zbWFydERlZmF1bHRSZWNvcmQuc2V0KFxuICAgICAgICAgICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWFueVxuICAgICAgICAgICAgSlNPTi5zdHJpbmdpZnkoKGl0IGFzIGFueSkuZGF0YVBhdGhBcnIuc2xpY2UoMSwgaXQuZGF0YUxldmVsICsgMSkgYXMgc3RyaW5nW10pLFxuICAgICAgICAgICAgc2NoZW1hLFxuICAgICAgICAgICk7XG5cbiAgICAgICAgICByZXR1cm4gKCkgPT4gdHJ1ZTtcbiAgICAgICAgfSxcbiAgICAgICAgbWV0YVNjaGVtYToge1xuICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICckc291cmNlJzogeyB0eXBlOiAnc3RyaW5nJyB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgYWRkaXRpb25hbFByb3BlcnRpZXM6IHRydWUsXG4gICAgICAgICAgcmVxdWlyZWQ6IFsgJyRzb3VyY2UnIF0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICB1c2VQcm9tcHRQcm92aWRlcihwcm92aWRlcjogUHJvbXB0UHJvdmlkZXIpIHtcbiAgICBjb25zdCBpc1NldHVwID0gISF0aGlzLl9wcm9tcHRQcm92aWRlcjtcblxuICAgIHRoaXMuX3Byb21wdFByb3ZpZGVyID0gcHJvdmlkZXI7XG5cbiAgICBpZiAoaXNTZXR1cCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuX2Fqdi5hZGRLZXl3b3JkKCd4LXByb21wdCcsIHtcbiAgICAgIGVycm9yczogZmFsc2UsXG4gICAgICB2YWxpZDogdHJ1ZSxcbiAgICAgIGNvbXBpbGU6IChzY2hlbWEsIHBhcmVudFNjaGVtYTogSnNvbk9iamVjdCwgaXQpID0+IHtcbiAgICAgICAgY29uc3QgY29tcGlsYXRpb25TY2hlbUluZm8gPSB0aGlzLl9jdXJyZW50Q29tcGlsYXRpb25TY2hlbWFJbmZvO1xuICAgICAgICBpZiAoIWNvbXBpbGF0aW9uU2NoZW1JbmZvKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIEpTT04gc2NoZW1hIGNvbXBpbGF0aW9uIHN0YXRlJyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tYW55XG4gICAgICAgIGNvbnN0IHBhdGhBcnJheSA9ICgoaXQgYXMgYW55KS5kYXRhUGF0aEFyciBhcyBzdHJpbmdbXSkuc2xpY2UoMSwgaXQuZGF0YUxldmVsICsgMSk7XG4gICAgICAgIGNvbnN0IHBhdGggPSBwYXRoQXJyYXkuam9pbignLycpO1xuXG4gICAgICAgIGxldCB0eXBlOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgICAgIGxldCBpdGVtczogQXJyYXk8c3RyaW5nIHwgeyBsYWJlbDogc3RyaW5nLCB2YWx1ZTogc3RyaW5nIHwgbnVtYmVyIHwgYm9vbGVhbiB9PiB8IHVuZGVmaW5lZDtcbiAgICAgICAgbGV0IG1lc3NhZ2U6IHN0cmluZztcbiAgICAgICAgaWYgKHR5cGVvZiBzY2hlbWEgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICBtZXNzYWdlID0gc2NoZW1hO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG1lc3NhZ2UgPSBzY2hlbWEubWVzc2FnZTtcbiAgICAgICAgICB0eXBlID0gc2NoZW1hLnR5cGU7XG4gICAgICAgICAgaXRlbXMgPSBzY2hlbWEuaXRlbXM7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXR5cGUpIHtcbiAgICAgICAgICBpZiAocGFyZW50U2NoZW1hLnR5cGUgPT09ICdib29sZWFuJykge1xuICAgICAgICAgICAgdHlwZSA9ICdjb25maXJtYXRpb24nO1xuICAgICAgICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShwYXJlbnRTY2hlbWEuZW51bSkpIHtcbiAgICAgICAgICAgIHR5cGUgPSAnbGlzdCc7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHR5cGUgPSAnaW5wdXQnO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0eXBlID09PSAnbGlzdCcgJiYgIWl0ZW1zKSB7XG4gICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkocGFyZW50U2NoZW1hLmVudW0pKSB7XG4gICAgICAgICAgICB0eXBlID0gJ2xpc3QnO1xuICAgICAgICAgICAgaXRlbXMgPSBbXTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgdmFsdWUgb2YgcGFyZW50U2NoZW1hLmVudW0pIHtcbiAgICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIGl0ZW1zLnB1c2godmFsdWUpO1xuICAgICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiB2YWx1ZSA9PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgIC8vIEludmFsaWRcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpdGVtcy5wdXNoKHsgbGFiZWw6IHZhbHVlLnRvU3RyaW5nKCksIHZhbHVlIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZGVmaW5pdGlvbjogUHJvbXB0RGVmaW5pdGlvbiA9IHtcbiAgICAgICAgICBpZDogcGF0aCxcbiAgICAgICAgICB0eXBlLFxuICAgICAgICAgIG1lc3NhZ2UsXG4gICAgICAgICAgcHJpb3JpdHk6IDAsXG4gICAgICAgICAgcmF3OiBzY2hlbWEsXG4gICAgICAgICAgaXRlbXMsXG4gICAgICAgICAgZGVmYXVsdDogdHlwZW9mIHBhcmVudFNjaGVtYS5kZWZhdWx0ID09ICdvYmplY3QnID8gdW5kZWZpbmVkIDogcGFyZW50U2NoZW1hLmRlZmF1bHQsXG4gICAgICAgICAgYXN5bmMgdmFsaWRhdG9yKGRhdGE6IHN0cmluZykge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gaXQuc2VsZi52YWxpZGF0ZShwYXJlbnRTY2hlbWEsIGRhdGEpO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiByZXN1bHQgPT09ICdib29sZWFuJykge1xuICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBhd2FpdCByZXN1bHQ7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSxcbiAgICAgICAgfTtcblxuICAgICAgICBjb21waWxhdGlvblNjaGVtSW5mby5wcm9tcHREZWZpbml0aW9ucy5wdXNoKGRlZmluaXRpb24pO1xuXG4gICAgICAgIHJldHVybiBmdW5jdGlvbih0aGlzOiB7IHByb21wdEZpZWxkc1dpdGhWYWx1ZTogU2V0PHN0cmluZz4gfSkge1xuICAgICAgICAgIGlmICh0aGlzKSB7XG4gICAgICAgICAgICB0aGlzLnByb21wdEZpZWxkc1dpdGhWYWx1ZS5hZGQocGF0aCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH07XG4gICAgICB9LFxuICAgICAgbWV0YVNjaGVtYToge1xuICAgICAgICBvbmVPZjogW1xuICAgICAgICAgIHsgdHlwZTogJ3N0cmluZycgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgJ3R5cGUnOiB7IHR5cGU6ICdzdHJpbmcnIH0sXG4gICAgICAgICAgICAgICdtZXNzYWdlJzogeyB0eXBlOiAnc3RyaW5nJyB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiB0cnVlLFxuICAgICAgICAgICAgcmVxdWlyZWQ6IFsgJ21lc3NhZ2UnIF0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIF9hcHBseVByb21wdHM8VD4oZGF0YTogVCwgcHJvbXB0czogQXJyYXk8UHJvbXB0RGVmaW5pdGlvbj4pOiBPYnNlcnZhYmxlPFQ+IHtcbiAgICBjb25zdCBwcm92aWRlciA9IHRoaXMuX3Byb21wdFByb3ZpZGVyO1xuICAgIGlmICghcHJvdmlkZXIpIHtcbiAgICAgIHJldHVybiBvYnNlcnZhYmxlT2YoZGF0YSk7XG4gICAgfVxuXG4gICAgcHJvbXB0cy5zb3J0KChhLCBiKSA9PiBiLnByaW9yaXR5IC0gYS5wcmlvcml0eSk7XG5cbiAgICByZXR1cm4gZnJvbShwcm92aWRlcihwcm9tcHRzKSkucGlwZShcbiAgICAgIG1hcChhbnN3ZXJzID0+IHtcbiAgICAgICAgZm9yIChjb25zdCBwYXRoIGluIGFuc3dlcnMpIHtcbiAgICAgICAgICBDb3JlU2NoZW1hUmVnaXN0cnkuX3NldChcbiAgICAgICAgICAgIGRhdGEsXG4gICAgICAgICAgICBwYXRoLnNwbGl0KCcvJyksXG4gICAgICAgICAgICBhbnN3ZXJzW3BhdGhdIGFzIHt9LFxuICAgICAgICAgICAgbnVsbCxcbiAgICAgICAgICAgIHVuZGVmaW5lZCxcbiAgICAgICAgICAgIHRydWUsXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBkYXRhO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIHByaXZhdGUgc3RhdGljIF9zZXQoXG4gICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWFueVxuICAgIGRhdGE6IGFueSxcbiAgICBmcmFnbWVudHM6IHN0cmluZ1tdLFxuICAgIHZhbHVlOiB7fSxcbiAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tYW55XG4gICAgcGFyZW50OiBhbnkgfCBudWxsID0gbnVsbCxcbiAgICBwYXJlbnRQcm9wZXJ0eT86IHN0cmluZyxcbiAgICBmb3JjZT86IGJvb2xlYW4sXG4gICk6IHZvaWQge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZnJhZ21lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBmID0gZnJhZ21lbnRzW2ldO1xuXG4gICAgICBpZiAoZlswXSA9PSAnaScpIHtcbiAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KGRhdGEpKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBkYXRhLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgQ29yZVNjaGVtYVJlZ2lzdHJ5Ll9zZXQoZGF0YVtqXSwgZnJhZ21lbnRzLnNsaWNlKGkgKyAxKSwgdmFsdWUsIGRhdGEsICcnICsgaik7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm47XG4gICAgICB9IGVsc2UgaWYgKGYuc3RhcnRzV2l0aCgna2V5JykpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBkYXRhICE9PSAnb2JqZWN0Jykge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKGRhdGEpLmZvckVhY2gocHJvcGVydHkgPT4ge1xuICAgICAgICAgIENvcmVTY2hlbWFSZWdpc3RyeS5fc2V0KGRhdGFbcHJvcGVydHldLCBmcmFnbWVudHMuc2xpY2UoaSArIDEpLCB2YWx1ZSwgZGF0YSwgcHJvcGVydHkpO1xuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm47XG4gICAgICB9IGVsc2UgaWYgKGYuc3RhcnRzV2l0aCgnXFwnJykgJiYgZltmLmxlbmd0aCAtIDFdID09ICdcXCcnKSB7XG4gICAgICAgIGNvbnN0IHByb3BlcnR5ID0gZlxuICAgICAgICAgIC5zbGljZSgxLCAtMSlcbiAgICAgICAgICAucmVwbGFjZSgvXFxcXCcvZywgJ1xcJycpXG4gICAgICAgICAgLnJlcGxhY2UoL1xcXFxuL2csICdcXG4nKVxuICAgICAgICAgIC5yZXBsYWNlKC9cXFxcci9nLCAnXFxyJylcbiAgICAgICAgICAucmVwbGFjZSgvXFxcXGYvZywgJ1xcZicpXG4gICAgICAgICAgLnJlcGxhY2UoL1xcXFx0L2csICdcXHQnKTtcblxuICAgICAgICAvLyBXZSBrbm93IHdlIG5lZWQgYW4gb2JqZWN0IGJlY2F1c2UgdGhlIGZyYWdtZW50IGlzIGEgcHJvcGVydHkga2V5LlxuICAgICAgICBpZiAoIWRhdGEgJiYgcGFyZW50ICE9PSBudWxsICYmIHBhcmVudFByb3BlcnR5KSB7XG4gICAgICAgICAgZGF0YSA9IHBhcmVudFtwYXJlbnRQcm9wZXJ0eV0gPSB7fTtcbiAgICAgICAgfVxuICAgICAgICBwYXJlbnQgPSBkYXRhO1xuICAgICAgICBwYXJlbnRQcm9wZXJ0eSA9IHByb3BlcnR5O1xuXG4gICAgICAgIGRhdGEgPSBkYXRhW3Byb3BlcnR5XTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocGFyZW50ICYmIHBhcmVudFByb3BlcnR5ICYmIChmb3JjZSB8fCBwYXJlbnRbcGFyZW50UHJvcGVydHldID09PSB1bmRlZmluZWQpKSB7XG4gICAgICBwYXJlbnRbcGFyZW50UHJvcGVydHldID0gdmFsdWU7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfYXBwbHlTbWFydERlZmF1bHRzPFQ+KFxuICAgIGRhdGE6IFQsXG4gICAgc21hcnREZWZhdWx0czogTWFwPHN0cmluZywgSnNvbk9iamVjdD4sXG4gICk6IE9ic2VydmFibGU8VD4ge1xuICAgIHJldHVybiBvYnNlcnZhYmxlT2YoZGF0YSkucGlwZShcbiAgICAgIC4uLlsuLi5zbWFydERlZmF1bHRzLmVudHJpZXMoKV0ubWFwKChbcG9pbnRlciwgc2NoZW1hXSkgPT4ge1xuICAgICAgICByZXR1cm4gY29uY2F0TWFwPFQsIFQ+KGRhdGEgPT4ge1xuICAgICAgICAgIGNvbnN0IGZyYWdtZW50cyA9IEpTT04ucGFyc2UocG9pbnRlcik7XG4gICAgICAgICAgY29uc3Qgc291cmNlID0gdGhpcy5fc291cmNlTWFwLmdldCgoc2NoZW1hIGFzIEpzb25PYmplY3QpLiRzb3VyY2UgYXMgc3RyaW5nKTtcblxuICAgICAgICAgIGxldCB2YWx1ZSA9IHNvdXJjZSA/IHNvdXJjZShzY2hlbWEpIDogb2JzZXJ2YWJsZU9mKHVuZGVmaW5lZCk7XG5cbiAgICAgICAgICBpZiAoIWlzT2JzZXJ2YWJsZSh2YWx1ZSkpIHtcbiAgICAgICAgICAgIHZhbHVlID0gb2JzZXJ2YWJsZU9mKHZhbHVlKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gKHZhbHVlIGFzIE9ic2VydmFibGU8e30+KS5waXBlKFxuICAgICAgICAgICAgLy8gU3luY2hyb25vdXNseSBzZXQgdGhlIG5ldyBkYXRhIGF0IHRoZSBwcm9wZXIgSnNvblNjaGVtYSBwYXRoLlxuICAgICAgICAgICAgdGFwKHggPT4gQ29yZVNjaGVtYVJlZ2lzdHJ5Ll9zZXQoZGF0YSwgZnJhZ21lbnRzLCB4KSksXG4gICAgICAgICAgICAvLyBCdXQgcmV0dXJuIHRoZSBkYXRhIG9iamVjdC5cbiAgICAgICAgICAgIG1hcCgoKSA9PiBkYXRhKSxcbiAgICAgICAgICApO1xuICAgICAgICB9KTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cbn1cbiJdfQ==