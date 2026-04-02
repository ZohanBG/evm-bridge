import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { 
  IsOptional, 
  IsInt, 
  Min, 
  Max, 
  IsEnum, 
  IsEthereumAddress, 
  IsPositive, 
  IsString, 
  Matches, 
  IsBoolean 
} from 'class-validator';
import { BridgeEventType } from '@prisma/client';

export class QueryEventsDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1, minimum: 1, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ 
    description: 'Number of items per page', 
    default: 20, 
    minimum: 1, 
    maximum: 50,
    example: 20 
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Chain ID', example: 31337 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  chainId?: number;

  @ApiPropertyOptional({ description: 'Target chain ID', example: 31338 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  targetChainId?: number;

  @ApiPropertyOptional({ description: 'Source chain ID', example: 31337 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  sourceChainId?: number;

  @ApiPropertyOptional({ 
    description: 'Token address (case-insensitive)', 
    example: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512' 
  })
  @IsOptional()
  @IsEthereumAddress({ message: 'tokenAddress must be a valid Ethereum address' })
  tokenAddress?: string;

  @ApiPropertyOptional({ 
    description: 'User address (case-insensitive)', 
    example: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' 
  })
  @IsOptional()
  @IsEthereumAddress({ message: 'userAddress must be a valid Ethereum address' })
  userAddress?: string;

  @ApiPropertyOptional({ 
    enum: BridgeEventType, 
    description: 'Event type filter',
    example: BridgeEventType.TOKEN_LOCKED
  })
  @IsOptional()
  @IsEnum(BridgeEventType, { message: 'eventType must be a valid BridgeEventType' })
  eventType?: BridgeEventType;

  @ApiPropertyOptional({ 
    description: 'Only return unprocessed events', 
    default: false,
    type: Boolean
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  unprocessedOnly?: boolean = false;
}

export class WalletAddressDto {
  @IsEthereumAddress({ message: 'address must be a valid Ethereum address' })
  address!: string;
}

export class TransactionHashDto {
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{64}$/, {
    message: 'txHash must be a valid Ethereum transaction hash (0x + 64 hex characters)',
  })
  txHash!: string;
}