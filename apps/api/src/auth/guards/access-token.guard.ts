import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthenticatedUserDto } from '../dto/auth-response.dto';
import { TokenService } from '../token.service';
import { UsersService } from '../../users/users.service';

interface AuthenticatedRequest {
  headers: { authorization?: string };
  user?: AuthenticatedUserDto;
}

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly tokens: TokenService,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Access token is required');
    }

    const payload = this.tokens.verifyAccessToken(token);
    if (!payload) {
      throw new UnauthorizedException('Access token is invalid or expired');
    }

    const user = await this.users.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    request.user = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      emailVerified: user.emailVerified,
    };

    return true;
  }
}
