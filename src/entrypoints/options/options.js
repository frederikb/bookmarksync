// eslint-disable-next-line import/no-unassigned-import
import 'webext-base-css';
import './options.css';
import optionsStorage from '@/utils/options-storage.js';

async function init() {
	await optionsStorage.syncForm('#options-form');
}

init();
