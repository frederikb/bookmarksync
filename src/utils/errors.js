class AuthenticationError extends Error {
	constructor(message, originalError) {
		super(message);
		this.name = 'AuthenticationError';
		this.originalError = originalError;
	}
}

class DataNotFoundError extends Error {
	constructor(message, originalError) {
		super(message);
		this.name = 'DataNotFoundError';
		this.originalError = originalError;
	}
}

class BookmarksDataNotValidError extends Error {
	constructor(message) {
		super(message);
		this.name = 'BookmarksDataNotValidError';
	}
}

export {AuthenticationError, DataNotFoundError, BookmarksDataNotValidError};
