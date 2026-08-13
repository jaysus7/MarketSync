-- Distinguish who authored an assistant-role chat message: the AI ('ai') or a human
-- rep during a take-over ('human'). Lets the dealer console show rep replies apart
-- from the AI's, while the customer still just sees "the dealership".
alter table ai_messages add column if not exists sender_type text;   -- 'ai' | 'human' | null
