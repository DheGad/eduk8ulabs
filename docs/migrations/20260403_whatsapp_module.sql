-- ==========================================
-- StreetMP OS — WhatsApp Engine Schema
-- Migration: 20260403_whatsapp_module
-- ==========================================

-- WhatsApp Campaigns
CREATE TABLE IF NOT EXISTS wa_campaigns (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    campaign_name   TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'scheduled', 'running', 'completed', 'failed')),
    scheduled_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row-level org isolation index
CREATE INDEX IF NOT EXISTS idx_wa_campaigns_org_id ON wa_campaigns(org_id);
CREATE INDEX IF NOT EXISTS idx_wa_campaigns_status  ON wa_campaigns(status);

-- WhatsApp Messages (per-recipient delivery tracking)
CREATE TABLE IF NOT EXISTS wa_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id     UUID NOT NULL REFERENCES wa_campaigns(id) ON DELETE CASCADE,
    recipient_phone TEXT NOT NULL,
    template_used   TEXT NOT NULL,
    delivery_status TEXT NOT NULL DEFAULT 'queued'
                        CHECK (delivery_status IN ('queued', 'sent', 'delivered', 'read', 'failed')),
    meta_message_id TEXT,                     -- WhatsApp Message ID from Meta API
    error_code      TEXT,                     -- Meta error code if failed
    sent_at         TIMESTAMPTZ,
    delivered_at    TIMESTAMPTZ,
    read_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_messages_campaign_id     ON wa_messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_wa_messages_delivery_status ON wa_messages(delivery_status);
CREATE INDEX IF NOT EXISTS idx_wa_messages_recipient       ON wa_messages(recipient_phone);

-- Auto-update updated_at on wa_campaigns
CREATE OR REPLACE FUNCTION update_wa_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER wa_campaigns_updated_at
    BEFORE UPDATE ON wa_campaigns
    FOR EACH ROW EXECUTE FUNCTION update_wa_campaigns_updated_at();
