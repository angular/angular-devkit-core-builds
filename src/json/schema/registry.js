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
                handlerResult = (0, rxjs_1.lastValueFrom)(handlerResult);
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
                    data = await (0, rxjs_1.lastValueFrom)((0, visitor_1.visitJson)(data, visitor, schema, this._resolver.bind(this), validator));
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
                    await (0, rxjs_1.lastValueFrom)((0, visitor_1.visitJson)(data, visitor, schema, this._resolver.bind(this), validator));
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
                    data = await (0, rxjs_1.lastValueFrom)((0, visitor_1.visitJson)(data, visitor, schema, this._resolver.bind(this), validator));
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
        const answers = await (0, rxjs_1.lastValueFrom)((0, rxjs_1.from)(provider(prompts)));
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
                value = (await (0, rxjs_1.lastValueFrom)(value));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVnaXN0cnkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9jb3JlL3NyYy9qc29uL3NjaGVtYS9yZWdpc3RyeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILDhDQUEwRDtBQUMxRCw4REFBd0M7QUFDeEMsMkNBQTZCO0FBQzdCLDZDQUErQjtBQUMvQiwrQkFBcUU7QUFDckUseUNBQTJCO0FBQzNCLCtDQUFnRDtBQUNoRCx1Q0FBNEQ7QUFDNUQsb0NBQTBFO0FBZTFFLHVDQUE2QztBQUM3Qyx1Q0FBdUQ7QUFNdkQsTUFBYSx5QkFBMEIsU0FBUSx5QkFBYTtJQUcxRCxZQUNFLE1BQStCLEVBQy9CLFdBQVcsR0FBRyxxREFBcUQ7UUFFbkUsSUFBSSxDQUFDLE1BQU0sSUFBSSxNQUFNLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtZQUNsQyxLQUFLLENBQUMsMkJBQTJCLENBQUMsQ0FBQztZQUNuQyxJQUFJLENBQUMsTUFBTSxHQUFHLEVBQUUsQ0FBQztZQUVqQixPQUFPO1NBQ1I7UUFFRCxNQUFNLFFBQVEsR0FBRyx5QkFBeUIsQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDbEUsS0FBSyxDQUFDLEdBQUcsV0FBVyxPQUFPLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ3BELElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO0lBQ3ZCLENBQUM7SUFFTSxNQUFNLENBQUMsY0FBYyxDQUFDLE1BQStCO1FBQzFELElBQUksQ0FBQyxNQUFNLElBQUksTUFBTSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7WUFDbEMsT0FBTyxFQUFFLENBQUM7U0FDWDtRQUVELE1BQU0sUUFBUSxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMs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QUFDLE9BQU8sQ0FBQyxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3ZFLENBQUM7Q0FDRjtBQXBrQkQsZ0RBb2tCQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgQWp2LCB7IFNjaGVtYU9iakN4dCwgVmFsaWRhdGVGdW5jdGlvbiB9IGZyb20gJ2Fqdic7XG5pbXBvcnQgYWp2QWRkRm9ybWF0cyBmcm9tICdhanYtZm9ybWF0cyc7XG5pbXBvcnQgKiBhcyBodHRwIGZyb20gJ2h0dHAnO1xuaW1wb3J0ICogYXMgaHR0cHMgZnJvbSAnaHR0cHMnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZSwgZnJvbSwgaXNPYnNlcnZhYmxlLCBsYXN0VmFsdWVGcm9tIH0gZnJvbSAncnhqcyc7XG5pbXBvcnQgKiBhcyBVcmwgZnJvbSAndXJsJztcbmltcG9ydCB7IEJhc2VFeGNlcHRpb24gfSBmcm9tICcuLi8uLi9leGNlcHRpb24nO1xuaW1wb3J0IHsgUGFydGlhbGx5T3JkZXJlZFNldCwgZGVlcENvcHkgfSBmcm9tICcuLi8uLi91dGlscyc7XG5pbXBvcnQgeyBKc29uQXJyYXksIEpzb25PYmplY3QsIEpzb25WYWx1ZSwgaXNKc29uT2JqZWN0IH0gZnJvbSAnLi4vdXRpbHMnO1xuaW1wb3J0IHtcbiAgSnNvblBvaW50ZXIsXG4gIEpzb25WaXNpdG9yLFxuICBQcm9tcHREZWZpbml0aW9uLFxuICBQcm9tcHRQcm92aWRlcixcbiAgU2NoZW1hRm9ybWF0LFxuICBTY2hlbWFSZWdpc3RyeSxcbiAgU2NoZW1hVmFsaWRhdG9yLFxuICBTY2hlbWFWYWxpZGF0b3JFcnJvcixcbiAgU2NoZW1hVmFsaWRhdG9yT3B0aW9ucyxcbiAgU2NoZW1hVmFsaWRhdG9yUmVzdWx0LFxuICBTbWFydERlZmF1bHRQcm92aWRlcixcbn0gZnJvbSAnLi9pbnRlcmZhY2UnO1xuaW1wb3J0IHsgSnNvblNjaGVtYSB9IGZyb20gJy4vc2NoZW1hJztcbmltcG9ydCB7IGdldFR5cGVzT2ZTY2hlbWEgfSBmcm9tICcuL3V0aWxpdHknO1xuaW1wb3J0IHsgdmlzaXRKc29uLCB2aXNpdEpzb25TY2hlbWEgfSBmcm9tICcuL3Zpc2l0b3InO1xuXG5leHBvcnQgdHlwZSBVcmlIYW5kbGVyID0gKFxuICB1cmk6IHN0cmluZyxcbikgPT4gT2JzZXJ2YWJsZTxKc29uT2JqZWN0PiB8IFByb21pc2U8SnNvbk9iamVjdD4gfCBudWxsIHwgdW5kZWZpbmVkO1xuXG5leHBvcnQgY2xhc3MgU2NoZW1hVmFsaWRhdGlvbkV4Y2VwdGlvbiBleHRlbmRzIEJhc2VFeGNlcHRpb24ge1xuICBwdWJsaWMgcmVhZG9ubHkgZXJyb3JzOiBTY2hlbWFWYWxpZGF0b3JFcnJvcltdO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIGVycm9ycz86IFNjaGVtYVZhbGlkYXRvckVycm9yW10sXG4gICAgYmFzZU1lc3NhZ2UgPSAnU2NoZW1hIHZhbGlkYXRpb24gZmFpbGVkIHdpdGggdGhlIGZvbGxvd2luZyBlcnJvcnM6JyxcbiAgKSB7XG4gICAgaWYgKCFlcnJvcnMgfHwgZXJyb3JzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgc3VwZXIoJ1NjaGVtYSB2YWxpZGF0aW9uIGZhaWxlZC4nKTtcbiAgICAgIHRoaXMuZXJyb3JzID0gW107XG5cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBtZXNzYWdlcyA9IFNjaGVtYVZhbGlkYXRpb25FeGNlcHRpb24uY3JlYXRlTWVzc2FnZXMoZXJyb3JzKTtcbiAgICBzdXBlcihgJHtiYXNlTWVzc2FnZX1cXG4gICR7bWVzc2FnZXMuam9pbignXFxuICAnKX1gKTtcbiAgICB0aGlzLmVycm9ycyA9IGVycm9ycztcbiAgfVxuXG4gIHB1YmxpYyBzdGF0aWMgY3JlYXRlTWVzc2FnZXMoZXJyb3JzPzogU2NoZW1hVmFsaWRhdG9yRXJyb3JbXSk6IHN0cmluZ1tdIHtcbiAgICBpZiAoIWVycm9ycyB8fCBlcnJvcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuXG4gICAgY29uc3QgbWVzc2FnZXMgPSBlcnJvcnMubWFwKChlcnIpID0+IHtcbiAgICAgIGxldCBtZXNzYWdlID0gYERhdGEgcGF0aCAke0pTT04uc3RyaW5naWZ5KGVyci5pbnN0YW5jZVBhdGgpfSAke2Vyci5tZXNzYWdlfWA7XG4gICAgICBpZiAoZXJyLnBhcmFtcykge1xuICAgICAgICBzd2l0Y2ggKGVyci5rZXl3b3JkKSB7XG4gICAgICAgICAgY2FzZSAnYWRkaXRpb25hbFByb3BlcnRpZXMnOlxuICAgICAgICAgICAgbWVzc2FnZSArPSBgKCR7ZXJyLnBhcmFtcy5hZGRpdGlvbmFsUHJvcGVydHl9KWA7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIGNhc2UgJ2VudW0nOlxuICAgICAgICAgICAgbWVzc2FnZSArPSBgLiBBbGxvd2VkIHZhbHVlcyBhcmU6ICR7KGVyci5wYXJhbXMuYWxsb3dlZFZhbHVlcyBhcyBzdHJpbmdbXSB8IHVuZGVmaW5lZClcbiAgICAgICAgICAgICAgPy5tYXAoKHYpID0+IGBcIiR7dn1cImApXG4gICAgICAgICAgICAgIC5qb2luKCcsICcpfWA7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gbWVzc2FnZSArICcuJztcbiAgICB9KTtcblxuICAgIHJldHVybiBtZXNzYWdlcztcbiAgfVxufVxuXG5pbnRlcmZhY2UgU2NoZW1hSW5mbyB7XG4gIHNtYXJ0RGVmYXVsdFJlY29yZDogTWFwPHN0cmluZywgSnNvbk9iamVjdD47XG4gIHByb21wdERlZmluaXRpb25zOiBBcnJheTxQcm9tcHREZWZpbml0aW9uPjtcbn1cblxuZXhwb3J0IGNsYXNzIENvcmVTY2hlbWFSZWdpc3RyeSBpbXBsZW1lbnRzIFNjaGVtYVJlZ2lzdHJ5IHtcbiAgcHJpdmF0ZSBfYWp2OiBBanY7XG4gIHByaXZhdGUgX3VyaUNhY2hlID0gbmV3IE1hcDxzdHJpbmcsIEpzb25PYmplY3Q+KCk7XG4gIHByaXZhdGUgX3VyaUhhbmRsZXJzID0gbmV3IFNldDxVcmlIYW5kbGVyPigpO1xuICBwcml2YXRlIF9wcmUgPSBuZXcgUGFydGlhbGx5T3JkZXJlZFNldDxKc29uVmlzaXRvcj4oKTtcbiAgcHJpdmF0ZSBfcG9zdCA9IG5ldyBQYXJ0aWFsbHlPcmRlcmVkU2V0PEpzb25WaXNpdG9yPigpO1xuXG4gIHByaXZhdGUgX2N1cnJlbnRDb21waWxhdGlvblNjaGVtYUluZm8/OiBTY2hlbWFJbmZvO1xuXG4gIHByaXZhdGUgX3NtYXJ0RGVmYXVsdEtleXdvcmQgPSBmYWxzZTtcbiAgcHJpdmF0ZSBfcHJvbXB0UHJvdmlkZXI/OiBQcm9tcHRQcm92aWRlcjtcbiAgcHJpdmF0ZSBfc291cmNlTWFwID0gbmV3IE1hcDxzdHJpbmcsIFNtYXJ0RGVmYXVsdFByb3ZpZGVyPHt9Pj4oKTtcblxuICBjb25zdHJ1Y3Rvcihmb3JtYXRzOiBTY2hlbWFGb3JtYXRbXSA9IFtdKSB7XG4gICAgdGhpcy5fYWp2ID0gbmV3IEFqdih7XG4gICAgICBzdHJpY3Q6IGZhbHNlLFxuICAgICAgbG9hZFNjaGVtYTogKHVyaTogc3RyaW5nKSA9PiB0aGlzLl9mZXRjaCh1cmkpLFxuICAgICAgcGFzc0NvbnRleHQ6IHRydWUsXG4gICAgfSk7XG5cbiAgICBhanZBZGRGb3JtYXRzKHRoaXMuX2Fqdik7XG5cbiAgICBmb3IgKGNvbnN0IGZvcm1hdCBvZiBmb3JtYXRzKSB7XG4gICAgICB0aGlzLmFkZEZvcm1hdChmb3JtYXQpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgX2ZldGNoKHVyaTogc3RyaW5nKTogUHJvbWlzZTxKc29uT2JqZWN0PiB7XG4gICAgY29uc3QgbWF5YmVTY2hlbWEgPSB0aGlzLl91cmlDYWNoZS5nZXQodXJpKTtcblxuICAgIGlmIChtYXliZVNjaGVtYSkge1xuICAgICAgcmV0dXJuIG1heWJlU2NoZW1hO1xuICAgIH1cblxuICAgIC8vIFRyeSBhbGwgaGFuZGxlcnMsIG9uZSBhZnRlciB0aGUgb3RoZXIuXG4gICAgZm9yIChjb25zdCBoYW5kbGVyIG9mIHRoaXMuX3VyaUhhbmRsZXJzKSB7XG4gICAgICBsZXQgaGFuZGxlclJlc3VsdCA9IGhhbmRsZXIodXJpKTtcbiAgICAgIGlmIChoYW5kbGVyUmVzdWx0ID09PSBudWxsIHx8IGhhbmRsZXJSZXN1bHQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKGlzT2JzZXJ2YWJsZShoYW5kbGVyUmVzdWx0KSkge1xuICAgICAgICBoYW5kbGVyUmVzdWx0ID0gbGFzdFZhbHVlRnJvbShoYW5kbGVyUmVzdWx0KTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgdmFsdWUgPSBhd2FpdCBoYW5kbGVyUmVzdWx0O1xuICAgICAgdGhpcy5fdXJpQ2FjaGUuc2V0KHVyaSwgdmFsdWUpO1xuXG4gICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuXG4gICAgLy8gSWYgbm9uZSBhcmUgZm91bmQsIGhhbmRsZSB1c2luZyBodHRwIGNsaWVudC5cbiAgICByZXR1cm4gbmV3IFByb21pc2U8SnNvbk9iamVjdD4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgY29uc3QgdXJsID0gbmV3IFVybC5VUkwodXJpKTtcbiAgICAgIGNvbnN0IGNsaWVudCA9IHVybC5wcm90b2NvbCA9PT0gJ2h0dHBzOicgPyBodHRwcyA6IGh0dHA7XG4gICAgICBjbGllbnQuZ2V0KHVybCwgKHJlcykgPT4ge1xuICAgICAgICBpZiAoIXJlcy5zdGF0dXNDb2RlIHx8IHJlcy5zdGF0dXNDb2RlID49IDMwMCkge1xuICAgICAgICAgIC8vIENvbnN1bWUgdGhlIHJlc3Qgb2YgdGhlIGRhdGEgdG8gZnJlZSBtZW1vcnkuXG4gICAgICAgICAgcmVzLnJlc3VtZSgpO1xuICAgICAgICAgIHJlamVjdChuZXcgRXJyb3IoYFJlcXVlc3QgZmFpbGVkLiBTdGF0dXMgQ29kZTogJHtyZXMuc3RhdHVzQ29kZX1gKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVzLnNldEVuY29kaW5nKCd1dGY4Jyk7XG4gICAgICAgICAgbGV0IGRhdGEgPSAnJztcbiAgICAgICAgICByZXMub24oJ2RhdGEnLCAoY2h1bmspID0+IHtcbiAgICAgICAgICAgIGRhdGEgKz0gY2h1bms7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgcmVzLm9uKCdlbmQnLCAoKSA9PiB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICBjb25zdCBqc29uID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICAgICAgICAgICAgdGhpcy5fdXJpQ2FjaGUuc2V0KHVyaSwganNvbik7XG4gICAgICAgICAgICAgIHJlc29sdmUoanNvbik7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZCBhIHRyYW5zZm9ybWF0aW9uIHN0ZXAgYmVmb3JlIHRoZSB2YWxpZGF0aW9uIG9mIGFueSBKc29uLlxuICAgKiBAcGFyYW0ge0pzb25WaXNpdG9yfSB2aXNpdG9yIFRoZSB2aXNpdG9yIHRvIHRyYW5zZm9ybSBldmVyeSB2YWx1ZS5cbiAgICogQHBhcmFtIHtKc29uVmlzaXRvcltdfSBkZXBzIEEgbGlzdCBvZiBvdGhlciB2aXNpdG9ycyB0byBydW4gYmVmb3JlLlxuICAgKi9cbiAgYWRkUHJlVHJhbnNmb3JtKHZpc2l0b3I6IEpzb25WaXNpdG9yLCBkZXBzPzogSnNvblZpc2l0b3JbXSkge1xuICAgIHRoaXMuX3ByZS5hZGQodmlzaXRvciwgZGVwcyk7XG4gIH1cblxuICAvKipcbiAgICogQWRkIGEgdHJhbnNmb3JtYXRpb24gc3RlcCBhZnRlciB0aGUgdmFsaWRhdGlvbiBvZiBhbnkgSnNvbi4gVGhlIEpTT04gd2lsbCBub3QgYmUgdmFsaWRhdGVkXG4gICAqIGFmdGVyIHRoZSBQT1NULCBzbyBpZiB0cmFuc2Zvcm1hdGlvbnMgYXJlIG5vdCBjb21wYXRpYmxlIHdpdGggdGhlIFNjaGVtYSBpdCB3aWxsIG5vdCByZXN1bHRcbiAgICogaW4gYW4gZXJyb3IuXG4gICAqIEBwYXJhbSB7SnNvblZpc2l0b3J9IHZpc2l0b3IgVGhlIHZpc2l0b3IgdG8gdHJhbnNmb3JtIGV2ZXJ5IHZhbHVlLlxuICAgKiBAcGFyYW0ge0pzb25WaXNpdG9yW119IGRlcHMgQSBsaXN0IG9mIG90aGVyIHZpc2l0b3JzIHRvIHJ1biBiZWZvcmUuXG4gICAqL1xuICBhZGRQb3N0VHJhbnNmb3JtKHZpc2l0b3I6IEpzb25WaXNpdG9yLCBkZXBzPzogSnNvblZpc2l0b3JbXSkge1xuICAgIHRoaXMuX3Bvc3QuYWRkKHZpc2l0b3IsIGRlcHMpO1xuICB9XG5cbiAgcHJvdGVjdGVkIF9yZXNvbHZlcihcbiAgICByZWY6IHN0cmluZyxcbiAgICB2YWxpZGF0ZT86IFZhbGlkYXRlRnVuY3Rpb24sXG4gICk6IHsgY29udGV4dD86IFZhbGlkYXRlRnVuY3Rpb247IHNjaGVtYT86IEpzb25PYmplY3QgfSB7XG4gICAgaWYgKCF2YWxpZGF0ZSB8fCAhcmVmKSB7XG4gICAgICByZXR1cm4ge307XG4gICAgfVxuXG4gICAgY29uc3Qgc2NoZW1hID0gdmFsaWRhdGUuc2NoZW1hRW52LnJvb3Quc2NoZW1hO1xuICAgIGNvbnN0IGlkID0gdHlwZW9mIHNjaGVtYSA9PT0gJ29iamVjdCcgPyBzY2hlbWEuJGlkIDogbnVsbDtcblxuICAgIGxldCBmdWxsUmVmZXJlbmNlID0gcmVmO1xuICAgIGlmICh0eXBlb2YgaWQgPT09ICdzdHJpbmcnKSB7XG4gICAgICBmdWxsUmVmZXJlbmNlID0gVXJsLnJlc29sdmUoaWQsIHJlZik7XG5cbiAgICAgIGlmIChyZWYuc3RhcnRzV2l0aCgnIycpKSB7XG4gICAgICAgIGZ1bGxSZWZlcmVuY2UgPSBpZCArIGZ1bGxSZWZlcmVuY2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgcmVzb2x2ZWRTY2hlbWEgPSB0aGlzLl9hanYuZ2V0U2NoZW1hKGZ1bGxSZWZlcmVuY2UpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGNvbnRleHQ6IHJlc29sdmVkU2NoZW1hPy5zY2hlbWFFbnYudmFsaWRhdGUsXG4gICAgICBzY2hlbWE6IHJlc29sdmVkU2NoZW1hPy5zY2hlbWEgYXMgSnNvbk9iamVjdCxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIEZsYXR0ZW4gdGhlIFNjaGVtYSwgcmVzb2x2aW5nIGFuZCByZXBsYWNpbmcgYWxsIHRoZSByZWZzLiBNYWtlcyBpdCBpbnRvIGEgc3luY2hyb25vdXMgc2NoZW1hXG4gICAqIHRoYXQgaXMgYWxzbyBlYXNpZXIgdG8gdHJhdmVyc2UuIERvZXMgbm90IGNhY2hlIHRoZSByZXN1bHQuXG4gICAqXG4gICAqIFByb2R1Y2luZyBhIGZsYXR0ZW4gc2NoZW1hIGRvY3VtZW50IGRvZXMgbm90IGluIGFsbCBjYXNlcyBwcm9kdWNlIGEgc2NoZW1hIHdpdGggaWRlbnRpY2FsIGJlaGF2aW9yIHRvIHRoZSBvcmlnaW5hbC5cbiAgICogU2VlOiBodHRwczovL2pzb24tc2NoZW1hLm9yZy9kcmFmdC8yMDE5LTA5L2pzb24tc2NoZW1hLWNvcmUuaHRtbCNyZmMuYXBwZW5kaXguQi4yXG4gICAqXG4gICAqIEBwYXJhbSBzY2hlbWEgVGhlIHNjaGVtYSBvciBVUkkgdG8gZmxhdHRlbi5cbiAgICogQHJldHVybnMgQW4gT2JzZXJ2YWJsZSBvZiB0aGUgZmxhdHRlbmVkIHNjaGVtYSBvYmplY3QuXG4gICAqIEBwcml2YXRlIHNpbmNlIDExLjIgd2l0aG91dCByZXBsYWNlbWVudC5cbiAgICovXG4gIGFzeW5jIMm1ZmxhdHRlbihzY2hlbWE6IEpzb25PYmplY3QpOiBQcm9taXNlPEpzb25PYmplY3Q+IHtcbiAgICB0aGlzLl9hanYucmVtb3ZlU2NoZW1hKHNjaGVtYSk7XG4gICAgdGhpcy5fY3VycmVudENvbXBpbGF0aW9uU2NoZW1hSW5mbyA9IHVuZGVmaW5lZDtcbiAgICBjb25zdCB2YWxpZGF0ZSA9IGF3YWl0IHRoaXMuX2Fqdi5jb21waWxlQXN5bmMoc2NoZW1hKTtcblxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tdGhpcy1hbGlhc1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuXG4gICAgZnVuY3Rpb24gdmlzaXRvcihcbiAgICAgIGN1cnJlbnQ6IEpzb25PYmplY3QgfCBKc29uQXJyYXksXG4gICAgICBwb2ludGVyOiBKc29uUG9pbnRlcixcbiAgICAgIHBhcmVudFNjaGVtYT86IEpzb25PYmplY3QgfCBKc29uQXJyYXksXG4gICAgICBpbmRleD86IHN0cmluZyxcbiAgICApIHtcbiAgICAgIGlmIChcbiAgICAgICAgY3VycmVudCAmJlxuICAgICAgICBwYXJlbnRTY2hlbWEgJiZcbiAgICAgICAgaW5kZXggJiZcbiAgICAgICAgaXNKc29uT2JqZWN0KGN1cnJlbnQpICYmXG4gICAgICAgIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChjdXJyZW50LCAnJHJlZicpICYmXG4gICAgICAgIHR5cGVvZiBjdXJyZW50WyckcmVmJ10gPT0gJ3N0cmluZydcbiAgICAgICkge1xuICAgICAgICBjb25zdCByZXNvbHZlZCA9IHNlbGYuX3Jlc29sdmVyKGN1cnJlbnRbJyRyZWYnXSwgdmFsaWRhdGUpO1xuXG4gICAgICAgIGlmIChyZXNvbHZlZC5zY2hlbWEpIHtcbiAgICAgICAgICAocGFyZW50U2NoZW1hIGFzIEpzb25PYmplY3QpW2luZGV4XSA9IHJlc29sdmVkLnNjaGVtYTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHNjaGVtYUNvcHkgPSBkZWVwQ29weSh2YWxpZGF0ZS5zY2hlbWEgYXMgSnNvbk9iamVjdCk7XG4gICAgdmlzaXRKc29uU2NoZW1hKHNjaGVtYUNvcHksIHZpc2l0b3IpO1xuXG4gICAgcmV0dXJuIHNjaGVtYUNvcHk7XG4gIH1cblxuICAvKipcbiAgICogQ29tcGlsZSBhbmQgcmV0dXJuIGEgdmFsaWRhdGlvbiBmdW5jdGlvbiBmb3IgdGhlIFNjaGVtYS5cbiAgICpcbiAgICogQHBhcmFtIHNjaGVtYSBUaGUgc2NoZW1hIHRvIHZhbGlkYXRlLiBJZiBhIHN0cmluZywgd2lsbCBmZXRjaCB0aGUgc2NoZW1hIGJlZm9yZSBjb21waWxpbmcgaXRcbiAgICogKHVzaW5nIHNjaGVtYSBhcyBhIFVSSSkuXG4gICAqL1xuICBhc3luYyBjb21waWxlKHNjaGVtYTogSnNvblNjaGVtYSk6IFByb21pc2U8U2NoZW1hVmFsaWRhdG9yPiB7XG4gICAgY29uc3QgdmFsaWRhdGUgPSBhd2FpdCB0aGlzLl9jb21waWxlKHNjaGVtYSk7XG5cbiAgICByZXR1cm4gKHZhbHVlLCBvcHRpb25zKSA9PiB2YWxpZGF0ZSh2YWx1ZSwgb3B0aW9ucyk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIF9jb21waWxlKFxuICAgIHNjaGVtYTogSnNvblNjaGVtYSxcbiAgKTogUHJvbWlzZTxcbiAgICAoZGF0YTogSnNvblZhbHVlLCBvcHRpb25zPzogU2NoZW1hVmFsaWRhdG9yT3B0aW9ucykgPT4gUHJvbWlzZTxTY2hlbWFWYWxpZGF0b3JSZXN1bHQ+XG4gID4ge1xuICAgIGlmICh0eXBlb2Ygc2NoZW1hID09PSAnYm9vbGVhbicpIHtcbiAgICAgIHJldHVybiBhc3luYyAoZGF0YSkgPT4gKHsgc3VjY2Vzczogc2NoZW1hLCBkYXRhIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IHNjaGVtYUluZm86IFNjaGVtYUluZm8gPSB7XG4gICAgICBzbWFydERlZmF1bHRSZWNvcmQ6IG5ldyBNYXA8c3RyaW5nLCBKc29uT2JqZWN0PigpLFxuICAgICAgcHJvbXB0RGVmaW5pdGlvbnM6IFtdLFxuICAgIH07XG5cbiAgICB0aGlzLl9hanYucmVtb3ZlU2NoZW1hKHNjaGVtYSk7XG4gICAgbGV0IHZhbGlkYXRvcjogVmFsaWRhdGVGdW5jdGlvbjtcblxuICAgIHRyeSB7XG4gICAgICB0aGlzLl9jdXJyZW50Q29tcGlsYXRpb25TY2hlbWFJbmZvID0gc2NoZW1hSW5mbztcbiAgICAgIHZhbGlkYXRvciA9IHRoaXMuX2Fqdi5jb21waWxlKHNjaGVtYSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgLy8gVGhpcyBzaG91bGQgZXZlbnR1YWxseSBiZSByZWZhY3RvcmVkIHNvIHRoYXQgd2Ugd2UgaGFuZGxlIHJhY2UgY29uZGl0aW9uIHdoZXJlIHRoZSBzYW1lIHNjaGVtYSBpcyB2YWxpZGF0ZWQgYXQgdGhlIHNhbWUgdGltZS5cbiAgICAgIGlmICghKGUgaW5zdGFuY2VvZiBBanYuTWlzc2luZ1JlZkVycm9yKSkge1xuICAgICAgICB0aHJvdyBlO1xuICAgICAgfVxuXG4gICAgICB2YWxpZGF0b3IgPSBhd2FpdCB0aGlzLl9hanYuY29tcGlsZUFzeW5jKHNjaGVtYSk7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHRoaXMuX2N1cnJlbnRDb21waWxhdGlvblNjaGVtYUluZm8gPSB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIGFzeW5jIChkYXRhOiBKc29uVmFsdWUsIG9wdGlvbnM/OiBTY2hlbWFWYWxpZGF0b3JPcHRpb25zKSA9PiB7XG4gICAgICBjb25zdCB2YWxpZGF0aW9uT3B0aW9uczogU2NoZW1hVmFsaWRhdG9yT3B0aW9ucyA9IHtcbiAgICAgICAgd2l0aFByb21wdHM6IHRydWUsXG4gICAgICAgIGFwcGx5UG9zdFRyYW5zZm9ybXM6IHRydWUsXG4gICAgICAgIGFwcGx5UHJlVHJhbnNmb3JtczogdHJ1ZSxcbiAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgIH07XG4gICAgICBjb25zdCB2YWxpZGF0aW9uQ29udGV4dCA9IHtcbiAgICAgICAgcHJvbXB0RmllbGRzV2l0aFZhbHVlOiBuZXcgU2V0PHN0cmluZz4oKSxcbiAgICAgIH07XG5cbiAgICAgIC8vIEFwcGx5IHByZS12YWxpZGF0aW9uIHRyYW5zZm9ybXNcbiAgICAgIGlmICh2YWxpZGF0aW9uT3B0aW9ucy5hcHBseVByZVRyYW5zZm9ybXMpIHtcbiAgICAgICAgZm9yIChjb25zdCB2aXNpdG9yIG9mIHRoaXMuX3ByZS52YWx1ZXMoKSkge1xuICAgICAgICAgIGRhdGEgPSBhd2FpdCBsYXN0VmFsdWVGcm9tKFxuICAgICAgICAgICAgdmlzaXRKc29uKGRhdGEsIHZpc2l0b3IsIHNjaGVtYSwgdGhpcy5fcmVzb2x2ZXIuYmluZCh0aGlzKSwgdmFsaWRhdG9yKSxcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIEFwcGx5IHNtYXJ0IGRlZmF1bHRzXG4gICAgICBhd2FpdCB0aGlzLl9hcHBseVNtYXJ0RGVmYXVsdHMoZGF0YSwgc2NoZW1hSW5mby5zbWFydERlZmF1bHRSZWNvcmQpO1xuXG4gICAgICAvLyBBcHBseSBwcm9tcHRzXG4gICAgICBpZiAodmFsaWRhdGlvbk9wdGlvbnMud2l0aFByb21wdHMpIHtcbiAgICAgICAgY29uc3QgdmlzaXRvcjogSnNvblZpc2l0b3IgPSAodmFsdWUsIHBvaW50ZXIpID0+IHtcbiAgICAgICAgICBpZiAodmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgdmFsaWRhdGlvbkNvbnRleHQucHJvbXB0RmllbGRzV2l0aFZhbHVlLmFkZChwb2ludGVyKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICAgIH07XG4gICAgICAgIGlmICh0eXBlb2Ygc2NoZW1hID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgIGF3YWl0IGxhc3RWYWx1ZUZyb20oXG4gICAgICAgICAgICB2aXNpdEpzb24oZGF0YSwgdmlzaXRvciwgc2NoZW1hLCB0aGlzLl9yZXNvbHZlci5iaW5kKHRoaXMpLCB2YWxpZGF0b3IpLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBkZWZpbml0aW9ucyA9IHNjaGVtYUluZm8ucHJvbXB0RGVmaW5pdGlvbnMuZmlsdGVyKFxuICAgICAgICAgIChkZWYpID0+ICF2YWxpZGF0aW9uQ29udGV4dC5wcm9tcHRGaWVsZHNXaXRoVmFsdWUuaGFzKGRlZi5pZCksXG4gICAgICAgICk7XG5cbiAgICAgICAgaWYgKGRlZmluaXRpb25zLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICBhd2FpdCB0aGlzLl9hcHBseVByb21wdHMoZGF0YSwgZGVmaW5pdGlvbnMpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIFZhbGlkYXRlIHVzaW5nIGFqdlxuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3Qgc3VjY2VzcyA9IGF3YWl0IHZhbGlkYXRvci5jYWxsKHZhbGlkYXRpb25Db250ZXh0LCBkYXRhKTtcblxuICAgICAgICBpZiAoIXN1Y2Nlc3MpIHtcbiAgICAgICAgICByZXR1cm4geyBkYXRhLCBzdWNjZXNzLCBlcnJvcnM6IHZhbGlkYXRvci5lcnJvcnMgPz8gW10gfTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgaWYgKGVycm9yIGluc3RhbmNlb2YgQWp2LlZhbGlkYXRpb25FcnJvcikge1xuICAgICAgICAgIHJldHVybiB7IGRhdGEsIHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcnM6IGVycm9yLmVycm9ycyB9O1xuICAgICAgICB9XG5cbiAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICB9XG5cbiAgICAgIC8vIEFwcGx5IHBvc3QtdmFsaWRhdGlvbiB0cmFuc2Zvcm1zXG4gICAgICBpZiAodmFsaWRhdGlvbk9wdGlvbnMuYXBwbHlQb3N0VHJhbnNmb3Jtcykge1xuICAgICAgICBmb3IgKGNvbnN0IHZpc2l0b3Igb2YgdGhpcy5fcG9zdC52YWx1ZXMoKSkge1xuICAgICAgICAgIGRhdGEgPSBhd2FpdCBsYXN0VmFsdWVGcm9tKFxuICAgICAgICAgICAgdmlzaXRKc29uKGRhdGEsIHZpc2l0b3IsIHNjaGVtYSwgdGhpcy5fcmVzb2x2ZXIuYmluZCh0aGlzKSwgdmFsaWRhdG9yKSxcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB7IGRhdGEsIHN1Y2Nlc3M6IHRydWUgfTtcbiAgICB9O1xuICB9XG5cbiAgYWRkRm9ybWF0KGZvcm1hdDogU2NoZW1hRm9ybWF0KTogdm9pZCB7XG4gICAgdGhpcy5fYWp2LmFkZEZvcm1hdChmb3JtYXQubmFtZSwgZm9ybWF0LmZvcm1hdHRlcik7XG4gIH1cblxuICBhZGRTbWFydERlZmF1bHRQcm92aWRlcjxUPihzb3VyY2U6IHN0cmluZywgcHJvdmlkZXI6IFNtYXJ0RGVmYXVsdFByb3ZpZGVyPFQ+KSB7XG4gICAgaWYgKHRoaXMuX3NvdXJjZU1hcC5oYXMoc291cmNlKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKHNvdXJjZSk7XG4gICAgfVxuXG4gICAgdGhpcy5fc291cmNlTWFwLnNldChzb3VyY2UsIHByb3ZpZGVyIGFzIHVua25vd24gYXMgU21hcnREZWZhdWx0UHJvdmlkZXI8e30+KTtcblxuICAgIGlmICghdGhpcy5fc21hcnREZWZhdWx0S2V5d29yZCkge1xuICAgICAgdGhpcy5fc21hcnREZWZhdWx0S2V5d29yZCA9IHRydWU7XG5cbiAgICAgIHRoaXMuX2Fqdi5hZGRLZXl3b3JkKHtcbiAgICAgICAga2V5d29yZDogJyRkZWZhdWx0JyxcbiAgICAgICAgZXJyb3JzOiBmYWxzZSxcbiAgICAgICAgdmFsaWQ6IHRydWUsXG4gICAgICAgIGNvbXBpbGU6IChzY2hlbWEsIF9wYXJlbnRTY2hlbWEsIGl0KSA9PiB7XG4gICAgICAgICAgY29uc3QgY29tcGlsYXRpb25TY2hlbUluZm8gPSB0aGlzLl9jdXJyZW50Q29tcGlsYXRpb25TY2hlbWFJbmZvO1xuICAgICAgICAgIGlmIChjb21waWxhdGlvblNjaGVtSW5mbyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICByZXR1cm4gKCkgPT4gdHJ1ZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBXZSBjaGVhdCwgaGVhdmlseS5cbiAgICAgICAgICBjb25zdCBwYXRoQXJyYXkgPSB0aGlzLm5vcm1hbGl6ZURhdGFQYXRoQXJyKGl0KTtcbiAgICAgICAgICBjb21waWxhdGlvblNjaGVtSW5mby5zbWFydERlZmF1bHRSZWNvcmQuc2V0KEpTT04uc3RyaW5naWZ5KHBhdGhBcnJheSksIHNjaGVtYSk7XG5cbiAgICAgICAgICByZXR1cm4gKCkgPT4gdHJ1ZTtcbiAgICAgICAgfSxcbiAgICAgICAgbWV0YVNjaGVtYToge1xuICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICckc291cmNlJzogeyB0eXBlOiAnc3RyaW5nJyB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgYWRkaXRpb25hbFByb3BlcnRpZXM6IHRydWUsXG4gICAgICAgICAgcmVxdWlyZWQ6IFsnJHNvdXJjZSddLFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgcmVnaXN0ZXJVcmlIYW5kbGVyKGhhbmRsZXI6IFVyaUhhbmRsZXIpIHtcbiAgICB0aGlzLl91cmlIYW5kbGVycy5hZGQoaGFuZGxlcik7XG4gIH1cblxuICB1c2VQcm9tcHRQcm92aWRlcihwcm92aWRlcjogUHJvbXB0UHJvdmlkZXIpIHtcbiAgICBjb25zdCBpc1NldHVwID0gISF0aGlzLl9wcm9tcHRQcm92aWRlcjtcblxuICAgIHRoaXMuX3Byb21wdFByb3ZpZGVyID0gcHJvdmlkZXI7XG5cbiAgICBpZiAoaXNTZXR1cCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuX2Fqdi5hZGRLZXl3b3JkKHtcbiAgICAgIGtleXdvcmQ6ICd4LXByb21wdCcsXG4gICAgICBlcnJvcnM6IGZhbHNlLFxuICAgICAgdmFsaWQ6IHRydWUsXG4gICAgICBjb21waWxlOiAoc2NoZW1hLCBwYXJlbnRTY2hlbWEsIGl0KSA9PiB7XG4gICAgICAgIGNvbnN0IGNvbXBpbGF0aW9uU2NoZW1JbmZvID0gdGhpcy5fY3VycmVudENvbXBpbGF0aW9uU2NoZW1hSW5mbztcbiAgICAgICAgaWYgKCFjb21waWxhdGlvblNjaGVtSW5mbykge1xuICAgICAgICAgIHJldHVybiAoKSA9PiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcGF0aCA9ICcvJyArIHRoaXMubm9ybWFsaXplRGF0YVBhdGhBcnIoaXQpLmpvaW4oJy8nKTtcblxuICAgICAgICBsZXQgdHlwZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgICAgICBsZXQgaXRlbXM6IEFycmF5PHN0cmluZyB8IHsgbGFiZWw6IHN0cmluZzsgdmFsdWU6IHN0cmluZyB8IG51bWJlciB8IGJvb2xlYW4gfT4gfCB1bmRlZmluZWQ7XG4gICAgICAgIGxldCBtZXNzYWdlOiBzdHJpbmc7XG4gICAgICAgIGlmICh0eXBlb2Ygc2NoZW1hID09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgbWVzc2FnZSA9IHNjaGVtYTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBtZXNzYWdlID0gc2NoZW1hLm1lc3NhZ2U7XG4gICAgICAgICAgdHlwZSA9IHNjaGVtYS50eXBlO1xuICAgICAgICAgIGl0ZW1zID0gc2NoZW1hLml0ZW1zO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcHJvcGVydHlUeXBlcyA9IGdldFR5cGVzT2ZTY2hlbWEocGFyZW50U2NoZW1hIGFzIEpzb25PYmplY3QpO1xuICAgICAgICBpZiAoIXR5cGUpIHtcbiAgICAgICAgICBpZiAocHJvcGVydHlUeXBlcy5zaXplID09PSAxICYmIHByb3BlcnR5VHlwZXMuaGFzKCdib29sZWFuJykpIHtcbiAgICAgICAgICAgIHR5cGUgPSAnY29uZmlybWF0aW9uJztcbiAgICAgICAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoKHBhcmVudFNjaGVtYSBhcyBKc29uT2JqZWN0KS5lbnVtKSkge1xuICAgICAgICAgICAgdHlwZSA9ICdsaXN0JztcbiAgICAgICAgICB9IGVsc2UgaWYgKFxuICAgICAgICAgICAgcHJvcGVydHlUeXBlcy5zaXplID09PSAxICYmXG4gICAgICAgICAgICBwcm9wZXJ0eVR5cGVzLmhhcygnYXJyYXknKSAmJlxuICAgICAgICAgICAgKHBhcmVudFNjaGVtYSBhcyBKc29uT2JqZWN0KS5pdGVtcyAmJlxuICAgICAgICAgICAgQXJyYXkuaXNBcnJheSgoKHBhcmVudFNjaGVtYSBhcyBKc29uT2JqZWN0KS5pdGVtcyBhcyBKc29uT2JqZWN0KS5lbnVtKVxuICAgICAgICAgICkge1xuICAgICAgICAgICAgdHlwZSA9ICdsaXN0JztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdHlwZSA9ICdpbnB1dCc7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgbGV0IG11bHRpc2VsZWN0O1xuICAgICAgICBpZiAodHlwZSA9PT0gJ2xpc3QnKSB7XG4gICAgICAgICAgbXVsdGlzZWxlY3QgPVxuICAgICAgICAgICAgc2NoZW1hLm11bHRpc2VsZWN0ID09PSB1bmRlZmluZWRcbiAgICAgICAgICAgICAgPyBwcm9wZXJ0eVR5cGVzLnNpemUgPT09IDEgJiYgcHJvcGVydHlUeXBlcy5oYXMoJ2FycmF5JylcbiAgICAgICAgICAgICAgOiBzY2hlbWEubXVsdGlzZWxlY3Q7XG5cbiAgICAgICAgICBjb25zdCBlbnVtVmFsdWVzID0gbXVsdGlzZWxlY3RcbiAgICAgICAgICAgID8gKHBhcmVudFNjaGVtYSBhcyBKc29uT2JqZWN0KS5pdGVtcyAmJlxuICAgICAgICAgICAgICAoKHBhcmVudFNjaGVtYSBhcyBKc29uT2JqZWN0KS5pdGVtcyBhcyBKc29uT2JqZWN0KS5lbnVtXG4gICAgICAgICAgICA6IChwYXJlbnRTY2hlbWEgYXMgSnNvbk9iamVjdCkuZW51bTtcbiAgICAgICAgICBpZiAoIWl0ZW1zICYmIEFycmF5LmlzQXJyYXkoZW51bVZhbHVlcykpIHtcbiAgICAgICAgICAgIGl0ZW1zID0gW107XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHZhbHVlIG9mIGVudW1WYWx1ZXMpIHtcbiAgICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIGl0ZW1zLnB1c2godmFsdWUpO1xuICAgICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiB2YWx1ZSA9PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgIC8vIEludmFsaWRcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpdGVtcy5wdXNoKHsgbGFiZWw6IHZhbHVlLnRvU3RyaW5nKCksIHZhbHVlIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZGVmaW5pdGlvbjogUHJvbXB0RGVmaW5pdGlvbiA9IHtcbiAgICAgICAgICBpZDogcGF0aCxcbiAgICAgICAgICB0eXBlLFxuICAgICAgICAgIG1lc3NhZ2UsXG4gICAgICAgICAgcmF3OiBzY2hlbWEsXG4gICAgICAgICAgaXRlbXMsXG4gICAgICAgICAgbXVsdGlzZWxlY3QsXG4gICAgICAgICAgcHJvcGVydHlUeXBlcyxcbiAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgdHlwZW9mIChwYXJlbnRTY2hlbWEgYXMgSnNvbk9iamVjdCkuZGVmYXVsdCA9PSAnb2JqZWN0JyAmJlxuICAgICAgICAgICAgKHBhcmVudFNjaGVtYSBhcyBKc29uT2JqZWN0KS5kZWZhdWx0ICE9PSBudWxsICYmXG4gICAgICAgICAgICAhQXJyYXkuaXNBcnJheSgocGFyZW50U2NoZW1hIGFzIEpzb25PYmplY3QpLmRlZmF1bHQpXG4gICAgICAgICAgICAgID8gdW5kZWZpbmVkXG4gICAgICAgICAgICAgIDogKChwYXJlbnRTY2hlbWEgYXMgSnNvbk9iamVjdCkuZGVmYXVsdCBhcyBzdHJpbmdbXSksXG4gICAgICAgICAgYXN5bmMgdmFsaWRhdG9yKGRhdGE6IEpzb25WYWx1ZSk6IFByb21pc2U8Ym9vbGVhbiB8IHN0cmluZz4ge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgaXQuc2VsZi52YWxpZGF0ZShwYXJlbnRTY2hlbWEsIGRhdGEpO1xuICAgICAgICAgICAgICAvLyBJZiB0aGUgc2NoZW1hIGlzIHN5bmMgdGhlbiBmYWxzZSB3aWxsIGJlIHJldHVybmVkIG9uIHZhbGlkYXRpb24gZmFpbHVyZVxuICAgICAgICAgICAgICBpZiAocmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdCBhcyBib29sZWFuIHwgc3RyaW5nO1xuICAgICAgICAgICAgICB9IGVsc2UgaWYgKGl0LnNlbGYuZXJyb3JzPy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAvLyBWYWxpZGF0aW9uIGVycm9ycyB3aWxsIGJlIHByZXNlbnQgb24gdGhlIEFqdiBpbnN0YW5jZSB3aGVuIHN5bmNcbiAgICAgICAgICAgICAgICByZXR1cm4gaXQuc2VsZi5lcnJvcnNbMF0ubWVzc2FnZSBhcyBzdHJpbmc7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgY29uc3QgdmFsaWRhdGlvbkVycm9yID0gZSBhcyB7IGVycm9ycz86IEVycm9yW10gfTtcbiAgICAgICAgICAgICAgLy8gSWYgdGhlIHNjaGVtYSBpcyBhc3luYyB0aGVuIGFuIGVycm9yIHdpbGwgYmUgdGhyb3duIG9uIHZhbGlkYXRpb24gZmFpbHVyZVxuICAgICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWxpZGF0aW9uRXJyb3IuZXJyb3JzKSAmJiB2YWxpZGF0aW9uRXJyb3IuZXJyb3JzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB2YWxpZGF0aW9uRXJyb3IuZXJyb3JzWzBdLm1lc3NhZ2U7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIH0sXG4gICAgICAgIH07XG5cbiAgICAgICAgY29tcGlsYXRpb25TY2hlbUluZm8ucHJvbXB0RGVmaW5pdGlvbnMucHVzaChkZWZpbml0aW9uKTtcblxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKHRoaXM6IHsgcHJvbXB0RmllbGRzV2l0aFZhbHVlOiBTZXQ8c3RyaW5nPiB9KSB7XG4gICAgICAgICAgLy8gSWYgJ3RoaXMnIGlzIHVuZGVmaW5lZCBpbiB0aGUgY2FsbCwgdGhlbiBpdCBkZWZhdWx0cyB0byB0aGUgZ2xvYmFsXG4gICAgICAgICAgLy8gJ3RoaXMnLlxuICAgICAgICAgIGlmICh0aGlzICYmIHRoaXMucHJvbXB0RmllbGRzV2l0aFZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLnByb21wdEZpZWxkc1dpdGhWYWx1ZS5hZGQocGF0aCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH07XG4gICAgICB9LFxuICAgICAgbWV0YVNjaGVtYToge1xuICAgICAgICBvbmVPZjogW1xuICAgICAgICAgIHsgdHlwZTogJ3N0cmluZycgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgJ3R5cGUnOiB7IHR5cGU6ICdzdHJpbmcnIH0sXG4gICAgICAgICAgICAgICdtZXNzYWdlJzogeyB0eXBlOiAnc3RyaW5nJyB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiB0cnVlLFxuICAgICAgICAgICAgcmVxdWlyZWQ6IFsnbWVzc2FnZSddLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBfYXBwbHlQcm9tcHRzKGRhdGE6IEpzb25WYWx1ZSwgcHJvbXB0czogQXJyYXk8UHJvbXB0RGVmaW5pdGlvbj4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBwcm92aWRlciA9IHRoaXMuX3Byb21wdFByb3ZpZGVyO1xuICAgIGlmICghcHJvdmlkZXIpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBhbnN3ZXJzID0gYXdhaXQgbGFzdFZhbHVlRnJvbShmcm9tKHByb3ZpZGVyKHByb21wdHMpKSk7XG4gICAgZm9yIChjb25zdCBwYXRoIGluIGFuc3dlcnMpIHtcbiAgICAgIGNvbnN0IHBhdGhGcmFnbWVudHMgPSBwYXRoLnNwbGl0KCcvJykuc2xpY2UoMSk7XG5cbiAgICAgIENvcmVTY2hlbWFSZWdpc3RyeS5fc2V0KGRhdGEsIHBhdGhGcmFnbWVudHMsIGFuc3dlcnNbcGF0aF0sIG51bGwsIHVuZGVmaW5lZCwgdHJ1ZSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBzdGF0aWMgX3NldChcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgIGRhdGE6IGFueSxcbiAgICBmcmFnbWVudHM6IHN0cmluZ1tdLFxuICAgIHZhbHVlOiB1bmtub3duLFxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgcGFyZW50OiBhbnkgPSBudWxsLFxuICAgIHBhcmVudFByb3BlcnR5Pzogc3RyaW5nLFxuICAgIGZvcmNlPzogYm9vbGVhbixcbiAgKTogdm9pZCB7XG4gICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IGZyYWdtZW50cy5sZW5ndGg7IGluZGV4KyspIHtcbiAgICAgIGNvbnN0IGZyYWdtZW50ID0gZnJhZ21lbnRzW2luZGV4XTtcbiAgICAgIGlmICgvXmlcXGQrJC8udGVzdChmcmFnbWVudCkpIHtcbiAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KGRhdGEpKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgZGF0YUluZGV4ID0gMDsgZGF0YUluZGV4IDwgZGF0YS5sZW5ndGg7IGRhdGFJbmRleCsrKSB7XG4gICAgICAgICAgQ29yZVNjaGVtYVJlZ2lzdHJ5Ll9zZXQoXG4gICAgICAgICAgICBkYXRhW2RhdGFJbmRleF0sXG4gICAgICAgICAgICBmcmFnbWVudHMuc2xpY2UoaW5kZXggKyAxKSxcbiAgICAgICAgICAgIHZhbHVlLFxuICAgICAgICAgICAgZGF0YSxcbiAgICAgICAgICAgIGAke2RhdGFJbmRleH1gLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmICghZGF0YSAmJiBwYXJlbnQgIT09IG51bGwgJiYgcGFyZW50UHJvcGVydHkpIHtcbiAgICAgICAgZGF0YSA9IHBhcmVudFtwYXJlbnRQcm9wZXJ0eV0gPSB7fTtcbiAgICAgIH1cblxuICAgICAgcGFyZW50ID0gZGF0YTtcbiAgICAgIHBhcmVudFByb3BlcnR5ID0gZnJhZ21lbnQ7XG4gICAgICBkYXRhID0gZGF0YVtmcmFnbWVudF07XG4gICAgfVxuXG4gICAgaWYgKHBhcmVudCAmJiBwYXJlbnRQcm9wZXJ0eSAmJiAoZm9yY2UgfHwgcGFyZW50W3BhcmVudFByb3BlcnR5XSA9PT0gdW5kZWZpbmVkKSkge1xuICAgICAgcGFyZW50W3BhcmVudFByb3BlcnR5XSA9IHZhbHVlO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgX2FwcGx5U21hcnREZWZhdWx0czxUPihcbiAgICBkYXRhOiBULFxuICAgIHNtYXJ0RGVmYXVsdHM6IE1hcDxzdHJpbmcsIEpzb25PYmplY3Q+LFxuICApOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBmb3IgKGNvbnN0IFtwb2ludGVyLCBzY2hlbWFdIG9mIHNtYXJ0RGVmYXVsdHMuZW50cmllcygpKSB7XG4gICAgICBjb25zdCBmcmFnbWVudHMgPSBKU09OLnBhcnNlKHBvaW50ZXIpO1xuICAgICAgY29uc3Qgc291cmNlID0gdGhpcy5fc291cmNlTWFwLmdldChzY2hlbWEuJHNvdXJjZSBhcyBzdHJpbmcpO1xuICAgICAgaWYgKCFzb3VyY2UpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGxldCB2YWx1ZSA9IHNvdXJjZShzY2hlbWEpO1xuICAgICAgaWYgKGlzT2JzZXJ2YWJsZSh2YWx1ZSkpIHtcbiAgICAgICAgdmFsdWUgPSAoYXdhaXQgbGFzdFZhbHVlRnJvbSh2YWx1ZSkpIGFzIHt9O1xuICAgICAgfVxuXG4gICAgICBDb3JlU2NoZW1hUmVnaXN0cnkuX3NldChkYXRhLCBmcmFnbWVudHMsIHZhbHVlKTtcbiAgICB9XG4gIH1cblxuICB1c2VYRGVwcmVjYXRlZFByb3ZpZGVyKG9uVXNhZ2U6IChtZXNzYWdlOiBzdHJpbmcpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB0aGlzLl9hanYuYWRkS2V5d29yZCh7XG4gICAgICBrZXl3b3JkOiAneC1kZXByZWNhdGVkJyxcbiAgICAgIHZhbGlkYXRlOiAoc2NoZW1hLCBfZGF0YSwgX3BhcmVudFNjaGVtYSwgZGF0YUN4dCkgPT4ge1xuICAgICAgICBpZiAoc2NoZW1hKSB7XG4gICAgICAgICAgb25Vc2FnZShcbiAgICAgICAgICAgIGBPcHRpb24gXCIke2RhdGFDeHQ/LnBhcmVudERhdGFQcm9wZXJ0eX1cIiBpcyBkZXByZWNhdGVkJHtcbiAgICAgICAgICAgICAgdHlwZW9mIHNjaGVtYSA9PSAnc3RyaW5nJyA/ICc6ICcgKyBzY2hlbWEgOiAnLidcbiAgICAgICAgICAgIH1gLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0sXG4gICAgICBlcnJvcnM6IGZhbHNlLFxuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBub3JtYWxpemVEYXRhUGF0aEFycihpdDogU2NoZW1hT2JqQ3h0KTogKG51bWJlciB8IHN0cmluZylbXSB7XG4gICAgcmV0dXJuIGl0LmRhdGFQYXRoQXJyXG4gICAgICAuc2xpY2UoMSwgaXQuZGF0YUxldmVsICsgMSlcbiAgICAgIC5tYXAoKHApID0+ICh0eXBlb2YgcCA9PT0gJ251bWJlcicgPyBwIDogcC5zdHIucmVwbGFjZSgvXCIvZywgJycpKSk7XG4gIH1cbn1cbiJdfQ==