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
const Url = require("url");
const exception_1 = require("../../exception/exception");
const utils_1 = require("../../utils");
const interface_1 = require("../interface");
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
        this._uriHandlers = new Set();
        this._pre = new utils_1.PartiallyOrderedSet();
        this._post = new utils_1.PartiallyOrderedSet();
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
    }
    _fetch(uri) {
        const maybeSchema = this._uriCache.get(uri);
        if (maybeSchema) {
            return Promise.resolve(maybeSchema);
        }
        // Try all handlers, one after the other.
        for (const maybeHandler of this._uriHandlers) {
            const handler = maybeHandler(uri);
            if (handler) {
                // The AJV API only understands Promises.
                return rxjs_1.from(handler).pipe(operators_1.tap(json => this._uriCache.set(uri, json))).toPromise();
            }
        }
        // If none are found, handle using http client.
        return new Promise((resolve, reject) => {
            http.get(uri, res => {
                if (!res.statusCode || res.statusCode >= 300) {
                    // Consume the rest of the data to free memory.
                    res.resume();
                    reject(new Error(`Request failed. Status Code: ${res.statusCode}`));
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
        let refMap = validate;
        const rootRefMap = validate.root;
        // Resolve from the root if it's different.
        if (validate.root && validate.schema !== rootRefMap.schema) {
            refMap = rootRefMap;
        }
        const schema = refMap.schema ? typeof refMap.schema == 'object' && refMap.schema : null;
        const maybeId = schema ? schema.id || schema.$id : null;
        if (typeof maybeId == 'string') {
            ref = Url.resolve(maybeId, ref);
        }
        let fullReference = (ref[0] === '#' && maybeId) ? maybeId + ref : ref;
        if (fullReference.endsWith('#')) {
            fullReference = fullReference.slice(0, -1);
        }
        // tslint:disable-next-line:no-any
        const context = validate.refVal[validate.refs[fullReference]];
        if (typeof context == 'function') {
            // Context will be a function if the schema isn't loaded yet, and an actual schema if it's
            // synchronously available.
            return { context, schema: context && context.schema };
        }
        else {
            return { context: validate, schema: context };
        }
    }
    /**
     * Flatten the Schema, resolving and replacing all the refs. Makes it into a synchronous schema
     * that is also easier to traverse. Does not cache the result.
     *
     * @param schema The schema or URI to flatten.
     * @returns An Observable of the flattened schema object.
     */
    flatten(schema) {
        this._ajv.removeSchema(schema);
        // Supports both synchronous and asynchronous compilation, by trying the synchronous
        // version first, then if refs are missing this will fails.
        // We also add any refs from external fetched schemas so that those will also be used
        // in synchronous (if available).
        let validator;
        try {
            this._currentCompilationSchemaInfo = undefined;
            validator = rxjs_1.of(this._ajv.compile(schema)).pipe(operators_1.tap(() => this._currentCompilationSchemaInfo = undefined));
        }
        catch (e) {
            // Propagate the error.
            if (!(e instanceof ajv.MissingRefError)) {
                return rxjs_1.throwError(e);
            }
            this._currentCompilationSchemaInfo = undefined;
            validator = rxjs_1.from(this._ajv.compileAsync(schema)).pipe(operators_1.tap(() => this._currentCompilationSchemaInfo = undefined));
        }
        return validator.pipe(operators_1.switchMap(validate => {
            const self = this;
            function visitor(current, pointer, parentSchema, index) {
                if (current
                    && parentSchema
                    && index
                    && interface_1.isJsonObject(current)
                    && current.hasOwnProperty('$ref')
                    && typeof current['$ref'] == 'string') {
                    const resolved = self._resolver(current['$ref'], validate);
                    if (resolved.schema) {
                        parentSchema[index] = resolved.schema;
                    }
                }
            }
            const schema = utils_1.deepCopy(validate.schema);
            visitor_1.visitJsonSchema(schema, visitor);
            return rxjs_1.of(schema);
        }));
    }
    /**
     * Compile and return a validation function for the Schema.
     *
     * @param schema The schema to validate. If a string, will fetch the schema before compiling it
     * (using schema as a URI).
     * @returns An Observable of the Validation function.
     */
    compile(schema) {
        const schemaInfo = {
            smartDefaultRecord: new Map(),
            promptDefinitions: [],
        };
        this._ajv.removeSchema(schema);
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
            const validationOptions = Object.assign({ withPrompts: true, applyPostTransforms: true, applyPreTransforms: true }, options);
            const validationContext = {
                promptFieldsWithValue: new Set(),
            };
            let result = rxjs_1.of(data);
            if (validationOptions.applyPreTransforms) {
                // tslint:disable-next-line:no-any https://github.com/ReactiveX/rxjs/issues/3989
                result = result.pipe(...[...this._pre].map(visitor => operators_1.concatMap((data) => {
                    return visitor_1.visitJson(data, visitor, schema, this._resolver, validate);
                })));
            }
            return result.pipe(operators_1.switchMap(updateData => this._applySmartDefaults(updateData, schemaInfo.smartDefaultRecord)), operators_1.switchMap(updatedData => {
                if (validationOptions.withPrompts === false) {
                    return rxjs_1.of(updatedData);
                }
                const visitor = (value, pointer) => {
                    if (value !== undefined) {
                        validationContext.promptFieldsWithValue.add(pointer);
                    }
                    return value;
                };
                if (schema === false || schema === true) {
                    return rxjs_1.of(updatedData);
                }
                return visitor_1.visitJson(updatedData, visitor, schema, this._resolver, validate);
            }), operators_1.switchMap(updatedData => {
                if (validationOptions.withPrompts === false) {
                    return rxjs_1.of(updatedData);
                }
                const definitions = schemaInfo.promptDefinitions
                    .filter(def => !validationContext.promptFieldsWithValue.has(def.id));
                if (this._promptProvider && definitions.length > 0) {
                    return rxjs_1.from(this._applyPrompts(updatedData, definitions));
                }
                else {
                    return rxjs_1.of(updatedData);
                }
            }), operators_1.switchMap(updatedData => {
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
                if (valid) {
                    let result = rxjs_1.of(data);
                    if (validationOptions.applyPostTransforms) {
                        // tslint:disable-next-line:no-any https://github.com/ReactiveX/rxjs/issues/3989
                        result = result.pipe(...[...this._post].map(visitor => operators_1.concatMap((data) => {
                            return visitor_1.visitJson(data, visitor, schema, this._resolver, validate);
                        })));
                    }
                    return result.pipe(operators_1.map(data => [data, valid]));
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
                    const compilationSchemInfo = this._currentCompilationSchemaInfo;
                    if (compilationSchemInfo === undefined) {
                        return () => true;
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
    registerUriHandler(handler) {
        this._uriHandlers.add(handler);
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
                    return () => true;
                }
                // tslint:disable-next-line:no-any
                const pathArray = it.dataPathArr.slice(1, it.dataLevel + 1);
                const path = '/' + pathArray.map(p => p.replace(/^\'/, '').replace(/\'$/, '')).join('/');
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
                    multiselect: type === 'list' ? schema.multiselect : false,
                    default: typeof parentSchema.default == 'object' ? undefined : parentSchema.default,
                    async validator(data) {
                        const result = it.self.validate(parentSchema, data);
                        if (typeof result === 'boolean') {
                            return result;
                        }
                        else {
                            try {
                                await result;
                                return true;
                            }
                            catch (_a) {
                                return false;
                            }
                        }
                    },
                };
                compilationSchemInfo.promptDefinitions.push(definition);
                return function () {
                    // If 'this' is undefined in the call, then it defaults to the global
                    // 'this'.
                    if (this && this.promptFieldsWithValue) {
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
                const pathFragments = path.split('/').map(pf => {
                    if (/^\d+$/.test(pf)) {
                        return pf;
                    }
                    else {
                        return '\'' + pf + '\'';
                    }
                });
                CoreSchemaRegistry._set(data, pathFragments.slice(1), answers[path], null, undefined, true);
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
        // tslint:disable-next-line:no-any https://github.com/ReactiveX/rxjs/issues/3989
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVnaXN0cnkuanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2NvcmUvc3JjL2pzb24vc2NoZW1hL3JlZ2lzdHJ5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUE7Ozs7OztHQU1HO0FBQ0gsMkJBQTJCO0FBQzNCLDZCQUE2QjtBQUM3QiwrQkFBd0Q7QUFDeEQsOENBQWdFO0FBQ2hFLDJCQUEyQjtBQUMzQix5REFBMEQ7QUFDMUQsdUNBQTBFO0FBQzFFLDRDQUE4RTtBQWdCOUUsdUNBQXVEO0FBbUJ2RCxNQUFhLHlCQUEwQixTQUFRLHlCQUFhO0lBRzFELFlBQ0UsTUFBK0IsRUFDL0IsV0FBVyxHQUFHLHFEQUFxRDtRQUVuRSxJQUFJLENBQUMsTUFBTSxJQUFJLE1BQU0sQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1lBQ2xDLEtBQUssQ0FBQywyQkFBMkIsQ0FBQyxDQUFDO1lBRW5DLE9BQU87U0FDUjtRQUVELE1BQU0sUUFBUSxHQUFHLHlCQUF5QixDQUFDLGNBQWMsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNsRSxLQUFLLENBQUMsR0FBRyxXQUFXLE9BQU8sUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDcEQsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7SUFDdkIsQ0FBQztJQUVNLE1BQU0sQ0FBQyxjQUFjLENBQUMsTUFBK0I7UUFDMUQsSUFBSSxDQUFDLE1BQU0sSUFBSSxNQUFNLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtZQUNsQyxPQUFPLEVBQUUsQ0FBQztTQUNYO1FBRUQsTUFBTSxRQUFRLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFO1lBQ2xDLElBQUksT0FBTyxHQUFHLGFBQWEsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLElBQUksR0FBRyxDQUFDLE9BQU8sRUFBRSxD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QyxLQUFLLENBQUMsRUFBRTtvQkFDeEIsS0FBSyxHQUFHLFNBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQztpQkFDbkI7Z0JBRUQsT0FBUSxLQUF3QixDQUFDLElBQUk7Z0JBQ25DLGdFQUFnRTtnQkFDaEUsZUFBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBQ3JELDhCQUE4QjtnQkFDOUIsZUFBRyxDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUNoQixDQUFDO1lBQ0osQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDLENBQUMsQ0FDSCxDQUFDO0lBQ0osQ0FBQztDQUNGO0FBNW9CRCxnREE0b0JDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0ICogYXMgYWp2IGZyb20gJ2Fqdic7XG5pbXBvcnQgKiBhcyBodHRwIGZyb20gJ2h0dHAnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZSwgZnJvbSwgb2YsIHRocm93RXJyb3IgfSBmcm9tICdyeGpzJztcbmltcG9ydCB7IGNvbmNhdE1hcCwgbWFwLCBzd2l0Y2hNYXAsIHRhcCB9IGZyb20gJ3J4anMvb3BlcmF0b3JzJztcbmltcG9ydCAqIGFzIFVybCBmcm9tICd1cmwnO1xuaW1wb3J0IHsgQmFzZUV4Y2VwdGlvbiB9IGZyb20gJy4uLy4uL2V4Y2VwdGlvbi9leGNlcHRpb24nO1xuaW1wb3J0IHsgUGFydGlhbGx5T3JkZXJlZFNldCwgZGVlcENvcHksIGlzT2JzZXJ2YWJsZSB9IGZyb20gJy4uLy4uL3V0aWxzJztcbmltcG9ydCB7IEpzb25BcnJheSwgSnNvbk9iamVjdCwgSnNvblZhbHVlLCBpc0pzb25PYmplY3QgfSBmcm9tICcuLi9pbnRlcmZhY2UnO1xuaW1wb3J0IHtcbiAgSnNvblBvaW50ZXIsXG4gIEpzb25WaXNpdG9yLFxuICBQcm9tcHREZWZpbml0aW9uLFxuICBQcm9tcHRQcm92aWRlcixcbiAgU2NoZW1hRm9ybWF0LFxuICBTY2hlbWFGb3JtYXR0ZXIsXG4gIFNjaGVtYVJlZ2lzdHJ5LFxuICBTY2hlbWFWYWxpZGF0b3IsXG4gIFNjaGVtYVZhbGlkYXRvckVycm9yLFxuICBTY2hlbWFWYWxpZGF0b3JPcHRpb25zLFxuICBTY2hlbWFWYWxpZGF0b3JSZXN1bHQsXG4gIFNtYXJ0RGVmYXVsdFByb3ZpZGVyLFxufSBmcm9tICcuL2ludGVyZmFjZSc7XG5pbXBvcnQgeyBKc29uU2NoZW1hIH0gZnJvbSAnLi9zY2hlbWEnO1xuaW1wb3J0IHsgdmlzaXRKc29uLCB2aXNpdEpzb25TY2hlbWEgfSBmcm9tICcuL3Zpc2l0b3InO1xuXG4vLyBUaGlzIGludGVyZmFjZSBzaG91bGQgYmUgZXhwb3J0ZWQgZnJvbSBhanYsIGJ1dCB0aGV5IG9ubHkgZXhwb3J0IHRoZSBjbGFzcyBhbmQgbm90IHRoZSB0eXBlLlxuaW50ZXJmYWNlIEFqdlZhbGlkYXRpb25FcnJvciB7XG4gIG1lc3NhZ2U6IHN0cmluZztcbiAgZXJyb3JzOiBBcnJheTxhanYuRXJyb3JPYmplY3Q+O1xuICBhanY6IHRydWU7XG4gIHZhbGlkYXRpb246IHRydWU7XG59XG5cbmludGVyZmFjZSBBanZSZWZNYXAge1xuICByZWZzOiBzdHJpbmdbXTtcbiAgcmVmVmFsOiBhbnk7IC8vIHRzbGludDpkaXNhYmxlLWxpbmU6bm8tYW55XG4gIHNjaGVtYTogSnNvbk9iamVjdDtcbn1cblxuZXhwb3J0IHR5cGUgVXJpSGFuZGxlciA9ICh1cmk6IHN0cmluZykgPT5cbiAgT2JzZXJ2YWJsZTxKc29uT2JqZWN0PiB8IFByb21pc2U8SnNvbk9iamVjdD4gfCBudWxsIHwgdW5kZWZpbmVkO1xuXG5leHBvcnQgY2xhc3MgU2NoZW1hVmFsaWRhdGlvbkV4Y2VwdGlvbiBleHRlbmRzIEJhc2VFeGNlcHRpb24ge1xuICBwdWJsaWMgcmVhZG9ubHkgZXJyb3JzOiBTY2hlbWFWYWxpZGF0b3JFcnJvcltdO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIGVycm9ycz86IFNjaGVtYVZhbGlkYXRvckVycm9yW10sXG4gICAgYmFzZU1lc3NhZ2UgPSAnU2NoZW1hIHZhbGlkYXRpb24gZmFpbGVkIHdpdGggdGhlIGZvbGxvd2luZyBlcnJvcnM6JyxcbiAgKSB7XG4gICAgaWYgKCFlcnJvcnMgfHwgZXJyb3JzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgc3VwZXIoJ1NjaGVtYSB2YWxpZGF0aW9uIGZhaWxlZC4nKTtcblxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IG1lc3NhZ2VzID0gU2NoZW1hVmFsaWRhdGlvbkV4Y2VwdGlvbi5jcmVhdGVNZXNzYWdlcyhlcnJvcnMpO1xuICAgIHN1cGVyKGAke2Jhc2VNZXNzYWdlfVxcbiAgJHttZXNzYWdlcy5qb2luKCdcXG4gICcpfWApO1xuICAgIHRoaXMuZXJyb3JzID0gZXJyb3JzO1xuICB9XG5cbiAgcHVibGljIHN0YXRpYyBjcmVhdGVNZXNzYWdlcyhlcnJvcnM/OiBTY2hlbWFWYWxpZGF0b3JFcnJvcltdKTogc3RyaW5nW10ge1xuICAgIGlmICghZXJyb3JzIHx8IGVycm9ycy5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICBjb25zdCBtZXNzYWdlcyA9IGVycm9ycy5tYXAoKGVycikgPT4ge1xuICAgICAgbGV0IG1lc3NhZ2UgPSBgRGF0YSBwYXRoICR7SlNPTi5zdHJpbmdpZnkoZXJyLmRhdGFQYXRoKX0gJHtlcnIubWVzc2FnZX1gO1xuICAgICAgaWYgKGVyci5rZXl3b3JkID09PSAnYWRkaXRpb25hbFByb3BlcnRpZXMnKSB7XG4gICAgICAgIG1lc3NhZ2UgKz0gYCgke2Vyci5wYXJhbXMuYWRkaXRpb25hbFByb3BlcnR5fSlgO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gbWVzc2FnZSArICcuJztcbiAgICB9KTtcblxuICAgIHJldHVybiBtZXNzYWdlcztcbiAgfVxufVxuXG5pbnRlcmZhY2UgU2NoZW1hSW5mbyB7XG4gIHNtYXJ0RGVmYXVsdFJlY29yZDogTWFwPHN0cmluZywgSnNvbk9iamVjdD47XG4gIHByb21wdERlZmluaXRpb25zOiBBcnJheTxQcm9tcHREZWZpbml0aW9uPjtcbn1cblxuZXhwb3J0IGNsYXNzIENvcmVTY2hlbWFSZWdpc3RyeSBpbXBsZW1lbnRzIFNjaGVtYVJlZ2lzdHJ5IHtcbiAgcHJpdmF0ZSBfYWp2OiBhanYuQWp2O1xuICBwcml2YXRlIF91cmlDYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCBKc29uT2JqZWN0PigpO1xuICBwcml2YXRlIF91cmlIYW5kbGVycyA9IG5ldyBTZXQ8VXJpSGFuZGxlcj4oKTtcbiAgcHJpdmF0ZSBfcHJlID0gbmV3IFBhcnRpYWxseU9yZGVyZWRTZXQ8SnNvblZpc2l0b3I+KCk7XG4gIHByaXZhdGUgX3Bvc3QgPSBuZXcgUGFydGlhbGx5T3JkZXJlZFNldDxKc29uVmlzaXRvcj4oKTtcblxuICBwcml2YXRlIF9jdXJyZW50Q29tcGlsYXRpb25TY2hlbWFJbmZvPzogU2NoZW1hSW5mbztcblxuICBwcml2YXRlIF9zbWFydERlZmF1bHRLZXl3b3JkID0gZmFsc2U7XG4gIHByaXZhdGUgX3Byb21wdFByb3ZpZGVyPzogUHJvbXB0UHJvdmlkZXI7XG4gIHByaXZhdGUgX3NvdXJjZU1hcCA9IG5ldyBNYXA8c3RyaW5nLCBTbWFydERlZmF1bHRQcm92aWRlcjx7fT4+KCk7XG5cbiAgY29uc3RydWN0b3IoZm9ybWF0czogU2NoZW1hRm9ybWF0W10gPSBbXSkge1xuICAgIC8qKlxuICAgICAqIEJ1aWxkIGFuIEFKViBpbnN0YW5jZSB0aGF0IHdpbGwgYmUgdXNlZCB0byB2YWxpZGF0ZSBzY2hlbWFzLlxuICAgICAqL1xuXG4gICAgY29uc3QgZm9ybWF0c09iajogeyBbbmFtZTogc3RyaW5nXTogU2NoZW1hRm9ybWF0dGVyIH0gPSB7fTtcblxuICAgIGZvciAoY29uc3QgZm9ybWF0IG9mIGZvcm1hdHMpIHtcbiAgICAgIGZvcm1hdHNPYmpbZm9ybWF0Lm5hbWVdID0gZm9ybWF0LmZvcm1hdHRlcjtcbiAgICB9XG5cbiAgICB0aGlzLl9hanYgPSBhanYoe1xuICAgICAgZm9ybWF0czogZm9ybWF0c09iaixcbiAgICAgIGxvYWRTY2hlbWE6ICh1cmk6IHN0cmluZykgPT4gdGhpcy5fZmV0Y2godXJpKSxcbiAgICAgIHNjaGVtYUlkOiAnYXV0bycsXG4gICAgICBwYXNzQ29udGV4dDogdHJ1ZSxcbiAgICB9KTtcblxuICAgIHRoaXMuX2Fqdi5hZGRNZXRhU2NoZW1hKHJlcXVpcmUoJ2Fqdi9saWIvcmVmcy9qc29uLXNjaGVtYS1kcmFmdC0wNC5qc29uJykpO1xuICAgIHRoaXMuX2Fqdi5hZGRNZXRhU2NoZW1hKHJlcXVpcmUoJ2Fqdi9saWIvcmVmcy9qc29uLXNjaGVtYS1kcmFmdC0wNi5qc29uJykpO1xuICB9XG5cbiAgcHJpdmF0ZSBfZmV0Y2godXJpOiBzdHJpbmcpOiBQcm9taXNlPEpzb25PYmplY3Q+IHtcbiAgICBjb25zdCBtYXliZVNjaGVtYSA9IHRoaXMuX3VyaUNhY2hlLmdldCh1cmkpO1xuXG4gICAgaWYgKG1heWJlU2NoZW1hKSB7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKG1heWJlU2NoZW1hKTtcbiAgICB9XG5cbiAgICAvLyBUcnkgYWxsIGhhbmRsZXJzLCBvbmUgYWZ0ZXIgdGhlIG90aGVyLlxuICAgIGZvciAoY29uc3QgbWF5YmVIYW5kbGVyIG9mIHRoaXMuX3VyaUhhbmRsZXJzKSB7XG4gICAgICBjb25zdCBoYW5kbGVyID0gbWF5YmVIYW5kbGVyKHVyaSk7XG4gICAgICBpZiAoaGFuZGxlcikge1xuICAgICAgICAvLyBUaGUgQUpWIEFQSSBvbmx5IHVuZGVyc3RhbmRzIFByb21pc2VzLlxuICAgICAgICByZXR1cm4gZnJvbShoYW5kbGVyKS5waXBlKFxuICAgICAgICAgIHRhcChqc29uID0+IHRoaXMuX3VyaUNhY2hlLnNldCh1cmksIGpzb24pKSxcbiAgICAgICAgKS50b1Byb21pc2UoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBJZiBub25lIGFyZSBmb3VuZCwgaGFuZGxlIHVzaW5nIGh0dHAgY2xpZW50LlxuICAgIHJldHVybiBuZXcgUHJvbWlzZTxKc29uT2JqZWN0PigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBodHRwLmdldCh1cmksIHJlcyA9PiB7XG4gICAgICAgIGlmICghcmVzLnN0YXR1c0NvZGUgfHwgcmVzLnN0YXR1c0NvZGUgPj0gMzAwKSB7XG4gICAgICAgICAgLy8gQ29uc3VtZSB0aGUgcmVzdCBvZiB0aGUgZGF0YSB0byBmcmVlIG1lbW9yeS5cbiAgICAgICAgICByZXMucmVzdW1lKCk7XG4gICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihgUmVxdWVzdCBmYWlsZWQuIFN0YXR1cyBDb2RlOiAke3Jlcy5zdGF0dXNDb2RlfWApKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXMuc2V0RW5jb2RpbmcoJ3V0ZjgnKTtcbiAgICAgICAgICBsZXQgZGF0YSA9ICcnO1xuICAgICAgICAgIHJlcy5vbignZGF0YScsIGNodW5rID0+IHtcbiAgICAgICAgICAgIGRhdGEgKz0gY2h1bms7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgcmVzLm9uKCdlbmQnLCAoKSA9PiB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICBjb25zdCBqc29uID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICAgICAgICAgICAgdGhpcy5fdXJpQ2FjaGUuc2V0KHVyaSwganNvbik7XG4gICAgICAgICAgICAgIHJlc29sdmUoanNvbik7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZCBhIHRyYW5zZm9ybWF0aW9uIHN0ZXAgYmVmb3JlIHRoZSB2YWxpZGF0aW9uIG9mIGFueSBKc29uLlxuICAgKiBAcGFyYW0ge0pzb25WaXNpdG9yfSB2aXNpdG9yIFRoZSB2aXNpdG9yIHRvIHRyYW5zZm9ybSBldmVyeSB2YWx1ZS5cbiAgICogQHBhcmFtIHtKc29uVmlzaXRvcltdfSBkZXBzIEEgbGlzdCBvZiBvdGhlciB2aXNpdG9ycyB0byBydW4gYmVmb3JlLlxuICAgKi9cbiAgYWRkUHJlVHJhbnNmb3JtKHZpc2l0b3I6IEpzb25WaXNpdG9yLCBkZXBzPzogSnNvblZpc2l0b3JbXSkge1xuICAgIHRoaXMuX3ByZS5hZGQodmlzaXRvciwgZGVwcyk7XG4gIH1cblxuICAvKipcbiAgICogQWRkIGEgdHJhbnNmb3JtYXRpb24gc3RlcCBhZnRlciB0aGUgdmFsaWRhdGlvbiBvZiBhbnkgSnNvbi4gVGhlIEpTT04gd2lsbCBub3QgYmUgdmFsaWRhdGVkXG4gICAqIGFmdGVyIHRoZSBQT1NULCBzbyBpZiB0cmFuc2Zvcm1hdGlvbnMgYXJlIG5vdCBjb21wYXRpYmxlIHdpdGggdGhlIFNjaGVtYSBpdCB3aWxsIG5vdCByZXN1bHRcbiAgICogaW4gYW4gZXJyb3IuXG4gICAqIEBwYXJhbSB7SnNvblZpc2l0b3J9IHZpc2l0b3IgVGhlIHZpc2l0b3IgdG8gdHJhbnNmb3JtIGV2ZXJ5IHZhbHVlLlxuICAgKiBAcGFyYW0ge0pzb25WaXNpdG9yW119IGRlcHMgQSBsaXN0IG9mIG90aGVyIHZpc2l0b3JzIHRvIHJ1biBiZWZvcmUuXG4gICAqL1xuICBhZGRQb3N0VHJhbnNmb3JtKHZpc2l0b3I6IEpzb25WaXNpdG9yLCBkZXBzPzogSnNvblZpc2l0b3JbXSkge1xuICAgIHRoaXMuX3Bvc3QuYWRkKHZpc2l0b3IsIGRlcHMpO1xuICB9XG5cbiAgcHJvdGVjdGVkIF9yZXNvbHZlcihcbiAgICByZWY6IHN0cmluZyxcbiAgICB2YWxpZGF0ZTogYWp2LlZhbGlkYXRlRnVuY3Rpb24sXG4gICk6IHsgY29udGV4dD86IGFqdi5WYWxpZGF0ZUZ1bmN0aW9uLCBzY2hlbWE/OiBKc29uT2JqZWN0IH0ge1xuICAgIGlmICghdmFsaWRhdGUgfHwgIXZhbGlkYXRlLnJlZnMgfHwgIXZhbGlkYXRlLnJlZlZhbCB8fCAhcmVmKSB7XG4gICAgICByZXR1cm4ge307XG4gICAgfVxuXG4gICAgbGV0IHJlZk1hcCA9IHZhbGlkYXRlIGFzIEFqdlJlZk1hcDtcbiAgICBjb25zdCByb290UmVmTWFwID0gdmFsaWRhdGUucm9vdCBhcyBBanZSZWZNYXA7XG5cbiAgICAvLyBSZXNvbHZlIGZyb20gdGhlIHJvb3QgaWYgaXQncyBkaWZmZXJlbnQuXG4gICAgaWYgKHZhbGlkYXRlLnJvb3QgJiYgdmFsaWRhdGUuc2NoZW1hICE9PSByb290UmVmTWFwLnNjaGVtYSkge1xuICAgICAgcmVmTWFwID0gcm9vdFJlZk1hcDtcbiAgICB9XG5cbiAgICBjb25zdCBzY2hlbWEgPSByZWZNYXAuc2NoZW1hID8gdHlwZW9mIHJlZk1hcC5zY2hlbWEgPT0gJ29iamVjdCcgJiYgcmVmTWFwLnNjaGVtYSA6IG51bGw7XG4gICAgY29uc3QgbWF5YmVJZCA9IHNjaGVtYSA/IChzY2hlbWEgYXMgSnNvbk9iamVjdCkuaWQgfHwgKHNjaGVtYSBhcyBKc29uT2JqZWN0KS4kaWQgOiBudWxsO1xuXG4gICAgaWYgKHR5cGVvZiBtYXliZUlkID09ICdzdHJpbmcnKSB7XG4gICAgICByZWYgPSBVcmwucmVzb2x2ZShtYXliZUlkLCByZWYpO1xuICAgIH1cblxuICAgIGxldCBmdWxsUmVmZXJlbmNlID0gKHJlZlswXSA9PT0gJyMnICYmIG1heWJlSWQpID8gbWF5YmVJZCArIHJlZiA6IHJlZjtcbiAgICBpZiAoZnVsbFJlZmVyZW5jZS5lbmRzV2l0aCgnIycpKSB7XG4gICAgICBmdWxsUmVmZXJlbmNlID0gZnVsbFJlZmVyZW5jZS5zbGljZSgwLCAtMSk7XG4gICAgfVxuXG4gICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWFueVxuICAgIGNvbnN0IGNvbnRleHQgPSB2YWxpZGF0ZS5yZWZWYWxbKHZhbGlkYXRlLnJlZnMgYXMgYW55KVtmdWxsUmVmZXJlbmNlXV07XG5cbiAgICBpZiAodHlwZW9mIGNvbnRleHQgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgLy8gQ29udGV4dCB3aWxsIGJlIGEgZnVuY3Rpb24gaWYgdGhlIHNjaGVtYSBpc24ndCBsb2FkZWQgeWV0LCBhbmQgYW4gYWN0dWFsIHNjaGVtYSBpZiBpdCdzXG4gICAgICAvLyBzeW5jaHJvbm91c2x5IGF2YWlsYWJsZS5cbiAgICAgIHJldHVybiB7IGNvbnRleHQsIHNjaGVtYTogY29udGV4dCAmJiBjb250ZXh0LnNjaGVtYSBhcyBKc29uT2JqZWN0IH07XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB7IGNvbnRleHQ6IHZhbGlkYXRlLCBzY2hlbWE6IGNvbnRleHQgYXMgSnNvbk9iamVjdCB9O1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBGbGF0dGVuIHRoZSBTY2hlbWEsIHJlc29sdmluZyBhbmQgcmVwbGFjaW5nIGFsbCB0aGUgcmVmcy4gTWFrZXMgaXQgaW50byBhIHN5bmNocm9ub3VzIHNjaGVtYVxuICAgKiB0aGF0IGlzIGFsc28gZWFzaWVyIHRvIHRyYXZlcnNlLiBEb2VzIG5vdCBjYWNoZSB0aGUgcmVzdWx0LlxuICAgKlxuICAgKiBAcGFyYW0gc2NoZW1hIFRoZSBzY2hlbWEgb3IgVVJJIHRvIGZsYXR0ZW4uXG4gICAqIEByZXR1cm5zIEFuIE9ic2VydmFibGUgb2YgdGhlIGZsYXR0ZW5lZCBzY2hlbWEgb2JqZWN0LlxuICAgKi9cbiAgZmxhdHRlbihzY2hlbWE6IEpzb25PYmplY3QpOiBPYnNlcnZhYmxlPEpzb25PYmplY3Q+IHtcbiAgICB0aGlzLl9hanYucmVtb3ZlU2NoZW1hKHNjaGVtYSk7XG5cbiAgICAvLyBTdXBwb3J0cyBib3RoIHN5bmNocm9ub3VzIGFuZCBhc3luY2hyb25vdXMgY29tcGlsYXRpb24sIGJ5IHRyeWluZyB0aGUgc3luY2hyb25vdXNcbiAgICAvLyB2ZXJzaW9uIGZpcnN0LCB0aGVuIGlmIHJlZnMgYXJlIG1pc3NpbmcgdGhpcyB3aWxsIGZhaWxzLlxuICAgIC8vIFdlIGFsc28gYWRkIGFueSByZWZzIGZyb20gZXh0ZXJuYWwgZmV0Y2hlZCBzY2hlbWFzIHNvIHRoYXQgdGhvc2Ugd2lsbCBhbHNvIGJlIHVzZWRcbiAgICAvLyBpbiBzeW5jaHJvbm91cyAoaWYgYXZhaWxhYmxlKS5cbiAgICBsZXQgdmFsaWRhdG9yOiBPYnNlcnZhYmxlPGFqdi5WYWxpZGF0ZUZ1bmN0aW9uPjtcbiAgICB0cnkge1xuICAgICAgdGhpcy5fY3VycmVudENvbXBpbGF0aW9uU2NoZW1hSW5mbyA9IHVuZGVmaW5lZDtcbiAgICAgIHZhbGlkYXRvciA9IG9mKHRoaXMuX2Fqdi5jb21waWxlKHNjaGVtYSkpLnBpcGUoXG4gICAgICAgIHRhcCgoKSA9PiB0aGlzLl9jdXJyZW50Q29tcGlsYXRpb25TY2hlbWFJbmZvID0gdW5kZWZpbmVkKSxcbiAgICAgICk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgLy8gUHJvcGFnYXRlIHRoZSBlcnJvci5cbiAgICAgIGlmICghKGUgaW5zdGFuY2VvZiAoYWp2Lk1pc3NpbmdSZWZFcnJvciBhcyB7fSBhcyBGdW5jdGlvbikpKSB7XG4gICAgICAgIHJldHVybiB0aHJvd0Vycm9yKGUpO1xuICAgICAgfVxuXG4gICAgICB0aGlzLl9jdXJyZW50Q29tcGlsYXRpb25TY2hlbWFJbmZvID0gdW5kZWZpbmVkO1xuICAgICAgdmFsaWRhdG9yID0gZnJvbSh0aGlzLl9hanYuY29tcGlsZUFzeW5jKHNjaGVtYSkpLnBpcGUoXG4gICAgICAgIHRhcCgoKSA9PiB0aGlzLl9jdXJyZW50Q29tcGlsYXRpb25TY2hlbWFJbmZvID0gdW5kZWZpbmVkKSxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHZhbGlkYXRvci5waXBlKFxuICAgICAgc3dpdGNoTWFwKHZhbGlkYXRlID0+IHtcbiAgICAgICAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgICAgICAgZnVuY3Rpb24gdmlzaXRvcihcbiAgICAgICAgICBjdXJyZW50OiBKc29uT2JqZWN0IHwgSnNvbkFycmF5LFxuICAgICAgICAgIHBvaW50ZXI6IEpzb25Qb2ludGVyLFxuICAgICAgICAgIHBhcmVudFNjaGVtYT86IEpzb25PYmplY3QgfCBKc29uQXJyYXksXG4gICAgICAgICAgaW5kZXg/OiBzdHJpbmcsXG4gICAgICAgICkge1xuICAgICAgICAgIGlmIChjdXJyZW50XG4gICAgICAgICAgICAmJiBwYXJlbnRTY2hlbWFcbiAgICAgICAgICAgICYmIGluZGV4XG4gICAgICAgICAgICAmJiBpc0pzb25PYmplY3QoY3VycmVudClcbiAgICAgICAgICAgICYmIGN1cnJlbnQuaGFzT3duUHJvcGVydHkoJyRyZWYnKVxuICAgICAgICAgICAgJiYgdHlwZW9mIGN1cnJlbnRbJyRyZWYnXSA9PSAnc3RyaW5nJ1xuICAgICAgICAgICkge1xuICAgICAgICAgICAgY29uc3QgcmVzb2x2ZWQgPSBzZWxmLl9yZXNvbHZlcihjdXJyZW50WyckcmVmJ10gYXMgc3RyaW5nLCB2YWxpZGF0ZSk7XG5cbiAgICAgICAgICAgIGlmIChyZXNvbHZlZC5zY2hlbWEpIHtcbiAgICAgICAgICAgICAgKHBhcmVudFNjaGVtYSBhcyBKc29uT2JqZWN0KVtpbmRleF0gPSByZXNvbHZlZC5zY2hlbWE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc2NoZW1hID0gZGVlcENvcHkodmFsaWRhdGUuc2NoZW1hIGFzIEpzb25PYmplY3QpO1xuICAgICAgICB2aXNpdEpzb25TY2hlbWEoc2NoZW1hLCB2aXNpdG9yKTtcblxuICAgICAgICByZXR1cm4gb2Yoc2NoZW1hKTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICAvKipcbiAgICogQ29tcGlsZSBhbmQgcmV0dXJuIGEgdmFsaWRhdGlvbiBmdW5jdGlvbiBmb3IgdGhlIFNjaGVtYS5cbiAgICpcbiAgICogQHBhcmFtIHNjaGVtYSBUaGUgc2NoZW1hIHRvIHZhbGlkYXRlLiBJZiBhIHN0cmluZywgd2lsbCBmZXRjaCB0aGUgc2NoZW1hIGJlZm9yZSBjb21waWxpbmcgaXRcbiAgICogKHVzaW5nIHNjaGVtYSBhcyBhIFVSSSkuXG4gICAqIEByZXR1cm5zIEFuIE9ic2VydmFibGUgb2YgdGhlIFZhbGlkYXRpb24gZnVuY3Rpb24uXG4gICAqL1xuICBjb21waWxlKHNjaGVtYTogSnNvblNjaGVtYSk6IE9ic2VydmFibGU8U2NoZW1hVmFsaWRhdG9yPiB7XG4gICAgY29uc3Qgc2NoZW1hSW5mbzogU2NoZW1hSW5mbyA9IHtcbiAgICAgIHNtYXJ0RGVmYXVsdFJlY29yZDogbmV3IE1hcDxzdHJpbmcsIEpzb25PYmplY3Q+KCksXG4gICAgICBwcm9tcHREZWZpbml0aW9uczogW10sXG4gICAgfTtcblxuICAgIHRoaXMuX2Fqdi5yZW1vdmVTY2hlbWEoc2NoZW1hKTtcblxuICAgIC8vIFN1cHBvcnRzIGJvdGggc3luY2hyb25vdXMgYW5kIGFzeW5jaHJvbm91cyBjb21waWxhdGlvbiwgYnkgdHJ5aW5nIHRoZSBzeW5jaHJvbm91c1xuICAgIC8vIHZlcnNpb24gZmlyc3QsIHRoZW4gaWYgcmVmcyBhcmUgbWlzc2luZyB0aGlzIHdpbGwgZmFpbHMuXG4gICAgLy8gV2UgYWxzbyBhZGQgYW55IHJlZnMgZnJvbSBleHRlcm5hbCBmZXRjaGVkIHNjaGVtYXMgc28gdGhhdCB0aG9zZSB3aWxsIGFsc28gYmUgdXNlZFxuICAgIC8vIGluIHN5bmNocm9ub3VzIChpZiBhdmFpbGFibGUpLlxuICAgIGxldCB2YWxpZGF0b3I6IE9ic2VydmFibGU8YWp2LlZhbGlkYXRlRnVuY3Rpb24+O1xuICAgIHRyeSB7XG4gICAgICB0aGlzLl9jdXJyZW50Q29tcGlsYXRpb25TY2hlbWFJbmZvID0gc2NoZW1hSW5mbztcbiAgICAgIHZhbGlkYXRvciA9IG9mKHRoaXMuX2Fqdi5jb21waWxlKHNjaGVtYSkpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIC8vIFByb3BhZ2F0ZSB0aGUgZXJyb3IuXG4gICAgICBpZiAoIShlIGluc3RhbmNlb2YgKGFqdi5NaXNzaW5nUmVmRXJyb3IgYXMge30gYXMgRnVuY3Rpb24pKSkge1xuICAgICAgICByZXR1cm4gdGhyb3dFcnJvcihlKTtcbiAgICAgIH1cblxuICAgICAgdHJ5IHtcbiAgICAgICAgdmFsaWRhdG9yID0gZnJvbSh0aGlzLl9hanYuY29tcGlsZUFzeW5jKHNjaGVtYSkpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICByZXR1cm4gdGhyb3dFcnJvcihlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdmFsaWRhdG9yXG4gICAgICAucGlwZShcbiAgICAgICAgbWFwKHZhbGlkYXRlID0+IChkYXRhOiBKc29uVmFsdWUsIG9wdGlvbnM/OiBTY2hlbWFWYWxpZGF0b3JPcHRpb25zKSA9PiB7XG4gICAgICAgICAgY29uc3QgdmFsaWRhdGlvbk9wdGlvbnM6IFNjaGVtYVZhbGlkYXRvck9wdGlvbnMgPSB7XG4gICAgICAgICAgICB3aXRoUHJvbXB0czogdHJ1ZSxcbiAgICAgICAgICAgIGFwcGx5UG9zdFRyYW5zZm9ybXM6IHRydWUsXG4gICAgICAgICAgICBhcHBseVByZVRyYW5zZm9ybXM6IHRydWUsXG4gICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgIH07XG4gICAgICAgICAgY29uc3QgdmFsaWRhdGlvbkNvbnRleHQgPSB7XG4gICAgICAgICAgICBwcm9tcHRGaWVsZHNXaXRoVmFsdWU6IG5ldyBTZXQ8c3RyaW5nPigpLFxuICAgICAgICAgIH07XG5cbiAgICAgICAgICBsZXQgcmVzdWx0ID0gb2YoZGF0YSk7XG4gICAgICAgICAgaWYgKHZhbGlkYXRpb25PcHRpb25zLmFwcGx5UHJlVHJhbnNmb3Jtcykge1xuICAgICAgICAgICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWFueSBodHRwczovL2dpdGh1Yi5jb20vUmVhY3RpdmVYL3J4anMvaXNzdWVzLzM5ODlcbiAgICAgICAgICAgIHJlc3VsdCA9IChyZXN1bHQgYXMgYW55KS5waXBlKFxuICAgICAgICAgICAgICAuLi5bLi4udGhpcy5fcHJlXS5tYXAodmlzaXRvciA9PiBjb25jYXRNYXAoKGRhdGE6IEpzb25WYWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiB2aXNpdEpzb24oZGF0YSwgdmlzaXRvciwgc2NoZW1hLCB0aGlzLl9yZXNvbHZlciwgdmFsaWRhdGUpO1xuICAgICAgICAgICAgICB9KSksXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiByZXN1bHQucGlwZShcbiAgICAgICAgICAgIHN3aXRjaE1hcCh1cGRhdGVEYXRhID0+IHRoaXMuX2FwcGx5U21hcnREZWZhdWx0cyhcbiAgICAgICAgICAgICAgdXBkYXRlRGF0YSxcbiAgICAgICAgICAgICAgc2NoZW1hSW5mby5zbWFydERlZmF1bHRSZWNvcmQsXG4gICAgICAgICAgICApKSxcbiAgICAgICAgICAgIHN3aXRjaE1hcCh1cGRhdGVkRGF0YSA9PiB7XG4gICAgICAgICAgICAgIGlmICh2YWxpZGF0aW9uT3B0aW9ucy53aXRoUHJvbXB0cyA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gb2YodXBkYXRlZERhdGEpO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgY29uc3QgdmlzaXRvcjogSnNvblZpc2l0b3IgPSAodmFsdWUsIHBvaW50ZXIpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAodmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgdmFsaWRhdGlvbkNvbnRleHQucHJvbXB0RmllbGRzV2l0aFZhbHVlLmFkZChwb2ludGVyKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgIGlmIChzY2hlbWEgPT09IGZhbHNlIHx8IHNjaGVtYSA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBvZih1cGRhdGVkRGF0YSk7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICByZXR1cm4gdmlzaXRKc29uKHVwZGF0ZWREYXRhLCB2aXNpdG9yLCBzY2hlbWEsIHRoaXMuX3Jlc29sdmVyLCB2YWxpZGF0ZSk7XG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIHN3aXRjaE1hcCh1cGRhdGVkRGF0YSA9PiB7XG4gICAgICAgICAgICAgIGlmICh2YWxpZGF0aW9uT3B0aW9ucy53aXRoUHJvbXB0cyA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gb2YodXBkYXRlZERhdGEpO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgY29uc3QgZGVmaW5pdGlvbnMgPSBzY2hlbWFJbmZvLnByb21wdERlZmluaXRpb25zXG4gICAgICAgICAgICAgICAgLmZpbHRlcihkZWYgPT4gIXZhbGlkYXRpb25Db250ZXh0LnByb21wdEZpZWxkc1dpdGhWYWx1ZS5oYXMoZGVmLmlkKSk7XG5cbiAgICAgICAgICAgICAgaWYgKHRoaXMuX3Byb21wdFByb3ZpZGVyICYmIGRlZmluaXRpb25zLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZnJvbSh0aGlzLl9hcHBseVByb21wdHModXBkYXRlZERhdGEsIGRlZmluaXRpb25zKSk7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG9mKHVwZGF0ZWREYXRhKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgICBzd2l0Y2hNYXAodXBkYXRlZERhdGEgPT4ge1xuICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSB2YWxpZGF0ZS5jYWxsKHZhbGlkYXRpb25Db250ZXh0LCB1cGRhdGVkRGF0YSk7XG5cbiAgICAgICAgICAgICAgcmV0dXJuIHR5cGVvZiByZXN1bHQgPT0gJ2Jvb2xlYW4nXG4gICAgICAgICAgICAgICAgPyBvZihbdXBkYXRlZERhdGEsIHJlc3VsdF0pXG4gICAgICAgICAgICAgICAgOiBmcm9tKChyZXN1bHQgYXMgUHJvbWlzZTxib29sZWFuPilcbiAgICAgICAgICAgICAgICAgIC50aGVuKHIgPT4gW3VwZGF0ZWREYXRhLCB0cnVlXSlcbiAgICAgICAgICAgICAgICAgIC5jYXRjaCgoZXJyOiBFcnJvciB8IEFqdlZhbGlkYXRpb25FcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoKGVyciBhcyBBanZWYWxpZGF0aW9uRXJyb3IpLmFqdikge1xuICAgICAgICAgICAgICAgICAgICAgIHZhbGlkYXRlLmVycm9ycyA9IChlcnIgYXMgQWp2VmFsaWRhdGlvbkVycm9yKS5lcnJvcnM7XG5cbiAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKFt1cGRhdGVkRGF0YSwgZmFsc2VdKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChlcnIpO1xuICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgfSksXG4gICAgICAgICAgICBzd2l0Y2hNYXAoKFtkYXRhLCB2YWxpZF06IFtKc29uVmFsdWUsIGJvb2xlYW5dKSA9PiB7XG4gICAgICAgICAgICAgIGlmICh2YWxpZCkge1xuICAgICAgICAgICAgICAgIGxldCByZXN1bHQgPSBvZihkYXRhKTtcblxuICAgICAgICAgICAgICAgIGlmICh2YWxpZGF0aW9uT3B0aW9ucy5hcHBseVBvc3RUcmFuc2Zvcm1zKSB7XG4gICAgICAgICAgICAgICAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tYW55IGh0dHBzOi8vZ2l0aHViLmNvbS9SZWFjdGl2ZVgvcnhqcy9pc3N1ZXMvMzk4OVxuICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gKHJlc3VsdCBhcyBhbnkpLnBpcGUoXG4gICAgICAgICAgICAgICAgICAgIC4uLlsuLi50aGlzLl9wb3N0XS5tYXAodmlzaXRvciA9PiBjb25jYXRNYXAoKGRhdGE6IEpzb25WYWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB2aXNpdEpzb24oZGF0YSwgdmlzaXRvciwgc2NoZW1hLCB0aGlzLl9yZXNvbHZlciwgdmFsaWRhdGUpO1xuICAgICAgICAgICAgICAgICAgICB9KSksXG4gICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHQucGlwZShcbiAgICAgICAgICAgICAgICAgIG1hcChkYXRhID0+IFtkYXRhLCB2YWxpZF0pLFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG9mKFtkYXRhLCB2YWxpZF0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIG1hcCgoW2RhdGEsIHZhbGlkXTogW0pzb25WYWx1ZSwgYm9vbGVhbl0pID0+IHtcbiAgICAgICAgICAgICAgaWYgKHZhbGlkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgZGF0YSwgc3VjY2VzczogdHJ1ZSB9IGFzIFNjaGVtYVZhbGlkYXRvclJlc3VsdDtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgZGF0YSxcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBlcnJvcnM6ICh2YWxpZGF0ZS5lcnJvcnMgfHwgW10pLFxuICAgICAgICAgICAgICB9IGFzIFNjaGVtYVZhbGlkYXRvclJlc3VsdDtcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICk7XG4gICAgICAgIH0pLFxuICAgICAgKTtcbiAgfVxuXG4gIGFkZEZvcm1hdChmb3JtYXQ6IFNjaGVtYUZvcm1hdCk6IHZvaWQge1xuICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby1hbnlcbiAgICBjb25zdCB2YWxpZGF0ZSA9IChkYXRhOiBhbnkpID0+IHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGZvcm1hdC5mb3JtYXR0ZXIudmFsaWRhdGUoZGF0YSk7XG5cbiAgICAgIGlmICh0eXBlb2YgcmVzdWx0ID09ICdib29sZWFuJykge1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHJlc3VsdC50b1Byb21pc2UoKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgdGhpcy5fYWp2LmFkZEZvcm1hdChmb3JtYXQubmFtZSwge1xuICAgICAgYXN5bmM6IGZvcm1hdC5mb3JtYXR0ZXIuYXN5bmMsXG4gICAgICB2YWxpZGF0ZSxcbiAgICAvLyBBSlYgdHlwaW5ncyBsaXN0IGBjb21wYXJlYCBhcyByZXF1aXJlZCwgYnV0IGl0IGlzIG9wdGlvbmFsLlxuICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby1hbnlcbiAgICB9IGFzIGFueSk7XG4gIH1cblxuICBhZGRTbWFydERlZmF1bHRQcm92aWRlcjxUPihzb3VyY2U6IHN0cmluZywgcHJvdmlkZXI6IFNtYXJ0RGVmYXVsdFByb3ZpZGVyPFQ+KSB7XG4gICAgaWYgKHRoaXMuX3NvdXJjZU1hcC5oYXMoc291cmNlKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKHNvdXJjZSk7XG4gICAgfVxuXG4gICAgdGhpcy5fc291cmNlTWFwLnNldChzb3VyY2UsIHByb3ZpZGVyKTtcblxuICAgIGlmICghdGhpcy5fc21hcnREZWZhdWx0S2V5d29yZCkge1xuICAgICAgdGhpcy5fc21hcnREZWZhdWx0S2V5d29yZCA9IHRydWU7XG5cbiAgICAgIHRoaXMuX2Fqdi5hZGRLZXl3b3JkKCckZGVmYXVsdCcsIHtcbiAgICAgICAgZXJyb3JzOiBmYWxzZSxcbiAgICAgICAgdmFsaWQ6IHRydWUsXG4gICAgICAgIGNvbXBpbGU6IChzY2hlbWEsIF9wYXJlbnRTY2hlbWEsIGl0KSA9PiB7XG4gICAgICAgICAgY29uc3QgY29tcGlsYXRpb25TY2hlbUluZm8gPSB0aGlzLl9jdXJyZW50Q29tcGlsYXRpb25TY2hlbWFJbmZvO1xuICAgICAgICAgIGlmIChjb21waWxhdGlvblNjaGVtSW5mbyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICByZXR1cm4gKCkgPT4gdHJ1ZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBXZSBjaGVhdCwgaGVhdmlseS5cbiAgICAgICAgICBjb21waWxhdGlvblNjaGVtSW5mby5zbWFydERlZmF1bHRSZWNvcmQuc2V0KFxuICAgICAgICAgICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWFueVxuICAgICAgICAgICAgSlNPTi5zdHJpbmdpZnkoKGl0IGFzIGFueSkuZGF0YVBhdGhBcnIuc2xpY2UoMSwgKGl0IGFzIGFueSkuZGF0YUxldmVsICsgMSkgYXMgc3RyaW5nW10pLFxuICAgICAgICAgICAgc2NoZW1hLFxuICAgICAgICAgICk7XG5cbiAgICAgICAgICByZXR1cm4gKCkgPT4gdHJ1ZTtcbiAgICAgICAgfSxcbiAgICAgICAgbWV0YVNjaGVtYToge1xuICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICckc291cmNlJzogeyB0eXBlOiAnc3RyaW5nJyB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgYWRkaXRpb25hbFByb3BlcnRpZXM6IHRydWUsXG4gICAgICAgICAgcmVxdWlyZWQ6IFsgJyRzb3VyY2UnIF0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICByZWdpc3RlclVyaUhhbmRsZXIoaGFuZGxlcjogVXJpSGFuZGxlcikge1xuICAgIHRoaXMuX3VyaUhhbmRsZXJzLmFkZChoYW5kbGVyKTtcbiAgfVxuXG4gIHVzZVByb21wdFByb3ZpZGVyKHByb3ZpZGVyOiBQcm9tcHRQcm92aWRlcikge1xuICAgIGNvbnN0IGlzU2V0dXAgPSAhIXRoaXMuX3Byb21wdFByb3ZpZGVyO1xuXG4gICAgdGhpcy5fcHJvbXB0UHJvdmlkZXIgPSBwcm92aWRlcjtcblxuICAgIGlmIChpc1NldHVwKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5fYWp2LmFkZEtleXdvcmQoJ3gtcHJvbXB0Jywge1xuICAgICAgZXJyb3JzOiBmYWxzZSxcbiAgICAgIHZhbGlkOiB0cnVlLFxuICAgICAgY29tcGlsZTogKHNjaGVtYSwgcGFyZW50U2NoZW1hOiBKc29uT2JqZWN0LCBpdCkgPT4ge1xuICAgICAgICBjb25zdCBjb21waWxhdGlvblNjaGVtSW5mbyA9IHRoaXMuX2N1cnJlbnRDb21waWxhdGlvblNjaGVtYUluZm87XG4gICAgICAgIGlmICghY29tcGlsYXRpb25TY2hlbUluZm8pIHtcbiAgICAgICAgICByZXR1cm4gKCkgPT4gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby1hbnlcbiAgICAgICAgY29uc3QgcGF0aEFycmF5ID0gKChpdCBhcyBhbnkpLmRhdGFQYXRoQXJyIGFzIHN0cmluZ1tdKS5zbGljZSgxLCBpdC5kYXRhTGV2ZWwgKyAxKTtcbiAgICAgICAgY29uc3QgcGF0aCA9ICcvJyArIHBhdGhBcnJheS5tYXAocCA9PiBwLnJlcGxhY2UoL15cXCcvLCAnJykucmVwbGFjZSgvXFwnJC8sICcnKSkuam9pbignLycpO1xuXG4gICAgICAgIGxldCB0eXBlOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgICAgIGxldCBpdGVtczogQXJyYXk8c3RyaW5nIHwgeyBsYWJlbDogc3RyaW5nLCB2YWx1ZTogc3RyaW5nIHwgbnVtYmVyIHwgYm9vbGVhbiB9PiB8IHVuZGVmaW5lZDtcbiAgICAgICAgbGV0IG1lc3NhZ2U6IHN0cmluZztcbiAgICAgICAgaWYgKHR5cGVvZiBzY2hlbWEgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICBtZXNzYWdlID0gc2NoZW1hO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG1lc3NhZ2UgPSBzY2hlbWEubWVzc2FnZTtcbiAgICAgICAgICB0eXBlID0gc2NoZW1hLnR5cGU7XG4gICAgICAgICAgaXRlbXMgPSBzY2hlbWEuaXRlbXM7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXR5cGUpIHtcbiAgICAgICAgICBpZiAocGFyZW50U2NoZW1hLnR5cGUgPT09ICdib29sZWFuJykge1xuICAgICAgICAgICAgdHlwZSA9ICdjb25maXJtYXRpb24nO1xuICAgICAgICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShwYXJlbnRTY2hlbWEuZW51bSkpIHtcbiAgICAgICAgICAgIHR5cGUgPSAnbGlzdCc7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHR5cGUgPSAnaW5wdXQnO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0eXBlID09PSAnbGlzdCcgJiYgIWl0ZW1zKSB7XG4gICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkocGFyZW50U2NoZW1hLmVudW0pKSB7XG4gICAgICAgICAgICB0eXBlID0gJ2xpc3QnO1xuICAgICAgICAgICAgaXRlbXMgPSBbXTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgdmFsdWUgb2YgcGFyZW50U2NoZW1hLmVudW0pIHtcbiAgICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIGl0ZW1zLnB1c2godmFsdWUpO1xuICAgICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiB2YWx1ZSA9PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgIC8vIEludmFsaWRcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpdGVtcy5wdXNoKHsgbGFiZWw6IHZhbHVlLnRvU3RyaW5nKCksIHZhbHVlIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZGVmaW5pdGlvbjogUHJvbXB0RGVmaW5pdGlvbiA9IHtcbiAgICAgICAgICBpZDogcGF0aCxcbiAgICAgICAgICB0eXBlLFxuICAgICAgICAgIG1lc3NhZ2UsXG4gICAgICAgICAgcHJpb3JpdHk6IDAsXG4gICAgICAgICAgcmF3OiBzY2hlbWEsXG4gICAgICAgICAgaXRlbXMsXG4gICAgICAgICAgbXVsdGlzZWxlY3Q6IHR5cGUgPT09ICdsaXN0JyA/IHNjaGVtYS5tdWx0aXNlbGVjdCA6IGZhbHNlLFxuICAgICAgICAgIGRlZmF1bHQ6IHR5cGVvZiBwYXJlbnRTY2hlbWEuZGVmYXVsdCA9PSAnb2JqZWN0JyA/IHVuZGVmaW5lZCA6IHBhcmVudFNjaGVtYS5kZWZhdWx0LFxuICAgICAgICAgIGFzeW5jIHZhbGlkYXRvcihkYXRhOiBzdHJpbmcpIHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGl0LnNlbGYudmFsaWRhdGUocGFyZW50U2NoZW1hLCBkYXRhKTtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgcmVzdWx0ID09PSAnYm9vbGVhbicpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgcmVzdWx0O1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0sXG4gICAgICAgIH07XG5cbiAgICAgICAgY29tcGlsYXRpb25TY2hlbUluZm8ucHJvbXB0RGVmaW5pdGlvbnMucHVzaChkZWZpbml0aW9uKTtcblxuICAgICAgICByZXR1cm4gZnVuY3Rpb24odGhpczogeyBwcm9tcHRGaWVsZHNXaXRoVmFsdWU6IFNldDxzdHJpbmc+IH0pIHtcbiAgICAgICAgICAvLyBJZiAndGhpcycgaXMgdW5kZWZpbmVkIGluIHRoZSBjYWxsLCB0aGVuIGl0IGRlZmF1bHRzIHRvIHRoZSBnbG9iYWxcbiAgICAgICAgICAvLyAndGhpcycuXG4gICAgICAgICAgaWYgKHRoaXMgJiYgdGhpcy5wcm9tcHRGaWVsZHNXaXRoVmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMucHJvbXB0RmllbGRzV2l0aFZhbHVlLmFkZChwYXRoKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfTtcbiAgICAgIH0sXG4gICAgICBtZXRhU2NoZW1hOiB7XG4gICAgICAgIG9uZU9mOiBbXG4gICAgICAgICAgeyB0eXBlOiAnc3RyaW5nJyB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAndHlwZSc6IHsgdHlwZTogJ3N0cmluZycgfSxcbiAgICAgICAgICAgICAgJ21lc3NhZ2UnOiB7IHR5cGU6ICdzdHJpbmcnIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgYWRkaXRpb25hbFByb3BlcnRpZXM6IHRydWUsXG4gICAgICAgICAgICByZXF1aXJlZDogWyAnbWVzc2FnZScgXSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgX2FwcGx5UHJvbXB0czxUPihkYXRhOiBULCBwcm9tcHRzOiBBcnJheTxQcm9tcHREZWZpbml0aW9uPik6IE9ic2VydmFibGU8VD4ge1xuICAgIGNvbnN0IHByb3ZpZGVyID0gdGhpcy5fcHJvbXB0UHJvdmlkZXI7XG4gICAgaWYgKCFwcm92aWRlcikge1xuICAgICAgcmV0dXJuIG9mKGRhdGEpO1xuICAgIH1cblxuICAgIHByb21wdHMuc29ydCgoYSwgYikgPT4gYi5wcmlvcml0eSAtIGEucHJpb3JpdHkpO1xuXG4gICAgcmV0dXJuIGZyb20ocHJvdmlkZXIocHJvbXB0cykpLnBpcGUoXG4gICAgICBtYXAoYW5zd2VycyA9PiB7XG4gICAgICAgIGZvciAoY29uc3QgcGF0aCBpbiBhbnN3ZXJzKSB7XG4gICAgICAgICAgY29uc3QgcGF0aEZyYWdtZW50cyA9IHBhdGguc3BsaXQoJy8nKS5tYXAocGYgPT4ge1xuICAgICAgICAgICAgaWYgKC9eXFxkKyQvLnRlc3QocGYpKSB7XG4gICAgICAgICAgICAgIHJldHVybiBwZjtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHJldHVybiAnXFwnJyArIHBmICsgJ1xcJyc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICBDb3JlU2NoZW1hUmVnaXN0cnkuX3NldChcbiAgICAgICAgICAgIGRhdGEsXG4gICAgICAgICAgICBwYXRoRnJhZ21lbnRzLnNsaWNlKDEpLFxuICAgICAgICAgICAgYW5zd2Vyc1twYXRoXSBhcyB7fSxcbiAgICAgICAgICAgIG51bGwsXG4gICAgICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgICAgICB0cnVlLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZGF0YTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBwcml2YXRlIHN0YXRpYyBfc2V0KFxuICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby1hbnlcbiAgICBkYXRhOiBhbnksXG4gICAgZnJhZ21lbnRzOiBzdHJpbmdbXSxcbiAgICB2YWx1ZToge30sXG4gICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWFueVxuICAgIHBhcmVudDogYW55IHwgbnVsbCA9IG51bGwsXG4gICAgcGFyZW50UHJvcGVydHk/OiBzdHJpbmcsXG4gICAgZm9yY2U/OiBib29sZWFuLFxuICApOiB2b2lkIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGZyYWdtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgZiA9IGZyYWdtZW50c1tpXTtcblxuICAgICAgaWYgKGZbMF0gPT0gJ2knKSB7XG4gICAgICAgIGlmICghQXJyYXkuaXNBcnJheShkYXRhKSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgZGF0YS5sZW5ndGg7IGorKykge1xuICAgICAgICAgIENvcmVTY2hlbWFSZWdpc3RyeS5fc2V0KGRhdGFbal0sIGZyYWdtZW50cy5zbGljZShpICsgMSksIHZhbHVlLCBkYXRhLCAnJyArIGopO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuO1xuICAgICAgfSBlbHNlIGlmIChmLnN0YXJ0c1dpdGgoJ2tleScpKSB7XG4gICAgICAgIGlmICh0eXBlb2YgZGF0YSAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhkYXRhKS5mb3JFYWNoKHByb3BlcnR5ID0+IHtcbiAgICAgICAgICBDb3JlU2NoZW1hUmVnaXN0cnkuX3NldChkYXRhW3Byb3BlcnR5XSwgZnJhZ21lbnRzLnNsaWNlKGkgKyAxKSwgdmFsdWUsIGRhdGEsIHByb3BlcnR5KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuO1xuICAgICAgfSBlbHNlIGlmIChmLnN0YXJ0c1dpdGgoJ1xcJycpICYmIGZbZi5sZW5ndGggLSAxXSA9PSAnXFwnJykge1xuICAgICAgICBjb25zdCBwcm9wZXJ0eSA9IGZcbiAgICAgICAgICAuc2xpY2UoMSwgLTEpXG4gICAgICAgICAgLnJlcGxhY2UoL1xcXFwnL2csICdcXCcnKVxuICAgICAgICAgIC5yZXBsYWNlKC9cXFxcbi9nLCAnXFxuJylcbiAgICAgICAgICAucmVwbGFjZSgvXFxcXHIvZywgJ1xccicpXG4gICAgICAgICAgLnJlcGxhY2UoL1xcXFxmL2csICdcXGYnKVxuICAgICAgICAgIC5yZXBsYWNlKC9cXFxcdC9nLCAnXFx0Jyk7XG5cbiAgICAgICAgLy8gV2Uga25vdyB3ZSBuZWVkIGFuIG9iamVjdCBiZWNhdXNlIHRoZSBmcmFnbWVudCBpcyBhIHByb3BlcnR5IGtleS5cbiAgICAgICAgaWYgKCFkYXRhICYmIHBhcmVudCAhPT0gbnVsbCAmJiBwYXJlbnRQcm9wZXJ0eSkge1xuICAgICAgICAgIGRhdGEgPSBwYXJlbnRbcGFyZW50UHJvcGVydHldID0ge307XG4gICAgICAgIH1cbiAgICAgICAgcGFyZW50ID0gZGF0YTtcbiAgICAgICAgcGFyZW50UHJvcGVydHkgPSBwcm9wZXJ0eTtcblxuICAgICAgICBkYXRhID0gZGF0YVtwcm9wZXJ0eV07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBhcmVudCAmJiBwYXJlbnRQcm9wZXJ0eSAmJiAoZm9yY2UgfHwgcGFyZW50W3BhcmVudFByb3BlcnR5XSA9PT0gdW5kZWZpbmVkKSkge1xuICAgICAgcGFyZW50W3BhcmVudFByb3BlcnR5XSA9IHZhbHVlO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2FwcGx5U21hcnREZWZhdWx0czxUPihcbiAgICBkYXRhOiBULFxuICAgIHNtYXJ0RGVmYXVsdHM6IE1hcDxzdHJpbmcsIEpzb25PYmplY3Q+LFxuICApOiBPYnNlcnZhYmxlPFQ+IHtcbiAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tYW55IGh0dHBzOi8vZ2l0aHViLmNvbS9SZWFjdGl2ZVgvcnhqcy9pc3N1ZXMvMzk4OVxuICAgIHJldHVybiAob2YoZGF0YSkgYXMgYW55KS5waXBlKFxuICAgICAgLi4uWy4uLnNtYXJ0RGVmYXVsdHMuZW50cmllcygpXS5tYXAoKFtwb2ludGVyLCBzY2hlbWFdKSA9PiB7XG4gICAgICAgIHJldHVybiBjb25jYXRNYXAoZGF0YSA9PiB7XG4gICAgICAgICAgY29uc3QgZnJhZ21lbnRzID0gSlNPTi5wYXJzZShwb2ludGVyKTtcbiAgICAgICAgICBjb25zdCBzb3VyY2UgPSB0aGlzLl9zb3VyY2VNYXAuZ2V0KChzY2hlbWEgYXMgSnNvbk9iamVjdCkuJHNvdXJjZSBhcyBzdHJpbmcpO1xuXG4gICAgICAgICAgbGV0IHZhbHVlID0gc291cmNlID8gc291cmNlKHNjaGVtYSkgOiBvZih1bmRlZmluZWQpO1xuXG4gICAgICAgICAgaWYgKCFpc09ic2VydmFibGUodmFsdWUpKSB7XG4gICAgICAgICAgICB2YWx1ZSA9IG9mKHZhbHVlKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gKHZhbHVlIGFzIE9ic2VydmFibGU8e30+KS5waXBlKFxuICAgICAgICAgICAgLy8gU3luY2hyb25vdXNseSBzZXQgdGhlIG5ldyBkYXRhIGF0IHRoZSBwcm9wZXIgSnNvblNjaGVtYSBwYXRoLlxuICAgICAgICAgICAgdGFwKHggPT4gQ29yZVNjaGVtYVJlZ2lzdHJ5Ll9zZXQoZGF0YSwgZnJhZ21lbnRzLCB4KSksXG4gICAgICAgICAgICAvLyBCdXQgcmV0dXJuIHRoZSBkYXRhIG9iamVjdC5cbiAgICAgICAgICAgIG1hcCgoKSA9PiBkYXRhKSxcbiAgICAgICAgICApO1xuICAgICAgICB9KTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cbn1cbiJdfQ==