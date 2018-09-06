"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const exception_1 = require("../exception");
class JsonException extends exception_1.BaseException {
}
exports.JsonException = JsonException;
/**
 * A character was invalid in this context.
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
 */
class UnexpectedEndOfInputException extends JsonException {
    constructor(_context) {
        super(`Unexpected end of file.`);
    }
}
exports.UnexpectedEndOfInputException = UnexpectedEndOfInputException;
/**
 * An error happened within a file.
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
        else if (char == '0' || char == '1' || char == '2' || char == '3' || char == '4'
            || char == '5' || char == '6' || char == '7' || char == '8' || char == '9') {
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
        else if (char == 'I'
            && (str == '-' || str == '' || str == '+')
            && (context.mode & JsonParseMode.NumberConstantsAllowed) != 0) {
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
        else if (char == '1' || char == '2' || char == '3' || char == '4' || char == '5'
            || char == '6' || char == '7' || char == '8' || char == '9') {
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
        else if (char == 'x' && (str == '0' || str == '-0')
            && (context.mode & JsonParseMode.HexadecimalNumberAllowed) != 0) {
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
        if (delim == '\'') {
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
                case '\/':
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
        if (char == undefined
            || (first ? identValidFirstChar.indexOf(char) : identValidChar.indexOf(char)) == -1) {
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
        if (top == '"' || top == '\'') {
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
                while (context.original[context.position.offset] != '*'
                    || context.original[context.position.offset + 1] != '/') {
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
        case '\'':
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
        throw new Error(`Expected end of file, got "${i}" at `
            + `${context.position.line}:${context.position.character}.`);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFyc2VyLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9jb3JlL3NyYy9qc29uL3BhcnNlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBOzs7Ozs7R0FNRztBQUNILDRDQUE2QztBQW9CN0MsbUJBQTJCLFNBQVEseUJBQWE7Q0FBRztBQUFuRCxzQ0FBbUQ7QUFFbkQ7O0dBRUc7QUFDSCxtQ0FBMkMsU0FBUSxhQUFhO0lBTTlELFlBQVksT0FBMEI7UUFDcEMsTUFBTSxHQUFHLEdBQUcsT0FBTyxDQUFDLFFBQVEsQ0FBQztRQUM3QixNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1FBQ25ELEtBQUssQ0FBQywyQkFBMkIsV0FBVyxPQUFPLEdBQUcsQ0FBQyxJQUFJLElBQUksR0FBRyxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUM7UUFFakYsSUFBSSxDQUFDLFdBQVcsR0FBRyxXQUFXLENBQUM7UUFDL0IsSUFBSSxDQUFDLElBQUksR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDO1FBQ3JCLElBQUksQ0FBQyxNQUFNLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQztRQUN6QixJQUFJLENBQUMsU0FBUyxHQUFHLEdBQUcsQ0FBQyxTQUFTLENBQUM7SUFDakMsQ0FBQztDQUNGO0FBaEJELHNFQWdCQztBQUdEOztHQUVHO0FBQ0gsbUNBQTJDLFNBQVEsYUFBYTtJQUM5RCxZQUFZLFFBQTJCO1FBQ3JDLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0lBQ25DLENBQUM7Q0FDRjtBQUpELHNFQUlDO0FBRUQ7O0dBRUc7QUFDSCwrQkFBdUMsU0FBUSxhQUFhO0lBQzFELFlBQW1CLElBQVksRUFBUyxTQUF3QjtRQUM5RCxLQUFLLENBQUMsa0NBQWtDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEtBQUssU0FBUyxDQUFDLE9BQU8s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LElBQUksR0FBRyxhQUFhLENBQUMsT0FBTyxFQUM1QixPQUEwQjtJQUUxQixJQUFJO1FBQ0YsK0ZBQStGO1FBQy9GLElBQUksSUFBSSxJQUFJLGFBQWEsQ0FBQyxNQUFNLEVBQUU7WUFDaEMsSUFBSTtnQkFDRixPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7YUFDMUI7WUFBQyxPQUFPLEdBQUcsRUFBRTtnQkFDWixPQUFPLFlBQVksQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDO2FBQ3hDO1NBQ0Y7UUFFRCxPQUFPLFlBQVksQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDO0tBQ3hDO0lBQUMsT0FBTyxDQUFDLEVBQUU7UUFDVixJQUFJLE9BQU8sSUFBSSxPQUFPLENBQUMsSUFBSSxJQUFJLENBQUMsWUFBWSxhQUFhLEVBQUU7WUFDekQsTUFBTSxJQUFJLHlCQUF5QixDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7U0FDdEQ7UUFDRCxNQUFNLENBQUMsQ0FBQztLQUNUO0FBQ0gsQ0FBQztBQXRCRCw4QkFzQkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQgeyBCYXNlRXhjZXB0aW9uIH0gZnJvbSAnLi4vZXhjZXB0aW9uJztcbmltcG9ydCB7XG4gIEpzb25BcnJheSxcbiAgSnNvbkFzdEFycmF5LFxuICBKc29uQXN0Q29tbWVudCxcbiAgSnNvbkFzdENvbnN0YW50RmFsc2UsXG4gIEpzb25Bc3RDb25zdGFudE51bGwsXG4gIEpzb25Bc3RDb25zdGFudFRydWUsXG4gIEpzb25Bc3RJZGVudGlmaWVyLFxuICBKc29uQXN0S2V5VmFsdWUsXG4gIEpzb25Bc3RNdWx0aWxpbmVDb21tZW50LFxuICBKc29uQXN0Tm9kZSxcbiAgSnNvbkFzdE51bWJlcixcbiAgSnNvbkFzdE9iamVjdCxcbiAgSnNvbkFzdFN0cmluZyxcbiAgSnNvbk9iamVjdCxcbiAgSnNvblZhbHVlLFxuICBQb3NpdGlvbixcbn0gZnJvbSAnLi9pbnRlcmZhY2UnO1xuXG5leHBvcnQgY2xhc3MgSnNvbkV4Y2VwdGlvbiBleHRlbmRzIEJhc2VFeGNlcHRpb24ge31cblxuLyoqXG4gKiBBIGNoYXJhY3RlciB3YXMgaW52YWxpZCBpbiB0aGlzIGNvbnRleHQuXG4gKi9cbmV4cG9ydCBjbGFzcyBJbnZhbGlkSnNvbkNoYXJhY3RlckV4Y2VwdGlvbiBleHRlbmRzIEpzb25FeGNlcHRpb24ge1xuICBpbnZhbGlkQ2hhcjogc3RyaW5nO1xuICBsaW5lOiBudW1iZXI7XG4gIGNoYXJhY3RlcjogbnVtYmVyO1xuICBvZmZzZXQ6IG51bWJlcjtcblxuICBjb25zdHJ1Y3Rvcihjb250ZXh0OiBKc29uUGFyc2VyQ29udGV4dCkge1xuICAgIGNvbnN0IHBvcyA9IGNvbnRleHQucHJldmlvdXM7XG4gICAgY29uc3QgaW52YWxpZENoYXIgPSBKU09OLnN0cmluZ2lmeShfcGVlayhjb250ZXh0KSk7XG4gICAgc3VwZXIoYEludmFsaWQgSlNPTiBjaGFyYWN0ZXI6ICR7aW52YWxpZENoYXJ9IGF0ICR7cG9zLmxpbmV9OiR7cG9zLmNoYXJhY3Rlcn0uYCk7XG5cbiAgICB0aGlzLmludmFsaWRDaGFyID0gaW52YWxpZENoYXI7XG4gICAgdGhpcy5saW5lID0gcG9zLmxpbmU7XG4gICAgdGhpcy5vZmZzZXQgPSBwb3Mub2Zmc2V0O1xuICAgIHRoaXMuY2hhcmFjdGVyID0gcG9zLmNoYXJhY3RlcjtcbiAgfVxufVxuXG5cbi8qKlxuICogTW9yZSBpbnB1dCB3YXMgZXhwZWN0ZWQsIGJ1dCB3ZSByZWFjaGVkIHRoZSBlbmQgb2YgdGhlIHN0cmVhbS5cbiAqL1xuZXhwb3J0IGNsYXNzIFVuZXhwZWN0ZWRFbmRPZklucHV0RXhjZXB0aW9uIGV4dGVuZHMgSnNvbkV4Y2VwdGlvbiB7XG4gIGNvbnN0cnVjdG9yKF9jb250ZXh0OiBKc29uUGFyc2VyQ29udGV4dCkge1xuICAgIHN1cGVyKGBVbmV4cGVjdGVkIGVuZCBvZiBmaWxlLmApO1xuICB9XG59XG5cbi8qKlxuICogQW4gZXJyb3IgaGFwcGVuZWQgd2l0aGluIGEgZmlsZS5cbiAqL1xuZXhwb3J0IGNsYXNzIFBhdGhTcGVjaWZpY0pzb25FeGNlcHRpb24gZXh0ZW5kcyBKc29uRXhjZXB0aW9uIHtcbiAgY29uc3RydWN0b3IocHVibGljIHBhdGg6IHN0cmluZywgcHVibGljIGV4Y2VwdGlvbjogSnNvbkV4Y2VwdGlvbikge1xuICAgIHN1cGVyKGBBbiBlcnJvciBoYXBwZW5lZCBhdCBmaWxlIHBhdGggJHtKU09OLnN0cmluZ2lmeShwYXRoKX06ICR7ZXhjZXB0aW9uLm1lc3NhZ2V9YCk7XG4gIH1cbn1cblxuLyoqXG4gKiBDb250ZXh0IHBhc3NlZCBhcm91bmQgdGhlIHBhcnNlciB3aXRoIGluZm9ybWF0aW9uIGFib3V0IHdoZXJlIHdlIGN1cnJlbnRseSBhcmUgaW4gdGhlIHBhcnNlLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIEpzb25QYXJzZXJDb250ZXh0IHtcbiAgcG9zaXRpb246IFBvc2l0aW9uO1xuICBwcmV2aW91czogUG9zaXRpb247XG4gIHJlYWRvbmx5IG9yaWdpbmFsOiBzdHJpbmc7XG4gIHJlYWRvbmx5IG1vZGU6IEpzb25QYXJzZU1vZGU7XG59XG5cblxuLyoqXG4gKiBQZWVrIGFuZCByZXR1cm4gdGhlIG5leHQgY2hhcmFjdGVyIGZyb20gdGhlIGNvbnRleHQuXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBfcGVlayhjb250ZXh0OiBKc29uUGFyc2VyQ29udGV4dCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG4gIHJldHVybiBjb250ZXh0Lm9yaWdpbmFsW2NvbnRleHQucG9zaXRpb24ub2Zmc2V0XTtcbn1cblxuXG4vKipcbiAqIE1vdmUgdGhlIGNvbnRleHQgdG8gdGhlIG5leHQgY2hhcmFjdGVyLCBpbmNsdWRpbmcgaW5jcmVtZW50aW5nIHRoZSBsaW5lIGlmIG5lY2Vzc2FyeS5cbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIF9uZXh0KGNvbnRleHQ6IEpzb25QYXJzZXJDb250ZXh0KSB7XG4gIGNvbnRleHQucHJldmlvdXMgPSBjb250ZXh0LnBvc2l0aW9uO1xuXG4gIGxldCB7b2Zmc2V0LCBsaW5lLCBjaGFyYWN0ZXJ9ID0gY29udGV4dC5wb3NpdGlvbjtcbiAgY29uc3QgY2hhciA9IGNvbnRleHQub3JpZ2luYWxbb2Zmc2V0XTtcbiAgb2Zmc2V0Kys7XG4gIGlmIChjaGFyID09ICdcXG4nKSB7XG4gICAgbGluZSsrO1xuICAgIGNoYXJhY3RlciA9IDA7XG4gIH0gZWxzZSB7XG4gICAgY2hhcmFjdGVyKys7XG4gIH1cbiAgY29udGV4dC5wb3NpdGlvbiA9IHtvZmZzZXQsIGxpbmUsIGNoYXJhY3Rlcn07XG59XG5cblxuLyoqXG4gKiBSZWFkIGEgc2luZ2xlIGNoYXJhY3RlciBmcm9tIHRoZSBpbnB1dC4gSWYgYSBgdmFsaWRgIHN0cmluZyBpcyBwYXNzZWQsIHZhbGlkYXRlIHRoYXQgdGhlXG4gKiBjaGFyYWN0ZXIgaXMgaW5jbHVkZWQgaW4gdGhlIHZhbGlkIHN0cmluZy5cbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIF90b2tlbihjb250ZXh0OiBKc29uUGFyc2VyQ29udGV4dCwgdmFsaWQ6IHN0cmluZyk6IHN0cmluZztcbmZ1bmN0aW9uIF90b2tlbihjb250ZXh0OiBKc29uUGFyc2VyQ29udGV4dCk6IHN0cmluZyB8IHVuZGVmaW5lZDtcbmZ1bmN0aW9uIF90b2tlbihjb250ZXh0OiBKc29uUGFyc2VyQ29udGV4dCwgdmFsaWQ/OiBzdHJpbmcpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICBjb25zdCBjaGFyID0gX3BlZWsoY29udGV4dCk7XG4gIGlmICh2YWxpZCkge1xuICAgIGlmICghY2hhcikge1xuICAgICAgdGhyb3cgbmV3IFVuZXhwZWN0ZWRFbmRPZklucHV0RXhjZXB0aW9uKGNvbnRleHQpO1xuICAgIH1cbiAgICBpZiAodmFsaWQuaW5kZXhPZihjaGFyKSA9PSAtMSkge1xuICAgICAgdGhyb3cgbmV3IEludmFsaWRKc29uQ2hhcmFjdGVyRXhjZXB0aW9uKGNvbnRleHQpO1xuICAgIH1cbiAgfVxuXG4gIC8vIE1vdmUgdGhlIHBvc2l0aW9uIG9mIHRoZSBjb250ZXh0IHRvIHRoZSBuZXh0IGNoYXJhY3Rlci5cbiAgX25leHQoY29udGV4dCk7XG5cbiAgcmV0dXJuIGNoYXI7XG59XG5cblxuLyoqXG4gKiBSZWFkIHRoZSBleHBvbmVudCBwYXJ0IG9mIGEgbnVtYmVyLiBUaGUgZXhwb25lbnQgcGFydCBpcyBsb29zZXIgZm9yIEpTT04gdGhhbiB0aGUgbnVtYmVyXG4gKiBwYXJ0LiBgc3RyYCBpcyB0aGUgc3RyaW5nIG9mIHRoZSBudW1iZXIgaXRzZWxmIGZvdW5kIHNvIGZhciwgYW5kIHN0YXJ0IHRoZSBwb3NpdGlvblxuICogd2hlcmUgdGhlIGZ1bGwgbnVtYmVyIHN0YXJ0ZWQuIFJldHVybnMgdGhlIG5vZGUgZm91bmQuXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBfcmVhZEV4cE51bWJlcihjb250ZXh0OiBKc29uUGFyc2VyQ29udGV4dCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXJ0OiBQb3NpdGlvbixcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0cjogc3RyaW5nLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29tbWVudHM6IChKc29uQXN0Q29tbWVudCB8IEpzb25Bc3RNdWx0aWxpbmVDb21tZW50KVtdKTogSnNvbkFzdE51bWJlciB7XG4gIGxldCBjaGFyO1xuICBsZXQgc2lnbmVkID0gZmFsc2U7XG5cbiAgd2hpbGUgKHRydWUpIHtcbiAgICBjaGFyID0gX3Rva2VuKGNvbnRleHQpO1xuICAgIGlmIChjaGFyID09ICcrJyB8fCBjaGFyID09ICctJykge1xuICAgICAgaWYgKHNpZ25lZCkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIHNpZ25lZCA9IHRydWU7XG4gICAgICBzdHIgKz0gY2hhcjtcbiAgICB9IGVsc2UgaWYgKGNoYXIgPT0gJzAnIHx8IGNoYXIgPT0gJzEnIHx8IGNoYXIgPT0gJzInIHx8IGNoYXIgPT0gJzMnIHx8IGNoYXIgPT0gJzQnXG4gICAgICAgIHx8IGNoYXIgPT0gJzUnIHx8IGNoYXIgPT0gJzYnIHx8IGNoYXIgPT0gJzcnIHx8IGNoYXIgPT0gJzgnIHx8IGNoYXIgPT0gJzknKSB7XG4gICAgICBzaWduZWQgPSB0cnVlO1xuICAgICAgc3RyICs9IGNoYXI7XG4gICAgfSBlbHNlIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIC8vIFdlJ3JlIGRvbmUgcmVhZGluZyB0aGlzIG51bWJlci5cbiAgY29udGV4dC5wb3NpdGlvbiA9IGNvbnRleHQucHJldmlvdXM7XG5cbiAgcmV0dXJuIHtcbiAgICBraW5kOiAnbnVtYmVyJyxcbiAgICBzdGFydCxcbiAgICBlbmQ6IGNvbnRleHQucG9zaXRpb24sXG4gICAgdGV4dDogY29udGV4dC5vcmlnaW5hbC5zdWJzdHJpbmcoc3RhcnQub2Zmc2V0LCBjb250ZXh0LnBvc2l0aW9uLm9mZnNldCksXG4gICAgdmFsdWU6IE51bWJlci5wYXJzZUZsb2F0KHN0ciksXG4gICAgY29tbWVudHM6IGNvbW1lbnRzLFxuICB9O1xufVxuXG5cbi8qKlxuICogUmVhZCB0aGUgaGV4YSBwYXJ0IG9mIGEgMHhCQURDQUZFIGhleGFkZWNpbWFsIG51bWJlci5cbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIF9yZWFkSGV4YU51bWJlcihjb250ZXh0OiBKc29uUGFyc2VyQ29udGV4dCxcbiAgICAgICAgICAgICAgICAgICAgICAgICBpc05lZ2F0aXZlOiBib29sZWFuLFxuICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXJ0OiBQb3NpdGlvbixcbiAgICAgICAgICAgICAgICAgICAgICAgICBjb21tZW50czogKEpzb25Bc3RDb21tZW50IHwgSnNvbkFzdE11bHRpbGluZUNvbW1lbnQpW10pOiBKc29uQXN0TnVtYmVyIHtcbiAgLy8gUmVhZCBhbiBoZXhhZGVjaW1hbCBudW1iZXIsIHVudGlsIGl0J3Mgbm90IGhleGFkZWNpbWFsLlxuICBsZXQgaGV4YSA9ICcnO1xuICBjb25zdCB2YWxpZCA9ICcwMTIzNDU2Nzg5YWJjZGVmQUJDREVGJztcblxuICBmb3IgKGxldCBjaCA9IF9wZWVrKGNvbnRleHQpOyBjaCAmJiB2YWxpZC5pbmNsdWRlcyhjaCk7IGNoID0gX3BlZWsoY29udGV4dCkpIHtcbiAgICAvLyBBZGQgaXQgdG8gdGhlIGhleGEgc3RyaW5nLlxuICAgIGhleGEgKz0gY2g7XG4gICAgLy8gTW92ZSB0aGUgcG9zaXRpb24gb2YgdGhlIGNvbnRleHQgdG8gdGhlIG5leHQgY2hhcmFjdGVyLlxuICAgIF9uZXh0KGNvbnRleHQpO1xuICB9XG5cbiAgY29uc3QgdmFsdWUgPSBOdW1iZXIucGFyc2VJbnQoaGV4YSwgMTYpO1xuXG4gIC8vIFdlJ3JlIGRvbmUgcmVhZGluZyB0aGlzIG51bWJlci5cbiAgcmV0dXJuIHtcbiAgICBraW5kOiAnbnVtYmVyJyxcbiAgICBzdGFydCxcbiAgICBlbmQ6IGNvbnRleHQucG9zaXRpb24sXG4gICAgdGV4dDogY29udGV4dC5vcmlnaW5hbC5zdWJzdHJpbmcoc3RhcnQub2Zmc2V0LCBjb250ZXh0LnBvc2l0aW9uLm9mZnNldCksXG4gICAgdmFsdWU6IGlzTmVnYXRpdmUgPyAtdmFsdWUgOiB2YWx1ZSxcbiAgICBjb21tZW50cyxcbiAgfTtcbn1cblxuLyoqXG4gKiBSZWFkIGEgbnVtYmVyIGZyb20gdGhlIGNvbnRleHQuXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBfcmVhZE51bWJlcihjb250ZXh0OiBKc29uUGFyc2VyQ29udGV4dCwgY29tbWVudHMgPSBfcmVhZEJsYW5rcyhjb250ZXh0KSk6IEpzb25Bc3ROdW1iZXIge1xuICBsZXQgc3RyID0gJyc7XG4gIGxldCBkb3R0ZWQgPSBmYWxzZTtcbiAgY29uc3Qgc3RhcnQgPSBjb250ZXh0LnBvc2l0aW9uO1xuXG4gIC8vIHJlYWQgdW50aWwgYGVgIG9yIGVuZCBvZiBsaW5lLlxuICB3aGlsZSAodHJ1ZSkge1xuICAgIGNvbnN0IGNoYXIgPSBfdG9rZW4oY29udGV4dCk7XG5cbiAgICAvLyBSZWFkIHRva2Vucywgb25lIGJ5IG9uZS5cbiAgICBpZiAoY2hhciA9PSAnLScpIHtcbiAgICAgIGlmIChzdHIgIT0gJycpIHtcbiAgICAgICAgdGhyb3cgbmV3IEludmFsaWRKc29uQ2hhcmFjdGVyRXhjZXB0aW9uKGNvbnRleHQpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoY2hhciA9PSAnSSdcbiAgICAgICAgJiYgKHN0ciA9PSAnLScgfHwgc3RyID09ICcnIHx8IHN0ciA9PSAnKycpXG4gICAgICAgICYmIChjb250ZXh0Lm1vZGUgJiBKc29uUGFyc2VNb2RlLk51bWJlckNvbnN0YW50c0FsbG93ZWQpICE9IDApIHtcbiAgICAgIC8vIEluZmluaXR5P1xuICAgICAgLy8gX3Rva2VuKGNvbnRleHQsICdJJyk7IEFscmVhZHkgcmVhZC5cbiAgICAgIF90b2tlbihjb250ZXh0LCAnbicpO1xuICAgICAgX3Rva2VuKGNvbnRleHQsICdmJyk7XG4gICAgICBfdG9rZW4oY29udGV4dCwgJ2knKTtcbiAgICAgIF90b2tlbihjb250ZXh0LCAnbicpO1xuICAgICAgX3Rva2VuKGNvbnRleHQsICdpJyk7XG4gICAgICBfdG9rZW4oY29udGV4dCwgJ3QnKTtcbiAgICAgIF90b2tlbihjb250ZXh0LCAneScpO1xuXG4gICAgICBzdHIgKz0gJ0luZmluaXR5JztcbiAgICAgIGJyZWFrO1xuICAgIH0gZWxzZSBpZiAoY2hhciA9PSAnMCcpIHtcbiAgICAgIGlmIChzdHIgPT0gJzAnIHx8IHN0ciA9PSAnLTAnKSB7XG4gICAgICAgIHRocm93IG5ldyBJbnZhbGlkSnNvbkNoYXJhY3RlckV4Y2VwdGlvbihjb250ZXh0KTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGNoYXIgPT0gJzEnIHx8IGNoYXIgPT0gJzInIHx8IGNoYXIgPT0gJzMnIHx8IGNoYXIgPT0gJzQnIHx8IGNoYXIgPT0gJzUnXG4gICAgICAgIHx8IGNoYXIgPT0gJzYnIHx8IGNoYXIgPT0gJzcnIHx8IGNoYXIgPT0gJzgnIHx8IGNoYXIgPT0gJzknKSB7XG4gICAgICBpZiAoc3RyID09ICcwJyB8fCBzdHIgPT0gJy0wJykge1xuICAgICAgICB0aHJvdyBuZXcgSW52YWxpZEpzb25DaGFyYWN0ZXJFeGNlcHRpb24oY29udGV4dCk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChjaGFyID09ICcrJyAmJiBzdHIgPT0gJycpIHtcbiAgICAgIC8vIFBhc3Mgb3Zlci5cbiAgICB9IGVsc2UgaWYgKGNoYXIgPT0gJy4nKSB7XG4gICAgICBpZiAoZG90dGVkKSB7XG4gICAgICAgIHRocm93IG5ldyBJbnZhbGlkSnNvbkNoYXJhY3RlckV4Y2VwdGlvbihjb250ZXh0KTtcbiAgICAgIH1cbiAgICAgIGRvdHRlZCA9IHRydWU7XG4gICAgfSBlbHNlIGlmIChjaGFyID09ICdlJyB8fCBjaGFyID09ICdFJykge1xuICAgICAgcmV0dXJuIF9yZWFkRXhwTnVtYmVyKGNvbnRleHQsIHN0YXJ0LCBzdHIgKyBjaGFyLCBjb21tZW50cyk7XG4gICAgfSBlbHNlIGlmIChjaGFyID09ICd4JyAmJiAoc3RyID09ICcwJyB8fCBzdHIgPT0gJy0wJylcbiAgICAgICAgICAgICAgICYmIChjb250ZXh0Lm1vZGUgJiBKc29uUGFyc2VNb2RlLkhleGFkZWNpbWFsTnVtYmVyQWxsb3dlZCkgIT0gMCkge1xuICAgICAgcmV0dXJuIF9yZWFkSGV4YU51bWJlcihjb250ZXh0LCBzdHIgPT0gJy0wJywgc3RhcnQsIGNvbW1lbnRzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gV2UgcmVhZCBvbmUgdG9vIG1hbnkgY2hhcmFjdGVycywgc28gcm9sbGJhY2sgdGhlIGxhc3QgY2hhcmFjdGVyLlxuICAgICAgY29udGV4dC5wb3NpdGlvbiA9IGNvbnRleHQucHJldmlvdXM7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICBzdHIgKz0gY2hhcjtcbiAgfVxuXG4gIC8vIFdlJ3JlIGRvbmUgcmVhZGluZyB0aGlzIG51bWJlci5cbiAgaWYgKHN0ci5lbmRzV2l0aCgnLicpICYmIChjb250ZXh0Lm1vZGUgJiBKc29uUGFyc2VNb2RlLkhleGFkZWNpbWFsTnVtYmVyQWxsb3dlZCkgPT0gMCkge1xuICAgIHRocm93IG5ldyBJbnZhbGlkSnNvbkNoYXJhY3RlckV4Y2VwdGlvbihjb250ZXh0KTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAga2luZDogJ251bWJlcicsXG4gICAgc3RhcnQsXG4gICAgZW5kOiBjb250ZXh0LnBvc2l0aW9uLFxuICAgIHRleHQ6IGNvbnRleHQub3JpZ2luYWwuc3Vic3RyaW5nKHN0YXJ0Lm9mZnNldCwgY29udGV4dC5wb3NpdGlvbi5vZmZzZXQpLFxuICAgIHZhbHVlOiBOdW1iZXIucGFyc2VGbG9hdChzdHIpLFxuICAgIGNvbW1lbnRzLFxuICB9O1xufVxuXG5cbi8qKlxuICogUmVhZCBhIHN0cmluZyBmcm9tIHRoZSBjb250ZXh0LiBUYWtlcyB0aGUgY29tbWVudHMgb2YgdGhlIHN0cmluZyBvciByZWFkIHRoZSBibGFua3MgYmVmb3JlIHRoZVxuICogc3RyaW5nLlxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gX3JlYWRTdHJpbmcoY29udGV4dDogSnNvblBhcnNlckNvbnRleHQsIGNvbW1lbnRzID0gX3JlYWRCbGFua3MoY29udGV4dCkpOiBKc29uQXN0U3RyaW5nIHtcbiAgY29uc3Qgc3RhcnQgPSBjb250ZXh0LnBvc2l0aW9uO1xuXG4gIC8vIENvbnN1bWUgdGhlIGZpcnN0IHN0cmluZyBkZWxpbWl0ZXIuXG4gIGNvbnN0IGRlbGltID0gX3Rva2VuKGNvbnRleHQpO1xuICBpZiAoKGNvbnRleHQubW9kZSAmIEpzb25QYXJzZU1vZGUuU2luZ2xlUXVvdGVzQWxsb3dlZCkgPT0gMCkge1xuICAgIGlmIChkZWxpbSA9PSAnXFwnJykge1xuICAgICAgdGhyb3cgbmV3IEludmFsaWRKc29uQ2hhcmFjdGVyRXhjZXB0aW9uKGNvbnRleHQpO1xuICAgIH1cbiAgfVxuXG4gIGxldCBzdHIgPSAnJztcbiAgd2hpbGUgKHRydWUpIHtcbiAgICBsZXQgY2hhciA9IF90b2tlbihjb250ZXh0KTtcbiAgICBpZiAoY2hhciA9PSBkZWxpbSkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAga2luZDogJ3N0cmluZycsXG4gICAgICAgIHN0YXJ0LFxuICAgICAgICBlbmQ6IGNvbnRleHQucG9zaXRpb24sXG4gICAgICAgIHRleHQ6IGNvbnRleHQub3JpZ2luYWwuc3Vic3RyaW5nKHN0YXJ0Lm9mZnNldCwgY29udGV4dC5wb3NpdGlvbi5vZmZzZXQpLFxuICAgICAgICB2YWx1ZTogc3RyLFxuICAgICAgICBjb21tZW50czogY29tbWVudHMsXG4gICAgICB9O1xuICAgIH0gZWxzZSBpZiAoY2hhciA9PSAnXFxcXCcpIHtcbiAgICAgIGNoYXIgPSBfdG9rZW4oY29udGV4dCk7XG4gICAgICBzd2l0Y2ggKGNoYXIpIHtcbiAgICAgICAgY2FzZSAnXFxcXCc6XG4gICAgICAgIGNhc2UgJ1xcLyc6XG4gICAgICAgIGNhc2UgJ1wiJzpcbiAgICAgICAgY2FzZSBkZWxpbTpcbiAgICAgICAgICBzdHIgKz0gY2hhcjtcbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICdiJzogc3RyICs9ICdcXGInOyBicmVhaztcbiAgICAgICAgY2FzZSAnZic6IHN0ciArPSAnXFxmJzsgYnJlYWs7XG4gICAgICAgIGNhc2UgJ24nOiBzdHIgKz0gJ1xcbic7IGJyZWFrO1xuICAgICAgICBjYXNlICdyJzogc3RyICs9ICdcXHInOyBicmVhaztcbiAgICAgICAgY2FzZSAndCc6IHN0ciArPSAnXFx0JzsgYnJlYWs7XG4gICAgICAgIGNhc2UgJ3UnOlxuICAgICAgICAgIGNvbnN0IFtjMF0gPSBfdG9rZW4oY29udGV4dCwgJzAxMjM0NTY3ODlhYmNkZWZBQkNERUYnKTtcbiAgICAgICAgICBjb25zdCBbYzFdID0gX3Rva2VuKGNvbnRleHQsICcwMTIzNDU2Nzg5YWJjZGVmQUJDREVGJyk7XG4gICAgICAgICAgY29uc3QgW2MyXSA9IF90b2tlbihjb250ZXh0LCAnMDEyMzQ1Njc4OWFiY2RlZkFCQ0RFRicpO1xuICAgICAgICAgIGNvbnN0IFtjM10gPSBfdG9rZW4oY29udGV4dCwgJzAxMjM0NTY3ODlhYmNkZWZBQkNERUYnKTtcbiAgICAgICAgICBzdHIgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShwYXJzZUludChjMCArIGMxICsgYzIgKyBjMywgMTYpKTtcbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlIHVuZGVmaW5lZDpcbiAgICAgICAgICB0aHJvdyBuZXcgVW5leHBlY3RlZEVuZE9mSW5wdXRFeGNlcHRpb24oY29udGV4dCk7XG5cbiAgICAgICAgY2FzZSAnXFxuJzpcbiAgICAgICAgICAvLyBPbmx5IHZhbGlkIHdoZW4gbXVsdGlsaW5lIHN0cmluZ3MgYXJlIGFsbG93ZWQuXG4gICAgICAgICAgaWYgKChjb250ZXh0Lm1vZGUgJiBKc29uUGFyc2VNb2RlLk11bHRpTGluZVN0cmluZ0FsbG93ZWQpID09IDApIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBJbnZhbGlkSnNvbkNoYXJhY3RlckV4Y2VwdGlvbihjb250ZXh0KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgc3RyICs9IGNoYXI7XG4gICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICB0aHJvdyBuZXcgSW52YWxpZEpzb25DaGFyYWN0ZXJFeGNlcHRpb24oY29udGV4dCk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChjaGFyID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBVbmV4cGVjdGVkRW5kT2ZJbnB1dEV4Y2VwdGlvbihjb250ZXh0KTtcbiAgICB9IGVsc2UgaWYgKGNoYXIgPT0gJ1xcYicgfHwgY2hhciA9PSAnXFxmJyB8fCBjaGFyID09ICdcXG4nIHx8IGNoYXIgPT0gJ1xccicgfHwgY2hhciA9PSAnXFx0Jykge1xuICAgICAgdGhyb3cgbmV3IEludmFsaWRKc29uQ2hhcmFjdGVyRXhjZXB0aW9uKGNvbnRleHQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBzdHIgKz0gY2hhcjtcbiAgICB9XG4gIH1cbn1cblxuXG4vKipcbiAqIFJlYWQgdGhlIGNvbnN0YW50IGB0cnVlYCBmcm9tIHRoZSBjb250ZXh0LlxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gX3JlYWRUcnVlKGNvbnRleHQ6IEpzb25QYXJzZXJDb250ZXh0LFxuICAgICAgICAgICAgICAgICAgIGNvbW1lbnRzID0gX3JlYWRCbGFua3MoY29udGV4dCkpOiBKc29uQXN0Q29uc3RhbnRUcnVlIHtcbiAgY29uc3Qgc3RhcnQgPSBjb250ZXh0LnBvc2l0aW9uO1xuICBfdG9rZW4oY29udGV4dCwgJ3QnKTtcbiAgX3Rva2VuKGNvbnRleHQsICdyJyk7XG4gIF90b2tlbihjb250ZXh0LCAndScpO1xuICBfdG9rZW4oY29udGV4dCwgJ2UnKTtcblxuICBjb25zdCBlbmQgPSBjb250ZXh0LnBvc2l0aW9uO1xuXG4gIHJldHVybiB7XG4gICAga2luZDogJ3RydWUnLFxuICAgIHN0YXJ0LFxuICAgIGVuZCxcbiAgICB0ZXh0OiBjb250ZXh0Lm9yaWdpbmFsLnN1YnN0cmluZyhzdGFydC5vZmZzZXQsIGVuZC5vZmZzZXQpLFxuICAgIHZhbHVlOiB0cnVlLFxuICAgIGNvbW1lbnRzLFxuICB9O1xufVxuXG5cbi8qKlxuICogUmVhZCB0aGUgY29uc3RhbnQgYGZhbHNlYCBmcm9tIHRoZSBjb250ZXh0LlxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gX3JlYWRGYWxzZShjb250ZXh0OiBKc29uUGFyc2VyQ29udGV4dCxcbiAgICAgICAgICAgICAgICAgICAgY29tbWVudHMgPSBfcmVhZEJsYW5rcyhjb250ZXh0KSk6IEpzb25Bc3RDb25zdGFudEZhbHNlIHtcbiAgY29uc3Qgc3RhcnQgPSBjb250ZXh0LnBvc2l0aW9uO1xuICBfdG9rZW4oY29udGV4dCwgJ2YnKTtcbiAgX3Rva2VuKGNvbnRleHQsICdhJyk7XG4gIF90b2tlbihjb250ZXh0LCAnbCcpO1xuICBfdG9rZW4oY29udGV4dCwgJ3MnKTtcbiAgX3Rva2VuKGNvbnRleHQsICdlJyk7XG5cbiAgY29uc3QgZW5kID0gY29udGV4dC5wb3NpdGlvbjtcblxuICByZXR1cm4ge1xuICAgIGtpbmQ6ICdmYWxzZScsXG4gICAgc3RhcnQsXG4gICAgZW5kLFxuICAgIHRleHQ6IGNvbnRleHQub3JpZ2luYWwuc3Vic3RyaW5nKHN0YXJ0Lm9mZnNldCwgZW5kLm9mZnNldCksXG4gICAgdmFsdWU6IGZhbHNlLFxuICAgIGNvbW1lbnRzLFxuICB9O1xufVxuXG5cbi8qKlxuICogUmVhZCB0aGUgY29uc3RhbnQgYG51bGxgIGZyb20gdGhlIGNvbnRleHQuXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBfcmVhZE51bGwoY29udGV4dDogSnNvblBhcnNlckNvbnRleHQsXG4gICAgICAgICAgICAgICAgICAgY29tbWVudHMgPSBfcmVhZEJsYW5rcyhjb250ZXh0KSk6IEpzb25Bc3RDb25zdGFudE51bGwge1xuICBjb25zdCBzdGFydCA9IGNvbnRleHQucG9zaXRpb247XG5cbiAgX3Rva2VuKGNvbnRleHQsICduJyk7XG4gIF90b2tlbihjb250ZXh0LCAndScpO1xuICBfdG9rZW4oY29udGV4dCwgJ2wnKTtcbiAgX3Rva2VuKGNvbnRleHQsICdsJyk7XG5cbiAgY29uc3QgZW5kID0gY29udGV4dC5wb3NpdGlvbjtcblxuICByZXR1cm4ge1xuICAgIGtpbmQ6ICdudWxsJyxcbiAgICBzdGFydCxcbiAgICBlbmQsXG4gICAgdGV4dDogY29udGV4dC5vcmlnaW5hbC5zdWJzdHJpbmcoc3RhcnQub2Zmc2V0LCBlbmQub2Zmc2V0KSxcbiAgICB2YWx1ZTogbnVsbCxcbiAgICBjb21tZW50czogY29tbWVudHMsXG4gIH07XG59XG5cblxuLyoqXG4gKiBSZWFkIHRoZSBjb25zdGFudCBgTmFOYCBmcm9tIHRoZSBjb250ZXh0LlxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gX3JlYWROYU4oY29udGV4dDogSnNvblBhcnNlckNvbnRleHQsXG4gICAgICAgICAgICAgICAgICBjb21tZW50cyA9IF9yZWFkQmxhbmtzKGNvbnRleHQpKTogSnNvbkFzdE51bWJlciB7XG4gIGNvbnN0IHN0YXJ0ID0gY29udGV4dC5wb3NpdGlvbjtcblxuICBfdG9rZW4oY29udGV4dCwgJ04nKTtcbiAgX3Rva2VuKGNvbnRleHQsICdhJyk7XG4gIF90b2tlbihjb250ZXh0LCAnTicpO1xuXG4gIGNvbnN0IGVuZCA9IGNvbnRleHQucG9zaXRpb247XG5cbiAgcmV0dXJuIHtcbiAgICBraW5kOiAnbnVtYmVyJyxcbiAgICBzdGFydCxcbiAgICBlbmQsXG4gICAgdGV4dDogY29udGV4dC5vcmlnaW5hbC5zdWJzdHJpbmcoc3RhcnQub2Zmc2V0LCBlbmQub2Zmc2V0KSxcbiAgICB2YWx1ZTogTmFOLFxuICAgIGNvbW1lbnRzOiBjb21tZW50cyxcbiAgfTtcbn1cblxuXG4vKipcbiAqIFJlYWQgYW4gYXJyYXkgb2YgSlNPTiB2YWx1ZXMgZnJvbSB0aGUgY29udGV4dC5cbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIF9yZWFkQXJyYXkoY29udGV4dDogSnNvblBhcnNlckNvbnRleHQsIGNvbW1lbnRzID0gX3JlYWRCbGFua3MoY29udGV4dCkpOiBKc29uQXN0QXJyYXkge1xuICBjb25zdCBzdGFydCA9IGNvbnRleHQucG9zaXRpb247XG5cbiAgLy8gQ29uc3VtZSB0aGUgZmlyc3QgZGVsaW1pdGVyLlxuICBfdG9rZW4oY29udGV4dCwgJ1snKTtcbiAgY29uc3QgdmFsdWU6IEpzb25BcnJheSA9IFtdO1xuICBjb25zdCBlbGVtZW50czogSnNvbkFzdE5vZGVbXSA9IFtdO1xuXG4gIF9yZWFkQmxhbmtzKGNvbnRleHQpO1xuICBpZiAoX3BlZWsoY29udGV4dCkgIT0gJ10nKSB7XG4gICAgY29uc3Qgbm9kZSA9IF9yZWFkVmFsdWUoY29udGV4dCk7XG4gICAgZWxlbWVudHMucHVzaChub2RlKTtcbiAgICB2YWx1ZS5wdXNoKG5vZGUudmFsdWUpO1xuICB9XG5cbiAgd2hpbGUgKF9wZWVrKGNvbnRleHQpICE9ICddJykge1xuICAgIF90b2tlbihjb250ZXh0LCAnLCcpO1xuXG4gICAgY29uc3QgdmFsdWVDb21tZW50cyA9IF9yZWFkQmxhbmtzKGNvbnRleHQpO1xuICAgIGlmICgoY29udGV4dC5tb2RlICYgSnNvblBhcnNlTW9kZS5UcmFpbGluZ0NvbW1hc0FsbG93ZWQpICE9PSAwICYmIF9wZWVrKGNvbnRleHQpID09PSAnXScpIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgICBjb25zdCBub2RlID0gX3JlYWRWYWx1ZShjb250ZXh0LCB2YWx1ZUNvbW1lbnRzKTtcbiAgICBlbGVtZW50cy5wdXNoKG5vZGUpO1xuICAgIHZhbHVlLnB1c2gobm9kZS52YWx1ZSk7XG4gIH1cblxuICBfdG9rZW4oY29udGV4dCwgJ10nKTtcblxuICByZXR1cm4ge1xuICAgIGtpbmQ6ICdhcnJheScsXG4gICAgc3RhcnQsXG4gICAgZW5kOiBjb250ZXh0LnBvc2l0aW9uLFxuICAgIHRleHQ6IGNvbnRleHQub3JpZ2luYWwuc3Vic3RyaW5nKHN0YXJ0Lm9mZnNldCwgY29udGV4dC5wb3NpdGlvbi5vZmZzZXQpLFxuICAgIHZhbHVlLFxuICAgIGVsZW1lbnRzLFxuICAgIGNvbW1lbnRzLFxuICB9O1xufVxuXG5cbi8qKlxuICogUmVhZCBhbiBpZGVudGlmaWVyIGZyb20gdGhlIGNvbnRleHQuIEFuIGlkZW50aWZpZXIgaXMgYSB2YWxpZCBKYXZhU2NyaXB0IGlkZW50aWZpZXIsIGFuZCB0aGlzXG4gKiBmdW5jdGlvbiBpcyBvbmx5IHVzZWQgaW4gTG9vc2UgbW9kZS5cbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIF9yZWFkSWRlbnRpZmllcihjb250ZXh0OiBKc29uUGFyc2VyQ29udGV4dCxcbiAgICAgICAgICAgICAgICAgICAgICAgICBjb21tZW50cyA9IF9yZWFkQmxhbmtzKGNvbnRleHQpKTogSnNvbkFzdElkZW50aWZpZXIge1xuICBjb25zdCBzdGFydCA9IGNvbnRleHQucG9zaXRpb247XG5cbiAgbGV0IGNoYXIgPSBfcGVlayhjb250ZXh0KTtcbiAgaWYgKGNoYXIgJiYgJzAxMjM0NTY3ODknLmluZGV4T2YoY2hhcikgIT0gLTEpIHtcbiAgICBjb25zdCBpZGVudGlmaWVyTm9kZSA9IF9yZWFkTnVtYmVyKGNvbnRleHQpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGtpbmQ6ICdpZGVudGlmaWVyJyxcbiAgICAgIHN0YXJ0LFxuICAgICAgZW5kOiBpZGVudGlmaWVyTm9kZS5lbmQsXG4gICAgICB0ZXh0OiBpZGVudGlmaWVyTm9kZS50ZXh0LFxuICAgICAgdmFsdWU6IGlkZW50aWZpZXJOb2RlLnZhbHVlLnRvU3RyaW5nKCksXG4gICAgfTtcbiAgfVxuXG4gIGNvbnN0IGlkZW50VmFsaWRGaXJzdENoYXIgPSAnYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXpBQkNERUZHSElKS0xNT1BRUlNUVVZXWFlaJztcbiAgY29uc3QgaWRlbnRWYWxpZENoYXIgPSAnXyRhYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ekFCQ0RFRkdISUpLTE1PUFFSU1RVVldYWVowMTIzNDU2Nzg5JztcbiAgbGV0IGZpcnN0ID0gdHJ1ZTtcbiAgbGV0IHZhbHVlID0gJyc7XG5cbiAgd2hpbGUgKHRydWUpIHtcbiAgICBjaGFyID0gX3Rva2VuKGNvbnRleHQpO1xuICAgIGlmIChjaGFyID09IHVuZGVmaW5lZFxuICAgICAgICB8fCAoZmlyc3QgPyBpZGVudFZhbGlkRmlyc3RDaGFyLmluZGV4T2YoY2hhcikgOiBpZGVudFZhbGlkQ2hhci5pbmRleE9mKGNoYXIpKSA9PSAtMSkge1xuICAgICAgY29udGV4dC5wb3NpdGlvbiA9IGNvbnRleHQucHJldmlvdXM7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIGtpbmQ6ICdpZGVudGlmaWVyJyxcbiAgICAgICAgc3RhcnQsXG4gICAgICAgIGVuZDogY29udGV4dC5wb3NpdGlvbixcbiAgICAgICAgdGV4dDogY29udGV4dC5vcmlnaW5hbC5zdWJzdHIoc3RhcnQub2Zmc2V0LCBjb250ZXh0LnBvc2l0aW9uLm9mZnNldCksXG4gICAgICAgIHZhbHVlLFxuICAgICAgICBjb21tZW50cyxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgdmFsdWUgKz0gY2hhcjtcbiAgICBmaXJzdCA9IGZhbHNlO1xuICB9XG59XG5cblxuLyoqXG4gKiBSZWFkIGEgcHJvcGVydHkgZnJvbSB0aGUgY29udGV4dC4gQSBwcm9wZXJ0eSBpcyBhIHN0cmluZyBvciAoaW4gTG9vc2UgbW9kZSBvbmx5KSBhIG51bWJlciBvclxuICogYW4gaWRlbnRpZmllciwgZm9sbG93ZWQgYnkgYSBjb2xvbiBgOmAuXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBfcmVhZFByb3BlcnR5KGNvbnRleHQ6IEpzb25QYXJzZXJDb250ZXh0LFxuICAgICAgICAgICAgICAgICAgICAgICBjb21tZW50cyA9IF9yZWFkQmxhbmtzKGNvbnRleHQpKTogSnNvbkFzdEtleVZhbHVlIHtcbiAgY29uc3Qgc3RhcnQgPSBjb250ZXh0LnBvc2l0aW9uO1xuXG4gIGxldCBrZXk7XG4gIGlmICgoY29udGV4dC5tb2RlICYgSnNvblBhcnNlTW9kZS5JZGVudGlmaWVyS2V5TmFtZXNBbGxvd2VkKSAhPSAwKSB7XG4gICAgY29uc3QgdG9wID0gX3BlZWsoY29udGV4dCk7XG4gICAgaWYgKHRvcCA9PSAnXCInIHx8IHRvcCA9PSAnXFwnJykge1xuICAgICAga2V5ID0gX3JlYWRTdHJpbmcoY29udGV4dCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGtleSA9IF9yZWFkSWRlbnRpZmllcihjb250ZXh0KTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAga2V5ID0gX3JlYWRTdHJpbmcoY29udGV4dCk7XG4gIH1cblxuICBfcmVhZEJsYW5rcyhjb250ZXh0KTtcbiAgX3Rva2VuKGNvbnRleHQsICc6Jyk7XG4gIGNvbnN0IHZhbHVlID0gX3JlYWRWYWx1ZShjb250ZXh0KTtcbiAgY29uc3QgZW5kID0gY29udGV4dC5wb3NpdGlvbjtcblxuICByZXR1cm4ge1xuICAgIGtpbmQ6ICdrZXl2YWx1ZScsXG4gICAga2V5LFxuICAgIHZhbHVlLFxuICAgIHN0YXJ0LFxuICAgIGVuZCxcbiAgICB0ZXh0OiBjb250ZXh0Lm9yaWdpbmFsLnN1YnN0cmluZyhzdGFydC5vZmZzZXQsIGVuZC5vZmZzZXQpLFxuICAgIGNvbW1lbnRzLFxuICB9O1xufVxuXG5cbi8qKlxuICogUmVhZCBhbiBvYmplY3Qgb2YgcHJvcGVydGllcyAtPiBKU09OIHZhbHVlcyBmcm9tIHRoZSBjb250ZXh0LlxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gX3JlYWRPYmplY3QoY29udGV4dDogSnNvblBhcnNlckNvbnRleHQsXG4gICAgICAgICAgICAgICAgICAgICBjb21tZW50cyA9IF9yZWFkQmxhbmtzKGNvbnRleHQpKTogSnNvbkFzdE9iamVjdCB7XG4gIGNvbnN0IHN0YXJ0ID0gY29udGV4dC5wb3NpdGlvbjtcbiAgLy8gQ29uc3VtZSB0aGUgZmlyc3QgZGVsaW1pdGVyLlxuICBfdG9rZW4oY29udGV4dCwgJ3snKTtcbiAgY29uc3QgdmFsdWU6IEpzb25PYmplY3QgPSB7fTtcbiAgY29uc3QgcHJvcGVydGllczogSnNvbkFzdEtleVZhbHVlW10gPSBbXTtcblxuICBfcmVhZEJsYW5rcyhjb250ZXh0KTtcbiAgaWYgKF9wZWVrKGNvbnRleHQpICE9ICd9Jykge1xuICAgIGNvbnN0IHByb3BlcnR5ID0gX3JlYWRQcm9wZXJ0eShjb250ZXh0KTtcbiAgICB2YWx1ZVtwcm9wZXJ0eS5rZXkudmFsdWVdID0gcHJvcGVydHkudmFsdWUudmFsdWU7XG4gICAgcHJvcGVydGllcy5wdXNoKHByb3BlcnR5KTtcblxuICAgIHdoaWxlIChfcGVlayhjb250ZXh0KSAhPSAnfScpIHtcbiAgICAgIF90b2tlbihjb250ZXh0LCAnLCcpO1xuXG4gICAgICBjb25zdCBwcm9wZXJ0eUNvbW1lbnRzID0gX3JlYWRCbGFua3MoY29udGV4dCk7XG4gICAgICBpZiAoKGNvbnRleHQubW9kZSAmIEpzb25QYXJzZU1vZGUuVHJhaWxpbmdDb21tYXNBbGxvd2VkKSAhPT0gMCAmJiBfcGVlayhjb250ZXh0KSA9PT0gJ30nKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY29uc3QgcHJvcGVydHkgPSBfcmVhZFByb3BlcnR5KGNvbnRleHQsIHByb3BlcnR5Q29tbWVudHMpO1xuICAgICAgdmFsdWVbcHJvcGVydHkua2V5LnZhbHVlXSA9IHByb3BlcnR5LnZhbHVlLnZhbHVlO1xuICAgICAgcHJvcGVydGllcy5wdXNoKHByb3BlcnR5KTtcbiAgICB9XG4gIH1cblxuICBfdG9rZW4oY29udGV4dCwgJ30nKTtcblxuICByZXR1cm4ge1xuICAgIGtpbmQ6ICdvYmplY3QnLFxuICAgIHByb3BlcnRpZXMsXG4gICAgc3RhcnQsXG4gICAgZW5kOiBjb250ZXh0LnBvc2l0aW9uLFxuICAgIHZhbHVlLFxuICAgIHRleHQ6IGNvbnRleHQub3JpZ2luYWwuc3Vic3RyaW5nKHN0YXJ0Lm9mZnNldCwgY29udGV4dC5wb3NpdGlvbi5vZmZzZXQpLFxuICAgIGNvbW1lbnRzLFxuICB9O1xufVxuXG5cbi8qKlxuICogUmVtb3ZlIGFueSBibGFuayBjaGFyYWN0ZXIgb3IgY29tbWVudHMgKGluIExvb3NlIG1vZGUpIGZyb20gdGhlIGNvbnRleHQsIHJldHVybmluZyBhbiBhcnJheVxuICogb2YgY29tbWVudHMgaWYgYW55IGFyZSBmb3VuZC5cbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIF9yZWFkQmxhbmtzKGNvbnRleHQ6IEpzb25QYXJzZXJDb250ZXh0KTogKEpzb25Bc3RDb21tZW50IHwgSnNvbkFzdE11bHRpbGluZUNvbW1lbnQpW10ge1xuICBpZiAoKGNvbnRleHQubW9kZSAmIEpzb25QYXJzZU1vZGUuQ29tbWVudHNBbGxvd2VkKSAhPSAwKSB7XG4gICAgY29uc3QgY29tbWVudHM6IChKc29uQXN0Q29tbWVudCB8IEpzb25Bc3RNdWx0aWxpbmVDb21tZW50KVtdID0gW107XG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgIGNvbnN0IGNoYXIgPSBjb250ZXh0Lm9yaWdpbmFsW2NvbnRleHQucG9zaXRpb24ub2Zmc2V0XTtcbiAgICAgIGlmIChjaGFyID09ICcvJyAmJiBjb250ZXh0Lm9yaWdpbmFsW2NvbnRleHQucG9zaXRpb24ub2Zmc2V0ICsgMV0gPT0gJyonKSB7XG4gICAgICAgIGNvbnN0IHN0YXJ0ID0gY29udGV4dC5wb3NpdGlvbjtcbiAgICAgICAgLy8gTXVsdGkgbGluZSBjb21tZW50LlxuICAgICAgICBfbmV4dChjb250ZXh0KTtcbiAgICAgICAgX25leHQoY29udGV4dCk7XG5cbiAgICAgICAgd2hpbGUgKGNvbnRleHQub3JpZ2luYWxbY29udGV4dC5wb3NpdGlvbi5vZmZzZXRdICE9ICcqJ1xuICAgICAgICAgICAgfHwgY29udGV4dC5vcmlnaW5hbFtjb250ZXh0LnBvc2l0aW9uLm9mZnNldCArIDFdICE9ICcvJykge1xuICAgICAgICAgIF9uZXh0KGNvbnRleHQpO1xuICAgICAgICAgIGlmIChjb250ZXh0LnBvc2l0aW9uLm9mZnNldCA+PSBjb250ZXh0Lm9yaWdpbmFsLmxlbmd0aCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFVuZXhwZWN0ZWRFbmRPZklucHV0RXhjZXB0aW9uKGNvbnRleHQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyBSZW1vdmUgXCIqL1wiLlxuICAgICAgICBfbmV4dChjb250ZXh0KTtcbiAgICAgICAgX25leHQoY29udGV4dCk7XG5cbiAgICAgICAgY29tbWVudHMucHVzaCh7XG4gICAgICAgICAga2luZDogJ211bHRpY29tbWVudCcsXG4gICAgICAgICAgc3RhcnQsXG4gICAgICAgICAgZW5kOiBjb250ZXh0LnBvc2l0aW9uLFxuICAgICAgICAgIHRleHQ6IGNvbnRleHQub3JpZ2luYWwuc3Vic3RyaW5nKHN0YXJ0Lm9mZnNldCwgY29udGV4dC5wb3NpdGlvbi5vZmZzZXQpLFxuICAgICAgICAgIGNvbnRlbnQ6IGNvbnRleHQub3JpZ2luYWwuc3Vic3RyaW5nKHN0YXJ0Lm9mZnNldCArIDIsIGNvbnRleHQucG9zaXRpb24ub2Zmc2V0IC0gMiksXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIGlmIChjaGFyID09ICcvJyAmJiBjb250ZXh0Lm9yaWdpbmFsW2NvbnRleHQucG9zaXRpb24ub2Zmc2V0ICsgMV0gPT0gJy8nKSB7XG4gICAgICAgIGNvbnN0IHN0YXJ0ID0gY29udGV4dC5wb3NpdGlvbjtcbiAgICAgICAgLy8gTXVsdGkgbGluZSBjb21tZW50LlxuICAgICAgICBfbmV4dChjb250ZXh0KTtcbiAgICAgICAgX25leHQoY29udGV4dCk7XG5cbiAgICAgICAgd2hpbGUgKGNvbnRleHQub3JpZ2luYWxbY29udGV4dC5wb3NpdGlvbi5vZmZzZXRdICE9ICdcXG4nKSB7XG4gICAgICAgICAgX25leHQoY29udGV4dCk7XG4gICAgICAgICAgaWYgKGNvbnRleHQucG9zaXRpb24ub2Zmc2V0ID49IGNvbnRleHQub3JpZ2luYWwubGVuZ3RoKSB7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZW1vdmUgXCJcXG5cIi5cbiAgICAgICAgaWYgKGNvbnRleHQucG9zaXRpb24ub2Zmc2V0IDwgY29udGV4dC5vcmlnaW5hbC5sZW5ndGgpIHtcbiAgICAgICAgICBfbmV4dChjb250ZXh0KTtcbiAgICAgICAgfVxuICAgICAgICBjb21tZW50cy5wdXNoKHtcbiAgICAgICAgICBraW5kOiAnY29tbWVudCcsXG4gICAgICAgICAgc3RhcnQsXG4gICAgICAgICAgZW5kOiBjb250ZXh0LnBvc2l0aW9uLFxuICAgICAgICAgIHRleHQ6IGNvbnRleHQub3JpZ2luYWwuc3Vic3RyaW5nKHN0YXJ0Lm9mZnNldCwgY29udGV4dC5wb3NpdGlvbi5vZmZzZXQpLFxuICAgICAgICAgIGNvbnRlbnQ6IGNvbnRleHQub3JpZ2luYWwuc3Vic3RyaW5nKHN0YXJ0Lm9mZnNldCArIDIsIGNvbnRleHQucG9zaXRpb24ub2Zmc2V0IC0gMSksXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIGlmIChjaGFyID09ICcgJyB8fCBjaGFyID09ICdcXHQnIHx8IGNoYXIgPT0gJ1xcbicgfHwgY2hhciA9PSAnXFxyJyB8fCBjaGFyID09ICdcXGYnKSB7XG4gICAgICAgIF9uZXh0KGNvbnRleHQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGNvbW1lbnRzO1xuICB9IGVsc2Uge1xuICAgIGxldCBjaGFyID0gY29udGV4dC5vcmlnaW5hbFtjb250ZXh0LnBvc2l0aW9uLm9mZnNldF07XG4gICAgd2hpbGUgKGNoYXIgPT0gJyAnIHx8IGNoYXIgPT0gJ1xcdCcgfHwgY2hhciA9PSAnXFxuJyB8fCBjaGFyID09ICdcXHInIHx8IGNoYXIgPT0gJ1xcZicpIHtcbiAgICAgIF9uZXh0KGNvbnRleHQpO1xuICAgICAgY2hhciA9IGNvbnRleHQub3JpZ2luYWxbY29udGV4dC5wb3NpdGlvbi5vZmZzZXRdO1xuICAgIH1cblxuICAgIHJldHVybiBbXTtcbiAgfVxufVxuXG5cbi8qKlxuICogUmVhZCBhIEpTT04gdmFsdWUgZnJvbSB0aGUgY29udGV4dCwgd2hpY2ggY2FuIGJlIGFueSBmb3JtIG9mIEpTT04gdmFsdWUuXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBfcmVhZFZhbHVlKGNvbnRleHQ6IEpzb25QYXJzZXJDb250ZXh0LCBjb21tZW50cyA9IF9yZWFkQmxhbmtzKGNvbnRleHQpKTogSnNvbkFzdE5vZGUge1xuICBsZXQgcmVzdWx0OiBKc29uQXN0Tm9kZTtcblxuICAvLyBDbGVhbiB1cCBiZWZvcmUuXG4gIGNvbnN0IGNoYXIgPSBfcGVlayhjb250ZXh0KTtcbiAgc3dpdGNoIChjaGFyKSB7XG4gICAgY2FzZSB1bmRlZmluZWQ6XG4gICAgICB0aHJvdyBuZXcgVW5leHBlY3RlZEVuZE9mSW5wdXRFeGNlcHRpb24oY29udGV4dCk7XG5cbiAgICBjYXNlICctJzpcbiAgICBjYXNlICcwJzpcbiAgICBjYXNlICcxJzpcbiAgICBjYXNlICcyJzpcbiAgICBjYXNlICczJzpcbiAgICBjYXNlICc0JzpcbiAgICBjYXNlICc1JzpcbiAgICBjYXNlICc2JzpcbiAgICBjYXNlICc3JzpcbiAgICBjYXNlICc4JzpcbiAgICBjYXNlICc5JzpcbiAgICAgIHJlc3VsdCA9IF9yZWFkTnVtYmVyKGNvbnRleHQsIGNvbW1lbnRzKTtcbiAgICAgIGJyZWFrO1xuXG4gICAgY2FzZSAnLic6XG4gICAgY2FzZSAnKyc6XG4gICAgICBpZiAoKGNvbnRleHQubW9kZSAmIEpzb25QYXJzZU1vZGUuTGF4TnVtYmVyUGFyc2luZ0FsbG93ZWQpID09IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEludmFsaWRKc29uQ2hhcmFjdGVyRXhjZXB0aW9uKGNvbnRleHQpO1xuICAgICAgfVxuICAgICAgcmVzdWx0ID0gX3JlYWROdW1iZXIoY29udGV4dCwgY29tbWVudHMpO1xuICAgICAgYnJlYWs7XG5cbiAgICBjYXNlICdcXCcnOlxuICAgIGNhc2UgJ1wiJzpcbiAgICAgIHJlc3VsdCA9IF9yZWFkU3RyaW5nKGNvbnRleHQsIGNvbW1lbnRzKTtcbiAgICAgIGJyZWFrO1xuXG4gICAgY2FzZSAnSSc6XG4gICAgICBpZiAoKGNvbnRleHQubW9kZSAmIEpzb25QYXJzZU1vZGUuTnVtYmVyQ29uc3RhbnRzQWxsb3dlZCkgPT0gMCkge1xuICAgICAgICB0aHJvdyBuZXcgSW52YWxpZEpzb25DaGFyYWN0ZXJFeGNlcHRpb24oY29udGV4dCk7XG4gICAgICB9XG4gICAgICByZXN1bHQgPSBfcmVhZE51bWJlcihjb250ZXh0LCBjb21tZW50cyk7XG4gICAgICBicmVhaztcblxuICAgIGNhc2UgJ04nOlxuICAgICAgaWYgKChjb250ZXh0Lm1vZGUgJiBKc29uUGFyc2VNb2RlLk51bWJlckNvbnN0YW50c0FsbG93ZWQpID09IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEludmFsaWRKc29uQ2hhcmFjdGVyRXhjZXB0aW9uKGNvbnRleHQpO1xuICAgICAgfVxuICAgICAgcmVzdWx0ID0gX3JlYWROYU4oY29udGV4dCwgY29tbWVudHMpO1xuICAgICAgYnJlYWs7XG5cbiAgICBjYXNlICd0JzpcbiAgICAgIHJlc3VsdCA9IF9yZWFkVHJ1ZShjb250ZXh0LCBjb21tZW50cyk7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdmJzpcbiAgICAgIHJlc3VsdCA9IF9yZWFkRmFsc2UoY29udGV4dCwgY29tbWVudHMpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnbic6XG4gICAgICByZXN1bHQgPSBfcmVhZE51bGwoY29udGV4dCwgY29tbWVudHMpO1xuICAgICAgYnJlYWs7XG5cbiAgICBjYXNlICdbJzpcbiAgICAgIHJlc3VsdCA9IF9yZWFkQXJyYXkoY29udGV4dCwgY29tbWVudHMpO1xuICAgICAgYnJlYWs7XG5cbiAgICBjYXNlICd7JzpcbiAgICAgIHJlc3VsdCA9IF9yZWFkT2JqZWN0KGNvbnRleHQsIGNvbW1lbnRzKTtcbiAgICAgIGJyZWFrO1xuXG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBJbnZhbGlkSnNvbkNoYXJhY3RlckV4Y2VwdGlvbihjb250ZXh0KTtcbiAgfVxuXG4gIC8vIENsZWFuIHVwIGFmdGVyLlxuICBfcmVhZEJsYW5rcyhjb250ZXh0KTtcblxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5cbi8qKlxuICogVGhlIFBhcnNlIG1vZGUgdXNlZCBmb3IgcGFyc2luZyB0aGUgSlNPTiBzdHJpbmcuXG4gKi9cbmV4cG9ydCBlbnVtIEpzb25QYXJzZU1vZGUge1xuICBTdHJpY3QgICAgICAgICAgICAgICAgICAgID0gICAgICAwLCAgLy8gU3RhbmRhcmQgSlNPTi5cbiAgQ29tbWVudHNBbGxvd2VkICAgICAgICAgICA9IDEgPDwgMCwgIC8vIEFsbG93cyBjb21tZW50cywgYm90aCBzaW5nbGUgb3IgbXVsdGkgbGluZXMuXG4gIFNpbmdsZVF1b3Rlc0FsbG93ZWQgICAgICAgPSAxIDw8IDEsICAvLyBBbGxvdyBzaW5nbGUgcXVvdGVkIHN0cmluZ3MuXG4gIElkZW50aWZpZXJLZXlOYW1lc0FsbG93ZWQgPSAxIDw8IDIsICAvLyBBbGxvdyBpZGVudGlmaWVycyBhcyBvYmplY3RwIHByb3BlcnRpZXMuXG4gIFRyYWlsaW5nQ29tbWFzQWxsb3dlZCAgICAgPSAxIDw8IDMsXG4gIEhleGFkZWNpbWFsTnVtYmVyQWxsb3dlZCAgPSAxIDw8IDQsXG4gIE11bHRpTGluZVN0cmluZ0FsbG93ZWQgICAgPSAxIDw8IDUsXG4gIExheE51bWJlclBhcnNpbmdBbGxvd2VkICAgPSAxIDw8IDYsICAvLyBBbGxvdyBgLmAgb3IgYCtgIGFzIHRoZSBmaXJzdCBjaGFyYWN0ZXIgb2YgYSBudW1iZXIuXG4gIE51bWJlckNvbnN0YW50c0FsbG93ZWQgICAgPSAxIDw8IDcsICAvLyBBbGxvdyAtSW5maW5pdHksIEluZmluaXR5IGFuZCBOYU4uXG5cbiAgRGVmYXVsdCAgICAgICAgICAgICAgICAgICA9IFN0cmljdCxcbiAgTG9vc2UgICAgICAgICAgICAgICAgICAgICA9IENvbW1lbnRzQWxsb3dlZCB8IFNpbmdsZVF1b3Rlc0FsbG93ZWQgfFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgSWRlbnRpZmllcktleU5hbWVzQWxsb3dlZCB8IFRyYWlsaW5nQ29tbWFzQWxsb3dlZCB8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBIZXhhZGVjaW1hbE51bWJlckFsbG93ZWQgfCBNdWx0aUxpbmVTdHJpbmdBbGxvd2VkIHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIExheE51bWJlclBhcnNpbmdBbGxvd2VkIHwgTnVtYmVyQ29uc3RhbnRzQWxsb3dlZCxcblxuICBKc29uICAgICAgICAgICAgICAgICAgICAgID0gU3RyaWN0LFxuICBKc29uNSAgICAgICAgICAgICAgICAgICAgID0gTG9vc2UsXG59XG5cblxuLyoqXG4gKiBQYXJzZSB0aGUgSlNPTiBzdHJpbmcgYW5kIHJldHVybiBpdHMgQVNULiBUaGUgQVNUIG1heSBiZSBsb3NpbmcgZGF0YSAoZW5kIGNvbW1lbnRzIGFyZVxuICogZGlzY2FyZGVkIGZvciBleGFtcGxlLCBhbmQgc3BhY2UgY2hhcmFjdGVycyBhcmUgbm90IHJlcHJlc2VudGVkIGluIHRoZSBBU1QpLCBidXQgYWxsIHZhbHVlc1xuICogd2lsbCBoYXZlIGEgc2luZ2xlIG5vZGUgaW4gdGhlIEFTVCAoYSAxLXRvLTEgbWFwcGluZykuXG4gKiBAcGFyYW0gaW5wdXQgVGhlIHN0cmluZyB0byB1c2UuXG4gKiBAcGFyYW0gbW9kZSBUaGUgbW9kZSB0byBwYXJzZSB0aGUgaW5wdXQgd2l0aC4ge0BzZWUgSnNvblBhcnNlTW9kZX0uXG4gKiBAcmV0dXJucyB7SnNvbkFzdE5vZGV9IFRoZSByb290IG5vZGUgb2YgdGhlIHZhbHVlIG9mIHRoZSBBU1QuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUpzb25Bc3QoaW5wdXQ6IHN0cmluZywgbW9kZSA9IEpzb25QYXJzZU1vZGUuRGVmYXVsdCk6IEpzb25Bc3ROb2RlIHtcbiAgaWYgKG1vZGUgPT0gSnNvblBhcnNlTW9kZS5EZWZhdWx0KSB7XG4gICAgbW9kZSA9IEpzb25QYXJzZU1vZGUuU3RyaWN0O1xuICB9XG5cbiAgY29uc3QgY29udGV4dCA9IHtcbiAgICBwb3NpdGlvbjogeyBvZmZzZXQ6IDAsIGxpbmU6IDAsIGNoYXJhY3RlcjogMCB9LFxuICAgIHByZXZpb3VzOiB7IG9mZnNldDogMCwgbGluZTogMCwgY2hhcmFjdGVyOiAwIH0sXG4gICAgb3JpZ2luYWw6IGlucHV0LFxuICAgIGNvbW1lbnRzOiB1bmRlZmluZWQsXG4gICAgbW9kZSxcbiAgfTtcblxuICBjb25zdCBhc3QgPSBfcmVhZFZhbHVlKGNvbnRleHQpO1xuICBpZiAoY29udGV4dC5wb3NpdGlvbi5vZmZzZXQgPCBpbnB1dC5sZW5ndGgpIHtcbiAgICBjb25zdCByZXN0ID0gaW5wdXQuc3Vic3RyKGNvbnRleHQucG9zaXRpb24ub2Zmc2V0KTtcbiAgICBjb25zdCBpID0gcmVzdC5sZW5ndGggPiAyMCA/IHJlc3Quc3Vic3RyKDAsIDIwKSArICcuLi4nIDogcmVzdDtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkIGVuZCBvZiBmaWxlLCBnb3QgXCIke2l9XCIgYXQgYFxuICAgICAgICArIGAke2NvbnRleHQucG9zaXRpb24ubGluZX06JHtjb250ZXh0LnBvc2l0aW9uLmNoYXJhY3Rlcn0uYCk7XG4gIH1cblxuICByZXR1cm4gYXN0O1xufVxuXG5cbi8qKlxuICogT3B0aW9ucyBmb3IgdGhlIHBhcnNlSnNvbigpIGZ1bmN0aW9uLlxuICovXG5pbnRlcmZhY2UgUGFyc2VKc29uT3B0aW9ucyB7XG4gIC8qKlxuICAgKiBJZiBvbWl0dGVkLCB3aWxsIG9ubHkgZW1pdCBlcnJvcnMgcmVsYXRlZCB0byB0aGUgY29udGVudCBvZiB0aGUgSlNPTi4gSWYgc3BlY2lmaWVkLCBhbnlcbiAgICogSlNPTiBlcnJvcnMgd2lsbCBhbHNvIGluY2x1ZGUgdGhlIHBhdGggb2YgdGhlIGZpbGUgdGhhdCBjYXVzZWQgdGhlIGVycm9yLlxuICAgKi9cbiAgcGF0aD86IHN0cmluZztcbn1cblxuXG4vKipcbiAqIFBhcnNlIGEgSlNPTiBzdHJpbmcgaW50byBpdHMgdmFsdWUuICBUaGlzIGRpc2NhcmRzIHRoZSBBU1QgYW5kIG9ubHkgcmV0dXJucyB0aGUgdmFsdWUgaXRzZWxmLlxuICpcbiAqIElmIGEgcGF0aCBvcHRpb24gaXMgcGFzcywgaXQgYWxzbyBhYnNvcmJzIEpTT04gcGFyc2luZyBlcnJvcnMgYW5kIHJldHVybiBhIG5ldyBlcnJvciB3aXRoIHRoZVxuICogcGF0aCBpbiBpdC4gVXNlZnVsIGZvciBzaG93aW5nIGVycm9ycyB3aGVuIHBhcnNpbmcgZnJvbSBhIGZpbGUuXG4gKlxuICogQHBhcmFtIGlucHV0IFRoZSBzdHJpbmcgdG8gcGFyc2UuXG4gKiBAcGFyYW0gbW9kZSBUaGUgbW9kZSB0byBwYXJzZSB0aGUgaW5wdXQgd2l0aC4ge0BzZWUgSnNvblBhcnNlTW9kZX0uXG4gKiBAcGFyYW0gb3B0aW9ucyBBZGRpdGlvbmFsIG9wdGlub3MgZm9yIHBhcnNpbmcuXG4gKiBAcmV0dXJucyB7SnNvblZhbHVlfSBUaGUgdmFsdWUgcmVwcmVzZW50ZWQgYnkgdGhlIEpTT04gc3RyaW5nLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VKc29uKFxuICBpbnB1dDogc3RyaW5nLFxuICBtb2RlID0gSnNvblBhcnNlTW9kZS5EZWZhdWx0LFxuICBvcHRpb25zPzogUGFyc2VKc29uT3B0aW9ucyxcbik6IEpzb25WYWx1ZSB7XG4gIHRyeSB7XG4gICAgLy8gVHJ5IHBhcnNpbmcgZm9yIHRoZSBmYXN0ZXN0IHBhdGggYXZhaWxhYmxlLCBpZiBlcnJvciwgdXNlcyBvdXIgb3duIHBhcnNlciBmb3IgYmV0dGVyIGVycm9ycy5cbiAgICBpZiAobW9kZSA9PSBKc29uUGFyc2VNb2RlLlN0cmljdCkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgcmV0dXJuIEpTT04ucGFyc2UoaW5wdXQpO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIHJldHVybiBwYXJzZUpzb25Bc3QoaW5wdXQsIG1vZGUpLnZhbHVlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBwYXJzZUpzb25Bc3QoaW5wdXQsIG1vZGUpLnZhbHVlO1xuICB9IGNhdGNoIChlKSB7XG4gICAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5wYXRoICYmIGUgaW5zdGFuY2VvZiBKc29uRXhjZXB0aW9uKSB7XG4gICAgICB0aHJvdyBuZXcgUGF0aFNwZWNpZmljSnNvbkV4Y2VwdGlvbihvcHRpb25zLnBhdGgsIGUpO1xuICAgIH1cbiAgICB0aHJvdyBlO1xuICB9XG59XG4iXX0=