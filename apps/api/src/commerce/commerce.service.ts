import { HttpStatus, Injectable } from '@nestjs/common';
import {
  apiAuditLogs,
  commerceInventoryLevels,
  commerceOrderItems,
  commerceOrders,
  commerceProducts,
  commerceReturnRequests,
} from '@workspace/database';
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  sql,
} from '@workspace/database/query';
import {
  createPortalCommerceOrderSchema,
  createPortalCommerceProductSchema,
  createPortalCommerceReturnSchema,
  portalCommerceQuerySchema,
  updatePortalCommerceOrderSchema,
  updatePortalCommerceProductSchema,
  type PortalAuthSession,
  type PortalCommerceDashboard,
  type PortalCommerceOrder,
  type PortalCommerceProduct,
} from '@workspace/contracts';
import { DatabaseService } from '../database/database.service';
import { AppException } from '../platform/errors/app-exception';

const managerRoles = new Set(['owner', 'admin']);

@Injectable()
export class CommerceService {
  constructor(private readonly database: DatabaseService) {}

  async dashboard(
    session: PortalAuthSession,
    query: unknown,
  ): Promise<PortalCommerceDashboard> {
    const parsed = portalCommerceQuerySchema.safeParse(query);
    if (!parsed.success) throw this.invalid();
    const cutoff = periodCutoff(parsed.data.period);
    const filters = [
      eq(commerceOrders.workspaceId, session.workspace.id),
      gte(commerceOrders.orderedAt, cutoff),
    ];
    if (parsed.data.channel !== 'all') {
      filters.push(eq(commerceOrders.channel, parsed.data.channel));
    }
    const [orders, inventory, openReturns, metricCurrency] = await Promise.all([
      this.database.db
        .select()
        .from(commerceOrders)
        .where(and(...filters))
        .orderBy(desc(commerceOrders.orderedAt))
        .limit(100),
      this.database.db
        .select({
          product: commerceProducts,
          inventory: commerceInventoryLevels,
        })
        .from(commerceProducts)
        .innerJoin(
          commerceInventoryLevels,
          eq(commerceProducts.id, commerceInventoryLevels.productId),
        )
        .where(
          and(
            eq(commerceProducts.workspaceId, session.workspace.id),
            eq(commerceProducts.status, 'active'),
          ),
        )
        .orderBy(asc(commerceProducts.name)),
      this.database.db
        .select({ value: sql<number>`count(*)::int` })
        .from(commerceReturnRequests)
        .where(
          and(
            eq(commerceReturnRequests.workspaceId, session.workspace.id),
            inArray(commerceReturnRequests.status, ['requested', 'approved']),
          ),
        ),
      this.database.db
        .select({ currency: commerceOrders.currency })
        .from(commerceOrders)
        .where(and(...filters))
        .orderBy(desc(commerceOrders.orderedAt))
        .limit(1),
    ]);
    const currency = metricCurrency[0]?.currency ?? 'USD';
    const [metrics] = await this.database.db
      .select({
        averageOrderMinor: sql<number>`coalesce(round(avg(${commerceOrders.totalMinor}) filter (where ${commerceOrders.status} <> 'cancelled')), 0)::int`,
        orderCount: sql<number>`count(*) filter (where ${commerceOrders.status} <> 'cancelled')::int`,
        salesMinor: sql<number>`coalesce(sum(${commerceOrders.totalMinor}) filter (where ${commerceOrders.status} = 'completed'), 0)::int`,
      })
      .from(commerceOrders)
      .where(and(...filters, eq(commerceOrders.currency, currency)));
    const itemCounts = await this.orderItemCounts(
      orders.map((order) => order.id),
    );
    return {
      canView: true,
      canManage: managerRoles.has(session.workspace.role),
      period: parsed.data.period,
      channel: parsed.data.channel,
      metrics: {
        currency,
        salesMinor: metrics?.salesMinor ?? 0,
        orderCount: metrics?.orderCount ?? 0,
        averageOrderMinor: metrics?.averageOrderMinor ?? 0,
        openReturnCount: openReturns[0]?.value ?? 0,
      },
      inventory: inventory.map(({ product, inventory: level }) => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        available: level.available,
        reserved: level.reserved,
        lowStockThreshold: level.lowStockThreshold,
        status:
          level.available === 0
            ? 'out'
            : level.available - level.reserved <= level.lowStockThreshold
              ? 'low'
              : 'healthy',
      })),
      orders: orders.map((order) =>
        this.serializeOrder(order, itemCounts.get(order.id) ?? 0),
      ),
    };
  }

  async products(session: PortalAuthSession): Promise<PortalCommerceProduct[]> {
    const rows = await this.database.db
      .select({ product: commerceProducts, inventory: commerceInventoryLevels })
      .from(commerceProducts)
      .innerJoin(
        commerceInventoryLevels,
        eq(commerceProducts.id, commerceInventoryLevels.productId),
      )
      .where(eq(commerceProducts.workspaceId, session.workspace.id))
      .orderBy(asc(commerceProducts.name));
    return rows.map(({ product, inventory }) =>
      this.serializeProduct(product, inventory),
    );
  }

  async createProduct(session: PortalAuthSession, input: unknown) {
    this.requireManage(session);
    const parsed = createPortalCommerceProductSchema.safeParse(input);
    if (!parsed.success) throw this.invalid();
    const { available, reserved, lowStockThreshold, ...productValues } =
      parsed.data;
    if (reserved > available) throw this.invalid();
    const now = new Date();
    try {
      return await this.database.db.transaction(async (tx) => {
        const [product] = await tx
          .insert(commerceProducts)
          .values({
            workspaceId: session.workspace.id,
            createdByUserId: session.user.id,
            ...productValues,
            sku: productValues.sku.toUpperCase(),
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        if (!product) throw this.failed();
        const [inventory] = await tx
          .insert(commerceInventoryLevels)
          .values({
            productId: product.id,
            workspaceId: session.workspace.id,
            available,
            reserved,
            lowStockThreshold,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        if (!inventory) throw this.failed();
        await tx.insert(apiAuditLogs).values({
          workspaceId: session.workspace.id,
          actorUserId: session.user.id,
          event: 'commerce.product_created',
          subjectType: 'commerce_product',
          subjectId: product.id,
          metadata: { sku: product.sku },
        });
        return this.serializeProduct(product, inventory);
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) throw this.conflict();
      throw error;
    }
  }

  async updateProduct(session: PortalAuthSession, id: string, input: unknown) {
    this.requireManage(session);
    const parsed = updatePortalCommerceProductSchema.safeParse(input);
    if (!parsed.success) throw this.invalid();
    const { available, reserved, lowStockThreshold, ...changes } = parsed.data;
    try {
      return await this.database.db.transaction(async (tx) => {
        const [currentProduct] = await tx
          .select()
          .from(commerceProducts)
          .where(
            and(
              eq(commerceProducts.id, id),
              eq(commerceProducts.workspaceId, session.workspace.id),
            ),
          )
          .for('update')
          .limit(1);
        if (!currentProduct) throw this.notFound();

        const [currentInventory] = await tx
          .select()
          .from(commerceInventoryLevels)
          .where(
            and(
              eq(commerceInventoryLevels.productId, currentProduct.id),
              eq(commerceInventoryLevels.workspaceId, session.workspace.id),
            ),
          )
          .for('update')
          .limit(1);
        if (!currentInventory) throw this.notFound();

        const nextAvailable = available ?? currentInventory.available;
        const nextReserved = reserved ?? currentInventory.reserved;
        if (nextReserved > nextAvailable) throw this.invalid();

        const [product] = await tx
          .update(commerceProducts)
          .set({
            ...changes,
            ...(changes.sku ? { sku: changes.sku.toUpperCase() } : {}),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(commerceProducts.id, currentProduct.id),
              eq(commerceProducts.workspaceId, session.workspace.id),
            ),
          )
          .returning();
        const [inventory] = await tx
          .update(commerceInventoryLevels)
          .set({
            available: nextAvailable,
            reserved: nextReserved,
            lowStockThreshold:
              lowStockThreshold ?? currentInventory.lowStockThreshold,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(commerceInventoryLevels.productId, currentProduct.id),
              eq(commerceInventoryLevels.workspaceId, session.workspace.id),
            ),
          )
          .returning();
        if (!product || !inventory) throw this.notFound();
        await tx.insert(apiAuditLogs).values({
          workspaceId: session.workspace.id,
          actorUserId: session.user.id,
          event: 'commerce.product_updated',
          subjectType: 'commerce_product',
          subjectId: product.id,
          metadata: { changedFields: Object.keys(parsed.data) },
        });
        return this.serializeProduct(product, inventory);
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) throw this.conflict();
      throw error;
    }
  }

  async createOrder(session: PortalAuthSession, input: unknown) {
    this.requireManage(session);
    const parsed = createPortalCommerceOrderSchema.safeParse(input);
    if (!parsed.success) throw this.invalid();
    const productIds = parsed.data.items
      .map((item) => item.productId)
      .filter((id): id is string => Boolean(id));
    if (productIds.length) {
      const products = await this.database.db
        .select({ id: commerceProducts.id })
        .from(commerceProducts)
        .where(
          and(
            eq(commerceProducts.workspaceId, session.workspace.id),
            eq(commerceProducts.status, 'active'),
            inArray(commerceProducts.id, productIds),
          ),
        );
      if (products.length !== new Set(productIds).size) throw this.notFound();
    }
    const totalMinor = parsed.data.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPriceMinor,
      0,
    );
    const now = new Date();
    try {
      const order = await this.database.db.transaction(async (tx) => {
        for (const item of parsed.data.items) {
          if (!item.productId) continue;
          const [reserved] = await tx
            .update(commerceInventoryLevels)
            .set({
              reserved: sql`${commerceInventoryLevels.reserved} + ${item.quantity}`,
              updatedAt: now,
            })
            .where(
              and(
                eq(commerceInventoryLevels.productId, item.productId),
                eq(commerceInventoryLevels.workspaceId, session.workspace.id),
                sql`${commerceInventoryLevels.available} - ${commerceInventoryLevels.reserved} >= ${item.quantity}`,
              ),
            )
            .returning({ id: commerceInventoryLevels.id });
          if (!reserved) throw this.inventoryInsufficient();
        }
        const [created] = await tx
          .insert(commerceOrders)
          .values({
            workspaceId: session.workspace.id,
            createdByUserId: session.user.id,
            customerName: parsed.data.customerName,
            customerEmail: parsed.data.customerEmail ?? null,
            channel: parsed.data.channel,
            currency: parsed.data.currency,
            totalMinor,
            externalReference: parsed.data.externalReference ?? null,
            orderedAt: parsed.data.orderedAt
              ? new Date(parsed.data.orderedAt)
              : now,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        if (!created) throw this.failed();
        await tx.insert(commerceOrderItems).values(
          parsed.data.items.map((item) => ({
            commerceOrderId: created.id,
            productId: item.productId ?? null,
            name: item.name,
            sku: item.sku,
            quantity: item.quantity,
            unitPriceMinor: item.unitPriceMinor,
            totalMinor: item.quantity * item.unitPriceMinor,
            createdAt: now,
            updatedAt: now,
          })),
        );
        await tx.insert(apiAuditLogs).values({
          workspaceId: session.workspace.id,
          actorUserId: session.user.id,
          event: 'commerce.order_created',
          subjectType: 'commerce_order',
          subjectId: created.id,
          metadata: { channel: created.channel, totalMinor },
        });
        return created;
      });
      return this.serializeOrder(
        order,
        parsed.data.items.reduce((sum, item) => sum + item.quantity, 0),
      );
    } catch (error) {
      if (this.isUniqueViolation(error)) throw this.conflict();
      throw error;
    }
  }

  async updateOrder(session: PortalAuthSession, id: string, input: unknown) {
    this.requireManage(session);
    const parsed = updatePortalCommerceOrderSchema.safeParse(input);
    if (!parsed.success) throw this.invalid();
    const result = await this.database.db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(commerceOrders)
        .where(
          and(
            eq(commerceOrders.id, id),
            eq(commerceOrders.workspaceId, session.workspace.id),
          ),
        )
        .for('update')
        .limit(1);
      if (!current) throw this.notFound();
      if (['completed', 'cancelled'].includes(current.status)) {
        throw this.invalid();
      }
      const items = await tx
        .select()
        .from(commerceOrderItems)
        .where(eq(commerceOrderItems.commerceOrderId, current.id));
      if (['completed', 'cancelled'].includes(parsed.data.status)) {
        for (const item of items) {
          if (!item.productId) continue;
          const set =
            parsed.data.status === 'completed'
              ? {
                  available: sql`${commerceInventoryLevels.available} - ${item.quantity}`,
                  reserved: sql`${commerceInventoryLevels.reserved} - ${item.quantity}`,
                  updatedAt: new Date(),
                }
              : {
                  reserved: sql`${commerceInventoryLevels.reserved} - ${item.quantity}`,
                  updatedAt: new Date(),
                };
          await tx
            .update(commerceInventoryLevels)
            .set(set)
            .where(
              and(
                eq(commerceInventoryLevels.productId, item.productId),
                eq(commerceInventoryLevels.workspaceId, session.workspace.id),
              ),
            );
        }
      }
      const [updated] = await tx
        .update(commerceOrders)
        .set({ status: parsed.data.status, updatedAt: new Date() })
        .where(eq(commerceOrders.id, current.id))
        .returning();
      if (!updated) throw this.notFound();
      await tx.insert(apiAuditLogs).values({
        workspaceId: session.workspace.id,
        actorUserId: session.user.id,
        event: 'commerce.order_status_updated',
        subjectType: 'commerce_order',
        subjectId: updated.id,
        metadata: { from: current.status, to: updated.status },
      });
      return {
        order: updated,
        itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      };
    });
    return this.serializeOrder(result.order, result.itemCount);
  }

  async createReturn(session: PortalAuthSession, input: unknown) {
    this.requireManage(session);
    const parsed = createPortalCommerceReturnSchema.safeParse(input);
    if (!parsed.success) throw this.invalid();
    return this.database.db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(commerceOrders)
        .where(
          and(
            eq(commerceOrders.id, parsed.data.orderId),
            eq(commerceOrders.workspaceId, session.workspace.id),
            eq(commerceOrders.status, 'completed'),
          ),
        )
        .for('update')
        .limit(1);
      if (!order) throw this.invalid();

      const [existingReturns] = await tx
        .select({
          amountMinor: sql<number>`coalesce(sum(${commerceReturnRequests.amountMinor}), 0)::int`,
        })
        .from(commerceReturnRequests)
        .where(
          and(
            eq(commerceReturnRequests.commerceOrderId, order.id),
            eq(commerceReturnRequests.workspaceId, session.workspace.id),
            inArray(commerceReturnRequests.status, [
              'requested',
              'approved',
              'completed',
            ]),
          ),
        );
      if (
        (existingReturns?.amountMinor ?? 0) + parsed.data.amountMinor >
        order.totalMinor
      ) {
        throw this.invalid();
      }

      const [request] = await tx
        .insert(commerceReturnRequests)
        .values({
          commerceOrderId: order.id,
          workspaceId: session.workspace.id,
          amountMinor: parsed.data.amountMinor,
          reason: parsed.data.reason,
        })
        .returning();
      if (!request) throw this.failed();
      return request;
    });
  }

  private async product(workspaceId: string, id: string) {
    const [row] = await this.database.db
      .select({ product: commerceProducts, inventory: commerceInventoryLevels })
      .from(commerceProducts)
      .innerJoin(
        commerceInventoryLevels,
        eq(commerceProducts.id, commerceInventoryLevels.productId),
      )
      .where(
        and(
          eq(commerceProducts.id, id),
          eq(commerceProducts.workspaceId, workspaceId),
        ),
      )
      .limit(1);
    if (!row) throw this.notFound();
    return row;
  }

  private async orderItemCounts(ids: string[]) {
    const result = new Map<string, number>();
    if (!ids.length) return result;
    const rows = await this.database.db
      .select({
        orderId: commerceOrderItems.commerceOrderId,
        count: sql<number>`sum(${commerceOrderItems.quantity})::int`,
      })
      .from(commerceOrderItems)
      .where(inArray(commerceOrderItems.commerceOrderId, ids))
      .groupBy(commerceOrderItems.commerceOrderId);
    rows.forEach((row) => result.set(row.orderId, row.count));
    return result;
  }

  private serializeProduct(
    product: typeof commerceProducts.$inferSelect,
    inventory: typeof commerceInventoryLevels.$inferSelect,
  ): PortalCommerceProduct {
    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      description: product.description,
      status: product.status,
      available: inventory.available,
      reserved: inventory.reserved,
      lowStockThreshold: inventory.lowStockThreshold,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    };
  }

  private serializeOrder(
    order: typeof commerceOrders.$inferSelect,
    itemCount: number,
  ): PortalCommerceOrder {
    return {
      id: order.id,
      customerName: order.customerName,
      channel: order.channel,
      itemCount,
      currency: order.currency,
      totalMinor: order.totalMinor,
      status: order.status,
      orderedAt: order.orderedAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    };
  }

  private requireManage(session: PortalAuthSession) {
    if (!managerRoles.has(session.workspace.role)) {
      throw new AppException('COMMERCE_MANAGE_FORBIDDEN', HttpStatus.FORBIDDEN);
    }
  }
  private invalid() {
    return new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
  }
  private notFound() {
    return new AppException(
      'COMMERCE_RESOURCE_NOT_FOUND',
      HttpStatus.NOT_FOUND,
    );
  }
  private conflict() {
    return new AppException('COMMERCE_RESOURCE_CONFLICT', HttpStatus.CONFLICT);
  }
  private inventoryInsufficient() {
    return new AppException(
      'COMMERCE_INVENTORY_INSUFFICIENT',
      HttpStatus.CONFLICT,
    );
  }
  private failed() {
    return new AppException(
      'COMMERCE_REQUEST_FAILED',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
  private isUniqueViolation(error: unknown) {
    return Boolean(
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === '23505',
    );
  }
}

function periodCutoff(period: 'month' | 'quarter' | 'year') {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCHours(0, 0, 0, 0);
  if (period === 'quarter') date.setUTCMonth(date.getUTCMonth() - 2);
  if (period === 'year') date.setUTCMonth(0);
  return date;
}
