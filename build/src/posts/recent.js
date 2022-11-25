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
Object.defineProperty(exports, "__esModule", { value: true });
const _ = require('lodash');
const database = __importStar(require("../database"));
const db = database;
const privileges = require('../privileges');
function default_1(Posts) {
    const terms = {
        day: 86400000,
        week: 604800000,
        month: 2592000000,
    };
    Posts.getRecentPosts = function (uid, start, stop, term) {
        return __awaiter(this, void 0, void 0, function* () {
            let min = 0;
            if (terms[term]) {
                min = Date.now() - terms[term];
            }
            const count = parseInt(stop, 10) === -1 ? stop : stop - start + 1;
            let pids = yield db.getSortedSetRevRangeByScore('posts:pid', start, count, '+inf', min);
            pids = yield privileges.posts.filter('topics:read', pids, uid);
            return yield Posts.getPostSummaryByPids(pids, uid, { stripTags: true });
        });
    };
    Posts.getRecentPosterUids = function (start, stop) {
        return __awaiter(this, void 0, void 0, function* () {
            const pids = yield db.getSortedSetRevRange('posts:pid', start, stop);
            const postData = yield Posts.getPostsFields(pids, ['uid']);
            return _.uniq(postData.map(p => p && p.uid).filter(uid => parseInt(uid, 10)));
        });
    };
}
exports.default = default_1;
;
