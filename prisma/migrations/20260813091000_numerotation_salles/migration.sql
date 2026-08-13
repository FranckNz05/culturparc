-- Conventions de numerotation propres a chaque salle.
-- Les valeurs par defaut reproduisent le comportement actuel : rangees en
-- lettres depuis l'ecran, places numerotees de gauche a droite a partir de 1.

-- CreateEnum
CREATE TYPE "RowLabelStyle" AS ENUM ('LETTERS', 'NUMBERS');

-- CreateEnum
CREATE TYPE "RowOrder" AS ENUM ('FROM_SCREEN', 'FROM_BACK');

-- CreateEnum
CREATE TYPE "SeatDirection" AS ENUM ('LEFT_TO_RIGHT', 'RIGHT_TO_LEFT');

-- AlterTable
ALTER TABLE "auditoriums"
  ADD COLUMN "rowLabelStyle" "RowLabelStyle" NOT NULL DEFAULT 'LETTERS',
  ADD COLUMN "rowOrder" "RowOrder" NOT NULL DEFAULT 'FROM_SCREEN',
  ADD COLUMN "seatDirection" "SeatDirection" NOT NULL DEFAULT 'LEFT_TO_RIGHT',
  ADD COLUMN "seatNumberStart" INTEGER NOT NULL DEFAULT 1;
