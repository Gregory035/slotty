import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUserDto } from '../dto/auth-response.dto';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUserDto => {
    const request = context
      .switchToHttp()
      .getRequest<{ user: AuthenticatedUserDto }>();

    return request.user;
  },
);
