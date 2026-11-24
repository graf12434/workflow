# Workflow

Тактичний dashboard для обліку розгортання та згортання засобів.

## Налаштування Supabase

1. Створіть Supabase project.
2. Відкрийте SQL Editor і виконайте `sql/supabase-schema.sql`, а потім `sql/supabase-harden-security.sql` і `sql/supabase-harden-v2.5.sql`.
3. Увімкніть Email auth у Supabase Authentication.
4. Створіть першого користувача.
5. Призначте роль адміністратора:

```sql
update public.profiles set role = 'admin' where email = 'your@email.com';
```

Якщо ви вже увійшли в застосунок, після зміни ролі в Supabase вийдіть і зайдіть знову.

6. Скопіюйте `public/supabase-config.example.js` у `public/supabase-config.js` і вставте туди project URL та anon key.

## Запуск

Відкрийте `public/index.html` у браузері. Якщо браузер блокує CDN або запити з локального файлу, запустіть простий локальний сервер з цієї папки.

```powershell
node server.js
```

Після цього відкрийте `http://localhost:8000`.

## Версії

Робочий код — у `public/` кореня. Нові зміни готуються в окремій версії (локальна папка
`version/`, у git не потрапляє), яка містить лише `public/` і лог; усе спільне (`sql/`,
`server.js`, `supabase-config.js`) береться з кореня.

```powershell
node scripts/new-version.mjs v2.3        # нова версія — копія попередньої
node server.js version/v2.3              # запустити її локально
node scripts/promote-version.mjs v2.3    # перенести готову версію в корінь
```

## Ролі

- `admin`: перегляд, створення, редагування, видалення.
- `operator`: перегляд, створення, редагування.
- `viewer`: тільки перегляд.
