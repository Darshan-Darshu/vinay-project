-- student_resumes and placement_drives normalize skills in a trigger.
-- That trigger runs as the signed-in user, so authenticated needs execute.
grant execute on function private.normalize_skills(text[]) to authenticated;
