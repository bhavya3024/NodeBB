'use strict';

import * as database from '../../database';
const db = database as any;

export default  {
	name: 'Set default allowed file extensions',
	timestamp: Date.UTC(2017, 3, 14),
	method: function (callback) {
		db.getObjectField('config', 'allowedFileExtensions', (err, value) => {
			if (err || value) {
				return callback(err);
			}
			db.setObjectField('config', 'allowedFileExtensions', 'png,jpg,bmp', callback);
		});
	},
};
