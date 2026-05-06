/**
 * @module AppError
 * @description Custom error hierarchy.
 * Extending Error with domain-specific subclasses lets callers use
 * `instanceof ValidationError` instead of parsing message strings.
 */

export class AppError extends Error {
  constructor(message, code = 'APP_ERROR') {
    super(message);
    this.name      = this.constructor.name;
    this.code      = code;
    this.timestamp = Date.now();
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor);
  }
  toJSON() {
    return { name: this.name, code: this.code, message: this.message, timestamp: this.timestamp };
  }
}

export class ValidationError extends AppError {
  constructor(message, field = '') {
    super(message, 'VALIDATION_ERROR');
    this.field = field;
  }
}

export class StorageError extends AppError {
  constructor(message) { super(message, 'STORAGE_ERROR'); }
}

export class NotFoundError extends AppError {
  constructor(resource, id) {
    super(`${resource} "${id}" not found.`, 'NOT_FOUND');
    this.resource = resource; this.id = id;
  }
}
