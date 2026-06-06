# הגדרת Supabase — DIT Reports

## שלב 1: צור פרויקט Supabase

1. היכנס ל-[supabase.com](https://supabase.com) וצור חשבון חינמי
2. לחץ **New Project** — בחר שם ואזור (מומלץ: EU West לישראל)
3. שמור את **Project URL** ו-**anon public key** (Settings → API)

---

## שלב 2: הגדר את מסד הנתונים

1. בפרויקט Supabase, עבור ל-**SQL Editor**
2. העתק את כל תוכן הקובץ `supabase/schema.sql`
3. הדבק ב-SQL Editor ולחץ **Run**

---

## שלב 3: השבת אימות דואר אלקטרוני

כדי שניצור משתמשים ישירות מהאפליקציה ללא שליחת מייל:

1. עבור ל-**Authentication → Settings**
2. השבת את **Enable email confirmations**
3. לחץ **Save**

---

## שלב 4: הכנס את פרטי החיבור לאפליקציה

ערוך את הקובץ `js/config.js`:

```javascript
const CONFIG = {
  SUPABASE_URL: 'https://xxxxxxxxxxxx.supabase.co',   // Project URL
  SUPABASE_ANON_KEY: 'eyJhbGciOi...',                 // anon public key
};
```

---

## שלב 5: צור את המשתמש הראשון (מנהל)

1. בפרויקט Supabase עבור ל-**Authentication → Users**
2. לחץ **Invite user** (או **Add user**)
3. הכנס אימייל וסיסמה — בחר **Auto Confirm User**
4. המשתמש יקבל תפקיד `admin` אוטומטית

---

## שלב 6: הרצת מיגרציית ניהול משתמשים

ב-**SQL Editor**, הרץ גם את הקובץ `supabase/migrations/003_user_folders.sql`.

---

## שימוש

| תפקיד | מה רואים |
|--------|-----------|
| **מנהל מערכת (admin)** | גישה מלאה — כל התיקיות, פרויקטים, דוחות, ודף ניהול משתמשים |
| **משתמש (user)** | גישה רק לתיקייה אחת (מנהל פרויקטים) ששויכה לו |

### יצירת משתמש חדש:
1. התחבר כמנהל מערכת
2. צור תיקייה (מנהל פרויקטים) בדף הבית אם עדיין אין
3. לחץ על אייקון 👥 בפינה → **ניהול משתמשים**
4. לחץ **+ משתמש חדש**
5. הכנס פרטים, בחר **משתמש**, ובחר **תיקייה משויכת**
6. המשתמש יוכל להתחבר ולעבוד רק בתיקייה שלו

### הסרת משתמש:
בדף ניהול משתמשים → לחץ **הסר** ליד המשתמש

---

## אחסון נתונים

- כל הנתונים נשמרים ב-Supabase Postgres
- תמונות ווידאו נשמרים כ-Base64 בתוך מסד הנתונים
- מגבלת ה-Free tier: 500MB מסד נתונים + 1GB קבצים
- לפרויקטים גדולים עם הרבה תמונות — שקול לשדרג לתוכנית Pro

---

## GitHub Pages

הקובץ `js/config.js` מכיל את מפתח ה-anon (ציבורי) של Supabase.
מפתח זה **בטוח לחשיפה** כי ההרשאות מנוהלות ב-RLS (Row Level Security) ב-Supabase.
אל תכניס לעולם את ה-`service_role` key לקוד הפרונט.
