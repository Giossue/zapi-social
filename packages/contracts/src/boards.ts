import { z } from "zod"

const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-f]{6}$/, "El color debe ser un hexadecimal de seis dígitos.")

export const boardTaskPrioritySchema = z.enum(["low", "medium", "high"])

export const boardColumnSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  position: z.number().int().nonnegative(),
  color: z.string(),
  isTerminal: z.boolean(),
  wipLimit: z.number().int().positive().nullable(),
})

export const boardLabelSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  color: z.string(),
})

export const boardMemberSchema = z.object({
  id: z.uuid(),
  name: z.string(),
})

export const boardTaskSchema = z.object({
  id: z.uuid(),
  columnId: z.uuid(),
  title: z.string(),
  description: z.string(),
  priority: boardTaskPrioritySchema,
  /** Fecha sin hora: el vencimiento es un día, no un instante. */
  dueDate: z.string().date().nullable(),
  progress: z.number().int().min(0).max(100),
  position: z.number().int().nonnegative(),
  assignee: boardMemberSchema.nullable(),
  createdBy: boardMemberSchema.nullable(),
  labelIds: z.array(z.uuid()),
  /** Contados en la consulta; no se guardan denormalizados en la tarea. */
  commentCount: z.number().int().nonnegative(),
  attachmentCount: z.number().int().nonnegative(),
  completedAt: z.string().datetime().nullable(),
  publishingPostId: z.uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const boardTaskCommentSchema = z.object({
  id: z.uuid(),
  body: z.string(),
  author: boardMemberSchema.nullable(),
  createdAt: z.string().datetime(),
})

export const boardTaskAttachmentSchema = z.object({
  id: z.uuid(),
  fileAssetId: z.uuid(),
  name: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  mimeType: z.string(),
  createdAt: z.string().datetime(),
})

export const boardTaskDetailSchema = boardTaskSchema.extend({
  comments: z.array(boardTaskCommentSchema),
  attachments: z.array(boardTaskAttachmentSchema),
})

/** Lo que la interfaz puede hacer, resuelto por la API a partir de permisos. */
export const boardAbilitiesSchema = z.object({
  manageTasks: z.boolean(),
  manageColumns: z.boolean(),
  deleteTasks: z.boolean(),
})

export const boardQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(255).optional(),
    assigneeId: z.union([z.uuid(), z.literal("me")]).optional(),
    priority: boardTaskPrioritySchema.optional(),
    labelId: z.uuid().optional(),
  })
  .strict()

export const boardResponseSchema = z.object({
  abilities: boardAbilitiesSchema,
  columns: z.array(boardColumnSchema),
  labels: z.array(boardLabelSchema),
  members: z.array(boardMemberSchema),
  tasks: z.array(boardTaskSchema),
  currentUserId: z.uuid(),
})

export const createBoardColumnSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    color: hexColor.default("#2563eb"),
    isTerminal: z.boolean().default(false),
    wipLimit: z.number().int().positive().max(999).nullable().default(null),
  })
  .strict()

export const updateBoardColumnSchema = createBoardColumnSchema
  .partial()
  .strict()

export const reorderBoardColumnsSchema = z
  .object({ columnIds: z.array(z.uuid()).min(1).max(50) })
  .strict()

export const createBoardTaskSchema = z
  .object({
    columnId: z.uuid(),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(5000).default(""),
    priority: boardTaskPrioritySchema.default("medium"),
    dueDate: z.string().date().nullable().default(null),
    progress: z.number().int().min(0).max(100).default(0),
    assigneeUserId: z.uuid().nullable().default(null),
    labelIds: z.array(z.uuid()).max(20).default([]),
    publishingPostId: z.uuid().nullable().default(null),
  })
  .strict()

export const updateBoardTaskSchema = createBoardTaskSchema
  .omit({ columnId: true })
  .partial()
  .strict()

/**
 * El movimiento manda columna e índice destino, no un desplazamiento: dos
 * personas arrastrando a la vez sobre un delta dejarían el orden incoherente.
 */
export const moveBoardTaskSchema = z
  .object({
    columnId: z.uuid(),
    position: z.number().int().min(0).max(9999),
  })
  .strict()

export const createBoardTaskCommentSchema = z
  .object({ body: z.string().trim().min(1).max(5000) })
  .strict()

export const createBoardTaskAttachmentSchema = z
  .object({ fileAssetId: z.uuid() })
  .strict()

export const createBoardLabelSchema = z
  .object({
    name: z.string().trim().min(1).max(40),
    color: hexColor.default("#64748b"),
  })
  .strict()

/** Estados de `publishing_posts` que el tablero de contenido pinta. */
export const contentBoardColumnSchema = z.enum([
  "draft",
  "scheduled",
  "processing",
  "published",
  "failed",
])

export const contentBoardCardSchema = z.object({
  id: z.uuid(),
  status: contentBoardColumnSchema,
  content: z.string(),
  scheduledAt: z.string().datetime().nullable(),
  publishedAt: z.string().datetime().nullable(),
  failureCode: z.string().nullable(),
  accountId: z.uuid().nullable(),
  accountName: z.string().nullable(),
  authorName: z.string().nullable(),
  mediaCount: z.number().int().nonnegative(),
})

export const contentBoardResponseSchema = z.object({
  cards: z.array(contentBoardCardSchema),
  canManage: z.boolean(),
})

export const moveContentBoardCardSchema = z
  .object({ status: z.enum(["draft", "scheduled"]) })
  .strict()

export type BoardTaskPriority = z.infer<typeof boardTaskPrioritySchema>
export type BoardColumn = z.infer<typeof boardColumnSchema>
export type BoardLabel = z.infer<typeof boardLabelSchema>
export type BoardMember = z.infer<typeof boardMemberSchema>
export type BoardTask = z.infer<typeof boardTaskSchema>
export type BoardTaskComment = z.infer<typeof boardTaskCommentSchema>
export type BoardTaskAttachment = z.infer<typeof boardTaskAttachmentSchema>
export type BoardTaskDetail = z.infer<typeof boardTaskDetailSchema>
export type BoardAbilities = z.infer<typeof boardAbilitiesSchema>
export type BoardQuery = z.infer<typeof boardQuerySchema>
export type BoardResponse = z.infer<typeof boardResponseSchema>
export type CreateBoardColumnInput = z.infer<typeof createBoardColumnSchema>
export type UpdateBoardColumnInput = z.infer<typeof updateBoardColumnSchema>
export type ReorderBoardColumnsInput = z.infer<typeof reorderBoardColumnsSchema>
export type CreateBoardTaskInput = z.infer<typeof createBoardTaskSchema>
export type UpdateBoardTaskInput = z.infer<typeof updateBoardTaskSchema>
export type MoveBoardTaskInput = z.infer<typeof moveBoardTaskSchema>
export type CreateBoardTaskCommentInput = z.infer<
  typeof createBoardTaskCommentSchema
>
export type CreateBoardTaskAttachmentInput = z.infer<
  typeof createBoardTaskAttachmentSchema
>
export type CreateBoardLabelInput = z.infer<typeof createBoardLabelSchema>
export type ContentBoardColumn = z.infer<typeof contentBoardColumnSchema>
export type ContentBoardCard = z.infer<typeof contentBoardCardSchema>
export type ContentBoardResponse = z.infer<typeof contentBoardResponseSchema>
export type MoveContentBoardCardInput = z.infer<
  typeof moveContentBoardCardSchema
>
