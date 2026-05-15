import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminAuthGuard, type AdminUser } from './admin-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { adminListQuerySchema, adminRefundReviewListSchema, adminRequestMerchantResponseSchema, adminResolveRefundReviewSchema, type AdminListQueryInput, type AdminRefundReviewListInput, type AdminRequestMerchantResponseInput, type AdminResolveRefundReviewInput } from '@prepaid-shield/validators';

@Controller('admin')
@UseGuards(AdminAuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  getDashboard(@Req() req: { user: AdminUser }) {
    return this.adminService.getDashboard(req.user);
  }

  @Get('businesses')
  listBusinesses(
    @Query(new ZodValidationPipe(adminListQuerySchema)) query: AdminListQueryInput,
    @Req() req: { user: AdminUser },
  ) {
    return this.adminService.listBusinesses(req.user, query);
  }

  @Get('consumers')
  listConsumers(
    @Query(new ZodValidationPipe(adminListQuerySchema)) query: AdminListQueryInput,
    @Req() req: { user: AdminUser },
  ) {
    return this.adminService.listConsumers(req.user, query);
  }

  @Get('escrows')
  listEscrows(
    @Query(new ZodValidationPipe(adminListQuerySchema)) query: AdminListQueryInput,
    @Req() req: { user: AdminUser },
  ) {
    return this.adminService.listEscrows(req.user, query);
  }

  @Get('refund-reviews')
  listRefundReviews(
    @Query(new ZodValidationPipe(adminRefundReviewListSchema)) query: AdminRefundReviewListInput,
    @Req() req: { user: AdminUser },
  ) {
    return this.adminService.listRefundReviews(req.user, query);
  }

  @Get('refund-reviews/:id')
  getRefundReview(@Param('id') id: string, @Req() req: { user: AdminUser }) {
    return this.adminService.getRefundReview(req.user, id);
  }

  @Post('refund-reviews/:id/request-merchant-response')
  requestMerchantResponse(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(adminRequestMerchantResponseSchema)) body: AdminRequestMerchantResponseInput,
    @Req() req: { user: AdminUser },
  ) {
    return this.adminService.requestMerchantResponse(req.user, id, body);
  }

  @Post('refund-reviews/:id/resolve')
  resolveRefundReview(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(adminResolveRefundReviewSchema)) body: AdminResolveRefundReviewInput,
    @Req() req: { user: AdminUser },
  ) {
    return this.adminService.resolveRefundReview(req.user, id, body);
  }
}
