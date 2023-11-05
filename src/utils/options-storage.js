import OptionsSync from 'webext-options-sync';

const optionsStorage = new OptionsSync({
	defaults: {
		pat: '',
		owner: '',
		repo: '',
		sourcePath: '',
	},
	migrations: [
		OptionsSync.migrations.removeUnused,
	],
	logging: true,
	storageType: 'local',
});

export default optionsStorage;
