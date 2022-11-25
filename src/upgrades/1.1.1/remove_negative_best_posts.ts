'use strict';


const async = require('async');
import winston from 'winston';
import { primaryDB as db } from '../../database';

export default  {
	name: 'Removing best posts with negative scores',
	timestamp: Date.UTC(2016, 7, 5),
	method: function (callback) {
		const batch = require('../../batch');
		batch.processSortedSet('users:joindate', (ids, next) => {
			async.each(ids, (id, next) => {
				winston.verbose(`processing uid ${id}`);
				db.sortedSetsRemoveRangeByScore([`uid:${id}:posts:votes`], '-inf', 0, next);
			}, next);
		}, {}, callback);
	},
};