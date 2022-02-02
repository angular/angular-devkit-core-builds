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
                text: context.original.substr(start.offset, context.position.offset),
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
        const rest = input.substr(context.position.offset);
        const i = rest.length > 20 ? rest.substr(0, 20) + '...' : rest;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFyc2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvY29yZS9zcmMvanNvbi9wYXJzZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBRUgsMENBQTBDO0FBQzFDLDRDQUE2QztBQWtCN0MsTUFBYSxhQUFjLFNBQVEseUJBQWE7Q0FBRztBQUFuRCxzQ0FBbUQ7QUFFbkQ7Ozs7R0FJRztBQUNILE1BQWEsNkJBQThCLFNBQVEsYUFBYTtJQU05RCxZQUFZLE9BQTBCO1FBQ3BDLE1BQU0sR0FBRyxHQUFHLE9BQU8sQ0FBQyxRQUFRLENBQUM7UUFDN0IsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztRQUNuRCxLQUFLLENBQUMsMkJBQTJCLFdBQVcsT0FBTyxHQUFHLENBQUMsSUFBSSxJQUFJLEdBQUcsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDO1FBRWpGLElBQUksQ0FBQyxXQUFXLEdBQUcsV0FBVyxDQUFDO1FBQy9CLElBQUksQ0FBQyxJQUFJLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQztRQUNyQixJQUFJLENBQUMsTUFBTSxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUM7UUFDekIsSUFBSSxDQUFDLFNBQVMsR0FBRyxHQUFHLENBQUMsU0FBUyxDQUFDO0lBQ2pDLENBQUM7Q0FDRjtBQWhCRCxzRUFnQkM7QUFFRDs7OztHQUlHO0FBQ0gsTUFBYSw2QkFBOEIsU0FBUSxhQUFhO0lBQzlELFlBQVksUUFBMkI7UUFDckMsS0FBSyxDQUFDLHlCQUF5QixDQUFDLENBQUM7SUFDbkMsQ0FBQztDQUNGO0FBSkQsc0VBSUM7QUFFRDs7O0dBR0c7QUFDSCxNQUFhLHlCQUEwQixTQUFRLGFBQWE7SUFDMUQsWUFBbUIsSUFBWSxFQUFTLFNBQXdCO1FBQzlELEtBQUssQ0FB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SUFBSSxLQUFLLENBQ2IsOEJBQThCLENBQUMsT0FBTztZQUNwQyxHQUFHLE9BQU8sQ0FBQyxRQUFRLENBQUMsSUFBSSxJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsU0FBUyxHQUFHLENBQzVELENBQUM7S0FDSDtJQUVELE9BQU8sR0FBRyxDQUFDO0FBQ2IsQ0FBQztBQXhCRCxvQ0F3QkM7QUFjRDs7Ozs7Ozs7Ozs7R0FXRztBQUNILFNBQWdCLFNBQVMsQ0FDdkIsS0FBYSxFQUNiLElBQUksR0FBRyxhQUFhLENBQUMsT0FBTyxFQUM1QixPQUEwQjtJQUUxQixJQUFJO1FBQ0YsK0ZBQStGO1FBQy9GLElBQUksSUFBSSxJQUFJLGFBQWEsQ0FBQyxNQUFNLEVBQUU7WUFDaEMsSUFBSTtnQkFDRixPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7YUFDMUI7WUFBQyxPQUFPLEdBQUcsRUFBRTtnQkFDWixPQUFPLFlBQVksQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDO2FBQ3hDO1NBQ0Y7UUFFRCxPQUFPLFlBQVksQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDO0tBQ3hDO0lBQUMsT0FBTyxDQUFDLEVBQUU7UUFDVixJQUFJLE9BQU8sSUFBSSxPQUFPLENBQUMsSUFBSSxJQUFJLENBQUMsWUFBWSxhQUFhLEVBQUU7WUFDekQsTUFBTSxJQUFJLHlCQUF5QixDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7U0FDdEQ7UUFDRCxNQUFNLENBQUMsQ0FBQztLQUNUO0FBQ0gsQ0FBQztBQXRCRCw4QkFzQkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuLyogZXNsaW50LWRpc2FibGUgbm8tY29uc3RhbnQtY29uZGl0aW9uICovXG5pbXBvcnQgeyBCYXNlRXhjZXB0aW9uIH0gZnJvbSAnLi4vZXhjZXB0aW9uJztcbmltcG9ydCB7XG4gIEpzb25Bc3RBcnJheSxcbiAgSnNvbkFzdENvbW1lbnQsXG4gIEpzb25Bc3RDb25zdGFudEZhbHNlLFxuICBKc29uQXN0Q29uc3RhbnROdWxsLFxuICBKc29uQXN0Q29uc3RhbnRUcnVlLFxuICBKc29uQXN0SWRlbnRpZmllcixcbiAgSnNvbkFzdEtleVZhbHVlLFxuICBKc29uQXN0TXVsdGlsaW5lQ29tbWVudCxcbiAgSnNvbkFzdE5vZGUsXG4gIEpzb25Bc3ROdW1iZXIsXG4gIEpzb25Bc3RPYmplY3QsXG4gIEpzb25Bc3RTdHJpbmcsXG4gIFBvc2l0aW9uLFxufSBmcm9tICcuL3BhcnNlcl9hc3QnO1xuaW1wb3J0IHsgSnNvbkFycmF5LCBKc29uT2JqZWN0LCBKc29uVmFsdWUgfSBmcm9tICcuL3V0aWxzJztcblxuZXhwb3J0IGNsYXNzIEpzb25FeGNlcHRpb24gZXh0ZW5kcyBCYXNlRXhjZXB0aW9uIHt9XG5cbi8qKlxuICogQSBjaGFyYWN0ZXIgd2FzIGludmFsaWQgaW4gdGhpcyBjb250ZXh0LlxuICogQGRlcHJlY2F0ZWRcbiAqIEBwcml2YXRlXG4gKi9cbmV4cG9ydCBjbGFzcyBJbnZhbGlkSnNvbkNoYXJhY3RlckV4Y2VwdGlvbiBleHRlbmRzIEpzb25FeGNlcHRpb24ge1xuICBpbnZhbGlkQ2hhcjogc3RyaW5nO1xuICBsaW5lOiBudW1iZXI7XG4gIGNoYXJhY3RlcjogbnVtYmVyO1xuICBvZmZzZXQ6IG51bWJlcjtcblxuICBjb25zdHJ1Y3Rvcihjb250ZXh0OiBKc29uUGFyc2VyQ29udGV4dCkge1xuICAgIGNvbnN0IHBvcyA9IGNvbnRleHQucHJldmlvdXM7XG4gICAgY29uc3QgaW52YWxpZENoYXIgPSBKU09OLnN0cmluZ2lmeShfcGVlayhjb250ZXh0KSk7XG4gICAgc3VwZXIoYEludmFsaWQgSlNPTiBjaGFyYWN0ZXI6ICR7aW52YWxpZENoYXJ9IGF0ICR7cG9zLmxpbmV9OiR7cG9zLmNoYXJhY3Rlcn0uYCk7XG5cbiAgICB0aGlzLmludmFsaWRDaGFyID0gaW52YWxpZENoYXI7XG4gICAgdGhpcy5saW5lID0gcG9zLmxpbmU7XG4gICAgdGhpcy5vZmZzZXQgPSBwb3Mub2Zmc2V0O1xuICAgIHRoaXMuY2hhcmFjdGVyID0gcG9zLmNoYXJhY3RlcjtcbiAgfVxufVxuXG4vKipcbiAqIE1vcmUgaW5wdXQgd2FzIGV4cGVjdGVkLCBidXQgd2UgcmVhY2hlZCB0aGUgZW5kIG9mIHRoZSBzdHJlYW0uXG4gKiBAZGVwcmVjYXRlZFxuICogQHByaXZhdGVcbiAqL1xuZXhwb3J0IGNsYXNzIFVuZXhwZWN0ZWRFbmRPZklucHV0RXhjZXB0aW9uIGV4dGVuZHMgSnNvbkV4Y2VwdGlvbiB7XG4gIGNvbnN0cnVjdG9yKF9jb250ZXh0OiBKc29uUGFyc2VyQ29udGV4dCkge1xuICAgIHN1cGVyKGBVbmV4cGVjdGVkIGVuZCBvZiBmaWxlLmApO1xuICB9XG59XG5cbi8qKlxuICogQW4gZXJyb3IgaGFwcGVuZWQgd2l0aGluIGEgZmlsZS5cbiAqIEBkZXByZWNhdGVkIERlcHJlY2F0ZWQgc2luY2UgdmVyc2lvbiAxMS4gVXNlIDNyZCBwYXJ0eSBKU09OIHBhcnNlcnMgc3VjaCBhcyBganNvbmMtcGFyc2VyYCBpbnN0ZWFkLlxuICovXG5leHBvcnQgY2xhc3MgUGF0aFNwZWNpZmljSnNvbkV4Y2VwdGlvbiBleHRlbmRzIEpzb25FeGNlcHRpb24ge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgcGF0aDogc3RyaW5nLCBwdWJsaWMgZXhjZXB0aW9uOiBKc29uRXhjZXB0aW9uKSB7XG4gICAgc3VwZXIoYEFuIGVycm9yIGhhcHBlbmVkIGF0IGZpbGUgcGF0aCAke0pTT04uc3RyaW5naWZ5KHBhdGgpfTogJHtleGNlcHRpb24ubWVzc2FnZX1gKTtcbiAgfVxufVxuXG4vKipcbiAqIENvbnRleHQgcGFzc2VkIGFyb3VuZCB0aGUgcGFyc2VyIHdpdGggaW5mb3JtYXRpb24gYWJvdXQgd2hlcmUgd2UgY3VycmVudGx5IGFyZSBpbiB0aGUgcGFyc2UuXG4gKiBAZGVwcmVjYXRlZCBEZXByZWNhdGVkIHNpbmNlIHZlcnNpb24gMTEuIFVzZSAzcmQgcGFydHkgSlNPTiBwYXJzZXJzIHN1Y2ggYXMgYGpzb25jLXBhcnNlcmAgaW5zdGVhZC5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBKc29uUGFyc2VyQ29udGV4dCB7XG4gIHBvc2l0aW9uOiBQb3NpdGlvbjtcbiAgcHJldmlvdXM6IFBvc2l0aW9uO1xuICByZWFkb25seSBvcmlnaW5hbDogc3RyaW5nO1xuICByZWFkb25seSBtb2RlOiBKc29uUGFyc2VNb2RlO1xufVxuXG4vKipcbiAqIFBlZWsgYW5kIHJldHVybiB0aGUgbmV4dCBjaGFyYWN0ZXIgZnJvbSB0aGUgY29udGV4dC5cbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIF9wZWVrKGNvbnRleHQ6IEpzb25QYXJzZXJDb250ZXh0KTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgcmV0dXJuIGNvbnRleHQub3JpZ2luYWxbY29udGV4dC5wb3NpdGlvbi5vZmZzZXRdO1xufVxuXG4vKipcbiAqIE1vdmUgdGhlIGNvbnRleHQgdG8gdGhlIG5leHQgY2hhcmFjdGVyLCBpbmNsdWRpbmcgaW5jcmVtZW50aW5nIHRoZSBsaW5lIGlmIG5lY2Vzc2FyeS5cbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIF9uZXh0KGNvbnRleHQ6IEpzb25QYXJzZXJDb250ZXh0KSB7XG4gIGNvbnRleHQucHJldmlvdXMgPSBjb250ZXh0LnBvc2l0aW9uO1xuXG4gIGxldCB7IG9mZnNldCwgbGluZSwgY2hhcmFjdGVyIH0gPSBjb250ZXh0LnBvc2l0aW9uO1xuICBjb25zdCBjaGFyID0gY29udGV4dC5vcmlnaW5hbFtvZmZzZXRdO1xuICBvZmZzZXQrKztcbiAgaWYgKGNoYXIgPT0gJ1xcbicpIHtcbiAgICBsaW5lKys7XG4gICAgY2hhcmFjdGVyID0gMDtcbiAgfSBlbHNlIHtcbiAgICBjaGFyYWN0ZXIrKztcbiAgfVxuICBjb250ZXh0LnBvc2l0aW9uID0geyBvZmZzZXQsIGxpbmUsIGNoYXJhY3RlciB9O1xufVxuXG4vKipcbiAqIFJlYWQgYSBzaW5nbGUgY2hhcmFjdGVyIGZyb20gdGhlIGlucHV0LiBJZiBhIGB2YWxpZGAgc3RyaW5nIGlzIHBhc3NlZCwgdmFsaWRhdGUgdGhhdCB0aGVcbiAqIGNoYXJhY3RlciBpcyBpbmNsdWRlZCBpbiB0aGUgdmFsaWQgc3RyaW5nLlxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gX3Rva2VuKGNvbnRleHQ6IEpzb25QYXJzZXJDb250ZXh0LCB2YWxpZDogc3RyaW5nKTogc3RyaW5nO1xuZnVuY3Rpb24gX3Rva2VuKGNvbnRleHQ6IEpzb25QYXJzZXJDb250ZXh0KTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuZnVuY3Rpb24gX3Rva2VuKGNvbnRleHQ6IEpzb25QYXJzZXJDb250ZXh0LCB2YWxpZD86IHN0cmluZyk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG4gIGNvbnN0IGNoYXIgPSBfcGVlayhjb250ZXh0KTtcbiAgaWYgKHZhbGlkKSB7XG4gICAgaWYgKCFjaGFyKSB7XG4gICAgICB0aHJvdyBuZXcgVW5leHBlY3RlZEVuZE9mSW5wdXRFeGNlcHRpb24oY29udGV4dCk7XG4gICAgfVxuICAgIGlmICh2YWxpZC5pbmRleE9mKGNoYXIpID09IC0xKSB7XG4gICAgICB0aHJvdyBuZXcgSW52YWxpZEpzb25DaGFyYWN0ZXJFeGNlcHRpb24oY29udGV4dCk7XG4gICAgfVxuICB9XG5cbiAgLy8gTW92ZSB0aGUgcG9zaXRpb24gb2YgdGhlIGNvbnRleHQgdG8gdGhlIG5leHQgY2hhcmFjdGVyLlxuICBfbmV4dChjb250ZXh0KTtcblxuICByZXR1cm4gY2hhcjtcbn1cblxuLyoqXG4gKiBSZWFkIHRoZSBleHBvbmVudCBwYXJ0IG9mIGEgbnVtYmVyLiBUaGUgZXhwb25lbnQgcGFydCBpcyBsb29zZXIgZm9yIEpTT04gdGhhbiB0aGUgbnVtYmVyXG4gKiBwYXJ0LiBgc3RyYCBpcyB0aGUgc3RyaW5nIG9mIHRoZSBudW1iZXIgaXRzZWxmIGZvdW5kIHNvIGZhciwgYW5kIHN0YXJ0IHRoZSBwb3NpdGlvblxuICogd2hlcmUgdGhlIGZ1bGwgbnVtYmVyIHN0YXJ0ZWQuIFJldHVybnMgdGhlIG5vZGUgZm91bmQuXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBfcmVhZEV4cE51bWJlcihcbiAgY29udGV4dDogSnNvblBhcnNlckNvbnRleHQsXG4gIHN0YXJ0OiBQb3NpdGlvbixcbiAgc3RyOiBzdHJpbmcsXG4gIGNvbW1lbnRzOiAoSnNvbkFzdENvbW1lbnQgfCBKc29uQXN0TXVsdGlsaW5lQ29tbWVudClbXSxcbik6IEpzb25Bc3ROdW1iZXIge1xuICBsZXQgY2hhcjtcbiAgbGV0IHNpZ25lZCA9IGZhbHNlO1xuXG4gIHdoaWxlICh0cnVlKSB7XG4gICAgY2hhciA9IF90b2tlbihjb250ZXh0KTtcbiAgICBpZiAoY2hhciA9PSAnKycgfHwgY2hhciA9PSAnLScpIHtcbiAgICAgIGlmIChzaWduZWQpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBzaWduZWQgPSB0cnVlO1xuICAgICAgc3RyICs9IGNoYXI7XG4gICAgfSBlbHNlIGlmIChcbiAgICAgIGNoYXIgPT0gJzAnIHx8XG4gICAgICBjaGFyID09ICcxJyB8fFxuICAgICAgY2hhciA9PSAnMicgfHxcbiAgICAgIGNoYXIgPT0gJzMnIHx8XG4gICAgICBjaGFyID09ICc0JyB8fFxuICAgICAgY2hhciA9PSAnNScgfHxcbiAgICAgIGNoYXIgPT0gJzYnIHx8XG4gICAgICBjaGFyID09ICc3JyB8fFxuICAgICAgY2hhciA9PSAnOCcgfHxcbiAgICAgIGNoYXIgPT0gJzknXG4gICAgKSB7XG4gICAgICBzaWduZWQgPSB0cnVlO1xuICAgICAgc3RyICs9IGNoYXI7XG4gICAgfSBlbHNlIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIC8vIFdlJ3JlIGRvbmUgcmVhZGluZyB0aGlzIG51bWJlci5cbiAgY29udGV4dC5wb3NpdGlvbiA9IGNvbnRleHQucHJldmlvdXM7XG5cbiAgcmV0dXJuIHtcbiAgICBraW5kOiAnbnVtYmVyJyxcbiAgICBzdGFydCxcbiAgICBlbmQ6IGNvbnRleHQucG9zaXRpb24sXG4gICAgdGV4dDogY29udGV4dC5vcmlnaW5hbC5zdWJzdHJpbmcoc3RhcnQub2Zmc2V0LCBjb250ZXh0LnBvc2l0aW9uLm9mZnNldCksXG4gICAgdmFsdWU6IE51bWJlci5wYXJzZUZsb2F0KHN0ciksXG4gICAgY29tbWVudHM6IGNvbW1lbnRzLFxuICB9O1xufVxuXG4vKipcbiAqIFJlYWQgdGhlIGhleGEgcGFydCBvZiBhIDB4QkFEQ0FGRSBoZXhhZGVjaW1hbCBudW1iZXIuXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBfcmVhZEhleGFOdW1iZXIoXG4gIGNvbnRleHQ6IEpzb25QYXJzZXJDb250ZXh0LFxuICBpc05lZ2F0aXZlOiBib29sZWFuLFxuICBzdGFydDogUG9zaXRpb24sXG4gIGNvbW1lbnRzOiAoSnNvbkFzdENvbW1lbnQgfCBKc29uQXN0TXVsdGlsaW5lQ29tbWVudClbXSxcbik6IEpzb25Bc3ROdW1iZXIge1xuICAvLyBSZWFkIGFuIGhleGFkZWNpbWFsIG51bWJlciwgdW50aWwgaXQncyBub3QgaGV4YWRlY2ltYWwuXG4gIGxldCBoZXhhID0gJyc7XG4gIGNvbnN0IHZhbGlkID0gJzAxMjM0NTY3ODlhYmNkZWZBQkNERUYnO1xuXG4gIGZvciAobGV0IGNoID0gX3BlZWsoY29udGV4dCk7IGNoICYmIHZhbGlkLmluY2x1ZGVzKGNoKTsgY2ggPSBfcGVlayhjb250ZXh0KSkge1xuICAgIC8vIEFkZCBpdCB0byB0aGUgaGV4YSBzdHJpbmcuXG4gICAgaGV4YSArPSBjaDtcbiAgICAvLyBNb3ZlIHRoZSBwb3NpdGlvbiBvZiB0aGUgY29udGV4dCB0byB0aGUgbmV4dCBjaGFyYWN0ZXIuXG4gICAgX25leHQoY29udGV4dCk7XG4gIH1cblxuICBjb25zdCB2YWx1ZSA9IE51bWJlci5wYXJzZUludChoZXhhLCAxNik7XG5cbiAgLy8gV2UncmUgZG9uZSByZWFkaW5nIHRoaXMgbnVtYmVyLlxuICByZXR1cm4ge1xuICAgIGtpbmQ6ICdudW1iZXInLFxuICAgIHN0YXJ0LFxuICAgIGVuZDogY29udGV4dC5wb3NpdGlvbixcbiAgICB0ZXh0OiBjb250ZXh0Lm9yaWdpbmFsLnN1YnN0cmluZyhzdGFydC5vZmZzZXQsIGNvbnRleHQucG9zaXRpb24ub2Zmc2V0KSxcbiAgICB2YWx1ZTogaXNOZWdhdGl2ZSA/IC12YWx1ZSA6IHZhbHVlLFxuICAgIGNvbW1lbnRzLFxuICB9O1xufVxuXG4vKipcbiAqIFJlYWQgYSBudW1iZXIgZnJvbSB0aGUgY29udGV4dC5cbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIF9yZWFkTnVtYmVyKGNvbnRleHQ6IEpzb25QYXJzZXJDb250ZXh0LCBjb21tZW50cyA9IF9yZWFkQmxhbmtzKGNvbnRleHQpKTogSnNvbkFzdE51bWJlciB7XG4gIGxldCBzdHIgPSAnJztcbiAgbGV0IGRvdHRlZCA9IGZhbHNlO1xuICBjb25zdCBzdGFydCA9IGNvbnRleHQucG9zaXRpb247XG5cbiAgLy8gcmVhZCB1bnRpbCBgZWAgb3IgZW5kIG9mIGxpbmUuXG4gIHdoaWxlICh0cnVlKSB7XG4gICAgY29uc3QgY2hhciA9IF90b2tlbihjb250ZXh0KTtcblxuICAgIC8vIFJlYWQgdG9rZW5zLCBvbmUgYnkgb25lLlxuICAgIGlmIChjaGFyID09ICctJykge1xuICAgICAgaWYgKHN0ciAhPSAnJykge1xuICAgICAgICB0aHJvdyBuZXcgSW52YWxpZEpzb25DaGFyYWN0ZXJFeGNlcHRpb24oY29udGV4dCk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChcbiAgICAgIGNoYXIgPT0gJ0knICYmXG4gICAgICAoc3RyID09ICctJyB8fCBzdHIgPT0gJycgfHwgc3RyID09ICcrJykgJiZcbiAgICAgIChjb250ZXh0Lm1vZGUgJiBKc29uUGFyc2VNb2RlLk51bWJlckNvbnN0YW50c0FsbG93ZWQpICE9IDBcbiAgICApIHtcbiAgICAgIC8vIEluZmluaXR5P1xuICAgICAgLy8gX3Rva2VuKGNvbnRleHQsICdJJyk7IEFscmVhZHkgcmVhZC5cbiAgICAgIF90b2tlbihjb250ZXh0LCAnbicpO1xuICAgICAgX3Rva2VuKGNvbnRleHQsICdmJyk7XG4gICAgICBfdG9rZW4oY29udGV4dCwgJ2knKTtcbiAgICAgIF90b2tlbihjb250ZXh0LCAnbicpO1xuICAgICAgX3Rva2VuKGNvbnRleHQsICdpJyk7XG4gICAgICBfdG9rZW4oY29udGV4dCwgJ3QnKTtcbiAgICAgIF90b2tlbihjb250ZXh0LCAneScpO1xuXG4gICAgICBzdHIgKz0gJ0luZmluaXR5JztcbiAgICAgIGJyZWFrO1xuICAgIH0gZWxzZSBpZiAoY2hhciA9PSAnMCcpIHtcbiAgICAgIGlmIChzdHIgPT0gJzAnIHx8IHN0ciA9PSAnLTAnKSB7XG4gICAgICAgIHRocm93IG5ldyBJbnZhbGlkSnNvbkNoYXJhY3RlckV4Y2VwdGlvbihjb250ZXh0KTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKFxuICAgICAgY2hhciA9PSAnMScgfHxcbiAgICAgIGNoYXIgPT0gJzInIHx8XG4gICAgICBjaGFyID09ICczJyB8fFxuICAgICAgY2hhciA9PSAnNCcgfHxcbiAgICAgIGNoYXIgPT0gJzUnIHx8XG4gICAgICBjaGFyID09ICc2JyB8fFxuICAgICAgY2hhciA9PSAnNycgfHxcbiAgICAgIGNoYXIgPT0gJzgnIHx8XG4gICAgICBjaGFyID09ICc5J1xuICAgICkge1xuICAgICAgaWYgKHN0ciA9PSAnMCcgfHwgc3RyID09ICctMCcpIHtcbiAgICAgICAgdGhyb3cgbmV3IEludmFsaWRKc29uQ2hhcmFjdGVyRXhjZXB0aW9uKGNvbnRleHQpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoY2hhciA9PSAnKycgJiYgc3RyID09ICcnKSB7XG4gICAgICAvLyBQYXNzIG92ZXIuXG4gICAgfSBlbHNlIGlmIChjaGFyID09ICcuJykge1xuICAgICAgaWYgKGRvdHRlZCkge1xuICAgICAgICB0aHJvdyBuZXcgSW52YWxpZEpzb25DaGFyYWN0ZXJFeGNlcHRpb24oY29udGV4dCk7XG4gICAgICB9XG4gICAgICBkb3R0ZWQgPSB0cnVlO1xuICAgIH0gZWxzZSBpZiAoY2hhciA9PSAnZScgfHwgY2hhciA9PSAnRScpIHtcbiAgICAgIHJldHVybiBfcmVhZEV4cE51bWJlcihjb250ZXh0LCBzdGFydCwgc3RyICsgY2hhciwgY29tbWVudHMpO1xuICAgIH0gZWxzZSBpZiAoXG4gICAgICBjaGFyID09ICd4JyAmJlxuICAgICAgKHN0ciA9PSAnMCcgfHwgc3RyID09ICctMCcpICYmXG4gICAgICAoY29udGV4dC5tb2RlICYgSnNvblBhcnNlTW9kZS5IZXhhZGVjaW1hbE51bWJlckFsbG93ZWQpICE9IDBcbiAgICApIHtcbiAgICAgIHJldHVybiBfcmVhZEhleGFOdW1iZXIoY29udGV4dCwgc3RyID09ICctMCcsIHN0YXJ0LCBjb21tZW50cyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFdlIHJlYWQgb25lIHRvbyBtYW55IGNoYXJhY3RlcnMsIHNvIHJvbGxiYWNrIHRoZSBsYXN0IGNoYXJhY3Rlci5cbiAgICAgIGNvbnRleHQucG9zaXRpb24gPSBjb250ZXh0LnByZXZpb3VzO1xuICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgc3RyICs9IGNoYXI7XG4gIH1cblxuICAvLyBXZSdyZSBkb25lIHJlYWRpbmcgdGhpcyBudW1iZXIuXG4gIGlmIChzdHIuZW5kc1dpdGgoJy4nKSAmJiAoY29udGV4dC5tb2RlICYgSnNvblBhcnNlTW9kZS5IZXhhZGVjaW1hbE51bWJlckFsbG93ZWQpID09IDApIHtcbiAgICB0aHJvdyBuZXcgSW52YWxpZEpzb25DaGFyYWN0ZXJFeGNlcHRpb24oY29udGV4dCk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIGtpbmQ6ICdudW1iZXInLFxuICAgIHN0YXJ0LFxuICAgIGVuZDogY29udGV4dC5wb3NpdGlvbixcbiAgICB0ZXh0OiBjb250ZXh0Lm9yaWdpbmFsLnN1YnN0cmluZyhzdGFydC5vZmZzZXQsIGNvbnRleHQucG9zaXRpb24ub2Zmc2V0KSxcbiAgICB2YWx1ZTogTnVtYmVyLnBhcnNlRmxvYXQoc3RyKSxcbiAgICBjb21tZW50cyxcbiAgfTtcbn1cblxuLyoqXG4gKiBSZWFkIGEgc3RyaW5nIGZyb20gdGhlIGNvbnRleHQuIFRha2VzIHRoZSBjb21tZW50cyBvZiB0aGUgc3RyaW5nIG9yIHJlYWQgdGhlIGJsYW5rcyBiZWZvcmUgdGhlXG4gKiBzdHJpbmcuXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBfcmVhZFN0cmluZyhjb250ZXh0OiBKc29uUGFyc2VyQ29udGV4dCwgY29tbWVudHMgPSBfcmVhZEJsYW5rcyhjb250ZXh0KSk6IEpzb25Bc3RTdHJpbmcge1xuICBjb25zdCBzdGFydCA9IGNvbnRleHQucG9zaXRpb247XG5cbiAgLy8gQ29uc3VtZSB0aGUgZmlyc3Qgc3RyaW5nIGRlbGltaXRlci5cbiAgY29uc3QgZGVsaW0gPSBfdG9rZW4oY29udGV4dCk7XG4gIGlmICgoY29udGV4dC5tb2RlICYgSnNvblBhcnNlTW9kZS5TaW5nbGVRdW90ZXNBbGxvd2VkKSA9PSAwKSB7XG4gICAgaWYgKGRlbGltID09IFwiJ1wiKSB7XG4gICAgICB0aHJvdyBuZXcgSW52YWxpZEpzb25DaGFyYWN0ZXJFeGNlcHRpb24oY29udGV4dCk7XG4gICAgfVxuICB9XG5cbiAgbGV0IHN0ciA9ICcnO1xuICB3aGlsZSAodHJ1ZSkge1xuICAgIGxldCBjaGFyID0gX3Rva2VuKGNvbnRleHQpO1xuICAgIGlmIChjaGFyID09IGRlbGltKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBraW5kOiAnc3RyaW5nJyxcbiAgICAgICAgc3RhcnQsXG4gICAgICAgIGVuZDogY29udGV4dC5wb3NpdGlvbixcbiAgICAgICAgdGV4dDogY29udGV4dC5vcmlnaW5hbC5zdWJzdHJpbmcoc3RhcnQub2Zmc2V0LCBjb250ZXh0LnBvc2l0aW9uLm9mZnNldCksXG4gICAgICAgIHZhbHVlOiBzdHIsXG4gICAgICAgIGNvbW1lbnRzOiBjb21tZW50cyxcbiAgICAgIH07XG4gICAgfSBlbHNlIGlmIChjaGFyID09ICdcXFxcJykge1xuICAgICAgY2hhciA9IF90b2tlbihjb250ZXh0KTtcbiAgICAgIHN3aXRjaCAoY2hhcikge1xuICAgICAgICBjYXNlICdcXFxcJzpcbiAgICAgICAgY2FzZSAnLyc6XG4gICAgICAgIGNhc2UgJ1wiJzpcbiAgICAgICAgY2FzZSBkZWxpbTpcbiAgICAgICAgICBzdHIgKz0gY2hhcjtcbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICdiJzpcbiAgICAgICAgICBzdHIgKz0gJ1xcYic7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2YnOlxuICAgICAgICAgIHN0ciArPSAnXFxmJztcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnbic6XG4gICAgICAgICAgc3RyICs9ICdcXG4nO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdyJzpcbiAgICAgICAgICBzdHIgKz0gJ1xccic7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ3QnOlxuICAgICAgICAgIHN0ciArPSAnXFx0JztcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAndSc6XG4gICAgICAgICAgY29uc3QgW2MwXSA9IF90b2tlbihjb250ZXh0LCAnMDEyMzQ1Njc4OWFiY2RlZkFCQ0RFRicpO1xuICAgICAgICAgIGNvbnN0IFtjMV0gPSBfdG9rZW4oY29udGV4dCwgJzAxMjM0NTY3ODlhYmNkZWZBQkNERUYnKTtcbiAgICAgICAgICBjb25zdCBbYzJdID0gX3Rva2VuKGNvbnRleHQsICcwMTIzNDU2Nzg5YWJjZGVmQUJDREVGJyk7XG4gICAgICAgICAgY29uc3QgW2MzXSA9IF90b2tlbihjb250ZXh0LCAnMDEyMzQ1Njc4OWFiY2RlZkFCQ0RFRicpO1xuICAgICAgICAgIHN0ciArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKHBhcnNlSW50KGMwICsgYzEgKyBjMiArIGMzLCAxNikpO1xuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgdW5kZWZpbmVkOlxuICAgICAgICAgIHRocm93IG5ldyBVbmV4cGVjdGVkRW5kT2ZJbnB1dEV4Y2VwdGlvbihjb250ZXh0KTtcblxuICAgICAgICBjYXNlICdcXG4nOlxuICAgICAgICAgIC8vIE9ubHkgdmFsaWQgd2hlbiBtdWx0aWxpbmUgc3RyaW5ncyBhcmUgYWxsb3dlZC5cbiAgICAgICAgICBpZiAoKGNvbnRleHQubW9kZSAmIEpzb25QYXJzZU1vZGUuTXVsdGlMaW5lU3RyaW5nQWxsb3dlZCkgPT0gMCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEludmFsaWRKc29uQ2hhcmFjdGVyRXhjZXB0aW9uKGNvbnRleHQpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzdHIgKz0gY2hhcjtcbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHRocm93IG5ldyBJbnZhbGlkSnNvbkNoYXJhY3RlckV4Y2VwdGlvbihjb250ZXh0KTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGNoYXIgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IFVuZXhwZWN0ZWRFbmRPZklucHV0RXhjZXB0aW9uKGNvbnRleHQpO1xuICAgIH0gZWxzZSBpZiAoY2hhciA9PSAnXFxiJyB8fCBjaGFyID09ICdcXGYnIHx8IGNoYXIgPT0gJ1xcbicgfHwgY2hhciA9PSAnXFxyJyB8fCBjaGFyID09ICdcXHQnKSB7XG4gICAgICB0aHJvdyBuZXcgSW52YWxpZEpzb25DaGFyYWN0ZXJFeGNlcHRpb24oY29udGV4dCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0ciArPSBjaGFyO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIFJlYWQgdGhlIGNvbnN0YW50IGB0cnVlYCBmcm9tIHRoZSBjb250ZXh0LlxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gX3JlYWRUcnVlKFxuICBjb250ZXh0OiBKc29uUGFyc2VyQ29udGV4dCxcbiAgY29tbWVudHMgPSBfcmVhZEJsYW5rcyhjb250ZXh0KSxcbik6IEpzb25Bc3RDb25zdGFudFRydWUge1xuICBjb25zdCBzdGFydCA9IGNvbnRleHQucG9zaXRpb247XG4gIF90b2tlbihjb250ZXh0LCAndCcpO1xuICBfdG9rZW4oY29udGV4dCwgJ3InKTtcbiAgX3Rva2VuKGNvbnRleHQsICd1Jyk7XG4gIF90b2tlbihjb250ZXh0LCAnZScpO1xuXG4gIGNvbnN0IGVuZCA9IGNvbnRleHQucG9zaXRpb247XG5cbiAgcmV0dXJuIHtcbiAgICBraW5kOiAndHJ1ZScsXG4gICAgc3RhcnQsXG4gICAgZW5kLFxuICAgIHRleHQ6IGNvbnRleHQub3JpZ2luYWwuc3Vic3RyaW5nKHN0YXJ0Lm9mZnNldCwgZW5kLm9mZnNldCksXG4gICAgdmFsdWU6IHRydWUsXG4gICAgY29tbWVudHMsXG4gIH07XG59XG5cbi8qKlxuICogUmVhZCB0aGUgY29uc3RhbnQgYGZhbHNlYCBmcm9tIHRoZSBjb250ZXh0LlxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gX3JlYWRGYWxzZShcbiAgY29udGV4dDogSnNvblBhcnNlckNvbnRleHQsXG4gIGNvbW1lbnRzID0gX3JlYWRCbGFua3MoY29udGV4dCksXG4pOiBKc29uQXN0Q29uc3RhbnRGYWxzZSB7XG4gIGNvbnN0IHN0YXJ0ID0gY29udGV4dC5wb3NpdGlvbjtcbiAgX3Rva2VuKGNvbnRleHQsICdmJyk7XG4gIF90b2tlbihjb250ZXh0LCAnYScpO1xuICBfdG9rZW4oY29udGV4dCwgJ2wnKTtcbiAgX3Rva2VuKGNvbnRleHQsICdzJyk7XG4gIF90b2tlbihjb250ZXh0LCAnZScpO1xuXG4gIGNvbnN0IGVuZCA9IGNvbnRleHQucG9zaXRpb247XG5cbiAgcmV0dXJuIHtcbiAgICBraW5kOiAnZmFsc2UnLFxuICAgIHN0YXJ0LFxuICAgIGVuZCxcbiAgICB0ZXh0OiBjb250ZXh0Lm9yaWdpbmFsLnN1YnN0cmluZyhzdGFydC5vZmZzZXQsIGVuZC5vZmZzZXQpLFxuICAgIHZhbHVlOiBmYWxzZSxcbiAgICBjb21tZW50cyxcbiAgfTtcbn1cblxuLyoqXG4gKiBSZWFkIHRoZSBjb25zdGFudCBgbnVsbGAgZnJvbSB0aGUgY29udGV4dC5cbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIF9yZWFkTnVsbChcbiAgY29udGV4dDogSnNvblBhcnNlckNvbnRleHQsXG4gIGNvbW1lbnRzID0gX3JlYWRCbGFua3MoY29udGV4dCksXG4pOiBKc29uQXN0Q29uc3RhbnROdWxsIHtcbiAgY29uc3Qgc3RhcnQgPSBjb250ZXh0LnBvc2l0aW9uO1xuXG4gIF90b2tlbihjb250ZXh0LCAnbicpO1xuICBfdG9rZW4oY29udGV4dCwgJ3UnKTtcbiAgX3Rva2VuKGNvbnRleHQsICdsJyk7XG4gIF90b2tlbihjb250ZXh0LCAnbCcpO1xuXG4gIGNvbnN0IGVuZCA9IGNvbnRleHQucG9zaXRpb247XG5cbiAgcmV0dXJuIHtcbiAgICBraW5kOiAnbnVsbCcsXG4gICAgc3RhcnQsXG4gICAgZW5kLFxuICAgIHRleHQ6IGNvbnRleHQub3JpZ2luYWwuc3Vic3RyaW5nKHN0YXJ0Lm9mZnNldCwgZW5kLm9mZnNldCksXG4gICAgdmFsdWU6IG51bGwsXG4gICAgY29tbWVudHM6IGNvbW1lbnRzLFxuICB9O1xufVxuXG4vKipcbiAqIFJlYWQgdGhlIGNvbnN0YW50IGBOYU5gIGZyb20gdGhlIGNvbnRleHQuXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBfcmVhZE5hTihjb250ZXh0OiBKc29uUGFyc2VyQ29udGV4dCwgY29tbWVudHMgPSBfcmVhZEJsYW5rcyhjb250ZXh0KSk6IEpzb25Bc3ROdW1iZXIge1xuICBjb25zdCBzdGFydCA9IGNvbnRleHQucG9zaXRpb247XG5cbiAgX3Rva2VuKGNvbnRleHQsICdOJyk7XG4gIF90b2tlbihjb250ZXh0LCAnYScpO1xuICBfdG9rZW4oY29udGV4dCwgJ04nKTtcblxuICBjb25zdCBlbmQgPSBjb250ZXh0LnBvc2l0aW9uO1xuXG4gIHJldHVybiB7XG4gICAga2luZDogJ251bWJlcicsXG4gICAgc3RhcnQsXG4gICAgZW5kLFxuICAgIHRleHQ6IGNvbnRleHQub3JpZ2luYWwuc3Vic3RyaW5nKHN0YXJ0Lm9mZnNldCwgZW5kLm9mZnNldCksXG4gICAgdmFsdWU6IE5hTixcbiAgICBjb21tZW50czogY29tbWVudHMsXG4gIH07XG59XG5cbi8qKlxuICogUmVhZCBhbiBhcnJheSBvZiBKU09OIHZhbHVlcyBmcm9tIHRoZSBjb250ZXh0LlxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gX3JlYWRBcnJheShjb250ZXh0OiBKc29uUGFyc2VyQ29udGV4dCwgY29tbWVudHMgPSBfcmVhZEJsYW5rcyhjb250ZXh0KSk6IEpzb25Bc3RBcnJheSB7XG4gIGNvbnN0IHN0YXJ0ID0gY29udGV4dC5wb3NpdGlvbjtcblxuICAvLyBDb25zdW1lIHRoZSBmaXJzdCBkZWxpbWl0ZXIuXG4gIF90b2tlbihjb250ZXh0LCAnWycpO1xuICBjb25zdCB2YWx1ZTogSnNvbkFycmF5ID0gW107XG4gIGNvbnN0IGVsZW1lbnRzOiBKc29uQXN0Tm9kZVtdID0gW107XG5cbiAgX3JlYWRCbGFua3MoY29udGV4dCk7XG4gIGlmIChfcGVlayhjb250ZXh0KSAhPSAnXScpIHtcbiAgICBjb25zdCBub2RlID0gX3JlYWRWYWx1ZShjb250ZXh0KTtcbiAgICBlbGVtZW50cy5wdXNoKG5vZGUpO1xuICAgIHZhbHVlLnB1c2gobm9kZS52YWx1ZSk7XG4gIH1cblxuICB3aGlsZSAoX3BlZWsoY29udGV4dCkgIT0gJ10nKSB7XG4gICAgX3Rva2VuKGNvbnRleHQsICcsJyk7XG5cbiAgICBjb25zdCB2YWx1ZUNvbW1lbnRzID0gX3JlYWRCbGFua3MoY29udGV4dCk7XG4gICAgaWYgKChjb250ZXh0Lm1vZGUgJiBKc29uUGFyc2VNb2RlLlRyYWlsaW5nQ29tbWFzQWxsb3dlZCkgIT09IDAgJiYgX3BlZWsoY29udGV4dCkgPT09ICddJykge1xuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGNvbnN0IG5vZGUgPSBfcmVhZFZhbHVlKGNvbnRleHQsIHZhbHVlQ29tbWVudHMpO1xuICAgIGVsZW1lbnRzLnB1c2gobm9kZSk7XG4gICAgdmFsdWUucHVzaChub2RlLnZhbHVlKTtcbiAgfVxuXG4gIF90b2tlbihjb250ZXh0LCAnXScpO1xuXG4gIHJldHVybiB7XG4gICAga2luZDogJ2FycmF5JyxcbiAgICBzdGFydCxcbiAgICBlbmQ6IGNvbnRleHQucG9zaXRpb24sXG4gICAgdGV4dDogY29udGV4dC5vcmlnaW5hbC5zdWJzdHJpbmcoc3RhcnQub2Zmc2V0LCBjb250ZXh0LnBvc2l0aW9uLm9mZnNldCksXG4gICAgdmFsdWUsXG4gICAgZWxlbWVudHMsXG4gICAgY29tbWVudHMsXG4gIH07XG59XG5cbi8qKlxuICogUmVhZCBhbiBpZGVudGlmaWVyIGZyb20gdGhlIGNvbnRleHQuIEFuIGlkZW50aWZpZXIgaXMgYSB2YWxpZCBKYXZhU2NyaXB0IGlkZW50aWZpZXIsIGFuZCB0aGlzXG4gKiBmdW5jdGlvbiBpcyBvbmx5IHVzZWQgaW4gTG9vc2UgbW9kZS5cbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIF9yZWFkSWRlbnRpZmllcihcbiAgY29udGV4dDogSnNvblBhcnNlckNvbnRleHQsXG4gIGNvbW1lbnRzID0gX3JlYWRCbGFua3MoY29udGV4dCksXG4pOiBKc29uQXN0SWRlbnRpZmllciB7XG4gIGNvbnN0IHN0YXJ0ID0gY29udGV4dC5wb3NpdGlvbjtcblxuICBsZXQgY2hhciA9IF9wZWVrKGNvbnRleHQpO1xuICBpZiAoY2hhciAmJiAnMDEyMzQ1Njc4OScuaW5kZXhPZihjaGFyKSAhPSAtMSkge1xuICAgIGNvbnN0IGlkZW50aWZpZXJOb2RlID0gX3JlYWROdW1iZXIoY29udGV4dCk7XG5cbiAgICByZXR1cm4ge1xuICAgICAga2luZDogJ2lkZW50aWZpZXInLFxuICAgICAgc3RhcnQsXG4gICAgICBlbmQ6IGlkZW50aWZpZXJOb2RlLmVuZCxcbiAgICAgIHRleHQ6IGlkZW50aWZpZXJOb2RlLnRleHQsXG4gICAgICB2YWx1ZTogaWRlbnRpZmllck5vZGUudmFsdWUudG9TdHJpbmcoKSxcbiAgICB9O1xuICB9XG5cbiAgY29uc3QgaWRlbnRWYWxpZEZpcnN0Q2hhciA9ICdhYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ekFCQ0RFRkdISUpLTE1PUFFSU1RVVldYWVonO1xuICBjb25zdCBpZGVudFZhbGlkQ2hhciA9ICdfJGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6QUJDREVGR0hJSktMTU9QUVJTVFVWV1hZWjAxMjM0NTY3ODknO1xuICBsZXQgZmlyc3QgPSB0cnVlO1xuICBsZXQgdmFsdWUgPSAnJztcblxuICB3aGlsZSAodHJ1ZSkge1xuICAgIGNoYXIgPSBfdG9rZW4oY29udGV4dCk7XG4gICAgaWYgKFxuICAgICAgY2hhciA9PSB1bmRlZmluZWQgfHxcbiAgICAgIChmaXJzdCA/IGlkZW50VmFsaWRGaXJzdENoYXIuaW5kZXhPZihjaGFyKSA6IGlkZW50VmFsaWRDaGFyLmluZGV4T2YoY2hhcikpID09IC0xXG4gICAgKSB7XG4gICAgICBjb250ZXh0LnBvc2l0aW9uID0gY29udGV4dC5wcmV2aW91cztcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAga2luZDogJ2lkZW50aWZpZXInLFxuICAgICAgICBzdGFydCxcbiAgICAgICAgZW5kOiBjb250ZXh0LnBvc2l0aW9uLFxuICAgICAgICB0ZXh0OiBjb250ZXh0Lm9yaWdpbmFsLnN1YnN0cihzdGFydC5vZmZzZXQsIGNvbnRleHQucG9zaXRpb24ub2Zmc2V0KSxcbiAgICAgICAgdmFsdWUsXG4gICAgICAgIGNvbW1lbnRzLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICB2YWx1ZSArPSBjaGFyO1xuICAgIGZpcnN0ID0gZmFsc2U7XG4gIH1cbn1cblxuLyoqXG4gKiBSZWFkIGEgcHJvcGVydHkgZnJvbSB0aGUgY29udGV4dC4gQSBwcm9wZXJ0eSBpcyBhIHN0cmluZyBvciAoaW4gTG9vc2UgbW9kZSBvbmx5KSBhIG51bWJlciBvclxuICogYW4gaWRlbnRpZmllciwgZm9sbG93ZWQgYnkgYSBjb2xvbiBgOmAuXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBfcmVhZFByb3BlcnR5KFxuICBjb250ZXh0OiBKc29uUGFyc2VyQ29udGV4dCxcbiAgY29tbWVudHMgPSBfcmVhZEJsYW5rcyhjb250ZXh0KSxcbik6IEpzb25Bc3RLZXlWYWx1ZSB7XG4gIGNvbnN0IHN0YXJ0ID0gY29udGV4dC5wb3NpdGlvbjtcblxuICBsZXQga2V5O1xuICBpZiAoKGNvbnRleHQubW9kZSAmIEpzb25QYXJzZU1vZGUuSWRlbnRpZmllcktleU5hbWVzQWxsb3dlZCkgIT0gMCkge1xuICAgIGNvbnN0IHRvcCA9IF9wZWVrKGNvbnRleHQpO1xuICAgIGlmICh0b3AgPT0gJ1wiJyB8fCB0b3AgPT0gXCInXCIpIHtcbiAgICAgIGtleSA9IF9yZWFkU3RyaW5nKGNvbnRleHQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBrZXkgPSBfcmVhZElkZW50aWZpZXIoY29udGV4dCk7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGtleSA9IF9yZWFkU3RyaW5nKGNvbnRleHQpO1xuICB9XG5cbiAgX3JlYWRCbGFua3MoY29udGV4dCk7XG4gIF90b2tlbihjb250ZXh0LCAnOicpO1xuICBjb25zdCB2YWx1ZSA9IF9yZWFkVmFsdWUoY29udGV4dCk7XG4gIGNvbnN0IGVuZCA9IGNvbnRleHQucG9zaXRpb247XG5cbiAgcmV0dXJuIHtcbiAgICBraW5kOiAna2V5dmFsdWUnLFxuICAgIGtleSxcbiAgICB2YWx1ZSxcbiAgICBzdGFydCxcbiAgICBlbmQsXG4gICAgdGV4dDogY29udGV4dC5vcmlnaW5hbC5zdWJzdHJpbmcoc3RhcnQub2Zmc2V0LCBlbmQub2Zmc2V0KSxcbiAgICBjb21tZW50cyxcbiAgfTtcbn1cblxuLyoqXG4gKiBSZWFkIGFuIG9iamVjdCBvZiBwcm9wZXJ0aWVzIC0+IEpTT04gdmFsdWVzIGZyb20gdGhlIGNvbnRleHQuXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBfcmVhZE9iamVjdChjb250ZXh0OiBKc29uUGFyc2VyQ29udGV4dCwgY29tbWVudHMgPSBfcmVhZEJsYW5rcyhjb250ZXh0KSk6IEpzb25Bc3RPYmplY3Qge1xuICBjb25zdCBzdGFydCA9IGNvbnRleHQucG9zaXRpb247XG4gIC8vIENvbnN1bWUgdGhlIGZpcnN0IGRlbGltaXRlci5cbiAgX3Rva2VuKGNvbnRleHQsICd7Jyk7XG4gIGNvbnN0IHZhbHVlOiBKc29uT2JqZWN0ID0ge307XG4gIGNvbnN0IHByb3BlcnRpZXM6IEpzb25Bc3RLZXlWYWx1ZVtdID0gW107XG5cbiAgX3JlYWRCbGFua3MoY29udGV4dCk7XG4gIGlmIChfcGVlayhjb250ZXh0KSAhPSAnfScpIHtcbiAgICBjb25zdCBwcm9wZXJ0eSA9IF9yZWFkUHJvcGVydHkoY29udGV4dCk7XG4gICAgdmFsdWVbcHJvcGVydHkua2V5LnZhbHVlXSA9IHByb3BlcnR5LnZhbHVlLnZhbHVlO1xuICAgIHByb3BlcnRpZXMucHVzaChwcm9wZXJ0eSk7XG5cbiAgICB3aGlsZSAoX3BlZWsoY29udGV4dCkgIT0gJ30nKSB7XG4gICAgICBfdG9rZW4oY29udGV4dCwgJywnKTtcblxuICAgICAgY29uc3QgcHJvcGVydHlDb21tZW50cyA9IF9yZWFkQmxhbmtzKGNvbnRleHQpO1xuICAgICAgaWYgKChjb250ZXh0Lm1vZGUgJiBKc29uUGFyc2VNb2RlLlRyYWlsaW5nQ29tbWFzQWxsb3dlZCkgIT09IDAgJiYgX3BlZWsoY29udGV4dCkgPT09ICd9Jykge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNvbnN0IHByb3BlcnR5ID0gX3JlYWRQcm9wZXJ0eShjb250ZXh0LCBwcm9wZXJ0eUNvbW1lbnRzKTtcbiAgICAgIHZhbHVlW3Byb3BlcnR5LmtleS52YWx1ZV0gPSBwcm9wZXJ0eS52YWx1ZS52YWx1ZTtcbiAgICAgIHByb3BlcnRpZXMucHVzaChwcm9wZXJ0eSk7XG4gICAgfVxuICB9XG5cbiAgX3Rva2VuKGNvbnRleHQsICd9Jyk7XG5cbiAgcmV0dXJuIHtcbiAgICBraW5kOiAnb2JqZWN0JyxcbiAgICBwcm9wZXJ0aWVzLFxuICAgIHN0YXJ0LFxuICAgIGVuZDogY29udGV4dC5wb3NpdGlvbixcbiAgICB2YWx1ZSxcbiAgICB0ZXh0OiBjb250ZXh0Lm9yaWdpbmFsLnN1YnN0cmluZyhzdGFydC5vZmZzZXQsIGNvbnRleHQucG9zaXRpb24ub2Zmc2V0KSxcbiAgICBjb21tZW50cyxcbiAgfTtcbn1cblxuLyoqXG4gKiBSZW1vdmUgYW55IGJsYW5rIGNoYXJhY3RlciBvciBjb21tZW50cyAoaW4gTG9vc2UgbW9kZSkgZnJvbSB0aGUgY29udGV4dCwgcmV0dXJuaW5nIGFuIGFycmF5XG4gKiBvZiBjb21tZW50cyBpZiBhbnkgYXJlIGZvdW5kLlxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gX3JlYWRCbGFua3MoY29udGV4dDogSnNvblBhcnNlckNvbnRleHQpOiAoSnNvbkFzdENvbW1lbnQgfCBKc29uQXN0TXVsdGlsaW5lQ29tbWVudClbXSB7XG4gIGlmICgoY29udGV4dC5tb2RlICYgSnNvblBhcnNlTW9kZS5Db21tZW50c0FsbG93ZWQpICE9IDApIHtcbiAgICBjb25zdCBjb21tZW50czogKEpzb25Bc3RDb21tZW50IHwgSnNvbkFzdE11bHRpbGluZUNvbW1lbnQpW10gPSBbXTtcbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgY29uc3QgY2hhciA9IGNvbnRleHQub3JpZ2luYWxbY29udGV4dC5wb3NpdGlvbi5vZmZzZXRdO1xuICAgICAgaWYgKGNoYXIgPT0gJy8nICYmIGNvbnRleHQub3JpZ2luYWxbY29udGV4dC5wb3NpdGlvbi5vZmZzZXQgKyAxXSA9PSAnKicpIHtcbiAgICAgICAgY29uc3Qgc3RhcnQgPSBjb250ZXh0LnBvc2l0aW9uO1xuICAgICAgICAvLyBNdWx0aSBsaW5lIGNvbW1lbnQuXG4gICAgICAgIF9uZXh0KGNvbnRleHQpO1xuICAgICAgICBfbmV4dChjb250ZXh0KTtcblxuICAgICAgICB3aGlsZSAoXG4gICAgICAgICAgY29udGV4dC5vcmlnaW5hbFtjb250ZXh0LnBvc2l0aW9uLm9mZnNldF0gIT0gJyonIHx8XG4gICAgICAgICAgY29udGV4dC5vcmlnaW5hbFtjb250ZXh0LnBvc2l0aW9uLm9mZnNldCArIDFdICE9ICcvJ1xuICAgICAgICApIHtcbiAgICAgICAgICBfbmV4dChjb250ZXh0KTtcbiAgICAgICAgICBpZiAoY29udGV4dC5wb3NpdGlvbi5vZmZzZXQgPj0gY29udGV4dC5vcmlnaW5hbC5sZW5ndGgpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBVbmV4cGVjdGVkRW5kT2ZJbnB1dEV4Y2VwdGlvbihjb250ZXh0KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gUmVtb3ZlIFwiKi9cIi5cbiAgICAgICAgX25leHQoY29udGV4dCk7XG4gICAgICAgIF9uZXh0KGNvbnRleHQpO1xuXG4gICAgICAgIGNvbW1lbnRzLnB1c2goe1xuICAgICAgICAgIGtpbmQ6ICdtdWx0aWNvbW1lbnQnLFxuICAgICAgICAgIHN0YXJ0LFxuICAgICAgICAgIGVuZDogY29udGV4dC5wb3NpdGlvbixcbiAgICAgICAgICB0ZXh0OiBjb250ZXh0Lm9yaWdpbmFsLnN1YnN0cmluZyhzdGFydC5vZmZzZXQsIGNvbnRleHQucG9zaXRpb24ub2Zmc2V0KSxcbiAgICAgICAgICBjb250ZW50OiBjb250ZXh0Lm9yaWdpbmFsLnN1YnN0cmluZyhzdGFydC5vZmZzZXQgKyAyLCBjb250ZXh0LnBvc2l0aW9uLm9mZnNldCAtIDIpLFxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAoY2hhciA9PSAnLycgJiYgY29udGV4dC5vcmlnaW5hbFtjb250ZXh0LnBvc2l0aW9uLm9mZnNldCArIDFdID09ICcvJykge1xuICAgICAgICBjb25zdCBzdGFydCA9IGNvbnRleHQucG9zaXRpb247XG4gICAgICAgIC8vIE11bHRpIGxpbmUgY29tbWVudC5cbiAgICAgICAgX25leHQoY29udGV4dCk7XG4gICAgICAgIF9uZXh0KGNvbnRleHQpO1xuXG4gICAgICAgIHdoaWxlIChjb250ZXh0Lm9yaWdpbmFsW2NvbnRleHQucG9zaXRpb24ub2Zmc2V0XSAhPSAnXFxuJykge1xuICAgICAgICAgIF9uZXh0KGNvbnRleHQpO1xuICAgICAgICAgIGlmIChjb250ZXh0LnBvc2l0aW9uLm9mZnNldCA+PSBjb250ZXh0Lm9yaWdpbmFsLmxlbmd0aCkge1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVtb3ZlIFwiXFxuXCIuXG4gICAgICAgIGlmIChjb250ZXh0LnBvc2l0aW9uLm9mZnNldCA8IGNvbnRleHQub3JpZ2luYWwubGVuZ3RoKSB7XG4gICAgICAgICAgX25leHQoY29udGV4dCk7XG4gICAgICAgIH1cbiAgICAgICAgY29tbWVudHMucHVzaCh7XG4gICAgICAgICAga2luZDogJ2NvbW1lbnQnLFxuICAgICAgICAgIHN0YXJ0LFxuICAgICAgICAgIGVuZDogY29udGV4dC5wb3NpdGlvbixcbiAgICAgICAgICB0ZXh0OiBjb250ZXh0Lm9yaWdpbmFsLnN1YnN0cmluZyhzdGFydC5vZmZzZXQsIGNvbnRleHQucG9zaXRpb24ub2Zmc2V0KSxcbiAgICAgICAgICBjb250ZW50OiBjb250ZXh0Lm9yaWdpbmFsLnN1YnN0cmluZyhzdGFydC5vZmZzZXQgKyAyLCBjb250ZXh0LnBvc2l0aW9uLm9mZnNldCAtIDEpLFxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAoY2hhciA9PSAnICcgfHwgY2hhciA9PSAnXFx0JyB8fCBjaGFyID09ICdcXG4nIHx8IGNoYXIgPT0gJ1xccicgfHwgY2hhciA9PSAnXFxmJykge1xuICAgICAgICBfbmV4dChjb250ZXh0KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBjb21tZW50cztcbiAgfSBlbHNlIHtcbiAgICBsZXQgY2hhciA9IGNvbnRleHQub3JpZ2luYWxbY29udGV4dC5wb3NpdGlvbi5vZmZzZXRdO1xuICAgIHdoaWxlIChjaGFyID09ICcgJyB8fCBjaGFyID09ICdcXHQnIHx8IGNoYXIgPT0gJ1xcbicgfHwgY2hhciA9PSAnXFxyJyB8fCBjaGFyID09ICdcXGYnKSB7XG4gICAgICBfbmV4dChjb250ZXh0KTtcbiAgICAgIGNoYXIgPSBjb250ZXh0Lm9yaWdpbmFsW2NvbnRleHQucG9zaXRpb24ub2Zmc2V0XTtcbiAgICB9XG5cbiAgICByZXR1cm4gW107XG4gIH1cbn1cblxuLyoqXG4gKiBSZWFkIGEgSlNPTiB2YWx1ZSBmcm9tIHRoZSBjb250ZXh0LCB3aGljaCBjYW4gYmUgYW55IGZvcm0gb2YgSlNPTiB2YWx1ZS5cbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIF9yZWFkVmFsdWUoY29udGV4dDogSnNvblBhcnNlckNvbnRleHQsIGNvbW1lbnRzID0gX3JlYWRCbGFua3MoY29udGV4dCkpOiBKc29uQXN0Tm9kZSB7XG4gIGxldCByZXN1bHQ6IEpzb25Bc3ROb2RlO1xuXG4gIC8vIENsZWFuIHVwIGJlZm9yZS5cbiAgY29uc3QgY2hhciA9IF9wZWVrKGNvbnRleHQpO1xuICBzd2l0Y2ggKGNoYXIpIHtcbiAgICBjYXNlIHVuZGVmaW5lZDpcbiAgICAgIHRocm93IG5ldyBVbmV4cGVjdGVkRW5kT2ZJbnB1dEV4Y2VwdGlvbihjb250ZXh0KTtcblxuICAgIGNhc2UgJy0nOlxuICAgIGNhc2UgJzAnOlxuICAgIGNhc2UgJzEnOlxuICAgIGNhc2UgJzInOlxuICAgIGNhc2UgJzMnOlxuICAgIGNhc2UgJzQnOlxuICAgIGNhc2UgJzUnOlxuICAgIGNhc2UgJzYnOlxuICAgIGNhc2UgJzcnOlxuICAgIGNhc2UgJzgnOlxuICAgIGNhc2UgJzknOlxuICAgICAgcmVzdWx0ID0gX3JlYWROdW1iZXIoY29udGV4dCwgY29tbWVudHMpO1xuICAgICAgYnJlYWs7XG5cbiAgICBjYXNlICcuJzpcbiAgICBjYXNlICcrJzpcbiAgICAgIGlmICgoY29udGV4dC5tb2RlICYgSnNvblBhcnNlTW9kZS5MYXhOdW1iZXJQYXJzaW5nQWxsb3dlZCkgPT0gMCkge1xuICAgICAgICB0aHJvdyBuZXcgSW52YWxpZEpzb25DaGFyYWN0ZXJFeGNlcHRpb24oY29udGV4dCk7XG4gICAgICB9XG4gICAgICByZXN1bHQgPSBfcmVhZE51bWJlcihjb250ZXh0LCBjb21tZW50cyk7XG4gICAgICBicmVhaztcblxuICAgIGNhc2UgXCInXCI6XG4gICAgY2FzZSAnXCInOlxuICAgICAgcmVzdWx0ID0gX3JlYWRTdHJpbmcoY29udGV4dCwgY29tbWVudHMpO1xuICAgICAgYnJlYWs7XG5cbiAgICBjYXNlICdJJzpcbiAgICAgIGlmICgoY29udGV4dC5tb2RlICYgSnNvblBhcnNlTW9kZS5OdW1iZXJDb25zdGFudHNBbGxvd2VkKSA9PSAwKSB7XG4gICAgICAgIHRocm93IG5ldyBJbnZhbGlkSnNvbkNoYXJhY3RlckV4Y2VwdGlvbihjb250ZXh0KTtcbiAgICAgIH1cbiAgICAgIHJlc3VsdCA9IF9yZWFkTnVtYmVyKGNvbnRleHQsIGNvbW1lbnRzKTtcbiAgICAgIGJyZWFrO1xuXG4gICAgY2FzZSAnTic6XG4gICAgICBpZiAoKGNvbnRleHQubW9kZSAmIEpzb25QYXJzZU1vZGUuTnVtYmVyQ29uc3RhbnRzQWxsb3dlZCkgPT0gMCkge1xuICAgICAgICB0aHJvdyBuZXcgSW52YWxpZEpzb25DaGFyYWN0ZXJFeGNlcHRpb24oY29udGV4dCk7XG4gICAgICB9XG4gICAgICByZXN1bHQgPSBfcmVhZE5hTihjb250ZXh0LCBjb21tZW50cyk7XG4gICAgICBicmVhaztcblxuICAgIGNhc2UgJ3QnOlxuICAgICAgcmVzdWx0ID0gX3JlYWRUcnVlKGNvbnRleHQsIGNvbW1lbnRzKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ2YnOlxuICAgICAgcmVzdWx0ID0gX3JlYWRGYWxzZShjb250ZXh0LCBjb21tZW50cyk7XG4gICAgICBicmVhaztcbiAgICBjYXNlICduJzpcbiAgICAgIHJlc3VsdCA9IF9yZWFkTnVsbChjb250ZXh0LCBjb21tZW50cyk7XG4gICAgICBicmVhaztcblxuICAgIGNhc2UgJ1snOlxuICAgICAgcmVzdWx0ID0gX3JlYWRBcnJheShjb250ZXh0LCBjb21tZW50cyk7XG4gICAgICBicmVhaztcblxuICAgIGNhc2UgJ3snOlxuICAgICAgcmVzdWx0ID0gX3JlYWRPYmplY3QoY29udGV4dCwgY29tbWVudHMpO1xuICAgICAgYnJlYWs7XG5cbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgbmV3IEludmFsaWRKc29uQ2hhcmFjdGVyRXhjZXB0aW9uKGNvbnRleHQpO1xuICB9XG5cbiAgLy8gQ2xlYW4gdXAgYWZ0ZXIuXG4gIF9yZWFkQmxhbmtzKGNvbnRleHQpO1xuXG4gIHJldHVybiByZXN1bHQ7XG59XG5cbi8qKlxuICogVGhlIFBhcnNlIG1vZGUgdXNlZCBmb3IgcGFyc2luZyB0aGUgSlNPTiBzdHJpbmcuXG4gKi9cbmV4cG9ydCBlbnVtIEpzb25QYXJzZU1vZGUge1xuICBTdHJpY3QgPSAwLCAvLyBTdGFuZGFyZCBKU09OLlxuICBDb21tZW50c0FsbG93ZWQgPSAxIDw8IDAsIC8vIEFsbG93cyBjb21tZW50cywgYm90aCBzaW5nbGUgb3IgbXVsdGkgbGluZXMuXG4gIFNpbmdsZVF1b3Rlc0FsbG93ZWQgPSAxIDw8IDEsIC8vIEFsbG93IHNpbmdsZSBxdW90ZWQgc3RyaW5ncy5cbiAgSWRlbnRpZmllcktleU5hbWVzQWxsb3dlZCA9IDEgPDwgMiwgLy8gQWxsb3cgaWRlbnRpZmllcnMgYXMgb2JqZWN0cCBwcm9wZXJ0aWVzLlxuICBUcmFpbGluZ0NvbW1hc0FsbG93ZWQgPSAxIDw8IDMsXG4gIEhleGFkZWNpbWFsTnVtYmVyQWxsb3dlZCA9IDEgPDwgNCxcbiAgTXVsdGlMaW5lU3RyaW5nQWxsb3dlZCA9IDEgPDwgNSxcbiAgTGF4TnVtYmVyUGFyc2luZ0FsbG93ZWQgPSAxIDw8IDYsIC8vIEFsbG93IGAuYCBvciBgK2AgYXMgdGhlIGZpcnN0IGNoYXJhY3RlciBvZiBhIG51bWJlci5cbiAgTnVtYmVyQ29uc3RhbnRzQWxsb3dlZCA9IDEgPDwgNywgLy8gQWxsb3cgLUluZmluaXR5LCBJbmZpbml0eSBhbmQgTmFOLlxuXG4gIERlZmF1bHQgPSBTdHJpY3QsXG4gIExvb3NlID0gQ29tbWVudHNBbGxvd2VkIHxcbiAgICBTaW5nbGVRdW90ZXNBbGxvd2VkIHxcbiAgICBJZGVudGlmaWVyS2V5TmFtZXNBbGxvd2VkIHxcbiAgICBUcmFpbGluZ0NvbW1hc0FsbG93ZWQgfFxuICAgIEhleGFkZWNpbWFsTnVtYmVyQWxsb3dlZCB8XG4gICAgTXVsdGlMaW5lU3RyaW5nQWxsb3dlZCB8XG4gICAgTGF4TnVtYmVyUGFyc2luZ0FsbG93ZWQgfFxuICAgIE51bWJlckNvbnN0YW50c0FsbG93ZWQsXG5cbiAgSnNvbiA9IFN0cmljdCxcbiAgSnNvbjUgPSBMb29zZSxcbn1cblxuLyoqXG4gKiBQYXJzZSB0aGUgSlNPTiBzdHJpbmcgYW5kIHJldHVybiBpdHMgQVNULiBUaGUgQVNUIG1heSBiZSBsb3NpbmcgZGF0YSAoZW5kIGNvbW1lbnRzIGFyZVxuICogZGlzY2FyZGVkIGZvciBleGFtcGxlLCBhbmQgc3BhY2UgY2hhcmFjdGVycyBhcmUgbm90IHJlcHJlc2VudGVkIGluIHRoZSBBU1QpLCBidXQgYWxsIHZhbHVlc1xuICogd2lsbCBoYXZlIGEgc2luZ2xlIG5vZGUgaW4gdGhlIEFTVCAoYSAxLXRvLTEgbWFwcGluZykuXG4gKlxuICogQGRlcHJlY2F0ZWQgRGVwcmVjYXRlZCBzaW5jZSB2ZXJzaW9uIDExLiBVc2UgM3JkIHBhcnR5IEpTT04gcGFyc2VycyBzdWNoIGFzIGBqc29uYy1wYXJzZXJgIGluc3RlYWQuXG4gKiBAcGFyYW0gaW5wdXQgVGhlIHN0cmluZyB0byB1c2UuXG4gKiBAcGFyYW0gbW9kZSBUaGUgbW9kZSB0byBwYXJzZSB0aGUgaW5wdXQgd2l0aC4ge0BzZWUgSnNvblBhcnNlTW9kZX0uXG4gKiBAcmV0dXJucyB7SnNvbkFzdE5vZGV9IFRoZSByb290IG5vZGUgb2YgdGhlIHZhbHVlIG9mIHRoZSBBU1QuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUpzb25Bc3QoaW5wdXQ6IHN0cmluZywgbW9kZSA9IEpzb25QYXJzZU1vZGUuRGVmYXVsdCk6IEpzb25Bc3ROb2RlIHtcbiAgaWYgKG1vZGUgPT0gSnNvblBhcnNlTW9kZS5EZWZhdWx0KSB7XG4gICAgbW9kZSA9IEpzb25QYXJzZU1vZGUuU3RyaWN0O1xuICB9XG5cbiAgY29uc3QgY29udGV4dCA9IHtcbiAgICBwb3NpdGlvbjogeyBvZmZzZXQ6IDAsIGxpbmU6IDAsIGNoYXJhY3RlcjogMCB9LFxuICAgIHByZXZpb3VzOiB7IG9mZnNldDogMCwgbGluZTogMCwgY2hhcmFjdGVyOiAwIH0sXG4gICAgb3JpZ2luYWw6IGlucHV0LFxuICAgIGNvbW1lbnRzOiB1bmRlZmluZWQsXG4gICAgbW9kZSxcbiAgfTtcblxuICBjb25zdCBhc3QgPSBfcmVhZFZhbHVlKGNvbnRleHQpO1xuICBpZiAoY29udGV4dC5wb3NpdGlvbi5vZmZzZXQgPCBpbnB1dC5sZW5ndGgpIHtcbiAgICBjb25zdCByZXN0ID0gaW5wdXQuc3Vic3RyKGNvbnRleHQucG9zaXRpb24ub2Zmc2V0KTtcbiAgICBjb25zdCBpID0gcmVzdC5sZW5ndGggPiAyMCA/IHJlc3Quc3Vic3RyKDAsIDIwKSArICcuLi4nIDogcmVzdDtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBgRXhwZWN0ZWQgZW5kIG9mIGZpbGUsIGdvdCBcIiR7aX1cIiBhdCBgICtcbiAgICAgICAgYCR7Y29udGV4dC5wb3NpdGlvbi5saW5lfToke2NvbnRleHQucG9zaXRpb24uY2hhcmFjdGVyfS5gLFxuICAgICk7XG4gIH1cblxuICByZXR1cm4gYXN0O1xufVxuXG4vKipcbiAqIE9wdGlvbnMgZm9yIHRoZSBwYXJzZUpzb24oKSBmdW5jdGlvbi5cbiAqIEBkZXByZWNhdGVkIERlcHJlY2F0ZWQgc2luY2UgdmVyc2lvbiAxMS4gVXNlIDNyZCBwYXJ0eSBKU09OIHBhcnNlcnMgc3VjaCBhcyBganNvbmMtcGFyc2VyYCBpbnN0ZWFkLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFBhcnNlSnNvbk9wdGlvbnMge1xuICAvKipcbiAgICogSWYgb21pdHRlZCwgd2lsbCBvbmx5IGVtaXQgZXJyb3JzIHJlbGF0ZWQgdG8gdGhlIGNvbnRlbnQgb2YgdGhlIEpTT04uIElmIHNwZWNpZmllZCwgYW55XG4gICAqIEpTT04gZXJyb3JzIHdpbGwgYWxzbyBpbmNsdWRlIHRoZSBwYXRoIG9mIHRoZSBmaWxlIHRoYXQgY2F1c2VkIHRoZSBlcnJvci5cbiAgICovXG4gIHBhdGg/OiBzdHJpbmc7XG59XG5cbi8qKlxuICogUGFyc2UgYSBKU09OIHN0cmluZyBpbnRvIGl0cyB2YWx1ZS4gIFRoaXMgZGlzY2FyZHMgdGhlIEFTVCBhbmQgb25seSByZXR1cm5zIHRoZSB2YWx1ZSBpdHNlbGYuXG4gKlxuICogSWYgYSBwYXRoIG9wdGlvbiBpcyBwYXNzLCBpdCBhbHNvIGFic29yYnMgSlNPTiBwYXJzaW5nIGVycm9ycyBhbmQgcmV0dXJuIGEgbmV3IGVycm9yIHdpdGggdGhlXG4gKiBwYXRoIGluIGl0LiBVc2VmdWwgZm9yIHNob3dpbmcgZXJyb3JzIHdoZW4gcGFyc2luZyBmcm9tIGEgZmlsZS5cbiAqXG4gKiBAZGVwcmVjYXRlZCBEZXByZWNhdGVkIHNpbmNlIHZlcnNpb24gMTEuIFVzZSAzcmQgcGFydHkgSlNPTiBwYXJzZXJzIHN1Y2ggYXMgYGpzb25jLXBhcnNlcmAgaW5zdGVhZC5cbiAqIEBwYXJhbSBpbnB1dCBUaGUgc3RyaW5nIHRvIHBhcnNlLlxuICogQHBhcmFtIG1vZGUgVGhlIG1vZGUgdG8gcGFyc2UgdGhlIGlucHV0IHdpdGguIHtAc2VlIEpzb25QYXJzZU1vZGV9LlxuICogQHBhcmFtIG9wdGlvbnMgQWRkaXRpb25hbCBvcHRpbm9zIGZvciBwYXJzaW5nLlxuICogQHJldHVybnMge0pzb25WYWx1ZX0gVGhlIHZhbHVlIHJlcHJlc2VudGVkIGJ5IHRoZSBKU09OIHN0cmluZy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlSnNvbihcbiAgaW5wdXQ6IHN0cmluZyxcbiAgbW9kZSA9IEpzb25QYXJzZU1vZGUuRGVmYXVsdCxcbiAgb3B0aW9ucz86IFBhcnNlSnNvbk9wdGlvbnMsXG4pOiBKc29uVmFsdWUge1xuICB0cnkge1xuICAgIC8vIFRyeSBwYXJzaW5nIGZvciB0aGUgZmFzdGVzdCBwYXRoIGF2YWlsYWJsZSwgaWYgZXJyb3IsIHVzZXMgb3VyIG93biBwYXJzZXIgZm9yIGJldHRlciBlcnJvcnMuXG4gICAgaWYgKG1vZGUgPT0gSnNvblBhcnNlTW9kZS5TdHJpY3QpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHJldHVybiBKU09OLnBhcnNlKGlucHV0KTtcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICByZXR1cm4gcGFyc2VKc29uQXN0KGlucHV0LCBtb2RlKS52YWx1ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcGFyc2VKc29uQXN0KGlucHV0LCBtb2RlKS52YWx1ZTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGlmIChvcHRpb25zICYmIG9wdGlvbnMucGF0aCAmJiBlIGluc3RhbmNlb2YgSnNvbkV4Y2VwdGlvbikge1xuICAgICAgdGhyb3cgbmV3IFBhdGhTcGVjaWZpY0pzb25FeGNlcHRpb24ob3B0aW9ucy5wYXRoLCBlKTtcbiAgICB9XG4gICAgdGhyb3cgZTtcbiAgfVxufVxuIl19