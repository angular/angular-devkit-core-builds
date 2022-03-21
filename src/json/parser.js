"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseJson = exports.parseJsonAst = exports.JsonParseMode = exports.PathSpecificJsonException = exports.UnexpectedEndOfInputException = exports.InvalidJsonCharacterException = exports.JsonException = void 0;
/* eslint-disable no-constant-condition */
const exception_1 = require("../exception");
class JsonException extends exception_1.BaseException {
}
exports.JsonException = JsonException;
/**
 * A character was invalid in this context.
 * @deprecated
 * @private
 */
class InvalidJsonCharacterException extends JsonException {
    constructor(context) {
        const pos = context.previous;
        const invalidChar = JSON.stringify(_peek(context));
        super(`Invalid JSON character: ${invalidChar} at ${pos.line}:${pos.character}.`);
        this.invalidChar = invalidChar;
        this.line = pos.line;
        this.offset = pos.offset;
        this.character = pos.character;
    }
}
exports.InvalidJsonCharacterException = InvalidJsonCharacterException;
/**
 * More input was expected, but we reached the end of the stream.
 * @deprecated
 * @private
 */
class UnexpectedEndOfInputException extends JsonException {
    constructor(_context) {
        super(`Unexpected end of file.`);
    }
}
exports.UnexpectedEndOfInputException = UnexpectedEndOfInputException;
/**
 * An error happened within a file.
 * @deprecated Deprecated since version 11. Use 3rd party JSON parsers such as `jsonc-parser` instead.
 */
class PathSpecificJsonException extends JsonException {
    constructor(path, exception) {
        super(`An error happened at file path ${JSON.stringify(path)}: ${exception.message}`);
        this.path = path;
        this.exception = exception;
    }
}
exports.PathSpecificJsonException = PathSpecificJsonException;
/**
 * Peek and return the next character from the context.
 * @private
 */
function _peek(context) {
    return context.original[context.position.offset];
}
/**
 * Move the context to the next character, including incrementing the line if necessary.
 * @private
 */
function _next(context) {
    context.previous = context.position;
    let { offset, line, character } = context.position;
    const char = context.original[offset];
    offset++;
    if (char == '\n') {
        line++;
        character = 0;
    }
    else {
        character++;
    }
    context.position = { offset, line, character };
}
function _token(context, valid) {
    const char = _peek(context);
    if (valid) {
        if (!char) {
            throw new UnexpectedEndOfInputException(context);
        }
        if (valid.indexOf(char) == -1) {
            throw new InvalidJsonCharacterException(context);
        }
    }
    // Move the position of the context to the next character.
    _next(context);
    return char;
}
/**
 * Read the exponent part of a number. The exponent part is looser for JSON than the number
 * part. `str` is the string of the number itself found so far, and start the position
 * where the full number started. Returns the node found.
 * @private
 */
function _readExpNumber(context, start, str, comments) {
    let char;
    let signed = false;
    while (true) {
        char = _token(context);
        if (char == '+' || char == '-') {
            if (signed) {
                break;
            }
            signed = true;
            str += char;
        }
        else if (char == '0' ||
            char == '1' ||
            char == '2' ||
            char == '3' ||
            char == '4' ||
            char == '5' ||
            char == '6' ||
            char == '7' ||
            char == '8' ||
            char == '9') {
            signed = true;
            str += char;
        }
        else {
            break;
        }
    }
    // We're done reading this number.
    context.position = context.previous;
    return {
        kind: 'number',
        start,
        end: context.position,
        text: context.original.substring(start.offset, context.position.offset),
        value: Number.parseFloat(str),
        comments: comments,
    };
}
/**
 * Read the hexa part of a 0xBADCAFE hexadecimal number.
 * @private
 */
function _readHexaNumber(context, isNegative, start, comments) {
    // Read an hexadecimal number, until it's not hexadecimal.
    let hexa = '';
    const valid = '0123456789abcdefABCDEF';
    for (let ch = _peek(context); ch && valid.includes(ch); ch = _peek(context)) {
        // Add it to the hexa string.
        hexa += ch;
        // Move the position of the context to the next character.
        _next(context);
    }
    const value = Number.parseInt(hexa, 16);
    // We're done reading this number.
    return {
        kind: 'number',
        start,
        end: context.position,
        text: context.original.substring(start.offset, context.position.offset),
        value: isNegative ? -value : value,
        comments,
    };
}
/**
 * Read a number from the context.
 * @private
 */
function _readNumber(context, comments = _readBlanks(context)) {
    let str = '';
    let dotted = false;
    const start = context.position;
    // read until `e` or end of line.
    while (true) {
        const char = _token(context);
        // Read tokens, one by one.
        if (char == '-') {
            if (str != '') {
                throw new InvalidJsonCharacterException(context);
            }
        }
        else if (char == 'I' &&
            (str == '-' || str == '' || str == '+') &&
            (context.mode & JsonParseMode.NumberConstantsAllowed) != 0) {
            // Infinity?
            // _token(context, 'I'); Already read.
            _token(context, 'n');
            _token(context, 'f');
            _token(context, 'i');
            _token(context, 'n');
            _token(context, 'i');
            _token(context, 't');
            _token(context, 'y');
            str += 'Infinity';
            break;
        }
        else if (char == '0') {
            if (str == '0' || str == '-0') {
                throw new InvalidJsonCharacterException(context);
            }
        }
        else if (char == '1' ||
            char == '2' ||
            char == '3' ||
            char == '4' ||
            char == '5' ||
            char == '6' ||
            char == '7' ||
            char == '8' ||
            char == '9') {
            if (str == '0' || str == '-0') {
                throw new InvalidJsonCharacterException(context);
            }
        }
        else if (char == '+' && str == '') {
            // Pass over.
        }
        else if (char == '.') {
            if (dotted) {
                throw new InvalidJsonCharacterException(context);
            }
            dotted = true;
        }
        else if (char == 'e' || char == 'E') {
            return _readExpNumber(context, start, str + char, comments);
        }
        else if (char == 'x' &&
            (str == '0' || str == '-0') &&
            (context.mode & JsonParseMode.HexadecimalNumberAllowed) != 0) {
            return _readHexaNumber(context, str == '-0', start, comments);
        }
        else {
            // We read one too many characters, so rollback the last character.
            context.position = context.previous;
            break;
        }
        str += char;
    }
    // We're done reading this number.
    if (str.endsWith('.') && (context.mode & JsonParseMode.HexadecimalNumberAllowed) == 0) {
        throw new InvalidJsonCharacterException(context);
    }
    return {
        kind: 'number',
        start,
        end: context.position,
        text: context.original.substring(start.offset, context.position.offset),
        value: Number.parseFloat(str),
        comments,
    };
}
/**
 * Read a string from the context. Takes the comments of the string or read the blanks before the
 * string.
 * @private
 */
function _readString(context, comments = _readBlanks(context)) {
    const start = context.position;
    // Consume the first string delimiter.
    const delim = _token(context);
    if ((context.mode & JsonParseMode.SingleQuotesAllowed) == 0) {
        if (delim == "'") {
            throw new InvalidJsonCharacterException(context);
        }
    }
    let str = '';
    while (true) {
        let char = _token(context);
        if (char == delim) {
            return {
                kind: 'string',
                start,
                end: context.position,
                text: context.original.substring(start.offset, context.position.offset),
                value: str,
                comments: comments,
            };
        }
        else if (char == '\\') {
            char = _token(context);
            switch (char) {
                case '\\':
                case '/':
                case '"':
                case delim:
                    str += char;
                    break;
                case 'b':
                    str += '\b';
                    break;
                case 'f':
                    str += '\f';
                    break;
                case 'n':
                    str += '\n';
                    break;
                case 'r':
                    str += '\r';
                    break;
                case 't':
                    str += '\t';
                    break;
                case 'u':
                    const [c0] = _token(context, '0123456789abcdefABCDEF');
                    const [c1] = _token(context, '0123456789abcdefABCDEF');
                    const [c2] = _token(context, '0123456789abcdefABCDEF');
                    const [c3] = _token(context, '0123456789abcdefABCDEF');
                    str += String.fromCharCode(parseInt(c0 + c1 + c2 + c3, 16));
                    break;
                case undefined:
                    throw new UnexpectedEndOfInputException(context);
                case '\n':
                    // Only valid when multiline strings are allowed.
                    if ((context.mode & JsonParseMode.MultiLineStringAllowed) == 0) {
                        throw new InvalidJsonCharacterException(context);
                    }
                    str += char;
                    break;
                default:
                    throw new InvalidJsonCharacterException(context);
            }
        }
        else if (char === undefined) {
            throw new UnexpectedEndOfInputException(context);
        }
        else if (char == '\b' || char == '\f' || char == '\n' || char == '\r' || char == '\t') {
            throw new InvalidJsonCharacterException(context);
        }
        else {
            str += char;
        }
    }
}
/**
 * Read the constant `true` from the context.
 * @private
 */
function _readTrue(context, comments = _readBlanks(context)) {
    const start = context.position;
    _token(context, 't');
    _token(context, 'r');
    _token(context, 'u');
    _token(context, 'e');
    const end = context.position;
    return {
        kind: 'true',
        start,
        end,
        text: context.original.substring(start.offset, end.offset),
        value: true,
        comments,
    };
}
/**
 * Read the constant `false` from the context.
 * @private
 */
function _readFalse(context, comments = _readBlanks(context)) {
    const start = context.position;
    _token(context, 'f');
    _token(context, 'a');
    _token(context, 'l');
    _token(context, 's');
    _token(context, 'e');
    const end = context.position;
    return {
        kind: 'false',
        start,
        end,
        text: context.original.substring(start.offset, end.offset),
        value: false,
        comments,
    };
}
/**
 * Read the constant `null` from the context.
 * @private
 */
function _readNull(context, comments = _readBlanks(context)) {
    const start = context.position;
    _token(context, 'n');
    _token(context, 'u');
    _token(context, 'l');
    _token(context, 'l');
    const end = context.position;
    return {
        kind: 'null',
        start,
        end,
        text: context.original.substring(start.offset, end.offset),
        value: null,
        comments: comments,
    };
}
/**
 * Read the constant `NaN` from the context.
 * @private
 */
function _readNaN(context, comments = _readBlanks(context)) {
    const start = context.position;
    _token(context, 'N');
    _token(context, 'a');
    _token(context, 'N');
    const end = context.position;
    return {
        kind: 'number',
        start,
        end,
        text: context.original.substring(start.offset, end.offset),
        value: NaN,
        comments: comments,
    };
}
/**
 * Read an array of JSON values from the context.
 * @private
 */
function _readArray(context, comments = _readBlanks(context)) {
    const start = context.position;
    // Consume the first delimiter.
    _token(context, '[');
    const value = [];
    const elements = [];
    _readBlanks(context);
    if (_peek(context) != ']') {
        const node = _readValue(context);
        elements.push(node);
        value.push(node.value);
    }
    while (_peek(context) != ']') {
        _token(context, ',');
        const valueComments = _readBlanks(context);
        if ((context.mode & JsonParseMode.TrailingCommasAllowed) !== 0 && _peek(context) === ']') {
            break;
        }
        const node = _readValue(context, valueComments);
        elements.push(node);
        value.push(node.value);
    }
    _token(context, ']');
    return {
        kind: 'array',
        start,
        end: context.position,
        text: context.original.substring(start.offset, context.position.offset),
        value,
        elements,
        comments,
    };
}
/**
 * Read an identifier from the context. An identifier is a valid JavaScript identifier, and this
 * function is only used in Loose mode.
 * @private
 */
function _readIdentifier(context, comments = _readBlanks(context)) {
    const start = context.position;
    let char = _peek(context);
    if (char && '0123456789'.indexOf(char) != -1) {
        const identifierNode = _readNumber(context);
        return {
            kind: 'identifier',
            start,
            end: identifierNode.end,
            text: identifierNode.text,
            value: identifierNode.value.toString(),
        };
    }
    const identValidFirstChar = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMOPQRSTUVWXYZ';
    const identValidChar = '_$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMOPQRSTUVWXYZ0123456789';
    let first = true;
    let value = '';
    while (true) {
        char = _token(context);
        if (char == undefined ||
            (first ? identValidFirstChar.indexOf(char) : identValidChar.indexOf(char)) == -1) {
            context.position = context.previous;
            return {
                kind: 'identifier',
                start,
                end: context.position,
                text: context.original.slice(start.offset, start.offset + context.position.offset),
                value,
                comments,
            };
        }
        value += char;
        first = false;
    }
}
/**
 * Read a property from the context. A property is a string or (in Loose mode only) a number or
 * an identifier, followed by a colon `:`.
 * @private
 */
