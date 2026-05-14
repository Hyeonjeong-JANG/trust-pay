import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminAuthGuard, type AdminUser } from './admin-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { adminRefundReviewListSchema, adminRequestMerchantResponseSchema, adminResolveRefundReviewSchema, type AdminRefundReviewListInput, type AdminRequestMerchantResponseInput, type AdminResolveRefundReviewInput } from '@prepaid-shield/validators';

@Controller('admin')
@UseGuards(AdminAuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

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
