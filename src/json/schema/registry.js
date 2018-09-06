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
                return handler.pipe(operators_1.tap(json => this._uriCache.set(uri, json))).toPromise();
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
                result = result.pipe(...[...this._pre].map(visitor => operators_1.concatMap((data) => {
                    return visitor_1.visitJson(data, visitor, schema, this._resolver, validate);
                })));
            }
            return result.pipe(operators_1.switchMap(updateData => this._applySmartDefaults(updateData, schemaInfo.smartDefaultRecord)), operators_1.switchMap(updatedData => {
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
                if (validationOptions.withPrompts === false) {
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
                    let result = rxjs_1.of(data);
                    if (validationOptions.applyPostTransforms) {
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
                if (compilationSchemInfo === undefined) {
                    throw new Error('Invalid JSON schema compilation state');
                }
                else if (compilationSchemInfo === null) {
                    return () => true;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVnaXN0cnkuanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2NvcmUvc3JjL2pzb24vc2NoZW1hL3JlZ2lzdHJ5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQTs7Ozs7O0dBTUc7QUFDSCwyQkFBMkI7QUFDM0IsNkJBQTZCO0FBQzdCLCtCQUF3RDtBQUN4RCw4Q0FBZ0U7QUFDaEUsMkJBQTJCO0FBQzNCLHlEQUEwRDtBQUMxRCx1Q0FBMEU7QUFDMUUsNENBQThFO0FBZTlFLHVDQUF1RDtBQWtCdkQsK0JBQXVDLFNBQVEseUJBQWE7SUFHMUQsWUFDRSxNQUErQixFQUMvQixXQUFXLEdBQUcscURBQXFEO1FBRW5FLElBQUksQ0FBQyxNQUFNLElBQUksTUFBTSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7WUFDbEMsS0FBSyxDQUFDLDJCQUEyQixDQUFDLENBQUM7WUFFbkMsT0FBTztTQUNSO1FBRUQsTUFBTSxRQUFRLEdBQUcseUJBQXlCLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ2xFLEtBQUssQ0FBQyxHQUFHLFdBQVcsT0FBTyxRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNwRCxJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztJQUN2QixDQUFDO0lBRU0sTUFBTSxDQUFDLGNBQWMsQ0FBQyxNQUErQjtRQUMxRCxJQUFJLENBQUMsTUFBTSxJQUFJLE1BQU0sQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1lBQ2xDLE9BQU8sRUFBRSxDQUFDO1NBQ1g7UUFFRCxNQUFNLFFBQVEsR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUU7WUFDbEMsSUFBSSxPQUFPLEdBQUcsYUFBYSxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsSUFBSSxHQUFHLENBQUMsT0FBTyxFQUFF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QUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQUUsQ0FBQyxTQUFTLENBQUMsQ0FBQztnQkFFcEQsSUFBSSxDQUFDLG9CQUFZLENBQUMsS0FBSyxDQUFDLEVBQUU7b0JBQ3hCLEtBQUssR0FBRyxTQUFFLENBQUMsS0FBSyxDQUFDLENBQUM7aUJBQ25CO2dCQUVELE9BQVEsS0FBd0IsQ0FBQyxJQUFJO2dCQUNuQyxnRUFBZ0U7Z0JBQ2hFLGVBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsU0FBUyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUNyRCw4QkFBOEI7Z0JBQzlCLGVBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FDaEIsQ0FBQztZQUNKLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDLENBQ0gsQ0FBQztJQUNKLENBQUM7Q0FDRjtBQWhuQkQsZ0RBZ25CQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCAqIGFzIGFqdiBmcm9tICdhanYnO1xuaW1wb3J0ICogYXMgaHR0cCBmcm9tICdodHRwJztcbmltcG9ydCB7IE9ic2VydmFibGUsIGZyb20sIG9mLCB0aHJvd0Vycm9yIH0gZnJvbSAncnhqcyc7XG5pbXBvcnQgeyBjb25jYXRNYXAsIG1hcCwgc3dpdGNoTWFwLCB0YXAgfSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XG5pbXBvcnQgKiBhcyBVcmwgZnJvbSAndXJsJztcbmltcG9ydCB7IEJhc2VFeGNlcHRpb24gfSBmcm9tICcuLi8uLi9leGNlcHRpb24vZXhjZXB0aW9uJztcbmltcG9ydCB7IFBhcnRpYWxseU9yZGVyZWRTZXQsIGRlZXBDb3B5LCBpc09ic2VydmFibGUgfSBmcm9tICcuLi8uLi91dGlscyc7XG5pbXBvcnQgeyBKc29uQXJyYXksIEpzb25PYmplY3QsIEpzb25WYWx1ZSwgaXNKc29uT2JqZWN0IH0gZnJvbSAnLi4vaW50ZXJmYWNlJztcbmltcG9ydCB7XG4gIEpzb25Qb2ludGVyLFxuICBKc29uVmlzaXRvcixcbiAgUHJvbXB0RGVmaW5pdGlvbixcbiAgUHJvbXB0UHJvdmlkZXIsXG4gIFNjaGVtYUZvcm1hdCxcbiAgU2NoZW1hRm9ybWF0dGVyLFxuICBTY2hlbWFSZWdpc3RyeSxcbiAgU2NoZW1hVmFsaWRhdG9yLFxuICBTY2hlbWFWYWxpZGF0b3JFcnJvcixcbiAgU2NoZW1hVmFsaWRhdG9yT3B0aW9ucyxcbiAgU2NoZW1hVmFsaWRhdG9yUmVzdWx0LFxuICBTbWFydERlZmF1bHRQcm92aWRlcixcbn0gZnJvbSAnLi9pbnRlcmZhY2UnO1xuaW1wb3J0IHsgdmlzaXRKc29uLCB2aXNpdEpzb25TY2hlbWEgfSBmcm9tICcuL3Zpc2l0b3InO1xuXG4vLyBUaGlzIGludGVyZmFjZSBzaG91bGQgYmUgZXhwb3J0ZWQgZnJvbSBhanYsIGJ1dCB0aGV5IG9ubHkgZXhwb3J0IHRoZSBjbGFzcyBhbmQgbm90IHRoZSB0eXBlLlxuaW50ZXJmYWNlIEFqdlZhbGlkYXRpb25FcnJvciB7XG4gIG1lc3NhZ2U6IHN0cmluZztcbiAgZXJyb3JzOiBBcnJheTxhanYuRXJyb3JPYmplY3Q+O1xuICBhanY6IHRydWU7XG4gIHZhbGlkYXRpb246IHRydWU7XG59XG5cbmludGVyZmFjZSBBanZSZWZNYXAge1xuICByZWZzOiBzdHJpbmdbXTtcbiAgcmVmVmFsOiBhbnk7IC8vIHRzbGludDpkaXNhYmxlLWxpbmU6bm8tYW55XG4gIHNjaGVtYTogSnNvbk9iamVjdDtcbn1cblxuZXhwb3J0IHR5cGUgVXJpSGFuZGxlciA9ICh1cmk6IHN0cmluZykgPT4gT2JzZXJ2YWJsZTxKc29uT2JqZWN0PiB8IG51bGwgfCB1bmRlZmluZWQ7XG5cbmV4cG9ydCBjbGFzcyBTY2hlbWFWYWxpZGF0aW9uRXhjZXB0aW9uIGV4dGVuZHMgQmFzZUV4Y2VwdGlvbiB7XG4gIHB1YmxpYyByZWFkb25seSBlcnJvcnM6IFNjaGVtYVZhbGlkYXRvckVycm9yW107XG5cbiAgY29uc3RydWN0b3IoXG4gICAgZXJyb3JzPzogU2NoZW1hVmFsaWRhdG9yRXJyb3JbXSxcbiAgICBiYXNlTWVzc2FnZSA9ICdTY2hlbWEgdmFsaWRhdGlvbiBmYWlsZWQgd2l0aCB0aGUgZm9sbG93aW5nIGVycm9yczonLFxuICApIHtcbiAgICBpZiAoIWVycm9ycyB8fCBlcnJvcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICBzdXBlcignU2NoZW1hIHZhbGlkYXRpb24gZmFpbGVkLicpO1xuXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgbWVzc2FnZXMgPSBTY2hlbWFWYWxpZGF0aW9uRXhjZXB0aW9uLmNyZWF0ZU1lc3NhZ2VzKGVycm9ycyk7XG4gICAgc3VwZXIoYCR7YmFzZU1lc3NhZ2V9XFxuICAke21lc3NhZ2VzLmpvaW4oJ1xcbiAgJyl9YCk7XG4gICAgdGhpcy5lcnJvcnMgPSBlcnJvcnM7XG4gIH1cblxuICBwdWJsaWMgc3RhdGljIGNyZWF0ZU1lc3NhZ2VzKGVycm9ycz86IFNjaGVtYVZhbGlkYXRvckVycm9yW10pOiBzdHJpbmdbXSB7XG4gICAgaWYgKCFlcnJvcnMgfHwgZXJyb3JzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIGNvbnN0IG1lc3NhZ2VzID0gZXJyb3JzLm1hcCgoZXJyKSA9PiB7XG4gICAgICBsZXQgbWVzc2FnZSA9IGBEYXRhIHBhdGggJHtKU09OLnN0cmluZ2lmeShlcnIuZGF0YVBhdGgpfSAke2Vyci5tZXNzYWdlfWA7XG4gICAgICBpZiAoZXJyLmtleXdvcmQgPT09ICdhZGRpdGlvbmFsUHJvcGVydGllcycpIHtcbiAgICAgICAgbWVzc2FnZSArPSBgKCR7ZXJyLnBhcmFtcy5hZGRpdGlvbmFsUHJvcGVydHl9KWA7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBtZXNzYWdlICsgJy4nO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIG1lc3NhZ2VzO1xuICB9XG59XG5cbmludGVyZmFjZSBTY2hlbWFJbmZvIHtcbiAgc21hcnREZWZhdWx0UmVjb3JkOiBNYXA8c3RyaW5nLCBKc29uT2JqZWN0PjtcbiAgcHJvbXB0RGVmaW5pdGlvbnM6IEFycmF5PFByb21wdERlZmluaXRpb24+O1xufVxuXG5leHBvcnQgY2xhc3MgQ29yZVNjaGVtYVJlZ2lzdHJ5IGltcGxlbWVudHMgU2NoZW1hUmVnaXN0cnkge1xuICBwcml2YXRlIF9hanY6IGFqdi5BanY7XG4gIHByaXZhdGUgX3VyaUNhY2hlID0gbmV3IE1hcDxzdHJpbmcsIEpzb25PYmplY3Q+KCk7XG4gIHByaXZhdGUgX3VyaUhhbmRsZXJzID0gbmV3IFNldDxVcmlIYW5kbGVyPigpO1xuICBwcml2YXRlIF9wcmUgPSBuZXcgUGFydGlhbGx5T3JkZXJlZFNldDxKc29uVmlzaXRvcj4oKTtcbiAgcHJpdmF0ZSBfcG9zdCA9IG5ldyBQYXJ0aWFsbHlPcmRlcmVkU2V0PEpzb25WaXNpdG9yPigpO1xuXG4gIHByaXZhdGUgX2N1cnJlbnRDb21waWxhdGlvblNjaGVtYUluZm8/OiBTY2hlbWFJbmZvO1xuXG4gIHByaXZhdGUgX3NtYXJ0RGVmYXVsdEtleXdvcmQgPSBmYWxzZTtcbiAgcHJpdmF0ZSBfcHJvbXB0UHJvdmlkZXI/OiBQcm9tcHRQcm92aWRlcjtcbiAgcHJpdmF0ZSBfc291cmNlTWFwID0gbmV3IE1hcDxzdHJpbmcsIFNtYXJ0RGVmYXVsdFByb3ZpZGVyPHt9Pj4oKTtcblxuICBjb25zdHJ1Y3Rvcihmb3JtYXRzOiBTY2hlbWFGb3JtYXRbXSA9IFtdKSB7XG4gICAgLyoqXG4gICAgICogQnVpbGQgYW4gQUpWIGluc3RhbmNlIHRoYXQgd2lsbCBiZSB1c2VkIHRvIHZhbGlkYXRlIHNjaGVtYXMuXG4gICAgICovXG5cbiAgICBjb25zdCBmb3JtYXRzT2JqOiB7IFtuYW1lOiBzdHJpbmddOiBTY2hlbWFGb3JtYXR0ZXIgfSA9IHt9O1xuXG4gICAgZm9yIChjb25zdCBmb3JtYXQgb2YgZm9ybWF0cykge1xuICAgICAgZm9ybWF0c09ialtmb3JtYXQubmFtZV0gPSBmb3JtYXQuZm9ybWF0dGVyO1xuICAgIH1cblxuICAgIHRoaXMuX2FqdiA9IGFqdih7XG4gICAgICBmb3JtYXRzOiBmb3JtYXRzT2JqLFxuICAgICAgbG9hZFNjaGVtYTogKHVyaTogc3RyaW5nKSA9PiB0aGlzLl9mZXRjaCh1cmkpLFxuICAgICAgc2NoZW1hSWQ6ICdhdXRvJyxcbiAgICAgIHBhc3NDb250ZXh0OiB0cnVlLFxuICAgIH0pO1xuXG4gICAgdGhpcy5fYWp2LmFkZE1ldGFTY2hlbWEocmVxdWlyZSgnYWp2L2xpYi9yZWZzL2pzb24tc2NoZW1hLWRyYWZ0LTA0Lmpzb24nKSk7XG4gICAgdGhpcy5fYWp2LmFkZE1ldGFTY2hlbWEocmVxdWlyZSgnYWp2L2xpYi9yZWZzL2pzb24tc2NoZW1hLWRyYWZ0LTA2Lmpzb24nKSk7XG4gIH1cblxuICBwcml2YXRlIF9mZXRjaCh1cmk6IHN0cmluZyk6IFByb21pc2U8SnNvbk9iamVjdD4ge1xuICAgIGNvbnN0IG1heWJlU2NoZW1hID0gdGhpcy5fdXJpQ2FjaGUuZ2V0KHVyaSk7XG5cbiAgICBpZiAobWF5YmVTY2hlbWEpIHtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUobWF5YmVTY2hlbWEpO1xuICAgIH1cblxuICAgIC8vIFRyeSBhbGwgaGFuZGxlcnMsIG9uZSBhZnRlciB0aGUgb3RoZXIuXG4gICAgZm9yIChjb25zdCBtYXliZUhhbmRsZXIgb2YgdGhpcy5fdXJpSGFuZGxlcnMpIHtcbiAgICAgIGNvbnN0IGhhbmRsZXIgPSBtYXliZUhhbmRsZXIodXJpKTtcbiAgICAgIGlmIChoYW5kbGVyKSB7XG4gICAgICAgIC8vIFRoZSBBSlYgQVBJIG9ubHkgdW5kZXJzdGFuZHMgUHJvbWlzZXMuXG4gICAgICAgIHJldHVybiBoYW5kbGVyLnBpcGUoXG4gICAgICAgICAgdGFwKGpzb24gPT4gdGhpcy5fdXJpQ2FjaGUuc2V0KHVyaSwganNvbikpLFxuICAgICAgICApLnRvUHJvbWlzZSgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIElmIG5vbmUgYXJlIGZvdW5kLCBoYW5kbGUgdXNpbmcgaHR0cCBjbGllbnQuXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPEpzb25PYmplY3Q+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGh0dHAuZ2V0KHVyaSwgcmVzID0+IHtcbiAgICAgICAgaWYgKCFyZXMuc3RhdHVzQ29kZSB8fCByZXMuc3RhdHVzQ29kZSA+PSAzMDApIHtcbiAgICAgICAgICAvLyBDb25zdW1lIHRoZSByZXN0IG9mIHRoZSBkYXRhIHRvIGZyZWUgbWVtb3J5LlxuICAgICAgICAgIHJlcy5yZXN1bWUoKTtcbiAgICAgICAgICByZWplY3QobmV3IEVycm9yKGBSZXF1ZXN0IGZhaWxlZC4gU3RhdHVzIENvZGU6ICR7cmVzLnN0YXR1c0NvZGV9YCkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlcy5zZXRFbmNvZGluZygndXRmOCcpO1xuICAgICAgICAgIGxldCBkYXRhID0gJyc7XG4gICAgICAgICAgcmVzLm9uKCdkYXRhJywgY2h1bmsgPT4ge1xuICAgICAgICAgICAgZGF0YSArPSBjaHVuaztcbiAgICAgICAgICB9KTtcbiAgICAgICAgICByZXMub24oJ2VuZCcsICgpID0+IHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGNvbnN0IGpzb24gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgICAgICAgICAgICB0aGlzLl91cmlDYWNoZS5zZXQodXJpLCBqc29uKTtcbiAgICAgICAgICAgICAgcmVzb2x2ZShqc29uKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQWRkIGEgdHJhbnNmb3JtYXRpb24gc3RlcCBiZWZvcmUgdGhlIHZhbGlkYXRpb24gb2YgYW55IEpzb24uXG4gICAqIEBwYXJhbSB7SnNvblZpc2l0b3J9IHZpc2l0b3IgVGhlIHZpc2l0b3IgdG8gdHJhbnNmb3JtIGV2ZXJ5IHZhbHVlLlxuICAgKiBAcGFyYW0ge0pzb25WaXNpdG9yW119IGRlcHMgQSBsaXN0IG9mIG90aGVyIHZpc2l0b3JzIHRvIHJ1biBiZWZvcmUuXG4gICAqL1xuICBhZGRQcmVUcmFuc2Zvcm0odmlzaXRvcjogSnNvblZpc2l0b3IsIGRlcHM/OiBKc29uVmlzaXRvcltdKSB7XG4gICAgdGhpcy5fcHJlLmFkZCh2aXNpdG9yLCBkZXBzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGQgYSB0cmFuc2Zvcm1hdGlvbiBzdGVwIGFmdGVyIHRoZSB2YWxpZGF0aW9uIG9mIGFueSBKc29uLiBUaGUgSlNPTiB3aWxsIG5vdCBiZSB2YWxpZGF0ZWRcbiAgICogYWZ0ZXIgdGhlIFBPU1QsIHNvIGlmIHRyYW5zZm9ybWF0aW9ucyBhcmUgbm90IGNvbXBhdGlibGUgd2l0aCB0aGUgU2NoZW1hIGl0IHdpbGwgbm90IHJlc3VsdFxuICAgKiBpbiBhbiBlcnJvci5cbiAgICogQHBhcmFtIHtKc29uVmlzaXRvcn0gdmlzaXRvciBUaGUgdmlzaXRvciB0byB0cmFuc2Zvcm0gZXZlcnkgdmFsdWUuXG4gICAqIEBwYXJhbSB7SnNvblZpc2l0b3JbXX0gZGVwcyBBIGxpc3Qgb2Ygb3RoZXIgdmlzaXRvcnMgdG8gcnVuIGJlZm9yZS5cbiAgICovXG4gIGFkZFBvc3RUcmFuc2Zvcm0odmlzaXRvcjogSnNvblZpc2l0b3IsIGRlcHM/OiBKc29uVmlzaXRvcltdKSB7XG4gICAgdGhpcy5fcG9zdC5hZGQodmlzaXRvciwgZGVwcyk7XG4gIH1cblxuICBwcm90ZWN0ZWQgX3Jlc29sdmVyKFxuICAgIHJlZjogc3RyaW5nLFxuICAgIHZhbGlkYXRlOiBhanYuVmFsaWRhdGVGdW5jdGlvbixcbiAgKTogeyBjb250ZXh0PzogYWp2LlZhbGlkYXRlRnVuY3Rpb24sIHNjaGVtYT86IEpzb25PYmplY3QgfSB7XG4gICAgaWYgKCF2YWxpZGF0ZSB8fCAhdmFsaWRhdGUucmVmcyB8fCAhdmFsaWRhdGUucmVmVmFsIHx8ICFyZWYpIHtcbiAgICAgIHJldHVybiB7fTtcbiAgICB9XG5cbiAgICBsZXQgcmVmTWFwID0gdmFsaWRhdGUgYXMgQWp2UmVmTWFwO1xuICAgIGNvbnN0IHJvb3RSZWZNYXAgPSB2YWxpZGF0ZS5yb290IGFzIEFqdlJlZk1hcDtcblxuICAgIC8vIFJlc29sdmUgZnJvbSB0aGUgcm9vdCBpZiBpdCdzIGRpZmZlcmVudC5cbiAgICBpZiAodmFsaWRhdGUucm9vdCAmJiB2YWxpZGF0ZS5zY2hlbWEgIT09IHJvb3RSZWZNYXAuc2NoZW1hKSB7XG4gICAgICByZWZNYXAgPSByb290UmVmTWFwO1xuICAgIH1cblxuICAgIGNvbnN0IHNjaGVtYSA9IHJlZk1hcC5zY2hlbWEgPyB0eXBlb2YgcmVmTWFwLnNjaGVtYSA9PSAnb2JqZWN0JyAmJiByZWZNYXAuc2NoZW1hIDogbnVsbDtcbiAgICBjb25zdCBtYXliZUlkID0gc2NoZW1hID8gKHNjaGVtYSBhcyBKc29uT2JqZWN0KS5pZCB8fCAoc2NoZW1hIGFzIEpzb25PYmplY3QpLiRpZCA6IG51bGw7XG5cbiAgICBpZiAodHlwZW9mIG1heWJlSWQgPT0gJ3N0cmluZycpIHtcbiAgICAgIHJlZiA9IFVybC5yZXNvbHZlKG1heWJlSWQsIHJlZik7XG4gICAgfVxuXG4gICAgbGV0IGZ1bGxSZWZlcmVuY2UgPSAocmVmWzBdID09PSAnIycgJiYgbWF5YmVJZCkgPyBtYXliZUlkICsgcmVmIDogcmVmO1xuICAgIGlmIChmdWxsUmVmZXJlbmNlLmVuZHNXaXRoKCcjJykpIHtcbiAgICAgIGZ1bGxSZWZlcmVuY2UgPSBmdWxsUmVmZXJlbmNlLnNsaWNlKDAsIC0xKTtcbiAgICB9XG5cbiAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tYW55XG4gICAgY29uc3QgY29udGV4dCA9IHZhbGlkYXRlLnJlZlZhbFsodmFsaWRhdGUucmVmcyBhcyBhbnkpW2Z1bGxSZWZlcmVuY2VdXTtcblxuICAgIGlmICh0eXBlb2YgY29udGV4dCA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAvLyBDb250ZXh0IHdpbGwgYmUgYSBmdW5jdGlvbiBpZiB0aGUgc2NoZW1hIGlzbid0IGxvYWRlZCB5ZXQsIGFuZCBhbiBhY3R1YWwgc2NoZW1hIGlmIGl0J3NcbiAgICAgIC8vIHN5bmNocm9ub3VzbHkgYXZhaWxhYmxlLlxuICAgICAgcmV0dXJuIHsgY29udGV4dCwgc2NoZW1hOiBjb250ZXh0ICYmIGNvbnRleHQuc2NoZW1hIGFzIEpzb25PYmplY3QgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHsgY29udGV4dDogdmFsaWRhdGUsIHNjaGVtYTogY29udGV4dCBhcyBKc29uT2JqZWN0IH07XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEZsYXR0ZW4gdGhlIFNjaGVtYSwgcmVzb2x2aW5nIGFuZCByZXBsYWNpbmcgYWxsIHRoZSByZWZzLiBNYWtlcyBpdCBpbnRvIGEgc3luY2hyb25vdXMgc2NoZW1hXG4gICAqIHRoYXQgaXMgYWxzbyBlYXNpZXIgdG8gdHJhdmVyc2UuIERvZXMgbm90IGNhY2hlIHRoZSByZXN1bHQuXG4gICAqXG4gICAqIEBwYXJhbSBzY2hlbWEgVGhlIHNjaGVtYSBvciBVUkkgdG8gZmxhdHRlbi5cbiAgICogQHJldHVybnMgQW4gT2JzZXJ2YWJsZSBvZiB0aGUgZmxhdHRlbmVkIHNjaGVtYSBvYmplY3QuXG4gICAqL1xuICBmbGF0dGVuKHNjaGVtYTogSnNvbk9iamVjdCk6IE9ic2VydmFibGU8SnNvbk9iamVjdD4ge1xuICAgIHRoaXMuX2Fqdi5yZW1vdmVTY2hlbWEoc2NoZW1hKTtcblxuICAgIC8vIFN1cHBvcnRzIGJvdGggc3luY2hyb25vdXMgYW5kIGFzeW5jaHJvbm91cyBjb21waWxhdGlvbiwgYnkgdHJ5aW5nIHRoZSBzeW5jaHJvbm91c1xuICAgIC8vIHZlcnNpb24gZmlyc3QsIHRoZW4gaWYgcmVmcyBhcmUgbWlzc2luZyB0aGlzIHdpbGwgZmFpbHMuXG4gICAgLy8gV2UgYWxzbyBhZGQgYW55IHJlZnMgZnJvbSBleHRlcm5hbCBmZXRjaGVkIHNjaGVtYXMgc28gdGhhdCB0aG9zZSB3aWxsIGFsc28gYmUgdXNlZFxuICAgIC8vIGluIHN5bmNocm9ub3VzIChpZiBhdmFpbGFibGUpLlxuICAgIGxldCB2YWxpZGF0b3I6IE9ic2VydmFibGU8YWp2LlZhbGlkYXRlRnVuY3Rpb24+O1xuICAgIHRyeSB7XG4gICAgICB0aGlzLl9jdXJyZW50Q29tcGlsYXRpb25TY2hlbWFJbmZvID0gdW5kZWZpbmVkO1xuICAgICAgdmFsaWRhdG9yID0gb2YodGhpcy5fYWp2LmNvbXBpbGUoc2NoZW1hKSkucGlwZShcbiAgICAgICAgdGFwKCgpID0+IHRoaXMuX2N1cnJlbnRDb21waWxhdGlvblNjaGVtYUluZm8gPSB1bmRlZmluZWQpLFxuICAgICAgKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAvLyBQcm9wYWdhdGUgdGhlIGVycm9yLlxuICAgICAgaWYgKCEoZSBpbnN0YW5jZW9mIChhanYuTWlzc2luZ1JlZkVycm9yIGFzIHt9IGFzIEZ1bmN0aW9uKSkpIHtcbiAgICAgICAgcmV0dXJuIHRocm93RXJyb3IoZSk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuX2N1cnJlbnRDb21waWxhdGlvblNjaGVtYUluZm8gPSB1bmRlZmluZWQ7XG4gICAgICB2YWxpZGF0b3IgPSBmcm9tKHRoaXMuX2Fqdi5jb21waWxlQXN5bmMoc2NoZW1hKSkucGlwZShcbiAgICAgICAgdGFwKCgpID0+IHRoaXMuX2N1cnJlbnRDb21waWxhdGlvblNjaGVtYUluZm8gPSB1bmRlZmluZWQpLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdmFsaWRhdG9yLnBpcGUoXG4gICAgICBzd2l0Y2hNYXAodmFsaWRhdGUgPT4ge1xuICAgICAgICBjb25zdCBzZWxmID0gdGhpcztcblxuICAgICAgICBmdW5jdGlvbiB2aXNpdG9yKFxuICAgICAgICAgIGN1cnJlbnQ6IEpzb25PYmplY3QgfCBKc29uQXJyYXksXG4gICAgICAgICAgcG9pbnRlcjogSnNvblBvaW50ZXIsXG4gICAgICAgICAgcGFyZW50U2NoZW1hPzogSnNvbk9iamVjdCB8IEpzb25BcnJheSxcbiAgICAgICAgICBpbmRleD86IHN0cmluZyxcbiAgICAgICAgKSB7XG4gICAgICAgICAgaWYgKGN1cnJlbnRcbiAgICAgICAgICAgICYmIHBhcmVudFNjaGVtYVxuICAgICAgICAgICAgJiYgaW5kZXhcbiAgICAgICAgICAgICYmIGlzSnNvbk9iamVjdChjdXJyZW50KVxuICAgICAgICAgICAgJiYgY3VycmVudC5oYXNPd25Qcm9wZXJ0eSgnJHJlZicpXG4gICAgICAgICAgICAmJiB0eXBlb2YgY3VycmVudFsnJHJlZiddID09ICdzdHJpbmcnXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICBjb25zdCByZXNvbHZlZCA9IHNlbGYuX3Jlc29sdmVyKGN1cnJlbnRbJyRyZWYnXSBhcyBzdHJpbmcsIHZhbGlkYXRlKTtcblxuICAgICAgICAgICAgaWYgKHJlc29sdmVkLnNjaGVtYSkge1xuICAgICAgICAgICAgICAocGFyZW50U2NoZW1hIGFzIEpzb25PYmplY3QpW2luZGV4XSA9IHJlc29sdmVkLnNjaGVtYTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzY2hlbWEgPSBkZWVwQ29weSh2YWxpZGF0ZS5zY2hlbWEgYXMgSnNvbk9iamVjdCk7XG4gICAgICAgIHZpc2l0SnNvblNjaGVtYShzY2hlbWEsIHZpc2l0b3IpO1xuXG4gICAgICAgIHJldHVybiBvZihzY2hlbWEpO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb21waWxlIGFuZCByZXR1cm4gYSB2YWxpZGF0aW9uIGZ1bmN0aW9uIGZvciB0aGUgU2NoZW1hLlxuICAgKlxuICAgKiBAcGFyYW0gc2NoZW1hIFRoZSBzY2hlbWEgdG8gdmFsaWRhdGUuIElmIGEgc3RyaW5nLCB3aWxsIGZldGNoIHRoZSBzY2hlbWEgYmVmb3JlIGNvbXBpbGluZyBpdFxuICAgKiAodXNpbmcgc2NoZW1hIGFzIGEgVVJJKS5cbiAgICogQHJldHVybnMgQW4gT2JzZXJ2YWJsZSBvZiB0aGUgVmFsaWRhdGlvbiBmdW5jdGlvbi5cbiAgICovXG4gIGNvbXBpbGUoc2NoZW1hOiBKc29uT2JqZWN0KTogT2JzZXJ2YWJsZTxTY2hlbWFWYWxpZGF0b3I+IHtcbiAgICBjb25zdCBzY2hlbWFJbmZvOiBTY2hlbWFJbmZvID0ge1xuICAgICAgc21hcnREZWZhdWx0UmVjb3JkOiBuZXcgTWFwPHN0cmluZywgSnNvbk9iamVjdD4oKSxcbiAgICAgIHByb21wdERlZmluaXRpb25zOiBbXSxcbiAgICB9O1xuXG4gICAgdGhpcy5fYWp2LnJlbW92ZVNjaGVtYShzY2hlbWEpO1xuXG4gICAgLy8gU3VwcG9ydHMgYm90aCBzeW5jaHJvbm91cyBhbmQgYXN5bmNocm9ub3VzIGNvbXBpbGF0aW9uLCBieSB0cnlpbmcgdGhlIHN5bmNocm9ub3VzXG4gICAgLy8gdmVyc2lvbiBmaXJzdCwgdGhlbiBpZiByZWZzIGFyZSBtaXNzaW5nIHRoaXMgd2lsbCBmYWlscy5cbiAgICAvLyBXZSBhbHNvIGFkZCBhbnkgcmVmcyBmcm9tIGV4dGVybmFsIGZldGNoZWQgc2NoZW1hcyBzbyB0aGF0IHRob3NlIHdpbGwgYWxzbyBiZSB1c2VkXG4gICAgLy8gaW4gc3luY2hyb25vdXMgKGlmIGF2YWlsYWJsZSkuXG4gICAgbGV0IHZhbGlkYXRvcjogT2JzZXJ2YWJsZTxhanYuVmFsaWRhdGVGdW5jdGlvbj47XG4gICAgdHJ5IHtcbiAgICAgIHRoaXMuX2N1cnJlbnRDb21waWxhdGlvblNjaGVtYUluZm8gPSBzY2hlbWFJbmZvO1xuICAgICAgdmFsaWRhdG9yID0gb2YodGhpcy5fYWp2LmNvbXBpbGUoc2NoZW1hKSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgLy8gUHJvcGFnYXRlIHRoZSBlcnJvci5cbiAgICAgIGlmICghKGUgaW5zdGFuY2VvZiAoYWp2Lk1pc3NpbmdSZWZFcnJvciBhcyB7fSBhcyBGdW5jdGlvbikpKSB7XG4gICAgICAgIHJldHVybiB0aHJvd0Vycm9yKGUpO1xuICAgICAgfVxuXG4gICAgICB0cnkge1xuICAgICAgICB2YWxpZGF0b3IgPSBmcm9tKHRoaXMuX2Fqdi5jb21waWxlQXN5bmMoc2NoZW1hKSk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHJldHVybiB0aHJvd0Vycm9yKGUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB2YWxpZGF0b3JcbiAgICAgIC5waXBlKFxuICAgICAgICBtYXAodmFsaWRhdGUgPT4gKGRhdGE6IEpzb25WYWx1ZSwgb3B0aW9ucz86IFNjaGVtYVZhbGlkYXRvck9wdGlvbnMpID0+IHtcbiAgICAgICAgICBjb25zdCB2YWxpZGF0aW9uT3B0aW9uczogU2NoZW1hVmFsaWRhdG9yT3B0aW9ucyA9IHtcbiAgICAgICAgICAgIHdpdGhQcm9tcHRzOiB0cnVlLFxuICAgICAgICAgICAgYXBwbHlQb3N0VHJhbnNmb3JtczogdHJ1ZSxcbiAgICAgICAgICAgIGFwcGx5UHJlVHJhbnNmb3JtczogdHJ1ZSxcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgfTtcbiAgICAgICAgICBjb25zdCB2YWxpZGF0aW9uQ29udGV4dCA9IHtcbiAgICAgICAgICAgIHByb21wdEZpZWxkc1dpdGhWYWx1ZTogbmV3IFNldDxzdHJpbmc+KCksXG4gICAgICAgICAgfTtcblxuICAgICAgICAgIGxldCByZXN1bHQgPSBvZihkYXRhKTtcbiAgICAgICAgICBpZiAodmFsaWRhdGlvbk9wdGlvbnMuYXBwbHlQcmVUcmFuc2Zvcm1zKSB7XG4gICAgICAgICAgICByZXN1bHQgPSByZXN1bHQucGlwZShcbiAgICAgICAgICAgICAgLi4uWy4uLnRoaXMuX3ByZV0ubWFwKHZpc2l0b3IgPT4gY29uY2F0TWFwKChkYXRhOiBKc29uVmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdmlzaXRKc29uKGRhdGEsIHZpc2l0b3IsIHNjaGVtYSwgdGhpcy5fcmVzb2x2ZXIsIHZhbGlkYXRlKTtcbiAgICAgICAgICAgICAgfSkpLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gcmVzdWx0LnBpcGUoXG4gICAgICAgICAgICBzd2l0Y2hNYXAodXBkYXRlRGF0YSA9PiB0aGlzLl9hcHBseVNtYXJ0RGVmYXVsdHMoXG4gICAgICAgICAgICAgIHVwZGF0ZURhdGEsXG4gICAgICAgICAgICAgIHNjaGVtYUluZm8uc21hcnREZWZhdWx0UmVjb3JkLFxuICAgICAgICAgICAgKSksXG4gICAgICAgICAgICBzd2l0Y2hNYXAodXBkYXRlZERhdGEgPT4ge1xuICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSB2YWxpZGF0ZS5jYWxsKHZhbGlkYXRpb25Db250ZXh0LCB1cGRhdGVkRGF0YSk7XG5cbiAgICAgICAgICAgICAgcmV0dXJuIHR5cGVvZiByZXN1bHQgPT0gJ2Jvb2xlYW4nXG4gICAgICAgICAgICAgICAgPyBvZihbdXBkYXRlZERhdGEsIHJlc3VsdF0pXG4gICAgICAgICAgICAgICAgOiBmcm9tKChyZXN1bHQgYXMgUHJvbWlzZTxib29sZWFuPilcbiAgICAgICAgICAgICAgICAgIC50aGVuKHIgPT4gW3VwZGF0ZWREYXRhLCB0cnVlXSlcbiAgICAgICAgICAgICAgICAgIC5jYXRjaCgoZXJyOiBFcnJvciB8IEFqdlZhbGlkYXRpb25FcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoKGVyciBhcyBBanZWYWxpZGF0aW9uRXJyb3IpLmFqdikge1xuICAgICAgICAgICAgICAgICAgICAgIHZhbGlkYXRlLmVycm9ycyA9IChlcnIgYXMgQWp2VmFsaWRhdGlvbkVycm9yKS5lcnJvcnM7XG5cbiAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKFt1cGRhdGVkRGF0YSwgZmFsc2VdKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChlcnIpO1xuICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgfSksXG4gICAgICAgICAgICBzd2l0Y2hNYXAoKFtkYXRhLCB2YWxpZF06IFtKc29uVmFsdWUsIGJvb2xlYW5dKSA9PiB7XG4gICAgICAgICAgICAgIGlmICh2YWxpZGF0aW9uT3B0aW9ucy53aXRoUHJvbXB0cyA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gb2YoW2RhdGEsIHZhbGlkXSk7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBjb25zdCBkZWZpbml0aW9ucyA9IHNjaGVtYUluZm8ucHJvbXB0RGVmaW5pdGlvbnNcbiAgICAgICAgICAgICAgICAuZmlsdGVyKGRlZiA9PiAhdmFsaWRhdGlvbkNvbnRleHQucHJvbXB0RmllbGRzV2l0aFZhbHVlLmhhcyhkZWYuaWQpKTtcblxuICAgICAgICAgICAgICBpZiAodmFsaWQgJiYgdGhpcy5fcHJvbXB0UHJvdmlkZXIgJiYgZGVmaW5pdGlvbnMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmcm9tKHRoaXMuX2FwcGx5UHJvbXB0cyhkYXRhLCBkZWZpbml0aW9ucykpLnBpcGUoXG4gICAgICAgICAgICAgICAgICBtYXAoZGF0YSA9PiBbZGF0YSwgdmFsaWRdKSxcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBvZihbZGF0YSwgdmFsaWRdKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgICBzd2l0Y2hNYXAoKFtkYXRhLCB2YWxpZF06IFtKc29uVmFsdWUsIGJvb2xlYW5dKSA9PiB7XG4gICAgICAgICAgICAgIGlmICh2YWxpZCkge1xuICAgICAgICAgICAgICAgIGxldCByZXN1bHQgPSBvZihkYXRhKTtcblxuICAgICAgICAgICAgICAgIGlmICh2YWxpZGF0aW9uT3B0aW9ucy5hcHBseVBvc3RUcmFuc2Zvcm1zKSB7XG4gICAgICAgICAgICAgICAgICByZXN1bHQgPSByZXN1bHQucGlwZShcbiAgICAgICAgICAgICAgICAgICAgLi4uWy4uLnRoaXMuX3Bvc3RdLm1hcCh2aXNpdG9yID0+IGNvbmNhdE1hcCgoZGF0YTogSnNvblZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHZpc2l0SnNvbihkYXRhLCB2aXNpdG9yLCBzY2hlbWEsIHRoaXMuX3Jlc29sdmVyLCB2YWxpZGF0ZSk7XG4gICAgICAgICAgICAgICAgICAgIH0pKSxcbiAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdC5waXBlKFxuICAgICAgICAgICAgICAgICAgbWFwKGRhdGEgPT4gW2RhdGEsIHZhbGlkXSksXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gb2YoW2RhdGEsIHZhbGlkXSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgbWFwKChbZGF0YSwgdmFsaWRdOiBbSnNvblZhbHVlLCBib29sZWFuXSkgPT4ge1xuICAgICAgICAgICAgICBpZiAodmFsaWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBkYXRhLCBzdWNjZXNzOiB0cnVlIH0gYXMgU2NoZW1hVmFsaWRhdG9yUmVzdWx0O1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBkYXRhLFxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGVycm9yczogKHZhbGlkYXRlLmVycm9ycyB8fCBbXSksXG4gICAgICAgICAgICAgIH0gYXMgU2NoZW1hVmFsaWRhdG9yUmVzdWx0O1xuICAgICAgICAgICAgfSksXG4gICAgICAgICAgKTtcbiAgICAgICAgfSksXG4gICAgICApO1xuICB9XG5cbiAgYWRkRm9ybWF0KGZvcm1hdDogU2NoZW1hRm9ybWF0KTogdm9pZCB7XG4gICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWFueVxuICAgIGNvbnN0IHZhbGlkYXRlID0gKGRhdGE6IGFueSkgPT4ge1xuICAgICAgY29uc3QgcmVzdWx0ID0gZm9ybWF0LmZvcm1hdHRlci52YWxpZGF0ZShkYXRhKTtcblxuICAgICAgaWYgKHR5cGVvZiByZXN1bHQgPT0gJ2Jvb2xlYW4nKSB7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gcmVzdWx0LnRvUHJvbWlzZSgpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICB0aGlzLl9hanYuYWRkRm9ybWF0KGZvcm1hdC5uYW1lLCB7XG4gICAgICBhc3luYzogZm9ybWF0LmZvcm1hdHRlci5hc3luYyxcbiAgICAgIHZhbGlkYXRlLFxuICAgIC8vIEFKViB0eXBpbmdzIGxpc3QgYGNvbXBhcmVgIGFzIHJlcXVpcmVkLCBidXQgaXQgaXMgb3B0aW9uYWwuXG4gICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWFueVxuICAgIH0gYXMgYW55KTtcbiAgfVxuXG4gIGFkZFNtYXJ0RGVmYXVsdFByb3ZpZGVyPFQ+KHNvdXJjZTogc3RyaW5nLCBwcm92aWRlcjogU21hcnREZWZhdWx0UHJvdmlkZXI8VD4pIHtcbiAgICBpZiAodGhpcy5fc291cmNlTWFwLmhhcyhzb3VyY2UpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3Ioc291cmNlKTtcbiAgICB9XG5cbiAgICB0aGlzLl9zb3VyY2VNYXAuc2V0KHNvdXJjZSwgcHJvdmlkZXIpO1xuXG4gICAgaWYgKCF0aGlzLl9zbWFydERlZmF1bHRLZXl3b3JkKSB7XG4gICAgICB0aGlzLl9zbWFydERlZmF1bHRLZXl3b3JkID0gdHJ1ZTtcblxuICAgICAgdGhpcy5fYWp2LmFkZEtleXdvcmQoJyRkZWZhdWx0Jywge1xuICAgICAgICBlcnJvcnM6IGZhbHNlLFxuICAgICAgICB2YWxpZDogdHJ1ZSxcbiAgICAgICAgY29tcGlsZTogKHNjaGVtYSwgX3BhcmVudFNjaGVtYSwgaXQpID0+IHtcbiAgICAgICAgICBjb25zdCBjb21waWxhdGlvblNjaGVtSW5mbyA9IHRoaXMuX2N1cnJlbnRDb21waWxhdGlvblNjaGVtYUluZm87XG4gICAgICAgICAgaWYgKGNvbXBpbGF0aW9uU2NoZW1JbmZvID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHJldHVybiAoKSA9PiB0cnVlO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIFdlIGNoZWF0LCBoZWF2aWx5LlxuICAgICAgICAgIGNvbXBpbGF0aW9uU2NoZW1JbmZvLnNtYXJ0RGVmYXVsdFJlY29yZC5zZXQoXG4gICAgICAgICAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tYW55XG4gICAgICAgICAgICBKU09OLnN0cmluZ2lmeSgoaXQgYXMgYW55KS5kYXRhUGF0aEFyci5zbGljZSgxLCAoaXQgYXMgYW55KS5kYXRhTGV2ZWwgKyAxKSBhcyBzdHJpbmdbXSksXG4gICAgICAgICAgICBzY2hlbWEsXG4gICAgICAgICAgKTtcblxuICAgICAgICAgIHJldHVybiAoKSA9PiB0cnVlO1xuICAgICAgICB9LFxuICAgICAgICBtZXRhU2NoZW1hOiB7XG4gICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgJyRzb3VyY2UnOiB7IHR5cGU6ICdzdHJpbmcnIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBhZGRpdGlvbmFsUHJvcGVydGllczogdHJ1ZSxcbiAgICAgICAgICByZXF1aXJlZDogWyAnJHNvdXJjZScgXSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIHJlZ2lzdGVyVXJpSGFuZGxlcihoYW5kbGVyOiBVcmlIYW5kbGVyKSB7XG4gICAgdGhpcy5fdXJpSGFuZGxlcnMuYWRkKGhhbmRsZXIpO1xuICB9XG5cbiAgdXNlUHJvbXB0UHJvdmlkZXIocHJvdmlkZXI6IFByb21wdFByb3ZpZGVyKSB7XG4gICAgY29uc3QgaXNTZXR1cCA9ICEhdGhpcy5fcHJvbXB0UHJvdmlkZXI7XG5cbiAgICB0aGlzLl9wcm9tcHRQcm92aWRlciA9IHByb3ZpZGVyO1xuXG4gICAgaWYgKGlzU2V0dXApIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLl9hanYuYWRkS2V5d29yZCgneC1wcm9tcHQnLCB7XG4gICAgICBlcnJvcnM6IGZhbHNlLFxuICAgICAgdmFsaWQ6IHRydWUsXG4gICAgICBjb21waWxlOiAoc2NoZW1hLCBwYXJlbnRTY2hlbWE6IEpzb25PYmplY3QsIGl0KSA9PiB7XG4gICAgICAgIGNvbnN0IGNvbXBpbGF0aW9uU2NoZW1JbmZvID0gdGhpcy5fY3VycmVudENvbXBpbGF0aW9uU2NoZW1hSW5mbztcbiAgICAgICAgaWYgKGNvbXBpbGF0aW9uU2NoZW1JbmZvID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgSlNPTiBzY2hlbWEgY29tcGlsYXRpb24gc3RhdGUnKTtcbiAgICAgICAgfSBlbHNlIGlmIChjb21waWxhdGlvblNjaGVtSW5mbyA9PT0gbnVsbCkge1xuICAgICAgICAgIHJldHVybiAoKSA9PiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWFueVxuICAgICAgICBjb25zdCBwYXRoQXJyYXkgPSAoKGl0IGFzIGFueSkuZGF0YVBhdGhBcnIgYXMgc3RyaW5nW10pLnNsaWNlKDEsIGl0LmRhdGFMZXZlbCArIDEpO1xuICAgICAgICBjb25zdCBwYXRoID0gcGF0aEFycmF5LmpvaW4oJy8nKTtcblxuICAgICAgICBsZXQgdHlwZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgICAgICBsZXQgaXRlbXM6IEFycmF5PHN0cmluZyB8IHsgbGFiZWw6IHN0cmluZywgdmFsdWU6IHN0cmluZyB8IG51bWJlciB8IGJvb2xlYW4gfT4gfCB1bmRlZmluZWQ7XG4gICAgICAgIGxldCBtZXNzYWdlOiBzdHJpbmc7XG4gICAgICAgIGlmICh0eXBlb2Ygc2NoZW1hID09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgbWVzc2FnZSA9IHNjaGVtYTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBtZXNzYWdlID0gc2NoZW1hLm1lc3NhZ2U7XG4gICAgICAgICAgdHlwZSA9IHNjaGVtYS50eXBlO1xuICAgICAgICAgIGl0ZW1zID0gc2NoZW1hLml0ZW1zO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0eXBlKSB7XG4gICAgICAgICAgaWYgKHBhcmVudFNjaGVtYS50eXBlID09PSAnYm9vbGVhbicpIHtcbiAgICAgICAgICAgIHR5cGUgPSAnY29uZmlybWF0aW9uJztcbiAgICAgICAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkocGFyZW50U2NoZW1hLmVudW0pKSB7XG4gICAgICAgICAgICB0eXBlID0gJ2xpc3QnO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0eXBlID0gJ2lucHV0JztcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodHlwZSA9PT0gJ2xpc3QnICYmICFpdGVtcykge1xuICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KHBhcmVudFNjaGVtYS5lbnVtKSkge1xuICAgICAgICAgICAgdHlwZSA9ICdsaXN0JztcbiAgICAgICAgICAgIGl0ZW1zID0gW107XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHZhbHVlIG9mIHBhcmVudFNjaGVtYS5lbnVtKSB7XG4gICAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICBpdGVtcy5wdXNoKHZhbHVlKTtcbiAgICAgICAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgdmFsdWUgPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICAvLyBJbnZhbGlkXG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaXRlbXMucHVzaCh7IGxhYmVsOiB2YWx1ZS50b1N0cmluZygpLCB2YWx1ZSB9KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGRlZmluaXRpb246IFByb21wdERlZmluaXRpb24gPSB7XG4gICAgICAgICAgaWQ6IHBhdGgsXG4gICAgICAgICAgdHlwZSxcbiAgICAgICAgICBtZXNzYWdlLFxuICAgICAgICAgIHByaW9yaXR5OiAwLFxuICAgICAgICAgIHJhdzogc2NoZW1hLFxuICAgICAgICAgIGl0ZW1zLFxuICAgICAgICAgIGRlZmF1bHQ6IHR5cGVvZiBwYXJlbnRTY2hlbWEuZGVmYXVsdCA9PSAnb2JqZWN0JyA/IHVuZGVmaW5lZCA6IHBhcmVudFNjaGVtYS5kZWZhdWx0LFxuICAgICAgICAgIGFzeW5jIHZhbGlkYXRvcihkYXRhOiBzdHJpbmcpIHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGl0LnNlbGYudmFsaWRhdGUocGFyZW50U2NoZW1hLCBkYXRhKTtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgcmVzdWx0ID09PSAnYm9vbGVhbicpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgcmVzdWx0O1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0sXG4gICAgICAgIH07XG5cbiAgICAgICAgY29tcGlsYXRpb25TY2hlbUluZm8ucHJvbXB0RGVmaW5pdGlvbnMucHVzaChkZWZpbml0aW9uKTtcblxuICAgICAgICByZXR1cm4gZnVuY3Rpb24odGhpczogeyBwcm9tcHRGaWVsZHNXaXRoVmFsdWU6IFNldDxzdHJpbmc+IH0pIHtcbiAgICAgICAgICBpZiAodGhpcykge1xuICAgICAgICAgICAgdGhpcy5wcm9tcHRGaWVsZHNXaXRoVmFsdWUuYWRkKHBhdGgpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9O1xuICAgICAgfSxcbiAgICAgIG1ldGFTY2hlbWE6IHtcbiAgICAgICAgb25lT2Y6IFtcbiAgICAgICAgICB7IHR5cGU6ICdzdHJpbmcnIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICd0eXBlJzogeyB0eXBlOiAnc3RyaW5nJyB9LFxuICAgICAgICAgICAgICAnbWVzc2FnZSc6IHsgdHlwZTogJ3N0cmluZycgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBhZGRpdGlvbmFsUHJvcGVydGllczogdHJ1ZSxcbiAgICAgICAgICAgIHJlcXVpcmVkOiBbICdtZXNzYWdlJyBdLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBfYXBwbHlQcm9tcHRzPFQ+KGRhdGE6IFQsIHByb21wdHM6IEFycmF5PFByb21wdERlZmluaXRpb24+KTogT2JzZXJ2YWJsZTxUPiB7XG4gICAgY29uc3QgcHJvdmlkZXIgPSB0aGlzLl9wcm9tcHRQcm92aWRlcjtcbiAgICBpZiAoIXByb3ZpZGVyKSB7XG4gICAgICByZXR1cm4gb2YoZGF0YSk7XG4gICAgfVxuXG4gICAgcHJvbXB0cy5zb3J0KChhLCBiKSA9PiBiLnByaW9yaXR5IC0gYS5wcmlvcml0eSk7XG5cbiAgICByZXR1cm4gZnJvbShwcm92aWRlcihwcm9tcHRzKSkucGlwZShcbiAgICAgIG1hcChhbnN3ZXJzID0+IHtcbiAgICAgICAgZm9yIChjb25zdCBwYXRoIGluIGFuc3dlcnMpIHtcbiAgICAgICAgICBDb3JlU2NoZW1hUmVnaXN0cnkuX3NldChcbiAgICAgICAgICAgIGRhdGEsXG4gICAgICAgICAgICBwYXRoLnNwbGl0KCcvJyksXG4gICAgICAgICAgICBhbnN3ZXJzW3BhdGhdIGFzIHt9LFxuICAgICAgICAgICAgbnVsbCxcbiAgICAgICAgICAgIHVuZGVmaW5lZCxcbiAgICAgICAgICAgIHRydWUsXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBkYXRhO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIHByaXZhdGUgc3RhdGljIF9zZXQoXG4gICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWFueVxuICAgIGRhdGE6IGFueSxcbiAgICBmcmFnbWVudHM6IHN0cmluZ1tdLFxuICAgIHZhbHVlOiB7fSxcbiAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tYW55XG4gICAgcGFyZW50OiBhbnkgfCBudWxsID0gbnVsbCxcbiAgICBwYXJlbnRQcm9wZXJ0eT86IHN0cmluZyxcbiAgICBmb3JjZT86IGJvb2xlYW4sXG4gICk6IHZvaWQge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZnJhZ21lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBmID0gZnJhZ21lbnRzW2ldO1xuXG4gICAgICBpZiAoZlswXSA9PSAnaScpIHtcbiAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KGRhdGEpKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBkYXRhLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgQ29yZVNjaGVtYVJlZ2lzdHJ5Ll9zZXQoZGF0YVtqXSwgZnJhZ21lbnRzLnNsaWNlKGkgKyAxKSwgdmFsdWUsIGRhdGEsICcnICsgaik7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm47XG4gICAgICB9IGVsc2UgaWYgKGYuc3RhcnRzV2l0aCgna2V5JykpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBkYXRhICE9PSAnb2JqZWN0Jykge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKGRhdGEpLmZvckVhY2gocHJvcGVydHkgPT4ge1xuICAgICAgICAgIENvcmVTY2hlbWFSZWdpc3RyeS5fc2V0KGRhdGFbcHJvcGVydHldLCBmcmFnbWVudHMuc2xpY2UoaSArIDEpLCB2YWx1ZSwgZGF0YSwgcHJvcGVydHkpO1xuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm47XG4gICAgICB9IGVsc2UgaWYgKGYuc3RhcnRzV2l0aCgnXFwnJykgJiYgZltmLmxlbmd0aCAtIDFdID09ICdcXCcnKSB7XG4gICAgICAgIGNvbnN0IHByb3BlcnR5ID0gZlxuICAgICAgICAgIC5zbGljZSgxLCAtMSlcbiAgICAgICAgICAucmVwbGFjZSgvXFxcXCcvZywgJ1xcJycpXG4gICAgICAgICAgLnJlcGxhY2UoL1xcXFxuL2csICdcXG4nKVxuICAgICAgICAgIC5yZXBsYWNlKC9cXFxcci9nLCAnXFxyJylcbiAgICAgICAgICAucmVwbGFjZSgvXFxcXGYvZywgJ1xcZicpXG4gICAgICAgICAgLnJlcGxhY2UoL1xcXFx0L2csICdcXHQnKTtcblxuICAgICAgICAvLyBXZSBrbm93IHdlIG5lZWQgYW4gb2JqZWN0IGJlY2F1c2UgdGhlIGZyYWdtZW50IGlzIGEgcHJvcGVydHkga2V5LlxuICAgICAgICBpZiAoIWRhdGEgJiYgcGFyZW50ICE9PSBudWxsICYmIHBhcmVudFByb3BlcnR5KSB7XG4gICAgICAgICAgZGF0YSA9IHBhcmVudFtwYXJlbnRQcm9wZXJ0eV0gPSB7fTtcbiAgICAgICAgfVxuICAgICAgICBwYXJlbnQgPSBkYXRhO1xuICAgICAgICBwYXJlbnRQcm9wZXJ0eSA9IHByb3BlcnR5O1xuXG4gICAgICAgIGRhdGEgPSBkYXRhW3Byb3BlcnR5XTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocGFyZW50ICYmIHBhcmVudFByb3BlcnR5ICYmIChmb3JjZSB8fCBwYXJlbnRbcGFyZW50UHJvcGVydHldID09PSB1bmRlZmluZWQpKSB7XG4gICAgICBwYXJlbnRbcGFyZW50UHJvcGVydHldID0gdmFsdWU7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfYXBwbHlTbWFydERlZmF1bHRzPFQ+KFxuICAgIGRhdGE6IFQsXG4gICAgc21hcnREZWZhdWx0czogTWFwPHN0cmluZywgSnNvbk9iamVjdD4sXG4gICk6IE9ic2VydmFibGU8VD4ge1xuICAgIHJldHVybiBvZihkYXRhKS5waXBlKFxuICAgICAgLi4uWy4uLnNtYXJ0RGVmYXVsdHMuZW50cmllcygpXS5tYXAoKFtwb2ludGVyLCBzY2hlbWFdKSA9PiB7XG4gICAgICAgIHJldHVybiBjb25jYXRNYXA8VCwgVD4oZGF0YSA9PiB7XG4gICAgICAgICAgY29uc3QgZnJhZ21lbnRzID0gSlNPTi5wYXJzZShwb2ludGVyKTtcbiAgICAgICAgICBjb25zdCBzb3VyY2UgPSB0aGlzLl9zb3VyY2VNYXAuZ2V0KChzY2hlbWEgYXMgSnNvbk9iamVjdCkuJHNvdXJjZSBhcyBzdHJpbmcpO1xuXG4gICAgICAgICAgbGV0IHZhbHVlID0gc291cmNlID8gc291cmNlKHNjaGVtYSkgOiBvZih1bmRlZmluZWQpO1xuXG4gICAgICAgICAgaWYgKCFpc09ic2VydmFibGUodmFsdWUpKSB7XG4gICAgICAgICAgICB2YWx1ZSA9IG9mKHZhbHVlKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gKHZhbHVlIGFzIE9ic2VydmFibGU8e30+KS5waXBlKFxuICAgICAgICAgICAgLy8gU3luY2hyb25vdXNseSBzZXQgdGhlIG5ldyBkYXRhIGF0IHRoZSBwcm9wZXIgSnNvblNjaGVtYSBwYXRoLlxuICAgICAgICAgICAgdGFwKHggPT4gQ29yZVNjaGVtYVJlZ2lzdHJ5Ll9zZXQoZGF0YSwgZnJhZ21lbnRzLCB4KSksXG4gICAgICAgICAgICAvLyBCdXQgcmV0dXJuIHRoZSBkYXRhIG9iamVjdC5cbiAgICAgICAgICAgIG1hcCgoKSA9PiBkYXRhKSxcbiAgICAgICAgICApO1xuICAgICAgICB9KTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cbn1cbiJdfQ==