-- Migration 009: Add trash_json column to project_hardware_finals
--
-- Stores hardware sets (with their matched doors) that the user has deleted
-- but not yet permanently removed. The undo-toast gives a 6-second window;
-- after that the item is moved here. The TrashModal lets users restore items
-- back into final_json, or permanently discard them.
--
-- Shape of each element in trash_json:
--   {
--     "id":          "string",          -- stable UUID for this trash entry
--     "type":        "set" | "door",
--     "setData":     MergedHardwareSet, -- present when type = "set"
--     "doorData":    MergedDoor,        -- present when type = "door"
--     "setName":     "string",          -- display label
--     "deletedAt":   "ISO string"
--   }

ALTER TABLE project_hardware_finals
  ADD COLUMN IF NOT EXISTS trash_json jsonb NOT NULL DEFAULT '[]'::jsonb;
