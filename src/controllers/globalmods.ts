'use strict';

import user from '../user';
import meta from '../meta';
const analytics = require('../analytics');
const usersController = require('./admin/users');
import helpers from './helpers';

const globalModsController  = {} as any;

globalModsController.ipBlacklist = async function (req, res, next) {
	const isAdminOrGlobalMod = await user.isAdminOrGlobalMod(req.uid);
	if (!isAdminOrGlobalMod) {
		return next();
	}

	const [rules, analyticsData] = await Promise.all([
		meta.blacklist.get(),
		analytics.getBlacklistAnalytics(),
	]);
	res.render('ip-blacklist', {
		title: '[[pages:ip-blacklist]]',
		rules: rules,
		analytics: analyticsData,
		breadcrumbs: helpers.buildBreadcrumbs([{ text: '[[pages:ip-blacklist]]' }]),
	});
};


globalModsController.registrationQueue = async function (req, res, next) {
	const isAdminOrGlobalMod = await user.isAdminOrGlobalMod(req.uid);
	if (!isAdminOrGlobalMod) {
		return next();
	}
	await usersController.registrationQueue(req, res);
};