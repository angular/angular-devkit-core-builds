"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LevelCapLogger = exports.LevelTransformLogger = void 0;
const logger_1 = require("./logger");
class LevelTransformLogger extends logger_1.Logger {
    name;
    parent;
    levelTransform;
    constructor(name, parent = null, levelTransform) {
        super(name, parent);
        this.name = name;
        this.parent = parent;
        this.levelTransform = levelTransform;
    }
    log(level, message, metadata = {}) {
        return super.log(this.levelTransform(level), message, metadata);
    }
    createChild(name) {
        return new LevelTransformLogger(name, this, this.levelTransform);
    }
}
exports.LevelTransformLogger = LevelTransformLogger;
class LevelCapLogger extends LevelTransformLogger {
    name;
    parent;
    levelCap;
    static levelMap = {
        debug: { debug: 'debug', info: 'debug', warn: 'debug', error: 'debug', fatal: 'debug' },
        info: { debug: 'debug', info: 'info', warn: 'info', error: 'info', fatal: 'info' },
        warn: { debug: 'debug', info: 'info', warn: 'warn', error: 'warn', fatal: 'warn' },
        error: { debug: 'debug', info: 'info', warn: 'warn', error: 'error', fatal: 'error' },
        fatal: { debug: 'debug', info: 'info', warn: 'warn', error: 'error', fatal: 'fatal' },
    };
    constructor(name, parent = null, levelCap) {
        super(name, parent, (level) => {
            return (LevelCapLogger.levelMap[levelCap][level] || level);
        });
        this.name = name;
        this.parent = parent;
        this.levelCap = levelCap;
    }
}
exports.LevelCapLogger = LevelCapLogger;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGV2ZWwuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9jb3JlL3NyYy9sb2dnZXIvbGV2ZWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBR0gscUNBQTRDO0FBRTVDLE1BQWEsb0JBQXFCLFNBQVEsZUFBTTtJQUVuQjtJQUNBO0lBQ1Q7SUFIbEIsWUFDMkIsSUFBWSxFQUNaLFNBQXdCLElBQUksRUFDckMsY0FBNkM7UUFFN0QsS0FBSyxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQztRQUpLLFNBQUksR0FBSixJQUFJLENBQVE7UUFDWixXQUFNLEdBQU4sTUFBTSxDQUFzQjtRQUNyQyxtQkFBYyxHQUFkLGNBQWMsQ0FBK0I7SUFHL0QsQ0FBQztJQUVRLEdBQUcsQ0FBQyxLQUFlLEVBQUUsT0FBZSxFQUFFLFdBQXVCLEVBQUU7UUFDdEUsT0FBTyxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLEVBQUUsT0FBTyxFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQ2xFLENBQUM7SUFFUSxXQUFXLENBQUMsSUFBWTtRQUMvQixPQUFPLElBQUksb0JBQW9CLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUM7SUFDbkUsQ0FBQztDQUNGO0FBaEJELG9EQWdCQztBQUVELE1BQWEsY0FBZSxTQUFRLG9CQUFvQjtJQVUzQjtJQUNBO0lBQ1Q7SUFYbEIsTUFBTSxDQUFDLFFBQVEsR0FBbUQ7UUFDaEUsS0FBSyxFQUFFLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFO1FBQ3ZGLElBQUksRUFBRSxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRTtRQUNsRixJQUFJLEVBQUUsRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUU7UUFDbEYsS0FBSyxFQUFFLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFO1FBQ3JGLEtBQUssRUFBRSxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRTtLQUN0RixDQUFDO0lBRUYsWUFDMkIsSUFBWSxFQUNaLFNBQXdCLElBQUksRUFDckMsUUFBa0I7UUFFbEMsS0FBSyxDQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsQ0FBQyxLQUFlLEVBQUUsRUFBRTtZQUN0QyxPQUFPLENBQUMsY0FBYyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxLQUFLLENBQWEsQ0FBQztRQUN6RSxDQUFDLENBQUMsQ0FBQztRQU5zQixTQUFJLEdBQUosSUFBSSxDQUFRO1FBQ1osV0FBTSxHQUFOLE1BQU0sQ0FBc0I7UUFDckMsYUFBUSxHQUFSLFFBQVEsQ0FBVTtJQUtwQyxDQUFDOztBQWpCSCx3Q0FrQkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgSnNvbk9iamVjdCB9IGZyb20gJy4uL2pzb24vdXRpbHMnO1xuaW1wb3J0IHsgTG9nTGV2ZWwsIExvZ2dlciB9IGZyb20gJy4vbG9nZ2VyJztcblxuZXhwb3J0IGNsYXNzIExldmVsVHJhbnNmb3JtTG9nZ2VyIGV4dGVuZHMgTG9nZ2VyIHtcbiAgY29uc3RydWN0b3IoXG4gICAgcHVibGljIG92ZXJyaWRlIHJlYWRvbmx5IG5hbWU6IHN0cmluZyxcbiAgICBwdWJsaWMgb3ZlcnJpZGUgcmVhZG9ubHkgcGFyZW50OiBMb2dnZXIgfCBudWxsID0gbnVsbCxcbiAgICBwdWJsaWMgcmVhZG9ubHkgbGV2ZWxUcmFuc2Zvcm06IChsZXZlbDogTG9nTGV2ZWwpID0+IExvZ0xldmVsLFxuICApIHtcbiAgICBzdXBlcihuYW1lLCBwYXJlbnQpO1xuICB9XG5cbiAgb3ZlcnJpZGUgbG9nKGxldmVsOiBMb2dMZXZlbCwgbWVzc2FnZTogc3RyaW5nLCBtZXRhZGF0YTogSnNvbk9iamVjdCA9IHt9KTogdm9pZCB7XG4gICAgcmV0dXJuIHN1cGVyLmxvZyh0aGlzLmxldmVsVHJhbnNmb3JtKGxldmVsKSwgbWVzc2FnZSwgbWV0YWRhdGEpO1xuICB9XG5cbiAgb3ZlcnJpZGUgY3JlYXRlQ2hpbGQobmFtZTogc3RyaW5nKTogTG9nZ2VyIHtcbiAgICByZXR1cm4gbmV3IExldmVsVHJhbnNmb3JtTG9nZ2VyKG5hbWUsIHRoaXMsIHRoaXMubGV2ZWxUcmFuc2Zvcm0pO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBMZXZlbENhcExvZ2dlciBleHRlbmRzIExldmVsVHJhbnNmb3JtTG9nZ2VyIHtcbiAgc3RhdGljIGxldmVsTWFwOiB7IFtjYXA6IHN0cmluZ106IHsgW2xldmVsOiBzdHJpbmddOiBzdHJpbmcgfSB9ID0ge1xuICAgIGRlYnVnOiB7IGRlYnVnOiAnZGVidWcnLCBpbmZvOiAnZGVidWcnLCB3YXJuOiAnZGVidWcnLCBlcnJvcjogJ2RlYnVnJywgZmF0YWw6ICdkZWJ1ZycgfSxcbiAgICBpbmZvOiB7IGRlYnVnOiAnZGVidWcnLCBpbmZvOiAnaW5mbycsIHdhcm46ICdpbmZvJywgZXJyb3I6ICdpbmZvJywgZmF0YWw6ICdpbmZvJyB9LFxuICAgIHdhcm46IHsgZGVidWc6ICdkZWJ1ZycsIGluZm86ICdpbmZvJywgd2FybjogJ3dhcm4nLCBlcnJvcjogJ3dhcm4nLCBmYXRhbDogJ3dhcm4nIH0sXG4gICAgZXJyb3I6IHsgZGVidWc6ICdkZWJ1ZycsIGluZm86ICdpbmZvJywgd2FybjogJ3dhcm4nLCBlcnJvcjogJ2Vycm9yJywgZmF0YWw6ICdlcnJvcicgfSxcbiAgICBmYXRhbDogeyBkZWJ1ZzogJ2RlYnVnJywgaW5mbzogJ2luZm8nLCB3YXJuOiAnd2FybicsIGVycm9yOiAnZXJyb3InLCBmYXRhbDogJ2ZhdGFsJyB9LFxuICB9O1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHB1YmxpYyBvdmVycmlkZSByZWFkb25seSBuYW1lOiBzdHJpbmcsXG4gICAgcHVibGljIG92ZXJyaWRlIHJlYWRvbmx5IHBhcmVudDogTG9nZ2VyIHwgbnVsbCA9IG51bGwsXG4gICAgcHVibGljIHJlYWRvbmx5IGxldmVsQ2FwOiBMb2dMZXZlbCxcbiAgKSB7XG4gICAgc3VwZXIobmFtZSwgcGFyZW50LCAobGV2ZWw6IExvZ0xldmVsKSA9PiB7XG4gICAgICByZXR1cm4gKExldmVsQ2FwTG9nZ2VyLmxldmVsTWFwW2xldmVsQ2FwXVtsZXZlbF0gfHwgbGV2ZWwpIGFzIExvZ0xldmVsO1xuICAgIH0pO1xuICB9XG59XG4iXX0=