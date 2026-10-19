import { Body, Controller, Get, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('teste-conexao')
  testarConexao() {
    return this.usersService.testarConexao();
  }

  @Post()
  cadastrar(@Body() dados: CreateUserDto){
    return this.usersService.cadastrar(dados);
  }
}
