import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  adminPlansQuerySchema,
  createAdminPlanSchema,
  updateAdminPlanSchema,
  type AdminPlan,
  type AdminPlansList,
  type AuthSession,
  type CreateAdminPlanInput,
} from '@workspace/contracts';
import { plans, workspacePlanAssignments } from '@workspace/database';
import { and, asc, eq, sql } from '@workspace/database/query';
import { z } from 'zod';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class PlansService {
  constructor(private readonly database: DatabaseService) {}

  async list(query: unknown): Promise<AdminPlansList> {
    const filters = this.parse(adminPlansQuerySchema.safeParse(query));
    const rows = await this.database.db
      .select({
        plan: plans,
        subscriberCount: sql<number>`count(${workspacePlanAssignments.id})::int`,
      })
      .from(plans)
      .leftJoin(
        workspacePlanAssignments,
        eq(workspacePlanAssignments.planId, plans.id),
      )
      .where(
        and(
          filters.q
            ? sql`${plans.name} ilike ${`%${filters.q}%`} or ${plans.slug} ilike ${`%${filters.q}%`}`
            : undefined,
          filters.status ? eq(plans.status, filters.status) : undefined,
          filters.billingType
            ? eq(plans.billingType, filters.billingType)
            : undefined,
          filters.featured
            ? eq(plans.featured, filters.featured === 'true')
            : undefined,
        ),
      )
      .groupBy(plans.id)
      .orderBy(asc(plans.position), asc(plans.createdAt));

    return {
      plans: rows.map((row) => this.serialize(row.plan, row.subscriberCount)),
    };
  }

  async create(session: AuthSession, input: unknown): Promise<AdminPlan> {
    const values = this.parse(createAdminPlanSchema.safeParse(input));
    await this.assertAvailable(values);

    const [plan] = await this.database.db
      .insert(plans)
      .values({
        ...values,
        price: String(values.price),
        createdByUserId: session.user.id,
        updatedByUserId: session.user.id,
      })
      .returning();

    if (!plan) throw new BadRequestException();
    return this.serialize(plan);
  }

  async update(
    session: AuthSession,
    id: string,
    input: unknown,
  ): Promise<AdminPlan> {
    const planId = this.parseId(id);
    const values = this.parse(updateAdminPlanSchema.safeParse(input));
    await this.assertAvailable(values, planId);

    const [plan] = await this.database.db
      .update(plans)
      .set({
        ...values,
        price: String(values.price),
        updatedByUserId: session.user.id,
        updatedAt: new Date(),
      })
      .where(eq(plans.id, planId))
      .returning();

    if (!plan) throw new NotFoundException();
    return this.serialize(plan);
  }

  async remove(session: AuthSession, id: string): Promise<void> {
    void session;
    const planId = this.parseId(id);
    const [assignment] = await this.database.db
      .select({ id: workspacePlanAssignments.id })
      .from(workspacePlanAssignments)
      .where(eq(workspacePlanAssignments.planId, planId))
      .limit(1);
    if (assignment) {
      throw new ConflictException('Plan has subscribers');
    }
    const [plan] = await this.database.db
      .delete(plans)
      .where(eq(plans.id, planId))
      .returning({ id: plans.id });

    if (!plan) throw new NotFoundException();
  }

  private async assertAvailable(
    values: CreateAdminPlanInput,
    excludedPlanId?: string,
  ) {
    const [[nameMatch], [slugMatch], [defaultMatch]] = await Promise.all([
      this.database.db
        .select({ id: plans.id })
        .from(plans)
        .where(eq(plans.name, values.name))
        .limit(1),
      this.database.db
        .select({ id: plans.id })
        .from(plans)
        .where(eq(plans.slug, values.slug))
        .limit(1),
      values.isDefaultSignup
        ? this.database.db
            .select({ id: plans.id })
            .from(plans)
            .where(eq(plans.isDefaultSignup, true))
            .limit(1)
        : Promise.resolve([]),
    ]);

    if (nameMatch && nameMatch.id !== excludedPlanId) {
      throw new ConflictException('Plan name already exists');
    }
    if (slugMatch && slugMatch.id !== excludedPlanId) {
      throw new ConflictException('Plan slug already exists');
    }
    if (defaultMatch && defaultMatch.id !== excludedPlanId) {
      throw new ConflictException('Default signup plan already exists');
    }
  }

  private parse<T>(result: z.ZodSafeParseResult<T>): T {
    if (!result.success) throw new BadRequestException();
    return result.data;
  }

  private parseId(id: string): string {
    return this.parse(z.uuid().safeParse(id));
  }

  private serialize(
    plan: typeof plans.$inferSelect,
    subscriberCount = 0,
  ): AdminPlan {
    return {
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
      status: plan.status as AdminPlan['status'],
      featured: plan.featured,
      currency: plan.currency as AdminPlan['currency'],
      price: Number(plan.price),
      billingType: plan.billingType,
      isFree: plan.isFree,
      isDefaultSignup: plan.isDefaultSignup,
      trialDays: plan.trialDays,
      position: plan.position,
      description: plan.description,
      permissionIds: plan.permissionIds,
      subscriberCount,
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
    };
  }
}
