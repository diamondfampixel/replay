-- A confirm request claims a pending action by moving it to EXECUTING before
-- the tool runs, so two concurrent confirmations cannot both execute it.
ALTER TYPE "AIActionStatus" ADD VALUE IF NOT EXISTS 'EXECUTING';
