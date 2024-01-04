import './popup.css';
import logo from '@/assets/bookmarksync-icon.svg';
import {getSyncBookmarks} from '@/utils/bookmarksync.js';

const syncBookmarks = getSyncBookmarks();

document.querySelector('#bookmarksync-logo').src = logo;

const syncButton = document.querySelector('#sync-now');
syncButton.addEventListener('click', async () => {
	console.log('Manual sync triggered');
	const originalText = syncButton.textContent;
	syncButton.textContent = 'Synchronizing...';
	syncButton.disabled = true;
	try {
		await syncBookmarks(true);
	} catch (error) {
		console.error('Error triggering manual bookmark sync:', error);
	} finally {
		syncButton.disabled = false;
		syncButton.textContent = originalText;
	}
});
