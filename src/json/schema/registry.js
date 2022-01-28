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
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
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
const exception_1 = require("../../exception/exception");
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
        if (fullReference.startsWith('#')) {
            fullReference = fullReference.slice(0, -1);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVnaXN0cnkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9jb3JlL3NyYy9qc29uL3NjaGVtYS9yZWdpc3RyeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsOENBQTBEO0FBQzFELDhEQUF3QztBQUN4QywyQ0FBNkI7QUFDN0IsNkNBQStCO0FBQy9CLCtCQUFzRDtBQUN0RCw4Q0FBcUM7QUFDckMseUNBQTJCO0FBQzNCLHlEQUEwRDtBQUMxRCx1Q0FBNEQ7QUFDNUQsb0NBQTBFO0FBZTFFLHVDQUE2QztBQUM3Qyx1Q0FBdUQ7QUFNdkQsTUFBYSx5QkFBMEIsU0FBUSx5QkFBYTtJQUcxRCxZQUNFLE1BQStCLEVBQy9CLFdBQVcsR0FBRyxxREFBcUQ7UUFFbkUsSUFBSSxDQUFDLE1BQU0sSUFBSSxNQUFNLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtZQUNsQyxLQUFLLENBQUMsMkJBQTJCLENBQUMsQ0FBQztZQUNuQyxJQUFJLENBQUMsTUFBTSxHQUFHLEVBQUUsQ0FBQztZQUVqQixPQUFPO1NBQ1I7UUFFRCxNQUFNLFFBQVEsR0FBRyx5QkFBeUIsQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDbEUsS0FBSyxDQUFDLEdBQUcsV0FBVyxPQUFPLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ3BELElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO0lBQ3ZCLENBQUM7SUFFTSxNQUFNLENBQUMsY0FBYyxDQUFDLE1BQStCO1FBQzFELElBQUksQ0FBQyxNQUFNLElBQUksTUFBTSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7WUFDbEMsT0FBTyxFQUFFLENBQUM7U0FDWDtRQUVELE1BQU0sUUFBUSxHQUFHLE1BQU0sQ0FBQyxH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QUM7WUFDZCxDQUFDO1lBQ0QsTUFBTSxFQUFFLEtBQUs7U0FDZCxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRU8sb0JBQW9CLENBQUMsRUFBZ0I7UUFDM0MsT0FBTyxFQUFFLENBQUMsV0FBVzthQUNsQixLQUFLLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDO2FBQzFCLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN2RSxDQUFDO0NBQ0Y7QUFqbEJELGdEQWlsQkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IEFqdiwgeyBTY2hlbWFPYmpDeHQsIFZhbGlkYXRlRnVuY3Rpb24gfSBmcm9tICdhanYnO1xuaW1wb3J0IGFqdkFkZEZvcm1hdHMgZnJvbSAnYWp2LWZvcm1hdHMnO1xuaW1wb3J0ICogYXMgaHR0cCBmcm9tICdodHRwJztcbmltcG9ydCAqIGFzIGh0dHBzIGZyb20gJ2h0dHBzJztcbmltcG9ydCB7IE9ic2VydmFibGUsIGZyb20sIGlzT2JzZXJ2YWJsZSB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgbWFwIH0gZnJvbSAncnhqcy9vcGVyYXRvcnMnO1xuaW1wb3J0ICogYXMgVXJsIGZyb20gJ3VybCc7XG5pbXBvcnQgeyBCYXNlRXhjZXB0aW9uIH0gZnJvbSAnLi4vLi4vZXhjZXB0aW9uL2V4Y2VwdGlvbic7XG5pbXBvcnQgeyBQYXJ0aWFsbHlPcmRlcmVkU2V0LCBkZWVwQ29weSB9IGZyb20gJy4uLy4uL3V0aWxzJztcbmltcG9ydCB7IEpzb25BcnJheSwgSnNvbk9iamVjdCwgSnNvblZhbHVlLCBpc0pzb25PYmplY3QgfSBmcm9tICcuLi91dGlscyc7XG5pbXBvcnQge1xuICBKc29uUG9pbnRlcixcbiAgSnNvblZpc2l0b3IsXG4gIFByb21wdERlZmluaXRpb24sXG4gIFByb21wdFByb3ZpZGVyLFxuICBTY2hlbWFGb3JtYXQsXG4gIFNjaGVtYVJlZ2lzdHJ5LFxuICBTY2hlbWFWYWxpZGF0b3IsXG4gIFNjaGVtYVZhbGlkYXRvckVycm9yLFxuICBTY2hlbWFWYWxpZGF0b3JPcHRpb25zLFxuICBTY2hlbWFWYWxpZGF0b3JSZXN1bHQsXG4gIFNtYXJ0RGVmYXVsdFByb3ZpZGVyLFxufSBmcm9tICcuL2ludGVyZmFjZSc7XG5pbXBvcnQgeyBKc29uU2NoZW1hIH0gZnJvbSAnLi9zY2hlbWEnO1xuaW1wb3J0IHsgZ2V0VHlwZXNPZlNjaGVtYSB9IGZyb20gJy4vdXRpbGl0eSc7XG5pbXBvcnQgeyB2aXNpdEpzb24sIHZpc2l0SnNvblNjaGVtYSB9IGZyb20gJy4vdmlzaXRvcic7XG5cbmV4cG9ydCB0eXBlIFVyaUhhbmRsZXIgPSAoXG4gIHVyaTogc3RyaW5nLFxuKSA9PiBPYnNlcnZhYmxlPEpzb25PYmplY3Q+IHwgUHJvbWlzZTxKc29uT2JqZWN0PiB8IG51bGwgfCB1bmRlZmluZWQ7XG5cbmV4cG9ydCBjbGFzcyBTY2hlbWFWYWxpZGF0aW9uRXhjZXB0aW9uIGV4dGVuZHMgQmFzZUV4Y2VwdGlvbiB7XG4gIHB1YmxpYyByZWFkb25seSBlcnJvcnM6IFNjaGVtYVZhbGlkYXRvckVycm9yW107XG5cbiAgY29uc3RydWN0b3IoXG4gICAgZXJyb3JzPzogU2NoZW1hVmFsaWRhdG9yRXJyb3JbXSxcbiAgICBiYXNlTWVzc2FnZSA9ICdTY2hlbWEgdmFsaWRhdGlvbiBmYWlsZWQgd2l0aCB0aGUgZm9sbG93aW5nIGVycm9yczonLFxuICApIHtcbiAgICBpZiAoIWVycm9ycyB8fCBlcnJvcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICBzdXBlcignU2NoZW1hIHZhbGlkYXRpb24gZmFpbGVkLicpO1xuICAgICAgdGhpcy5lcnJvcnMgPSBbXTtcblxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IG1lc3NhZ2VzID0gU2NoZW1hVmFsaWRhdGlvbkV4Y2VwdGlvbi5jcmVhdGVNZXNzYWdlcyhlcnJvcnMpO1xuICAgIHN1cGVyKGAke2Jhc2VNZXNzYWdlfVxcbiAgJHttZXNzYWdlcy5qb2luKCdcXG4gICcpfWApO1xuICAgIHRoaXMuZXJyb3JzID0gZXJyb3JzO1xuICB9XG5cbiAgcHVibGljIHN0YXRpYyBjcmVhdGVNZXNzYWdlcyhlcnJvcnM/OiBTY2hlbWFWYWxpZGF0b3JFcnJvcltdKTogc3RyaW5nW10ge1xuICAgIGlmICghZXJyb3JzIHx8IGVycm9ycy5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICBjb25zdCBtZXNzYWdlcyA9IGVycm9ycy5tYXAoKGVycikgPT4ge1xuICAgICAgbGV0IG1lc3NhZ2UgPSBgRGF0YSBwYXRoICR7SlNPTi5zdHJpbmdpZnkoZXJyLmluc3RhbmNlUGF0aCl9ICR7ZXJyLm1lc3NhZ2V9YDtcbiAgICAgIGlmIChlcnIucGFyYW1zKSB7XG4gICAgICAgIHN3aXRjaCAoZXJyLmtleXdvcmQpIHtcbiAgICAgICAgICBjYXNlICdhZGRpdGlvbmFsUHJvcGVydGllcyc6XG4gICAgICAgICAgICBtZXNzYWdlICs9IGAoJHtlcnIucGFyYW1zLmFkZGl0aW9uYWxQcm9wZXJ0eX0pYDtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgY2FzZSAnZW51bSc6XG4gICAgICAgICAgICBtZXNzYWdlICs9IGAuIEFsbG93ZWQgdmFsdWVzIGFyZTogJHsoZXJyLnBhcmFtcy5hbGxvd2VkVmFsdWVzIGFzIHN0cmluZ1tdIHwgdW5kZWZpbmVkKVxuICAgICAgICAgICAgICA/Lm1hcCgodikgPT4gYFwiJHt2fVwiYClcbiAgICAgICAgICAgICAgLmpvaW4oJywgJyl9YDtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBtZXNzYWdlICsgJy4nO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIG1lc3NhZ2VzO1xuICB9XG59XG5cbmludGVyZmFjZSBTY2hlbWFJbmZvIHtcbiAgc21hcnREZWZhdWx0UmVjb3JkOiBNYXA8c3RyaW5nLCBKc29uT2JqZWN0PjtcbiAgcHJvbXB0RGVmaW5pdGlvbnM6IEFycmF5PFByb21wdERlZmluaXRpb24+O1xufVxuXG5leHBvcnQgY2xhc3MgQ29yZVNjaGVtYVJlZ2lzdHJ5IGltcGxlbWVudHMgU2NoZW1hUmVnaXN0cnkge1xuICBwcml2YXRlIF9hanY6IEFqdjtcbiAgcHJpdmF0ZSBfdXJpQ2FjaGUgPSBuZXcgTWFwPHN0cmluZywgSnNvbk9iamVjdD4oKTtcbiAgcHJpdmF0ZSBfdXJpSGFuZGxlcnMgPSBuZXcgU2V0PFVyaUhhbmRsZXI+KCk7XG4gIHByaXZhdGUgX3ByZSA9IG5ldyBQYXJ0aWFsbHlPcmRlcmVkU2V0PEpzb25WaXNpdG9yPigpO1xuICBwcml2YXRlIF9wb3N0ID0gbmV3IFBhcnRpYWxseU9yZGVyZWRTZXQ8SnNvblZpc2l0b3I+KCk7XG5cbiAgcHJpdmF0ZSBfY3VycmVudENvbXBpbGF0aW9uU2NoZW1hSW5mbz86IFNjaGVtYUluZm87XG5cbiAgcHJpdmF0ZSBfc21hcnREZWZhdWx0S2V5d29yZCA9IGZhbHNlO1xuICBwcml2YXRlIF9wcm9tcHRQcm92aWRlcj86IFByb21wdFByb3ZpZGVyO1xuICBwcml2YXRlIF9zb3VyY2VNYXAgPSBuZXcgTWFwPHN0cmluZywgU21hcnREZWZhdWx0UHJvdmlkZXI8e30+PigpO1xuXG4gIGNvbnN0cnVjdG9yKGZvcm1hdHM6IFNjaGVtYUZvcm1hdFtdID0gW10pIHtcbiAgICB0aGlzLl9hanYgPSBuZXcgQWp2KHtcbiAgICAgIHN0cmljdDogZmFsc2UsXG4gICAgICBsb2FkU2NoZW1hOiAodXJpOiBzdHJpbmcpID0+IHRoaXMuX2ZldGNoKHVyaSksXG4gICAgICBwYXNzQ29udGV4dDogdHJ1ZSxcbiAgICB9KTtcblxuICAgIGFqdkFkZEZvcm1hdHModGhpcy5fYWp2KTtcblxuICAgIGZvciAoY29uc3QgZm9ybWF0IG9mIGZvcm1hdHMpIHtcbiAgICAgIHRoaXMuYWRkRm9ybWF0KGZvcm1hdCk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBfZmV0Y2godXJpOiBzdHJpbmcpOiBQcm9taXNlPEpzb25PYmplY3Q+IHtcbiAgICBjb25zdCBtYXliZVNjaGVtYSA9IHRoaXMuX3VyaUNhY2hlLmdldCh1cmkpO1xuXG4gICAgaWYgKG1heWJlU2NoZW1hKSB7XG4gICAgICByZXR1cm4gbWF5YmVTY2hlbWE7XG4gICAgfVxuXG4gICAgLy8gVHJ5IGFsbCBoYW5kbGVycywgb25lIGFmdGVyIHRoZSBvdGhlci5cbiAgICBmb3IgKGNvbnN0IGhhbmRsZXIgb2YgdGhpcy5fdXJpSGFuZGxlcnMpIHtcbiAgICAgIGxldCBoYW5kbGVyUmVzdWx0ID0gaGFuZGxlcih1cmkpO1xuICAgICAgaWYgKGhhbmRsZXJSZXN1bHQgPT09IG51bGwgfHwgaGFuZGxlclJlc3VsdCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoaXNPYnNlcnZhYmxlKGhhbmRsZXJSZXN1bHQpKSB7XG4gICAgICAgIGhhbmRsZXJSZXN1bHQgPSBoYW5kbGVyUmVzdWx0LnRvUHJvbWlzZSgpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCB2YWx1ZSA9IGF3YWl0IGhhbmRsZXJSZXN1bHQ7XG4gICAgICB0aGlzLl91cmlDYWNoZS5zZXQodXJpLCB2YWx1ZSk7XG5cbiAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG5cbiAgICAvLyBJZiBub25lIGFyZSBmb3VuZCwgaGFuZGxlIHVzaW5nIGh0dHAgY2xpZW50LlxuICAgIHJldHVybiBuZXcgUHJvbWlzZTxKc29uT2JqZWN0PigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBjb25zdCB1cmwgPSBuZXcgVXJsLlVSTCh1cmkpO1xuICAgICAgY29uc3QgY2xpZW50ID0gdXJsLnByb3RvY29sID09PSAnaHR0cHM6JyA/IGh0dHBzIDogaHR0cDtcbiAgICAgIGNsaWVudC5nZXQodXJsLCAocmVzKSA9PiB7XG4gICAgICAgIGlmICghcmVzLnN0YXR1c0NvZGUgfHwgcmVzLnN0YXR1c0NvZGUgPj0gMzAwKSB7XG4gICAgICAgICAgLy8gQ29uc3VtZSB0aGUgcmVzdCBvZiB0aGUgZGF0YSB0byBmcmVlIG1lbW9yeS5cbiAgICAgICAgICByZXMucmVzdW1lKCk7XG4gICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihgUmVxdWVzdCBmYWlsZWQuIFN0YXR1cyBDb2RlOiAke3Jlcy5zdGF0dXNDb2RlfWApKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXMuc2V0RW5jb2RpbmcoJ3V0ZjgnKTtcbiAgICAgICAgICBsZXQgZGF0YSA9ICcnO1xuICAgICAgICAgIHJlcy5vbignZGF0YScsIChjaHVuaykgPT4ge1xuICAgICAgICAgICAgZGF0YSArPSBjaHVuaztcbiAgICAgICAgICB9KTtcbiAgICAgICAgICByZXMub24oJ2VuZCcsICgpID0+IHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGNvbnN0IGpzb24gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgICAgICAgICAgICB0aGlzLl91cmlDYWNoZS5zZXQodXJpLCBqc29uKTtcbiAgICAgICAgICAgICAgcmVzb2x2ZShqc29uKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQWRkIGEgdHJhbnNmb3JtYXRpb24gc3RlcCBiZWZvcmUgdGhlIHZhbGlkYXRpb24gb2YgYW55IEpzb24uXG4gICAqIEBwYXJhbSB7SnNvblZpc2l0b3J9IHZpc2l0b3IgVGhlIHZpc2l0b3IgdG8gdHJhbnNmb3JtIGV2ZXJ5IHZhbHVlLlxuICAgKiBAcGFyYW0ge0pzb25WaXNpdG9yW119IGRlcHMgQSBsaXN0IG9mIG90aGVyIHZpc2l0b3JzIHRvIHJ1biBiZWZvcmUuXG4gICAqL1xuICBhZGRQcmVUcmFuc2Zvcm0odmlzaXRvcjogSnNvblZpc2l0b3IsIGRlcHM/OiBKc29uVmlzaXRvcltdKSB7XG4gICAgdGhpcy5fcHJlLmFkZCh2aXNpdG9yLCBkZXBzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGQgYSB0cmFuc2Zvcm1hdGlvbiBzdGVwIGFmdGVyIHRoZSB2YWxpZGF0aW9uIG9mIGFueSBKc29uLiBUaGUgSlNPTiB3aWxsIG5vdCBiZSB2YWxpZGF0ZWRcbiAgICogYWZ0ZXIgdGhlIFBPU1QsIHNvIGlmIHRyYW5zZm9ybWF0aW9ucyBhcmUgbm90IGNvbXBhdGlibGUgd2l0aCB0aGUgU2NoZW1hIGl0IHdpbGwgbm90IHJlc3VsdFxuICAgKiBpbiBhbiBlcnJvci5cbiAgICogQHBhcmFtIHtKc29uVmlzaXRvcn0gdmlzaXRvciBUaGUgdmlzaXRvciB0byB0cmFuc2Zvcm0gZXZlcnkgdmFsdWUuXG4gICAqIEBwYXJhbSB7SnNvblZpc2l0b3JbXX0gZGVwcyBBIGxpc3Qgb2Ygb3RoZXIgdmlzaXRvcnMgdG8gcnVuIGJlZm9yZS5cbiAgICovXG4gIGFkZFBvc3RUcmFuc2Zvcm0odmlzaXRvcjogSnNvblZpc2l0b3IsIGRlcHM/OiBKc29uVmlzaXRvcltdKSB7XG4gICAgdGhpcy5fcG9zdC5hZGQodmlzaXRvciwgZGVwcyk7XG4gIH1cblxuICBwcm90ZWN0ZWQgX3Jlc29sdmVyKFxuICAgIHJlZjogc3RyaW5nLFxuICAgIHZhbGlkYXRlPzogVmFsaWRhdGVGdW5jdGlvbixcbiAgKTogeyBjb250ZXh0PzogVmFsaWRhdGVGdW5jdGlvbjsgc2NoZW1hPzogSnNvbk9iamVjdCB9IHtcbiAgICBpZiAoIXZhbGlkYXRlIHx8ICFyZWYpIHtcbiAgICAgIHJldHVybiB7fTtcbiAgICB9XG5cbiAgICBjb25zdCBzY2hlbWEgPSB2YWxpZGF0ZS5zY2hlbWFFbnYucm9vdC5zY2hlbWE7XG4gICAgY29uc3QgaWQgPSB0eXBlb2Ygc2NoZW1hID09PSAnb2JqZWN0JyA/IHNjaGVtYS4kaWQgOiBudWxsO1xuXG4gICAgbGV0IGZ1bGxSZWZlcmVuY2UgPSByZWY7XG4gICAgaWYgKHR5cGVvZiBpZCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGZ1bGxSZWZlcmVuY2UgPSBVcmwucmVzb2x2ZShpZCwgcmVmKTtcblxuICAgICAgaWYgKHJlZi5zdGFydHNXaXRoKCcjJykpIHtcbiAgICAgICAgZnVsbFJlZmVyZW5jZSA9IGlkICsgZnVsbFJlZmVyZW5jZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoZnVsbFJlZmVyZW5jZS5zdGFydHNXaXRoKCcjJykpIHtcbiAgICAgIGZ1bGxSZWZlcmVuY2UgPSBmdWxsUmVmZXJlbmNlLnNsaWNlKDAsIC0xKTtcbiAgICB9XG4gICAgY29uc3QgcmVzb2x2ZWRTY2hlbWEgPSB0aGlzLl9hanYuZ2V0U2NoZW1hKGZ1bGxSZWZlcmVuY2UpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGNvbnRleHQ6IHJlc29sdmVkU2NoZW1hPy5zY2hlbWFFbnYudmFsaWRhdGUsXG4gICAgICBzY2hlbWE6IHJlc29sdmVkU2NoZW1hPy5zY2hlbWEgYXMgSnNvbk9iamVjdCxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIEZsYXR0ZW4gdGhlIFNjaGVtYSwgcmVzb2x2aW5nIGFuZCByZXBsYWNpbmcgYWxsIHRoZSByZWZzLiBNYWtlcyBpdCBpbnRvIGEgc3luY2hyb25vdXMgc2NoZW1hXG4gICAqIHRoYXQgaXMgYWxzbyBlYXNpZXIgdG8gdHJhdmVyc2UuIERvZXMgbm90IGNhY2hlIHRoZSByZXN1bHQuXG4gICAqXG4gICAqIEBwYXJhbSBzY2hlbWEgVGhlIHNjaGVtYSBvciBVUkkgdG8gZmxhdHRlbi5cbiAgICogQHJldHVybnMgQW4gT2JzZXJ2YWJsZSBvZiB0aGUgZmxhdHRlbmVkIHNjaGVtYSBvYmplY3QuXG4gICAqIEBkZXByZWNhdGVkIHNpbmNlIDExLjIgd2l0aG91dCByZXBsYWNlbWVudC5cbiAgICogUHJvZHVjaW5nIGEgZmxhdHRlbiBzY2hlbWEgZG9jdW1lbnQgZG9lcyBub3QgaW4gYWxsIGNhc2VzIHByb2R1Y2UgYSBzY2hlbWEgd2l0aCBpZGVudGljYWwgYmVoYXZpb3IgdG8gdGhlIG9yaWdpbmFsLlxuICAgKiBTZWU6IGh0dHBzOi8vanNvbi1zY2hlbWEub3JnL2RyYWZ0LzIwMTktMDkvanNvbi1zY2hlbWEtY29yZS5odG1sI3JmYy5hcHBlbmRpeC5CLjJcbiAgICovXG4gIGZsYXR0ZW4oc2NoZW1hOiBKc29uT2JqZWN0KTogT2JzZXJ2YWJsZTxKc29uT2JqZWN0PiB7XG4gICAgcmV0dXJuIGZyb20odGhpcy5fZmxhdHRlbihzY2hlbWEpKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgX2ZsYXR0ZW4oc2NoZW1hOiBKc29uT2JqZWN0KTogUHJvbWlzZTxKc29uT2JqZWN0PiB7XG4gICAgdGhpcy5fYWp2LnJlbW92ZVNjaGVtYShzY2hlbWEpO1xuXG4gICAgdGhpcy5fY3VycmVudENvbXBpbGF0aW9uU2NoZW1hSW5mbyA9IHVuZGVmaW5lZDtcbiAgICBjb25zdCB2YWxpZGF0ZSA9IGF3YWl0IHRoaXMuX2Fqdi5jb21waWxlQXN5bmMoc2NoZW1hKTtcblxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tdGhpcy1hbGlhc1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuXG4gICAgZnVuY3Rpb24gdmlzaXRvcihcbiAgICAgIGN1cnJlbnQ6IEpzb25PYmplY3QgfCBKc29uQXJyYXksXG4gICAgICBwb2ludGVyOiBKc29uUG9pbnRlcixcbiAgICAgIHBhcmVudFNjaGVtYT86IEpzb25PYmplY3QgfCBKc29uQXJyYXksXG4gICAgICBpbmRleD86IHN0cmluZyxcbiAgICApIHtcbiAgICAgIGlmIChcbiAgICAgICAgY3VycmVudCAmJlxuICAgICAgICBwYXJlbnRTY2hlbWEgJiZcbiAgICAgICAgaW5kZXggJiZcbiAgICAgICAgaXNKc29uT2JqZWN0KGN1cnJlbnQpICYmXG4gICAgICAgIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChjdXJyZW50LCAnJHJlZicpICYmXG4gICAgICAgIHR5cGVvZiBjdXJyZW50WyckcmVmJ10gPT0gJ3N0cmluZydcbiAgICAgICkge1xuICAgICAgICBjb25zdCByZXNvbHZlZCA9IHNlbGYuX3Jlc29sdmVyKGN1cnJlbnRbJyRyZWYnXSwgdmFsaWRhdGUpO1xuXG4gICAgICAgIGlmIChyZXNvbHZlZC5zY2hlbWEpIHtcbiAgICAgICAgICAocGFyZW50U2NoZW1hIGFzIEpzb25PYmplY3QpW2luZGV4XSA9IHJlc29sdmVkLnNjaGVtYTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHNjaGVtYUNvcHkgPSBkZWVwQ29weSh2YWxpZGF0ZS5zY2hlbWEgYXMgSnNvbk9iamVjdCk7XG4gICAgdmlzaXRKc29uU2NoZW1hKHNjaGVtYUNvcHksIHZpc2l0b3IpO1xuXG4gICAgcmV0dXJuIHNjaGVtYUNvcHk7XG4gIH1cblxuICAvKipcbiAgICogQ29tcGlsZSBhbmQgcmV0dXJuIGEgdmFsaWRhdGlvbiBmdW5jdGlvbiBmb3IgdGhlIFNjaGVtYS5cbiAgICpcbiAgICogQHBhcmFtIHNjaGVtYSBUaGUgc2NoZW1hIHRvIHZhbGlkYXRlLiBJZiBhIHN0cmluZywgd2lsbCBmZXRjaCB0aGUgc2NoZW1hIGJlZm9yZSBjb21waWxpbmcgaXRcbiAgICogKHVzaW5nIHNjaGVtYSBhcyBhIFVSSSkuXG4gICAqIEByZXR1cm5zIEFuIE9ic2VydmFibGUgb2YgdGhlIFZhbGlkYXRpb24gZnVuY3Rpb24uXG4gICAqL1xuICBjb21waWxlKHNjaGVtYTogSnNvblNjaGVtYSk6IE9ic2VydmFibGU8U2NoZW1hVmFsaWRhdG9yPiB7XG4gICAgcmV0dXJuIGZyb20odGhpcy5fY29tcGlsZShzY2hlbWEpKS5waXBlKFxuICAgICAgbWFwKCh2YWxpZGF0ZSkgPT4gKHZhbHVlLCBvcHRpb25zKSA9PiBmcm9tKHZhbGlkYXRlKHZhbHVlLCBvcHRpb25zKSkpLFxuICAgICk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIF9jb21waWxlKFxuICAgIHNjaGVtYTogSnNvblNjaGVtYSxcbiAgKTogUHJvbWlzZTxcbiAgICAoZGF0YTogSnNvblZhbHVlLCBvcHRpb25zPzogU2NoZW1hVmFsaWRhdG9yT3B0aW9ucykgPT4gUHJvbWlzZTxTY2hlbWFWYWxpZGF0b3JSZXN1bHQ+XG4gID4ge1xuICAgIGlmICh0eXBlb2Ygc2NoZW1hID09PSAnYm9vbGVhbicpIHtcbiAgICAgIHJldHVybiBhc3luYyAoZGF0YSkgPT4gKHsgc3VjY2Vzczogc2NoZW1hLCBkYXRhIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IHNjaGVtYUluZm86IFNjaGVtYUluZm8gPSB7XG4gICAgICBzbWFydERlZmF1bHRSZWNvcmQ6IG5ldyBNYXA8c3RyaW5nLCBKc29uT2JqZWN0PigpLFxuICAgICAgcHJvbXB0RGVmaW5pdGlvbnM6IFtdLFxuICAgIH07XG5cbiAgICB0aGlzLl9hanYucmVtb3ZlU2NoZW1hKHNjaGVtYSk7XG4gICAgbGV0IHZhbGlkYXRvcjogVmFsaWRhdGVGdW5jdGlvbjtcblxuICAgIHRyeSB7XG4gICAgICB0aGlzLl9jdXJyZW50Q29tcGlsYXRpb25TY2hlbWFJbmZvID0gc2NoZW1hSW5mbztcbiAgICAgIHZhbGlkYXRvciA9IHRoaXMuX2Fqdi5jb21waWxlKHNjaGVtYSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgLy8gVGhpcyBzaG91bGQgZXZlbnR1YWxseSBiZSByZWZhY3RvcmVkIHNvIHRoYXQgd2Ugd2UgaGFuZGxlIHJhY2UgY29uZGl0aW9uIHdoZXJlIHRoZSBzYW1lIHNjaGVtYSBpcyB2YWxpZGF0ZWQgYXQgdGhlIHNhbWUgdGltZS5cbiAgICAgIGlmICghKGUgaW5zdGFuY2VvZiBBanYuTWlzc2luZ1JlZkVycm9yKSkge1xuICAgICAgICB0aHJvdyBlO1xuICAgICAgfVxuXG4gICAgICB2YWxpZGF0b3IgPSBhd2FpdCB0aGlzLl9hanYuY29tcGlsZUFzeW5jKHNjaGVtYSk7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHRoaXMuX2N1cnJlbnRDb21waWxhdGlvblNjaGVtYUluZm8gPSB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIGFzeW5jIChkYXRhOiBKc29uVmFsdWUsIG9wdGlvbnM/OiBTY2hlbWFWYWxpZGF0b3JPcHRpb25zKSA9PiB7XG4gICAgICBjb25zdCB2YWxpZGF0aW9uT3B0aW9uczogU2NoZW1hVmFsaWRhdG9yT3B0aW9ucyA9IHtcbiAgICAgICAgd2l0aFByb21wdHM6IHRydWUsXG4gICAgICAgIGFwcGx5UG9zdFRyYW5zZm9ybXM6IHRydWUsXG4gICAgICAgIGFwcGx5UHJlVHJhbnNmb3JtczogdHJ1ZSxcbiAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgIH07XG4gICAgICBjb25zdCB2YWxpZGF0aW9uQ29udGV4dCA9IHtcbiAgICAgICAgcHJvbXB0RmllbGRzV2l0aFZhbHVlOiBuZXcgU2V0PHN0cmluZz4oKSxcbiAgICAgIH07XG5cbiAgICAgIC8vIEFwcGx5IHByZS12YWxpZGF0aW9uIHRyYW5zZm9ybXNcbiAgICAgIGlmICh2YWxpZGF0aW9uT3B0aW9ucy5hcHBseVByZVRyYW5zZm9ybXMpIHtcbiAgICAgICAgZm9yIChjb25zdCB2aXNpdG9yIG9mIHRoaXMuX3ByZS52YWx1ZXMoKSkge1xuICAgICAgICAgIGRhdGEgPSBhd2FpdCB2aXNpdEpzb24oXG4gICAgICAgICAgICBkYXRhLFxuICAgICAgICAgICAgdmlzaXRvcixcbiAgICAgICAgICAgIHNjaGVtYSxcbiAgICAgICAgICAgIHRoaXMuX3Jlc29sdmVyLmJpbmQodGhpcyksXG4gICAgICAgICAgICB2YWxpZGF0b3IsXG4gICAgICAgICAgKS50b1Byb21pc2UoKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBBcHBseSBzbWFydCBkZWZhdWx0c1xuICAgICAgYXdhaXQgdGhpcy5fYXBwbHlTbWFydERlZmF1bHRzKGRhdGEsIHNjaGVtYUluZm8uc21hcnREZWZhdWx0UmVjb3JkKTtcblxuICAgICAgLy8gQXBwbHkgcHJvbXB0c1xuICAgICAgaWYgKHZhbGlkYXRpb25PcHRpb25zLndpdGhQcm9tcHRzKSB7XG4gICAgICAgIGNvbnN0IHZpc2l0b3I6IEpzb25WaXNpdG9yID0gKHZhbHVlLCBwb2ludGVyKSA9PiB7XG4gICAgICAgICAgaWYgKHZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHZhbGlkYXRpb25Db250ZXh0LnByb21wdEZpZWxkc1dpdGhWYWx1ZS5hZGQocG9pbnRlcik7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgICAgICB9O1xuICAgICAgICBpZiAodHlwZW9mIHNjaGVtYSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICBhd2FpdCB2aXNpdEpzb24oZGF0YSwgdmlzaXRvciwgc2NoZW1hLCB0aGlzLl9yZXNvbHZlci5iaW5kKHRoaXMpLCB2YWxpZGF0b3IpLnRvUHJvbWlzZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZGVmaW5pdGlvbnMgPSBzY2hlbWFJbmZvLnByb21wdERlZmluaXRpb25zLmZpbHRlcihcbiAgICAgICAgICAoZGVmKSA9PiAhdmFsaWRhdGlvbkNvbnRleHQucHJvbXB0RmllbGRzV2l0aFZhbHVlLmhhcyhkZWYuaWQpLFxuICAgICAgICApO1xuXG4gICAgICAgIGlmIChkZWZpbml0aW9ucy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgYXdhaXQgdGhpcy5fYXBwbHlQcm9tcHRzKGRhdGEsIGRlZmluaXRpb25zKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBWYWxpZGF0ZSB1c2luZyBhanZcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHN1Y2Nlc3MgPSBhd2FpdCB2YWxpZGF0b3IuY2FsbCh2YWxpZGF0aW9uQ29udGV4dCwgZGF0YSk7XG5cbiAgICAgICAgaWYgKCFzdWNjZXNzKSB7XG4gICAgICAgICAgcmV0dXJuIHsgZGF0YSwgc3VjY2VzcywgZXJyb3JzOiB2YWxpZGF0b3IuZXJyb3JzID8/IFtdIH07XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIEFqdi5WYWxpZGF0aW9uRXJyb3IpIHtcbiAgICAgICAgICByZXR1cm4geyBkYXRhLCBzdWNjZXNzOiBmYWxzZSwgZXJyb3JzOiBlcnJvci5lcnJvcnMgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRocm93IGVycm9yO1xuICAgICAgfVxuXG4gICAgICAvLyBBcHBseSBwb3N0LXZhbGlkYXRpb24gdHJhbnNmb3Jtc1xuICAgICAgaWYgKHZhbGlkYXRpb25PcHRpb25zLmFwcGx5UG9zdFRyYW5zZm9ybXMpIHtcbiAgICAgICAgZm9yIChjb25zdCB2aXNpdG9yIG9mIHRoaXMuX3Bvc3QudmFsdWVzKCkpIHtcbiAgICAgICAgICBkYXRhID0gYXdhaXQgdmlzaXRKc29uKFxuICAgICAgICAgICAgZGF0YSxcbiAgICAgICAgICAgIHZpc2l0b3IsXG4gICAgICAgICAgICBzY2hlbWEsXG4gICAgICAgICAgICB0aGlzLl9yZXNvbHZlci5iaW5kKHRoaXMpLFxuICAgICAgICAgICAgdmFsaWRhdG9yLFxuICAgICAgICAgICkudG9Qcm9taXNlKCk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHsgZGF0YSwgc3VjY2VzczogdHJ1ZSB9O1xuICAgIH07XG4gIH1cblxuICBhZGRGb3JtYXQoZm9ybWF0OiBTY2hlbWFGb3JtYXQpOiB2b2lkIHtcbiAgICB0aGlzLl9hanYuYWRkRm9ybWF0KGZvcm1hdC5uYW1lLCBmb3JtYXQuZm9ybWF0dGVyKTtcbiAgfVxuXG4gIGFkZFNtYXJ0RGVmYXVsdFByb3ZpZGVyPFQ+KHNvdXJjZTogc3RyaW5nLCBwcm92aWRlcjogU21hcnREZWZhdWx0UHJvdmlkZXI8VD4pIHtcbiAgICBpZiAodGhpcy5fc291cmNlTWFwLmhhcyhzb3VyY2UpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3Ioc291cmNlKTtcbiAgICB9XG5cbiAgICB0aGlzLl9zb3VyY2VNYXAuc2V0KHNvdXJjZSwgcHJvdmlkZXIpO1xuXG4gICAgaWYgKCF0aGlzLl9zbWFydERlZmF1bHRLZXl3b3JkKSB7XG4gICAgICB0aGlzLl9zbWFydERlZmF1bHRLZXl3b3JkID0gdHJ1ZTtcblxuICAgICAgdGhpcy5fYWp2LmFkZEtleXdvcmQoe1xuICAgICAgICBrZXl3b3JkOiAnJGRlZmF1bHQnLFxuICAgICAgICBlcnJvcnM6IGZhbHNlLFxuICAgICAgICB2YWxpZDogdHJ1ZSxcbiAgICAgICAgY29tcGlsZTogKHNjaGVtYSwgX3BhcmVudFNjaGVtYSwgaXQpID0+IHtcbiAgICAgICAgICBjb25zdCBjb21waWxhdGlvblNjaGVtSW5mbyA9IHRoaXMuX2N1cnJlbnRDb21waWxhdGlvblNjaGVtYUluZm87XG4gICAgICAgICAgaWYgKGNvbXBpbGF0aW9uU2NoZW1JbmZvID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHJldHVybiAoKSA9PiB0cnVlO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIFdlIGNoZWF0LCBoZWF2aWx5LlxuICAgICAgICAgIGNvbnN0IHBhdGhBcnJheSA9IHRoaXMubm9ybWFsaXplRGF0YVBhdGhBcnIoaXQpO1xuICAgICAgICAgIGNvbXBpbGF0aW9uU2NoZW1JbmZvLnNtYXJ0RGVmYXVsdFJlY29yZC5zZXQoSlNPTi5zdHJpbmdpZnkocGF0aEFycmF5KSwgc2NoZW1hKTtcblxuICAgICAgICAgIHJldHVybiAoKSA9PiB0cnVlO1xuICAgICAgICB9LFxuICAgICAgICBtZXRhU2NoZW1hOiB7XG4gICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgJyRzb3VyY2UnOiB7IHR5cGU6ICdzdHJpbmcnIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBhZGRpdGlvbmFsUHJvcGVydGllczogdHJ1ZSxcbiAgICAgICAgICByZXF1aXJlZDogWyckc291cmNlJ10sXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICByZWdpc3RlclVyaUhhbmRsZXIoaGFuZGxlcjogVXJpSGFuZGxlcikge1xuICAgIHRoaXMuX3VyaUhhbmRsZXJzLmFkZChoYW5kbGVyKTtcbiAgfVxuXG4gIHVzZVByb21wdFByb3ZpZGVyKHByb3ZpZGVyOiBQcm9tcHRQcm92aWRlcikge1xuICAgIGNvbnN0IGlzU2V0dXAgPSAhIXRoaXMuX3Byb21wdFByb3ZpZGVyO1xuXG4gICAgdGhpcy5fcHJvbXB0UHJvdmlkZXIgPSBwcm92aWRlcjtcblxuICAgIGlmIChpc1NldHVwKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5fYWp2LmFkZEtleXdvcmQoe1xuICAgICAga2V5d29yZDogJ3gtcHJvbXB0JyxcbiAgICAgIGVycm9yczogZmFsc2UsXG4gICAgICB2YWxpZDogdHJ1ZSxcbiAgICAgIGNvbXBpbGU6IChzY2hlbWEsIHBhcmVudFNjaGVtYSwgaXQpID0+IHtcbiAgICAgICAgY29uc3QgY29tcGlsYXRpb25TY2hlbUluZm8gPSB0aGlzLl9jdXJyZW50Q29tcGlsYXRpb25TY2hlbWFJbmZvO1xuICAgICAgICBpZiAoIWNvbXBpbGF0aW9uU2NoZW1JbmZvKSB7XG4gICAgICAgICAgcmV0dXJuICgpID0+IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBwYXRoID0gJy8nICsgdGhpcy5ub3JtYWxpemVEYXRhUGF0aEFycihpdCkuam9pbignLycpO1xuXG4gICAgICAgIGxldCB0eXBlOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgICAgIGxldCBpdGVtczogQXJyYXk8c3RyaW5nIHwgeyBsYWJlbDogc3RyaW5nOyB2YWx1ZTogc3RyaW5nIHwgbnVtYmVyIHwgYm9vbGVhbiB9PiB8IHVuZGVmaW5lZDtcbiAgICAgICAgbGV0IG1lc3NhZ2U6IHN0cmluZztcbiAgICAgICAgaWYgKHR5cGVvZiBzY2hlbWEgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICBtZXNzYWdlID0gc2NoZW1hO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG1lc3NhZ2UgPSBzY2hlbWEubWVzc2FnZTtcbiAgICAgICAgICB0eXBlID0gc2NoZW1hLnR5cGU7XG4gICAgICAgICAgaXRlbXMgPSBzY2hlbWEuaXRlbXM7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBwcm9wZXJ0eVR5cGVzID0gZ2V0VHlwZXNPZlNjaGVtYShwYXJlbnRTY2hlbWEgYXMgSnNvbk9iamVjdCk7XG4gICAgICAgIGlmICghdHlwZSkge1xuICAgICAgICAgIGlmIChwcm9wZXJ0eVR5cGVzLnNpemUgPT09IDEgJiYgcHJvcGVydHlUeXBlcy5oYXMoJ2Jvb2xlYW4nKSkge1xuICAgICAgICAgICAgdHlwZSA9ICdjb25maXJtYXRpb24nO1xuICAgICAgICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheSgocGFyZW50U2NoZW1hIGFzIEpzb25PYmplY3QpLmVudW0pKSB7XG4gICAgICAgICAgICB0eXBlID0gJ2xpc3QnO1xuICAgICAgICAgIH0gZWxzZSBpZiAoXG4gICAgICAgICAgICBwcm9wZXJ0eVR5cGVzLnNpemUgPT09IDEgJiZcbiAgICAgICAgICAgIHByb3BlcnR5VHlwZXMuaGFzKCdhcnJheScpICYmXG4gICAgICAgICAgICAocGFyZW50U2NoZW1hIGFzIEpzb25PYmplY3QpLml0ZW1zICYmXG4gICAgICAgICAgICBBcnJheS5pc0FycmF5KCgocGFyZW50U2NoZW1hIGFzIEpzb25PYmplY3QpLml0ZW1zIGFzIEpzb25PYmplY3QpLmVudW0pXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICB0eXBlID0gJ2xpc3QnO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0eXBlID0gJ2lucHV0JztcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgbXVsdGlzZWxlY3Q7XG4gICAgICAgIGlmICh0eXBlID09PSAnbGlzdCcpIHtcbiAgICAgICAgICBtdWx0aXNlbGVjdCA9XG4gICAgICAgICAgICBzY2hlbWEubXVsdGlzZWxlY3QgPT09IHVuZGVmaW5lZFxuICAgICAgICAgICAgICA/IHByb3BlcnR5VHlwZXMuc2l6ZSA9PT0gMSAmJiBwcm9wZXJ0eVR5cGVzLmhhcygnYXJyYXknKVxuICAgICAgICAgICAgICA6IHNjaGVtYS5tdWx0aXNlbGVjdDtcblxuICAgICAgICAgIGNvbnN0IGVudW1WYWx1ZXMgPSBtdWx0aXNlbGVjdFxuICAgICAgICAgICAgPyAocGFyZW50U2NoZW1hIGFzIEpzb25PYmplY3QpLml0ZW1zICYmXG4gICAgICAgICAgICAgICgocGFyZW50U2NoZW1hIGFzIEpzb25PYmplY3QpLml0ZW1zIGFzIEpzb25PYmplY3QpLmVudW1cbiAgICAgICAgICAgIDogKHBhcmVudFNjaGVtYSBhcyBKc29uT2JqZWN0KS5lbnVtO1xuICAgICAgICAgIGlmICghaXRlbXMgJiYgQXJyYXkuaXNBcnJheShlbnVtVmFsdWVzKSkge1xuICAgICAgICAgICAgaXRlbXMgPSBbXTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgdmFsdWUgb2YgZW51bVZhbHVlcykge1xuICAgICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgaXRlbXMucHVzaCh2YWx1ZSk7XG4gICAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHZhbHVlID09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgLy8gSW52YWxpZFxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGl0ZW1zLnB1c2goeyBsYWJlbDogdmFsdWUudG9TdHJpbmcoKSwgdmFsdWUgfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBkZWZpbml0aW9uOiBQcm9tcHREZWZpbml0aW9uID0ge1xuICAgICAgICAgIGlkOiBwYXRoLFxuICAgICAgICAgIHR5cGUsXG4gICAgICAgICAgbWVzc2FnZSxcbiAgICAgICAgICByYXc6IHNjaGVtYSxcbiAgICAgICAgICBpdGVtcyxcbiAgICAgICAgICBtdWx0aXNlbGVjdCxcbiAgICAgICAgICBwcm9wZXJ0eVR5cGVzLFxuICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICB0eXBlb2YgKHBhcmVudFNjaGVtYSBhcyBKc29uT2JqZWN0KS5kZWZhdWx0ID09ICdvYmplY3QnICYmXG4gICAgICAgICAgICAocGFyZW50U2NoZW1hIGFzIEpzb25PYmplY3QpLmRlZmF1bHQgIT09IG51bGwgJiZcbiAgICAgICAgICAgICFBcnJheS5pc0FycmF5KChwYXJlbnRTY2hlbWEgYXMgSnNvbk9iamVjdCkuZGVmYXVsdClcbiAgICAgICAgICAgICAgPyB1bmRlZmluZWRcbiAgICAgICAgICAgICAgOiAoKHBhcmVudFNjaGVtYSBhcyBKc29uT2JqZWN0KS5kZWZhdWx0IGFzIHN0cmluZ1tdKSxcbiAgICAgICAgICBhc3luYyB2YWxpZGF0b3IoZGF0YTogSnNvblZhbHVlKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBpdC5zZWxmLnZhbGlkYXRlKHBhcmVudFNjaGVtYSwgZGF0YSk7XG4gICAgICAgICAgICAgIC8vIElmIHRoZSBzY2hlbWEgaXMgc3luYyB0aGVuIGZhbHNlIHdpbGwgYmUgcmV0dXJuZWQgb24gdmFsaWRhdGlvbiBmYWlsdXJlXG4gICAgICAgICAgICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICAgICAgICB9IGVsc2UgaWYgKGl0LnNlbGYuZXJyb3JzPy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAvLyBWYWxpZGF0aW9uIGVycm9ycyB3aWxsIGJlIHByZXNlbnQgb24gdGhlIEFqdiBpbnN0YW5jZSB3aGVuIHN5bmNcbiAgICAgICAgICAgICAgICByZXR1cm4gaXQuc2VsZi5lcnJvcnNbMF0ubWVzc2FnZTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAvLyBJZiB0aGUgc2NoZW1hIGlzIGFzeW5jIHRoZW4gYW4gZXJyb3Igd2lsbCBiZSB0aHJvd24gb24gdmFsaWRhdGlvbiBmYWlsdXJlXG4gICAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KGUuZXJyb3JzKSAmJiBlLmVycm9ycy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZS5lcnJvcnNbMF0ubWVzc2FnZTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgfSxcbiAgICAgICAgfTtcblxuICAgICAgICBjb21waWxhdGlvblNjaGVtSW5mby5wcm9tcHREZWZpbml0aW9ucy5wdXNoKGRlZmluaXRpb24pO1xuXG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAodGhpczogeyBwcm9tcHRGaWVsZHNXaXRoVmFsdWU6IFNldDxzdHJpbmc+IH0pIHtcbiAgICAgICAgICAvLyBJZiAndGhpcycgaXMgdW5kZWZpbmVkIGluIHRoZSBjYWxsLCB0aGVuIGl0IGRlZmF1bHRzIHRvIHRoZSBnbG9iYWxcbiAgICAgICAgICAvLyAndGhpcycuXG4gICAgICAgICAgaWYgKHRoaXMgJiYgdGhpcy5wcm9tcHRGaWVsZHNXaXRoVmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMucHJvbXB0RmllbGRzV2l0aFZhbHVlLmFkZChwYXRoKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfTtcbiAgICAgIH0sXG4gICAgICBtZXRhU2NoZW1hOiB7XG4gICAgICAgIG9uZU9mOiBbXG4gICAgICAgICAgeyB0eXBlOiAnc3RyaW5nJyB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAndHlwZSc6IHsgdHlwZTogJ3N0cmluZycgfSxcbiAgICAgICAgICAgICAgJ21lc3NhZ2UnOiB7IHR5cGU6ICdzdHJpbmcnIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgYWRkaXRpb25hbFByb3BlcnRpZXM6IHRydWUsXG4gICAgICAgICAgICByZXF1aXJlZDogWydtZXNzYWdlJ10sXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIF9hcHBseVByb21wdHMoZGF0YTogSnNvblZhbHVlLCBwcm9tcHRzOiBBcnJheTxQcm9tcHREZWZpbml0aW9uPik6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHByb3ZpZGVyID0gdGhpcy5fcHJvbXB0UHJvdmlkZXI7XG4gICAgaWYgKCFwcm92aWRlcikge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGFuc3dlcnMgPSBhd2FpdCBmcm9tKHByb3ZpZGVyKHByb21wdHMpKS50b1Byb21pc2UoKTtcbiAgICBmb3IgKGNvbnN0IHBhdGggaW4gYW5zd2Vycykge1xuICAgICAgY29uc3QgcGF0aEZyYWdtZW50cyA9IHBhdGguc3BsaXQoJy8nKS5zbGljZSgxKTtcblxuICAgICAgQ29yZVNjaGVtYVJlZ2lzdHJ5Ll9zZXQoZGF0YSwgcGF0aEZyYWdtZW50cywgYW5zd2Vyc1twYXRoXSwgbnVsbCwgdW5kZWZpbmVkLCB0cnVlKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHN0YXRpYyBfc2V0KFxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG4gICAgZGF0YTogYW55LFxuICAgIGZyYWdtZW50czogc3RyaW5nW10sXG4gICAgdmFsdWU6IHVua25vd24sXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICBwYXJlbnQ6IGFueSA9IG51bGwsXG4gICAgcGFyZW50UHJvcGVydHk/OiBzdHJpbmcsXG4gICAgZm9yY2U/OiBib29sZWFuLFxuICApOiB2b2lkIHtcbiAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgZnJhZ21lbnRzLmxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgY29uc3QgZnJhZ21lbnQgPSBmcmFnbWVudHNbaW5kZXhdO1xuICAgICAgaWYgKC9eaVxcZCskLy50ZXN0KGZyYWdtZW50KSkge1xuICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkoZGF0YSkpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBkYXRhSW5kZXggPSAwOyBkYXRhSW5kZXggPCBkYXRhLmxlbmd0aDsgZGF0YUluZGV4KyspIHtcbiAgICAgICAgICBDb3JlU2NoZW1hUmVnaXN0cnkuX3NldChcbiAgICAgICAgICAgIGRhdGFbZGF0YUluZGV4XSxcbiAgICAgICAgICAgIGZyYWdtZW50cy5zbGljZShpbmRleCArIDEpLFxuICAgICAgICAgICAgdmFsdWUsXG4gICAgICAgICAgICBkYXRhLFxuICAgICAgICAgICAgYCR7ZGF0YUluZGV4fWAsXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaWYgKCFkYXRhICYmIHBhcmVudCAhPT0gbnVsbCAmJiBwYXJlbnRQcm9wZXJ0eSkge1xuICAgICAgICBkYXRhID0gcGFyZW50W3BhcmVudFByb3BlcnR5XSA9IHt9O1xuICAgICAgfVxuXG4gICAgICBwYXJlbnQgPSBkYXRhO1xuICAgICAgcGFyZW50UHJvcGVydHkgPSBmcmFnbWVudDtcbiAgICAgIGRhdGEgPSBkYXRhW2ZyYWdtZW50XTtcbiAgICB9XG5cbiAgICBpZiAocGFyZW50ICYmIHBhcmVudFByb3BlcnR5ICYmIChmb3JjZSB8fCBwYXJlbnRbcGFyZW50UHJvcGVydHldID09PSB1bmRlZmluZWQpKSB7XG4gICAgICBwYXJlbnRbcGFyZW50UHJvcGVydHldID0gdmFsdWU7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBfYXBwbHlTbWFydERlZmF1bHRzPFQ+KFxuICAgIGRhdGE6IFQsXG4gICAgc21hcnREZWZhdWx0czogTWFwPHN0cmluZywgSnNvbk9iamVjdD4sXG4gICk6IFByb21pc2U8dm9pZD4ge1xuICAgIGZvciAoY29uc3QgW3BvaW50ZXIsIHNjaGVtYV0gb2Ygc21hcnREZWZhdWx0cy5lbnRyaWVzKCkpIHtcbiAgICAgIGNvbnN0IGZyYWdtZW50cyA9IEpTT04ucGFyc2UocG9pbnRlcik7XG4gICAgICBjb25zdCBzb3VyY2UgPSB0aGlzLl9zb3VyY2VNYXAuZ2V0KHNjaGVtYS4kc291cmNlIGFzIHN0cmluZyk7XG4gICAgICBpZiAoIXNvdXJjZSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgbGV0IHZhbHVlID0gc291cmNlKHNjaGVtYSk7XG4gICAgICBpZiAoaXNPYnNlcnZhYmxlKHZhbHVlKSkge1xuICAgICAgICB2YWx1ZSA9IGF3YWl0IHZhbHVlLnRvUHJvbWlzZSgpO1xuICAgICAgfVxuXG4gICAgICBDb3JlU2NoZW1hUmVnaXN0cnkuX3NldChkYXRhLCBmcmFnbWVudHMsIHZhbHVlKTtcbiAgICB9XG4gIH1cblxuICB1c2VYRGVwcmVjYXRlZFByb3ZpZGVyKG9uVXNhZ2U6IChtZXNzYWdlOiBzdHJpbmcpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB0aGlzLl9hanYuYWRkS2V5d29yZCh7XG4gICAgICBrZXl3b3JkOiAneC1kZXByZWNhdGVkJyxcbiAgICAgIHZhbGlkYXRlOiAoc2NoZW1hLCBfZGF0YSwgX3BhcmVudFNjaGVtYSwgZGF0YUN4dCkgPT4ge1xuICAgICAgICBpZiAoc2NoZW1hKSB7XG4gICAgICAgICAgb25Vc2FnZShcbiAgICAgICAgICAgIGBPcHRpb24gXCIke2RhdGFDeHQ/LnBhcmVudERhdGFQcm9wZXJ0eX1cIiBpcyBkZXByZWNhdGVkJHtcbiAgICAgICAgICAgICAgdHlwZW9mIHNjaGVtYSA9PSAnc3RyaW5nJyA/ICc6ICcgKyBzY2hlbWEgOiAnLidcbiAgICAgICAgICAgIH1gLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0sXG4gICAgICBlcnJvcnM6IGZhbHNlLFxuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBub3JtYWxpemVEYXRhUGF0aEFycihpdDogU2NoZW1hT2JqQ3h0KTogKG51bWJlciB8IHN0cmluZylbXSB7XG4gICAgcmV0dXJuIGl0LmRhdGFQYXRoQXJyXG4gICAgICAuc2xpY2UoMSwgaXQuZGF0YUxldmVsICsgMSlcbiAgICAgIC5tYXAoKHApID0+ICh0eXBlb2YgcCA9PT0gJ251bWJlcicgPyBwIDogcC5zdHIucmVwbGFjZSgvXCIvZywgJycpKSk7XG4gIH1cbn1cbiJdfQ==