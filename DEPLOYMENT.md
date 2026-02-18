# Deployment Guide

## Vercel Deployment

### Prerequisites
- GitHub account connected to Vercel
- Gemini API key (or local model setup)

### Environment Variables

The following environment variables need to be configured in Vercel:

#### Required
- `GEMINI_API_KEY` - Your Google Gemini API key (get from https://makersuite.google.com/app/apikey)

#### Optional (for local model)
- `USE_LOCAL_MODEL` - Set to `true` to use local models instead of Gemini
- `OLLAMA_MODEL` - Model name (e.g., `llama3.1`)
- `CUSTOM_LLM_URL` - URL to your custom LLM server

### Step-by-Step Deployment

1. **Push your code to GitHub**
   ```bash
   git add .
   git commit -m "Prepare for deployment"
   git push origin main
   ```

2. **Import project in Vercel**
   - Go to https://vercel.com/new
   - Import your repository
   - Vercel will auto-detect Next.js

3. **Configure Environment Variables**
   - In project settings, go to "Environment Variables"
   - Add `GEMINI_API_KEY` with your actual key
   - Add any other optional variables

4. **Deploy**
   - Click "Deploy"
   - Wait for build to complete
   - Your app will be live at `your-project.vercel.app`

### Database Considerations

⚠️ **Important**: This app uses SQLite which is **not persistent** on Vercel's serverless environment.

**For production, you have two options:**

#### Option 1: Migrate to a persistent database
- **Vercel Postgres** - https://vercel.com/docs/storage/vercel-postgres
- **Turso** (SQLite-compatible) - https://turso.tech/
- **PlanetScale** - https://planetscale.com/

#### Option 2: Keep SQLite (temporary/demo purposes)
If you want to keep SQLite for now:
- Data will reset on each deployment
- Users will lose their data
- Only suitable for demos or testing

To migrate to Vercel Postgres:
```bash
npm install @vercel/postgres
```

Then update `lib/db/index.ts` to use Postgres instead of SQLite.

### Build Configuration

The app is configured with:
- Next.js 16.1.6
- App Router
- Server-side rendering
- `pdf-parse` as external package

### Performance Optimization

- Images are optimized automatically by Next.js
- CSS is minified in production
- JavaScript is bundled and tree-shaken

### Monitoring

After deployment:
- Check Vercel Analytics dashboard
- Monitor function execution times
- Review error logs in Vercel dashboard

### Troubleshooting

#### Build fails with "Module not found"
- Ensure all dependencies are in `package.json`
- Run `npm install` locally to verify

#### API routes return 500
- Check environment variables are set correctly
- Review function logs in Vercel dashboard

#### Database errors
- Remember SQLite doesn't persist on Vercel
- Consider migrating to Vercel Postgres

#### PDF parsing fails
- Ensure `pdf-parse` is in `serverExternalPackages` in `next.config.ts`
- Check file size limits (Vercel has 4.5MB limit for serverless functions)

### Post-Deployment Checklist

- [ ] Test all pages load correctly
- [ ] Verify master profile page works
- [ ] Test resume upload and parsing
- [ ] Test job description analysis
- [ ] Test resume tailoring with AI
- [ ] Test PDF export
- [ ] Check mobile responsiveness
- [ ] Verify API key is working
- [ ] Test on different browsers
- [ ] Check error handling

### Domain Setup (Optional)

To use a custom domain:
1. Go to project settings → Domains
2. Add your domain
3. Configure DNS records as shown
4. Wait for SSL certificate to provision

### Updates and Redeployment

Vercel automatically deploys on every push to main branch:
```bash
git push origin main
```

For manual deployment:
```bash
vercel --prod
```

## Support

For issues:
- Check Vercel documentation: https://vercel.com/docs
- Review Next.js documentation: https://nextjs.org/docs
- Check application logs in Vercel dashboard
