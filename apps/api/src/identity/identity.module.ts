import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { IdentityController } from './identity.controller'
import { IdentityService } from './identity.service'
import { SessionAccessService } from './session-access.service'

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  controllers: [IdentityController],
  providers: [IdentityService, SessionAccessService],
  exports: [IdentityService, SessionAccessService],
})
export class IdentityModule {}
