import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ogtbgcawznbuqejloubr.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ndGJnY2F3em5idXFlamxvdWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyOTc3ODAsImV4cCI6MjA5Mzg3Mzc4MH0.ULUYhGHP1-IY5i7Yub_pXP5BJsW_WFp4E_4D2zS0Rjk";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
