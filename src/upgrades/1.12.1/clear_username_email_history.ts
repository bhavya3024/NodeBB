'use strict';

const async = require('async');
import * as database from '../../database';
const db = database as any;
import user from '../../user';

export default  {
	name: 'Delete username email history for deleted users',
	timestamp: Date.UTC(2019, 2, 25),
	method: function (callback) {
		const { progress } = this as any;
		let currentUid = 1;
		db.getObjectField('global', 'nextUid', (err, nextUid) => {
			if (err) {
				return callback(err);
			}
			progress.total = nextUid;
			async.whilst((next) => {
				next(null, currentUid < nextUid);
			},
			(next) => {
				progress.incr();
				user.exists(currentUid, (err, exists) => {
					if (err) {
						return next(err);
					}
					if (exists) {
						currentUid += 1;
						return next();
					}
					db.deleteAll([`user:${currentUid}:usernames`, `user:${currentUid}:emails`], (err) => {
						if (err) {
							return next(err);
						}
						currentUid += 1;
						next();
					});
				});
			},
			(err) => {
				callback(err);
			});
		});
	},
};
