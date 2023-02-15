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
     * Producing a flatten schema document does not in all cases produce a schema with identical behavior to the original.
     * See: https://json-schema.org/draft/2019-09/json-schema-core.html#rfc.appendix.B.2
     *
     * @param schema The schema or URI to flatten.
     * @returns An Observable of the flattened schema object.
     * @private since 11.2 without replacement.
     */
    async ɵflatten(schema) {
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
     */
    async compile(schema) {
        const validate = await this._compile(schema);
        return (value, options) => validate(value, options);
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
                            const validationError = e;
                            // If the schema is async then an error will be thrown on validation failure
                            if (Array.isArray(validationError.errors) && validationError.errors.length) {
                                return validationError.errors[0].message;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVnaXN0cnkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9jb3JlL3NyYy9qc29uL3NjaGVtYS9yZWdpc3RyeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILDhDQUEwRDtBQUMxRCw4REFBd0M7QUFDeEMsMkNBQTZCO0FBQzdCLDZDQUErQjtBQUMvQiwrQkFBc0Q7QUFDdEQseUNBQTJCO0FBQzNCLCtDQUFnRDtBQUNoRCx1Q0FBNEQ7QUFDNUQsb0NBQTBFO0FBZTFFLHVDQUE2QztBQUM3Qyx1Q0FBdUQ7QUFNdkQsTUFBYSx5QkFBMEIsU0FBUSx5QkFBYTtJQUcxRCxZQUNFLE1BQStCLEVBQy9CLFdBQVcsR0FBRyxxREFBcUQ7UUFFbkUsSUFBSSxDQUFDLE1BQU0sSUFBSSxNQUFNLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtZQUNsQyxLQUFLLENBQUMsMkJBQTJCLENBQUMsQ0FBQztZQUNuQyxJQUFJLENBQUMsTUFBTSxHQUFHLEVBQUUsQ0FBQztZQUVqQixPQUFPO1NBQ1I7UUFFRCxNQUFNLFFBQVEsR0FBRyx5QkFBeUIsQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDbEUsS0FBSyxDQUFDLEdBQUcsV0FBVyxPQUFPLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ3BELElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO0lBQ3ZCLENBQUM7SUFFTSxNQUFNLENBQUMsY0FBYyxDQUFDLE1BQStCO1FBQzFELElBQUksQ0FBQyxNQUFNLElBQUksTUFBTSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7WUFDbEMsT0FBTyxFQUFFLENBQUM7U0FDWDtRQUVELE1BQU0sUUFBUSxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMs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QyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN2RSxDQUFDO0NBQ0Y7QUExa0JELGdEQTBrQkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IEFqdiwgeyBTY2hlbWFPYmpDeHQsIFZhbGlkYXRlRnVuY3Rpb24gfSBmcm9tICdhanYnO1xuaW1wb3J0IGFqdkFkZEZvcm1hdHMgZnJvbSAnYWp2LWZvcm1hdHMnO1xuaW1wb3J0ICogYXMgaHR0cCBmcm9tICdodHRwJztcbmltcG9ydCAqIGFzIGh0dHBzIGZyb20gJ2h0dHBzJztcbmltcG9ydCB7IE9ic2VydmFibGUsIGZyb20sIGlzT2JzZXJ2YWJsZSB9IGZyb20gJ3J4anMnO1xuaW1wb3J0ICogYXMgVXJsIGZyb20gJ3VybCc7XG5pbXBvcnQgeyBCYXNlRXhjZXB0aW9uIH0gZnJvbSAnLi4vLi4vZXhjZXB0aW9uJztcbmltcG9ydCB7IFBhcnRpYWxseU9yZGVyZWRTZXQsIGRlZXBDb3B5IH0gZnJvbSAnLi4vLi4vdXRpbHMnO1xuaW1wb3J0IHsgSnNvbkFycmF5LCBKc29uT2JqZWN0LCBKc29uVmFsdWUsIGlzSnNvbk9iamVjdCB9IGZyb20gJy4uL3V0aWxzJztcbmltcG9ydCB7XG4gIEpzb25Qb2ludGVyLFxuICBKc29uVmlzaXRvcixcbiAgUHJvbXB0RGVmaW5pdGlvbixcbiAgUHJvbXB0UHJvdmlkZXIsXG4gIFNjaGVtYUZvcm1hdCxcbiAgU2NoZW1hUmVnaXN0cnksXG4gIFNjaGVtYVZhbGlkYXRvcixcbiAgU2NoZW1hVmFsaWRhdG9yRXJyb3IsXG4gIFNjaGVtYVZhbGlkYXRvck9wdGlvbnMsXG4gIFNjaGVtYVZhbGlkYXRvclJlc3VsdCxcbiAgU21hcnREZWZhdWx0UHJvdmlkZXIsXG59IGZyb20gJy4vaW50ZXJmYWNlJztcbmltcG9ydCB7IEpzb25TY2hlbWEgfSBmcm9tICcuL3NjaGVtYSc7XG5pbXBvcnQgeyBnZXRUeXBlc09mU2NoZW1hIH0gZnJvbSAnLi91dGlsaXR5JztcbmltcG9ydCB7IHZpc2l0SnNvbiwgdmlzaXRKc29uU2NoZW1hIH0gZnJvbSAnLi92aXNpdG9yJztcblxuZXhwb3J0IHR5cGUgVXJpSGFuZGxlciA9IChcbiAgdXJpOiBzdHJpbmcsXG4pID0+IE9ic2VydmFibGU8SnNvbk9iamVjdD4gfCBQcm9taXNlPEpzb25PYmplY3Q+IHwgbnVsbCB8IHVuZGVmaW5lZDtcblxuZXhwb3J0IGNsYXNzIFNjaGVtYVZhbGlkYXRpb25FeGNlcHRpb24gZXh0ZW5kcyBCYXNlRXhjZXB0aW9uIHtcbiAgcHVibGljIHJlYWRvbmx5IGVycm9yczogU2NoZW1hVmFsaWRhdG9yRXJyb3JbXTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBlcnJvcnM/OiBTY2hlbWFWYWxpZGF0b3JFcnJvcltdLFxuICAgIGJhc2VNZXNzYWdlID0gJ1NjaGVtYSB2YWxpZGF0aW9uIGZhaWxlZCB3aXRoIHRoZSBmb2xsb3dpbmcgZXJyb3JzOicsXG4gICkge1xuICAgIGlmICghZXJyb3JzIHx8IGVycm9ycy5sZW5ndGggPT09IDApIHtcbiAgICAgIHN1cGVyKCdTY2hlbWEgdmFsaWRhdGlvbiBmYWlsZWQuJyk7XG4gICAgICB0aGlzLmVycm9ycyA9IFtdO1xuXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgbWVzc2FnZXMgPSBTY2hlbWFWYWxpZGF0aW9uRXhjZXB0aW9uLmNyZWF0ZU1lc3NhZ2VzKGVycm9ycyk7XG4gICAgc3VwZXIoYCR7YmFzZU1lc3NhZ2V9XFxuICAke21lc3NhZ2VzLmpvaW4oJ1xcbiAgJyl9YCk7XG4gICAgdGhpcy5lcnJvcnMgPSBlcnJvcnM7XG4gIH1cblxuICBwdWJsaWMgc3RhdGljIGNyZWF0ZU1lc3NhZ2VzKGVycm9ycz86IFNjaGVtYVZhbGlkYXRvckVycm9yW10pOiBzdHJpbmdbXSB7XG4gICAgaWYgKCFlcnJvcnMgfHwgZXJyb3JzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIGNvbnN0IG1lc3NhZ2VzID0gZXJyb3JzLm1hcCgoZXJyKSA9PiB7XG4gICAgICBsZXQgbWVzc2FnZSA9IGBEYXRhIHBhdGggJHtKU09OLnN0cmluZ2lmeShlcnIuaW5zdGFuY2VQYXRoKX0gJHtlcnIubWVzc2FnZX1gO1xuICAgICAgaWYgKGVyci5wYXJhbXMpIHtcbiAgICAgICAgc3dpdGNoIChlcnIua2V5d29yZCkge1xuICAgICAgICAgIGNhc2UgJ2FkZGl0aW9uYWxQcm9wZXJ0aWVzJzpcbiAgICAgICAgICAgIG1lc3NhZ2UgKz0gYCgke2Vyci5wYXJhbXMuYWRkaXRpb25hbFByb3BlcnR5fSlgO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICBjYXNlICdlbnVtJzpcbiAgICAgICAgICAgIG1lc3NhZ2UgKz0gYC4gQWxsb3dlZCB2YWx1ZXMgYXJlOiAkeyhlcnIucGFyYW1zLmFsbG93ZWRWYWx1ZXMgYXMgc3RyaW5nW10gfCB1bmRlZmluZWQpXG4gICAgICAgICAgICAgID8ubWFwKCh2KSA9PiBgXCIke3Z9XCJgKVxuICAgICAgICAgICAgICAuam9pbignLCAnKX1gO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIG1lc3NhZ2UgKyAnLic7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gbWVzc2FnZXM7XG4gIH1cbn1cblxuaW50ZXJmYWNlIFNjaGVtYUluZm8ge1xuICBzbWFydERlZmF1bHRSZWNvcmQ6IE1hcDxzdHJpbmcsIEpzb25PYmplY3Q+O1xuICBwcm9tcHREZWZpbml0aW9uczogQXJyYXk8UHJvbXB0RGVmaW5pdGlvbj47XG59XG5cbmV4cG9ydCBjbGFzcyBDb3JlU2NoZW1hUmVnaXN0cnkgaW1wbGVtZW50cyBTY2hlbWFSZWdpc3RyeSB7XG4gIHByaXZhdGUgX2FqdjogQWp2O1xuICBwcml2YXRlIF91cmlDYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCBKc29uT2JqZWN0PigpO1xuICBwcml2YXRlIF91cmlIYW5kbGVycyA9IG5ldyBTZXQ8VXJpSGFuZGxlcj4oKTtcbiAgcHJpdmF0ZSBfcHJlID0gbmV3IFBhcnRpYWxseU9yZGVyZWRTZXQ8SnNvblZpc2l0b3I+KCk7XG4gIHByaXZhdGUgX3Bvc3QgPSBuZXcgUGFydGlhbGx5T3JkZXJlZFNldDxKc29uVmlzaXRvcj4oKTtcblxuICBwcml2YXRlIF9jdXJyZW50Q29tcGlsYXRpb25TY2hlbWFJbmZvPzogU2NoZW1hSW5mbztcblxuICBwcml2YXRlIF9zbWFydERlZmF1bHRLZXl3b3JkID0gZmFsc2U7XG4gIHByaXZhdGUgX3Byb21wdFByb3ZpZGVyPzogUHJvbXB0UHJvdmlkZXI7XG4gIHByaXZhdGUgX3NvdXJjZU1hcCA9IG5ldyBNYXA8c3RyaW5nLCBTbWFydERlZmF1bHRQcm92aWRlcjx7fT4+KCk7XG5cbiAgY29uc3RydWN0b3IoZm9ybWF0czogU2NoZW1hRm9ybWF0W10gPSBbXSkge1xuICAgIHRoaXMuX2FqdiA9IG5ldyBBanYoe1xuICAgICAgc3RyaWN0OiBmYWxzZSxcbiAgICAgIGxvYWRTY2hlbWE6ICh1cmk6IHN0cmluZykgPT4gdGhpcy5fZmV0Y2godXJpKSxcbiAgICAgIHBhc3NDb250ZXh0OiB0cnVlLFxuICAgIH0pO1xuXG4gICAgYWp2QWRkRm9ybWF0cyh0aGlzLl9hanYpO1xuXG4gICAgZm9yIChjb25zdCBmb3JtYXQgb2YgZm9ybWF0cykge1xuICAgICAgdGhpcy5hZGRGb3JtYXQoZm9ybWF0KTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIF9mZXRjaCh1cmk6IHN0cmluZyk6IFByb21pc2U8SnNvbk9iamVjdD4ge1xuICAgIGNvbnN0IG1heWJlU2NoZW1hID0gdGhpcy5fdXJpQ2FjaGUuZ2V0KHVyaSk7XG5cbiAgICBpZiAobWF5YmVTY2hlbWEpIHtcbiAgICAgIHJldHVybiBtYXliZVNjaGVtYTtcbiAgICB9XG5cbiAgICAvLyBUcnkgYWxsIGhhbmRsZXJzLCBvbmUgYWZ0ZXIgdGhlIG90aGVyLlxuICAgIGZvciAoY29uc3QgaGFuZGxlciBvZiB0aGlzLl91cmlIYW5kbGVycykge1xuICAgICAgbGV0IGhhbmRsZXJSZXN1bHQgPSBoYW5kbGVyKHVyaSk7XG4gICAgICBpZiAoaGFuZGxlclJlc3VsdCA9PT0gbnVsbCB8fCBoYW5kbGVyUmVzdWx0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChpc09ic2VydmFibGUoaGFuZGxlclJlc3VsdCkpIHtcbiAgICAgICAgaGFuZGxlclJlc3VsdCA9IGhhbmRsZXJSZXN1bHQudG9Qcm9taXNlKCk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHZhbHVlID0gYXdhaXQgaGFuZGxlclJlc3VsdDtcbiAgICAgIHRoaXMuX3VyaUNhY2hlLnNldCh1cmksIHZhbHVlKTtcblxuICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH1cblxuICAgIC8vIElmIG5vbmUgYXJlIGZvdW5kLCBoYW5kbGUgdXNpbmcgaHR0cCBjbGllbnQuXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPEpzb25PYmplY3Q+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGNvbnN0IHVybCA9IG5ldyBVcmwuVVJMKHVyaSk7XG4gICAgICBjb25zdCBjbGllbnQgPSB1cmwucHJvdG9jb2wgPT09ICdodHRwczonID8gaHR0cHMgOiBodHRwO1xuICAgICAgY2xpZW50LmdldCh1cmwsIChyZXMpID0+IHtcbiAgICAgICAgaWYgKCFyZXMuc3RhdHVzQ29kZSB8fCByZXMuc3RhdHVzQ29kZSA+PSAzMDApIHtcbiAgICAgICAgICAvLyBDb25zdW1lIHRoZSByZXN0IG9mIHRoZSBkYXRhIHRvIGZyZWUgbWVtb3J5LlxuICAgICAgICAgIHJlcy5yZXN1bWUoKTtcbiAgICAgICAgICByZWplY3QobmV3IEVycm9yKGBSZXF1ZXN0IGZhaWxlZC4gU3RhdHVzIENvZGU6ICR7cmVzLnN0YXR1c0NvZGV9YCkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlcy5zZXRFbmNvZGluZygndXRmOCcpO1xuICAgICAgICAgIGxldCBkYXRhID0gJyc7XG4gICAgICAgICAgcmVzLm9uKCdkYXRhJywgKGNodW5rKSA9PiB7XG4gICAgICAgICAgICBkYXRhICs9IGNodW5rO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIHJlcy5vbignZW5kJywgKCkgPT4ge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgY29uc3QganNvbiA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICAgICAgICAgIHRoaXMuX3VyaUNhY2hlLnNldCh1cmksIGpzb24pO1xuICAgICAgICAgICAgICByZXNvbHZlKGpzb24pO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGQgYSB0cmFuc2Zvcm1hdGlvbiBzdGVwIGJlZm9yZSB0aGUgdmFsaWRhdGlvbiBvZiBhbnkgSnNvbi5cbiAgICogQHBhcmFtIHtKc29uVmlzaXRvcn0gdmlzaXRvciBUaGUgdmlzaXRvciB0byB0cmFuc2Zvcm0gZXZlcnkgdmFsdWUuXG4gICAqIEBwYXJhbSB7SnNvblZpc2l0b3JbXX0gZGVwcyBBIGxpc3Qgb2Ygb3RoZXIgdmlzaXRvcnMgdG8gcnVuIGJlZm9yZS5cbiAgICovXG4gIGFkZFByZVRyYW5zZm9ybSh2aXNpdG9yOiBKc29uVmlzaXRvciwgZGVwcz86IEpzb25WaXNpdG9yW10pIHtcbiAgICB0aGlzLl9wcmUuYWRkKHZpc2l0b3IsIGRlcHMpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZCBhIHRyYW5zZm9ybWF0aW9uIHN0ZXAgYWZ0ZXIgdGhlIHZhbGlkYXRpb24gb2YgYW55IEpzb24uIFRoZSBKU09OIHdpbGwgbm90IGJlIHZhbGlkYXRlZFxuICAgKiBhZnRlciB0aGUgUE9TVCwgc28gaWYgdHJhbnNmb3JtYXRpb25zIGFyZSBub3QgY29tcGF0aWJsZSB3aXRoIHRoZSBTY2hlbWEgaXQgd2lsbCBub3QgcmVzdWx0XG4gICAqIGluIGFuIGVycm9yLlxuICAgKiBAcGFyYW0ge0pzb25WaXNpdG9yfSB2aXNpdG9yIFRoZSB2aXNpdG9yIHRvIHRyYW5zZm9ybSBldmVyeSB2YWx1ZS5cbiAgICogQHBhcmFtIHtKc29uVmlzaXRvcltdfSBkZXBzIEEgbGlzdCBvZiBvdGhlciB2aXNpdG9ycyB0byBydW4gYmVmb3JlLlxuICAgKi9cbiAgYWRkUG9zdFRyYW5zZm9ybSh2aXNpdG9yOiBKc29uVmlzaXRvciwgZGVwcz86IEpzb25WaXNpdG9yW10pIHtcbiAgICB0aGlzLl9wb3N0LmFkZCh2aXNpdG9yLCBkZXBzKTtcbiAgfVxuXG4gIHByb3RlY3RlZCBfcmVzb2x2ZXIoXG4gICAgcmVmOiBzdHJpbmcsXG4gICAgdmFsaWRhdGU/OiBWYWxpZGF0ZUZ1bmN0aW9uLFxuICApOiB7IGNvbnRleHQ/OiBWYWxpZGF0ZUZ1bmN0aW9uOyBzY2hlbWE/OiBKc29uT2JqZWN0IH0ge1xuICAgIGlmICghdmFsaWRhdGUgfHwgIXJlZikge1xuICAgICAgcmV0dXJuIHt9O1xuICAgIH1cblxuICAgIGNvbnN0IHNjaGVtYSA9IHZhbGlkYXRlLnNjaGVtYUVudi5yb290LnNjaGVtYTtcbiAgICBjb25zdCBpZCA9IHR5cGVvZiBzY2hlbWEgPT09ICdvYmplY3QnID8gc2NoZW1hLiRpZCA6IG51bGw7XG5cbiAgICBsZXQgZnVsbFJlZmVyZW5jZSA9IHJlZjtcbiAgICBpZiAodHlwZW9mIGlkID09PSAnc3RyaW5nJykge1xuICAgICAgZnVsbFJlZmVyZW5jZSA9IFVybC5yZXNvbHZlKGlkLCByZWYpO1xuXG4gICAgICBpZiAocmVmLnN0YXJ0c1dpdGgoJyMnKSkge1xuICAgICAgICBmdWxsUmVmZXJlbmNlID0gaWQgKyBmdWxsUmVmZXJlbmNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHJlc29sdmVkU2NoZW1hID0gdGhpcy5fYWp2LmdldFNjaGVtYShmdWxsUmVmZXJlbmNlKTtcblxuICAgIHJldHVybiB7XG4gICAgICBjb250ZXh0OiByZXNvbHZlZFNjaGVtYT8uc2NoZW1hRW52LnZhbGlkYXRlLFxuICAgICAgc2NoZW1hOiByZXNvbHZlZFNjaGVtYT8uc2NoZW1hIGFzIEpzb25PYmplY3QsXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBGbGF0dGVuIHRoZSBTY2hlbWEsIHJlc29sdmluZyBhbmQgcmVwbGFjaW5nIGFsbCB0aGUgcmVmcy4gTWFrZXMgaXQgaW50byBhIHN5bmNocm9ub3VzIHNjaGVtYVxuICAgKiB0aGF0IGlzIGFsc28gZWFzaWVyIHRvIHRyYXZlcnNlLiBEb2VzIG5vdCBjYWNoZSB0aGUgcmVzdWx0LlxuICAgKlxuICAgKiBQcm9kdWNpbmcgYSBmbGF0dGVuIHNjaGVtYSBkb2N1bWVudCBkb2VzIG5vdCBpbiBhbGwgY2FzZXMgcHJvZHVjZSBhIHNjaGVtYSB3aXRoIGlkZW50aWNhbCBiZWhhdmlvciB0byB0aGUgb3JpZ2luYWwuXG4gICAqIFNlZTogaHR0cHM6Ly9qc29uLXNjaGVtYS5vcmcvZHJhZnQvMjAxOS0wOS9qc29uLXNjaGVtYS1jb3JlLmh0bWwjcmZjLmFwcGVuZGl4LkIuMlxuICAgKlxuICAgKiBAcGFyYW0gc2NoZW1hIFRoZSBzY2hlbWEgb3IgVVJJIHRvIGZsYXR0ZW4uXG4gICAqIEByZXR1cm5zIEFuIE9ic2VydmFibGUgb2YgdGhlIGZsYXR0ZW5lZCBzY2hlbWEgb2JqZWN0LlxuICAgKiBAcHJpdmF0ZSBzaW5jZSAxMS4yIHdpdGhvdXQgcmVwbGFjZW1lbnQuXG4gICAqL1xuICBhc3luYyDJtWZsYXR0ZW4oc2NoZW1hOiBKc29uT2JqZWN0KTogUHJvbWlzZTxKc29uT2JqZWN0PiB7XG4gICAgdGhpcy5fYWp2LnJlbW92ZVNjaGVtYShzY2hlbWEpO1xuICAgIHRoaXMuX2N1cnJlbnRDb21waWxhdGlvblNjaGVtYUluZm8gPSB1bmRlZmluZWQ7XG4gICAgY29uc3QgdmFsaWRhdGUgPSBhd2FpdCB0aGlzLl9hanYuY29tcGlsZUFzeW5jKHNjaGVtYSk7XG5cbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXRoaXMtYWxpYXNcbiAgICBjb25zdCBzZWxmID0gdGhpcztcblxuICAgIGZ1bmN0aW9uIHZpc2l0b3IoXG4gICAgICBjdXJyZW50OiBKc29uT2JqZWN0IHwgSnNvbkFycmF5LFxuICAgICAgcG9pbnRlcjogSnNvblBvaW50ZXIsXG4gICAgICBwYXJlbnRTY2hlbWE/OiBKc29uT2JqZWN0IHwgSnNvbkFycmF5LFxuICAgICAgaW5kZXg/OiBzdHJpbmcsXG4gICAgKSB7XG4gICAgICBpZiAoXG4gICAgICAgIGN1cnJlbnQgJiZcbiAgICAgICAgcGFyZW50U2NoZW1hICYmXG4gICAgICAgIGluZGV4ICYmXG4gICAgICAgIGlzSnNvbk9iamVjdChjdXJyZW50KSAmJlxuICAgICAgICBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoY3VycmVudCwgJyRyZWYnKSAmJlxuICAgICAgICB0eXBlb2YgY3VycmVudFsnJHJlZiddID09ICdzdHJpbmcnXG4gICAgICApIHtcbiAgICAgICAgY29uc3QgcmVzb2x2ZWQgPSBzZWxmLl9yZXNvbHZlcihjdXJyZW50WyckcmVmJ10sIHZhbGlkYXRlKTtcblxuICAgICAgICBpZiAocmVzb2x2ZWQuc2NoZW1hKSB7XG4gICAgICAgICAgKHBhcmVudFNjaGVtYSBhcyBKc29uT2JqZWN0KVtpbmRleF0gPSByZXNvbHZlZC5zY2hlbWE7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBzY2hlbWFDb3B5ID0gZGVlcENvcHkodmFsaWRhdGUuc2NoZW1hIGFzIEpzb25PYmplY3QpO1xuICAgIHZpc2l0SnNvblNjaGVtYShzY2hlbWFDb3B5LCB2aXNpdG9yKTtcblxuICAgIHJldHVybiBzY2hlbWFDb3B5O1xuICB9XG5cbiAgLyoqXG4gICAqIENvbXBpbGUgYW5kIHJldHVybiBhIHZhbGlkYXRpb24gZnVuY3Rpb24gZm9yIHRoZSBTY2hlbWEuXG4gICAqXG4gICAqIEBwYXJhbSBzY2hlbWEgVGhlIHNjaGVtYSB0byB2YWxpZGF0ZS4gSWYgYSBzdHJpbmcsIHdpbGwgZmV0Y2ggdGhlIHNjaGVtYSBiZWZvcmUgY29tcGlsaW5nIGl0XG4gICAqICh1c2luZyBzY2hlbWEgYXMgYSBVUkkpLlxuICAgKi9cbiAgYXN5bmMgY29tcGlsZShzY2hlbWE6IEpzb25TY2hlbWEpOiBQcm9taXNlPFNjaGVtYVZhbGlkYXRvcj4ge1xuICAgIGNvbnN0IHZhbGlkYXRlID0gYXdhaXQgdGhpcy5fY29tcGlsZShzY2hlbWEpO1xuXG4gICAgcmV0dXJuICh2YWx1ZSwgb3B0aW9ucykgPT4gdmFsaWRhdGUodmFsdWUsIG9wdGlvbnMpO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBfY29tcGlsZShcbiAgICBzY2hlbWE6IEpzb25TY2hlbWEsXG4gICk6IFByb21pc2U8XG4gICAgKGRhdGE6IEpzb25WYWx1ZSwgb3B0aW9ucz86IFNjaGVtYVZhbGlkYXRvck9wdGlvbnMpID0+IFByb21pc2U8U2NoZW1hVmFsaWRhdG9yUmVzdWx0PlxuICA+IHtcbiAgICBpZiAodHlwZW9mIHNjaGVtYSA9PT0gJ2Jvb2xlYW4nKSB7XG4gICAgICByZXR1cm4gYXN5bmMgKGRhdGEpID0+ICh7IHN1Y2Nlc3M6IHNjaGVtYSwgZGF0YSB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBzY2hlbWFJbmZvOiBTY2hlbWFJbmZvID0ge1xuICAgICAgc21hcnREZWZhdWx0UmVjb3JkOiBuZXcgTWFwPHN0cmluZywgSnNvbk9iamVjdD4oKSxcbiAgICAgIHByb21wdERlZmluaXRpb25zOiBbXSxcbiAgICB9O1xuXG4gICAgdGhpcy5fYWp2LnJlbW92ZVNjaGVtYShzY2hlbWEpO1xuICAgIGxldCB2YWxpZGF0b3I6IFZhbGlkYXRlRnVuY3Rpb247XG5cbiAgICB0cnkge1xuICAgICAgdGhpcy5fY3VycmVudENvbXBpbGF0aW9uU2NoZW1hSW5mbyA9IHNjaGVtYUluZm87XG4gICAgICB2YWxpZGF0b3IgPSB0aGlzLl9hanYuY29tcGlsZShzY2hlbWEpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIC8vIFRoaXMgc2hvdWxkIGV2ZW50dWFsbHkgYmUgcmVmYWN0b3JlZCBzbyB0aGF0IHdlIHdlIGhhbmRsZSByYWNlIGNvbmRpdGlvbiB3aGVyZSB0aGUgc2FtZSBzY2hlbWEgaXMgdmFsaWRhdGVkIGF0IHRoZSBzYW1lIHRpbWUuXG4gICAgICBpZiAoIShlIGluc3RhbmNlb2YgQWp2Lk1pc3NpbmdSZWZFcnJvcikpIHtcbiAgICAgICAgdGhyb3cgZTtcbiAgICAgIH1cblxuICAgICAgdmFsaWRhdG9yID0gYXdhaXQgdGhpcy5fYWp2LmNvbXBpbGVBc3luYyhzY2hlbWEpO1xuICAgIH0gZmluYWxseSB7XG4gICAgICB0aGlzLl9jdXJyZW50Q29tcGlsYXRpb25TY2hlbWFJbmZvID0gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIHJldHVybiBhc3luYyAoZGF0YTogSnNvblZhbHVlLCBvcHRpb25zPzogU2NoZW1hVmFsaWRhdG9yT3B0aW9ucykgPT4ge1xuICAgICAgY29uc3QgdmFsaWRhdGlvbk9wdGlvbnM6IFNjaGVtYVZhbGlkYXRvck9wdGlvbnMgPSB7XG4gICAgICAgIHdpdGhQcm9tcHRzOiB0cnVlLFxuICAgICAgICBhcHBseVBvc3RUcmFuc2Zvcm1zOiB0cnVlLFxuICAgICAgICBhcHBseVByZVRyYW5zZm9ybXM6IHRydWUsXG4gICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICB9O1xuICAgICAgY29uc3QgdmFsaWRhdGlvbkNvbnRleHQgPSB7XG4gICAgICAgIHByb21wdEZpZWxkc1dpdGhWYWx1ZTogbmV3IFNldDxzdHJpbmc+KCksXG4gICAgICB9O1xuXG4gICAgICAvLyBBcHBseSBwcmUtdmFsaWRhdGlvbiB0cmFuc2Zvcm1zXG4gICAgICBpZiAodmFsaWRhdGlvbk9wdGlvbnMuYXBwbHlQcmVUcmFuc2Zvcm1zKSB7XG4gICAgICAgIGZvciAoY29uc3QgdmlzaXRvciBvZiB0aGlzLl9wcmUudmFsdWVzKCkpIHtcbiAgICAgICAgICBkYXRhID0gYXdhaXQgdmlzaXRKc29uKFxuICAgICAgICAgICAgZGF0YSxcbiAgICAgICAgICAgIHZpc2l0b3IsXG4gICAgICAgICAgICBzY2hlbWEsXG4gICAgICAgICAgICB0aGlzLl9yZXNvbHZlci5iaW5kKHRoaXMpLFxuICAgICAgICAgICAgdmFsaWRhdG9yLFxuICAgICAgICAgICkudG9Qcm9taXNlKCk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gQXBwbHkgc21hcnQgZGVmYXVsdHNcbiAgICAgIGF3YWl0IHRoaXMuX2FwcGx5U21hcnREZWZhdWx0cyhkYXRhLCBzY2hlbWFJbmZvLnNtYXJ0RGVmYXVsdFJlY29yZCk7XG5cbiAgICAgIC8vIEFwcGx5IHByb21wdHNcbiAgICAgIGlmICh2YWxpZGF0aW9uT3B0aW9ucy53aXRoUHJvbXB0cykge1xuICAgICAgICBjb25zdCB2aXNpdG9yOiBKc29uVmlzaXRvciA9ICh2YWx1ZSwgcG9pbnRlcikgPT4ge1xuICAgICAgICAgIGlmICh2YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB2YWxpZGF0aW9uQ29udGV4dC5wcm9tcHRGaWVsZHNXaXRoVmFsdWUuYWRkKHBvaW50ZXIpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICAgICAgfTtcbiAgICAgICAgaWYgKHR5cGVvZiBzY2hlbWEgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgYXdhaXQgdmlzaXRKc29uKGRhdGEsIHZpc2l0b3IsIHNjaGVtYSwgdGhpcy5fcmVzb2x2ZXIuYmluZCh0aGlzKSwgdmFsaWRhdG9yKS50b1Byb21pc2UoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGRlZmluaXRpb25zID0gc2NoZW1hSW5mby5wcm9tcHREZWZpbml0aW9ucy5maWx0ZXIoXG4gICAgICAgICAgKGRlZikgPT4gIXZhbGlkYXRpb25Db250ZXh0LnByb21wdEZpZWxkc1dpdGhWYWx1ZS5oYXMoZGVmLmlkKSxcbiAgICAgICAgKTtcblxuICAgICAgICBpZiAoZGVmaW5pdGlvbnMubGVuZ3RoID4gMCkge1xuICAgICAgICAgIGF3YWl0IHRoaXMuX2FwcGx5UHJvbXB0cyhkYXRhLCBkZWZpbml0aW9ucyk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gVmFsaWRhdGUgdXNpbmcgYWp2XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBzdWNjZXNzID0gYXdhaXQgdmFsaWRhdG9yLmNhbGwodmFsaWRhdGlvbkNvbnRleHQsIGRhdGEpO1xuXG4gICAgICAgIGlmICghc3VjY2Vzcykge1xuICAgICAgICAgIHJldHVybiB7IGRhdGEsIHN1Y2Nlc3MsIGVycm9yczogdmFsaWRhdG9yLmVycm9ycyA/PyBbXSB9O1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBBanYuVmFsaWRhdGlvbkVycm9yKSB7XG4gICAgICAgICAgcmV0dXJuIHsgZGF0YSwgc3VjY2VzczogZmFsc2UsIGVycm9yczogZXJyb3IuZXJyb3JzIH07XG4gICAgICAgIH1cblxuICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgIH1cblxuICAgICAgLy8gQXBwbHkgcG9zdC12YWxpZGF0aW9uIHRyYW5zZm9ybXNcbiAgICAgIGlmICh2YWxpZGF0aW9uT3B0aW9ucy5hcHBseVBvc3RUcmFuc2Zvcm1zKSB7XG4gICAgICAgIGZvciAoY29uc3QgdmlzaXRvciBvZiB0aGlzLl9wb3N0LnZhbHVlcygpKSB7XG4gICAgICAgICAgZGF0YSA9IGF3YWl0IHZpc2l0SnNvbihcbiAgICAgICAgICAgIGRhdGEsXG4gICAgICAgICAgICB2aXNpdG9yLFxuICAgICAgICAgICAgc2NoZW1hLFxuICAgICAgICAgICAgdGhpcy5fcmVzb2x2ZXIuYmluZCh0aGlzKSxcbiAgICAgICAgICAgIHZhbGlkYXRvcixcbiAgICAgICAgICApLnRvUHJvbWlzZSgpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB7IGRhdGEsIHN1Y2Nlc3M6IHRydWUgfTtcbiAgICB9O1xuICB9XG5cbiAgYWRkRm9ybWF0KGZvcm1hdDogU2NoZW1hRm9ybWF0KTogdm9pZCB7XG4gICAgdGhpcy5fYWp2LmFkZEZvcm1hdChmb3JtYXQubmFtZSwgZm9ybWF0LmZvcm1hdHRlcik7XG4gIH1cblxuICBhZGRTbWFydERlZmF1bHRQcm92aWRlcjxUPihzb3VyY2U6IHN0cmluZywgcHJvdmlkZXI6IFNtYXJ0RGVmYXVsdFByb3ZpZGVyPFQ+KSB7XG4gICAgaWYgKHRoaXMuX3NvdXJjZU1hcC5oYXMoc291cmNlKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKHNvdXJjZSk7XG4gICAgfVxuXG4gICAgdGhpcy5fc291cmNlTWFwLnNldChzb3VyY2UsIHByb3ZpZGVyIGFzIHVua25vd24gYXMgU21hcnREZWZhdWx0UHJvdmlkZXI8e30+KTtcblxuICAgIGlmICghdGhpcy5fc21hcnREZWZhdWx0S2V5d29yZCkge1xuICAgICAgdGhpcy5fc21hcnREZWZhdWx0S2V5d29yZCA9IHRydWU7XG5cbiAgICAgIHRoaXMuX2Fqdi5hZGRLZXl3b3JkKHtcbiAgICAgICAga2V5d29yZDogJyRkZWZhdWx0JyxcbiAgICAgICAgZXJyb3JzOiBmYWxzZSxcbiAgICAgICAgdmFsaWQ6IHRydWUsXG4gICAgICAgIGNvbXBpbGU6IChzY2hlbWEsIF9wYXJlbnRTY2hlbWEsIGl0KSA9PiB7XG4gICAgICAgICAgY29uc3QgY29tcGlsYXRpb25TY2hlbUluZm8gPSB0aGlzLl9jdXJyZW50Q29tcGlsYXRpb25TY2hlbWFJbmZvO1xuICAgICAgICAgIGlmIChjb21waWxhdGlvblNjaGVtSW5mbyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICByZXR1cm4gKCkgPT4gdHJ1ZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBXZSBjaGVhdCwgaGVhdmlseS5cbiAgICAgICAgICBjb25zdCBwYXRoQXJyYXkgPSB0aGlzLm5vcm1hbGl6ZURhdGFQYXRoQXJyKGl0KTtcbiAgICAgICAgICBjb21waWxhdGlvblNjaGVtSW5mby5zbWFydERlZmF1bHRSZWNvcmQuc2V0KEpTT04uc3RyaW5naWZ5KHBhdGhBcnJheSksIHNjaGVtYSk7XG5cbiAgICAgICAgICByZXR1cm4gKCkgPT4gdHJ1ZTtcbiAgICAgICAgfSxcbiAgICAgICAgbWV0YVNjaGVtYToge1xuICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICckc291cmNlJzogeyB0eXBlOiAnc3RyaW5nJyB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgYWRkaXRpb25hbFByb3BlcnRpZXM6IHRydWUsXG4gICAgICAgICAgcmVxdWlyZWQ6IFsnJHNvdXJjZSddLFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgcmVnaXN0ZXJVcmlIYW5kbGVyKGhhbmRsZXI6IFVyaUhhbmRsZXIpIHtcbiAgICB0aGlzLl91cmlIYW5kbGVycy5hZGQoaGFuZGxlcik7XG4gIH1cblxuICB1c2VQcm9tcHRQcm92aWRlcihwcm92aWRlcjogUHJvbXB0UHJvdmlkZXIpIHtcbiAgICBjb25zdCBpc1NldHVwID0gISF0aGlzLl9wcm9tcHRQcm92aWRlcjtcblxuICAgIHRoaXMuX3Byb21wdFByb3ZpZGVyID0gcHJvdmlkZXI7XG5cbiAgICBpZiAoaXNTZXR1cCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuX2Fqdi5hZGRLZXl3b3JkKHtcbiAgICAgIGtleXdvcmQ6ICd4LXByb21wdCcsXG4gICAgICBlcnJvcnM6IGZhbHNlLFxuICAgICAgdmFsaWQ6IHRydWUsXG4gICAgICBjb21waWxlOiAoc2NoZW1hLCBwYXJlbnRTY2hlbWEsIGl0KSA9PiB7XG4gICAgICAgIGNvbnN0IGNvbXBpbGF0aW9uU2NoZW1JbmZvID0gdGhpcy5fY3VycmVudENvbXBpbGF0aW9uU2NoZW1hSW5mbztcbiAgICAgICAgaWYgKCFjb21waWxhdGlvblNjaGVtSW5mbykge1xuICAgICAgICAgIHJldHVybiAoKSA9PiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcGF0aCA9ICcvJyArIHRoaXMubm9ybWFsaXplRGF0YVBhdGhBcnIoaXQpLmpvaW4oJy8nKTtcblxuICAgICAgICBsZXQgdHlwZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgICAgICBsZXQgaXRlbXM6IEFycmF5PHN0cmluZyB8IHsgbGFiZWw6IHN0cmluZzsgdmFsdWU6IHN0cmluZyB8IG51bWJlciB8IGJvb2xlYW4gfT4gfCB1bmRlZmluZWQ7XG4gICAgICAgIGxldCBtZXNzYWdlOiBzdHJpbmc7XG4gICAgICAgIGlmICh0eXBlb2Ygc2NoZW1hID09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgbWVzc2FnZSA9IHNjaGVtYTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBtZXNzYWdlID0gc2NoZW1hLm1lc3NhZ2U7XG4gICAgICAgICAgdHlwZSA9IHNjaGVtYS50eXBlO1xuICAgICAgICAgIGl0ZW1zID0gc2NoZW1hLml0ZW1zO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcHJvcGVydHlUeXBlcyA9IGdldFR5cGVzT2ZTY2hlbWEocGFyZW50U2NoZW1hIGFzIEpzb25PYmplY3QpO1xuICAgICAgICBpZiAoIXR5cGUpIHtcbiAgICAgICAgICBpZiAocHJvcGVydHlUeXBlcy5zaXplID09PSAxICYmIHByb3BlcnR5VHlwZXMuaGFzKCdib29sZWFuJykpIHtcbiAgICAgICAgICAgIHR5cGUgPSAnY29uZmlybWF0aW9uJztcbiAgICAgICAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoKHBhcmVudFNjaGVtYSBhcyBKc29uT2JqZWN0KS5lbnVtKSkge1xuICAgICAgICAgICAgdHlwZSA9ICdsaXN0JztcbiAgICAgICAgICB9IGVsc2UgaWYgKFxuICAgICAgICAgICAgcHJvcGVydHlUeXBlcy5zaXplID09PSAxICYmXG4gICAgICAgICAgICBwcm9wZXJ0eVR5cGVzLmhhcygnYXJyYXknKSAmJlxuICAgICAgICAgICAgKHBhcmVudFNjaGVtYSBhcyBKc29uT2JqZWN0KS5pdGVtcyAmJlxuICAgICAgICAgICAgQXJyYXkuaXNBcnJheSgoKHBhcmVudFNjaGVtYSBhcyBKc29uT2JqZWN0KS5pdGVtcyBhcyBKc29uT2JqZWN0KS5lbnVtKVxuICAgICAgICAgICkge1xuICAgICAgICAgICAgdHlwZSA9ICdsaXN0JztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdHlwZSA9ICdpbnB1dCc7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgbGV0IG11bHRpc2VsZWN0O1xuICAgICAgICBpZiAodHlwZSA9PT0gJ2xpc3QnKSB7XG4gICAgICAgICAgbXVsdGlzZWxlY3QgPVxuICAgICAgICAgICAgc2NoZW1hLm11bHRpc2VsZWN0ID09PSB1bmRlZmluZWRcbiAgICAgICAgICAgICAgPyBwcm9wZXJ0eVR5cGVzLnNpemUgPT09IDEgJiYgcHJvcGVydHlUeXBlcy5oYXMoJ2FycmF5JylcbiAgICAgICAgICAgICAgOiBzY2hlbWEubXVsdGlzZWxlY3Q7XG5cbiAgICAgICAgICBjb25zdCBlbnVtVmFsdWVzID0gbXVsdGlzZWxlY3RcbiAgICAgICAgICAgID8gKHBhcmVudFNjaGVtYSBhcyBKc29uT2JqZWN0KS5pdGVtcyAmJlxuICAgICAgICAgICAgICAoKHBhcmVudFNjaGVtYSBhcyBKc29uT2JqZWN0KS5pdGVtcyBhcyBKc29uT2JqZWN0KS5lbnVtXG4gICAgICAgICAgICA6IChwYXJlbnRTY2hlbWEgYXMgSnNvbk9iamVjdCkuZW51bTtcbiAgICAgICAgICBpZiAoIWl0ZW1zICYmIEFycmF5LmlzQXJyYXkoZW51bVZhbHVlcykpIHtcbiAgICAgICAgICAgIGl0ZW1zID0gW107XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHZhbHVlIG9mIGVudW1WYWx1ZXMpIHtcbiAgICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIGl0ZW1zLnB1c2godmFsdWUpO1xuICAgICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiB2YWx1ZSA9PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgIC8vIEludmFsaWRcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpdGVtcy5wdXNoKHsgbGFiZWw6IHZhbHVlLnRvU3RyaW5nKCksIHZhbHVlIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZGVmaW5pdGlvbjogUHJvbXB0RGVmaW5pdGlvbiA9IHtcbiAgICAgICAgICBpZDogcGF0aCxcbiAgICAgICAgICB0eXBlLFxuICAgICAgICAgIG1lc3NhZ2UsXG4gICAgICAgICAgcmF3OiBzY2hlbWEsXG4gICAgICAgICAgaXRlbXMsXG4gICAgICAgICAgbXVsdGlzZWxlY3QsXG4gICAgICAgICAgcHJvcGVydHlUeXBlcyxcbiAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgdHlwZW9mIChwYXJlbnRTY2hlbWEgYXMgSnNvbk9iamVjdCkuZGVmYXVsdCA9PSAnb2JqZWN0JyAmJlxuICAgICAgICAgICAgKHBhcmVudFNjaGVtYSBhcyBKc29uT2JqZWN0KS5kZWZhdWx0ICE9PSBudWxsICYmXG4gICAgICAgICAgICAhQXJyYXkuaXNBcnJheSgocGFyZW50U2NoZW1hIGFzIEpzb25PYmplY3QpLmRlZmF1bHQpXG4gICAgICAgICAgICAgID8gdW5kZWZpbmVkXG4gICAgICAgICAgICAgIDogKChwYXJlbnRTY2hlbWEgYXMgSnNvbk9iamVjdCkuZGVmYXVsdCBhcyBzdHJpbmdbXSksXG4gICAgICAgICAgYXN5bmMgdmFsaWRhdG9yKGRhdGE6IEpzb25WYWx1ZSk6IFByb21pc2U8Ym9vbGVhbiB8IHN0cmluZz4ge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgaXQuc2VsZi52YWxpZGF0ZShwYXJlbnRTY2hlbWEsIGRhdGEpO1xuICAgICAgICAgICAgICAvLyBJZiB0aGUgc2NoZW1hIGlzIHN5bmMgdGhlbiBmYWxzZSB3aWxsIGJlIHJldHVybmVkIG9uIHZhbGlkYXRpb24gZmFpbHVyZVxuICAgICAgICAgICAgICBpZiAocmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdCBhcyBib29sZWFuIHwgc3RyaW5nO1xuICAgICAgICAgICAgICB9IGVsc2UgaWYgKGl0LnNlbGYuZXJyb3JzPy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAvLyBWYWxpZGF0aW9uIGVycm9ycyB3aWxsIGJlIHByZXNlbnQgb24gdGhlIEFqdiBpbnN0YW5jZSB3aGVuIHN5bmNcbiAgICAgICAgICAgICAgICByZXR1cm4gaXQuc2VsZi5lcnJvcnNbMF0ubWVzc2FnZSBhcyBzdHJpbmc7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgY29uc3QgdmFsaWRhdGlvbkVycm9yID0gZSBhcyB7IGVycm9ycz86IEVycm9yW10gfTtcbiAgICAgICAgICAgICAgLy8gSWYgdGhlIHNjaGVtYSBpcyBhc3luYyB0aGVuIGFuIGVycm9yIHdpbGwgYmUgdGhyb3duIG9uIHZhbGlkYXRpb24gZmFpbHVyZVxuICAgICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWxpZGF0aW9uRXJyb3IuZXJyb3JzKSAmJiB2YWxpZGF0aW9uRXJyb3IuZXJyb3JzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB2YWxpZGF0aW9uRXJyb3IuZXJyb3JzWzBdLm1lc3NhZ2U7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIH0sXG4gICAgICAgIH07XG5cbiAgICAgICAgY29tcGlsYXRpb25TY2hlbUluZm8ucHJvbXB0RGVmaW5pdGlvbnMucHVzaChkZWZpbml0aW9uKTtcblxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKHRoaXM6IHsgcHJvbXB0RmllbGRzV2l0aFZhbHVlOiBTZXQ8c3RyaW5nPiB9KSB7XG4gICAgICAgICAgLy8gSWYgJ3RoaXMnIGlzIHVuZGVmaW5lZCBpbiB0aGUgY2FsbCwgdGhlbiBpdCBkZWZhdWx0cyB0byB0aGUgZ2xvYmFsXG4gICAgICAgICAgLy8gJ3RoaXMnLlxuICAgICAgICAgIGlmICh0aGlzICYmIHRoaXMucHJvbXB0RmllbGRzV2l0aFZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLnByb21wdEZpZWxkc1dpdGhWYWx1ZS5hZGQocGF0aCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH07XG4gICAgICB9LFxuICAgICAgbWV0YVNjaGVtYToge1xuICAgICAgICBvbmVPZjogW1xuICAgICAgICAgIHsgdHlwZTogJ3N0cmluZycgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgJ3R5cGUnOiB7IHR5cGU6ICdzdHJpbmcnIH0sXG4gICAgICAgICAgICAgICdtZXNzYWdlJzogeyB0eXBlOiAnc3RyaW5nJyB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiB0cnVlLFxuICAgICAgICAgICAgcmVxdWlyZWQ6IFsnbWVzc2FnZSddLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBfYXBwbHlQcm9tcHRzKGRhdGE6IEpzb25WYWx1ZSwgcHJvbXB0czogQXJyYXk8UHJvbXB0RGVmaW5pdGlvbj4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBwcm92aWRlciA9IHRoaXMuX3Byb21wdFByb3ZpZGVyO1xuICAgIGlmICghcHJvdmlkZXIpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBhbnN3ZXJzID0gYXdhaXQgZnJvbShwcm92aWRlcihwcm9tcHRzKSkudG9Qcm9taXNlKCk7XG4gICAgZm9yIChjb25zdCBwYXRoIGluIGFuc3dlcnMpIHtcbiAgICAgIGNvbnN0IHBhdGhGcmFnbWVudHMgPSBwYXRoLnNwbGl0KCcvJykuc2xpY2UoMSk7XG5cbiAgICAgIENvcmVTY2hlbWFSZWdpc3RyeS5fc2V0KGRhdGEsIHBhdGhGcmFnbWVudHMsIGFuc3dlcnNbcGF0aF0sIG51bGwsIHVuZGVmaW5lZCwgdHJ1ZSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBzdGF0aWMgX3NldChcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgIGRhdGE6IGFueSxcbiAgICBmcmFnbWVudHM6IHN0cmluZ1tdLFxuICAgIHZhbHVlOiB1bmtub3duLFxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgcGFyZW50OiBhbnkgPSBudWxsLFxuICAgIHBhcmVudFByb3BlcnR5Pzogc3RyaW5nLFxuICAgIGZvcmNlPzogYm9vbGVhbixcbiAgKTogdm9pZCB7XG4gICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IGZyYWdtZW50cy5sZW5ndGg7IGluZGV4KyspIHtcbiAgICAgIGNvbnN0IGZyYWdtZW50ID0gZnJhZ21lbnRzW2luZGV4XTtcbiAgICAgIGlmICgvXmlcXGQrJC8udGVzdChmcmFnbWVudCkpIHtcbiAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KGRhdGEpKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgZGF0YUluZGV4ID0gMDsgZGF0YUluZGV4IDwgZGF0YS5sZW5ndGg7IGRhdGFJbmRleCsrKSB7XG4gICAgICAgICAgQ29yZVNjaGVtYVJlZ2lzdHJ5Ll9zZXQoXG4gICAgICAgICAgICBkYXRhW2RhdGFJbmRleF0sXG4gICAgICAgICAgICBmcmFnbWVudHMuc2xpY2UoaW5kZXggKyAxKSxcbiAgICAgICAgICAgIHZhbHVlLFxuICAgICAgICAgICAgZGF0YSxcbiAgICAgICAgICAgIGAke2RhdGFJbmRleH1gLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmICghZGF0YSAmJiBwYXJlbnQgIT09IG51bGwgJiYgcGFyZW50UHJvcGVydHkpIHtcbiAgICAgICAgZGF0YSA9IHBhcmVudFtwYXJlbnRQcm9wZXJ0eV0gPSB7fTtcbiAgICAgIH1cblxuICAgICAgcGFyZW50ID0gZGF0YTtcbiAgICAgIHBhcmVudFByb3BlcnR5ID0gZnJhZ21lbnQ7XG4gICAgICBkYXRhID0gZGF0YVtmcmFnbWVudF07XG4gICAgfVxuXG4gICAgaWYgKHBhcmVudCAmJiBwYXJlbnRQcm9wZXJ0eSAmJiAoZm9yY2UgfHwgcGFyZW50W3BhcmVudFByb3BlcnR5XSA9PT0gdW5kZWZpbmVkKSkge1xuICAgICAgcGFyZW50W3BhcmVudFByb3BlcnR5XSA9IHZhbHVlO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgX2FwcGx5U21hcnREZWZhdWx0czxUPihcbiAgICBkYXRhOiBULFxuICAgIHNtYXJ0RGVmYXVsdHM6IE1hcDxzdHJpbmcsIEpzb25PYmplY3Q+LFxuICApOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBmb3IgKGNvbnN0IFtwb2ludGVyLCBzY2hlbWFdIG9mIHNtYXJ0RGVmYXVsdHMuZW50cmllcygpKSB7XG4gICAgICBjb25zdCBmcmFnbWVudHMgPSBKU09OLnBhcnNlKHBvaW50ZXIpO1xuICAgICAgY29uc3Qgc291cmNlID0gdGhpcy5fc291cmNlTWFwLmdldChzY2hlbWEuJHNvdXJjZSBhcyBzdHJpbmcpO1xuICAgICAgaWYgKCFzb3VyY2UpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGxldCB2YWx1ZSA9IHNvdXJjZShzY2hlbWEpO1xuICAgICAgaWYgKGlzT2JzZXJ2YWJsZTx7fT4odmFsdWUpKSB7XG4gICAgICAgIHZhbHVlID0gYXdhaXQgdmFsdWUudG9Qcm9taXNlKCk7XG4gICAgICB9XG5cbiAgICAgIENvcmVTY2hlbWFSZWdpc3RyeS5fc2V0KGRhdGEsIGZyYWdtZW50cywgdmFsdWUpO1xuICAgIH1cbiAgfVxuXG4gIHVzZVhEZXByZWNhdGVkUHJvdmlkZXIob25Vc2FnZTogKG1lc3NhZ2U6IHN0cmluZykgPT4gdm9pZCk6IHZvaWQge1xuICAgIHRoaXMuX2Fqdi5hZGRLZXl3b3JkKHtcbiAgICAgIGtleXdvcmQ6ICd4LWRlcHJlY2F0ZWQnLFxuICAgICAgdmFsaWRhdGU6IChzY2hlbWEsIF9kYXRhLCBfcGFyZW50U2NoZW1hLCBkYXRhQ3h0KSA9PiB7XG4gICAgICAgIGlmIChzY2hlbWEpIHtcbiAgICAgICAgICBvblVzYWdlKFxuICAgICAgICAgICAgYE9wdGlvbiBcIiR7ZGF0YUN4dD8ucGFyZW50RGF0YVByb3BlcnR5fVwiIGlzIGRlcHJlY2F0ZWQke1xuICAgICAgICAgICAgICB0eXBlb2Ygc2NoZW1hID09ICdzdHJpbmcnID8gJzogJyArIHNjaGVtYSA6ICcuJ1xuICAgICAgICAgICAgfWAsXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSxcbiAgICAgIGVycm9yczogZmFsc2UsXG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIG5vcm1hbGl6ZURhdGFQYXRoQXJyKGl0OiBTY2hlbWFPYmpDeHQpOiAobnVtYmVyIHwgc3RyaW5nKVtdIHtcbiAgICByZXR1cm4gaXQuZGF0YVBhdGhBcnJcbiAgICAgIC5zbGljZSgxLCBpdC5kYXRhTGV2ZWwgKyAxKVxuICAgICAgLm1hcCgocCkgPT4gKHR5cGVvZiBwID09PSAnbnVtYmVyJyA/IHAgOiBwLnN0ci5yZXBsYWNlKC9cIi9nLCAnJykpKTtcbiAgfVxufVxuIl19