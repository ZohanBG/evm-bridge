import { 
  Controller, 
  Get, 
  Query, 
  Param, 
  HttpCode, 
  HttpStatus,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiParam,
} from '@nestjs/swagger';
import { BridgeService } from './bridge.service';
import { QueryEventsDto, WalletAddressDto, TransactionHashDto } from './dto/query-events.dto';
import { ThrottlerGuard } from '@nestjs/throttler';

@ApiTags('bridge')
@Controller('bridge')
@UseGuards(ThrottlerGuard)
export class BridgeController {
  constructor(private readonly bridgeService: BridgeService) {}

  @Get('pending/claims')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all tokens waiting to be claimed (TokenLocked events)' })
  @ApiResponse({ status: 200, description: 'Returns paginated list of pending claims' })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async getPendingClaims(
    @Query(new ValidationPipe({ transform: true })) queryDto: QueryEventsDto
  ) {
    return this.bridgeService.getTokensWaitingToClaim(queryDto);
  }

  @Get('pending/releases')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all tokens waiting to be released (TokenBurned events)' })
  @ApiResponse({ status: 200, description: 'Returns paginated list of pending releases' })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async getPendingReleases(
    @Query(new ValidationPipe({ transform: true })) queryDto: QueryEventsDto
  ) {
    return this.bridgeService.getTokensWaitingToRelease(queryDto);
  }

  @Get('wallet/:address')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all bridged tokens by wallet address' })
  @ApiParam({ 
    name: 'address', 
    description: 'Ethereum wallet address', 
    example: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' 
  })
  @ApiResponse({ status: 200, description: 'Returns paginated list of bridge events for wallet' })
  @ApiResponse({ status: 400, description: 'Invalid wallet address' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async getBridgedTokensByWallet(
    @Param(new ValidationPipe()) walletDto: WalletAddressDto,
    @Query(new ValidationPipe({ transform: true })) queryDto: QueryEventsDto,
  ) {
    return this.bridgeService.getBridgedTokensByWallet(walletDto, queryDto);
  }

  @Get('tokens')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all unique bridged ERC-20 tokens' })
  @ApiResponse({ status: 200, description: 'Returns list of all bridged tokens with statistics' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async getAllBridgedTokens(
    @Query(new ValidationPipe({ transform: true })) queryDto: QueryEventsDto
  ) {
    return this.bridgeService.getAllBridgedTokens(queryDto);
  }

  @Get('transaction/:txHash')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get bridge event by transaction hash' })
  @ApiParam({ 
    name: 'txHash', 
    description: 'Ethereum transaction hash', 
    example: '0x4fe1ef19ecc9089a49d202a16b2df8b7ba62c9f45cb6288d572a712e816a115c' 
  })
  @ApiResponse({ status: 200, description: 'Returns bridge event details' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async getEventByTxHash(
    @Param(new ValidationPipe()) params: TransactionHashDto,
    @Query('chainId') chainId?: number,
  ) {
    return this.bridgeService.getEventByTxHash(params.txHash, chainId);
  }

  @Get('statistics')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get bridge statistics' })
  @ApiResponse({ status: 200, description: 'Returns bridge statistics' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async getBridgeStatistics(@Query('chainId') chainId?: number) {
    return this.bridgeService.getBridgeStatistics(chainId);
  }
}