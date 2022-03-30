"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoreSchemaRegistry = exports.SchemaValidationException = void 0;
const ajv_1 = __importDefault(require("ajv"));
const ajv_formats_1 = __importDefault(require("ajv-formats"));
const http = __importStar(require("http"));
const https = __importStar(require("https"));
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const Url = __importStar(require("url"));
const exception_1 = require("../../exception");
const utils_1 = require("../../utils");
const utils_2 = require("../utils");
const utility_1 = require("./utility");
const visitor_1 = require("./visitor");
class SchemaValidationException extends exception_1.BaseException {
    constructor(errors, baseMessage = 'Schema validation failed with the following errors:') {
        if (!errors || errors.length === 0) {
            super('Schema validation failed.');
            this.errors = [];
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
            var _a;
            let message = `Data path ${JSON.stringify(err.instancePath)} ${err.message}`;
            if (err.params) {
                switch (err.keyword) {
                    case 'additionalProperties':
                        message += `(${err.params.additionalProperty})`;
                        break;
                    case 'enum':
                        message += `. Allowed values are: ${(_a = err.params.allowedValues) === null || _a === void 0 ? void 0 : _a.map((v) => `"${v}"`).join(', ')}`;
                        break;
                }
            }
            return message + '.';
        });
        return messages;
    }
}
exports.SchemaValidationException = SchemaValidationException;
class CoreSchemaRegistry {
    constructor(formats = []) {
        this._uriCache = new Map();
        this._uriHandlers = new Set();
        this._pre = new utils_1.PartiallyOrderedSet();
        this._post = new utils_1.PartiallyOrderedSet();
        this._smartDefaultKeyword = false;
        this._sourceMap = new Map();
        this._ajv = new ajv_1.default({
            strict: false,
            loadSchema: (uri) => this._fetch(uri),
            passContext: true,
        });
        (0, ajv_formats_1.default)(this._ajv);
        for (const format of formats) {
            this.addFormat(format);
        }
    }
    async _fetch(uri) {
        const maybeSchema = this._uriCache.get(uri);
        if (maybeSchema) {
            return maybeSchema;
        }
        // Try all handlers, one after the other.
        for (const handler of this._uriHandlers) {
            let handlerResult = handler(uri);
            if (handlerResult === null || handlerResult === undefined) {
                continue;
            }
            if ((0, rxjs_1.isObservable)(handlerResult)) {
                handlerResult = handlerResult.toPromise();
            }
            const value = await handlerResult;
            this._uriCache.set(uri, value);
            return value;
        }
        // If none are found, handle using http client.
        return new Promise((resolve, reject) => {
            const url = new Url.URL(uri);
            const client = url.protocol === 'https:' ? https : http;
            client.get(url, (res) => {
                if (!res.statusCode || res.statusCode >= 300) {
                    // Consume the rest of the data to free memory.
                    res.resume();
                    reject(new Error(`Request failed. Status Code: ${res.statusCode}`));
                }
                else {
                    res.setEncoding('utf8');
                    let data = '';
                    res.on('data', (chunk) => {
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
        if (!validate || !ref) {
            return {};
        }
        const schema = validate.schemaEnv.root.schema;
        const id = typeof schema === 'object' ? schema.$id : null;
        let fullReference = ref;
        if (typeof id === 'string') {
            fullReference = Url.resolve(id, ref);
            if (ref.startsWith('#')) {
                fullReference = id + fullReference;
            }
        }
        const resolvedSchema = this._ajv.getSchema(fullReference);
        return {
            context: resolvedSchema === null || resolvedSchema === void 0 ? void 0 : resolvedSchema.schemaEnv.validate,
            schema: resolvedSchema === null || resolvedSchema === void 0 ? void 0 : resolvedSchema.schema,
        };
    }
    /**
     * Flatten the Schema, resolving and replacing all the refs. Makes it into a synchronous schema
     * that is also easier to traverse. Does not cache the result.
     *
     * @param schema The schema or URI to flatten.
     * @returns An Observable of the flattened schema object.
     * @deprecated since 11.2 without replacement.
     * Producing a flatten schema document does not in all cases produce a schema with identical behavior to the original.
     * See: https://json-schema.org/draft/2019-09/json-schema-core.html#rfc.appendix.B.2
     */
    flatten(schema) {
        return (0, rxjs_1.from)(this._flatten(schema));
    }
    async _flatten(schema) {
        this._ajv.removeSchema(schema);
        this._currentCompilationSchemaInfo = undefined;
        const validate = await this._ajv.compileAsync(schema);
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;
        function visitor(current, pointer, parentSchema, index) {
            if (current &&
                parentSchema &&
                index &&
                (0, utils_2.isJsonObject)(current) &&
                Object.prototype.hasOwnProperty.call(current, '$ref') &&
                typeof current['$ref'] == 'string') {
                const resolved = self._resolver(current['$ref'], validate);
                if (resolved.schema) {
                    parentSchema[index] = resolved.schema;
                }
            }
        }
        const schemaCopy = (0, utils_1.deepCopy)(validate.schema);
        (0, visitor_1.visitJsonSchema)(schemaCopy, visitor);
        return schemaCopy;
    }
    /**
     * Compile and return a validation function for the Schema.
     *
     * @param schema The schema to validate. If a string, will fetch the schema before compiling it
     * (using schema as a URI).
     * @returns An Observable of the Validation function.
     */
    compile(schema) {
        return (0, rxjs_1.from)(this._compile(schema)).pipe((0, operators_1.map)((validate) => (value, options) => (0, rxjs_1.from)(validate(value, options))));
    }
    async _compile(schema) {
        if (typeof schema === 'boolean') {
            return async (data) => ({ success: schema, data });
        }
        const schemaInfo = {
            smartDefaultRecord: new Map(),
            promptDefinitions: [],
        };
        this._ajv.removeSchema(schema);
        let validator;
        try {
            this._currentCompilationSchemaInfo = schemaInfo;
            validator = this._ajv.compile(schema);
        }
        catch (e) {
            // This should eventually be refactored so that we we handle race condition where the same schema is validated at the same time.
            if (!(e instanceof ajv_1.default.MissingRefError)) {
                throw e;
            }
            validator = await this._ajv.compileAsync(schema);
        }
        finally {
            this._currentCompilationSchemaInfo = undefined;
        }
        return async (data, options) => {
            var _a;
            const validationOptions = {
                withPrompts: true,
                applyPostTransforms: true,
                applyPreTransforms: true,
                ...options,
            };
            const validationContext = {
                promptFieldsWithValue: new Set(),
            };
            // Apply pre-validation transforms
            if (validationOptions.applyPreTransforms) {
                for (const visitor of this._pre.values()) {
                    data = await (0, visitor_1.visitJson)(data, visitor, schema, this._resolver.bind(this), validator).toPromise();
                }
            }
            // Apply smart defaults
            await this._applySmartDefaults(data, schemaInfo.smartDefaultRecord);
            // Apply prompts
            if (validationOptions.withPrompts) {
                const visitor = (value, pointer) => {
                    if (value !== undefined) {
                        validationContext.promptFieldsWithValue.add(pointer);
                    }
                    return value;
                };
                if (typeof schema === 'object') {
                    await (0, visitor_1.visitJson)(data, visitor, schema, this._resolver.bind(this), validator).toPromise();
                }
                const definitions = schemaInfo.promptDefinitions.filter((def) => !validationContext.promptFieldsWithValue.has(def.id));
                if (definitions.length > 0) {
                    await this._applyPrompts(data, definitions);
                }
            }
            // Validate using ajv
            try {
                const success = await validator.call(validationContext, data);
                if (!success) {
                    return { data, success, errors: (_a = validator.errors) !== null && _a !== void 0 ? _a : [] };
                }
            }
            catch (error) {
                if (error instanceof ajv_1.default.ValidationError) {
                    return { data, success: false, errors: error.errors };
                }
                throw error;
            }
            // Apply post-validation transforms
            if (validationOptions.applyPostTransforms) {
                for (const visitor of this._post.values()) {
                    data = await (0, visitor_1.visitJson)(data, visitor, schema, this._resolver.bind(this), validator).toPromise();
                }
            }
            return { data, success: true };
        };
    }
    addFormat(format) {
        this._ajv.addFormat(format.name, format.formatter);
    }
    addSmartDefaultProvider(source, provider) {
        if (this._sourceMap.has(source)) {
            throw new Error(source);
        }
        this._sourceMap.set(source, provider);
        if (!this._smartDefaultKeyword) {
            this._smartDefaultKeyword = true;
            this._ajv.addKeyword({
                keyword: '$default',
                errors: false,
                valid: true,
                compile: (schema, _parentSchema, it) => {
                    const compilationSchemInfo = this._currentCompilationSchemaInfo;
                    if (compilationSchemInfo === undefined) {
                        return () => true;
                    }
                    // We cheat, heavily.
                    const pathArray = this.normalizeDataPathArr(it);
                    compilationSchemInfo.smartDefaultRecord.set(JSON.stringify(pathArray), schema);
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
        this._ajv.addKeyword({
            keyword: 'x-prompt',
            errors: false,
            valid: true,
            compile: (schema, parentSchema, it) => {
                const compilationSchemInfo = this._currentCompilationSchemaInfo;
                if (!compilationSchemInfo) {
                    return () => true;
                }
                const path = '/' + this.normalizeDataPathArr(it).join('/');
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
                const propertyTypes = (0, utility_1.getTypesOfSchema)(parentSchema);
                if (!type) {
                    if (propertyTypes.size === 1 && propertyTypes.has('boolean')) {
                        type = 'confirmation';
                    }
                    else if (Array.isArray(parentSchema.enum)) {
                        type = 'list';
                    }
                    else if (propertyTypes.size === 1 &&
                        propertyTypes.has('array') &&
                        parentSchema.items &&
                        Array.isArray(parentSchema.items.enum)) {
                        type = 'list';
                    }
                    else {
                        type = 'input';
                    }
                }
                let multiselect;
                if (type === 'list') {
                    multiselect =
                        schema.multiselect === undefined
                            ? propertyTypes.size === 1 && propertyTypes.has('array')
                            : schema.multiselect;
                    const enumValues = multiselect
                        ? parentSchema.items &&
                            parentSchema.items.enum
                        : parentSchema.enum;
                    if (!items && Array.isArray(enumValues)) {
                        items = [];
                        for (const value of enumValues) {
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
                    raw: schema,
                    items,
                    multiselect,
                    propertyTypes,
                    default: typeof parentSchema.default == 'object' &&
                        parentSchema.default !== null &&
                        !Array.isArray(parentSchema.default)
                        ? undefined
                        : parentSchema.default,
                    async validator(data) {
                        var _a;
                        try {
                            const result = await it.self.validate(parentSchema, data);
                            // If the schema is sync then false will be returned on validation failure
                            if (result) {
                                return result;
                            }
                            else if ((_a = it.self.errors) === null || _a === void 0 ? void 0 : _a.length) {
                                // Validation errors will be present on the Ajv instance when sync
                                return it.self.errors[0].message;
                            }
                        }
                        catch (e) {
                            // If the schema is async then an error will be thrown on validation failure
                            if (Array.isArray(e.errors) && e.errors.length) {
                                return e.errors[0].message;
                            }
                        }
                        return false;
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
    async _applyPrompts(data, prompts) {
        const provider = this._promptProvider;
        if (!provider) {
            return;
        }
        const answers = await (0, rxjs_1.from)(provider(prompts)).toPromise();
        for (const path in answers) {
            const pathFragments = path.split('/').slice(1);
            CoreSchemaRegistry._set(data, pathFragments, answers[path], null, undefined, true);
        }
    }
    static _set(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data, fragments, value, 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parent = null, parentProperty, force) {
        for (let index = 0; index < fragments.length; index++) {
            const fragment = fragments[index];
            if (/^i\d+$/.test(fragment)) {
                if (!Array.isArray(data)) {
                    return;
                }
                for (let dataIndex = 0; dataIndex < data.length; dataIndex++) {
                    CoreSchemaRegistry._set(data[dataIndex], fragments.slice(index + 1), value, data, `${dataIndex}`);
                }
                return;
            }
            if (!data && parent !== null && parentProperty) {
                data = parent[parentProperty] = {};
            }
            parent = data;
            parentProperty = fragment;
            data = data[fragment];
        }
        if (parent && parentProperty && (force || parent[parentProperty] === undefined)) {
            parent[parentProperty] = value;
        }
    }
    async _applySmartDefaults(data, smartDefaults) {
        for (const [pointer, schema] of smartDefaults.entries()) {
            const fragments = JSON.parse(pointer);
            const source = this._sourceMap.get(schema.$source);
            if (!source) {
                continue;
            }
            let value = source(schema);
            if ((0, rxjs_1.isObservable)(value)) {
                value = await value.toPromise();
            }
            CoreSchemaRegistry._set(data, fragments, value);
        }
    }
    useXDeprecatedProvider(onUsage) {
        this._ajv.addKeyword({
            keyword: 'x-deprecated',
            validate: (schema, _data, _parentSchema, dataCxt) => {
                if (schema) {
                    onUsage(`Option "${dataCxt === null || dataCxt === void 0 ? void 0 : dataCxt.parentDataProperty}" is deprecated${typeof schema == 'string' ? ': ' + schema : '.'}`);
                }
                return true;
            },
            errors: false,
        });
    }
    normalizeDataPathArr(it) {
        return it.dataPathArr
            .slice(1, it.dataLevel + 1)
            .map((p) => (typeof p === 'number' ? p : p.str.replace(/"/g, '')));
    }
}
exports.CoreSchemaRegistry = CoreSchemaRegistry;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVnaXN0cnkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9jb3JlL3NyYy9qc29uL3NjaGVtYS9yZWdpc3RyeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILDhDQUEwRDtBQUMxRCw4REFBd0M7QUFDeEMsMkNBQTZCO0FBQzdCLDZDQUErQjtBQUMvQiwrQkFBc0Q7QUFDdEQsOENBQXFDO0FBQ3JDLHlDQUEyQjtBQUMzQiwrQ0FBZ0Q7QUFDaEQsdUNBQTREO0FBQzVELG9DQUEwRTtBQWUxRSx1Q0FBNkM7QUFDN0MsdUNBQXVEO0FBTXZELE1BQWEseUJBQTBCLFNBQVEseUJBQWE7SUFHMUQsWUFDRSxNQUErQixFQUMvQixXQUFXLEdBQUcscURBQXFEO1FBRW5FLElBQUksQ0FBQyxNQUFNLElBQUksTUFBTSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7WUFDbEMsS0FBSyxDQUFDLDJCQUEyQixDQUFDLENBQUM7WUFDbkMsSUFBSSxDQUFDLE1BQU0sR0FBRyxFQUFFLENBQUM7WUFFakIsT0FBTztTQUNSO1FBRUQsTUFBTSxRQUFRLEdBQUcseUJBQXlCLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ2xFLEtBQUssQ0FBQyxHQUFHLFdBQVcsT0FBTyxRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNwRCxJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztJQUN2QixDQUFDO0lBRU0sTUFBTSxDQUFDLGNBQWMsQ0FBQyxNQUErQjtRQUMxRCxJQUFJLENBQUMsTUFBTSxJQUFJLE1BQU0sQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1lBQ2xDLE9BQU8sRUFBRSxDQUFDO1NBQ1g7UUFFRCxNQUFNLFFBQVEsR0FBRyxNQUFNLENB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S0FBSyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQzthQUMxQixHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDdkUsQ0FBQztDQUNGO0FBOWtCRCxnREE4a0JDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCBBanYsIHsgU2NoZW1hT2JqQ3h0LCBWYWxpZGF0ZUZ1bmN0aW9uIH0gZnJvbSAnYWp2JztcbmltcG9ydCBhanZBZGRGb3JtYXRzIGZyb20gJ2Fqdi1mb3JtYXRzJztcbmltcG9ydCAqIGFzIGh0dHAgZnJvbSAnaHR0cCc7XG5pbXBvcnQgKiBhcyBodHRwcyBmcm9tICdodHRwcyc7XG5pbXBvcnQgeyBPYnNlcnZhYmxlLCBmcm9tLCBpc09ic2VydmFibGUgfSBmcm9tICdyeGpzJztcbmltcG9ydCB7IG1hcCB9IGZyb20gJ3J4anMvb3BlcmF0b3JzJztcbmltcG9ydCAqIGFzIFVybCBmcm9tICd1cmwnO1xuaW1wb3J0IHsgQmFzZUV4Y2VwdGlvbiB9IGZyb20gJy4uLy4uL2V4Y2VwdGlvbic7XG5pbXBvcnQgeyBQYXJ0aWFsbHlPcmRlcmVkU2V0LCBkZWVwQ29weSB9IGZyb20gJy4uLy4uL3V0aWxzJztcbmltcG9ydCB7IEpzb25BcnJheSwgSnNvbk9iamVjdCwgSnNvblZhbHVlLCBpc0pzb25PYmplY3QgfSBmcm9tICcuLi91dGlscyc7XG5pbXBvcnQge1xuICBKc29uUG9pbnRlcixcbiAgSnNvblZpc2l0b3IsXG4gIFByb21wdERlZmluaXRpb24sXG4gIFByb21wdFByb3ZpZGVyLFxuICBTY2hlbWFGb3JtYXQsXG4gIFNjaGVtYVJlZ2lzdHJ5LFxuICBTY2hlbWFWYWxpZGF0b3IsXG4gIFNjaGVtYVZhbGlkYXRvckVycm9yLFxuICBTY2hlbWFWYWxpZGF0b3JPcHRpb25zLFxuICBTY2hlbWFWYWxpZGF0b3JSZXN1bHQsXG4gIFNtYXJ0RGVmYXVsdFByb3ZpZGVyLFxufSBmcm9tICcuL2ludGVyZmFjZSc7XG5pbXBvcnQgeyBKc29uU2NoZW1hIH0gZnJvbSAnLi9zY2hlbWEnO1xuaW1wb3J0IHsgZ2V0VHlwZXNPZlNjaGVtYSB9IGZyb20gJy4vdXRpbGl0eSc7XG5pbXBvcnQgeyB2aXNpdEpzb24sIHZpc2l0SnNvblNjaGVtYSB9IGZyb20gJy4vdmlzaXRvcic7XG5cbmV4cG9ydCB0eXBlIFVyaUhhbmRsZXIgPSAoXG4gIHVyaTogc3RyaW5nLFxuKSA9PiBPYnNlcnZhYmxlPEpzb25PYmplY3Q+IHwgUHJvbWlzZTxKc29uT2JqZWN0PiB8IG51bGwgfCB1bmRlZmluZWQ7XG5cbmV4cG9ydCBjbGFzcyBTY2hlbWFWYWxpZGF0aW9uRXhjZXB0aW9uIGV4dGVuZHMgQmFzZUV4Y2VwdGlvbiB7XG4gIHB1YmxpYyByZWFkb25seSBlcnJvcnM6IFNjaGVtYVZhbGlkYXRvckVycm9yW107XG5cbiAgY29uc3RydWN0b3IoXG4gICAgZXJyb3JzPzogU2NoZW1hVmFsaWRhdG9yRXJyb3JbXSxcbiAgICBiYXNlTWVzc2FnZSA9ICdTY2hlbWEgdmFsaWRhdGlvbiBmYWlsZWQgd2l0aCB0aGUgZm9sbG93aW5nIGVycm9yczonLFxuICApIHtcbiAgICBpZiAoIWVycm9ycyB8fCBlcnJvcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICBzdXBlcignU2NoZW1hIHZhbGlkYXRpb24gZmFpbGVkLicpO1xuICAgICAgdGhpcy5lcnJvcnMgPSBbXTtcblxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IG1lc3NhZ2VzID0gU2NoZW1hVmFsaWRhdGlvbkV4Y2VwdGlvbi5jcmVhdGVNZXNzYWdlcyhlcnJvcnMpO1xuICAgIHN1cGVyKGAke2Jhc2VNZXNzYWdlfVxcbiAgJHttZXNzYWdlcy5qb2luKCdcXG4gICcpfWApO1xuICAgIHRoaXMuZXJyb3JzID0gZXJyb3JzO1xuICB9XG5cbiAgcHVibGljIHN0YXRpYyBjcmVhdGVNZXNzYWdlcyhlcnJvcnM/OiBTY2hlbWFWYWxpZGF0b3JFcnJvcltdKTogc3RyaW5nW10ge1xuICAgIGlmICghZXJyb3JzIHx8IGVycm9ycy5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICBjb25zdCBtZXNzYWdlcyA9IGVycm9ycy5tYXAoKGVycikgPT4ge1xuICAgICAgbGV0IG1lc3NhZ2UgPSBgRGF0YSBwYXRoICR7SlNPTi5zdHJpbmdpZnkoZXJyLmluc3RhbmNlUGF0aCl9ICR7ZXJyLm1lc3NhZ2V9YDtcbiAgICAgIGlmIChlcnIucGFyYW1zKSB7XG4gICAgICAgIHN3aXRjaCAoZXJyLmtleXdvcmQpIHtcbiAgICAgICAgICBjYXNlICdhZGRpdGlvbmFsUHJvcGVydGllcyc6XG4gICAgICAgICAgICBtZXNzYWdlICs9IGAoJHtlcnIucGFyYW1zLmFkZGl0aW9uYWxQcm9wZXJ0eX0pYDtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgY2FzZSAnZW51bSc6XG4gICAgICAgICAgICBtZXNzYWdlICs9IGAuIEFsbG93ZWQgdmFsdWVzIGFyZTogJHsoZXJyLnBhcmFtcy5hbGxvd2VkVmFsdWVzIGFzIHN0cmluZ1tdIHwgdW5kZWZpbmVkKVxuICAgICAgICAgICAgICA/Lm1hcCgodikgPT4gYFwiJHt2fVwiYClcbiAgICAgICAgICAgICAgLmpvaW4oJywgJyl9YDtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBtZXNzYWdlICsgJy4nO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIG1lc3NhZ2VzO1xuICB9XG59XG5cbmludGVyZmFjZSBTY2hlbWFJbmZvIHtcbiAgc21hcnREZWZhdWx0UmVjb3JkOiBNYXA8c3RyaW5nLCBKc29uT2JqZWN0PjtcbiAgcHJvbXB0RGVmaW5pdGlvbnM6IEFycmF5PFByb21wdERlZmluaXRpb24+O1xufVxuXG5leHBvcnQgY2xhc3MgQ29yZVNjaGVtYVJlZ2lzdHJ5IGltcGxlbWVudHMgU2NoZW1hUmVnaXN0cnkge1xuICBwcml2YXRlIF9hanY6IEFqdjtcbiAgcHJpdmF0ZSBfdXJpQ2FjaGUgPSBuZXcgTWFwPHN0cmluZywgSnNvbk9iamVjdD4oKTtcbiAgcHJpdmF0ZSBfdXJpSGFuZGxlcnMgPSBuZXcgU2V0PFVyaUhhbmRsZXI+KCk7XG4gIHByaXZhdGUgX3ByZSA9IG5ldyBQYXJ0aWFsbHlPcmRlcmVkU2V0PEpzb25WaXNpdG9yPigpO1xuICBwcml2YXRlIF9wb3N0ID0gbmV3IFBhcnRpYWxseU9yZGVyZWRTZXQ8SnNvblZpc2l0b3I+KCk7XG5cbiAgcHJpdmF0ZSBfY3VycmVudENvbXBpbGF0aW9uU2NoZW1hSW5mbz86IFNjaGVtYUluZm87XG5cbiAgcHJpdmF0ZSBfc21hcnREZWZhdWx0S2V5d29yZCA9IGZhbHNlO1xuICBwcml2YXRlIF9wcm9tcHRQcm92aWRlcj86IFByb21wdFByb3ZpZGVyO1xuICBwcml2YXRlIF9zb3VyY2VNYXAgPSBuZXcgTWFwPHN0cmluZywgU21hcnREZWZhdWx0UHJvdmlkZXI8e30+PigpO1xuXG4gIGNvbnN0cnVjdG9yKGZvcm1hdHM6IFNjaGVtYUZvcm1hdFtdID0gW10pIHtcbiAgICB0aGlzLl9hanYgPSBuZXcgQWp2KHtcbiAgICAgIHN0cmljdDogZmFsc2UsXG4gICAgICBsb2FkU2NoZW1hOiAodXJpOiBzdHJpbmcpID0+IHRoaXMuX2ZldGNoKHVyaSksXG4gICAgICBwYXNzQ29udGV4dDogdHJ1ZSxcbiAgICB9KTtcblxuICAgIGFqdkFkZEZvcm1hdHModGhpcy5fYWp2KTtcblxuICAgIGZvciAoY29uc3QgZm9ybWF0IG9mIGZvcm1hdHMpIHtcbiAgICAgIHRoaXMuYWRkRm9ybWF0KGZvcm1hdCk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBfZmV0Y2godXJpOiBzdHJpbmcpOiBQcm9taXNlPEpzb25PYmplY3Q+IHtcbiAgICBjb25zdCBtYXliZVNjaGVtYSA9IHRoaXMuX3VyaUNhY2hlLmdldCh1cmkpO1xuXG4gICAgaWYgKG1heWJlU2NoZW1hKSB7XG4gICAgICByZXR1cm4gbWF5YmVTY2hlbWE7XG4gICAgfVxuXG4gICAgLy8gVHJ5IGFsbCBoYW5kbGVycywgb25lIGFmdGVyIHRoZSBvdGhlci5cbiAgICBmb3IgKGNvbnN0IGhhbmRsZXIgb2YgdGhpcy5fdXJpSGFuZGxlcnMpIHtcbiAgICAgIGxldCBoYW5kbGVyUmVzdWx0ID0gaGFuZGxlcih1cmkpO1xuICAgICAgaWYgKGhhbmRsZXJSZXN1bHQgPT09IG51bGwgfHwgaGFuZGxlclJlc3VsdCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoaXNPYnNlcnZhYmxlKGhhbmRsZXJSZXN1bHQpKSB7XG4gICAgICAgIGhhbmRsZXJSZXN1bHQgPSBoYW5kbGVyUmVzdWx0LnRvUHJvbWlzZSgpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCB2YWx1ZSA9IGF3YWl0IGhhbmRsZXJSZXN1bHQ7XG4gICAgICB0aGlzLl91cmlDYWNoZS5zZXQodXJpLCB2YWx1ZSk7XG5cbiAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG5cbiAgICAvLyBJZiBub25lIGFyZSBmb3VuZCwgaGFuZGxlIHVzaW5nIGh0dHAgY2xpZW50LlxuICAgIHJldHVybiBuZXcgUHJvbWlzZTxKc29uT2JqZWN0PigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBjb25zdCB1cmwgPSBuZXcgVXJsLlVSTCh1cmkpO1xuICAgICAgY29uc3QgY2xpZW50ID0gdXJsLnByb3RvY29sID09PSAnaHR0cHM6JyA/IGh0dHBzIDogaHR0cDtcbiAgICAgIGNsaWVudC5nZXQodXJsLCAocmVzKSA9PiB7XG4gICAgICAgIGlmICghcmVzLnN0YXR1c0NvZGUgfHwgcmVzLnN0YXR1c0NvZGUgPj0gMzAwKSB7XG4gICAgICAgICAgLy8gQ29uc3VtZSB0aGUgcmVzdCBvZiB0aGUgZGF0YSB0byBmcmVlIG1lbW9yeS5cbiAgICAgICAgICByZXMucmVzdW1lKCk7XG4gICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihgUmVxdWVzdCBmYWlsZWQuIFN0YXR1cyBDb2RlOiAke3Jlcy5zdGF0dXNDb2RlfWApKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXMuc2V0RW5jb2RpbmcoJ3V0ZjgnKTtcbiAgICAgICAgICBsZXQgZGF0YSA9ICcnO1xuICAgICAgICAgIHJlcy5vbignZGF0YScsIChjaHVuaykgPT4ge1xuICAgICAgICAgICAgZGF0YSArPSBjaHVuaztcbiAgICAgICAgICB9KTtcbiAgICAgICAgICByZXMub24oJ2VuZCcsICgpID0+IHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGNvbnN0IGpzb24gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgICAgICAgICAgICB0aGlzLl91cmlDYWNoZS5zZXQodXJpLCBqc29uKTtcbiAgICAgICAgICAgICAgcmVzb2x2ZShqc29uKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQWRkIGEgdHJhbnNmb3JtYXRpb24gc3RlcCBiZWZvcmUgdGhlIHZhbGlkYXRpb24gb2YgYW55IEpzb24uXG4gICAqIEBwYXJhbSB7SnNvblZpc2l0b3J9IHZpc2l0b3IgVGhlIHZpc2l0b3IgdG8gdHJhbnNmb3JtIGV2ZXJ5IHZhbHVlLlxuICAgKiBAcGFyYW0ge0pzb25WaXNpdG9yW119IGRlcHMgQSBsaXN0IG9mIG90aGVyIHZpc2l0b3JzIHRvIHJ1biBiZWZvcmUuXG4gICAqL1xuICBhZGRQcmVUcmFuc2Zvcm0odmlzaXRvcjogSnNvblZpc2l0b3IsIGRlcHM/OiBKc29uVmlzaXRvcltdKSB7XG4gICAgdGhpcy5fcHJlLmFkZCh2aXNpdG9yLCBkZXBzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGQgYSB0cmFuc2Zvcm1hdGlvbiBzdGVwIGFmdGVyIHRoZSB2YWxpZGF0aW9uIG9mIGFueSBKc29uLiBUaGUgSlNPTiB3aWxsIG5vdCBiZSB2YWxpZGF0ZWRcbiAgICogYWZ0ZXIgdGhlIFBPU1QsIHNvIGlmIHRyYW5zZm9ybWF0aW9ucyBhcmUgbm90IGNvbXBhdGlibGUgd2l0aCB0aGUgU2NoZW1hIGl0IHdpbGwgbm90IHJlc3VsdFxuICAgKiBpbiBhbiBlcnJvci5cbiAgICogQHBhcmFtIHtKc29uVmlzaXRvcn0gdmlzaXRvciBUaGUgdmlzaXRvciB0byB0cmFuc2Zvcm0gZXZlcnkgdmFsdWUuXG4gICAqIEBwYXJhbSB7SnNvblZpc2l0b3JbXX0gZGVwcyBBIGxpc3Qgb2Ygb3RoZXIgdmlzaXRvcnMgdG8gcnVuIGJlZm9yZS5cbiAgICovXG4gIGFkZFBvc3RUcmFuc2Zvcm0odmlzaXRvcjogSnNvblZpc2l0b3IsIGRlcHM/OiBKc29uVmlzaXRvcltdKSB7XG4gICAgdGhpcy5fcG9zdC5hZGQodmlzaXRvciwgZGVwcyk7XG4gIH1cblxuICBwcm90ZWN0ZWQgX3Jlc29sdmVyKFxuICAgIHJlZjogc3RyaW5nLFxuICAgIHZhbGlkYXRlPzogVmFsaWRhdGVGdW5jdGlvbixcbiAgKTogeyBjb250ZXh0PzogVmFsaWRhdGVGdW5jdGlvbjsgc2NoZW1hPzogSnNvbk9iamVjdCB9IHtcbiAgICBpZiAoIXZhbGlkYXRlIHx8ICFyZWYpIHtcbiAgICAgIHJldHVybiB7fTtcbiAgICB9XG5cbiAgICBjb25zdCBzY2hlbWEgPSB2YWxpZGF0ZS5zY2hlbWFFbnYucm9vdC5zY2hlbWE7XG4gICAgY29uc3QgaWQgPSB0eXBlb2Ygc2NoZW1hID09PSAnb2JqZWN0JyA/IHNjaGVtYS4kaWQgOiBudWxsO1xuXG4gICAgbGV0IGZ1bGxSZWZlcmVuY2UgPSByZWY7XG4gICAgaWYgKHR5cGVvZiBpZCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGZ1bGxSZWZlcmVuY2UgPSBVcmwucmVzb2x2ZShpZCwgcmVmKTtcblxuICAgICAgaWYgKHJlZi5zdGFydHNXaXRoKCcjJykpIHtcbiAgICAgICAgZnVsbFJlZmVyZW5jZSA9IGlkICsgZnVsbFJlZmVyZW5jZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCByZXNvbHZlZFNjaGVtYSA9IHRoaXMuX2Fqdi5nZXRTY2hlbWEoZnVsbFJlZmVyZW5jZSk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgY29udGV4dDogcmVzb2x2ZWRTY2hlbWE/LnNjaGVtYUVudi52YWxpZGF0ZSxcbiAgICAgIHNjaGVtYTogcmVzb2x2ZWRTY2hlbWE/LnNjaGVtYSBhcyBKc29uT2JqZWN0LFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogRmxhdHRlbiB0aGUgU2NoZW1hLCByZXNvbHZpbmcgYW5kIHJlcGxhY2luZyBhbGwgdGhlIHJlZnMuIE1ha2VzIGl0IGludG8gYSBzeW5jaHJvbm91cyBzY2hlbWFcbiAgICogdGhhdCBpcyBhbHNvIGVhc2llciB0byB0cmF2ZXJzZS4gRG9lcyBub3QgY2FjaGUgdGhlIHJlc3VsdC5cbiAgICpcbiAgICogQHBhcmFtIHNjaGVtYSBUaGUgc2NoZW1hIG9yIFVSSSB0byBmbGF0dGVuLlxuICAgKiBAcmV0dXJucyBBbiBPYnNlcnZhYmxlIG9mIHRoZSBmbGF0dGVuZWQgc2NoZW1hIG9iamVjdC5cbiAgICogQGRlcHJlY2F0ZWQgc2luY2UgMTEuMiB3aXRob3V0IHJlcGxhY2VtZW50LlxuICAgKiBQcm9kdWNpbmcgYSBmbGF0dGVuIHNjaGVtYSBkb2N1bWVudCBkb2VzIG5vdCBpbiBhbGwgY2FzZXMgcHJvZHVjZSBhIHNjaGVtYSB3aXRoIGlkZW50aWNhbCBiZWhhdmlvciB0byB0aGUgb3JpZ2luYWwuXG4gICAqIFNlZTogaHR0cHM6Ly9qc29uLXNjaGVtYS5vcmcvZHJhZnQvMjAxOS0wOS9qc29uLXNjaGVtYS1jb3JlLmh0bWwjcmZjLmFwcGVuZGl4LkIuMlxuICAgKi9cbiAgZmxhdHRlbihzY2hlbWE6IEpzb25PYmplY3QpOiBPYnNlcnZhYmxlPEpzb25PYmplY3Q+IHtcbiAgICByZXR1cm4gZnJvbSh0aGlzLl9mbGF0dGVuKHNjaGVtYSkpO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBfZmxhdHRlbihzY2hlbWE6IEpzb25PYmplY3QpOiBQcm9taXNlPEpzb25PYmplY3Q+IHtcbiAgICB0aGlzLl9hanYucmVtb3ZlU2NoZW1hKHNjaGVtYSk7XG5cbiAgICB0aGlzLl9jdXJyZW50Q29tcGlsYXRpb25TY2hlbWFJbmZvID0gdW5kZWZpbmVkO1xuICAgIGNvbnN0IHZhbGlkYXRlID0gYXdhaXQgdGhpcy5fYWp2LmNvbXBpbGVBc3luYyhzY2hlbWEpO1xuXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby10aGlzLWFsaWFzXG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgICBmdW5jdGlvbiB2aXNpdG9yKFxuICAgICAgY3VycmVudDogSnNvbk9iamVjdCB8IEpzb25BcnJheSxcbiAgICAgIHBvaW50ZXI6IEpzb25Qb2ludGVyLFxuICAgICAgcGFyZW50U2NoZW1hPzogSnNvbk9iamVjdCB8IEpzb25BcnJheSxcbiAgICAgIGluZGV4Pzogc3RyaW5nLFxuICAgICkge1xuICAgICAgaWYgKFxuICAgICAgICBjdXJyZW50ICYmXG4gICAgICAgIHBhcmVudFNjaGVtYSAmJlxuICAgICAgICBpbmRleCAmJlxuICAgICAgICBpc0pzb25PYmplY3QoY3VycmVudCkgJiZcbiAgICAgICAgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGN1cnJlbnQsICckcmVmJykgJiZcbiAgICAgICAgdHlwZW9mIGN1cnJlbnRbJyRyZWYnXSA9PSAnc3RyaW5nJ1xuICAgICAgKSB7XG4gICAgICAgIGNvbnN0IHJlc29sdmVkID0gc2VsZi5fcmVzb2x2ZXIoY3VycmVudFsnJHJlZiddLCB2YWxpZGF0ZSk7XG5cbiAgICAgICAgaWYgKHJlc29sdmVkLnNjaGVtYSkge1xuICAgICAgICAgIChwYXJlbnRTY2hlbWEgYXMgSnNvbk9iamVjdClbaW5kZXhdID0gcmVzb2x2ZWQuc2NoZW1hO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3Qgc2NoZW1hQ29weSA9IGRlZXBDb3B5KHZhbGlkYXRlLnNjaGVtYSBhcyBKc29uT2JqZWN0KTtcbiAgICB2aXNpdEpzb25TY2hlbWEoc2NoZW1hQ29weSwgdmlzaXRvcik7XG5cbiAgICByZXR1cm4gc2NoZW1hQ29weTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb21waWxlIGFuZCByZXR1cm4gYSB2YWxpZGF0aW9uIGZ1bmN0aW9uIGZvciB0aGUgU2NoZW1hLlxuICAgKlxuICAgKiBAcGFyYW0gc2NoZW1hIFRoZSBzY2hlbWEgdG8gdmFsaWRhdGUuIElmIGEgc3RyaW5nLCB3aWxsIGZldGNoIHRoZSBzY2hlbWEgYmVmb3JlIGNvbXBpbGluZyBpdFxuICAgKiAodXNpbmcgc2NoZW1hIGFzIGEgVVJJKS5cbiAgICogQHJldHVybnMgQW4gT2JzZXJ2YWJsZSBvZiB0aGUgVmFsaWRhdGlvbiBmdW5jdGlvbi5cbiAgICovXG4gIGNvbXBpbGUoc2NoZW1hOiBKc29uU2NoZW1hKTogT2JzZXJ2YWJsZTxTY2hlbWFWYWxpZGF0b3I+IHtcbiAgICByZXR1cm4gZnJvbSh0aGlzLl9jb21waWxlKHNjaGVtYSkpLnBpcGUoXG4gICAgICBtYXAoKHZhbGlkYXRlKSA9PiAodmFsdWUsIG9wdGlvbnMpID0+IGZyb20odmFsaWRhdGUodmFsdWUsIG9wdGlvbnMpKSksXG4gICAgKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgX2NvbXBpbGUoXG4gICAgc2NoZW1hOiBKc29uU2NoZW1hLFxuICApOiBQcm9taXNlPFxuICAgIChkYXRhOiBKc29uVmFsdWUsIG9wdGlvbnM/OiBTY2hlbWFWYWxpZGF0b3JPcHRpb25zKSA9PiBQcm9taXNlPFNjaGVtYVZhbGlkYXRvclJlc3VsdD5cbiAgPiB7XG4gICAgaWYgKHR5cGVvZiBzY2hlbWEgPT09ICdib29sZWFuJykge1xuICAgICAgcmV0dXJuIGFzeW5jIChkYXRhKSA9PiAoeyBzdWNjZXNzOiBzY2hlbWEsIGRhdGEgfSk7XG4gICAgfVxuXG4gICAgY29uc3Qgc2NoZW1hSW5mbzogU2NoZW1hSW5mbyA9IHtcbiAgICAgIHNtYXJ0RGVmYXVsdFJlY29yZDogbmV3IE1hcDxzdHJpbmcsIEpzb25PYmplY3Q+KCksXG4gICAgICBwcm9tcHREZWZpbml0aW9uczogW10sXG4gICAgfTtcblxuICAgIHRoaXMuX2Fqdi5yZW1vdmVTY2hlbWEoc2NoZW1hKTtcbiAgICBsZXQgdmFsaWRhdG9yOiBWYWxpZGF0ZUZ1bmN0aW9uO1xuXG4gICAgdHJ5IHtcbiAgICAgIHRoaXMuX2N1cnJlbnRDb21waWxhdGlvblNjaGVtYUluZm8gPSBzY2hlbWFJbmZvO1xuICAgICAgdmFsaWRhdG9yID0gdGhpcy5fYWp2LmNvbXBpbGUoc2NoZW1hKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAvLyBUaGlzIHNob3VsZCBldmVudHVhbGx5IGJlIHJlZmFjdG9yZWQgc28gdGhhdCB3ZSB3ZSBoYW5kbGUgcmFjZSBjb25kaXRpb24gd2hlcmUgdGhlIHNhbWUgc2NoZW1hIGlzIHZhbGlkYXRlZCBhdCB0aGUgc2FtZSB0aW1lLlxuICAgICAgaWYgKCEoZSBpbnN0YW5jZW9mIEFqdi5NaXNzaW5nUmVmRXJyb3IpKSB7XG4gICAgICAgIHRocm93IGU7XG4gICAgICB9XG5cbiAgICAgIHZhbGlkYXRvciA9IGF3YWl0IHRoaXMuX2Fqdi5jb21waWxlQXN5bmMoc2NoZW1hKTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgdGhpcy5fY3VycmVudENvbXBpbGF0aW9uU2NoZW1hSW5mbyA9IHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICByZXR1cm4gYXN5bmMgKGRhdGE6IEpzb25WYWx1ZSwgb3B0aW9ucz86IFNjaGVtYVZhbGlkYXRvck9wdGlvbnMpID0+IHtcbiAgICAgIGNvbnN0IHZhbGlkYXRpb25PcHRpb25zOiBTY2hlbWFWYWxpZGF0b3JPcHRpb25zID0ge1xuICAgICAgICB3aXRoUHJvbXB0czogdHJ1ZSxcbiAgICAgICAgYXBwbHlQb3N0VHJhbnNmb3JtczogdHJ1ZSxcbiAgICAgICAgYXBwbHlQcmVUcmFuc2Zvcm1zOiB0cnVlLFxuICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgfTtcbiAgICAgIGNvbnN0IHZhbGlkYXRpb25Db250ZXh0ID0ge1xuICAgICAgICBwcm9tcHRGaWVsZHNXaXRoVmFsdWU6IG5ldyBTZXQ8c3RyaW5nPigpLFxuICAgICAgfTtcblxuICAgICAgLy8gQXBwbHkgcHJlLXZhbGlkYXRpb24gdHJhbnNmb3Jtc1xuICAgICAgaWYgKHZhbGlkYXRpb25PcHRpb25zLmFwcGx5UHJlVHJhbnNmb3Jtcykge1xuICAgICAgICBmb3IgKGNvbnN0IHZpc2l0b3Igb2YgdGhpcy5fcHJlLnZhbHVlcygpKSB7XG4gICAgICAgICAgZGF0YSA9IGF3YWl0IHZpc2l0SnNvbihcbiAgICAgICAgICAgIGRhdGEsXG4gICAgICAgICAgICB2aXNpdG9yLFxuICAgICAgICAgICAgc2NoZW1hLFxuICAgICAgICAgICAgdGhpcy5fcmVzb2x2ZXIuYmluZCh0aGlzKSxcbiAgICAgICAgICAgIHZhbGlkYXRvcixcbiAgICAgICAgICApLnRvUHJvbWlzZSgpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIEFwcGx5IHNtYXJ0IGRlZmF1bHRzXG4gICAgICBhd2FpdCB0aGlzLl9hcHBseVNtYXJ0RGVmYXVsdHMoZGF0YSwgc2NoZW1hSW5mby5zbWFydERlZmF1bHRSZWNvcmQpO1xuXG4gICAgICAvLyBBcHBseSBwcm9tcHRzXG4gICAgICBpZiAodmFsaWRhdGlvbk9wdGlvbnMud2l0aFByb21wdHMpIHtcbiAgICAgICAgY29uc3QgdmlzaXRvcjogSnNvblZpc2l0b3IgPSAodmFsdWUsIHBvaW50ZXIpID0+IHtcbiAgICAgICAgICBpZiAodmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgdmFsaWRhdGlvbkNvbnRleHQucHJvbXB0RmllbGRzV2l0aFZhbHVlLmFkZChwb2ludGVyKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICAgIH07XG4gICAgICAgIGlmICh0eXBlb2Ygc2NoZW1hID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgIGF3YWl0IHZpc2l0SnNvbihkYXRhLCB2aXNpdG9yLCBzY2hlbWEsIHRoaXMuX3Jlc29sdmVyLmJpbmQodGhpcyksIHZhbGlkYXRvcikudG9Qcm9taXNlKCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBkZWZpbml0aW9ucyA9IHNjaGVtYUluZm8ucHJvbXB0RGVmaW5pdGlvbnMuZmlsdGVyKFxuICAgICAgICAgIChkZWYpID0+ICF2YWxpZGF0aW9uQ29udGV4dC5wcm9tcHRGaWVsZHNXaXRoVmFsdWUuaGFzKGRlZi5pZCksXG4gICAgICAgICk7XG5cbiAgICAgICAgaWYgKGRlZmluaXRpb25zLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICBhd2FpdCB0aGlzLl9hcHBseVByb21wdHMoZGF0YSwgZGVmaW5pdGlvbnMpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIFZhbGlkYXRlIHVzaW5nIGFqdlxuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3Qgc3VjY2VzcyA9IGF3YWl0IHZhbGlkYXRvci5jYWxsKHZhbGlkYXRpb25Db250ZXh0LCBkYXRhKTtcblxuICAgICAgICBpZiAoIXN1Y2Nlc3MpIHtcbiAgICAgICAgICByZXR1cm4geyBkYXRhLCBzdWNjZXNzLCBlcnJvcnM6IHZhbGlkYXRvci5lcnJvcnMgPz8gW10gfTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgaWYgKGVycm9yIGluc3RhbmNlb2YgQWp2LlZhbGlkYXRpb25FcnJvcikge1xuICAgICAgICAgIHJldHVybiB7IGRhdGEsIHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcnM6IGVycm9yLmVycm9ycyB9O1xuICAgICAgICB9XG5cbiAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICB9XG5cbiAgICAgIC8vIEFwcGx5IHBvc3QtdmFsaWRhdGlvbiB0cmFuc2Zvcm1zXG4gICAgICBpZiAodmFsaWRhdGlvbk9wdGlvbnMuYXBwbHlQb3N0VHJhbnNmb3Jtcykge1xuICAgICAgICBmb3IgKGNvbnN0IHZpc2l0b3Igb2YgdGhpcy5fcG9zdC52YWx1ZXMoKSkge1xuICAgICAgICAgIGRhdGEgPSBhd2FpdCB2aXNpdEpzb24oXG4gICAgICAgICAgICBkYXRhLFxuICAgICAgICAgICAgdmlzaXRvcixcbiAgICAgICAgICAgIHNjaGVtYSxcbiAgICAgICAgICAgIHRoaXMuX3Jlc29sdmVyLmJpbmQodGhpcyksXG4gICAgICAgICAgICB2YWxpZGF0b3IsXG4gICAgICAgICAgKS50b1Byb21pc2UoKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4geyBkYXRhLCBzdWNjZXNzOiB0cnVlIH07XG4gICAgfTtcbiAgfVxuXG4gIGFkZEZvcm1hdChmb3JtYXQ6IFNjaGVtYUZvcm1hdCk6IHZvaWQge1xuICAgIHRoaXMuX2Fqdi5hZGRGb3JtYXQoZm9ybWF0Lm5hbWUsIGZvcm1hdC5mb3JtYXR0ZXIpO1xuICB9XG5cbiAgYWRkU21hcnREZWZhdWx0UHJvdmlkZXI8VD4oc291cmNlOiBzdHJpbmcsIHByb3ZpZGVyOiBTbWFydERlZmF1bHRQcm92aWRlcjxUPikge1xuICAgIGlmICh0aGlzLl9zb3VyY2VNYXAuaGFzKHNvdXJjZSkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihzb3VyY2UpO1xuICAgIH1cblxuICAgIHRoaXMuX3NvdXJjZU1hcC5zZXQoc291cmNlLCBwcm92aWRlcik7XG5cbiAgICBpZiAoIXRoaXMuX3NtYXJ0RGVmYXVsdEtleXdvcmQpIHtcbiAgICAgIHRoaXMuX3NtYXJ0RGVmYXVsdEtleXdvcmQgPSB0cnVlO1xuXG4gICAgICB0aGlzLl9hanYuYWRkS2V5d29yZCh7XG4gICAgICAgIGtleXdvcmQ6ICckZGVmYXVsdCcsXG4gICAgICAgIGVycm9yczogZmFsc2UsXG4gICAgICAgIHZhbGlkOiB0cnVlLFxuICAgICAgICBjb21waWxlOiAoc2NoZW1hLCBfcGFyZW50U2NoZW1hLCBpdCkgPT4ge1xuICAgICAgICAgIGNvbnN0IGNvbXBpbGF0aW9uU2NoZW1JbmZvID0gdGhpcy5fY3VycmVudENvbXBpbGF0aW9uU2NoZW1hSW5mbztcbiAgICAgICAgICBpZiAoY29tcGlsYXRpb25TY2hlbUluZm8gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcmV0dXJuICgpID0+IHRydWU7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gV2UgY2hlYXQsIGhlYXZpbHkuXG4gICAgICAgICAgY29uc3QgcGF0aEFycmF5ID0gdGhpcy5ub3JtYWxpemVEYXRhUGF0aEFycihpdCk7XG4gICAgICAgICAgY29tcGlsYXRpb25TY2hlbUluZm8uc21hcnREZWZhdWx0UmVjb3JkLnNldChKU09OLnN0cmluZ2lmeShwYXRoQXJyYXkpLCBzY2hlbWEpO1xuXG4gICAgICAgICAgcmV0dXJuICgpID0+IHRydWU7XG4gICAgICAgIH0sXG4gICAgICAgIG1ldGFTY2hlbWE6IHtcbiAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAnJHNvdXJjZSc6IHsgdHlwZTogJ3N0cmluZycgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiB0cnVlLFxuICAgICAgICAgIHJlcXVpcmVkOiBbJyRzb3VyY2UnXSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIHJlZ2lzdGVyVXJpSGFuZGxlcihoYW5kbGVyOiBVcmlIYW5kbGVyKSB7XG4gICAgdGhpcy5fdXJpSGFuZGxlcnMuYWRkKGhhbmRsZXIpO1xuICB9XG5cbiAgdXNlUHJvbXB0UHJvdmlkZXIocHJvdmlkZXI6IFByb21wdFByb3ZpZGVyKSB7XG4gICAgY29uc3QgaXNTZXR1cCA9ICEhdGhpcy5fcHJvbXB0UHJvdmlkZXI7XG5cbiAgICB0aGlzLl9wcm9tcHRQcm92aWRlciA9IHByb3ZpZGVyO1xuXG4gICAgaWYgKGlzU2V0dXApIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLl9hanYuYWRkS2V5d29yZCh7XG4gICAgICBrZXl3b3JkOiAneC1wcm9tcHQnLFxuICAgICAgZXJyb3JzOiBmYWxzZSxcbiAgICAgIHZhbGlkOiB0cnVlLFxuICAgICAgY29tcGlsZTogKHNjaGVtYSwgcGFyZW50U2NoZW1hLCBpdCkgPT4ge1xuICAgICAgICBjb25zdCBjb21waWxhdGlvblNjaGVtSW5mbyA9IHRoaXMuX2N1cnJlbnRDb21waWxhdGlvblNjaGVtYUluZm87XG4gICAgICAgIGlmICghY29tcGlsYXRpb25TY2hlbUluZm8pIHtcbiAgICAgICAgICByZXR1cm4gKCkgPT4gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHBhdGggPSAnLycgKyB0aGlzLm5vcm1hbGl6ZURhdGFQYXRoQXJyKGl0KS5qb2luKCcvJyk7XG5cbiAgICAgICAgbGV0IHR5cGU6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICAgICAgbGV0IGl0ZW1zOiBBcnJheTxzdHJpbmcgfCB7IGxhYmVsOiBzdHJpbmc7IHZhbHVlOiBzdHJpbmcgfCBudW1iZXIgfCBib29sZWFuIH0+IHwgdW5kZWZpbmVkO1xuICAgICAgICBsZXQgbWVzc2FnZTogc3RyaW5nO1xuICAgICAgICBpZiAodHlwZW9mIHNjaGVtYSA9PSAnc3RyaW5nJykge1xuICAgICAgICAgIG1lc3NhZ2UgPSBzY2hlbWE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbWVzc2FnZSA9IHNjaGVtYS5tZXNzYWdlO1xuICAgICAgICAgIHR5cGUgPSBzY2hlbWEudHlwZTtcbiAgICAgICAgICBpdGVtcyA9IHNjaGVtYS5pdGVtcztcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHByb3BlcnR5VHlwZXMgPSBnZXRUeXBlc09mU2NoZW1hKHBhcmVudFNjaGVtYSBhcyBKc29uT2JqZWN0KTtcbiAgICAgICAgaWYgKCF0eXBlKSB7XG4gICAgICAgICAgaWYgKHByb3BlcnR5VHlwZXMuc2l6ZSA9PT0gMSAmJiBwcm9wZXJ0eVR5cGVzLmhhcygnYm9vbGVhbicpKSB7XG4gICAgICAgICAgICB0eXBlID0gJ2NvbmZpcm1hdGlvbic7XG4gICAgICAgICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KChwYXJlbnRTY2hlbWEgYXMgSnNvbk9iamVjdCkuZW51bSkpIHtcbiAgICAgICAgICAgIHR5cGUgPSAnbGlzdCc7XG4gICAgICAgICAgfSBlbHNlIGlmIChcbiAgICAgICAgICAgIHByb3BlcnR5VHlwZXMuc2l6ZSA9PT0gMSAmJlxuICAgICAgICAgICAgcHJvcGVydHlUeXBlcy5oYXMoJ2FycmF5JykgJiZcbiAgICAgICAgICAgIChwYXJlbnRTY2hlbWEgYXMgSnNvbk9iamVjdCkuaXRlbXMgJiZcbiAgICAgICAgICAgIEFycmF5LmlzQXJyYXkoKChwYXJlbnRTY2hlbWEgYXMgSnNvbk9iamVjdCkuaXRlbXMgYXMgSnNvbk9iamVjdCkuZW51bSlcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIHR5cGUgPSAnbGlzdCc7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHR5cGUgPSAnaW5wdXQnO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBtdWx0aXNlbGVjdDtcbiAgICAgICAgaWYgKHR5cGUgPT09ICdsaXN0Jykge1xuICAgICAgICAgIG11bHRpc2VsZWN0ID1cbiAgICAgICAgICAgIHNjaGVtYS5tdWx0aXNlbGVjdCA9PT0gdW5kZWZpbmVkXG4gICAgICAgICAgICAgID8gcHJvcGVydHlUeXBlcy5zaXplID09PSAxICYmIHByb3BlcnR5VHlwZXMuaGFzKCdhcnJheScpXG4gICAgICAgICAgICAgIDogc2NoZW1hLm11bHRpc2VsZWN0O1xuXG4gICAgICAgICAgY29uc3QgZW51bVZhbHVlcyA9IG11bHRpc2VsZWN0XG4gICAgICAgICAgICA/IChwYXJlbnRTY2hlbWEgYXMgSnNvbk9iamVjdCkuaXRlbXMgJiZcbiAgICAgICAgICAgICAgKChwYXJlbnRTY2hlbWEgYXMgSnNvbk9iamVjdCkuaXRlbXMgYXMgSnNvbk9iamVjdCkuZW51bVxuICAgICAgICAgICAgOiAocGFyZW50U2NoZW1hIGFzIEpzb25PYmplY3QpLmVudW07XG4gICAgICAgICAgaWYgKCFpdGVtcyAmJiBBcnJheS5pc0FycmF5KGVudW1WYWx1ZXMpKSB7XG4gICAgICAgICAgICBpdGVtcyA9IFtdO1xuICAgICAgICAgICAgZm9yIChjb25zdCB2YWx1ZSBvZiBlbnVtVmFsdWVzKSB7XG4gICAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICBpdGVtcy5wdXNoKHZhbHVlKTtcbiAgICAgICAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgdmFsdWUgPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICAvLyBJbnZhbGlkXG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaXRlbXMucHVzaCh7IGxhYmVsOiB2YWx1ZS50b1N0cmluZygpLCB2YWx1ZSB9KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGRlZmluaXRpb246IFByb21wdERlZmluaXRpb24gPSB7XG4gICAgICAgICAgaWQ6IHBhdGgsXG4gICAgICAgICAgdHlwZSxcbiAgICAgICAgICBtZXNzYWdlLFxuICAgICAgICAgIHJhdzogc2NoZW1hLFxuICAgICAgICAgIGl0ZW1zLFxuICAgICAgICAgIG11bHRpc2VsZWN0LFxuICAgICAgICAgIHByb3BlcnR5VHlwZXMsXG4gICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHR5cGVvZiAocGFyZW50U2NoZW1hIGFzIEpzb25PYmplY3QpLmRlZmF1bHQgPT0gJ29iamVjdCcgJiZcbiAgICAgICAgICAgIChwYXJlbnRTY2hlbWEgYXMgSnNvbk9iamVjdCkuZGVmYXVsdCAhPT0gbnVsbCAmJlxuICAgICAgICAgICAgIUFycmF5LmlzQXJyYXkoKHBhcmVudFNjaGVtYSBhcyBKc29uT2JqZWN0KS5kZWZhdWx0KVxuICAgICAgICAgICAgICA/IHVuZGVmaW5lZFxuICAgICAgICAgICAgICA6ICgocGFyZW50U2NoZW1hIGFzIEpzb25PYmplY3QpLmRlZmF1bHQgYXMgc3RyaW5nW10pLFxuICAgICAgICAgIGFzeW5jIHZhbGlkYXRvcihkYXRhOiBKc29uVmFsdWUpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGl0LnNlbGYudmFsaWRhdGUocGFyZW50U2NoZW1hLCBkYXRhKTtcbiAgICAgICAgICAgICAgLy8gSWYgdGhlIHNjaGVtYSBpcyBzeW5jIHRoZW4gZmFsc2Ugd2lsbCBiZSByZXR1cm5lZCBvbiB2YWxpZGF0aW9uIGZhaWx1cmVcbiAgICAgICAgICAgICAgaWYgKHJlc3VsdCkge1xuICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgICAgICAgIH0gZWxzZSBpZiAoaXQuc2VsZi5lcnJvcnM/Lmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIC8vIFZhbGlkYXRpb24gZXJyb3JzIHdpbGwgYmUgcHJlc2VudCBvbiB0aGUgQWp2IGluc3RhbmNlIHdoZW4gc3luY1xuICAgICAgICAgICAgICAgIHJldHVybiBpdC5zZWxmLmVycm9yc1swXS5tZXNzYWdlO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgIC8vIElmIHRoZSBzY2hlbWEgaXMgYXN5bmMgdGhlbiBhbiBlcnJvciB3aWxsIGJlIHRocm93biBvbiB2YWxpZGF0aW9uIGZhaWx1cmVcbiAgICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoZS5lcnJvcnMpICYmIGUuZXJyb3JzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBlLmVycm9yc1swXS5tZXNzYWdlO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICB9LFxuICAgICAgICB9O1xuXG4gICAgICAgIGNvbXBpbGF0aW9uU2NoZW1JbmZvLnByb21wdERlZmluaXRpb25zLnB1c2goZGVmaW5pdGlvbik7XG5cbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICh0aGlzOiB7IHByb21wdEZpZWxkc1dpdGhWYWx1ZTogU2V0PHN0cmluZz4gfSkge1xuICAgICAgICAgIC8vIElmICd0aGlzJyBpcyB1bmRlZmluZWQgaW4gdGhlIGNhbGwsIHRoZW4gaXQgZGVmYXVsdHMgdG8gdGhlIGdsb2JhbFxuICAgICAgICAgIC8vICd0aGlzJy5cbiAgICAgICAgICBpZiAodGhpcyAmJiB0aGlzLnByb21wdEZpZWxkc1dpdGhWYWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5wcm9tcHRGaWVsZHNXaXRoVmFsdWUuYWRkKHBhdGgpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9O1xuICAgICAgfSxcbiAgICAgIG1ldGFTY2hlbWE6IHtcbiAgICAgICAgb25lT2Y6IFtcbiAgICAgICAgICB7IHR5cGU6ICdzdHJpbmcnIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICd0eXBlJzogeyB0eXBlOiAnc3RyaW5nJyB9LFxuICAgICAgICAgICAgICAnbWVzc2FnZSc6IHsgdHlwZTogJ3N0cmluZycgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBhZGRpdGlvbmFsUHJvcGVydGllczogdHJ1ZSxcbiAgICAgICAgICAgIHJlcXVpcmVkOiBbJ21lc3NhZ2UnXSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgX2FwcGx5UHJvbXB0cyhkYXRhOiBKc29uVmFsdWUsIHByb21wdHM6IEFycmF5PFByb21wdERlZmluaXRpb24+KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgcHJvdmlkZXIgPSB0aGlzLl9wcm9tcHRQcm92aWRlcjtcbiAgICBpZiAoIXByb3ZpZGVyKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgYW5zd2VycyA9IGF3YWl0IGZyb20ocHJvdmlkZXIocHJvbXB0cykpLnRvUHJvbWlzZSgpO1xuICAgIGZvciAoY29uc3QgcGF0aCBpbiBhbnN3ZXJzKSB7XG4gICAgICBjb25zdCBwYXRoRnJhZ21lbnRzID0gcGF0aC5zcGxpdCgnLycpLnNsaWNlKDEpO1xuXG4gICAgICBDb3JlU2NoZW1hUmVnaXN0cnkuX3NldChkYXRhLCBwYXRoRnJhZ21lbnRzLCBhbnN3ZXJzW3BhdGhdLCBudWxsLCB1bmRlZmluZWQsIHRydWUpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgc3RhdGljIF9zZXQoXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICBkYXRhOiBhbnksXG4gICAgZnJhZ21lbnRzOiBzdHJpbmdbXSxcbiAgICB2YWx1ZTogdW5rbm93bixcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgIHBhcmVudDogYW55ID0gbnVsbCxcbiAgICBwYXJlbnRQcm9wZXJ0eT86IHN0cmluZyxcbiAgICBmb3JjZT86IGJvb2xlYW4sXG4gICk6IHZvaWQge1xuICAgIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCBmcmFnbWVudHMubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICBjb25zdCBmcmFnbWVudCA9IGZyYWdtZW50c1tpbmRleF07XG4gICAgICBpZiAoL15pXFxkKyQvLnRlc3QoZnJhZ21lbnQpKSB7XG4gICAgICAgIGlmICghQXJyYXkuaXNBcnJheShkYXRhKSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGRhdGFJbmRleCA9IDA7IGRhdGFJbmRleCA8IGRhdGEubGVuZ3RoOyBkYXRhSW5kZXgrKykge1xuICAgICAgICAgIENvcmVTY2hlbWFSZWdpc3RyeS5fc2V0KFxuICAgICAgICAgICAgZGF0YVtkYXRhSW5kZXhdLFxuICAgICAgICAgICAgZnJhZ21lbnRzLnNsaWNlKGluZGV4ICsgMSksXG4gICAgICAgICAgICB2YWx1ZSxcbiAgICAgICAgICAgIGRhdGEsXG4gICAgICAgICAgICBgJHtkYXRhSW5kZXh9YCxcbiAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBpZiAoIWRhdGEgJiYgcGFyZW50ICE9PSBudWxsICYmIHBhcmVudFByb3BlcnR5KSB7XG4gICAgICAgIGRhdGEgPSBwYXJlbnRbcGFyZW50UHJvcGVydHldID0ge307XG4gICAgICB9XG5cbiAgICAgIHBhcmVudCA9IGRhdGE7XG4gICAgICBwYXJlbnRQcm9wZXJ0eSA9IGZyYWdtZW50O1xuICAgICAgZGF0YSA9IGRhdGFbZnJhZ21lbnRdO1xuICAgIH1cblxuICAgIGlmIChwYXJlbnQgJiYgcGFyZW50UHJvcGVydHkgJiYgKGZvcmNlIHx8IHBhcmVudFtwYXJlbnRQcm9wZXJ0eV0gPT09IHVuZGVmaW5lZCkpIHtcbiAgICAgIHBhcmVudFtwYXJlbnRQcm9wZXJ0eV0gPSB2YWx1ZTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIF9hcHBseVNtYXJ0RGVmYXVsdHM8VD4oXG4gICAgZGF0YTogVCxcbiAgICBzbWFydERlZmF1bHRzOiBNYXA8c3RyaW5nLCBKc29uT2JqZWN0PixcbiAgKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgZm9yIChjb25zdCBbcG9pbnRlciwgc2NoZW1hXSBvZiBzbWFydERlZmF1bHRzLmVudHJpZXMoKSkge1xuICAgICAgY29uc3QgZnJhZ21lbnRzID0gSlNPTi5wYXJzZShwb2ludGVyKTtcbiAgICAgIGNvbnN0IHNvdXJjZSA9IHRoaXMuX3NvdXJjZU1hcC5nZXQoc2NoZW1hLiRzb3VyY2UgYXMgc3RyaW5nKTtcbiAgICAgIGlmICghc291cmNlKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBsZXQgdmFsdWUgPSBzb3VyY2Uoc2NoZW1hKTtcbiAgICAgIGlmIChpc09ic2VydmFibGUodmFsdWUpKSB7XG4gICAgICAgIHZhbHVlID0gYXdhaXQgdmFsdWUudG9Qcm9taXNlKCk7XG4gICAgICB9XG5cbiAgICAgIENvcmVTY2hlbWFSZWdpc3RyeS5fc2V0KGRhdGEsIGZyYWdtZW50cywgdmFsdWUpO1xuICAgIH1cbiAgfVxuXG4gIHVzZVhEZXByZWNhdGVkUHJvdmlkZXIob25Vc2FnZTogKG1lc3NhZ2U6IHN0cmluZykgPT4gdm9pZCk6IHZvaWQge1xuICAgIHRoaXMuX2Fqdi5hZGRLZXl3b3JkKHtcbiAgICAgIGtleXdvcmQ6ICd4LWRlcHJlY2F0ZWQnLFxuICAgICAgdmFsaWRhdGU6IChzY2hlbWEsIF9kYXRhLCBfcGFyZW50U2NoZW1hLCBkYXRhQ3h0KSA9PiB7XG4gICAgICAgIGlmIChzY2hlbWEpIHtcbiAgICAgICAgICBvblVzYWdlKFxuICAgICAgICAgICAgYE9wdGlvbiBcIiR7ZGF0YUN4dD8ucGFyZW50RGF0YVByb3BlcnR5fVwiIGlzIGRlcHJlY2F0ZWQke1xuICAgICAgICAgICAgICB0eXBlb2Ygc2NoZW1hID09ICdzdHJpbmcnID8gJzogJyArIHNjaGVtYSA6ICcuJ1xuICAgICAgICAgICAgfWAsXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSxcbiAgICAgIGVycm9yczogZmFsc2UsXG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIG5vcm1hbGl6ZURhdGFQYXRoQXJyKGl0OiBTY2hlbWFPYmpDeHQpOiAobnVtYmVyIHwgc3RyaW5nKVtdIHtcbiAgICByZXR1cm4gaXQuZGF0YVBhdGhBcnJcbiAgICAgIC5zbGljZSgxLCBpdC5kYXRhTGV2ZWwgKyAxKVxuICAgICAgLm1hcCgocCkgPT4gKHR5cGVvZiBwID09PSAnbnVtYmVyJyA/IHAgOiBwLnN0ci5yZXBsYWNlKC9cIi9nLCAnJykpKTtcbiAgfVxufVxuIl19