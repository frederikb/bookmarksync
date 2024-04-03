// eslint-disable-next-line import/no-unassigned-import
import 'webext-base-css';
import './options.css';
import optionsStorage from '@/utils/options-storage.js';
import {getSyncBookmarks} from '@/utils/bookmarksync.js';

const bookmarkSyncService = getSyncBookmarks();

/**
 * @typedef {'success' | 'error' | 'in-progress' | null} CheckStatus
 */

async function init() {
	await optionsStorage.syncForm('#options-form');

	const form = document.querySelector('#options-form');
	const checkConnectionButton = document.querySelector('#check-connection-btn');
	const connectionMessage = document.querySelector('#connection-message');

	let isChecking = false;
	let cancelCurrentCheck = false;

	/**
     * Displays a connection message.
	 * @param {CheckStatus} status - The status of the connection check.
     * @param {string} message - The message to display.
     */
	const showConnectionMessage = (status, message) => {
		connectionMessage.textContent = message;
		connectionMessage.className = status || '';
		connectionMessage.classList.remove('hidden');
	};

	/**
     * Clear the connection message display.
     */
	const clearConnectionMessage = () => {
		connectionMessage.textContent = '';
		connectionMessage.className = '';
		connectionMessage.classList.add('hidden');
	};

	/**
     * Updates the text and appearance of the check connection button given a status.
     * @param {CheckStatus} status - The status of the connection check.
     */
	const updateButton = status => {
		checkConnectionButton.className = status || '';
		checkConnectionButton.textContent = status === 'in-progress' ? 'Checking…' : 'Check Connection';
		checkConnectionButton.disabled = status === 'in-progress' || !form.checkValidity();
	};

	const resetCheckConnection = () => {
		if (!isChecking) {
			updateButton(null);
			clearConnectionMessage();
		}
	};

	checkConnectionButton.addEventListener('click', async () => {
		if (!form.checkValidity() || isChecking) {
			return;
		}

		isChecking = true;
		cancelCurrentCheck = false;
		clearConnectionMessage();
		updateButton('in-progress');

		try {
			await bookmarkSyncService.validateBookmarks();
			if (cancelCurrentCheck) {
				updateButton(null);
				return;
			}

			updateButton('success');
			showConnectionMessage('success', 'Success');
		} catch (error) {
			if (cancelCurrentCheck) {
				updateButton(null);
				return;
			}

			updateButton('error');
			showConnectionMessage('error', error.message);
		} finally {
			isChecking = false;
			cancelCurrentCheck = false;
		}
	});

	form.addEventListener('options-sync:form-synced', () => {
		cancelCurrentCheck = true;
		resetCheckConnection();
	});

	resetCheckConnection();
}

init();