function _readProperty(context, comments = _readBlanks(context)) {
    const start = context.position;
    let key;
    if ((context.mode & JsonParseMode.IdentifierKeyNamesAllowed) != 0) {
        const top = _peek(context);
        if (top == '"' || top == "'") {
            key = _readString(context);
        }
        else {
            key = _readIdentifier(context);
        }
    }
    else {
        key = _readString(context);
    }
    _readBlanks(context);
    _token(context, ':');
    const value = _readValue(context);
    const end = context.position;
    return {
        kind: 'keyvalue',
        key,
        value,
        start,
        end,
        text: context.original.substring(start.offset, end.offset),
        comments,
    };
}
/**
 * Read an object of properties -> JSON values from the context.
 * @private
 */
function _readObject(context, comments = _readBlanks(context)) {
    const start = context.position;
    // Consume the first delimiter.
    _token(context, '{');
    const value = {};
    const properties = [];
    _readBlanks(context);
    if (_peek(context) != '}') {
        const property = _readProperty(context);
        value[property.key.value] = property.value.value;
        properties.push(property);
        while (_peek(context) != '}') {
            _token(context, ',');
            const propertyComments = _readBlanks(context);
            if ((context.mode & JsonParseMode.TrailingCommasAllowed) !== 0 && _peek(context) === '}') {
                break;
            }
            const property = _readProperty(context, propertyComments);
            value[property.key.value] = property.value.value;
            properties.push(property);
        }
    }
    _token(context, '}');
    return {
        kind: 'object',
        properties,
        start,
        end: context.position,
        value,
        text: context.original.substring(start.offset, context.position.offset),
        comments,
    };
}
/**
 * Remove any blank character or comments (in Loose mode) from the context, returning an array
 * of comments if any are found.
 * @private
 */
function _readBlanks(context) {
    if ((context.mode & JsonParseMode.CommentsAllowed) != 0) {
        const comments = [];
        while (true) {
            const char = context.original[context.position.offset];
            if (char == '/' && context.original[context.position.offset + 1] == '*') {
                const start = context.position;
                // Multi line comment.
                _next(context);
                _next(context);
                while (context.original[context.position.offset] != '*' ||
                    context.original[context.position.offset + 1] != '/') {
                    _next(context);
                    if (context.position.offset >= context.original.length) {
                        throw new UnexpectedEndOfInputException(context);
                    }
                }
                // Remove "*/".
                _next(context);
                _next(context);
                comments.push({
                    kind: 'multicomment',
                    start,
                    end: context.position,
                    text: context.original.substring(start.offset, context.position.offset),
                    content: context.original.substring(start.offset + 2, context.position.offset - 2),
                });
            }
            else if (char == '/' && context.original[context.position.offset + 1] == '/') {
                const start = context.position;
                // Multi line comment.
                _next(context);
                _next(context);
                while (context.original[context.position.offset] != '\n') {
                    _next(context);
                    if (context.position.offset >= context.original.length) {
                        break;
                    }
                }
                // Remove "\n".
                if (context.position.offset < context.original.length) {
                    _next(context);
                }
                comments.push({
                    kind: 'comment',
                    start,
                    end: context.position,
                    text: context.original.substring(start.offset, context.position.offset),
                    content: context.original.substring(start.offset + 2, context.position.offset - 1),
                });
            }
            else if (char == ' ' || char == '\t' || char == '\n' || char == '\r' || char == '\f') {
                _next(context);
            }
            else {
                break;
            }
        }
        return comments;
    }
    else {
        let char = context.original[context.position.offset];
        while (char == ' ' || char == '\t' || char == '\n' || char == '\r' || char == '\f') {
            _next(context);
            char = context.original[context.position.offset];
        }
        return [];
    }
}
/**
 * Read a JSON value from the context, which can be any form of JSON value.
 * @private
 */
function _readValue(context, comments = _readBlanks(context)) {
    let result;
    // Clean up before.
    const char = _peek(context);
    switch (char) {
        case undefined:
            throw new UnexpectedEndOfInputException(context);
        case '-':
        case '0':
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
            result = _readNumber(context, comments);
            break;
        case '.':
        case '+':
            if ((context.mode & JsonParseMode.LaxNumberParsingAllowed) == 0) {
                throw new InvalidJsonCharacterException(context);
            }
            result = _readNumber(context, comments);
            break;
        case "'":
        case '"':
            result = _readString(context, comments);
            break;
        case 'I':
            if ((context.mode & JsonParseMode.NumberConstantsAllowed) == 0) {
                throw new InvalidJsonCharacterException(context);
            }
            result = _readNumber(context, comments);
            break;
        case 'N':
            if ((context.mode & JsonParseMode.NumberConstantsAllowed) == 0) {
                throw new InvalidJsonCharacterException(context);
            }
            result = _readNaN(context, comments);
            break;
        case 't':
            result = _readTrue(context, comments);
            break;
        case 'f':
            result = _readFalse(context, comments);
            break;
        case 'n':
            result = _readNull(context, comments);
            break;
        case '[':
            result = _readArray(context, comments);
            break;
        case '{':
            result = _readObject(context, comments);
            break;
        default:
            throw new InvalidJsonCharacterException(context);
    }
    // Clean up after.
    _readBlanks(context);
    return result;
}
/**
 * The Parse mode used for parsing the JSON string.
 */
var JsonParseMode;
(function (JsonParseMode) {
    JsonParseMode[JsonParseMode["Strict"] = 0] = "Strict";
    JsonParseMode[JsonParseMode["CommentsAllowed"] = 1] = "CommentsAllowed";
    JsonParseMode[JsonParseMode["SingleQuotesAllowed"] = 2] = "SingleQuotesAllowed";
    JsonParseMode[JsonParseMode["IdentifierKeyNamesAllowed"] = 4] = "IdentifierKeyNamesAllowed";
    JsonParseMode[JsonParseMode["TrailingCommasAllowed"] = 8] = "TrailingCommasAllowed";
    JsonParseMode[JsonParseMode["HexadecimalNumberAllowed"] = 16] = "HexadecimalNumberAllowed";
    JsonParseMode[JsonParseMode["MultiLineStringAllowed"] = 32] = "MultiLineStringAllowed";
    JsonParseMode[JsonParseMode["LaxNumberParsingAllowed"] = 64] = "LaxNumberParsingAllowed";
    JsonParseMode[JsonParseMode["NumberConstantsAllowed"] = 128] = "NumberConstantsAllowed";
    JsonParseMode[JsonParseMode["Default"] = 0] = "Default";
    JsonParseMode[JsonParseMode["Loose"] = 255] = "Loose";
    JsonParseMode[JsonParseMode["Json"] = 0] = "Json";
    JsonParseMode[JsonParseMode["Json5"] = 255] = "Json5";
})(JsonParseMode = exports.JsonParseMode || (exports.JsonParseMode = {}));
/**
 * Parse the JSON string and return its AST. The AST may be losing data (end comments are
 * discarded for example, and space characters are not represented in the AST), but all values
 * will have a single node in the AST (a 1-to-1 mapping).
 *
 * @deprecated Deprecated since version 11. Use 3rd party JSON parsers such as `jsonc-parser` instead.
 * @param input The string to use.
 * @param mode The mode to parse the input with. {@see JsonParseMode}.
 * @returns {JsonAstNode} The root node of the value of the AST.
 */
function parseJsonAst(input, mode = JsonParseMode.Default) {
    if (mode == JsonParseMode.Default) {
        mode = JsonParseMode.Strict;
    }
    const context = {
        position: { offset: 0, line: 0, character: 0 },
        previous: { offset: 0, line: 0, character: 0 },
        original: input,
        comments: undefined,
        mode,
    };
    const ast = _readValue(context);
    if (context.position.offset < input.length) {
        const rest = input.slice(context.position.offset);
        const i = rest.length > 20 ? rest.slice(0, 20) + '...' : rest;
        throw new Error(`Expected end of file, got "${i}" at ` +
            `${context.position.line}:${context.position.character}.`);
    }
    return ast;
}
exports.parseJsonAst = parseJsonAst;
/**
 * Parse a JSON string into its value.  This discards the AST and only returns the value itself.
 *
 * If a path option is pass, it also absorbs JSON parsing errors and return a new error with the
 * path in it. Useful for showing errors when parsing from a file.
 *
 * @deprecated Deprecated since version 11. Use 3rd party JSON parsers such as `jsonc-parser` instead.
 * @param input The string to parse.
 * @param mode The mode to parse the input with. {@see JsonParseMode}.
 * @param options Additional optinos for parsing.
 * @returns {JsonValue} The value represented by the JSON string.
 */
