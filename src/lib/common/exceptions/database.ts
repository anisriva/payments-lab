import { BaseException } from '@/lib/common/exceptions/base-exception';

/**
 * Thrown when a resource already exists (unique constraint violation)
 */
export class UniqueConstraintException extends BaseException {
  public readonly fields: string[];

  constructor(resource: string, fields: string[]) {
    const fieldStr = fields.join(', ');
    const message = `A ${resource} with the same ${fieldStr} already exists`;
    super(message);
    this.fields = fields;
  }
}

/**
 * Thrown when a resource is not found
 */
export class ResourceNotFoundException extends BaseException {
  constructor(resource: string, details?: string) {
    const message = details ? `${resource} not found: ${details}` : `${resource} not found`;
    super(message);
  }
}

/**
 * Thrown when a foreign key constraint is violated
 */
export class ForeignKeyConstraintException extends BaseException {
  public readonly field: string;

  constructor(resource: string, field: string) {
    const message = `Foreign key constraint failed on ${resource}.${field}`;
    super(message);
    this.field = field;
  }
}

/**
 * Thrown when a required value is not provided
 */
export class RequiredValueException extends BaseException {
  public readonly path: string;

  constructor(path: string) {
    const message = `Missing required value at ${path}`;
    super(message);
    this.path = path;
  }
}

/**
 * Thrown when a value is invalid for a field
 */
export class InvalidValueException extends BaseException {
  public readonly field: string;
  public readonly value: unknown;

  constructor(resource: string, field: string, value?: unknown) {
    const valueStr = value !== undefined ? ` (${String(value)})` : '';
    const message = `Invalid value${valueStr} for ${resource}.${field}`;
    super(message);
    this.field = field;
    this.value = value;
  }
}

/**
 * Thrown when a database operation fails
 */
export class DatabaseOperationException extends BaseException {
  public readonly operation: string;
  public readonly resource: string;
  public readonly cause?: unknown;

  constructor(operation: string, resource: string, cause?: unknown) {
    const message = `Failed to ${operation} ${resource}`;
    super(message);
    this.operation = operation;
    this.resource = resource;
    this.cause = cause;
  }
}

/**
 * Database Exception
 * Maps Prisma errors to appropriate exception instances
 */
export class DatabaseException {
  constructor(error: unknown, resourceName: string) {
    return DatabaseException.createException(error, resourceName);
  }
  /**
   * Create an appropriate exception from a Prisma error
   */
  private static createException(error: unknown, resourceName: string): BaseException {
    // Extract error details if it's a Prisma error
    const errorDetails = this.extractPrismaErrorDetails(error);

    if (!errorDetails) {
      // Not a Prisma error or unrecognized format
      return new DatabaseOperationException('execute operation on', resourceName, error);
    }

    const { code, meta } = errorDetails;

    /**
     * Prisma error codes enum
     */
    const prismaErrorCodes = {
      // Common errors
      UNIQUE_CONSTRAINT: 'P2002',
      FOREIGN_KEY_CONSTRAINT: 'P2003',
      NOT_FOUND: 'P2025',
      REQUIRED_VALUE_NOT_PROVIDED: 'P2012',
      FIELD_TOO_LONG: 'P2000',
      NULL_CONSTRAINT: 'P2011',
      RELATION_VIOLATION: 'P2014',
      TABLE_NOT_FOUND: 'P2021',
      COLUMN_NOT_FOUND: 'P2022',
      INVALID_VALUE: 'P2006',
      CONNECTION_TIMEOUT: 'P2024',
      TRANSACTION_ERROR: 'P2028',
      QUERY_VALIDATION_ERROR: 'P2009',
      MULTIPLE_ERRORS: 'P2027',
    };

    // Handle specific error codes
    switch (code) {
      case prismaErrorCodes.UNIQUE_CONSTRAINT:
        return this.handleUniqueConstraint(resourceName, meta);

      case prismaErrorCodes.NOT_FOUND:
        return this.handleNotFound(resourceName, meta);

      case prismaErrorCodes.FOREIGN_KEY_CONSTRAINT:
        return this.handleForeignKeyConstraint(resourceName, meta);

      case prismaErrorCodes.REQUIRED_VALUE_NOT_PROVIDED:
        return this.handleRequiredValue(meta);

      case prismaErrorCodes.INVALID_VALUE:
        return this.handleInvalidValue(resourceName, meta);

      case prismaErrorCodes.NULL_CONSTRAINT:
        return this.handleNullConstraint(resourceName, meta);

      default:
        // For other error codes, create a generic database operation exception
        return new DatabaseOperationException('execute operation on', resourceName, {
          code,
          meta,
          originalError: error,
        });
    }
  }

  /**
   * Extract Prisma error details
   */
  private static extractPrismaErrorDetails(
    error: unknown
  ): { code: string; meta: Record<string, unknown> } | null {
    if (
      error instanceof Error &&
      'code' in error &&
      typeof error.code === 'string' &&
      'meta' in error &&
      error.meta &&
      typeof error.meta === 'object'
    ) {
      return {
        code: error.code,
        meta: error.meta as Record<string, unknown>,
      };
    }
    return null;
  }

  /**
   * Handle unique constraint violations (P2002)
   */
  private static handleUniqueConstraint(
    resourceName: string,
    meta: Record<string, unknown>
  ): UniqueConstraintException {
    const target = meta['target'];
    const fields = Array.isArray(target)
      ? (target as unknown[]).map(v => String(v))
      : typeof target === 'string'
        ? [target]
        : ['unknown field'];

    return new UniqueConstraintException(resourceName, fields);
  }

  /**
   * Handle not found errors (P2025)
   */
  private static handleNotFound(
    resourceName: string,
    meta: Record<string, unknown>
  ): ResourceNotFoundException {
    const cause = meta['cause'];
    const details = cause !== undefined ? String(cause) : undefined;
    return new ResourceNotFoundException(resourceName, details);
  }

  /**
   * Handle foreign key constraint errors (P2003)
   */
  private static handleForeignKeyConstraint(
    resourceName: string,
    meta: Record<string, unknown>
  ): ForeignKeyConstraintException {
    const fieldName = meta['field_name'];
    const field = typeof fieldName === 'string' ? fieldName : 'unknown field';
    return new ForeignKeyConstraintException(resourceName, field);
  }

  /**
   * Handle required value errors (P2012)
   */
  private static handleRequiredValue(meta: Record<string, unknown>): RequiredValueException {
    const rawPath = meta['path'];
    const path = typeof rawPath === 'string' ? rawPath : 'unknown path';
    return new RequiredValueException(path);
  }

  /**
   * Handle invalid value errors (P2006)
   */
  private static handleInvalidValue(
    resourceName: string,
    meta: Record<string, unknown>
  ): InvalidValueException {
    const fieldName = meta['field_name'];
    const field = typeof fieldName === 'string' ? fieldName : 'unknown field';
    const value = meta['field_value'];
    return new InvalidValueException(resourceName, field, value);
  }

  /**
   * Handle null constraint errors (P2011)
   */
  private static handleNullConstraint(
    resourceName: string,
    meta: Record<string, unknown>
  ): InvalidValueException {
    const raw = meta['constraint'];
    const constraint = typeof raw === 'string' ? raw : 'unknown field';
    return new InvalidValueException(resourceName, constraint, null);
  }
}
