'use strict';
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database = __importStar(require("../../database"));
const db = database;
const batch = require('../../batch');
const posts = require('../../posts');
const user_1 = __importDefault(require("../../user"));
exports.default = {
    name: 'Consolidate multiple flags reports, going forward',
    timestamp: Date.UTC(2020, 6, 16),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const { progress } = this;
            let flags = yield db.getSortedSetRange('flags:datetime', 0, -1);
            flags = flags.map(flagId => `flag:${flagId}`);
            flags = yield db.getObjectsFields(flags, ['flagId', 'type', 'targetId', 'uid', 'description', 'datetime']);
            progress.total = flags.length;
            yield batch.processArray(flags, (subset) => __awaiter(this, void 0, void 0, function* () {
                progress.incr(subset.length);
                yield Promise.all(subset.map((flagObj) => __awaiter(this, void 0, void 0, function* () {
                    const methods = [];
                    switch (flagObj.type) {
                        case 'post':
                            methods.push(posts.setPostField.bind(posts, flagObj.targetId, 'flagId', flagObj.flagId));
                            break;
                        case 'user':
                            methods.push(user_1.default.setUserField.bind(user_1.default, flagObj.targetId, 'flagId', flagObj.flagId));
                            break;
                    }
                    methods.push(db.sortedSetAdd.bind(db, `flag:${flagObj.flagId}:reports`, flagObj.datetime, String(flagObj.description).slice(0, 250)), db.sortedSetAdd.bind(db, `flag:${flagObj.flagId}:reporters`, flagObj.datetime, flagObj.uid));
                    yield Promise.all(methods.map((method) => __awaiter(this, void 0, void 0, function* () { return method(); })));
                })));
            }), {
                progress: progress,
                batch: 500,
            });
        });
    },
};
