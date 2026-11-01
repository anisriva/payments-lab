import { BaseException } from '@/lib/common/exceptions';

/*
 ** Platform user not found
 */
export class PlatformUserNotFoundException extends BaseException {
  constructor(platformUserName: string) {
    super(`Platform user [${platformUserName}] not found`);
  }
}

export class PlatformUserSessionNotFoundException extends BaseException {
  constructor() {
    super(`Platform user session not found`);
  }
}

export class ProjectUserSessionNotFoundException extends BaseException {
  constructor() {
    super(`Project user session not found`);
  }
}

export class ProjectNotFoundException extends BaseException {
  constructor(subdomain: string) {
    super(`Project with subdomain [${subdomain}] not found`);
  }
}

export class UnauthorizedException extends BaseException {
  constructor(message = 'Unauthorized') {
    super(message);
  }
}

export class ForbiddenException extends BaseException {
  constructor(message = 'Forbidden') {
    super(message);
  }
}

export class AdminUserNotFoundException extends BaseException {
  constructor(email: string) {
    super(`Admin user with email [${email}] not found`);
  }
}
