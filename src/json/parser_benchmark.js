"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const benchmark_1 = require("@_/benchmark");
const parser_1 = require("./parser");
const testCase = {
    'hello': [0, 1, 'world', 2],
    'world': {
        'great': 123E-12,
    },
};
const testCaseJson = JSON.stringify(testCase);
describe('parserJson', () => {
    benchmark_1.benchmark('parseJsonAst', () => parser_1.parseJsonAst(testCaseJson), () => JSON.parse(testCaseJson));
    benchmark_1.benchmark('parseJson', () => parser_1.parseJson(testCaseJson));
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFyc2VyX2JlbmNobWFyay5qcyIsInNvdXJjZVJvb3QiOiIuLyIsInNvdXJjZXMiOlsicGFja2FnZXMvYW5ndWxhcl9kZXZraXQvY29yZS9zcmMvanNvbi9wYXJzZXJfYmVuY2htYXJrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUE7Ozs7OztHQU1HO0FBQ0gsNENBQXlDO0FBQ3pDLHFDQUFtRDtBQUduRCxNQUFNLFFBQVEsR0FBRztJQUNmLE9BQU8sRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsT0FBTyxFQUFFLENBQUMsQ0FBQztJQUMzQixPQUFPLEVBQUU7UUFDUCxPQUFPLEVBQUUsT0FBTztLQUNqQjtDQUNGLENBQUM7QUFDRixNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBRzlDLFFBQVEsQ0FBQyxZQUFZLEVBQUUsR0FBRyxFQUFFO0lBQzFCLHFCQUFTLENBQUMsY0FBYyxFQUFFLEdBQUcsRUFBRSxDQUFDLHFCQUFZLENBQUMsWUFBWSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO0lBQzVGLHFCQUFTLENBQUMsV0FBVyxFQUFFLEdBQUcsRUFBRSxDQUFDLGtCQUFTLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQztBQUN4RCxDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCB7IGJlbmNobWFyayB9IGZyb20gJ0BfL2JlbmNobWFyayc7XG5pbXBvcnQgeyBwYXJzZUpzb24sIHBhcnNlSnNvbkFzdCB9IGZyb20gJy4vcGFyc2VyJztcblxuXG5jb25zdCB0ZXN0Q2FzZSA9IHtcbiAgJ2hlbGxvJzogWzAsIDEsICd3b3JsZCcsIDJdLFxuICAnd29ybGQnOiB7XG4gICAgJ2dyZWF0JzogMTIzRS0xMixcbiAgfSxcbn07XG5jb25zdCB0ZXN0Q2FzZUpzb24gPSBKU09OLnN0cmluZ2lmeSh0ZXN0Q2FzZSk7XG5cblxuZGVzY3JpYmUoJ3BhcnNlckpzb24nLCAoKSA9PiB7XG4gIGJlbmNobWFyaygncGFyc2VKc29uQXN0JywgKCkgPT4gcGFyc2VKc29uQXN0KHRlc3RDYXNlSnNvbiksICgpID0+IEpTT04ucGFyc2UodGVzdENhc2VKc29uKSk7XG4gIGJlbmNobWFyaygncGFyc2VKc29uJywgKCkgPT4gcGFyc2VKc29uKHRlc3RDYXNlSnNvbikpO1xufSk7XG4iXX0=