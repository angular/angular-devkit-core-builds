"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.levenshtein = exports.capitalize = exports.underscore = exports.classify = exports.camelize = exports.dasherize = exports.decamelize = void 0;
const STRING_DASHERIZE_REGEXP = /[ _]/g;
const STRING_DECAMELIZE_REGEXP = /([a-z\d])([A-Z])/g;
const STRING_CAMELIZE_REGEXP = /(-|_|\.|\s)+(.)?/g;
const STRING_UNDERSCORE_REGEXP_1 = /([a-z\d])([A-Z]+)/g;
const STRING_UNDERSCORE_REGEXP_2 = /-|\s+/g;
/**
 * Converts a camelized string into all lower case separated by underscores.
 *
 ```javascript
 decamelize('innerHTML');         // 'inner_html'
 decamelize('action_name');       // 'action_name'
 decamelize('css-class-name');    // 'css-class-name'
 decamelize('my favorite items'); // 'my favorite items'
 ```

 @method decamelize
 @param {String} str The string to decamelize.
 @return {String} the decamelized string.
 */
function decamelize(str) {
    return str.replace(STRING_DECAMELIZE_REGEXP, '$1_$2').toLowerCase();
}
exports.decamelize = decamelize;
/**
 Replaces underscores, spaces, or camelCase with dashes.

 ```javascript
 dasherize('innerHTML');         // 'inner-html'
 dasherize('action_name');       // 'action-name'
 dasherize('css-class-name');    // 'css-class-name'
 dasherize('my favorite items'); // 'my-favorite-items'
 ```

 @method dasherize
 @param {String} str The string to dasherize.
 @return {String} the dasherized string.
 */
function dasherize(str) {
    return decamelize(str).replace(STRING_DASHERIZE_REGEXP, '-');
}
exports.dasherize = dasherize;
/**
 Returns the lowerCamelCase form of a string.

 ```javascript
 camelize('innerHTML');          // 'innerHTML'
 camelize('action_name');        // 'actionName'
 camelize('css-class-name');     // 'cssClassName'
 camelize('my favorite items');  // 'myFavoriteItems'
 camelize('My Favorite Items');  // 'myFavoriteItems'
 ```

 @method camelize
 @param {String} str The string to camelize.
 @return {String} the camelized string.
 */
function camelize(str) {
    return str
        .replace(STRING_CAMELIZE_REGEXP, (_match, _separator, chr) => {
        return chr ? chr.toUpperCase() : '';
    })
        .replace(/^([A-Z])/, (match) => match.toLowerCase());
}
exports.camelize = camelize;
/**
 Returns the UpperCamelCase form of a string.

 ```javascript
 'innerHTML'.classify();          // 'InnerHTML'
 'action_name'.classify();        // 'ActionName'
 'css-class-name'.classify();     // 'CssClassName'
 'my favorite items'.classify();  // 'MyFavoriteItems'
 ```

 @method classify
 @param {String} str the string to classify
 @return {String} the classified string
 */
function classify(str) {
    return str
        .split('.')
        .map((part) => capitalize(camelize(part)))
        .join('.');
}
exports.classify = classify;
/**
 More general than decamelize. Returns the lower\_case\_and\_underscored
 form of a string.

 ```javascript
 'innerHTML'.underscore();          // 'inner_html'
 'action_name'.underscore();        // 'action_name'
 'css-class-name'.underscore();     // 'css_class_name'
 'my favorite items'.underscore();  // 'my_favorite_items'
 ```

 @method underscore
 @param {String} str The string to underscore.
 @return {String} the underscored string.
 */
function underscore(str) {
    return str
        .replace(STRING_UNDERSCORE_REGEXP_1, '$1_$2')
        .replace(STRING_UNDERSCORE_REGEXP_2, '_')
        .toLowerCase();
}
exports.underscore = underscore;
/**
 Returns the Capitalized form of a string

 ```javascript
 'innerHTML'.capitalize()         // 'InnerHTML'
 'action_name'.capitalize()       // 'Action_name'
 'css-class-name'.capitalize()    // 'Css-class-name'
 'my favorite items'.capitalize() // 'My favorite items'
 ```

 @method capitalize
 @param {String} str The string to capitalize.
 @return {String} The capitalized string.
 */
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.substr(1);
}
exports.capitalize = capitalize;
/**
 * Calculate the levenshtein distance of two strings.
 * See https://en.wikipedia.org/wiki/Levenshtein_distance.
 * Based off https://gist.github.com/andrei-m/982927 (for using the faster dynamic programming
 * version).
 *
 * @param a String a.
 * @param b String b.
 * @returns A number that represents the distance between the two strings. The greater the number
 *   the more distant the strings are from each others.
 */
