import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CreateReadingLogDto } from './dto/create-reading-log.dto';
import { UpdateReadingLogDto } from './dto/update-reading-log.dto';
import { ReadingLogsService } from './reading-logs.service';

/**
 * Rotas do UC002. Nesta versão não há token: quem faz o pedido informa o próprio
 * `usuarioId` (corpo no POST/PUT, query string no GET/DELETE) e o service confere se
 * o registro pertence a esse usuário.
 */
@Controller('reading-logs')
export class ReadingLogsController {
  constructor(private readonly readingLogsService: ReadingLogsService) {}

  // POST /reading-logs                         -> RF 010
  @Post()
  criar(@Body() dados: CreateReadingLogDto) {
    return this.readingLogsService.criar(dados);
  }

  // GET /reading-logs/user/:usuarioId          -> RF 011 (lista)
  @Get('user/:usuarioId')
  listar(@Param('usuarioId', ParseIntPipe) usuarioId: number) {
    return this.readingLogsService.listar(usuarioId);
  }

  // GET /reading-logs/:id?usuarioId=1          -> RF 011 (detalhe)
  @Get(':id')
  detalhar(
    @Param('id', ParseIntPipe) id: number,
    @Query('usuarioId', ParseIntPipe) usuarioId: number,
  ) {
    return this.readingLogsService.detalhar(id, usuarioId);
  }

  // PUT /reading-logs/:id                      -> RF 012
  @Put(':id')
  atualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dados: UpdateReadingLogDto,
  ) {
    return this.readingLogsService.atualizar(id, dados);
  }

  // DELETE /reading-logs/:id?usuarioId=1       -> RF 013
  @Delete(':id')
  excluir(
    @Param('id', ParseIntPipe) id: number,
    @Query('usuarioId', ParseIntPipe) usuarioId: number,
  ) {
    return this.readingLogsService.excluir(id, usuarioId);
  }
}
