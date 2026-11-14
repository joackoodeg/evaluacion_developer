ALTER TABLE "categorias" ADD COLUMN "slug" varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_slug_unique" UNIQUE("slug");