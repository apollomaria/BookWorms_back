import { Body, Controller, Get, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';

/**
 * CONTROLLER = a "porta de entrada" HTTP. Ele recebe a requisição, entrega os
 * dados ao service e devolve a resposta. Não contém regras de negócio.
 *
 * @Controller('users') -> todas as rotas desta classe começam com /users.
 * Injeção de dependência: o Nest entrega o UsersService pronto no construtor.
 */
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // GET /users/teste-conexao  (já existia; diagnóstico fora do UC001)
  @Get('teste-conexao')
  testarConexao() {
    return this.usersService.testarConexao();
  }

  // POST /users  -> UC001 / RF 001: cria uma conta.
  // @Body() pega o JSON do corpo e, graças ao ValidationPipe, já o entrega
  // validado como CreateUserDto. Se a validação falhar, este método nem roda.
  // O Nest responde 201 (Created) por padrão em POST quando não há exceção.
  // Se o service lançar uma exceção (ex.: ConflictException), o Nest a converte
  // automaticamente em resposta HTTP (ex.: 409).
  @Post()
  cadastrar(@Body() dados: CreateUserDto) {
    return this.usersService.cadastrar(dados);
  }

  
}
