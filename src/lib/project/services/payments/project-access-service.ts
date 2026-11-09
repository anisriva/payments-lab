import type { PrismaClient } from '@/generated/prisma';
import type { PrismaTransaction } from '@/lib/common/dao';

/** Access — computed, never stored. */
export class ProjectAccessService {
  constructor(private readonly prisma: PrismaClient | PrismaTransaction) {}

  /** No active offering → free; else a paid order, or a subscription that is
   *  active/trialing or canceled-but-inside-its-paid-period. */
  async hasAccess(args: {
    projectId: string;
    projectUserId: string;
    module: string;
    moduleItemId: string;
  }): Promise<boolean> {
    const { projectId, projectUserId, module, moduleItemId } = args;
    const offering = await this.prisma.projectOffering.findFirst({
      where: { projectId, module, moduleItemId, isActive: true },
    });
    if (!offering) return true;
    const now = new Date();
    const [paidOrder, subscription] = await Promise.all([
      this.prisma.projectOrder.findFirst({
        where: { projectId, projectUserId, status: 'paid', projectOfferingPrice: { offeringId: offering.id } },
      }),
      this.prisma.projectSubscription.findFirst({
        where: {
          projectId, projectUserId,
          projectOfferingPrice: { offeringId: offering.id },
          OR: [
            { status: { in: ['active', 'trialing'] } },
            { status: 'canceled', currentPeriodEnd: { gt: now } },
          ],
        },
      }),
    ]);
    return paidOrder !== null || subscription !== null;
  }
}
