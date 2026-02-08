#!/bin/bash
echo "🚀 Deploying Edge Function to Supabase..."

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found"
    echo "Install from: https://supabase.com/docs/guides/cli"
    exit 1
fi

# Deploy function
supabase functions deploy analysis_trigger --project-ref wwoenpetjpvvohdqzfaq

echo "✅ Deployment complete!"
echo "Check logs: https://supabase.com/dashboard/project/wwoenpetjpvvohdqzfaq/functions/"
