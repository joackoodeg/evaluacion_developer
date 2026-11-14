CREATE TYPE "public"."tipo_movimiento" AS ENUM('entrada', 'salida');--> statement-breakpoint
CREATE TABLE "categorias" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(100) NOT NULL,
	"descripcion" text,
	CONSTRAINT "categorias_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "movimientos" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"producto_id" integer NOT NULL,
	"tipo" "tipo_movimiento" NOT NULL,
	"cantidad" integer NOT NULL,
	"fecha" timestamp with time zone DEFAULT now() NOT NULL,
	"motivo" text,
	"usuario" varchar(100) NOT NULL,
	CONSTRAINT "cantidad_positiva" CHECK ("movimientos"."cantidad" > 0)
);
--> statement-breakpoint
CREATE TABLE "productos" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(255) NOT NULL,
	"categoria_id" integer NOT NULL,
	"precio_unitario" numeric(12, 2) NOT NULL,
	"stock_actual" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "stock_no_negativo" CHECK ("productos"."stock_actual" >= 0),
	CONSTRAINT "precio_no_negativo" CHECK ("productos"."precio_unitario" >= 0)
);
--> statement-breakpoint
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_categoria_id_categorias_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_movimientos_producto_fecha" ON "movimientos" USING btree ("producto_id","fecha");--> statement-breakpoint
CREATE INDEX "idx_productos_categoria" ON "productos" USING btree ("categoria_id");