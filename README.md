# SEO Command Center — دليل التنفيذ خطوة بخطوة (المرحلة 1)

المرحلة دي: نظام أساسي لإدارة المواقع + قاعدة بيانات جاهزة للتوسع. لسه من غير ربط GSC/GA4 (ده المرحلة 2).

## الخطوة 1: عمل حساب Supabase وإنشاء المشروع
1. روحي https://supabase.com وسجلي بحساب GitHub.
2. New Project → اختاري اسم وباسورد لقاعدة البيانات (احفظيه في مكان آمن).
3. بعد ما المشروع يتعمل (بياخد دقيقة)، روحي على SQL Editor من القائمة الجانبية.
4. افتحي ملف `supabase/schema.sql` اللي جوه المشروع، انسخي محتواه بالكامل، والصقيه في SQL Editor واضغطي Run.
   - ده هيعمل الجداول: sites, tasks, metrics_daily, alerts, opportunities.
5. روحي Project Settings → API، وهتلاقي:
   - Project URL
   - anon public key
   احفظيهم، هنحتاجهم دلوقتي.

## الخطوة 2: تجهيز المشروع محلياً
1. لازم يكون عندك Node.js متثبت (نسخة 18 أو أحدث).
2. فكي الملف المضغوط اللي هبعتهولك، وافتحي Terminal جوه فولدر المشروع.
3. نفذي:
   ```
   npm install
   ```
4. اعملي نسخة من `.env.example` باسم `.env.local` واملأي فيها القيم اللي أخدتيها من Supabase:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```
5. شغلي المشروع محلياً للتجربة:
   ```
   npm run dev
   ```
   وافتحي http://localhost:3000 — المفروض تقدري تضيفي موقع وتشوفيه في الليستة فوراً (بيتخزن فعلياً في Supabase).

## الخطوة 3: رفع المشروع على GitHub
1. اعملي ريبو جديد على GitHub (خليه Public عشان تستفيدي من GitHub Actions مجاناً بدون حدود، أو Private لو مهم يبقى سري — هيفضل شغال برضه بس بحد شهري للدقائق).
2. جوه فولدر المشروع:
   ```
   git init
   git add .
   git commit -m "init: seo command center v1"
   git branch -M main
   git remote add origin https://github.com/USERNAME/REPO.git
   git push -u origin main
   ```
   ملحوظة: ملف `.gitignore` هيمنع رفع `.env.local` (فيه بالفعل السطر ده)، فالمفاتيح مش هتتسرب.

## الخطوة 4: النشر (Deploy) على Vercel مجاناً
1. روحي https://vercel.com وسجلي بحساب GitHub.
2. Add New Project → اختاري الريبو اللي رفعتيه.
3. في خانة Environment Variables ضيفي نفس القيم اللي في `.env.local`:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
4. Deploy — بعد دقيقة أو اتنين هيديكي لينك زي `your-project.vercel.app` وهو ده الموقع بتاعك شغال Live.

## خلصنا المرحلة 1! دلوقتي عندك:
- قاعدة بيانات جاهزة (5 جداول قابلة للتوسع)
- صفحة لإضافة وعرض المواقع، مربوطة فعلياً بالداتا بيز
- الموقع منشور Live ومجاني بالكامل

## الخطوة الجاية (المرحلة 2)
هنبني:
1. الاتصال الرسمي بـ Google Search Console API وGA4 Data API (هنحتاج نعمل Google Cloud Project ونفعّل الـ OAuth).
2. GitHub Action يشتغل يومياً يسحب البيانات ويخزنها في جدول `metrics_daily`.
3. لوحة اليوم الرئيسية تعرض البيانات دي فعلياً بدل الرسالة الترحيبية.

قولي لما تخلصي الخطوات دي وتشتغل عندك الموقع، وهكمل معاكي في المرحلة 2.
