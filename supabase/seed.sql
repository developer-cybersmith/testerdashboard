-- Run after supabase/migrations/0001_init.sql in the Supabase SQL editor.
-- Passwords are not stored here. Create matching Auth users (email confirmed)
-- with password Secure@2026, or run: npm run seed

insert into public.people (id, email, role, payload)
values
  (
    'admin-1',
    'smith.gonsalves@cybersmithsecure.com',
    'admin',
    '{
      "id": "admin-1",
      "name": "Smith Nazareth Gonsalves",
      "email": "smith.gonsalves@cybersmithsecure.com",
      "role": "admin",
      "avatar": "https://ui-avatars.com/api/?name=Smith%20Nazareth%20Gonsalves&background=0b4f3c&color=fff",
      "jobTitle": "Director & Principal Consultant",
      "employeeCode": "CSS001",
      "avatarUploaded": true,
      "status": "active",
      "employmentType": "Full-Time",
      "joinDate": "2019-08-22",
      "phone": "+91 9503259778",
      "location": "Mumbai",
      "department": "Management",
      "skills": ["Management", "Consulting"],
      "lifecycleStatus": "confirmed",
      "confirmationDate": "2019-11-20",
      "shiftId": "shift-general",
      "leaveBalance": {
        "allUsed": 0, "allMax": 24,
        "annualUsed": 0, "annualMax": 12,
        "casualUsed": 0, "casualMax": 6,
        "sickUsed": 0, "sickMax": 6
      }
    }'::jsonb
  ),
  (
    'admin-2',
    'sarvesh.salgaonkar@cybersmithsecure.com',
    'admin',
    '{
      "id": "admin-2",
      "name": "Sarvesh Salgaonkar",
      "email": "sarvesh.salgaonkar@cybersmithsecure.com",
      "role": "admin",
      "avatar": "https://ui-avatars.com/api/?name=Sarvesh%20Salgaonkar&background=0b4f3c&color=fff",
      "jobTitle": "Associate Vice President",
      "employeeCode": "CSS004",
      "avatarUploaded": true,
      "status": "active",
      "employmentType": "Full-Time",
      "joinDate": "2020-12-08",
      "phone": "+91 9028866682",
      "location": "Pune",
      "department": "VAPT",
      "managerId": "admin-1",
      "skills": ["VAPT", "Management"],
      "lifecycleStatus": "confirmed",
      "confirmationDate": "2021-03-08",
      "shiftId": "shift-general",
      "leaveBalance": {
        "allUsed": 0, "allMax": 24,
        "annualUsed": 0, "annualMax": 12,
        "casualUsed": 0, "casualMax": 6,
        "sickUsed": 0, "sickMax": 6
      }
    }'::jsonb
  ),
  (
    'hr-1',
    'nirmal.pandey@cybersmithsecure.com',
    'hr',
    '{
      "id": "hr-1",
      "name": "Nirmal Uday Pandey",
      "email": "nirmal.pandey@cybersmithsecure.com",
      "role": "hr",
      "avatar": "https://ui-avatars.com/api/?name=Nirmal%20Uday%20Pandey&background=0b4f3c&color=fff",
      "jobTitle": "HR Coordinator",
      "employeeCode": "CSS226",
      "avatarUploaded": true,
      "status": "active",
      "employmentType": "Full-Time",
      "joinDate": "2025-01-11",
      "phone": "+91 8080450440",
      "location": "Mumbai",
      "department": "Human Resources",
      "managerId": "admin-1",
      "skills": ["HRMS", "Onboarding"],
      "lifecycleStatus": "confirmed",
      "confirmationDate": "2025-04-11",
      "contractEndDate": "2027-01-11",
      "shiftId": "shift-general",
      "leaveBalance": {
        "allUsed": 0, "allMax": 24,
        "annualUsed": 0, "annualMax": 12,
        "casualUsed": 0, "casualMax": 6,
        "sickUsed": 0, "sickMax": 6
      }
    }'::jsonb
  )
on conflict (id) do update
set email = excluded.email,
    role = excluded.role,
    payload = excluded.payload,
    updated_at = now();

insert into public.app_kv (key, payload)
values
  (
    'integrations',
    '{"slackEnabled": false, "slackWebhook": "", "teamsEnabled": false, "teamsWebhook": ""}'::jsonb
  ),
  ('historicalExits', '[]'::jsonb)
on conflict (key) do update
set payload = excluded.payload,
    updated_at = now();
