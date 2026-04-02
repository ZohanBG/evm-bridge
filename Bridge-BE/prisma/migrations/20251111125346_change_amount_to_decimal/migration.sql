/*
  Warnings:

  - The `fee` column on the `bridge_events` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `gasPrice` column on the `bridge_events` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `amount` on the `bridge_events` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "bridge_events" DROP COLUMN "amount",
ADD COLUMN     "amount" DECIMAL(78,0) NOT NULL,
DROP COLUMN "fee",
ADD COLUMN     "fee" DECIMAL(78,0),
DROP COLUMN "gasPrice",
ADD COLUMN     "gasPrice" DECIMAL(78,0);
