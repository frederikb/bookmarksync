import OptionsSync from 'webext-options-sync';

const optionsStorage = new OptionsSync({
	defaults: {
		useCustomHost: false,
		githubApiUrl: '',
		pat: '',
		owner: '',
		repo: '',
		sourcePath: '',
		etag: '',
	},
	migrations: [
		OptionsSync.migrations.removeUnused,
	],
	logging: true,
	storageType: 'local',
});

export default optionsStorage;
