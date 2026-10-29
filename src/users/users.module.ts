import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { DatabaseModule } from '../database/database.module';

// Módulo = uma "caixa" que agrupa controller + service de um assunto (usuários).
// `imports` traz o DatabaseModule para que o UsersService possa receber o
// DatabaseService por injeção de dependência.
@Module({
  imports: [DatabaseModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
