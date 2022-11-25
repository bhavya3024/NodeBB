'use strict';

import * as database from '../../database';
const db = database as any;
import meta from '../../meta';


export default  {
	name: 'Update registration type',
	timestamp: Date.UTC(2019, 5, 4),
	method: function (callback) {
		const registrationType = meta.config.registrationType || 'normal';
		if (registrationType === 'admin-approval' || registrationType === 'admin-approval-ip') {
			db.setObject('config', {
				registrationType: 'normal',
				registrationApprovalType: registrationType,
			}, callback);
		} else {
			setImmediate(callback);
		}
	},
};
