/*
# Create clinical_notes table for MediScribe AI

## Purpose
Stores AI-generated clinical documentation (SOAP notes) from doctor-patient consultations.
This is a single-tenant app with no sign-in screen, so data is intentionally shared/public
and policies allow both anon and authenticated roles to read and write.

## New Tables
- `clinical_notes`
  - `id` (uuid, primary key, auto-generated)
  - `transcript` (text, not null) — raw consultation transcript
  - `labeled_transcript` (text) — transcript with speaker labels and entity annotations
  - `entities` (jsonb) — extracted medical entities (symptoms, medications, allergies, etc.)
  - `soap_note` (text, not null) — generated SOAP note
  - `safety_flags` (jsonb, default empty array) — safety concerns flagged by AI
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

## Security
- Row Level Security enabled on `clinical_notes`
- SELECT, INSERT, UPDATE, DELETE policies for anon + authenticated roles
- Data is intentionally public/shared (no auth screen in this app)
*/

CREATE TABLE IF NOT EXISTS clinical_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript text NOT NULL,
  labeled_transcript text,
  entities jsonb,
  soap_note text NOT NULL,
  safety_flags jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE clinical_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_clinical_notes" ON clinical_notes;
CREATE POLICY "anon_select_clinical_notes"
  ON clinical_notes FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "anon_insert_clinical_notes" ON clinical_notes;
CREATE POLICY "anon_insert_clinical_notes"
  ON clinical_notes FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_clinical_notes" ON clinical_notes;
CREATE POLICY "anon_update_clinical_notes"
  ON clinical_notes FOR UPDATE
  TO anon, authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_clinical_notes" ON clinical_notes;
CREATE POLICY "anon_delete_clinical_notes"
  ON clinical_notes FOR DELETE
  TO anon, authenticated
  USING (true);
