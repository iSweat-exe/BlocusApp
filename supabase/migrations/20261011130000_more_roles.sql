-- Three more roles, each with a permission set that no other role has (least privilege):
--   relay      (15)  declares the position of the demonstration, nothing else (volunteers on the ground);
--   editor     (18)  publishes announcements, without the map tools (whoever runs the communication);
--   developer  (35)  reads health, statistics and the audit log, with no power over accounts (technical team).
-- The ranks leave gaps on purpose: a role only acts on strictly lower ranks, so this places the new roles in the
-- hierarchy without renumbering anything. `developer` ranks above `moderator` and below `admin`: an admin can assign
-- it, and it can act on nobody since it holds neither `role.assign` nor `user.ban`.
--
-- super_admin is not listed here: has_permission() grants it every catalogued permission. Existing accounts keep
-- their role. Roles are data managed by migrations (clients can only read them); an admin then adjusts what each one
-- may do from /admin/roles, within the hierarchy.

insert into public.roles (key, label, rank) values
  ('relay', 'Relais', 15),
  ('editor', 'Rédacteur', 18),
  ('developer', 'Développeur', 35);

insert into public.role_permissions (role, permission) values
  ('relay', 'map.position.declare'),
  ('editor', 'announcement.publish'),
  ('developer', 'monitoring.view'),
  ('developer', 'statistics.view'),
  ('developer', 'audit.read');
