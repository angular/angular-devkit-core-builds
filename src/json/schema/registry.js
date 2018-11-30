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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVnaXN0cnkuanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2NvcmUvc3JjL2pzb24vc2NoZW1hL3JlZ2lzdHJ5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUE7Ozs7OztHQU1HO0FBQ0gsMkJBQTJCO0FBQzNCLDZCQUE2QjtBQUM3QiwrQkFBd0Q7QUFDeEQsOENBQWdFO0FBQ2hFLDJCQUEyQjtBQUMzQix5REFBMEQ7QUFDMUQsdUNBQTBFO0FBQzFFLDRDQUE4RTtBQWU5RSx1Q0FBdUQ7QUFtQnZELE1BQWEseUJBQTBCLFNBQVEseUJBQWE7SUFHMUQsWUFDRSxNQUErQixFQUMvQixXQUFXLEdBQUcscURBQXFEO1FBRW5FLElBQUksQ0FBQyxNQUFNLElBQUksTUFBTSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7WUFDbEMsS0FBSyxDQUFDLDJCQUEyQixDQUFDLENBQUM7WUFFbkMsT0FBTztTQUNSO1FBRUQsTUFBTSxRQUFRLEdBQUcseUJBQXlCLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ2xFLEtBQUssQ0FBQyxHQUFHLFdBQVcsT0FBTyxRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNwRCxJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztJQUN2QixDQUFDO0lBRU0sTUFBTSxDQUFDLGNBQWMsQ0FBQyxNQUErQjtRQUMxRCxJQUFJLENBQUMsTUFBTSxJQUFJLE1BQU0sQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1lBQ2xDLE9BQU8sRUFBRSxDQUFDO1NBQ1g7UUFFRCxNQUFNLFFBQVEsR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUU7WUFDbEMsSUFBSSxPQUFPLEdBQUcsYUFBYSxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsSUFBSSxHQUFHLENBQUMsT0FBTyxFQUFFLENB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Q25DLGdFQUFnRTtnQkFDaEUsZUFBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBQ3JELDhCQUE4QjtnQkFDOUIsZUFBRyxDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUNoQixDQUFDO1lBQ0osQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDLENBQUMsQ0FDSCxDQUFDO0lBQ0osQ0FBQztDQUNGO0FBem9CRCxnREF5b0JDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0ICogYXMgYWp2IGZyb20gJ2Fqdic7XG5pbXBvcnQgKiBhcyBodHRwIGZyb20gJ2h0dHAnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZSwgZnJvbSwgb2YsIHRocm93RXJyb3IgfSBmcm9tICdyeGpzJztcbmltcG9ydCB7IGNvbmNhdE1hcCwgbWFwLCBzd2l0Y2hNYXAsIHRhcCB9IGZyb20gJ3J4anMvb3BlcmF0b3JzJztcbmltcG9ydCAqIGFzIFVybCBmcm9tICd1cmwnO1xuaW1wb3J0IHsgQmFzZUV4Y2VwdGlvbiB9IGZyb20gJy4uLy4uL2V4Y2VwdGlvbi9leGNlcHRpb24nO1xuaW1wb3J0IHsgUGFydGlhbGx5T3JkZXJlZFNldCwgZGVlcENvcHksIGlzT2JzZXJ2YWJsZSB9IGZyb20gJy4uLy4uL3V0aWxzJztcbmltcG9ydCB7IEpzb25BcnJheSwgSnNvbk9iamVjdCwgSnNvblZhbHVlLCBpc0pzb25PYmplY3QgfSBmcm9tICcuLi9pbnRlcmZhY2UnO1xuaW1wb3J0IHtcbiAgSnNvblBvaW50ZXIsXG4gIEpzb25WaXNpdG9yLFxuICBQcm9tcHREZWZpbml0aW9uLFxuICBQcm9tcHRQcm92aWRlcixcbiAgU2NoZW1hRm9ybWF0LFxuICBTY2hlbWFGb3JtYXR0ZXIsXG4gIFNjaGVtYVJlZ2lzdHJ5LFxuICBTY2hlbWFWYWxpZGF0b3IsXG4gIFNjaGVtYVZhbGlkYXRvckVycm9yLFxuICBTY2hlbWFWYWxpZGF0b3JPcHRpb25zLFxuICBTY2hlbWFWYWxpZGF0b3JSZXN1bHQsXG4gIFNtYXJ0RGVmYXVsdFByb3ZpZGVyLFxufSBmcm9tICcuL2ludGVyZmFjZSc7XG5pbXBvcnQgeyB2aXNpdEpzb24sIHZpc2l0SnNvblNjaGVtYSB9IGZyb20gJy4vdmlzaXRvcic7XG5cbi8vIFRoaXMgaW50ZXJmYWNlIHNob3VsZCBiZSBleHBvcnRlZCBmcm9tIGFqdiwgYnV0IHRoZXkgb25seSBleHBvcnQgdGhlIGNsYXNzIGFuZCBub3QgdGhlIHR5cGUuXG5pbnRlcmZhY2UgQWp2VmFsaWRhdGlvbkVycm9yIHtcbiAgbWVzc2FnZTogc3RyaW5nO1xuICBlcnJvcnM6IEFycmF5PGFqdi5FcnJvck9iamVjdD47XG4gIGFqdjogdHJ1ZTtcbiAgdmFsaWRhdGlvbjogdHJ1ZTtcbn1cblxuaW50ZXJmYWNlIEFqdlJlZk1hcCB7XG4gIHJlZnM6IHN0cmluZ1tdO1xuICByZWZWYWw6IGFueTsgLy8gdHNsaW50OmRpc2FibGUtbGluZTpuby1hbnlcbiAgc2NoZW1hOiBKc29uT2JqZWN0O1xufVxuXG5leHBvcnQgdHlwZSBVcmlIYW5kbGVyID0gKHVyaTogc3RyaW5nKSA9PlxuICBPYnNlcnZhYmxlPEpzb25PYmplY3Q+IHwgUHJvbWlzZTxKc29uT2JqZWN0PiB8IG51bGwgfCB1bmRlZmluZWQ7XG5cbmV4cG9ydCBjbGFzcyBTY2hlbWFWYWxpZGF0aW9uRXhjZXB0aW9uIGV4dGVuZHMgQmFzZUV4Y2VwdGlvbiB7XG4gIHB1YmxpYyByZWFkb25seSBlcnJvcnM6IFNjaGVtYVZhbGlkYXRvckVycm9yW107XG5cbiAgY29uc3RydWN0b3IoXG4gICAgZXJyb3JzPzogU2NoZW1hVmFsaWRhdG9yRXJyb3JbXSxcbiAgICBiYXNlTWVzc2FnZSA9ICdTY2hlbWEgdmFsaWRhdGlvbiBmYWlsZWQgd2l0aCB0aGUgZm9sbG93aW5nIGVycm9yczonLFxuICApIHtcbiAgICBpZiAoIWVycm9ycyB8fCBlcnJvcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICBzdXBlcignU2NoZW1hIHZhbGlkYXRpb24gZmFpbGVkLicpO1xuXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgbWVzc2FnZXMgPSBTY2hlbWFWYWxpZGF0aW9uRXhjZXB0aW9uLmNyZWF0ZU1lc3NhZ2VzKGVycm9ycyk7XG4gICAgc3VwZXIoYCR7YmFzZU1lc3NhZ2V9XFxuICAke21lc3NhZ2VzLmpvaW4oJ1xcbiAgJyl9YCk7XG4gICAgdGhpcy5lcnJvcnMgPSBlcnJvcnM7XG4gIH1cblxuICBwdWJsaWMgc3RhdGljIGNyZWF0ZU1lc3NhZ2VzKGVycm9ycz86IFNjaGVtYVZhbGlkYXRvckVycm9yW10pOiBzdHJpbmdbXSB7XG4gICAgaWYgKCFlcnJvcnMgfHwgZXJyb3JzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIGNvbnN0IG1lc3NhZ2VzID0gZXJyb3JzLm1hcCgoZXJyKSA9PiB7XG4gICAgICBsZXQgbWVzc2FnZSA9IGBEYXRhIHBhdGggJHtKU09OLnN0cmluZ2lmeShlcnIuZGF0YVBhdGgpfSAke2Vyci5tZXNzYWdlfWA7XG4gICAgICBpZiAoZXJyLmtleXdvcmQgPT09ICdhZGRpdGlvbmFsUHJvcGVydGllcycpIHtcbiAgICAgICAgbWVzc2FnZSArPSBgKCR7ZXJyLnBhcmFtcy5hZGRpdGlvbmFsUHJvcGVydHl9KWA7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBtZXNzYWdlICsgJy4nO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIG1lc3NhZ2VzO1xuICB9XG59XG5cbmludGVyZmFjZSBTY2hlbWFJbmZvIHtcbiAgc21hcnREZWZhdWx0UmVjb3JkOiBNYXA8c3RyaW5nLCBKc29uT2JqZWN0PjtcbiAgcHJvbXB0RGVmaW5pdGlvbnM6IEFycmF5PFByb21wdERlZmluaXRpb24+O1xufVxuXG5leHBvcnQgY2xhc3MgQ29yZVNjaGVtYVJlZ2lzdHJ5IGltcGxlbWVudHMgU2NoZW1hUmVnaXN0cnkge1xuICBwcml2YXRlIF9hanY6IGFqdi5BanY7XG4gIHByaXZhdGUgX3VyaUNhY2hlID0gbmV3IE1hcDxzdHJpbmcsIEpzb25PYmplY3Q+KCk7XG4gIHByaXZhdGUgX3VyaUhhbmRsZXJzID0gbmV3IFNldDxVcmlIYW5kbGVyPigpO1xuICBwcml2YXRlIF9wcmUgPSBuZXcgUGFydGlhbGx5T3JkZXJlZFNldDxKc29uVmlzaXRvcj4oKTtcbiAgcHJpdmF0ZSBfcG9zdCA9IG5ldyBQYXJ0aWFsbHlPcmRlcmVkU2V0PEpzb25WaXNpdG9yPigpO1xuXG4gIHByaXZhdGUgX2N1cnJlbnRDb21waWxhdGlvblNjaGVtYUluZm8/OiBTY2hlbWFJbmZvO1xuXG4gIHByaXZhdGUgX3NtYXJ0RGVmYXVsdEtleXdvcmQgPSBmYWxzZTtcbiAgcHJpdmF0ZSBfcHJvbXB0UHJvdmlkZXI/OiBQcm9tcHRQcm92aWRlcjtcbiAgcHJpdmF0ZSBfc291cmNlTWFwID0gbmV3IE1hcDxzdHJpbmcsIFNtYXJ0RGVmYXVsdFByb3ZpZGVyPHt9Pj4oKTtcblxuICBjb25zdHJ1Y3Rvcihmb3JtYXRzOiBTY2hlbWFGb3JtYXRbXSA9IFtdKSB7XG4gICAgLyoqXG4gICAgICogQnVpbGQgYW4gQUpWIGluc3RhbmNlIHRoYXQgd2lsbCBiZSB1c2VkIHRvIHZhbGlkYXRlIHNjaGVtYXMuXG4gICAgICovXG5cbiAgICBjb25zdCBmb3JtYXRzT2JqOiB7IFtuYW1lOiBzdHJpbmddOiBTY2hlbWFGb3JtYXR0ZXIgfSA9IHt9O1xuXG4gICAgZm9yIChjb25zdCBmb3JtYXQgb2YgZm9ybWF0cykge1xuICAgICAgZm9ybWF0c09ialtmb3JtYXQubmFtZV0gPSBmb3JtYXQuZm9ybWF0dGVyO1xuICAgIH1cblxuICAgIHRoaXMuX2FqdiA9IGFqdih7XG4gICAgICBmb3JtYXRzOiBmb3JtYXRzT2JqLFxuICAgICAgbG9hZFNjaGVtYTogKHVyaTogc3RyaW5nKSA9PiB0aGlzLl9mZXRjaCh1cmkpLFxuICAgICAgc2NoZW1hSWQ6ICdhdXRvJyxcbiAgICAgIHBhc3NDb250ZXh0OiB0cnVlLFxuICAgIH0pO1xuXG4gICAgdGhpcy5fYWp2LmFkZE1ldGFTY2hlbWEocmVxdWlyZSgnYWp2L2xpYi9yZWZzL2pzb24tc2NoZW1hLWRyYWZ0LTA0Lmpzb24nKSk7XG4gICAgdGhpcy5fYWp2LmFkZE1ldGFTY2hlbWEocmVxdWlyZSgnYWp2L2xpYi9yZWZzL2pzb24tc2NoZW1hLWRyYWZ0LTA2Lmpzb24nKSk7XG4gIH1cblxuICBwcml2YXRlIF9mZXRjaCh1cmk6IHN0cmluZyk6IFByb21pc2U8SnNvbk9iamVjdD4ge1xuICAgIGNvbnN0IG1heWJlU2NoZW1hID0gdGhpcy5fdXJpQ2FjaGUuZ2V0KHVyaSk7XG5cbiAgICBpZiAobWF5YmVTY2hlbWEpIHtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUobWF5YmVTY2hlbWEpO1xuICAgIH1cblxuICAgIC8vIFRyeSBhbGwgaGFuZGxlcnMsIG9uZSBhZnRlciB0aGUgb3RoZXIuXG4gICAgZm9yIChjb25zdCBtYXliZUhhbmRsZXIgb2YgdGhpcy5fdXJpSGFuZGxlcnMpIHtcbiAgICAgIGNvbnN0IGhhbmRsZXIgPSBtYXliZUhhbmRsZXIodXJpKTtcbiAgICAgIGlmIChoYW5kbGVyKSB7XG4gICAgICAgIC8vIFRoZSBBSlYgQVBJIG9ubHkgdW5kZXJzdGFuZHMgUHJvbWlzZXMuXG4gICAgICAgIHJldHVybiBmcm9tKGhhbmRsZXIpLnBpcGUoXG4gICAgICAgICAgdGFwKGpzb24gPT4gdGhpcy5fdXJpQ2FjaGUuc2V0KHVyaSwganNvbikpLFxuICAgICAgICApLnRvUHJvbWlzZSgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIElmIG5vbmUgYXJlIGZvdW5kLCBoYW5kbGUgdXNpbmcgaHR0cCBjbGllbnQuXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPEpzb25PYmplY3Q+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGh0dHAuZ2V0KHVyaSwgcmVzID0+IHtcbiAgICAgICAgaWYgKCFyZXMuc3RhdHVzQ29kZSB8fCByZXMuc3RhdHVzQ29kZSA+PSAzMDApIHtcbiAgICAgICAgICAvLyBDb25zdW1lIHRoZSByZXN0IG9mIHRoZSBkYXRhIHRvIGZyZWUgbWVtb3J5LlxuICAgICAgICAgIHJlcy5yZXN1bWUoKTtcbiAgICAgICAgICByZWplY3QobmV3IEVycm9yKGBSZXF1ZXN0IGZhaWxlZC4gU3RhdHVzIENvZGU6ICR7cmVzLnN0YXR1c0NvZGV9YCkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlcy5zZXRFbmNvZGluZygndXRmOCcpO1xuICAgICAgICAgIGxldCBkYXRhID0gJyc7XG4gICAgICAgICAgcmVzLm9uKCdkYXRhJywgY2h1bmsgPT4ge1xuICAgICAgICAgICAgZGF0YSArPSBjaHVuaztcbiAgICAgICAgICB9KTtcbiAgICAgICAgICByZXMub24oJ2VuZCcsICgpID0+IHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGNvbnN0IGpzb24gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgICAgICAgICAgICB0aGlzLl91cmlDYWNoZS5zZXQodXJpLCBqc29uKTtcbiAgICAgICAgICAgICAgcmVzb2x2ZShqc29uKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQWRkIGEgdHJhbnNmb3JtYXRpb24gc3RlcCBiZWZvcmUgdGhlIHZhbGlkYXRpb24gb2YgYW55IEpzb24uXG4gICAqIEBwYXJhbSB7SnNvblZpc2l0b3J9IHZpc2l0b3IgVGhlIHZpc2l0b3IgdG8gdHJhbnNmb3JtIGV2ZXJ5IHZhbHVlLlxuICAgKiBAcGFyYW0ge0pzb25WaXNpdG9yW119IGRlcHMgQSBsaXN0IG9mIG90aGVyIHZpc2l0b3JzIHRvIHJ1biBiZWZvcmUuXG4gICAqL1xuICBhZGRQcmVUcmFuc2Zvcm0odmlzaXRvcjogSnNvblZpc2l0b3IsIGRlcHM/OiBKc29uVmlzaXRvcltdKSB7XG4gICAgdGhpcy5fcHJlLmFkZCh2aXNpdG9yLCBkZXBzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGQgYSB0cmFuc2Zvcm1hdGlvbiBzdGVwIGFmdGVyIHRoZSB2YWxpZGF0aW9uIG9mIGFueSBKc29uLiBUaGUgSlNPTiB3aWxsIG5vdCBiZSB2YWxpZGF0ZWRcbiAgICogYWZ0ZXIgdGhlIFBPU1QsIHNvIGlmIHRyYW5zZm9ybWF0aW9ucyBhcmUgbm90IGNvbXBhdGlibGUgd2l0aCB0aGUgU2NoZW1hIGl0IHdpbGwgbm90IHJlc3VsdFxuICAgKiBpbiBhbiBlcnJvci5cbiAgICogQHBhcmFtIHtKc29uVmlzaXRvcn0gdmlzaXRvciBUaGUgdmlzaXRvciB0byB0cmFuc2Zvcm0gZXZlcnkgdmFsdWUuXG4gICAqIEBwYXJhbSB7SnNvblZpc2l0b3JbXX0gZGVwcyBBIGxpc3Qgb2Ygb3RoZXIgdmlzaXRvcnMgdG8gcnVuIGJlZm9yZS5cbiAgICovXG4gIGFkZFBvc3RUcmFuc2Zvcm0odmlzaXRvcjogSnNvblZpc2l0b3IsIGRlcHM/OiBKc29uVmlzaXRvcltdKSB7XG4gICAgdGhpcy5fcG9zdC5hZGQodmlzaXRvciwgZGVwcyk7XG4gIH1cblxuICBwcm90ZWN0ZWQgX3Jlc29sdmVyKFxuICAgIHJlZjogc3RyaW5nLFxuICAgIHZhbGlkYXRlOiBhanYuVmFsaWRhdGVGdW5jdGlvbixcbiAgKTogeyBjb250ZXh0PzogYWp2LlZhbGlkYXRlRnVuY3Rpb24sIHNjaGVtYT86IEpzb25PYmplY3QgfSB7XG4gICAgaWYgKCF2YWxpZGF0ZSB8fCAhdmFsaWRhdGUucmVmcyB8fCAhdmFsaWRhdGUucmVmVmFsIHx8ICFyZWYpIHtcbiAgICAgIHJldHVybiB7fTtcbiAgICB9XG5cbiAgICBsZXQgcmVmTWFwID0gdmFsaWRhdGUgYXMgQWp2UmVmTWFwO1xuICAgIGNvbnN0IHJvb3RSZWZNYXAgPSB2YWxpZGF0ZS5yb290IGFzIEFqdlJlZk1hcDtcblxuICAgIC8vIFJlc29sdmUgZnJvbSB0aGUgcm9vdCBpZiBpdCdzIGRpZmZlcmVudC5cbiAgICBpZiAodmFsaWRhdGUucm9vdCAmJiB2YWxpZGF0ZS5zY2hlbWEgIT09IHJvb3RSZWZNYXAuc2NoZW1hKSB7XG4gICAgICByZWZNYXAgPSByb290UmVmTWFwO1xuICAgIH1cblxuICAgIGNvbnN0IHNjaGVtYSA9IHJlZk1hcC5zY2hlbWEgPyB0eXBlb2YgcmVmTWFwLnNjaGVtYSA9PSAnb2JqZWN0JyAmJiByZWZNYXAuc2NoZW1hIDogbnVsbDtcbiAgICBjb25zdCBtYXliZUlkID0gc2NoZW1hID8gKHNjaGVtYSBhcyBKc29uT2JqZWN0KS5pZCB8fCAoc2NoZW1hIGFzIEpzb25PYmplY3QpLiRpZCA6IG51bGw7XG5cbiAgICBpZiAodHlwZW9mIG1heWJlSWQgPT0gJ3N0cmluZycpIHtcbiAgICAgIHJlZiA9IFVybC5yZXNvbHZlKG1heWJlSWQsIHJlZik7XG4gICAgfVxuXG4gICAgbGV0IGZ1bGxSZWZlcmVuY2UgPSAocmVmWzBdID09PSAnIycgJiYgbWF5YmVJZCkgPyBtYXliZUlkICsgcmVmIDogcmVmO1xuICAgIGlmIChmdWxsUmVmZXJlbmNlLmVuZHNXaXRoKCcjJykpIHtcbiAgICAgIGZ1bGxSZWZlcmVuY2UgPSBmdWxsUmVmZXJlbmNlLnNsaWNlKDAsIC0xKTtcbiAgICB9XG5cbiAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tYW55XG4gICAgY29uc3QgY29udGV4dCA9IHZhbGlkYXRlLnJlZlZhbFsodmFsaWRhdGUucmVmcyBhcyBhbnkpW2Z1bGxSZWZlcmVuY2VdXTtcblxuICAgIGlmICh0eXBlb2YgY29udGV4dCA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAvLyBDb250ZXh0IHdpbGwgYmUgYSBmdW5jdGlvbiBpZiB0aGUgc2NoZW1hIGlzbid0IGxvYWRlZCB5ZXQsIGFuZCBhbiBhY3R1YWwgc2NoZW1hIGlmIGl0J3NcbiAgICAgIC8vIHN5bmNocm9ub3VzbHkgYXZhaWxhYmxlLlxuICAgICAgcmV0dXJuIHsgY29udGV4dCwgc2NoZW1hOiBjb250ZXh0ICYmIGNvbnRleHQuc2NoZW1hIGFzIEpzb25PYmplY3QgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHsgY29udGV4dDogdmFsaWRhdGUsIHNjaGVtYTogY29udGV4dCBhcyBKc29uT2JqZWN0IH07XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEZsYXR0ZW4gdGhlIFNjaGVtYSwgcmVzb2x2aW5nIGFuZCByZXBsYWNpbmcgYWxsIHRoZSByZWZzLiBNYWtlcyBpdCBpbnRvIGEgc3luY2hyb25vdXMgc2NoZW1hXG4gICAqIHRoYXQgaXMgYWxzbyBlYXNpZXIgdG8gdHJhdmVyc2UuIERvZXMgbm90IGNhY2hlIHRoZSByZXN1bHQuXG4gICAqXG4gICAqIEBwYXJhbSBzY2hlbWEgVGhlIHNjaGVtYSBvciBVUkkgdG8gZmxhdHRlbi5cbiAgICogQHJldHVybnMgQW4gT2JzZXJ2YWJsZSBvZiB0aGUgZmxhdHRlbmVkIHNjaGVtYSBvYmplY3QuXG4gICAqL1xuICBmbGF0dGVuKHNjaGVtYTogSnNvbk9iamVjdCk6IE9ic2VydmFibGU8SnNvbk9iamVjdD4ge1xuICAgIHRoaXMuX2Fqdi5yZW1vdmVTY2hlbWEoc2NoZW1hKTtcblxuICAgIC8vIFN1cHBvcnRzIGJvdGggc3luY2hyb25vdXMgYW5kIGFzeW5jaHJvbm91cyBjb21waWxhdGlvbiwgYnkgdHJ5aW5nIHRoZSBzeW5jaHJvbm91c1xuICAgIC8vIHZlcnNpb24gZmlyc3QsIHRoZW4gaWYgcmVmcyBhcmUgbWlzc2luZyB0aGlzIHdpbGwgZmFpbHMuXG4gICAgLy8gV2UgYWxzbyBhZGQgYW55IHJlZnMgZnJvbSBleHRlcm5hbCBmZXRjaGVkIHNjaGVtYXMgc28gdGhhdCB0aG9zZSB3aWxsIGFsc28gYmUgdXNlZFxuICAgIC8vIGluIHN5bmNocm9ub3VzIChpZiBhdmFpbGFibGUpLlxuICAgIGxldCB2YWxpZGF0b3I6IE9ic2VydmFibGU8YWp2LlZhbGlkYXRlRnVuY3Rpb24+O1xuICAgIHRyeSB7XG4gICAgICB0aGlzLl9jdXJyZW50Q29tcGlsYXRpb25TY2hlbWFJbmZvID0gdW5kZWZpbmVkO1xuICAgICAgdmFsaWRhdG9yID0gb2YodGhpcy5fYWp2LmNvbXBpbGUoc2NoZW1hKSkucGlwZShcbiAgICAgICAgdGFwKCgpID0+IHRoaXMuX2N1cnJlbnRDb21waWxhdGlvblNjaGVtYUluZm8gPSB1bmRlZmluZWQpLFxuICAgICAgKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAvLyBQcm9wYWdhdGUgdGhlIGVycm9yLlxuICAgICAgaWYgKCEoZSBpbnN0YW5jZW9mIChhanYuTWlzc2luZ1JlZkVycm9yIGFzIHt9IGFzIEZ1bmN0aW9uKSkpIHtcbiAgICAgICAgcmV0dXJuIHRocm93RXJyb3IoZSk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuX2N1cnJlbnRDb21waWxhdGlvblNjaGVtYUluZm8gPSB1bmRlZmluZWQ7XG4gICAgICB2YWxpZGF0b3IgPSBmcm9tKHRoaXMuX2Fqdi5jb21waWxlQXN5bmMoc2NoZW1hKSkucGlwZShcbiAgICAgICAgdGFwKCgpID0+IHRoaXMuX2N1cnJlbnRDb21waWxhdGlvblNjaGVtYUluZm8gPSB1bmRlZmluZWQpLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdmFsaWRhdG9yLnBpcGUoXG4gICAgICBzd2l0Y2hNYXAodmFsaWRhdGUgPT4ge1xuICAgICAgICBjb25zdCBzZWxmID0gdGhpcztcblxuICAgICAgICBmdW5jdGlvbiB2aXNpdG9yKFxuICAgICAgICAgIGN1cnJlbnQ6IEpzb25PYmplY3QgfCBKc29uQXJyYXksXG4gICAgICAgICAgcG9pbnRlcjogSnNvblBvaW50ZXIsXG4gICAgICAgICAgcGFyZW50U2NoZW1hPzogSnNvbk9iamVjdCB8IEpzb25BcnJheSxcbiAgICAgICAgICBpbmRleD86IHN0cmluZyxcbiAgICAgICAgKSB7XG4gICAgICAgICAgaWYgKGN1cnJlbnRcbiAgICAgICAgICAgICYmIHBhcmVudFNjaGVtYVxuICAgICAgICAgICAgJiYgaW5kZXhcbiAgICAgICAgICAgICYmIGlzSnNvbk9iamVjdChjdXJyZW50KVxuICAgICAgICAgICAgJiYgY3VycmVudC5oYXNPd25Qcm9wZXJ0eSgnJHJlZicpXG4gICAgICAgICAgICAmJiB0eXBlb2YgY3VycmVudFsnJHJlZiddID09ICdzdHJpbmcnXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICBjb25zdCByZXNvbHZlZCA9IHNlbGYuX3Jlc29sdmVyKGN1cnJlbnRbJyRyZWYnXSBhcyBzdHJpbmcsIHZhbGlkYXRlKTtcblxuICAgICAgICAgICAgaWYgKHJlc29sdmVkLnNjaGVtYSkge1xuICAgICAgICAgICAgICAocGFyZW50U2NoZW1hIGFzIEpzb25PYmplY3QpW2luZGV4XSA9IHJlc29sdmVkLnNjaGVtYTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzY2hlbWEgPSBkZWVwQ29weSh2YWxpZGF0ZS5zY2hlbWEgYXMgSnNvbk9iamVjdCk7XG4gICAgICAgIHZpc2l0SnNvblNjaGVtYShzY2hlbWEsIHZpc2l0b3IpO1xuXG4gICAgICAgIHJldHVybiBvZihzY2hlbWEpO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb21waWxlIGFuZCByZXR1cm4gYSB2YWxpZGF0aW9uIGZ1bmN0aW9uIGZvciB0aGUgU2NoZW1hLlxuICAgKlxuICAgKiBAcGFyYW0gc2NoZW1hIFRoZSBzY2hlbWEgdG8gdmFsaWRhdGUuIElmIGEgc3RyaW5nLCB3aWxsIGZldGNoIHRoZSBzY2hlbWEgYmVmb3JlIGNvbXBpbGluZyBpdFxuICAgKiAodXNpbmcgc2NoZW1hIGFzIGEgVVJJKS5cbiAgICogQHJldHVybnMgQW4gT2JzZXJ2YWJsZSBvZiB0aGUgVmFsaWRhdGlvbiBmdW5jdGlvbi5cbiAgICovXG4gIGNvbXBpbGUoc2NoZW1hOiBKc29uT2JqZWN0KTogT2JzZXJ2YWJsZTxTY2hlbWFWYWxpZGF0b3I+IHtcbiAgICBjb25zdCBzY2hlbWFJbmZvOiBTY2hlbWFJbmZvID0ge1xuICAgICAgc21hcnREZWZhdWx0UmVjb3JkOiBuZXcgTWFwPHN0cmluZywgSnNvbk9iamVjdD4oKSxcbiAgICAgIHByb21wdERlZmluaXRpb25zOiBbXSxcbiAgICB9O1xuXG4gICAgdGhpcy5fYWp2LnJlbW92ZVNjaGVtYShzY2hlbWEpO1xuXG4gICAgLy8gU3VwcG9ydHMgYm90aCBzeW5jaHJvbm91cyBhbmQgYXN5bmNocm9ub3VzIGNvbXBpbGF0aW9uLCBieSB0cnlpbmcgdGhlIHN5bmNocm9ub3VzXG4gICAgLy8gdmVyc2lvbiBmaXJzdCwgdGhlbiBpZiByZWZzIGFyZSBtaXNzaW5nIHRoaXMgd2lsbCBmYWlscy5cbiAgICAvLyBXZSBhbHNvIGFkZCBhbnkgcmVmcyBmcm9tIGV4dGVybmFsIGZldGNoZWQgc2NoZW1hcyBzbyB0aGF0IHRob3NlIHdpbGwgYWxzbyBiZSB1c2VkXG4gICAgLy8gaW4gc3luY2hyb25vdXMgKGlmIGF2YWlsYWJsZSkuXG4gICAgbGV0IHZhbGlkYXRvcjogT2JzZXJ2YWJsZTxhanYuVmFsaWRhdGVGdW5jdGlvbj47XG4gICAgdHJ5IHtcbiAgICAgIHRoaXMuX2N1cnJlbnRDb21waWxhdGlvblNjaGVtYUluZm8gPSBzY2hlbWFJbmZvO1xuICAgICAgdmFsaWRhdG9yID0gb2YodGhpcy5fYWp2LmNvbXBpbGUoc2NoZW1hKSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgLy8gUHJvcGFnYXRlIHRoZSBlcnJvci5cbiAgICAgIGlmICghKGUgaW5zdGFuY2VvZiAoYWp2Lk1pc3NpbmdSZWZFcnJvciBhcyB7fSBhcyBGdW5jdGlvbikpKSB7XG4gICAgICAgIHJldHVybiB0aHJvd0Vycm9yKGUpO1xuICAgICAgfVxuXG4gICAgICB0cnkge1xuICAgICAgICB2YWxpZGF0b3IgPSBmcm9tKHRoaXMuX2Fqdi5jb21waWxlQXN5bmMoc2NoZW1hKSk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHJldHVybiB0aHJvd0Vycm9yKGUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB2YWxpZGF0b3JcbiAgICAgIC5waXBlKFxuICAgICAgICBtYXAodmFsaWRhdGUgPT4gKGRhdGE6IEpzb25WYWx1ZSwgb3B0aW9ucz86IFNjaGVtYVZhbGlkYXRvck9wdGlvbnMpID0+IHtcbiAgICAgICAgICBjb25zdCB2YWxpZGF0aW9uT3B0aW9uczogU2NoZW1hVmFsaWRhdG9yT3B0aW9ucyA9IHtcbiAgICAgICAgICAgIHdpdGhQcm9tcHRzOiB0cnVlLFxuICAgICAgICAgICAgYXBwbHlQb3N0VHJhbnNmb3JtczogdHJ1ZSxcbiAgICAgICAgICAgIGFwcGx5UHJlVHJhbnNmb3JtczogdHJ1ZSxcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgfTtcbiAgICAgICAgICBjb25zdCB2YWxpZGF0aW9uQ29udGV4dCA9IHtcbiAgICAgICAgICAgIHByb21wdEZpZWxkc1dpdGhWYWx1ZTogbmV3IFNldDxzdHJpbmc+KCksXG4gICAgICAgICAgfTtcblxuICAgICAgICAgIGxldCByZXN1bHQgPSBvZihkYXRhKTtcbiAgICAgICAgICBpZiAodmFsaWRhdGlvbk9wdGlvbnMuYXBwbHlQcmVUcmFuc2Zvcm1zKSB7XG4gICAgICAgICAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tYW55IGh0dHBzOi8vZ2l0aHViLmNvbS9SZWFjdGl2ZVgvcnhqcy9pc3N1ZXMvMzk4OVxuICAgICAgICAgICAgcmVzdWx0ID0gKHJlc3VsdCBhcyBhbnkpLnBpcGUoXG4gICAgICAgICAgICAgIC4uLlsuLi50aGlzLl9wcmVdLm1hcCh2aXNpdG9yID0+IGNvbmNhdE1hcCgoZGF0YTogSnNvblZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHZpc2l0SnNvbihkYXRhLCB2aXNpdG9yLCBzY2hlbWEsIHRoaXMuX3Jlc29sdmVyLCB2YWxpZGF0ZSk7XG4gICAgICAgICAgICAgIH0pKSxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmV0dXJuIHJlc3VsdC5waXBlKFxuICAgICAgICAgICAgc3dpdGNoTWFwKHVwZGF0ZURhdGEgPT4gdGhpcy5fYXBwbHlTbWFydERlZmF1bHRzKFxuICAgICAgICAgICAgICB1cGRhdGVEYXRhLFxuICAgICAgICAgICAgICBzY2hlbWFJbmZvLnNtYXJ0RGVmYXVsdFJlY29yZCxcbiAgICAgICAgICAgICkpLFxuICAgICAgICAgICAgc3dpdGNoTWFwKHVwZGF0ZWREYXRhID0+IHtcbiAgICAgICAgICAgICAgaWYgKHZhbGlkYXRpb25PcHRpb25zLndpdGhQcm9tcHRzID09PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBvZih1cGRhdGVkRGF0YSk7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBjb25zdCB2aXNpdG9yOiBKc29uVmlzaXRvciA9ICh2YWx1ZSwgcG9pbnRlcikgPT4ge1xuICAgICAgICAgICAgICAgIGlmICh2YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICB2YWxpZGF0aW9uQ29udGV4dC5wcm9tcHRGaWVsZHNXaXRoVmFsdWUuYWRkKHBvaW50ZXIpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICByZXR1cm4gdmlzaXRKc29uKHVwZGF0ZWREYXRhLCB2aXNpdG9yLCBzY2hlbWEsIHRoaXMuX3Jlc29sdmVyLCB2YWxpZGF0ZSk7XG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIHN3aXRjaE1hcCh1cGRhdGVkRGF0YSA9PiB7XG4gICAgICAgICAgICAgIGlmICh2YWxpZGF0aW9uT3B0aW9ucy53aXRoUHJvbXB0cyA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gb2YodXBkYXRlZERhdGEpO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgY29uc3QgZGVmaW5pdGlvbnMgPSBzY2hlbWFJbmZvLnByb21wdERlZmluaXRpb25zXG4gICAgICAgICAgICAgICAgLmZpbHRlcihkZWYgPT4gIXZhbGlkYXRpb25Db250ZXh0LnByb21wdEZpZWxkc1dpdGhWYWx1ZS5oYXMoZGVmLmlkKSk7XG5cbiAgICAgICAgICAgICAgaWYgKHRoaXMuX3Byb21wdFByb3ZpZGVyICYmIGRlZmluaXRpb25zLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZnJvbSh0aGlzLl9hcHBseVByb21wdHModXBkYXRlZERhdGEsIGRlZmluaXRpb25zKSk7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG9mKHVwZGF0ZWREYXRhKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgICBzd2l0Y2hNYXAodXBkYXRlZERhdGEgPT4ge1xuICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSB2YWxpZGF0ZS5jYWxsKHZhbGlkYXRpb25Db250ZXh0LCB1cGRhdGVkRGF0YSk7XG5cbiAgICAgICAgICAgICAgcmV0dXJuIHR5cGVvZiByZXN1bHQgPT0gJ2Jvb2xlYW4nXG4gICAgICAgICAgICAgICAgPyBvZihbdXBkYXRlZERhdGEsIHJlc3VsdF0pXG4gICAgICAgICAgICAgICAgOiBmcm9tKChyZXN1bHQgYXMgUHJvbWlzZTxib29sZWFuPilcbiAgICAgICAgICAgICAgICAgIC50aGVuKHIgPT4gW3VwZGF0ZWREYXRhLCB0cnVlXSlcbiAgICAgICAgICAgICAgICAgIC5jYXRjaCgoZXJyOiBFcnJvciB8IEFqdlZhbGlkYXRpb25FcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoKGVyciBhcyBBanZWYWxpZGF0aW9uRXJyb3IpLmFqdikge1xuICAgICAgICAgICAgICAgICAgICAgIHZhbGlkYXRlLmVycm9ycyA9IChlcnIgYXMgQWp2VmFsaWRhdGlvbkVycm9yKS5lcnJvcnM7XG5cbiAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKFt1cGRhdGVkRGF0YSwgZmFsc2VdKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChlcnIpO1xuICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgfSksXG4gICAgICAgICAgICBzd2l0Y2hNYXAoKFtkYXRhLCB2YWxpZF06IFtKc29uVmFsdWUsIGJvb2xlYW5dKSA9PiB7XG4gICAgICAgICAgICAgIGlmICh2YWxpZCkge1xuICAgICAgICAgICAgICAgIGxldCByZXN1bHQgPSBvZihkYXRhKTtcblxuICAgICAgICAgICAgICAgIGlmICh2YWxpZGF0aW9uT3B0aW9ucy5hcHBseVBvc3RUcmFuc2Zvcm1zKSB7XG4gICAgICAgICAgICAgICAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tYW55IGh0dHBzOi8vZ2l0aHViLmNvbS9SZWFjdGl2ZVgvcnhqcy9pc3N1ZXMvMzk4OVxuICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gKHJlc3VsdCBhcyBhbnkpLnBpcGUoXG4gICAgICAgICAgICAgICAgICAgIC4uLlsuLi50aGlzLl9wb3N0XS5tYXAodmlzaXRvciA9PiBjb25jYXRNYXAoKGRhdGE6IEpzb25WYWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB2aXNpdEpzb24oZGF0YSwgdmlzaXRvciwgc2NoZW1hLCB0aGlzLl9yZXNvbHZlciwgdmFsaWRhdGUpO1xuICAgICAgICAgICAgICAgICAgICB9KSksXG4gICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHQucGlwZShcbiAgICAgICAgICAgICAgICAgIG1hcChkYXRhID0+IFtkYXRhLCB2YWxpZF0pLFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG9mKFtkYXRhLCB2YWxpZF0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIG1hcCgoW2RhdGEsIHZhbGlkXTogW0pzb25WYWx1ZSwgYm9vbGVhbl0pID0+IHtcbiAgICAgICAgICAgICAgaWYgKHZhbGlkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgZGF0YSwgc3VjY2VzczogdHJ1ZSB9IGFzIFNjaGVtYVZhbGlkYXRvclJlc3VsdDtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgZGF0YSxcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBlcnJvcnM6ICh2YWxpZGF0ZS5lcnJvcnMgfHwgW10pLFxuICAgICAgICAgICAgICB9IGFzIFNjaGVtYVZhbGlkYXRvclJlc3VsdDtcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICk7XG4gICAgICAgIH0pLFxuICAgICAgKTtcbiAgfVxuXG4gIGFkZEZvcm1hdChmb3JtYXQ6IFNjaGVtYUZvcm1hdCk6IHZvaWQge1xuICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby1hbnlcbiAgICBjb25zdCB2YWxpZGF0ZSA9IChkYXRhOiBhbnkpID0+IHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGZvcm1hdC5mb3JtYXR0ZXIudmFsaWRhdGUoZGF0YSk7XG5cbiAgICAgIGlmICh0eXBlb2YgcmVzdWx0ID09ICdib29sZWFuJykge1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHJlc3VsdC50b1Byb21pc2UoKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgdGhpcy5fYWp2LmFkZEZvcm1hdChmb3JtYXQubmFtZSwge1xuICAgICAgYXN5bmM6IGZvcm1hdC5mb3JtYXR0ZXIuYXN5bmMsXG4gICAgICB2YWxpZGF0ZSxcbiAgICAvLyBBSlYgdHlwaW5ncyBsaXN0IGBjb21wYXJlYCBhcyByZXF1aXJlZCwgYnV0IGl0IGlzIG9wdGlvbmFsLlxuICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby1hbnlcbiAgICB9IGFzIGFueSk7XG4gIH1cblxuICBhZGRTbWFydERlZmF1bHRQcm92aWRlcjxUPihzb3VyY2U6IHN0cmluZywgcHJvdmlkZXI6IFNtYXJ0RGVmYXVsdFByb3ZpZGVyPFQ+KSB7XG4gICAgaWYgKHRoaXMuX3NvdXJjZU1hcC5oYXMoc291cmNlKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKHNvdXJjZSk7XG4gICAgfVxuXG4gICAgdGhpcy5fc291cmNlTWFwLnNldChzb3VyY2UsIHByb3ZpZGVyKTtcblxuICAgIGlmICghdGhpcy5fc21hcnREZWZhdWx0S2V5d29yZCkge1xuICAgICAgdGhpcy5fc21hcnREZWZhdWx0S2V5d29yZCA9IHRydWU7XG5cbiAgICAgIHRoaXMuX2Fqdi5hZGRLZXl3b3JkKCckZGVmYXVsdCcsIHtcbiAgICAgICAgZXJyb3JzOiBmYWxzZSxcbiAgICAgICAgdmFsaWQ6IHRydWUsXG4gICAgICAgIGNvbXBpbGU6IChzY2hlbWEsIF9wYXJlbnRTY2hlbWEsIGl0KSA9PiB7XG4gICAgICAgICAgY29uc3QgY29tcGlsYXRpb25TY2hlbUluZm8gPSB0aGlzLl9jdXJyZW50Q29tcGlsYXRpb25TY2hlbWFJbmZvO1xuICAgICAgICAgIGlmIChjb21waWxhdGlvblNjaGVtSW5mbyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICByZXR1cm4gKCkgPT4gdHJ1ZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBXZSBjaGVhdCwgaGVhdmlseS5cbiAgICAgICAgICBjb21waWxhdGlvblNjaGVtSW5mby5zbWFydERlZmF1bHRSZWNvcmQuc2V0KFxuICAgICAgICAgICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWFueVxuICAgICAgICAgICAgSlNPTi5zdHJpbmdpZnkoKGl0IGFzIGFueSkuZGF0YVBhdGhBcnIuc2xpY2UoMSwgKGl0IGFzIGFueSkuZGF0YUxldmVsICsgMSkgYXMgc3RyaW5nW10pLFxuICAgICAgICAgICAgc2NoZW1hLFxuICAgICAgICAgICk7XG5cbiAgICAgICAgICByZXR1cm4gKCkgPT4gdHJ1ZTtcbiAgICAgICAgfSxcbiAgICAgICAgbWV0YVNjaGVtYToge1xuICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICckc291cmNlJzogeyB0eXBlOiAnc3RyaW5nJyB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgYWRkaXRpb25hbFByb3BlcnRpZXM6IHRydWUsXG4gICAgICAgICAgcmVxdWlyZWQ6IFsgJyRzb3VyY2UnIF0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICByZWdpc3RlclVyaUhhbmRsZXIoaGFuZGxlcjogVXJpSGFuZGxlcikge1xuICAgIHRoaXMuX3VyaUhhbmRsZXJzLmFkZChoYW5kbGVyKTtcbiAgfVxuXG4gIHVzZVByb21wdFByb3ZpZGVyKHByb3ZpZGVyOiBQcm9tcHRQcm92aWRlcikge1xuICAgIGNvbnN0IGlzU2V0dXAgPSAhIXRoaXMuX3Byb21wdFByb3ZpZGVyO1xuXG4gICAgdGhpcy5fcHJvbXB0UHJvdmlkZXIgPSBwcm92aWRlcjtcblxuICAgIGlmIChpc1NldHVwKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5fYWp2LmFkZEtleXdvcmQoJ3gtcHJvbXB0Jywge1xuICAgICAgZXJyb3JzOiBmYWxzZSxcbiAgICAgIHZhbGlkOiB0cnVlLFxuICAgICAgY29tcGlsZTogKHNjaGVtYSwgcGFyZW50U2NoZW1hOiBKc29uT2JqZWN0LCBpdCkgPT4ge1xuICAgICAgICBjb25zdCBjb21waWxhdGlvblNjaGVtSW5mbyA9IHRoaXMuX2N1cnJlbnRDb21waWxhdGlvblNjaGVtYUluZm87XG4gICAgICAgIGlmICghY29tcGlsYXRpb25TY2hlbUluZm8pIHtcbiAgICAgICAgICByZXR1cm4gKCkgPT4gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby1hbnlcbiAgICAgICAgY29uc3QgcGF0aEFycmF5ID0gKChpdCBhcyBhbnkpLmRhdGFQYXRoQXJyIGFzIHN0cmluZ1tdKS5zbGljZSgxLCBpdC5kYXRhTGV2ZWwgKyAxKTtcbiAgICAgICAgY29uc3QgcGF0aCA9ICcvJyArIHBhdGhBcnJheS5tYXAocCA9PiBwLnJlcGxhY2UoL15cXCcvLCAnJykucmVwbGFjZSgvXFwnJC8sICcnKSkuam9pbignLycpO1xuXG4gICAgICAgIGxldCB0eXBlOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgICAgIGxldCBpdGVtczogQXJyYXk8c3RyaW5nIHwgeyBsYWJlbDogc3RyaW5nLCB2YWx1ZTogc3RyaW5nIHwgbnVtYmVyIHwgYm9vbGVhbiB9PiB8IHVuZGVmaW5lZDtcbiAgICAgICAgbGV0IG1lc3NhZ2U6IHN0cmluZztcbiAgICAgICAgaWYgKHR5cGVvZiBzY2hlbWEgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICBtZXNzYWdlID0gc2NoZW1hO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG1lc3NhZ2UgPSBzY2hlbWEubWVzc2FnZTtcbiAgICAgICAgICB0eXBlID0gc2NoZW1hLnR5cGU7XG4gICAgICAgICAgaXRlbXMgPSBzY2hlbWEuaXRlbXM7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXR5cGUpIHtcbiAgICAgICAgICBpZiAocGFyZW50U2NoZW1hLnR5cGUgPT09ICdib29sZWFuJykge1xuICAgICAgICAgICAgdHlwZSA9ICdjb25maXJtYXRpb24nO1xuICAgICAgICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShwYXJlbnRTY2hlbWEuZW51bSkpIHtcbiAgICAgICAgICAgIHR5cGUgPSAnbGlzdCc7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHR5cGUgPSAnaW5wdXQnO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0eXBlID09PSAnbGlzdCcgJiYgIWl0ZW1zKSB7XG4gICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkocGFyZW50U2NoZW1hLmVudW0pKSB7XG4gICAgICAgICAgICB0eXBlID0gJ2xpc3QnO1xuICAgICAgICAgICAgaXRlbXMgPSBbXTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgdmFsdWUgb2YgcGFyZW50U2NoZW1hLmVudW0pIHtcbiAgICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIGl0ZW1zLnB1c2godmFsdWUpO1xuICAgICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiB2YWx1ZSA9PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgIC8vIEludmFsaWRcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpdGVtcy5wdXNoKHsgbGFiZWw6IHZhbHVlLnRvU3RyaW5nKCksIHZhbHVlIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZGVmaW5pdGlvbjogUHJvbXB0RGVmaW5pdGlvbiA9IHtcbiAgICAgICAgICBpZDogcGF0aCxcbiAgICAgICAgICB0eXBlLFxuICAgICAgICAgIG1lc3NhZ2UsXG4gICAgICAgICAgcHJpb3JpdHk6IDAsXG4gICAgICAgICAgcmF3OiBzY2hlbWEsXG4gICAgICAgICAgaXRlbXMsXG4gICAgICAgICAgbXVsdGlzZWxlY3Q6IHR5cGUgPT09ICdsaXN0JyA/IHNjaGVtYS5tdWx0aXNlbGVjdCA6IGZhbHNlLFxuICAgICAgICAgIGRlZmF1bHQ6IHR5cGVvZiBwYXJlbnRTY2hlbWEuZGVmYXVsdCA9PSAnb2JqZWN0JyA/IHVuZGVmaW5lZCA6IHBhcmVudFNjaGVtYS5kZWZhdWx0LFxuICAgICAgICAgIGFzeW5jIHZhbGlkYXRvcihkYXRhOiBzdHJpbmcpIHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGl0LnNlbGYudmFsaWRhdGUocGFyZW50U2NoZW1hLCBkYXRhKTtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgcmVzdWx0ID09PSAnYm9vbGVhbicpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgcmVzdWx0O1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0sXG4gICAgICAgIH07XG5cbiAgICAgICAgY29tcGlsYXRpb25TY2hlbUluZm8ucHJvbXB0RGVmaW5pdGlvbnMucHVzaChkZWZpbml0aW9uKTtcblxuICAgICAgICByZXR1cm4gZnVuY3Rpb24odGhpczogeyBwcm9tcHRGaWVsZHNXaXRoVmFsdWU6IFNldDxzdHJpbmc+IH0pIHtcbiAgICAgICAgICAvLyBJZiAndGhpcycgaXMgdW5kZWZpbmVkIGluIHRoZSBjYWxsLCB0aGVuIGl0IGRlZmF1bHRzIHRvIHRoZSBnbG9iYWxcbiAgICAgICAgICAvLyAndGhpcycuXG4gICAgICAgICAgaWYgKHRoaXMgJiYgdGhpcy5wcm9tcHRGaWVsZHNXaXRoVmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMucHJvbXB0RmllbGRzV2l0aFZhbHVlLmFkZChwYXRoKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfTtcbiAgICAgIH0sXG4gICAgICBtZXRhU2NoZW1hOiB7XG4gICAgICAgIG9uZU9mOiBbXG4gICAgICAgICAgeyB0eXBlOiAnc3RyaW5nJyB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAndHlwZSc6IHsgdHlwZTogJ3N0cmluZycgfSxcbiAgICAgICAgICAgICAgJ21lc3NhZ2UnOiB7IHR5cGU6ICdzdHJpbmcnIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgYWRkaXRpb25hbFByb3BlcnRpZXM6IHRydWUsXG4gICAgICAgICAgICByZXF1aXJlZDogWyAnbWVzc2FnZScgXSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgX2FwcGx5UHJvbXB0czxUPihkYXRhOiBULCBwcm9tcHRzOiBBcnJheTxQcm9tcHREZWZpbml0aW9uPik6IE9ic2VydmFibGU8VD4ge1xuICAgIGNvbnN0IHByb3ZpZGVyID0gdGhpcy5fcHJvbXB0UHJvdmlkZXI7XG4gICAgaWYgKCFwcm92aWRlcikge1xuICAgICAgcmV0dXJuIG9mKGRhdGEpO1xuICAgIH1cblxuICAgIHByb21wdHMuc29ydCgoYSwgYikgPT4gYi5wcmlvcml0eSAtIGEucHJpb3JpdHkpO1xuXG4gICAgcmV0dXJuIGZyb20ocHJvdmlkZXIocHJvbXB0cykpLnBpcGUoXG4gICAgICBtYXAoYW5zd2VycyA9PiB7XG4gICAgICAgIGZvciAoY29uc3QgcGF0aCBpbiBhbnN3ZXJzKSB7XG4gICAgICAgICAgY29uc3QgcGF0aEZyYWdtZW50cyA9IHBhdGguc3BsaXQoJy8nKS5tYXAocGYgPT4ge1xuICAgICAgICAgICAgaWYgKC9eXFxkKyQvLnRlc3QocGYpKSB7XG4gICAgICAgICAgICAgIHJldHVybiBwZjtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHJldHVybiAnXFwnJyArIHBmICsgJ1xcJyc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICBDb3JlU2NoZW1hUmVnaXN0cnkuX3NldChcbiAgICAgICAgICAgIGRhdGEsXG4gICAgICAgICAgICBwYXRoRnJhZ21lbnRzLnNsaWNlKDEpLFxuICAgICAgICAgICAgYW5zd2Vyc1twYXRoXSBhcyB7fSxcbiAgICAgICAgICAgIG51bGwsXG4gICAgICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgICAgICB0cnVlLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZGF0YTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBwcml2YXRlIHN0YXRpYyBfc2V0KFxuICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby1hbnlcbiAgICBkYXRhOiBhbnksXG4gICAgZnJhZ21lbnRzOiBzdHJpbmdbXSxcbiAgICB2YWx1ZToge30sXG4gICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWFueVxuICAgIHBhcmVudDogYW55IHwgbnVsbCA9IG51bGwsXG4gICAgcGFyZW50UHJvcGVydHk/OiBzdHJpbmcsXG4gICAgZm9yY2U/OiBib29sZWFuLFxuICApOiB2b2lkIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGZyYWdtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgZiA9IGZyYWdtZW50c1tpXTtcblxuICAgICAgaWYgKGZbMF0gPT0gJ2knKSB7XG4gICAgICAgIGlmICghQXJyYXkuaXNBcnJheShkYXRhKSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgZGF0YS5sZW5ndGg7IGorKykge1xuICAgICAgICAgIENvcmVTY2hlbWFSZWdpc3RyeS5fc2V0KGRhdGFbal0sIGZyYWdtZW50cy5zbGljZShpICsgMSksIHZhbHVlLCBkYXRhLCAnJyArIGopO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuO1xuICAgICAgfSBlbHNlIGlmIChmLnN0YXJ0c1dpdGgoJ2tleScpKSB7XG4gICAgICAgIGlmICh0eXBlb2YgZGF0YSAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhkYXRhKS5mb3JFYWNoKHByb3BlcnR5ID0+IHtcbiAgICAgICAgICBDb3JlU2NoZW1hUmVnaXN0cnkuX3NldChkYXRhW3Byb3BlcnR5XSwgZnJhZ21lbnRzLnNsaWNlKGkgKyAxKSwgdmFsdWUsIGRhdGEsIHByb3BlcnR5KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuO1xuICAgICAgfSBlbHNlIGlmIChmLnN0YXJ0c1dpdGgoJ1xcJycpICYmIGZbZi5sZW5ndGggLSAxXSA9PSAnXFwnJykge1xuICAgICAgICBjb25zdCBwcm9wZXJ0eSA9IGZcbiAgICAgICAgICAuc2xpY2UoMSwgLTEpXG4gICAgICAgICAgLnJlcGxhY2UoL1xcXFwnL2csICdcXCcnKVxuICAgICAgICAgIC5yZXBsYWNlKC9cXFxcbi9nLCAnXFxuJylcbiAgICAgICAgICAucmVwbGFjZSgvXFxcXHIvZywgJ1xccicpXG4gICAgICAgICAgLnJlcGxhY2UoL1xcXFxmL2csICdcXGYnKVxuICAgICAgICAgIC5yZXBsYWNlKC9cXFxcdC9nLCAnXFx0Jyk7XG5cbiAgICAgICAgLy8gV2Uga25vdyB3ZSBuZWVkIGFuIG9iamVjdCBiZWNhdXNlIHRoZSBmcmFnbWVudCBpcyBhIHByb3BlcnR5IGtleS5cbiAgICAgICAgaWYgKCFkYXRhICYmIHBhcmVudCAhPT0gbnVsbCAmJiBwYXJlbnRQcm9wZXJ0eSkge1xuICAgICAgICAgIGRhdGEgPSBwYXJlbnRbcGFyZW50UHJvcGVydHldID0ge307XG4gICAgICAgIH1cbiAgICAgICAgcGFyZW50ID0gZGF0YTtcbiAgICAgICAgcGFyZW50UHJvcGVydHkgPSBwcm9wZXJ0eTtcblxuICAgICAgICBkYXRhID0gZGF0YVtwcm9wZXJ0eV07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBhcmVudCAmJiBwYXJlbnRQcm9wZXJ0eSAmJiAoZm9yY2UgfHwgcGFyZW50W3BhcmVudFByb3BlcnR5XSA9PT0gdW5kZWZpbmVkKSkge1xuICAgICAgcGFyZW50W3BhcmVudFByb3BlcnR5XSA9IHZhbHVlO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2FwcGx5U21hcnREZWZhdWx0czxUPihcbiAgICBkYXRhOiBULFxuICAgIHNtYXJ0RGVmYXVsdHM6IE1hcDxzdHJpbmcsIEpzb25PYmplY3Q+LFxuICApOiBPYnNlcnZhYmxlPFQ+IHtcbiAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tYW55IGh0dHBzOi8vZ2l0aHViLmNvbS9SZWFjdGl2ZVgvcnhqcy9pc3N1ZXMvMzk4OVxuICAgIHJldHVybiAob2YoZGF0YSkgYXMgYW55KS5waXBlKFxuICAgICAgLi4uWy4uLnNtYXJ0RGVmYXVsdHMuZW50cmllcygpXS5tYXAoKFtwb2ludGVyLCBzY2hlbWFdKSA9PiB7XG4gICAgICAgIHJldHVybiBjb25jYXRNYXA8VCwgVD4oZGF0YSA9PiB7XG4gICAgICAgICAgY29uc3QgZnJhZ21lbnRzID0gSlNPTi5wYXJzZShwb2ludGVyKTtcbiAgICAgICAgICBjb25zdCBzb3VyY2UgPSB0aGlzLl9zb3VyY2VNYXAuZ2V0KChzY2hlbWEgYXMgSnNvbk9iamVjdCkuJHNvdXJjZSBhcyBzdHJpbmcpO1xuXG4gICAgICAgICAgbGV0IHZhbHVlID0gc291cmNlID8gc291cmNlKHNjaGVtYSkgOiBvZih1bmRlZmluZWQpO1xuXG4gICAgICAgICAgaWYgKCFpc09ic2VydmFibGUodmFsdWUpKSB7XG4gICAgICAgICAgICB2YWx1ZSA9IG9mKHZhbHVlKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gKHZhbHVlIGFzIE9ic2VydmFibGU8e30+KS5waXBlKFxuICAgICAgICAgICAgLy8gU3luY2hyb25vdXNseSBzZXQgdGhlIG5ldyBkYXRhIGF0IHRoZSBwcm9wZXIgSnNvblNjaGVtYSBwYXRoLlxuICAgICAgICAgICAgdGFwKHggPT4gQ29yZVNjaGVtYVJlZ2lzdHJ5Ll9zZXQoZGF0YSwgZnJhZ21lbnRzLCB4KSksXG4gICAgICAgICAgICAvLyBCdXQgcmV0dXJuIHRoZSBkYXRhIG9iamVjdC5cbiAgICAgICAgICAgIG1hcCgoKSA9PiBkYXRhKSxcbiAgICAgICAgICApO1xuICAgICAgICB9KTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cbn1cbiJdfQ==