function parseJson(input, mode = JsonParseMode.Default, options) {
    try {
        // Try parsing for the fastest path available, if error, uses our own parser for better errors.
        if (mode == JsonParseMode.Strict) {
            try {
                return JSON.parse(input);
            }
            catch (err) {
                return parseJsonAst(input, mode).value;
            }
        }
        return parseJsonAst(input, mode).value;
    }
    catch (e) {
        if (options && options.path && e instanceof JsonException) {
            throw new PathSpecificJsonException(options.path, e);
        }
        throw e;
    }
}
exports.parseJson = parseJson;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFyc2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvY29yZS9zcmMvanNvbi9wYXJzZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBRUgsMENBQTBDO0FBQzFDLDRDQUE2QztBQWtCN0MsTUFBYSxhQUFjLFNBQVEseUJBQWE7Q0FBRztBQUFuRCxzQ0FBbUQ7QUFFbkQ7Ozs7R0FJRztBQUNILE1BQWEsNkJBQThCLFNBQVEsYUFBYTtJQU05RCxZQUFZLE9BQTBCO1FBQ3BDLE1BQU0sR0FBRyxHQUFHLE9BQU8sQ0FBQyxRQUFRLENBQUM7UUFDN0IsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztRQUNuRCxLQUFLLENBQUMsMkJBQTJCLFdBQVcsT0FBTyxHQUFHLENBQUMsSUFBSSxJQUFJLEdBQUcsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDO1FBRWpGLElBQUksQ0FBQyxXQUFXLEdBQUcsV0FBVyxDQUFDO1FBQy9CLElBQUksQ0FBQyxJQUFJLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQztRQUNyQixJQUFJLENBQUMsTUFBTSxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUM7UUFDekIsSUFBSSxDQUFDLFNBQVMsR0FBRyxHQUFHLENBQUMsU0FBUyxDQUFDO0lBQ2pDLENBQUM7Q0FDRjtBQWhCRCxzRUFnQkM7QUFFRDs7OztHQUlHO0FBQ0gsTUFBYSw2QkFBOEIsU0FBUSxhQUFhO0lBQzlELFlBQVksUUFBMkI7UUFDckMsS0FBSyxDQUFDLHlCQUF5QixDQUFDLENBQUM7SUFDbkMsQ0FBQztDQUNGO0FBSkQsc0VBSUM7QUFFRDs7O0dBR0c7QUFDSCxNQUFhLHlCQUEwQixTQUFRLGFBQWE7SUFDMUQsWUFBbUIsSUFBWSxFQUFTLFNBQXdCO1FBQzlELEtBQUssQ0FB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QUFJLENBQUM7UUFDOUQsTUFBTSxJQUFJLEtBQUssQ0FDYiw4QkFBOEIsQ0FBQyxPQUFPO1lBQ3BDLEdBQUcsT0FBTyxDQUFDLFFBQVEsQ0FBQyxJQUFJLElBQUksT0FBTyxDQUFDLFFBQVEsQ0FBQyxTQUFTLEdBQUcsQ0FDNUQsQ0FBQztLQUNIO0lBRUQsT0FBTyxHQUFHLENBQUM7QUFDYixDQUFDO0FBeEJELG9DQXdCQztBQWNEOzs7Ozs7Ozs7OztHQVdHO0FBQ0gsU0FBZ0IsU0FBUyxDQUN2QixLQUFhLEVBQ2IsSUFBSSxHQUFHLGFBQWEsQ0FBQyxPQUFPLEVBQzVCLE9BQTBCO0lBRTFCLElBQUk7UUFDRiwrRkFBK0Y7UUFDL0YsSUFBSSxJQUFJLElBQUksYUFBYSxDQUFDLE1BQU0sRUFBRTtZQUNoQyxJQUFJO2dCQUNGLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQzthQUMxQjtZQUFDLE9BQU8sR0FBRyxFQUFFO2dCQUNaLE9BQU8sWUFBWSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUM7YUFDeEM7U0FDRjtRQUVELE9BQU8sWUFBWSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUM7S0FDeEM7SUFBQyxPQUFPLENBQUMsRUFBRTtRQUNWLElBQUksT0FBTyxJQUFJLE9BQU8sQ0FBQyxJQUFJLElBQUksQ0FBQyxZQUFZLGFBQWEsRUFBRTtZQUN6RCxNQUFNLElBQUkseUJBQXlCLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztTQUN0RDtRQUNELE1BQU0sQ0FBQyxDQUFDO0tBQ1Q7QUFDSCxDQUFDO0FBdEJELDhCQXNCQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG4vKiBlc2xpbnQtZGlzYWJsZSBuby1jb25zdGFudC1jb25kaXRpb24gKi9cbmltcG9ydCB7IEJhc2VFeGNlcHRpb24gfSBmcm9tICcuLi9leGNlcHRpb24nO1xuaW1wb3J0IHtcbiAgSnNvbkFzdEFycmF5LFxuICBKc29uQXN0Q29tbWVudCxcbiAgSnNvbkFzdENvbnN0YW50RmFsc2UsXG4gIEpzb25Bc3RDb25zdGFudE51bGwsXG4gIEpzb25Bc3RDb25zdGFudFRydWUsXG4gIEpzb25Bc3RJZGVudGlmaWVyLFxuICBKc29uQXN0S2V5VmFsdWUsXG4gIEpzb25Bc3RNdWx0aWxpbmVDb21tZW50LFxuICBKc29uQXN0Tm9kZSxcbiAgSnNvbkFzdE51bWJlcixcbiAgSnNvbkFzdE9iamVjdCxcbiAgSnNvbkFzdFN0cmluZyxcbiAgUG9zaXRpb24sXG59IGZyb20gJy4vcGFyc2VyX2FzdCc7XG5pbXBvcnQgeyBKc29uQXJyYXksIEpzb25PYmplY3QsIEpzb25WYWx1ZSB9IGZyb20gJy4vdXRpbHMnO1xuXG5leHBvcnQgY2xhc3MgSnNvbkV4Y2VwdGlvbiBleHRlbmRzIEJhc2VFeGNlcHRpb24ge31cblxuLyoqXG4gKiBBIGNoYXJhY3RlciB3YXMgaW52YWxpZCBpbiB0aGlzIGNvbnRleHQuXG4gKiBAZGVwcmVjYXRlZFxuICogQHByaXZhdGVcbiAqL1xuZXhwb3J0IGNsYXNzIEludmFsaWRKc29uQ2hhcmFjdGVyRXhjZXB0aW9uIGV4dGVuZHMgSnNvbkV4Y2VwdGlvbiB7XG4gIGludmFsaWRDaGFyOiBzdHJpbmc7XG4gIGxpbmU6IG51bWJlcjtcbiAgY2hhcmFjdGVyOiBudW1iZXI7XG4gIG9mZnNldDogbnVtYmVyO1xuXG4gIGNvbnN0cnVjdG9yKGNvbnRleHQ6IEpzb25QYXJzZXJDb250ZXh0KSB7XG4gICAgY29uc3QgcG9zID0gY29udGV4dC5wcmV2aW91cztcbiAgICBjb25zdCBpbnZhbGlkQ2hhciA9IEpTT04uc3RyaW5naWZ5KF9wZWVrKGNvbnRleHQpKTtcbiAgICBzdXBlcihgSW52YWxpZCBKU09OIGNoYXJhY3RlcjogJHtpbnZhbGlkQ2hhcn0gYXQgJHtwb3MubGluZX06JHtwb3MuY2hhcmFjdGVyfS5gKTtcblxuICAgIHRoaXMuaW52YWxpZENoYXIgPSBpbnZhbGlkQ2hhcjtcbiAgICB0aGlzLmxpbmUgPSBwb3MubGluZTtcbiAgICB0aGlzLm9mZnNldCA9IHBvcy5vZmZzZXQ7XG4gICAgdGhpcy5jaGFyYWN0ZXIgPSBwb3MuY2hhcmFjdGVyO1xuICB9XG59XG5cbi8qKlxuICogTW9yZSBpbnB1dCB3YXMgZXhwZWN0ZWQsIGJ1dCB3ZSByZWFjaGVkIHRoZSBlbmQgb2YgdGhlIHN0cmVhbS5cbiAqIEBkZXByZWNhdGVkXG4gKiBAcHJpdmF0ZVxuICovXG5leHBvcnQgY2xhc3MgVW5leHBlY3RlZEVuZE9mSW5wdXRFeGNlcHRpb24gZXh0ZW5kcyBKc29uRXhjZXB0aW9uIHtcbiAgY29uc3RydWN0b3IoX2NvbnRleHQ6IEpzb25QYXJzZXJDb250ZXh0KSB7XG4gICAgc3VwZXIoYFVuZXhwZWN0ZWQgZW5kIG9mIGZpbGUuYCk7XG4gIH1cbn1cblxuLyoqXG4gKiBBbiBlcnJvciBoYXBwZW5lZCB3aXRoaW4gYSBmaWxlLlxuICogQGRlcHJlY2F0ZWQgRGVwcmVjYXRlZCBzaW5jZSB2ZXJzaW9uIDExLiBVc2UgM3JkIHBhcnR5IEpTT04gcGFyc2VycyBzdWNoIGFzIGBqc29uYy1wYXJzZXJgIGluc3RlYWQuXG4gKi9cbmV4cG9ydCBjbGFzcyBQYXRoU3BlY2lmaWNKc29uRXhjZXB0aW9uIGV4dGVuZHMgSnNvbkV4Y2VwdGlvbiB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBwYXRoOiBzdHJpbmcsIHB1YmxpYyBleGNlcHRpb246IEpzb25FeGNlcHRpb24pIHtcbiAgICBzdXBlcihgQW4gZXJyb3IgaGFwcGVuZWQgYXQgZmlsZSBwYXRoICR7SlNPTi5zdHJpbmdpZnkocGF0aCl9OiAke2V4Y2VwdGlvbi5tZXNzYWdlfWApO1xuICB9XG59XG5cbi8qKlxuICogQ29udGV4dCBwYXNzZWQgYXJvdW5kIHRoZSBwYXJzZXIgd2l0aCBpbmZvcm1hdGlvbiBhYm91dCB3aGVyZSB3ZSBjdXJyZW50bHkgYXJlIGluIHRoZSBwYXJzZS5cbiAqIEBkZXByZWNhdGVkIERlcHJlY2F0ZWQgc2luY2UgdmVyc2lvbiAxMS4gVXNlIDNyZCBwYXJ0eSBKU09OIHBhcnNlcnMgc3VjaCBhcyBganNvbmMtcGFyc2VyYCBpbnN0ZWFkLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIEpzb25QYXJzZXJDb250ZXh0IHtcbiAgcG9zaXRpb246IFBvc2l0aW9uO1xuICBwcmV2aW91czogUG9zaXRpb247XG4gIHJlYWRvbmx5IG9yaWdpbmFsOiBzdHJpbmc7XG4gIHJlYWRvbmx5IG1vZGU6IEpzb25QYXJzZU1vZGU7XG59XG5cbi8qKlxuICogUGVlayBhbmQgcmV0dXJuIHRoZSBuZXh0IGNoYXJhY3RlciBmcm9tIHRoZSBjb250ZXh0LlxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gX3BlZWsoY29udGV4dDogSnNvblBhcnNlckNvbnRleHQpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICByZXR1cm4gY29udGV4dC5vcmlnaW5hbFtjb250ZXh0LnBvc2l0aW9uLm9mZnNldF07XG59XG5cbi8qKlxuICogTW92ZSB0aGUgY29udGV4dCB0byB0aGUgbmV4dCBjaGFyYWN0ZXIsIGluY2x1ZGluZyBpbmNyZW1lbnRpbmcgdGhlIGxpbmUgaWYgbmVjZXNzYXJ5LlxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gX25leHQoY29udGV4dDogSnNvblBhcnNlckNvbnRleHQpIHtcbiAgY29udGV4dC5wcmV2aW91cyA9IGNvbnRleHQucG9zaXRpb247XG5cbiAgbGV0IHsgb2Zmc2V0LCBsaW5lLCBjaGFyYWN0ZXIgfSA9IGNvbnRleHQucG9zaXRpb247XG4gIGNvbnN0IGNoYXIgPSBjb250ZXh0Lm9yaWdpbmFsW29mZnNldF07XG4gIG9mZnNldCsrO1xuICBpZiAoY2hhciA9PSAnXFxuJykge1xuICAgIGxpbmUrKztcbiAgICBjaGFyYWN0ZXIgPSAwO1xuICB9IGVsc2Uge1xuICAgIGNoYXJhY3RlcisrO1xuICB9XG4gIGNvbnRleHQucG9zaXRpb24gPSB7IG9mZnNldCwgbGluZSwgY2hhcmFjdGVyIH07XG59XG5cbi8qKlxuICogUmVhZCBhIHNpbmdsZSBjaGFyYWN0ZXIgZnJvbSB0aGUgaW5wdXQuIElmIGEgYHZhbGlkYCBzdHJpbmcgaXMgcGFzc2VkLCB2YWxpZGF0ZSB0aGF0IHRoZVxuICogY2hhcmFjdGVyIGlzIGluY2x1ZGVkIGluIHRoZSB2YWxpZCBzdHJpbmcuXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBfdG9rZW4oY29udGV4dDogSnNvblBhcnNlckNvbnRleHQsIHZhbGlkOiBzdHJpbmcpOiBzdHJpbmc7XG5mdW5jdGlvbiBfdG9rZW4oY29udGV4dDogSnNvblBhcnNlckNvbnRleHQpOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5mdW5jdGlvbiBfdG9rZW4oY29udGV4dDogSnNvblBhcnNlckNvbnRleHQsIHZhbGlkPzogc3RyaW5nKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgY29uc3QgY2hhciA9IF9wZWVrKGNvbnRleHQpO1xuICBpZiAodmFsaWQpIHtcbiAgICBpZiAoIWNoYXIpIHtcbiAgICAgIHRocm93IG5ldyBVbmV4cGVjdGVkRW5kT2ZJbnB1dEV4Y2VwdGlvbihjb250ZXh0KTtcbiAgICB9XG4gICAgaWYgKHZhbGlkLmluZGV4T2YoY2hhcikgPT0gLTEpIHtcbiAgICAgIHRocm93IG5ldyBJbnZhbGlkSnNvbkNoYXJhY3RlckV4Y2VwdGlvbihjb250ZXh0KTtcbiAgICB9XG4gIH1cblxuICAvLyBNb3ZlIHRoZSBwb3NpdGlvbiBvZiB0aGUgY29udGV4dCB0byB0aGUgbmV4dCBjaGFyYWN0ZXIuXG4gIF9uZXh0KGNvbnRleHQpO1xuXG4gIHJldHVybiBjaGFyO1xufVxuXG4vKipcbiAqIFJlYWQgdGhlIGV4cG9uZW50IHBhcnQgb2YgYSBudW1iZXIuIFRoZSBleHBvbmVudCBwYXJ0IGlzIGxvb3NlciBmb3IgSlNPTiB0aGFuIHRoZSBudW1iZXJcbiAqIHBhcnQuIGBzdHJgIGlzIHRoZSBzdHJpbmcgb2YgdGhlIG51bWJlciBpdHNlbGYgZm91bmQgc28gZmFyLCBhbmQgc3RhcnQgdGhlIHBvc2l0aW9uXG4gKiB3aGVyZSB0aGUgZnVsbCBudW1iZXIgc3RhcnRlZC4gUmV0dXJucyB0aGUgbm9kZSBmb3VuZC5cbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIF9yZWFkRXhwTnVtYmVyKFxuICBjb250ZXh0OiBKc29uUGFyc2VyQ29udGV4dCxcbiAgc3RhcnQ6IFBvc2l0aW9uLFxuICBzdHI6IHN0cmluZyxcbiAgY29tbWVudHM6IChKc29uQXN0Q29tbWVudCB8IEpzb25Bc3RNdWx0aWxpbmVDb21tZW50KVtdLFxuKTogSnNvbkFzdE51bWJlciB7XG4gIGxldCBjaGFyO1xuICBsZXQgc2lnbmVkID0gZmFsc2U7XG5cbiAgd2hpbGUgKHRydWUpIHtcbiAgICBjaGFyID0gX3Rva2VuKGNvbnRleHQpO1xuICAgIGlmIChjaGFyID09ICcrJyB8fCBjaGFyID09ICctJykge1xuICAgICAgaWYgKHNpZ25lZCkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIHNpZ25lZCA9IHRydWU7XG4gICAgICBzdHIgKz0gY2hhcjtcbiAgICB9IGVsc2UgaWYgKFxuICAgICAgY2hhciA9PSAnMCcgfHxcbiAgICAgIGNoYXIgPT0gJzEnIHx8XG4gICAgICBjaGFyID09ICcyJyB8fFxuICAgICAgY2hhciA9PSAnMycgfHxcbiAgICAgIGNoYXIgPT0gJzQnIHx8XG4gICAgICBjaGFyID09ICc1JyB8fFxuICAgICAgY2hhciA9PSAnNicgfHxcbiAgICAgIGNoYXIgPT0gJzcnIHx8XG4gICAgICBjaGFyID09ICc4JyB8fFxuICAgICAgY2hhciA9PSAnOSdcbiAgICApIHtcbiAgICAgIHNpZ25lZCA9IHRydWU7XG4gICAgICBzdHIgKz0gY2hhcjtcbiAgICB9IGVsc2Uge1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgLy8gV2UncmUgZG9uZSByZWFkaW5nIHRoaXMgbnVtYmVyLlxuICBjb250ZXh0LnBvc2l0aW9uID0gY29udGV4dC5wcmV2aW91cztcblxuICByZXR1cm4ge1xuICAgIGtpbmQ6ICdudW1iZXInLFxuICAgIHN0YXJ0LFxuICAgIGVuZDogY29udGV4dC5wb3NpdGlvbixcbiAgICB0ZXh0OiBjb250ZXh0Lm9yaWdpbmFsLnN1YnN0cmluZyhzdGFydC5vZmZzZXQsIGNvbnRleHQucG9zaXRpb24ub2Zmc2V0KSxcbiAgICB2YWx1ZTogTnVtYmVyLnBhcnNlRmxvYXQoc3RyKSxcbiAgICBjb21tZW50czogY29tbWVudHMsXG4gIH07XG59XG5cbi8qKlxuICogUmVhZCB0aGUgaGV4YSBwYXJ0IG9mIGEgMHhCQURDQUZFIGhleGFkZWNpbWFsIG51bWJlci5cbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIF9yZWFkSGV4YU51bWJlcihcbiAgY29udGV4dDogSnNvblBhcnNlckNvbnRleHQsXG4gIGlzTmVnYXRpdmU6IGJvb2xlYW4sXG4gIHN0YXJ0OiBQb3NpdGlvbixcbiAgY29tbWVudHM6IChKc29uQXN0Q29tbWVudCB8IEpzb25Bc3RNdWx0aWxpbmVDb21tZW50KVtdLFxuKTogSnNvbkFzdE51bWJlciB7XG4gIC8vIFJlYWQgYW4gaGV4YWRlY2ltYWwgbnVtYmVyLCB1bnRpbCBpdCdzIG5vdCBoZXhhZGVjaW1hbC5cbiAgbGV0IGhleGEgPSAnJztcbiAgY29uc3QgdmFsaWQgPSAnMDEyMzQ1Njc4OWFiY2RlZkFCQ0RFRic7XG5cbiAgZm9yIChsZXQgY2ggPSBfcGVlayhjb250ZXh0KTsgY2ggJiYgdmFsaWQuaW5jbHVkZXMoY2gpOyBjaCA9IF9wZWVrKGNvbnRleHQpKSB7XG4gICAgLy8gQWRkIGl0IHRvIHRoZSBoZXhhIHN0cmluZy5cbiAgICBoZXhhICs9IGNoO1xuICAgIC8vIE1vdmUgdGhlIHBvc2l0aW9uIG9mIHRoZSBjb250ZXh0IHRvIHRoZSBuZXh0IGNoYXJhY3Rlci5cbiAgICBfbmV4dChjb250ZXh0KTtcbiAgfVxuXG4gIGNvbnN0IHZhbHVlID0gTnVtYmVyLnBhcnNlSW50KGhleGEsIDE2KTtcblxuICAvLyBXZSdyZSBkb25lIHJlYWRpbmcgdGhpcyBudW1iZXIuXG4gIHJldHVybiB7XG4gICAga2luZDogJ251bWJlcicsXG4gICAgc3RhcnQsXG4gICAgZW5kOiBjb250ZXh0LnBvc2l0aW9uLFxuICAgIHRleHQ6IGNvbnRleHQub3JpZ2luYWwuc3Vic3RyaW5nKHN0YXJ0Lm9mZnNldCwgY29udGV4dC5wb3NpdGlvbi5vZmZzZXQpLFxuICAgIHZhbHVlOiBpc05lZ2F0aXZlID8gLXZhbHVlIDogdmFsdWUsXG4gICAgY29tbWVudHMsXG4gIH07XG59XG5cbi8qKlxuICogUmVhZCBhIG51bWJlciBmcm9tIHRoZSBjb250ZXh0LlxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gX3JlYWROdW1iZXIoY29udGV4dDogSnNvblBhcnNlckNvbnRleHQsIGNvbW1lbnRzID0gX3JlYWRCbGFua3MoY29udGV4dCkpOiBKc29uQXN0TnVtYmVyIHtcbiAgbGV0IHN0ciA9ICcnO1xuICBsZXQgZG90dGVkID0gZmFsc2U7XG4gIGNvbnN0IHN0YXJ0ID0gY29udGV4dC5wb3NpdGlvbjtcblxuICAvLyByZWFkIHVudGlsIGBlYCBvciBlbmQgb2YgbGluZS5cbiAgd2hpbGUgKHRydWUpIHtcbiAgICBjb25zdCBjaGFyID0gX3Rva2VuKGNvbnRleHQpO1xuXG4gICAgLy8gUmVhZCB0b2tlbnMsIG9uZSBieSBvbmUuXG4gICAgaWYgKGNoYXIgPT0gJy0nKSB7XG4gICAgICBpZiAoc3RyICE9ICcnKSB7XG4gICAgICAgIHRocm93IG5ldyBJbnZhbGlkSnNvbkNoYXJhY3RlckV4Y2VwdGlvbihjb250ZXh0KTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKFxuICAgICAgY2hhciA9PSAnSScgJiZcbiAgICAgIChzdHIgPT0gJy0nIHx8IHN0ciA9PSAnJyB8fCBzdHIgPT0gJysnKSAmJlxuICAgICAgKGNvbnRleHQubW9kZSAmIEpzb25QYXJzZU1vZGUuTnVtYmVyQ29uc3RhbnRzQWxsb3dlZCkgIT0gMFxuICAgICkge1xuICAgICAgLy8gSW5maW5pdHk/XG4gICAgICAvLyBfdG9rZW4oY29udGV4dCwgJ0knKTsgQWxyZWFkeSByZWFkLlxuICAgICAgX3Rva2VuKGNvbnRleHQsICduJyk7XG4gICAgICBfdG9rZW4oY29udGV4dCwgJ2YnKTtcbiAgICAgIF90b2tlbihjb250ZXh0LCAnaScpO1xuICAgICAgX3Rva2VuKGNvbnRleHQsICduJyk7XG4gICAgICBfdG9rZW4oY29udGV4dCwgJ2knKTtcbiAgICAgIF90b2tlbihjb250ZXh0LCAndCcpO1xuICAgICAgX3Rva2VuKGNvbnRleHQsICd5Jyk7XG5cbiAgICAgIHN0ciArPSAnSW5maW5pdHknO1xuICAgICAgYnJlYWs7XG4gICAgfSBlbHNlIGlmIChjaGFyID09ICcwJykge1xuICAgICAgaWYgKHN0ciA9PSAnMCcgfHwgc3RyID09ICctMCcpIHtcbiAgICAgICAgdGhyb3cgbmV3IEludmFsaWRKc29uQ2hhcmFjdGVyRXhjZXB0aW9uKGNvbnRleHQpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoXG4gICAgICBjaGFyID09ICcxJyB8fFxuICAgICAgY2hhciA9PSAnMicgfHxcbiAgICAgIGNoYXIgPT0gJzMnIHx8XG4gICAgICBjaGFyID09ICc0JyB8fFxuICAgICAgY2hhciA9PSAnNScgfHxcbiAgICAgIGNoYXIgPT0gJzYnIHx8XG4gICAgICBjaGFyID09ICc3JyB8fFxuICAgICAgY2hhciA9PSAnOCcgfHxcbiAgICAgIGNoYXIgPT0gJzknXG4gICAgKSB7XG4gICAgICBpZiAoc3RyID09ICcwJyB8fCBzdHIgPT0gJy0wJykge1xuICAgICAgICB0aHJvdyBuZXcgSW52YWxpZEpzb25DaGFyYWN0ZXJFeGNlcHRpb24oY29udGV4dCk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChjaGFyID09ICcrJyAmJiBzdHIgPT0gJycpIHtcbiAgICAgIC8vIFBhc3Mgb3Zlci5cbiAgICB9IGVsc2UgaWYgKGNoYXIgPT0gJy4nKSB7XG4gICAgICBpZiAoZG90dGVkKSB7XG4gICAgICAgIHRocm93IG5ldyBJbnZhbGlkSnNvbkNoYXJhY3RlckV4Y2VwdGlvbihjb250ZXh0KTtcbiAgICAgIH1cbiAgICAgIGRvdHRlZCA9IHRydWU7XG4gICAgfSBlbHNlIGlmIChjaGFyID09ICdlJyB8fCBjaGFyID09ICdFJykge1xuICAgICAgcmV0dXJuIF9yZWFkRXhwTnVtYmVyKGNvbnRleHQsIHN0YXJ0LCBzdHIgKyBjaGFyLCBjb21tZW50cyk7XG4gICAgfSBlbHNlIGlmIChcbiAgICAgIGNoYXIgPT0gJ3gnICYmXG4gICAgICAoc3RyID09ICcwJyB8fCBzdHIgPT0gJy0wJykgJiZcbiAgICAgIChjb250ZXh0Lm1vZGUgJiBKc29uUGFyc2VNb2RlLkhleGFkZWNpbWFsTnVtYmVyQWxsb3dlZCkgIT0gMFxuICAgICkge1xuICAgICAgcmV0dXJuIF9yZWFkSGV4YU51bWJlcihjb250ZXh0LCBzdHIgPT0gJy0wJywgc3RhcnQsIGNvbW1lbnRzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gV2UgcmVhZCBvbmUgdG9vIG1hbnkgY2hhcmFjdGVycywgc28gcm9sbGJhY2sgdGhlIGxhc3QgY2hhcmFjdGVyLlxuICAgICAgY29udGV4dC5wb3NpdGlvbiA9IGNvbnRleHQucHJldmlvdXM7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICBzdHIgKz0gY2hhcjtcbiAgfVxuXG4gIC8vIFdlJ3JlIGRvbmUgcmVhZGluZyB0aGlzIG51bWJlci5cbiAgaWYgKHN0ci5lbmRzV2l0aCgnLicpICYmIChjb250ZXh0Lm1vZGUgJiBKc29uUGFyc2VNb2RlLkhleGFkZWNpbWFsTnVtYmVyQWxsb3dlZCkgPT0gMCkge1xuICAgIHRocm93IG5ldyBJbnZhbGlkSnNvbkNoYXJhY3RlckV4Y2VwdGlvbihjb250ZXh0KTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAga2luZDogJ251bWJlcicsXG4gICAgc3RhcnQsXG4gICAgZW5kOiBjb250ZXh0LnBvc2l0aW9uLFxuICAgIHRleHQ6IGNvbnRleHQub3JpZ2luYWwuc3Vic3RyaW5nKHN0YXJ0Lm9mZnNldCwgY29udGV4dC5wb3NpdGlvbi5vZmZzZXQpLFxuICAgIHZhbHVlOiBOdW1iZXIucGFyc2VGbG9hdChzdHIpLFxuICAgIGNvbW1lbnRzLFxuICB9O1xufVxuXG4vKipcbiAqIFJlYWQgYSBzdHJpbmcgZnJvbSB0aGUgY29udGV4dC4gVGFrZXMgdGhlIGNvbW1lbnRzIG9mIHRoZSBzdHJpbmcgb3IgcmVhZCB0aGUgYmxhbmtzIGJlZm9yZSB0aGVcbiAqIHN0cmluZy5cbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIF9yZWFkU3RyaW5nKGNvbnRleHQ6IEpzb25QYXJzZXJDb250ZXh0LCBjb21tZW50cyA9IF9yZWFkQmxhbmtzKGNvbnRleHQpKTogSnNvbkFzdFN0cmluZyB7XG4gIGNvbnN0IHN0YXJ0ID0gY29udGV4dC5wb3NpdGlvbjtcblxuICAvLyBDb25zdW1lIHRoZSBmaXJzdCBzdHJpbmcgZGVsaW1pdGVyLlxuICBjb25zdCBkZWxpbSA9IF90b2tlbihjb250ZXh0KTtcbiAgaWYgKChjb250ZXh0Lm1vZGUgJiBKc29uUGFyc2VNb2RlLlNpbmdsZVF1b3Rlc0FsbG93ZWQpID09IDApIHtcbiAgICBpZiAoZGVsaW0gPT0gXCInXCIpIHtcbiAgICAgIHRocm93IG5ldyBJbnZhbGlkSnNvbkNoYXJhY3RlckV4Y2VwdGlvbihjb250ZXh0KTtcbiAgICB9XG4gIH1cblxuICBsZXQgc3RyID0gJyc7XG4gIHdoaWxlICh0cnVlKSB7XG4gICAgbGV0IGNoYXIgPSBfdG9rZW4oY29udGV4dCk7XG4gICAgaWYgKGNoYXIgPT0gZGVsaW0pIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGtpbmQ6ICdzdHJpbmcnLFxuICAgICAgICBzdGFydCxcbiAgICAgICAgZW5kOiBjb250ZXh0LnBvc2l0aW9uLFxuICAgICAgICB0ZXh0OiBjb250ZXh0Lm9yaWdpbmFsLnN1YnN0cmluZyhzdGFydC5vZmZzZXQsIGNvbnRleHQucG9zaXRpb24ub2Zmc2V0KSxcbiAgICAgICAgdmFsdWU6IHN0cixcbiAgICAgICAgY29tbWVudHM6IGNvbW1lbnRzLFxuICAgICAgfTtcbiAgICB9IGVsc2UgaWYgKGNoYXIgPT0gJ1xcXFwnKSB7XG4gICAgICBjaGFyID0gX3Rva2VuKGNvbnRleHQpO1xuICAgICAgc3dpdGNoIChjaGFyKSB7XG4gICAgICAgIGNhc2UgJ1xcXFwnOlxuICAgICAgICBjYXNlICcvJzpcbiAgICAgICAgY2FzZSAnXCInOlxuICAgICAgICBjYXNlIGRlbGltOlxuICAgICAgICAgIHN0ciArPSBjaGFyO1xuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ2InOlxuICAgICAgICAgIHN0ciArPSAnXFxiJztcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnZic6XG4gICAgICAgICAgc3RyICs9ICdcXGYnO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICduJzpcbiAgICAgICAgICBzdHIgKz0gJ1xcbic7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ3InOlxuICAgICAgICAgIHN0ciArPSAnXFxyJztcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAndCc6XG4gICAgICAgICAgc3RyICs9ICdcXHQnO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICd1JzpcbiAgICAgICAgICBjb25zdCBbYzBdID0gX3Rva2VuKGNvbnRleHQsICcwMTIzNDU2Nzg5YWJjZGVmQUJDREVGJyk7XG4gICAgICAgICAgY29uc3QgW2MxXSA9IF90b2tlbihjb250ZXh0LCAnMDEyMzQ1Njc4OWFiY2RlZkFCQ0RFRicpO1xuICAgICAgICAgIGNvbnN0IFtjMl0gPSBfdG9rZW4oY29udGV4dCwgJzAxMjM0NTY3ODlhYmNkZWZBQkNERUYnKTtcbiAgICAgICAgICBjb25zdCBbYzNdID0gX3Rva2VuKGNvbnRleHQsICcwMTIzNDU2Nzg5YWJjZGVmQUJDREVGJyk7XG4gICAgICAgICAgc3RyICs9IFN0cmluZy5mcm9tQ2hhckNvZGUocGFyc2VJbnQoYzAgKyBjMSArIGMyICsgYzMsIDE2KSk7XG4gICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSB1bmRlZmluZWQ6XG4gICAgICAgICAgdGhyb3cgbmV3IFVuZXhwZWN0ZWRFbmRPZklucHV0RXhjZXB0aW9uKGNvbnRleHQpO1xuXG4gICAgICAgIGNhc2UgJ1xcbic6XG4gICAgICAgICAgLy8gT25seSB2YWxpZCB3aGVuIG11bHRpbGluZSBzdHJpbmdzIGFyZSBhbGxvd2VkLlxuICAgICAgICAgIGlmICgoY29udGV4dC5tb2RlICYgSnNvblBhcnNlTW9kZS5NdWx0aUxpbmVTdHJpbmdBbGxvd2VkKSA9PSAwKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgSW52YWxpZEpzb25DaGFyYWN0ZXJFeGNlcHRpb24oY29udGV4dCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHN0ciArPSBjaGFyO1xuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgdGhyb3cgbmV3IEludmFsaWRKc29uQ2hhcmFjdGVyRXhjZXB0aW9uKGNvbnRleHQpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoY2hhciA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgVW5leHBlY3RlZEVuZE9mSW5wdXRFeGNlcHRpb24oY29udGV4dCk7XG4gICAgfSBlbHNlIGlmIChjaGFyID09ICdcXGInIHx8IGNoYXIgPT0gJ1xcZicgfHwgY2hhciA9PSAnXFxuJyB8fCBjaGFyID09ICdcXHInIHx8IGNoYXIgPT0gJ1xcdCcpIHtcbiAgICAgIHRocm93IG5ldyBJbnZhbGlkSnNvbkNoYXJhY3RlckV4Y2VwdGlvbihjb250ZXh0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RyICs9IGNoYXI7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogUmVhZCB0aGUgY29uc3RhbnQgYHRydWVgIGZyb20gdGhlIGNvbnRleHQuXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBfcmVhZFRydWUoXG4gIGNvbnRleHQ6IEpzb25QYXJzZXJDb250ZXh0LFxuICBjb21tZW50cyA9IF9yZWFkQmxhbmtzKGNvbnRleHQpLFxuKTogSnNvbkFzdENvbnN0YW50VHJ1ZSB7XG4gIGNvbnN0IHN0YXJ0ID0gY29udGV4dC5wb3NpdGlvbjtcbiAgX3Rva2VuKGNvbnRleHQsICd0Jyk7XG4gIF90b2tlbihjb250ZXh0LCAncicpO1xuICBfdG9rZW4oY29udGV4dCwgJ3UnKTtcbiAgX3Rva2VuKGNvbnRleHQsICdlJyk7XG5cbiAgY29uc3QgZW5kID0gY29udGV4dC5wb3NpdGlvbjtcblxuICByZXR1cm4ge1xuICAgIGtpbmQ6ICd0cnVlJyxcbiAgICBzdGFydCxcbiAgICBlbmQsXG4gICAgdGV4dDogY29udGV4dC5vcmlnaW5hbC5zdWJzdHJpbmcoc3RhcnQub2Zmc2V0LCBlbmQub2Zmc2V0KSxcbiAgICB2YWx1ZTogdHJ1ZSxcbiAgICBjb21tZW50cyxcbiAgfTtcbn1cblxuLyoqXG4gKiBSZWFkIHRoZSBjb25zdGFudCBgZmFsc2VgIGZyb20gdGhlIGNvbnRleHQuXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBfcmVhZEZhbHNlKFxuICBjb250ZXh0OiBKc29uUGFyc2VyQ29udGV4dCxcbiAgY29tbWVudHMgPSBfcmVhZEJsYW5rcyhjb250ZXh0KSxcbik6IEpzb25Bc3RDb25zdGFudEZhbHNlIHtcbiAgY29uc3Qgc3RhcnQgPSBjb250ZXh0LnBvc2l0aW9uO1xuICBfdG9rZW4oY29udGV4dCwgJ2YnKTtcbiAgX3Rva2VuKGNvbnRleHQsICdhJyk7XG4gIF90b2tlbihjb250ZXh0LCAnbCcpO1xuICBfdG9rZW4oY29udGV4dCwgJ3MnKTtcbiAgX3Rva2VuKGNvbnRleHQsICdlJyk7XG5cbiAgY29uc3QgZW5kID0gY29udGV4dC5wb3NpdGlvbjtcblxuICByZXR1cm4ge1xuICAgIGtpbmQ6ICdmYWxzZScsXG4gICAgc3RhcnQsXG4gICAgZW5kLFxuICAgIHRleHQ6IGNvbnRleHQub3JpZ2luYWwuc3Vic3RyaW5nKHN0YXJ0Lm9mZnNldCwgZW5kLm9mZnNldCksXG4gICAgdmFsdWU6IGZhbHNlLFxuICAgIGNvbW1lbnRzLFxuICB9O1xufVxuXG4vKipcbiAqIFJlYWQgdGhlIGNvbnN0YW50IGBudWxsYCBmcm9tIHRoZSBjb250ZXh0LlxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gX3JlYWROdWxsKFxuICBjb250ZXh0OiBKc29uUGFyc2VyQ29udGV4dCxcbiAgY29tbWVudHMgPSBfcmVhZEJsYW5rcyhjb250ZXh0KSxcbik6IEpzb25Bc3RDb25zdGFudE51bGwge1xuICBjb25zdCBzdGFydCA9IGNvbnRleHQucG9zaXRpb247XG5cbiAgX3Rva2VuKGNvbnRleHQsICduJyk7XG4gIF90b2tlbihjb250ZXh0LCAndScpO1xuICBfdG9rZW4oY29udGV4dCwgJ2wnKTtcbiAgX3Rva2VuKGNvbnRleHQsICdsJyk7XG5cbiAgY29uc3QgZW5kID0gY29udGV4dC5wb3NpdGlvbjtcblxuICByZXR1cm4ge1xuICAgIGtpbmQ6ICdudWxsJyxcbiAgICBzdGFydCxcbiAgICBlbmQsXG4gICAgdGV4dDogY29udGV4dC5vcmlnaW5hbC5zdWJzdHJpbmcoc3RhcnQub2Zmc2V0LCBlbmQub2Zmc2V0KSxcbiAgICB2YWx1ZTogbnVsbCxcbiAgICBjb21tZW50czogY29tbWVudHMsXG4gIH07XG59XG5cbi8qKlxuICogUmVhZCB0aGUgY29uc3RhbnQgYE5hTmAgZnJvbSB0aGUgY29udGV4dC5cbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIF9yZWFkTmFOKGNvbnRleHQ6IEpzb25QYXJzZXJDb250ZXh0LCBjb21tZW50cyA9IF9yZWFkQmxhbmtzKGNvbnRleHQpKTogSnNvbkFzdE51bWJlciB7XG4gIGNvbnN0IHN0YXJ0ID0gY29udGV4dC5wb3NpdGlvbjtcblxuICBfdG9rZW4oY29udGV4dCwgJ04nKTtcbiAgX3Rva2VuKGNvbnRleHQsICdhJyk7XG4gIF90b2tlbihjb250ZXh0LCAnTicpO1xuXG4gIGNvbnN0IGVuZCA9IGNvbnRleHQucG9zaXRpb247XG5cbiAgcmV0dXJuIHtcbiAgICBraW5kOiAnbnVtYmVyJyxcbiAgICBzdGFydCxcbiAgICBlbmQsXG4gICAgdGV4dDogY29udGV4dC5vcmlnaW5hbC5zdWJzdHJpbmcoc3RhcnQub2Zmc2V0LCBlbmQub2Zmc2V0KSxcbiAgICB2YWx1ZTogTmFOLFxuICAgIGNvbW1lbnRzOiBjb21tZW50cyxcbiAgfTtcbn1cblxuLyoqXG4gKiBSZWFkIGFuIGFycmF5IG9mIEpTT04gdmFsdWVzIGZyb20gdGhlIGNvbnRleHQuXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBfcmVhZEFycmF5KGNvbnRleHQ6IEpzb25QYXJzZXJDb250ZXh0LCBjb21tZW50cyA9IF9yZWFkQmxhbmtzKGNvbnRleHQpKTogSnNvbkFzdEFycmF5IHtcbiAgY29uc3Qgc3RhcnQgPSBjb250ZXh0LnBvc2l0aW9uO1xuXG4gIC8vIENvbnN1bWUgdGhlIGZpcnN0IGRlbGltaXRlci5cbiAgX3Rva2VuKGNvbnRleHQsICdbJyk7XG4gIGNvbnN0IHZhbHVlOiBKc29uQXJyYXkgPSBbXTtcbiAgY29uc3QgZWxlbWVudHM6IEpzb25Bc3ROb2RlW10gPSBbXTtcblxuICBfcmVhZEJsYW5rcyhjb250ZXh0KTtcbiAgaWYgKF9wZWVrKGNvbnRleHQpICE9ICddJykge1xuICAgIGNvbnN0IG5vZGUgPSBfcmVhZFZhbHVlKGNvbnRleHQpO1xuICAgIGVsZW1lbnRzLnB1c2gobm9kZSk7XG4gICAgdmFsdWUucHVzaChub2RlLnZhbHVlKTtcbiAgfVxuXG4gIHdoaWxlIChfcGVlayhjb250ZXh0KSAhPSAnXScpIHtcbiAgICBfdG9rZW4oY29udGV4dCwgJywnKTtcblxuICAgIGNvbnN0IHZhbHVlQ29tbWVudHMgPSBfcmVhZEJsYW5rcyhjb250ZXh0KTtcbiAgICBpZiAoKGNvbnRleHQubW9kZSAmIEpzb25QYXJzZU1vZGUuVHJhaWxpbmdDb21tYXNBbGxvd2VkKSAhPT0gMCAmJiBfcGVlayhjb250ZXh0KSA9PT0gJ10nKSB7XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgY29uc3Qgbm9kZSA9IF9yZWFkVmFsdWUoY29udGV4dCwgdmFsdWVDb21tZW50cyk7XG4gICAgZWxlbWVudHMucHVzaChub2RlKTtcbiAgICB2YWx1ZS5wdXNoKG5vZGUudmFsdWUpO1xuICB9XG5cbiAgX3Rva2VuKGNvbnRleHQsICddJyk7XG5cbiAgcmV0dXJuIHtcbiAgICBraW5kOiAnYXJyYXknLFxuICAgIHN0YXJ0LFxuICAgIGVuZDogY29udGV4dC5wb3NpdGlvbixcbiAgICB0ZXh0OiBjb250ZXh0Lm9yaWdpbmFsLnN1YnN0cmluZyhzdGFydC5vZmZzZXQsIGNvbnRleHQucG9zaXRpb24ub2Zmc2V0KSxcbiAgICB2YWx1ZSxcbiAgICBlbGVtZW50cyxcbiAgICBjb21tZW50cyxcbiAgfTtcbn1cblxuLyoqXG4gKiBSZWFkIGFuIGlkZW50aWZpZXIgZnJvbSB0aGUgY29udGV4dC4gQW4gaWRlbnRpZmllciBpcyBhIHZhbGlkIEphdmFTY3JpcHQgaWRlbnRpZmllciwgYW5kIHRoaXNcbiAqIGZ1bmN0aW9uIGlzIG9ubHkgdXNlZCBpbiBMb29zZSBtb2RlLlxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gX3JlYWRJZGVudGlmaWVyKFxuICBjb250ZXh0OiBKc29uUGFyc2VyQ29udGV4dCxcbiAgY29tbWVudHMgPSBfcmVhZEJsYW5rcyhjb250ZXh0KSxcbik6IEpzb25Bc3RJZGVudGlmaWVyIHtcbiAgY29uc3Qgc3RhcnQgPSBjb250ZXh0LnBvc2l0aW9uO1xuXG4gIGxldCBjaGFyID0gX3BlZWsoY29udGV4dCk7XG4gIGlmIChjaGFyICYmICcwMTIzNDU2Nzg5Jy5pbmRleE9mKGNoYXIpICE9IC0xKSB7XG4gICAgY29uc3QgaWRlbnRpZmllck5vZGUgPSBfcmVhZE51bWJlcihjb250ZXh0KTtcblxuICAgIHJldHVybiB7XG4gICAgICBraW5kOiAnaWRlbnRpZmllcicsXG4gICAgICBzdGFydCxcbiAgICAgIGVuZDogaWRlbnRpZmllck5vZGUuZW5kLFxuICAgICAgdGV4dDogaWRlbnRpZmllck5vZGUudGV4dCxcbiAgICAgIHZhbHVlOiBpZGVudGlmaWVyTm9kZS52YWx1ZS50b1N0cmluZygpLFxuICAgIH07XG4gIH1cblxuICBjb25zdCBpZGVudFZhbGlkRmlyc3RDaGFyID0gJ2FiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6QUJDREVGR0hJSktMTU9QUVJTVFVWV1hZWic7XG4gIGNvbnN0IGlkZW50VmFsaWRDaGFyID0gJ18kYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXpBQkNERUZHSElKS0xNT1BRUlNUVVZXWFlaMDEyMzQ1Njc4OSc7XG4gIGxldCBmaXJzdCA9IHRydWU7XG4gIGxldCB2YWx1ZSA9ICcnO1xuXG4gIHdoaWxlICh0cnVlKSB7XG4gICAgY2hhciA9IF90b2tlbihjb250ZXh0KTtcbiAgICBpZiAoXG4gICAgICBjaGFyID09IHVuZGVmaW5lZCB8fFxuICAgICAgKGZpcnN0ID8gaWRlbnRWYWxpZEZpcnN0Q2hhci5pbmRleE9mKGNoYXIpIDogaWRlbnRWYWxpZENoYXIuaW5kZXhPZihjaGFyKSkgPT0gLTFcbiAgICApIHtcbiAgICAgIGNvbnRleHQucG9zaXRpb24gPSBjb250ZXh0LnByZXZpb3VzO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBraW5kOiAnaWRlbnRpZmllcicsXG4gICAgICAgIHN0YXJ0LFxuICAgICAgICBlbmQ6IGNvbnRleHQucG9zaXRpb24sXG4gICAgICAgIHRleHQ6IGNvbnRleHQub3JpZ2luYWwuc2xpY2Uoc3RhcnQub2Zmc2V0LCBzdGFydC5vZmZzZXQgKyBjb250ZXh0LnBvc2l0aW9uLm9mZnNldCksXG4gICAgICAgIHZhbHVlLFxuICAgICAgICBjb21tZW50cyxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgdmFsdWUgKz0gY2hhcjtcbiAgICBmaXJzdCA9IGZhbHNlO1xuICB9XG59XG5cbi8qKlxuICogUmVhZCBhIHByb3BlcnR5IGZyb20gdGhlIGNvbnRleHQuIEEgcHJvcGVydHkgaXMgYSBzdHJpbmcgb3IgKGluIExvb3NlIG1vZGUgb25seSkgYSBudW1iZXIgb3JcbiAqIGFuIGlkZW50aWZpZXIsIGZvbGxvd2VkIGJ5IGEgY29sb24gYDpgLlxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gX3JlYWRQcm9wZXJ0eShcbiAgY29udGV4dDogSnNvblBhcnNlckNvbnRleHQsXG4gIGNvbW1lbnRzID0gX3JlYWRCbGFua3MoY29udGV4dCksXG4pOiBKc29uQXN0S2V5VmFsdWUge1xuICBjb25zdCBzdGFydCA9IGNvbnRleHQucG9zaXRpb247XG5cbiAgbGV0IGtleTtcbiAgaWYgKChjb250ZXh0Lm1vZGUgJiBKc29uUGFyc2VNb2RlLklkZW50aWZpZXJLZXlOYW1lc0FsbG93ZWQpICE9IDApIHtcbiAgICBjb25zdCB0b3AgPSBfcGVlayhjb250ZXh0KTtcbiAgICBpZiAodG9wID09ICdcIicgfHwgdG9wID09IFwiJ1wiKSB7XG4gICAgICBrZXkgPSBfcmVhZFN0cmluZyhjb250ZXh0KTtcbiAgICB9IGVsc2Uge1xuICAgICAga2V5ID0gX3JlYWRJZGVudGlmaWVyKGNvbnRleHQpO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBrZXkgPSBfcmVhZFN0cmluZyhjb250ZXh0KTtcbiAgfVxuXG4gIF9yZWFkQmxhbmtzKGNvbnRleHQpO1xuICBfdG9rZW4oY29udGV4dCwgJzonKTtcbiAgY29uc3QgdmFsdWUgPSBfcmVhZFZhbHVlKGNvbnRleHQpO1xuICBjb25zdCBlbmQgPSBjb250ZXh0LnBvc2l0aW9uO1xuXG4gIHJldHVybiB7XG4gICAga2luZDogJ2tleXZhbHVlJyxcbiAgICBrZXksXG4gICAgdmFsdWUsXG4gICAgc3RhcnQsXG4gICAgZW5kLFxuICAgIHRleHQ6IGNvbnRleHQub3JpZ2luYWwuc3Vic3RyaW5nKHN0YXJ0Lm9mZnNldCwgZW5kLm9mZnNldCksXG4gICAgY29tbWVudHMsXG4gIH07XG59XG5cbi8qKlxuICogUmVhZCBhbiBvYmplY3Qgb2YgcHJvcGVydGllcyAtPiBKU09OIHZhbHVlcyBmcm9tIHRoZSBjb250ZXh0LlxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gX3JlYWRPYmplY3QoY29udGV4dDogSnNvblBhcnNlckNvbnRleHQsIGNvbW1lbnRzID0gX3JlYWRCbGFua3MoY29udGV4dCkpOiBKc29uQXN0T2JqZWN0IHtcbiAgY29uc3Qgc3RhcnQgPSBjb250ZXh0LnBvc2l0aW9uO1xuICAvLyBDb25zdW1lIHRoZSBmaXJzdCBkZWxpbWl0ZXIuXG4gIF90b2tlbihjb250ZXh0LCAneycpO1xuICBjb25zdCB2YWx1ZTogSnNvbk9iamVjdCA9IHt9O1xuICBjb25zdCBwcm9wZXJ0aWVzOiBKc29uQXN0S2V5VmFsdWVbXSA9IFtdO1xuXG4gIF9yZWFkQmxhbmtzKGNvbnRleHQpO1xuICBpZiAoX3BlZWsoY29udGV4dCkgIT0gJ30nKSB7XG4gICAgY29uc3QgcHJvcGVydHkgPSBfcmVhZFByb3BlcnR5KGNvbnRleHQpO1xuICAgIHZhbHVlW3Byb3BlcnR5LmtleS52YWx1ZV0gPSBwcm9wZXJ0eS52YWx1ZS52YWx1ZTtcbiAgICBwcm9wZXJ0aWVzLnB1c2gocHJvcGVydHkpO1xuXG4gICAgd2hpbGUgKF9wZWVrKGNvbnRleHQpICE9ICd9Jykge1xuICAgICAgX3Rva2VuKGNvbnRleHQsICcsJyk7XG5cbiAgICAgIGNvbnN0IHByb3BlcnR5Q29tbWVudHMgPSBfcmVhZEJsYW5rcyhjb250ZXh0KTtcbiAgICAgIGlmICgoY29udGV4dC5tb2RlICYgSnNvblBhcnNlTW9kZS5UcmFpbGluZ0NvbW1hc0FsbG93ZWQpICE9PSAwICYmIF9wZWVrKGNvbnRleHQpID09PSAnfScpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjb25zdCBwcm9wZXJ0eSA9IF9yZWFkUHJvcGVydHkoY29udGV4dCwgcHJvcGVydHlDb21tZW50cyk7XG4gICAgICB2YWx1ZVtwcm9wZXJ0eS5rZXkudmFsdWVdID0gcHJvcGVydHkudmFsdWUudmFsdWU7XG4gICAgICBwcm9wZXJ0aWVzLnB1c2gocHJvcGVydHkpO1xuICAgIH1cbiAgfVxuXG4gIF90b2tlbihjb250ZXh0LCAnfScpO1xuXG4gIHJldHVybiB7XG4gICAga2luZDogJ29iamVjdCcsXG4gICAgcHJvcGVydGllcyxcbiAgICBzdGFydCxcbiAgICBlbmQ6IGNvbnRleHQucG9zaXRpb24sXG4gICAgdmFsdWUsXG4gICAgdGV4dDogY29udGV4dC5vcmlnaW5hbC5zdWJzdHJpbmcoc3RhcnQub2Zmc2V0LCBjb250ZXh0LnBvc2l0aW9uLm9mZnNldCksXG4gICAgY29tbWVudHMsXG4gIH07XG59XG5cbi8qKlxuICogUmVtb3ZlIGFueSBibGFuayBjaGFyYWN0ZXIgb3IgY29tbWVudHMgKGluIExvb3NlIG1vZGUpIGZyb20gdGhlIGNvbnRleHQsIHJldHVybmluZyBhbiBhcnJheVxuICogb2YgY29tbWVudHMgaWYgYW55IGFyZSBmb3VuZC5cbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIF9yZWFkQmxhbmtzKGNvbnRleHQ6IEpzb25QYXJzZXJDb250ZXh0KTogKEpzb25Bc3RDb21tZW50IHwgSnNvbkFzdE11bHRpbGluZUNvbW1lbnQpW10ge1xuICBpZiAoKGNvbnRleHQubW9kZSAmIEpzb25QYXJzZU1vZGUuQ29tbWVudHNBbGxvd2VkKSAhPSAwKSB7XG4gICAgY29uc3QgY29tbWVudHM6IChKc29uQXN0Q29tbWVudCB8IEpzb25Bc3RNdWx0aWxpbmVDb21tZW50KVtdID0gW107XG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgIGNvbnN0IGNoYXIgPSBjb250ZXh0Lm9yaWdpbmFsW2NvbnRleHQucG9zaXRpb24ub2Zmc2V0XTtcbiAgICAgIGlmIChjaGFyID09ICcvJyAmJiBjb250ZXh0Lm9yaWdpbmFsW2NvbnRleHQucG9zaXRpb24ub2Zmc2V0ICsgMV0gPT0gJyonKSB7XG4gICAgICAgIGNvbnN0IHN0YXJ0ID0gY29udGV4dC5wb3NpdGlvbjtcbiAgICAgICAgLy8gTXVsdGkgbGluZSBjb21tZW50LlxuICAgICAgICBfbmV4dChjb250ZXh0KTtcbiAgICAgICAgX25leHQoY29udGV4dCk7XG5cbiAgICAgICAgd2hpbGUgKFxuICAgICAgICAgIGNvbnRleHQub3JpZ2luYWxbY29udGV4dC5wb3NpdGlvbi5vZmZzZXRdICE9ICcqJyB8fFxuICAgICAgICAgIGNvbnRleHQub3JpZ2luYWxbY29udGV4dC5wb3NpdGlvbi5vZmZzZXQgKyAxXSAhPSAnLydcbiAgICAgICAgKSB7XG4gICAgICAgICAgX25leHQoY29udGV4dCk7XG4gICAgICAgICAgaWYgKGNvbnRleHQucG9zaXRpb24ub2Zmc2V0ID49IGNvbnRleHQub3JpZ2luYWwubGVuZ3RoKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgVW5leHBlY3RlZEVuZE9mSW5wdXRFeGNlcHRpb24oY29udGV4dCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIFJlbW92ZSBcIiovXCIuXG4gICAgICAgIF9uZXh0KGNvbnRleHQpO1xuICAgICAgICBfbmV4dChjb250ZXh0KTtcblxuICAgICAgICBjb21tZW50cy5wdXNoKHtcbiAgICAgICAgICBraW5kOiAnbXVsdGljb21tZW50JyxcbiAgICAgICAgICBzdGFydCxcbiAgICAgICAgICBlbmQ6IGNvbnRleHQucG9zaXRpb24sXG4gICAgICAgICAgdGV4dDogY29udGV4dC5vcmlnaW5hbC5zdWJzdHJpbmcoc3RhcnQub2Zmc2V0LCBjb250ZXh0LnBvc2l0aW9uLm9mZnNldCksXG4gICAgICAgICAgY29udGVudDogY29udGV4dC5vcmlnaW5hbC5zdWJzdHJpbmcoc3RhcnQub2Zmc2V0ICsgMiwgY29udGV4dC5wb3NpdGlvbi5vZmZzZXQgLSAyKSxcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKGNoYXIgPT0gJy8nICYmIGNvbnRleHQub3JpZ2luYWxbY29udGV4dC5wb3NpdGlvbi5vZmZzZXQgKyAxXSA9PSAnLycpIHtcbiAgICAgICAgY29uc3Qgc3RhcnQgPSBjb250ZXh0LnBvc2l0aW9uO1xuICAgICAgICAvLyBNdWx0aSBsaW5lIGNvbW1lbnQuXG4gICAgICAgIF9uZXh0KGNvbnRleHQpO1xuICAgICAgICBfbmV4dChjb250ZXh0KTtcblxuICAgICAgICB3aGlsZSAoY29udGV4dC5vcmlnaW5hbFtjb250ZXh0LnBvc2l0aW9uLm9mZnNldF0gIT0gJ1xcbicpIHtcbiAgICAgICAgICBfbmV4dChjb250ZXh0KTtcbiAgICAgICAgICBpZiAoY29udGV4dC5wb3NpdGlvbi5vZmZzZXQgPj0gY29udGV4dC5vcmlnaW5hbC5sZW5ndGgpIHtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJlbW92ZSBcIlxcblwiLlxuICAgICAgICBpZiAoY29udGV4dC5wb3NpdGlvbi5vZmZzZXQgPCBjb250ZXh0Lm9yaWdpbmFsLmxlbmd0aCkge1xuICAgICAgICAgIF9uZXh0KGNvbnRleHQpO1xuICAgICAgICB9XG4gICAgICAgIGNvbW1lbnRzLnB1c2goe1xuICAgICAgICAgIGtpbmQ6ICdjb21tZW50JyxcbiAgICAgICAgICBzdGFydCxcbiAgICAgICAgICBlbmQ6IGNvbnRleHQucG9zaXRpb24sXG4gICAgICAgICAgdGV4dDogY29udGV4dC5vcmlnaW5hbC5zdWJzdHJpbmcoc3RhcnQub2Zmc2V0LCBjb250ZXh0LnBvc2l0aW9uLm9mZnNldCksXG4gICAgICAgICAgY29udGVudDogY29udGV4dC5vcmlnaW5hbC5zdWJzdHJpbmcoc3RhcnQub2Zmc2V0ICsgMiwgY29udGV4dC5wb3NpdGlvbi5vZmZzZXQgLSAxKSxcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKGNoYXIgPT0gJyAnIHx8IGNoYXIgPT0gJ1xcdCcgfHwgY2hhciA9PSAnXFxuJyB8fCBjaGFyID09ICdcXHInIHx8IGNoYXIgPT0gJ1xcZicpIHtcbiAgICAgICAgX25leHQoY29udGV4dCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gY29tbWVudHM7XG4gIH0gZWxzZSB7XG4gICAgbGV0IGNoYXIgPSBjb250ZXh0Lm9yaWdpbmFsW2NvbnRleHQucG9zaXRpb24ub2Zmc2V0XTtcbiAgICB3aGlsZSAoY2hhciA9PSAnICcgfHwgY2hhciA9PSAnXFx0JyB8fCBjaGFyID09ICdcXG4nIHx8IGNoYXIgPT0gJ1xccicgfHwgY2hhciA9PSAnXFxmJykge1xuICAgICAgX25leHQoY29udGV4dCk7XG4gICAgICBjaGFyID0gY29udGV4dC5vcmlnaW5hbFtjb250ZXh0LnBvc2l0aW9uLm9mZnNldF07XG4gICAgfVxuXG4gICAgcmV0dXJuIFtdO1xuICB9XG59XG5cbi8qKlxuICogUmVhZCBhIEpTT04gdmFsdWUgZnJvbSB0aGUgY29udGV4dCwgd2hpY2ggY2FuIGJlIGFueSBmb3JtIG9mIEpTT04gdmFsdWUuXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBfcmVhZFZhbHVlKGNvbnRleHQ6IEpzb25QYXJzZXJDb250ZXh0LCBjb21tZW50cyA9IF9yZWFkQmxhbmtzKGNvbnRleHQpKTogSnNvbkFzdE5vZGUge1xuICBsZXQgcmVzdWx0OiBKc29uQXN0Tm9kZTtcblxuICAvLyBDbGVhbiB1cCBiZWZvcmUuXG4gIGNvbnN0IGNoYXIgPSBfcGVlayhjb250ZXh0KTtcbiAgc3dpdGNoIChjaGFyKSB7XG4gICAgY2FzZSB1bmRlZmluZWQ6XG4gICAgICB0aHJvdyBuZXcgVW5leHBlY3RlZEVuZE9mSW5wdXRFeGNlcHRpb24oY29udGV4dCk7XG5cbiAgICBjYXNlICctJzpcbiAgICBjYXNlICcwJzpcbiAgICBjYXNlICcxJzpcbiAgICBjYXNlICcyJzpcbiAgICBjYXNlICczJzpcbiAgICBjYXNlICc0JzpcbiAgICBjYXNlICc1JzpcbiAgICBjYXNlICc2JzpcbiAgICBjYXNlICc3JzpcbiAgICBjYXNlICc4JzpcbiAgICBjYXNlICc5JzpcbiAgICAgIHJlc3VsdCA9IF9yZWFkTnVtYmVyKGNvbnRleHQsIGNvbW1lbnRzKTtcbiAgICAgIGJyZWFrO1xuXG4gICAgY2FzZSAnLic6XG4gICAgY2FzZSAnKyc6XG4gICAgICBpZiAoKGNvbnRleHQubW9kZSAmIEpzb25QYXJzZU1vZGUuTGF4TnVtYmVyUGFyc2luZ0FsbG93ZWQpID09IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEludmFsaWRKc29uQ2hhcmFjdGVyRXhjZXB0aW9uKGNvbnRleHQpO1xuICAgICAgfVxuICAgICAgcmVzdWx0ID0gX3JlYWROdW1iZXIoY29udGV4dCwgY29tbWVudHMpO1xuICAgICAgYnJlYWs7XG5cbiAgICBjYXNlIFwiJ1wiOlxuICAgIGNhc2UgJ1wiJzpcbiAgICAgIHJlc3VsdCA9IF9yZWFkU3RyaW5nKGNvbnRleHQsIGNvbW1lbnRzKTtcbiAgICAgIGJyZWFrO1xuXG4gICAgY2FzZSAnSSc6XG4gICAgICBpZiAoKGNvbnRleHQubW9kZSAmIEpzb25QYXJzZU1vZGUuTnVtYmVyQ29uc3RhbnRzQWxsb3dlZCkgPT0gMCkge1xuICAgICAgICB0aHJvdyBuZXcgSW52YWxpZEpzb25DaGFyYWN0ZXJFeGNlcHRpb24oY29udGV4dCk7XG4gICAgICB9XG4gICAgICByZXN1bHQgPSBfcmVhZE51bWJlcihjb250ZXh0LCBjb21tZW50cyk7XG4gICAgICBicmVhaztcblxuICAgIGNhc2UgJ04nOlxuICAgICAgaWYgKChjb250ZXh0Lm1vZGUgJiBKc29uUGFyc2VNb2RlLk51bWJlckNvbnN0YW50c0FsbG93ZWQpID09IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEludmFsaWRKc29uQ2hhcmFjdGVyRXhjZXB0aW9uKGNvbnRleHQpO1xuICAgICAgfVxuICAgICAgcmVzdWx0ID0gX3JlYWROYU4oY29udGV4dCwgY29tbWVudHMpO1xuICAgICAgYnJlYWs7XG5cbiAgICBjYXNlICd0JzpcbiAgICAgIHJlc3VsdCA9IF9yZWFkVHJ1ZShjb250ZXh0LCBjb21tZW50cyk7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdmJzpcbiAgICAgIHJlc3VsdCA9IF9yZWFkRmFsc2UoY29udGV4dCwgY29tbWVudHMpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnbic6XG4gICAgICByZXN1bHQgPSBfcmVhZE51bGwoY29udGV4dCwgY29tbWVudHMpO1xuICAgICAgYnJlYWs7XG5cbiAgICBjYXNlICdbJzpcbiAgICAgIHJlc3VsdCA9IF9yZWFkQXJyYXkoY29udGV4dCwgY29tbWVudHMpO1xuICAgICAgYnJlYWs7XG5cbiAgICBjYXNlICd7JzpcbiAgICAgIHJlc3VsdCA9IF9yZWFkT2JqZWN0KGNvbnRleHQsIGNvbW1lbnRzKTtcbiAgICAgIGJyZWFrO1xuXG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBJbnZhbGlkSnNvbkNoYXJhY3RlckV4Y2VwdGlvbihjb250ZXh0KTtcbiAgfVxuXG4gIC8vIENsZWFuIHVwIGFmdGVyLlxuICBfcmVhZEJsYW5rcyhjb250ZXh0KTtcblxuICByZXR1cm4gcmVzdWx0O1xufVxuXG4vKipcbiAqIFRoZSBQYXJzZSBtb2RlIHVzZWQgZm9yIHBhcnNpbmcgdGhlIEpTT04gc3RyaW5nLlxuICovXG5leHBvcnQgZW51bSBKc29uUGFyc2VNb2RlIHtcbiAgU3RyaWN0ID0gMCwgLy8gU3RhbmRhcmQgSlNPTi5cbiAgQ29tbWVudHNBbGxvd2VkID0gMSA8PCAwLCAvLyBBbGxvd3MgY29tbWVudHMsIGJvdGggc2luZ2xlIG9yIG11bHRpIGxpbmVzLlxuICBTaW5nbGVRdW90ZXNBbGxvd2VkID0gMSA8PCAxLCAvLyBBbGxvdyBzaW5nbGUgcXVvdGVkIHN0cmluZ3MuXG4gIElkZW50aWZpZXJLZXlOYW1lc0FsbG93ZWQgPSAxIDw8IDIsIC8vIEFsbG93IGlkZW50aWZpZXJzIGFzIG9iamVjdHAgcHJvcGVydGllcy5cbiAgVHJhaWxpbmdDb21tYXNBbGxvd2VkID0gMSA8PCAzLFxuICBIZXhhZGVjaW1hbE51bWJlckFsbG93ZWQgPSAxIDw8IDQsXG4gIE11bHRpTGluZVN0cmluZ0FsbG93ZWQgPSAxIDw8IDUsXG4gIExheE51bWJlclBhcnNpbmdBbGxvd2VkID0gMSA8PCA2LCAvLyBBbGxvdyBgLmAgb3IgYCtgIGFzIHRoZSBmaXJzdCBjaGFyYWN0ZXIgb2YgYSBudW1iZXIuXG4gIE51bWJlckNvbnN0YW50c0FsbG93ZWQgPSAxIDw8IDcsIC8vIEFsbG93IC1JbmZpbml0eSwgSW5maW5pdHkgYW5kIE5hTi5cblxuICBEZWZhdWx0ID0gU3RyaWN0LFxuICBMb29zZSA9IENvbW1lbnRzQWxsb3dlZCB8XG4gICAgU2luZ2xlUXVvdGVzQWxsb3dlZCB8XG4gICAgSWRlbnRpZmllcktleU5hbWVzQWxsb3dlZCB8XG4gICAgVHJhaWxpbmdDb21tYXNBbGxvd2VkIHxcbiAgICBIZXhhZGVjaW1hbE51bWJlckFsbG93ZWQgfFxuICAgIE11bHRpTGluZVN0cmluZ0FsbG93ZWQgfFxuICAgIExheE51bWJlclBhcnNpbmdBbGxvd2VkIHxcbiAgICBOdW1iZXJDb25zdGFudHNBbGxvd2VkLFxuXG4gIEpzb24gPSBTdHJpY3QsXG4gIEpzb241ID0gTG9vc2UsXG59XG5cbi8qKlxuICogUGFyc2UgdGhlIEpTT04gc3RyaW5nIGFuZCByZXR1cm4gaXRzIEFTVC4gVGhlIEFTVCBtYXkgYmUgbG9zaW5nIGRhdGEgKGVuZCBjb21tZW50cyBhcmVcbiAqIGRpc2NhcmRlZCBmb3IgZXhhbXBsZSwgYW5kIHNwYWNlIGNoYXJhY3RlcnMgYXJlIG5vdCByZXByZXNlbnRlZCBpbiB0aGUgQVNUKSwgYnV0IGFsbCB2YWx1ZXNcbiAqIHdpbGwgaGF2ZSBhIHNpbmdsZSBub2RlIGluIHRoZSBBU1QgKGEgMS10by0xIG1hcHBpbmcpLlxuICpcbiAqIEBkZXByZWNhdGVkIERlcHJlY2F0ZWQgc2luY2UgdmVyc2lvbiAxMS4gVXNlIDNyZCBwYXJ0eSBKU09OIHBhcnNlcnMgc3VjaCBhcyBganNvbmMtcGFyc2VyYCBpbnN0ZWFkLlxuICogQHBhcmFtIGlucHV0IFRoZSBzdHJpbmcgdG8gdXNlLlxuICogQHBhcmFtIG1vZGUgVGhlIG1vZGUgdG8gcGFyc2UgdGhlIGlucHV0IHdpdGguIHtAc2VlIEpzb25QYXJzZU1vZGV9LlxuICogQHJldHVybnMge0pzb25Bc3ROb2RlfSBUaGUgcm9vdCBub2RlIG9mIHRoZSB2YWx1ZSBvZiB0aGUgQVNULlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VKc29uQXN0KGlucHV0OiBzdHJpbmcsIG1vZGUgPSBKc29uUGFyc2VNb2RlLkRlZmF1bHQpOiBKc29uQXN0Tm9kZSB7XG4gIGlmIChtb2RlID09IEpzb25QYXJzZU1vZGUuRGVmYXVsdCkge1xuICAgIG1vZGUgPSBKc29uUGFyc2VNb2RlLlN0cmljdDtcbiAgfVxuXG4gIGNvbnN0IGNvbnRleHQgPSB7XG4gICAgcG9zaXRpb246IHsgb2Zmc2V0OiAwLCBsaW5lOiAwLCBjaGFyYWN0ZXI6IDAgfSxcbiAgICBwcmV2aW91czogeyBvZmZzZXQ6IDAsIGxpbmU6IDAsIGNoYXJhY3RlcjogMCB9LFxuICAgIG9yaWdpbmFsOiBpbnB1dCxcbiAgICBjb21tZW50czogdW5kZWZpbmVkLFxuICAgIG1vZGUsXG4gIH07XG5cbiAgY29uc3QgYXN0ID0gX3JlYWRWYWx1ZShjb250ZXh0KTtcbiAgaWYgKGNvbnRleHQucG9zaXRpb24ub2Zmc2V0IDwgaW5wdXQubGVuZ3RoKSB7XG4gICAgY29uc3QgcmVzdCA9IGlucHV0LnNsaWNlKGNvbnRleHQucG9zaXRpb24ub2Zmc2V0KTtcbiAgICBjb25zdCBpID0gcmVzdC5sZW5ndGggPiAyMCA/IHJlc3Quc2xpY2UoMCwgMjApICsgJy4uLicgOiByZXN0O1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIGBFeHBlY3RlZCBlbmQgb2YgZmlsZSwgZ290IFwiJHtpfVwiIGF0IGAgK1xuICAgICAgICBgJHtjb250ZXh0LnBvc2l0aW9uLmxpbmV9OiR7Y29udGV4dC5wb3NpdGlvbi5jaGFyYWN0ZXJ9LmAsXG4gICAgKTtcbiAgfVxuXG4gIHJldHVybiBhc3Q7XG59XG5cbi8qKlxuICogT3B0aW9ucyBmb3IgdGhlIHBhcnNlSnNvbigpIGZ1bmN0aW9uLlxuICogQGRlcHJlY2F0ZWQgRGVwcmVjYXRlZCBzaW5jZSB2ZXJzaW9uIDExLiBVc2UgM3JkIHBhcnR5IEpTT04gcGFyc2VycyBzdWNoIGFzIGBqc29uYy1wYXJzZXJgIGluc3RlYWQuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUGFyc2VKc29uT3B0aW9ucyB7XG4gIC8qKlxuICAgKiBJZiBvbWl0dGVkLCB3aWxsIG9ubHkgZW1pdCBlcnJvcnMgcmVsYXRlZCB0byB0aGUgY29udGVudCBvZiB0aGUgSlNPTi4gSWYgc3BlY2lmaWVkLCBhbnlcbiAgICogSlNPTiBlcnJvcnMgd2lsbCBhbHNvIGluY2x1ZGUgdGhlIHBhdGggb2YgdGhlIGZpbGUgdGhhdCBjYXVzZWQgdGhlIGVycm9yLlxuICAgKi9cbiAgcGF0aD86IHN0cmluZztcbn1cblxuLyoqXG4gKiBQYXJzZSBhIEpTT04gc3RyaW5nIGludG8gaXRzIHZhbHVlLiAgVGhpcyBkaXNjYXJkcyB0aGUgQVNUIGFuZCBvbmx5IHJldHVybnMgdGhlIHZhbHVlIGl0c2VsZi5cbiAqXG4gKiBJZiBhIHBhdGggb3B0aW9uIGlzIHBhc3MsIGl0IGFsc28gYWJzb3JicyBKU09OIHBhcnNpbmcgZXJyb3JzIGFuZCByZXR1cm4gYSBuZXcgZXJyb3Igd2l0aCB0aGVcbiAqIHBhdGggaW4gaXQuIFVzZWZ1bCBmb3Igc2hvd2luZyBlcnJvcnMgd2hlbiBwYXJzaW5nIGZyb20gYSBmaWxlLlxuICpcbiAqIEBkZXByZWNhdGVkIERlcHJlY2F0ZWQgc2luY2UgdmVyc2lvbiAxMS4gVXNlIDNyZCBwYXJ0eSBKU09OIHBhcnNlcnMgc3VjaCBhcyBganNvbmMtcGFyc2VyYCBpbnN0ZWFkLlxuICogQHBhcmFtIGlucHV0IFRoZSBzdHJpbmcgdG8gcGFyc2UuXG4gKiBAcGFyYW0gbW9kZSBUaGUgbW9kZSB0byBwYXJzZSB0aGUgaW5wdXQgd2l0aC4ge0BzZWUgSnNvblBhcnNlTW9kZX0uXG4gKiBAcGFyYW0gb3B0aW9ucyBBZGRpdGlvbmFsIG9wdGlub3MgZm9yIHBhcnNpbmcuXG4gKiBAcmV0dXJucyB7SnNvblZhbHVlfSBUaGUgdmFsdWUgcmVwcmVzZW50ZWQgYnkgdGhlIEpTT04gc3RyaW5nLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VKc29uKFxuICBpbnB1dDogc3RyaW5nLFxuICBtb2RlID0gSnNvblBhcnNlTW9kZS5EZWZhdWx0LFxuICBvcHRpb25zPzogUGFyc2VKc29uT3B0aW9ucyxcbik6IEpzb25WYWx1ZSB7XG4gIHRyeSB7XG4gICAgLy8gVHJ5IHBhcnNpbmcgZm9yIHRoZSBmYXN0ZXN0IHBhdGggYXZhaWxhYmxlLCBpZiBlcnJvciwgdXNlcyBvdXIgb3duIHBhcnNlciBmb3IgYmV0dGVyIGVycm9ycy5cbiAgICBpZiAobW9kZSA9PSBKc29uUGFyc2VNb2RlLlN0cmljdCkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgcmV0dXJuIEpTT04ucGFyc2UoaW5wdXQpO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIHJldHVybiBwYXJzZUpzb25Bc3QoaW5wdXQsIG1vZGUpLnZhbHVlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBwYXJzZUpzb25Bc3QoaW5wdXQsIG1vZGUpLnZhbHVlO1xuICB9IGNhdGNoIChlKSB7XG4gICAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5wYXRoICYmIGUgaW5zdGFuY2VvZiBKc29uRXhjZXB0aW9uKSB7XG4gICAgICB0aHJvdyBuZXcgUGF0aFNwZWNpZmljSnNvbkV4Y2VwdGlvbihvcHRpb25zLnBhdGgsIGUpO1xuICAgIH1cbiAgICB0aHJvdyBlO1xuICB9XG59XG4iXX0=