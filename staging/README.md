# DIT Report — ניהול דוחות סיור

מערכת PWA מלאה לניהול דוחות סיור ופיקוח בנייה עם:
- ✅ ייצוא PDF עם הדיזיין החדש
- ✅ כלי Markup על PDF (ציור וסימונים)
- ✅ תמיכה בתמונות ובוידאו
- ✅ עברית RTL מלאה
- ✅ עבודה Offline עם Service Worker

## 🚀 התחלה מהירה

### Local Development
```bash
# Python 3
python -m http.server 3000

# או Node.js
npx http-server -p 3000
```

ואז פתח: `http://localhost:3000`

### GitHub Pages
האתר הוא live ב:
```
https://benihai.github.io/Dit-reports-project/
```

**הערה:** אם אתה רואה פורמט דוח ישן, עשה:
- `Ctrl+Shift+R` (Hard Refresh) לניקוי cache
- או `Ctrl+Shift+Delete` → ניקיון נתונים מתחזוקה

## 📋 תכונות

### 1. ניהול מנהלים ופרויקטים
- הוסף מנהלים (Inspectors)
- צור פרויקטים עם לוגו לקוח
- חיפוש לוגו אוטומטי + העלאה ידנית

### 2. דוחות עם ממצאים
- יצירת דוחות מפורטים
- הוספת ממצאים (findings) עם:
  - תיאור טקסטואלי
  - אחראי (Responsible person)
  - תמונות
  - וידאו עם QR codes
  - סימונים על תוכניות PDF

### 3. ייצוא PDF

הדוח המיוצא כולל:

#### Header
- DIT Logo (שקוף) | כותרת מרכזית | לוגו לקוח
- Green stripe (#8CC63F) בחלק העליון

#### Metadata Grid (2-column)
- שם פרויקט
- מיקום / אתר
- תאריך הסיור
- מפקח מטעם DIT
- משתתפים נוספים
- מטרת הסיור

#### Finding Cards
- מספר + כותרת בבאדג' שחור
- תיאור מלא
- תמונה ראשונה בצד
- תמונות נוספות
- סימונים מתוכניות
- QR codes לוידאוהים
- אחראי + reference number

#### Summary Block
- תאריך ביקור הבא
- חתימה של המפקח

#### Footer
- מידע ריפרנס + DIT branding

## 🛠️ טכנולוגיות

- **Frontend:** Vanilla JavaScript (IIFE modules)
- **Storage:** localforage (IndexedDB with fallback)
- **PDF Export:** html2canvas + jsPDF
- **PDF Markup:** PDF.js + Canvas
- **QR Codes:** qrcodejs
- **PWA:** Service Worker + Web App Manifest
- **RTL:** Hebrew, full RTL support

## 📦 קבצים עיקריים

```
.
├── index.html                 # Main app shell
├── js/
│   ├── app.js                 # App router & state
│   ├── storage.js             # Data persistence
│   ├── pdfExport.js           # PDF generation (NEW DESIGN)
│   ├── pdfMarkup.js           # PDF annotation tool
│   └── views/                 # Route views
├── css/
│   └── style.css              # Styling
├── icons/
│   ├── dit-logo.png           # DIT Logo (transparent)
│   └── icon-*.svg             # PWA icons
└── sw.js                       # Service Worker
```

## 🔄 GitHub Actions

CI/CD pipeline אוטומטי:
- Deploy לGitHub Pages על כל push
- Build עם GitHub Pages Actions

## 🎨 Design System

הדוח בנוי על DIT Design System עם:
- **Colors:** #8CC63F (green), #1A1A1A (dark), #FAFAF8 (light)
- **Typography:** Heebo (Hebrew), Assistant (body)
- **Spacing:** 8px grid
- **Components:** Grid layouts, Cards, Badges, Icons

## 📱 Responsive

- Desktop (1280px)
- Tablet (768px)
- Mobile (375px)

## 🔐 Notes

- כל הנתונים נשמרים locally בדפדפן
- לא שולחים לשרת כלשהו
- אפשר להשתמש בלי אינטרנט (אחרי הטעינה הראשונה)

## 📝 License

Built by DIT — Design It Right
