import { Controller, Get, Req } from '@nestjs/common';
import { Request } from 'express';
import { StudentPayload } from '../auth/interfaces/student-payload.interface';
import { DashboardService } from './dashboard.service';

type AuthenticatedRequest = Request & { user: StudentPayload };

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  getDashboard(@Req() request: AuthenticatedRequest) {
    return this.dashboardService.getDashboard(request.user.studentId);
  }
}
