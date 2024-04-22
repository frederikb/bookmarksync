import OptionsSync from 'webext-options-sync';

const optionsStorage = new OptionsSync({
	/* eslint-disable camelcase */
	defaults: {
		// Source 1
		source1_useCustomHost: false,
		source1_githubApiUrl: '',
		source1_pat: '',
		source1_owner: '',
		source1_repo: '',
		source1_sourcePath: '',
		source1_etag: '',
		// Source 2
		source2_active: false,
		source2_useCustomHost: false,
		source2_githubApiUrl: '',
		source2_pat: '',
		source2_owner: '',
		source2_repo: '',
		source2_sourcePath: '',
		source2_etag: '',
	},
	/* eslint-enable camelcase */
	migrations: [
		(savedOptions, defaults) => { // eslint-disable-line no-unused-vars
			migrateTo(savedOptions, 'useCustomHost');
			migrateTo(savedOptions, 'githubApiUrl');
			migrateTo(savedOptions, 'pat');
			migrateTo(savedOptions, 'owner');
			migrateTo(savedOptions, 'repo');
			migrateTo(savedOptions, 'sourcePath');
			migrateTo(savedOptions, 'etag');
		},
		OptionsSync.migrations.removeUnused,
	],
	logging: true,
	storageType: 'local',
});

function migrateTo(options, oldPropertyName) {
	if (!options[oldPropertyName]) {
		return;
	}

	const newPropertyName = `source1_${oldPropertyName}`;
	if (options[newPropertyName]) {
		return;
	}

	options[newPropertyName] = options[oldPropertyName];
	delete options[oldPropertyName];
}

export default optionsStorage;
