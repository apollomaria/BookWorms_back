import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

// Rotas de autenticação: tudo aqui começa com /auth.
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // POST /auth/login -> RF 006.
  // @HttpCode(200): login não "cria" nada, então responde 200 (e não 201).
  @Post('login')
  @HttpCode(200)
  login(@Body() dados: LoginDto) {
    return this.authService.login(dados);
  }
}
