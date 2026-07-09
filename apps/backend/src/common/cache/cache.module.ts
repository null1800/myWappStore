import { Module, Global } from '@nestjs/common';
import { InProcessCacheService } from './cache.service';

@Global()
@Module({
  providers: [InProcessCacheService],
  exports: [InProcessCacheService],
})
export class CacheModule {}