function levenshtein(a, b) {
    if (a.length == 0) {
        return b.length;
    }
    if (b.length == 0) {
        return a.length;
    }
    const matrix = [];
    // increment along the first column of each row
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    // increment each column in the first row
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    // Fill in the rest of the matrix
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) == a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            }
            else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, // substitution
                matrix[i][j - 1] + 1, // insertion
                matrix[i - 1][j] + 1);
            }
        }
    }
    return matrix[b.length][a.length];
}
exports.levenshtein = levenshtein;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RyaW5ncy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2NvcmUvc3JjL3V0aWxzL3N0cmluZ3MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBRUgsTUFBTSx1QkFBdUIsR0FBRyxPQUFPLENBQUM7QUFDeEMsTUFBTSx3QkFBd0IsR0FBRyxtQkFBbUIsQ0FBQztBQUNyRCxNQUFNLHNCQUFzQixHQUFHLG1CQUFtQixDQUFDO0FBQ25ELE1BQU0sMEJBQTBCLEdBQUcsb0JBQW9CLENBQUM7QUFDeEQsTUFBTSwwQkFBMEIsR0FBRyxRQUFRLENBQUM7QUFFNUM7Ozs7Ozs7Ozs7Ozs7R0FhRztBQUNILFNBQWdCLFVBQVUsQ0FBQyxHQUFXO0lBQ3BDLE9BQU8sR0FBRyxDQUFDLE9BQU8sQ0FBQyx3QkFBd0IsRUFBRSxPQUFPLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztBQUN0RSxDQUFDO0FBRkQsZ0NBRUM7QUFFRDs7Ozs7Ozs7Ozs7OztHQWFHO0FBQ0gsU0FBZ0IsU0FBUyxDQUFDLEdBQVc7SUFDbkMsT0FBTyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLHVCQUF1QixFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBQy9ELENBQUM7QUFGRCw4QkFFQztBQUVEOzs7Ozs7Ozs7Ozs7OztHQWNHO0FBQ0gsU0FBZ0IsUUFBUSxDQUFDLEdBQVc7SUFDbEMsT0FBTyxHQUFHO1NBQ1AsT0FBTyxDQUFDLHNCQUFzQixFQUFFLENBQUMsTUFBYyxFQUFFLFVBQWtCLEVBQUUsR0FBVyxFQUFFLEVBQUU7UUFDbkYsT0FBTyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO0lBQ3RDLENBQUMsQ0FBQztTQUNELE9BQU8sQ0FBQyxVQUFVLEVBQUUsQ0FBQyxLQUFhLEVBQUUs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QUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FDckIsQ0FBQzthQUNIO1NBQ0Y7S0FDRjtJQUVELE9BQU8sTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDcEMsQ0FBQztBQXBDRCxrQ0FvQ0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuY29uc3QgU1RSSU5HX0RBU0hFUklaRV9SRUdFWFAgPSAvWyBfXS9nO1xuY29uc3QgU1RSSU5HX0RFQ0FNRUxJWkVfUkVHRVhQID0gLyhbYS16XFxkXSkoW0EtWl0pL2c7XG5jb25zdCBTVFJJTkdfQ0FNRUxJWkVfUkVHRVhQID0gLygtfF98XFwufFxccykrKC4pPy9nO1xuY29uc3QgU1RSSU5HX1VOREVSU0NPUkVfUkVHRVhQXzEgPSAvKFthLXpcXGRdKShbQS1aXSspL2c7XG5jb25zdCBTVFJJTkdfVU5ERVJTQ09SRV9SRUdFWFBfMiA9IC8tfFxccysvZztcblxuLyoqXG4gKiBDb252ZXJ0cyBhIGNhbWVsaXplZCBzdHJpbmcgaW50byBhbGwgbG93ZXIgY2FzZSBzZXBhcmF0ZWQgYnkgdW5kZXJzY29yZXMuXG4gKlxuIGBgYGphdmFzY3JpcHRcbiBkZWNhbWVsaXplKCdpbm5lckhUTUwnKTsgICAgICAgICAvLyAnaW5uZXJfaHRtbCdcbiBkZWNhbWVsaXplKCdhY3Rpb25fbmFtZScpOyAgICAgICAvLyAnYWN0aW9uX25hbWUnXG4gZGVjYW1lbGl6ZSgnY3NzLWNsYXNzLW5hbWUnKTsgICAgLy8gJ2Nzcy1jbGFzcy1uYW1lJ1xuIGRlY2FtZWxpemUoJ215IGZhdm9yaXRlIGl0ZW1zJyk7IC8vICdteSBmYXZvcml0ZSBpdGVtcydcbiBgYGBcblxuIEBtZXRob2QgZGVjYW1lbGl6ZVxuIEBwYXJhbSB7U3RyaW5nfSBzdHIgVGhlIHN0cmluZyB0byBkZWNhbWVsaXplLlxuIEByZXR1cm4ge1N0cmluZ30gdGhlIGRlY2FtZWxpemVkIHN0cmluZy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRlY2FtZWxpemUoc3RyOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gc3RyLnJlcGxhY2UoU1RSSU5HX0RFQ0FNRUxJWkVfUkVHRVhQLCAnJDFfJDInKS50b0xvd2VyQ2FzZSgpO1xufVxuXG4vKipcbiBSZXBsYWNlcyB1bmRlcnNjb3Jlcywgc3BhY2VzLCBvciBjYW1lbENhc2Ugd2l0aCBkYXNoZXMuXG5cbiBgYGBqYXZhc2NyaXB0XG4gZGFzaGVyaXplKCdpbm5lckhUTUwnKTsgICAgICAgICAvLyAnaW5uZXItaHRtbCdcbiBkYXNoZXJpemUoJ2FjdGlvbl9uYW1lJyk7ICAgICAgIC8vICdhY3Rpb24tbmFtZSdcbiBkYXNoZXJpemUoJ2Nzcy1jbGFzcy1uYW1lJyk7ICAgIC8vICdjc3MtY2xhc3MtbmFtZSdcbiBkYXNoZXJpemUoJ215IGZhdm9yaXRlIGl0ZW1zJyk7IC8vICdteS1mYXZvcml0ZS1pdGVtcydcbiBgYGBcblxuIEBtZXRob2QgZGFzaGVyaXplXG4gQHBhcmFtIHtTdHJpbmd9IHN0ciBUaGUgc3RyaW5nIHRvIGRhc2hlcml6ZS5cbiBAcmV0dXJuIHtTdHJpbmd9IHRoZSBkYXNoZXJpemVkIHN0cmluZy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRhc2hlcml6ZShzdHI6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBkZWNhbWVsaXplKHN0cikucmVwbGFjZShTVFJJTkdfREFTSEVSSVpFX1JFR0VYUCwgJy0nKTtcbn1cblxuLyoqXG4gUmV0dXJucyB0aGUgbG93ZXJDYW1lbENhc2UgZm9ybSBvZiBhIHN0cmluZy5cblxuIGBgYGphdmFzY3JpcHRcbiBjYW1lbGl6ZSgnaW5uZXJIVE1MJyk7ICAgICAgICAgIC8vICdpbm5lckhUTUwnXG4gY2FtZWxpemUoJ2FjdGlvbl9uYW1lJyk7ICAgICAgICAvLyAnYWN0aW9uTmFtZSdcbiBjYW1lbGl6ZSgnY3NzLWNsYXNzLW5hbWUnKTsgICAgIC8vICdjc3NDbGFzc05hbWUnXG4gY2FtZWxpemUoJ215IGZhdm9yaXRlIGl0ZW1zJyk7ICAvLyAnbXlGYXZvcml0ZUl0ZW1zJ1xuIGNhbWVsaXplKCdNeSBGYXZvcml0ZSBJdGVtcycpOyAgLy8gJ215RmF2b3JpdGVJdGVtcydcbiBgYGBcblxuIEBtZXRob2QgY2FtZWxpemVcbiBAcGFyYW0ge1N0cmluZ30gc3RyIFRoZSBzdHJpbmcgdG8gY2FtZWxpemUuXG4gQHJldHVybiB7U3RyaW5nfSB0aGUgY2FtZWxpemVkIHN0cmluZy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNhbWVsaXplKHN0cjogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIHN0clxuICAgIC5yZXBsYWNlKFNUUklOR19DQU1FTElaRV9SRUdFWFAsIChfbWF0Y2g6IHN0cmluZywgX3NlcGFyYXRvcjogc3RyaW5nLCBjaHI6IHN0cmluZykgPT4ge1xuICAgICAgcmV0dXJuIGNociA/IGNoci50b1VwcGVyQ2FzZSgpIDogJyc7XG4gICAgfSlcbiAgICAucmVwbGFjZSgvXihbQS1aXSkvLCAobWF0Y2g6IHN0cmluZykgPT4gbWF0Y2gudG9Mb3dlckNhc2UoKSk7XG59XG5cbi8qKlxuIFJldHVybnMgdGhlIFVwcGVyQ2FtZWxDYXNlIGZvcm0gb2YgYSBzdHJpbmcuXG5cbiBgYGBqYXZhc2NyaXB0XG4gJ2lubmVySFRNTCcuY2xhc3NpZnkoKTsgICAgICAgICAgLy8gJ0lubmVySFRNTCdcbiAnYWN0aW9uX25hbWUnLmNsYXNzaWZ5KCk7ICAgICAgICAvLyAnQWN0aW9uTmFtZSdcbiAnY3NzLWNsYXNzLW5hbWUnLmNsYXNzaWZ5KCk7ICAgICAvLyAnQ3NzQ2xhc3NOYW1lJ1xuICdteSBmYXZvcml0ZSBpdGVtcycuY2xhc3NpZnkoKTsgIC8vICdNeUZhdm9yaXRlSXRlbXMnXG4gYGBgXG5cbiBAbWV0aG9kIGNsYXNzaWZ5XG4gQHBhcmFtIHtTdHJpbmd9IHN0ciB0aGUgc3RyaW5nIHRvIGNsYXNzaWZ5XG4gQHJldHVybiB7U3RyaW5nfSB0aGUgY2xhc3NpZmllZCBzdHJpbmdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNsYXNzaWZ5KHN0cjogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIHN0clxuICAgIC5zcGxpdCgnLicpXG4gICAgLm1hcCgocGFydCkgPT4gY2FwaXRhbGl6ZShjYW1lbGl6ZShwYXJ0KSkpXG4gICAgLmpvaW4oJy4nKTtcbn1cblxuLyoqXG4gTW9yZSBnZW5lcmFsIHRoYW4gZGVjYW1lbGl6ZS4gUmV0dXJucyB0aGUgbG93ZXJcXF9jYXNlXFxfYW5kXFxfdW5kZXJzY29yZWRcbiBmb3JtIG9mIGEgc3RyaW5nLlxuXG4gYGBgamF2YXNjcmlwdFxuICdpbm5lckhUTUwnLnVuZGVyc2NvcmUoKTsgICAgICAgICAgLy8gJ2lubmVyX2h0bWwnXG4gJ2FjdGlvbl9uYW1lJy51bmRlcnNjb3JlKCk7ICAgICAgICAvLyAnYWN0aW9uX25hbWUnXG4gJ2Nzcy1jbGFzcy1uYW1lJy51bmRlcnNjb3JlKCk7ICAgICAvLyAnY3NzX2NsYXNzX25hbWUnXG4gJ215IGZhdm9yaXRlIGl0ZW1zJy51bmRlcnNjb3JlKCk7ICAvLyAnbXlfZmF2b3JpdGVfaXRlbXMnXG4gYGBgXG5cbiBAbWV0aG9kIHVuZGVyc2NvcmVcbiBAcGFyYW0ge1N0cmluZ30gc3RyIFRoZSBzdHJpbmcgdG8gdW5kZXJzY29yZS5cbiBAcmV0dXJuIHtTdHJpbmd9IHRoZSB1bmRlcnNjb3JlZCBzdHJpbmcuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB1bmRlcnNjb3JlKHN0cjogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIHN0clxuICAgIC5yZXBsYWNlKFNUUklOR19VTkRFUlNDT1JFX1JFR0VYUF8xLCAnJDFfJDInKVxuICAgIC5yZXBsYWNlKFNUUklOR19VTkRFUlNDT1JFX1JFR0VYUF8yLCAnXycpXG4gICAgLnRvTG93ZXJDYXNlKCk7XG59XG5cbi8qKlxuIFJldHVybnMgdGhlIENhcGl0YWxpemVkIGZvcm0gb2YgYSBzdHJpbmdcblxuIGBgYGphdmFzY3JpcHRcbiAnaW5uZXJIVE1MJy5jYXBpdGFsaXplKCkgICAgICAgICAvLyAnSW5uZXJIVE1MJ1xuICdhY3Rpb25fbmFtZScuY2FwaXRhbGl6ZSgpICAgICAgIC8vICdBY3Rpb25fbmFtZSdcbiAnY3NzLWNsYXNzLW5hbWUnLmNhcGl0YWxpemUoKSAgICAvLyAnQ3NzLWNsYXNzLW5hbWUnXG4gJ215IGZhdm9yaXRlIGl0ZW1zJy5jYXBpdGFsaXplKCkgLy8gJ015IGZhdm9yaXRlIGl0ZW1zJ1xuIGBgYFxuXG4gQG1ldGhvZCBjYXBpdGFsaXplXG4gQHBhcmFtIHtTdHJpbmd9IHN0ciBUaGUgc3RyaW5nIHRvIGNhcGl0YWxpemUuXG4gQHJldHVybiB7U3RyaW5nfSBUaGUgY2FwaXRhbGl6ZWQgc3RyaW5nLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY2FwaXRhbGl6ZShzdHI6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBzdHIuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBzdHIuc3Vic3RyKDEpO1xufVxuXG4vKipcbiAqIENhbGN1bGF0ZSB0aGUgbGV2ZW5zaHRlaW4gZGlzdGFuY2Ugb2YgdHdvIHN0cmluZ3MuXG4gKiBTZWUgaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvTGV2ZW5zaHRlaW5fZGlzdGFuY2UuXG4gKiBCYXNlZCBvZmYgaHR0cHM6Ly9naXN0LmdpdGh1Yi5jb20vYW5kcmVpLW0vOTgyOTI3IChmb3IgdXNpbmcgdGhlIGZhc3RlciBkeW5hbWljIHByb2dyYW1taW5nXG4gKiB2ZXJzaW9uKS5cbiAqXG4gKiBAcGFyYW0gYSBTdHJpbmcgYS5cbiAqIEBwYXJhbSBiIFN0cmluZyBiLlxuICogQHJldHVybnMgQSBudW1iZXIgdGhhdCByZXByZXNlbnRzIHRoZSBkaXN0YW5jZSBiZXR3ZWVuIHRoZSB0d28gc3RyaW5ncy4gVGhlIGdyZWF0ZXIgdGhlIG51bWJlclxuICogICB0aGUgbW9yZSBkaXN0YW50IHRoZSBzdHJpbmdzIGFyZSBmcm9tIGVhY2ggb3RoZXJzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gbGV2ZW5zaHRlaW4oYTogc3RyaW5nLCBiOiBzdHJpbmcpOiBudW1iZXIge1xuICBpZiAoYS5sZW5ndGggPT0gMCkge1xuICAgIHJldHVybiBiLmxlbmd0aDtcbiAgfVxuICBpZiAoYi5sZW5ndGggPT0gMCkge1xuICAgIHJldHVybiBhLmxlbmd0aDtcbiAgfVxuXG4gIGNvbnN0IG1hdHJpeCA9IFtdO1xuXG4gIC8vIGluY3JlbWVudCBhbG9uZyB0aGUgZmlyc3QgY29sdW1uIG9mIGVhY2ggcm93XG4gIGZvciAobGV0IGkgPSAwOyBpIDw9IGIubGVuZ3RoOyBpKyspIHtcbiAgICBtYXRyaXhbaV0gPSBbaV07XG4gIH1cblxuICAvLyBpbmNyZW1lbnQgZWFjaCBjb2x1bW4gaW4gdGhlIGZpcnN0IHJvd1xuICBmb3IgKGxldCBqID0gMDsgaiA8PSBhLmxlbmd0aDsgaisrKSB7XG4gICAgbWF0cml4WzBdW2pdID0gajtcbiAgfVxuXG4gIC8vIEZpbGwgaW4gdGhlIHJlc3Qgb2YgdGhlIG1hdHJpeFxuICBmb3IgKGxldCBpID0gMTsgaSA8PSBiLmxlbmd0aDsgaSsrKSB7XG4gICAgZm9yIChsZXQgaiA9IDE7IGogPD0gYS5sZW5ndGg7IGorKykge1xuICAgICAgaWYgKGIuY2hhckF0KGkgLSAxKSA9PSBhLmNoYXJBdChqIC0gMSkpIHtcbiAgICAgICAgbWF0cml4W2ldW2pdID0gbWF0cml4W2kgLSAxXVtqIC0gMV07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBtYXRyaXhbaV1bal0gPSBNYXRoLm1pbihcbiAgICAgICAgICBtYXRyaXhbaSAtIDFdW2ogLSAxXSArIDEsIC8vIHN1YnN0aXR1dGlvblxuICAgICAgICAgIG1hdHJpeFtpXVtqIC0gMV0gKyAxLCAvLyBpbnNlcnRpb25cbiAgICAgICAgICBtYXRyaXhbaSAtIDFdW2pdICsgMSwgLy8gZGVsZXRpb25cbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gbWF0cml4W2IubGVuZ3RoXVthLmxlbmd0aF07XG59XG4iXX0=