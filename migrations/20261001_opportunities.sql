-- 商机表：FDE / 冥想师 / 外贸三条业务线共用一张表，track 区分（对应 Prisma model Opportunity）

-- CreateTable
CREATE TABLE IF NOT EXISTS "opportunities" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "userId" TEXT NOT NULL,
    "track" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'lead',
    "company" TEXT,
    "category" TEXT,
    "source" TEXT,
    "partner" TEXT,
    "contact" TEXT,
    "amount" DOUBLE PRECISION,
    "link" TEXT,
    "notes" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isMock" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "opportunities_userId_track_idx" ON "opportunities"("userId", "track");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "opportunities_userId_stage_idx" ON "opportunities"("userId", "stage");

-- RowLevelSecurity：每人只能读写自己的商机
ALTER TABLE "opportunities" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_rows" ON "opportunities";
CREATE POLICY "own_rows" ON "opportunities" FOR ALL USING ("userId" = auth.uid()::text) WITH CHECK ("userId" = auth.uid()::text);

-- Trigger：更新时自动刷新 updatedAt
DROP TRIGGER IF EXISTS touch_updated_at ON "opportunities";
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON "opportunities" FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
