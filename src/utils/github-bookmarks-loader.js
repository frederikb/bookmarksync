import {Octokit} from '@octokit/rest';
import {retry} from '@octokit/plugin-retry';
import optionsStorage from '@/utils/options-storage.js';
import {AuthenticationError, DataNotFoundError} from '@/utils/errors.js';

class GitHubBookmarksLoader {
	constructor() {
		this.etag = null;
	}

	async load(force = false) {
		try {
			const {repo, owner, pat, sourcePath} = await optionsStorage.getAll();

			if (!repo || !owner || !sourcePath || !pat) {
				// Do not error out - perhaps the user just didn't yet set it up
				console.log('Sync from GitHub - required configuration values not set');
				return null;
			}

			const MyOctokit = Octokit.plugin(retry);
			const octokit = new MyOctokit({auth: pat});

			console.info(`Starting sync with GitHub using ${owner}/${repo}/${sourcePath}`);
			const response = await octokit.rest.repos.getContent({
				owner,
				repo,
				path: sourcePath,
				mediaType: {
					format: sourcePath.endsWith('.json') ? 'raw' : 'json',
				},
				headers: this.etag && !force ? {'If-None-Match': this.etag} : {},
			});

			let bookmarkFileResponses = [];
			if (Array.isArray(response.data)) {
				if (response.data.length === 0) {
					throw new DataNotFoundError('No bookmark data found in folder.');
				}

				const files = response.data
					.filter(item => item.type === 'file')
					.filter(file => file.name.endsWith('.json'));
				const contentPromises = files.map(file => octokit.rest.repos.getContent({
					owner,
					repo,
					path: file.path,
					mediaType: {
						format: 'raw',
					},
				}));

				bookmarkFileResponses = await Promise.all(contentPromises);
			} else {
				bookmarkFileResponses = [response];
			}

			const bookmarks = bookmarkFileResponses
				.flatMap(file => JSON.parse(file.data).bookmarks);

			this.etag = response.headers.etag;
			return bookmarks;
		} catch (error) {
			if (error.status === 304) {
				console.log('No changes detected in bookmarks - nothing to sync');
				return null;
			}

			if (error.status === 401) {
				throw new AuthenticationError('Authentication with GitHub failed. Please check your PAT.', error);
			} else if (error.status === 404) {
				throw new DataNotFoundError('The specified bookmarks file or folder was not found.', error);
			} else {
				throw error;
			}
		}
	}
}

export default GitHubBookmarksLoader;
