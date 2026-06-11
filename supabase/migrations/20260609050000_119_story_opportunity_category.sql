-- Migration 119: Add story_category to story_opportunities
-- Stores the classified story type from the v2 scoring engine.
-- Populated by evaluateOpportunity() on score/rescore.

ALTER TABLE story_opportunities
  ADD COLUMN IF NOT EXISTS story_category TEXT;

COMMENT ON COLUMN story_opportunities.story_category IS
  'Classified story type: employment_outcome | customer_validation | community_impact | business_milestone | founder_journey | internal_operations';
