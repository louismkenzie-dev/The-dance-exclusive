-- Original migration seeded a specific admin user from the source project.
-- That UUID does not exist in this project's auth.users, and user_roles.user_id
-- has a FK to auth.users, so the insert is guarded to be a no-op when absent.
INSERT INTO public.user_roles (user_id, role)
SELECT 'd0e574f4-7c07-43eb-9069-c9abc9c33137', 'admin'
WHERE EXISTS (SELECT 1 FROM auth.users WHERE id = 'd0e574f4-7c07-43eb-9069-c9abc9c33137')
ON CONFLICT (user_id, role) DO NOTHING;