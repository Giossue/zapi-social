import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EmailModule } from '../email/email.module';
import { IdentityController } from './identity.controller';
import { IdentityService } from './identity.service';
import { PasswordResetService } from './password-reset.service';
import { PortalProfileController } from './portal-profile.controller';
import { PortalProfileService } from './portal-profile.service';
import { SessionAccessService } from './session-access.service';

@Module({
  imports: [
    EmailModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  controllers: [IdentityController, PortalProfileController],
  providers: [
    IdentityService,
    PasswordResetService,
    SessionAccessService,
    PortalProfileService,
  ],
  exports: [IdentityService, PasswordResetService, SessionAccessService],
})
export class IdentityModule {}
