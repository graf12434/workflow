# Workflow

Тактичний dashboard для обліку розгортання та згортання засобів.

## Налаштування Supabase

1. Створіть Supabase project.
2. Відкрийте SQL Editor і виконайте `sql/supabase-schema.sql`.
3. Увімкніть Email auth у Supabase Authentication.
4. Створіть першого користувача.
5. Призначте роль адміністратора:

```sql
update public.profiles set role = 'admin' where email = 'your@email.com';
```

Якщо ви вже увійшли в застосунок, після зміни ролі в Supabase вийдіть і зайдіть знову.

6. Вставте project URL та anon key у `supabase-config.js`.

## Запуск

Відкрийте `index.html` у браузері. Якщо браузер блокує CDN або запити з локального файлу, запустіть простий локальний сервер з цієї папки.

```powershell
node server.js
```

Після цього відкрийте `http://localhost:8000`.

## Ролі

- `admin`: перегляд, створення, редагування, видалення.
- `operator`: перегляд, створення, редагування.
- `viewer`: тільки перегляд.
